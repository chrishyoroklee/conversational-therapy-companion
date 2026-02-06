# Conversational Therapy Companion

A local AI voice assistant with a therapist persona. All AI processing runs on your machine — no cloud APIs, no data leaves your device.

## Architecture

```
Electron (React/TS UI)  <-->  Node.js Main Process  <-->  Python Sidecar
                                                          ├── ASR (faster-whisper)
                                                          ├── LLM (llama-cpp-python)  
                                                          └── TTS (edge-tts)
```

The app uses a **Multi-Process Sidecar Architecture**:
- **Renderer**: React + TypeScript + TailwindCSS frontend
- **Main Process**: Electron lifecycle, audio recording, IPC
- **Python Sidecar**: AI models communicating via JSON Lines over stdin/stdout

## Requirements

- Node.js 18+
- Python 3.10+
- FFmpeg (for audio recording on Windows)

## Setup (Windows)

### 1. System dependencies

1. Install [Node.js](https://nodejs.org/) (18+)
2. Install [Python](https://www.python.org/downloads/) (3.10+) — check "Add to PATH" during install  
3. Install [FFmpeg](https://ffmpeg.org/download.html#build-windows) and add it to your PATH
   - Or use Chocolatey: `choco install ffmpeg`
   - Or use winget: `winget install Gyan.FFmpeg`

### 2. Install dependencies

```powershell
# Node dependencies
npm install

# Python virtual environment (Windows)
python -m venv python\venv
source python/venv/Scripts/activate
pip install -r python/requirements.txt
```

### 3. Download the LLM model

The app uses a local GGUF model via llama-cpp-python. Download a small model for testing:

```powershell
# Qwen2.5-0.5B-Instruct (smallest, ~470MB, good for testing)
pip install huggingface-hub
huggingface-cli download Qwen/Qwen2.5-0.5B-Instruct-GGUF qwen2.5-0.5b-instruct-q4_k_m.gguf --local-dir python/models
```

ASR (Whisper) downloads its model automatically on first run. TTS (edge-tts) streams from Microsoft Edge's neural TTS service — no model download needed.

### 4. Configure environment

```powershell
Copy-Item ".env.example" ".env"
```

The defaults work out of the box if you downloaded the Qwen model above. See `.env.example` for all options.

### 5. Run

```powershell
npm run dev
```

## Troubleshooting (Windows)

### Audio Recording Issues
If you encounter audio recording errors:

1. **Check microphone permissions**: Ensure your browser/app has microphone access
2. **Find your audio device**: Run this command to list available devices:
   ```powershell
   ffmpeg -f dshow -list_devices true -i dummy
   ```
3. **Update audio device name**: If needed, update the device name in `src/main/audio.ts`

### Common Issues
- **Python not found**: Ensure Python is added to your PATH during installation
- **FFmpeg not found**: Install FFmpeg and add it to your system PATH
- **Module errors**: Activate the virtual environment: `python\venv\Scripts\activate`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start in development mode |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run typecheck` | Run TypeScript checks |

## Project Structure

```
src/
  main/           # Electron main process
    index.ts      # App lifecycle, window creation
    sidecar.ts    # Python process management
    audio.ts      # Audio recording
    ipc.ts        # IPC handlers
  preload/
    index.ts      # Context bridge API
  renderer/
    src/
      App.tsx     # Main UI orchestrator
      components/ # React components
      types/      # TypeScript types
      assets/     # CSS
python/
  engine.py       # Main sidecar loop
  asr.py          # Speech-to-text (Whisper)
  llm.py          # Chat (Llama.cpp)
  tts.py          # Text-to-speech (edge-tts)
  models/         # AI model files (gitignored)
```

## How It Works

1. Press the microphone button to record audio
2. Audio is saved to a temp `.wav` file
3. File path is sent to the Python sidecar for transcription (Whisper)
4. Transcription is sent to the LLM for a therapeutic response
5. Response appears in the chat and is spoken aloud via TTS
