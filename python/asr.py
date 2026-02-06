import os
import sys
from faster_whisper import WhisperModel


class Transcriber:
    def __init__(self):
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
