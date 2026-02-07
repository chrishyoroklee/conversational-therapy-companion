import os
import sys
import time
import numpy as np
import tempfile
import subprocess
import struct

from qnn_utils import is_npu_available, is_native_qnn_available


def _use_native_qnn_whisper() -> bool:
    """Decide whether to use native QNN context binaries."""
    use_npu = os.getenv("USE_NPU_ASR", os.getenv("USE_NPU", "auto")).lower()
    if use_npu == "false":
        return False
    return is_native_qnn_available()


def _use_npu_whisper() -> bool:
    """Decide whether to use the ONNX/QNN Whisper path."""
    use_npu = os.getenv("USE_NPU_ASR", os.getenv("USE_NPU", "auto")).lower()
    if use_npu == "false":
        return False
    return is_npu_available() and not is_native_qnn_available()


# ---------------------------------------------------------------------------
# Native QNN (context binaries via qnn-net-run.exe) Whisper backend
# ---------------------------------------------------------------------------

class _NativeQNNTranscriber:
    """Whisper Small Quantized running on native QNN via qnn-net-run.exe."""

    SAMPLE_RATE = 16000
    N_FFT = 400
    HOP_LENGTH = 160
    N_MELS = 80
    CHUNK_LENGTH = 30
    N_SAMPLES = CHUNK_LENGTH * SAMPLE_RATE

    def __init__(self):
        qnn_sdk_root = os.getenv("QNN_SDK_ROOT")
        if not qnn_sdk_root:
            raise RuntimeError("QNN_SDK_ROOT not set")

        self.qnn_net_run = os.path.join(
            qnn_sdk_root, "bin", "aarch64-windows-msvc", "qnn-net-run.exe"
        )

        script_dir = os.path.dirname(__file__)
        self.encoder_bin = os.path.join(
            script_dir,
            "models/whisper/whisper_small_encoder_device.bin"
        )
        self.decoder_bin = os.path.join(
            script_dir,
            "models/whisper/whisper_small_decoder_device.bin"
        )

        print(f"[asr] Using native QNN context binaries", file=sys.stderr)
        print(f"[asr] Encoder: {os.path.basename(self.encoder_bin)}", file=sys.stderr)
        print(f"[asr] Decoder: {os.path.basename(self.decoder_bin)}", file=sys.stderr)

        # Load tokenizer from openai-whisper
        import whisper
        self._tokenizer = whisper.tokenizer.get_tokenizer(
            multilingual=False, task="transcribe"
        )

    def _load_audio(self, path: str) -> np.ndarray:
        """Load audio file and resample to 16 kHz mono float32."""
        import whisper
        audio = whisper.load_audio(path)
        return audio

    def _log_mel_spectrogram(self, audio: np.ndarray) -> np.ndarray:
        """Compute log-Mel spectrogram matching Whisper's expected input."""
        import whisper
        mel = whisper.log_mel_spectrogram(audio)
        mel = whisper.pad_or_trim(mel, self.N_SAMPLES // self.HOP_LENGTH)
        return mel.unsqueeze(0).numpy()  # (1, 80, 3000)

    def _run_qnn_model(self, context_binary: str, input_data: dict) -> dict:
        """Execute QNN context binary via qnn-net-run.exe."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Write input tensors as raw binary files
            input_list_entries = []
            for name, tensor in input_data.items():
                input_file = os.path.join(tmpdir, f"{name}.raw")
                tensor.astype(np.float32).tofile(input_file)
                input_list_entries.append(f"{name}:={input_file}")

            # Write input list to file
            input_list_file = os.path.join(tmpdir, "input_list.txt")
            with open(input_list_file, 'w') as f:
                f.write('\n'.join(input_list_entries))

            # Output directory
            output_dir = os.path.join(tmpdir, "output")
            os.makedirs(output_dir, exist_ok=True)

            # Build qnn-net-run command
            cmd = [
                self.qnn_net_run,
                "--retrieve_context", context_binary,  # Use --retrieve_context for .bin files
                "--backend", os.path.join(os.getenv("QNN_SDK_ROOT"), "lib", "aarch64-windows-msvc", "QnnHtp.dll"),
                "--input_list", input_list_file,  # Path to file containing input list
                "--output_dir", output_dir
            ]

            # Execute
            try:
                result = subprocess.run(
                    cmd, capture_output=True, text=True, check=True
                )
            except subprocess.CalledProcessError as e:
                print(f"[asr] qnn-net-run failed with exit code {e.returncode}", file=sys.stderr)
                print(f"[asr] Command: {' '.join(cmd)}", file=sys.stderr)
                print(f"[asr] stdout: {e.stdout}", file=sys.stderr)
                print(f"[asr] stderr: {e.stderr}", file=sys.stderr)
                raise

            # Read output tensors
            outputs = {}
            for output_file in os.listdir(output_dir):
                if output_file.endswith(".raw"):
                    tensor_name = output_file[:-4]  # Remove .raw
                    tensor_path = os.path.join(output_dir, output_file)
                    tensor_data = np.fromfile(tensor_path, dtype=np.float32)
                    outputs[tensor_name] = tensor_data

            return outputs

    def transcribe(self, audio_path: str) -> str:
        start_time = time.time()

        # Preprocess audio
        audio = self._load_audio(audio_path)
        mel = self._log_mel_spectrogram(audio)  # (1, 80, 3000)

        # Run encoder on NPU
        encoder_outputs = self._run_qnn_model(
            self.encoder_bin,
            {"input_features": mel}
        )

        # Extract cross-attention KV caches
        kv_caches = {}
        for key in encoder_outputs:
            if key.startswith("k_cache") or key.startswith("v_cache"):
                kv_caches[key] = encoder_outputs[key]

        # Greedy decode with decoder on NPU
        sot = self._tokenizer.sot
        eot = self._tokenizer.eot
        tokens = [sot]

        for step in range(224):  # max tokens
            # Prepare decoder inputs
            token_ids = np.array([tokens], dtype=np.int32)

            decoder_inputs = {"input_ids": token_ids}
            # Add KV caches to decoder inputs
            decoder_inputs.update(kv_caches)

            # Run decoder on NPU
            decoder_outputs = self._run_qnn_model(
                self.decoder_bin,
                decoder_inputs
            )

            # Get logits and select next token
            logits = decoder_outputs["logits"]  # Should be shape (1, seq_len, vocab_size)
            next_token = int(np.argmax(logits[-1]))  # Take last token's logits

            if next_token == eot:
                break

            tokens.append(next_token)

        # Decode tokens to text
        text = self._tokenizer.decode(tokens[1:])  # skip SOT

        transcription_time = time.time() - start_time
        print(f"[asr] Native QNN timing: {transcription_time:.2f}s", file=sys.stderr)

        return text.strip()


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
        start_time = time.time()
        
        # Optimize transcription for speed
        segments, _ = self.model.transcribe(
            audio_path, 
            beam_size=1,  # Reduced from 5 for faster transcription
            best_of=1,    # Reduced for speed
            temperature=0.0,  # Deterministic for consistency
        )
        text = " ".join(segment.text.strip() for segment in segments)
        
        transcription_time = time.time() - start_time
        print(f"ASR timing: transcription={transcription_time:.2f}s", file=sys.stderr)
        
        return text


# ---------------------------------------------------------------------------
# Public interface — auto-selects backend
# ---------------------------------------------------------------------------

class Transcriber:
    def __init__(self):
        if _use_native_qnn_whisper():
            print("[asr] Using Native QNN Whisper backend", file=sys.stderr)
            self._backend = _NativeQNNTranscriber()
        elif _use_npu_whisper():
            print("[asr] Using NPU (ONNX+QNN) Whisper backend", file=sys.stderr)
            self._backend = _NPUTranscriber()
        else:
            print("[asr] Using CPU (faster-whisper) backend", file=sys.stderr)
            self._backend = _CPUTranscriber()

    def transcribe(self, audio_path: str) -> str:
        return self._backend.transcribe(audio_path)
