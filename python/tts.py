import os
import sys
import io
import wave
import numpy as np

try:
    from piper.voice import PiperVoice
except ImportError:
    PiperVoice = None


class Speaker:
    def __init__(self):
        if PiperVoice is None:
            print("Piper TTS not available, TTS disabled", file=sys.stderr)
            self.voice = None
            return

        model_path = os.getenv("PIPER_MODEL_PATH", "models/voice.onnx")
        if not os.path.exists(model_path):
            print(f"Piper model not found at {model_path}, TTS disabled", file=sys.stderr)
            self.voice = None
            return

        print(f"Loading Piper model: {model_path}", file=sys.stderr)
        self.voice = PiperVoice.load(model_path)
        print("Piper model loaded", file=sys.stderr)

    def synthesize(self, text: str, output_path: str) -> str | None:
        if self.voice is None:
            return None

        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as wav_file:
            self.voice.synthesize(text, wav_file)

        with open(output_path, "wb") as f:
            f.write(wav_buffer.getvalue())

        return output_path
