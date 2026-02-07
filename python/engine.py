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
import time

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

    classify = None
    try:
        from llm import ChatModel, classify_intent
        llm = ChatModel()
        classify = classify_intent
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
        try:
            request = json.loads(line.strip())
            request_start = time.time()
            print(f"[engine] Processing request: {request.get('type', 'unknown')}",
                  file=sys.stderr)

            action = request.get("type")

            if action == "ping":
                send({"type": "pong"})

            elif action == "asr":
                audio_path = request.get("path")
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

                text = request.get("text", "")
                if not text:
                    send({"type": "error", "message": "Missing 'text' for LLM"})
                    continue

                log(f"Generating response for: {text[:50]}...")
                send({"type": "llm_processing"})

                # Early intent detection — trigger code yellow immediately
                # before waiting for LLM inference (same pattern as red)
                if classify:
                    intent = classify(text)
                    if intent == 1:
                        log("YELLOW intent detected pre-inference - triggering Code Yellow immediately")
                        send({"type": "code_yellow", "triggered": True})

                result = llm.chat(text)

                risk_level = result.get("risk_level", "green")
                assistant_text = result.get("assistant_text", "")
                actions = result.get("actions", [])

                log(f"Response (risk={risk_level}): {assistant_text[:50]}...")

                send({
                    "type": "llm_result",
                    "text": assistant_text,
                    "risk_level": risk_level,
                    "actions": actions,
                })

                # Auto-trigger TTS for the response
                if tts and assistant_text.strip():
                    log(f"Synthesizing: {assistant_text[:50]}...")
                    output_path = os.path.join(
                        tempfile.gettempdir(), f"tts_{os.getpid()}_{id(assistant_text)}.mp3"
                    )
                    synth_result = tts.synthesize(assistant_text, output_path)
                    if synth_result:
                        send({"type": "tts_result", "path": synth_result})
                    else:
                        log("TTS synthesis failed")

            elif action == "tts":
                if not tts:
                    send({"type": "tts_result", "path": None, "message": "TTS unavailable"})
                    continue

                text = request.get("text", "")
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

            total_time = time.time() - request_start
            print(f"[engine] Request completed in {total_time:.2f}s", file=sys.stderr)

        except Exception as e:
            log(f"Error handling {action}: {e}")
            send({"type": "error", "message": str(e)})
            print(f"[engine] Error processing request: {action}", file=sys.stderr)


if __name__ == "__main__":
    main()
