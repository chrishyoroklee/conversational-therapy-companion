import os
import sys
import asyncio
import edge_tts

DEFAULT_VOICE = "en-US-AriaNeural"


class Speaker:
    def __init__(self):
        self.voice = os.getenv("TTS_VOICE", DEFAULT_VOICE)
        print(f"TTS ready (voice: {self.voice})", file=sys.stderr)

    def synthesize(self, text: str, output_path: str) -> str | None:
        try:
            asyncio.run(self._generate(text, output_path))
            return output_path
        except Exception as e:
            print(f"TTS error: {e}", file=sys.stderr)
            return None

    async def _generate(self, text: str, output_path: str) -> None:
        communicate = edge_tts.Communicate(text, self.voice)
        await communicate.save(output_path)
