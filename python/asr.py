import os
import sys
import time
import numpy as np


class Transcriber:
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
