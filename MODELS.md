# Model Downloads

This app requires three AI models. Place them in the `python/models/` directory.

## 1. Whisper (ASR - Speech to Text)

`faster-whisper` downloads the model automatically on first use. The default model is `base.en`.

No manual download needed. Configure in `.env`:
```
WHISPER_MODEL=base.en
```

Available sizes: `tiny.en`, `base.en`, `small.en`, `medium.en`, `large-v3`

## 2. LLaMA GGUF (LLM - Chat)

Download a GGUF-format model. Recommended for local use:

- **TinyLlama 1.1B** (small, fast): https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF
- **Mistral 7B** (better quality): https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF

Pick the `Q4_K_M` quantization for a good balance of quality and size.

```bash
# Example: download TinyLlama
cd python/models
wget https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf -O model.gguf
```

Configure in `.env`:
```
LLM_MODEL_PATH=models/model.gguf
```

## 3. Piper (TTS - Text to Speech)

Download a voice model from https://github.com/rhasspy/piper/blob/master/VOICES.md

```bash
# Example: download a US English voice
cd python/models
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx -O voice.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json -O voice.onnx.json
```

Configure in `.env`:
```
PIPER_MODEL_PATH=models/voice.onnx
```

## Quick Start

After downloading all models, your `python/models/` directory should contain:
```
python/models/
  model.gguf     # LLM
  voice.onnx     # TTS voice
  voice.onnx.json # TTS voice config
```
