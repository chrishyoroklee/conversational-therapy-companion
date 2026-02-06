import os
import sys
import numpy as np

from qnn_utils import is_npu_available


def _use_npu_whisper() -> bool:
    """Decide whether to use the ONNX/QNN Whisper path."""
    use_npu = os.getenv("USE_NPU", "auto").lower()
    if use_npu == "false":
        return False
    return is_npu_available()


# ---------------------------------------------------------------------------
# NPU (ONNX Runtime + QNN EP) Whisper backend
# ---------------------------------------------------------------------------

class _NPUTranscriber:
    """Whisper Small Quantized running on QNN via ONNX Runtime."""

    SAMPLE_RATE = 16000
    N_FFT = 400
    HOP_LENGTH = 160
    N_MELS = 80
    CHUNK_LENGTH = 30  # seconds
    N_SAMPLES = CHUNK_LENGTH * SAMPLE_RATE  # 480000

    def __init__(self):
        import onnxruntime as ort
        from qnn_utils import get_providers, get_qnn_provider_options

        encoder_path = os.getenv(
            "WHISPER_ONNX_ENCODER", "models/whisper/WhisperEncoder.onnx"
        )
        decoder_path = os.getenv(
            "WHISPER_ONNX_DECODER", "models/whisper/WhisperDecoder.onnx"
        )

        providers = get_providers()
        provider_options = get_qnn_provider_options()

        print(f"[asr] Loading Whisper ONNX encoder: {encoder_path}", file=sys.stderr)
        self.encoder = ort.InferenceSession(
            encoder_path, providers=providers, provider_options=provider_options
        )
        print(f"[asr] Loading Whisper ONNX decoder: {decoder_path}", file=sys.stderr)
        self.decoder = ort.InferenceSession(
            decoder_path, providers=providers, provider_options=provider_options
        )
        print("[asr] Whisper ONNX models loaded (NPU)", file=sys.stderr)

        # Load mel filters and tokenizer from the openai-whisper package
        import whisper

        self._mel_filters = whisper.audio.mel_filters(
            whisper.audio.SAMPLE_RATE, self.N_FFT, self.N_MELS
        )
        self._tokenizer = whisper.tokenizer.get_tokenizer(
            multilingual=False, task="transcribe"
        )

    # -- audio preprocessing ------------------------------------------------

    def _load_audio(self, path: str) -> np.ndarray:
        """Load audio file and resample to 16 kHz mono float32."""
        import whisper

        audio = whisper.load_audio(path)
        return audio

    def _log_mel_spectrogram(self, audio: np.ndarray) -> np.ndarray:
        """Compute log-Mel spectrogram matching Whisper's expected input."""
        import whisper

        mel = whisper.log_mel_spectrogram(audio)
        # Pad or trim to exactly 30 s worth of frames
        mel = whisper.pad_or_trim(mel, self.N_SAMPLES // self.HOP_LENGTH)
        return mel.unsqueeze(0).numpy()  # (1, 80, 3000)

    # -- inference ----------------------------------------------------------

    def transcribe(self, audio_path: str) -> str:
        audio = self._load_audio(audio_path)
        mel = self._log_mel_spectrogram(audio)

        # Encoder
        encoder_out = self.encoder.run(None, {"mel": mel})[0]

        # Greedy decode
        sot = self._tokenizer.sot
        eot = self._tokenizer.eot
        tokens = [sot]

        for _ in range(224):  # max tokens
            token_input = np.array([tokens], dtype=np.int64)
            logits = self.decoder.run(
                None,
                {
                    "encoder_hidden_states": encoder_out,
                    "input_ids": token_input,
                },
            )[0]
            next_token = int(np.argmax(logits[0, -1, :]))
            if next_token == eot:
                break
            tokens.append(next_token)

        text = self._tokenizer.decode(tokens[1:])  # skip SOT
        return text.strip()


# ---------------------------------------------------------------------------
# CPU fallback — original faster-whisper backend
# ---------------------------------------------------------------------------

class _CPUTranscriber:
    def __init__(self):
        from faster_whisper import WhisperModel

        model_size = os.getenv("WHISPER_MODEL", "base.en")
        device = os.getenv("WHISPER_DEVICE", "cpu")
        compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

        print(f"Loading Whisper model: {model_size}", file=sys.stderr)
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)
        print("Whisper model loaded", file=sys.stderr)

    def transcribe(self, audio_path: str) -> str:
        segments, _ = self.model.transcribe(audio_path, beam_size=5)
        text = " ".join(segment.text.strip() for segment in segments)
        return text


# ---------------------------------------------------------------------------
# Public interface — auto-selects backend
# ---------------------------------------------------------------------------

class Transcriber:
    def __init__(self):
        if _use_npu_whisper():
            print("[asr] Using NPU (ONNX+QNN) Whisper backend", file=sys.stderr)
            self._backend = _NPUTranscriber()
        else:
            print("[asr] Using CPU (faster-whisper) backend", file=sys.stderr)
            self._backend = _CPUTranscriber()

    def transcribe(self, audio_path: str) -> str:
        return self._backend.transcribe(audio_path)
