#!/usr/bin/env python3
"""
AI Engine sidecar process.
Communicates with Electron main process via JSON Lines over stdin/stdout.
All logging goes to stderr to keep stdout clean for the protocol.
"""

import sys
import json
import os
import tempfile

from dotenv import load_dotenv

load_dotenv()


def send(message: dict) -> None:
    """Send a JSON message to stdout (to Electron)."""
    print(json.dumps(message), flush=True)


def log(msg: str) -> None:
    """Log to stderr (visible in Electron console, not parsed as protocol)."""
    print(f"[engine] {msg}", file=sys.stderr, flush=True)


def main():
    log("Starting AI engine...")

    # Import and initialize models
    from asr import Transcriber

    log("Loading models...")
    asr = Transcriber()

    llm = None
    tts = None

    try:
        from llm import ChatModel
        llm = ChatModel()
    except Exception as e:
        log(f"LLM not available: {e}")

    try:
        from tts import Speaker
        tts = Speaker()
    except Exception as e:
        log(f"TTS not available: {e}")

    log("Models loaded (ASR: ready, LLM: %s, TTS: %s)" % (
        "ready" if llm else "unavailable",
        "ready" if tts else "unavailable",
    ))

    # Signal ready
    send({"type": "ready"})

    # Main loop: read JSON Lines from stdin
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            req = json.loads(line)
        except json.JSONDecodeError as e:
            send({"type": "error", "message": f"Invalid JSON: {e}"})
            continue

        action = req.get("type")

        try:
            if action == "ping":
                send({"type": "pong"})

            elif action == "asr":
                audio_path = req.get("path")
                if not audio_path:
                    send({"type": "error", "message": "Missing 'path' for ASR"})
                    continue

                log(f"Transcribing: {audio_path}")
                send({"type": "asr_processing"})
                text = asr.transcribe(audio_path)
                log(f"Transcription: {text}")
                send({"type": "asr_result", "text": text})

            elif action == "llm":
                if not llm:
                    send({"type": "error", "message": "LLM not available (no model loaded)"})
                    continue

                text = req.get("text", "")
                if not text:
                    send({"type": "error", "message": "Missing 'text' for LLM"})
                    continue

                log(f"Generating response for: {text[:50]}...")
                send({"type": "llm_processing"})
                response = llm.chat(text)
                log(f"Response: {response[:50]}...")
                send({"type": "llm_result", "text": response})

            elif action == "tts":
                if not tts:
                    send({"type": "tts_result", "path": None, "message": "TTS unavailable"})
                    continue

                text = req.get("text", "")
                if not text:
                    send({"type": "error", "message": "Missing 'text' for TTS"})
                    continue

                log(f"Synthesizing: {text[:50]}...")
                output_path = os.path.join(
                    tempfile.gettempdir(), f"tts_{os.getpid()}.wav"
                )
                result = tts.synthesize(text, output_path)
                if result:
                    send({"type": "tts_result", "path": result})
                else:
                    send({"type": "tts_result", "path": None, "message": "TTS unavailable"})

            else:
                send({"type": "error", "message": f"Unknown action: {action}"})

        except Exception as e:
            log(f"Error handling {action}: {e}")
            send({"type": "error", "message": str(e)})


if __name__ == "__main__":
    main()
