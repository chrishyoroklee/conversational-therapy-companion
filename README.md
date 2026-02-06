# Conversational Therapy Companion

A local AI voice assistant with a therapist persona. All AI processing runs on your machine — no cloud APIs, no data leaves your device.

## Architecture

```
Electron (React/TS UI)  <-->  Node.js Main Process  <-->  Python Sidecar
                                                          ├── ASR (faster-whisper / Whisper ONNX+QNN)
                                                          ├── LLM (llama-cpp / Qwen ONNX+QNN)
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



## Qualcomm NPU Setup (Snapdragon X Elite)

The app supports **dual-backend inference**: CPU fallback for any PC, and Qualcomm NPU acceleration on Snapdragon X Elite devices. Backend selection is automatic — set `USE_NPU=auto` (default) and the app will use the NPU when available.

### NPU Configuration

Set `USE_NPU` in `python/.env`:

| Value   | Behavior |
|---------|----------|
| `auto`  | Detect QNN Runtime; use NPU if available, CPU otherwise (default) |
| `true`  | Force NPU — fail if QNN is not available |
| `false` | Force CPU — always use faster-whisper + llama-cpp |

### Step 1: Install QNN SDK / QAIRT

1. Download and install the [Qualcomm AI Engine Direct SDK](https://www.qualcomm.com/developer/software/qualcomm-ai-engine-direct-sdk) (QAIRT)
2. Set environment variables:
   ```powershell
   $env:QNN_SDK_ROOT = "C:\Qualcomm\AIStack\QAIRT\2.28.0"
   $env:PATH += ";$env:QNN_SDK_ROOT\lib\aarch64-windows-msvc"
   ```
3. Verify the HTP backend DLL exists:
   ```
   C:\Qualcomm\AIStack\QAIRT\2.28.0\lib\aarch64-windows-msvc\QnnHtp.dll
   ```

### Step 2: Install Qualcomm AI Hub

```bash
pip install qai-hub
qai-hub configure --api_token YOUR_API_TOKEN
qai-hub list-devices
```

### Step 3: Install NPU Python packages

```bash
# ONNX Runtime with QNN Execution Provider (ARM64 wheel)
pip install onnxruntime-qnn

# ONNX Runtime GenAI for LLM generation
pip install onnxruntime-genai

# Whisper tokenizer and mel filter utilities
pip install openai-whisper

# Model export tools
pip install qai-hub-models
```

### Step 4: Export Whisper Small Quantized to ONNX

Export the Whisper encoder and decoder models for QNN:

```bash
# Using qai_hub_models to export Whisper Small for QNN
python -m qai_hub_models.models.whisper_small_en.export \
  --device "Snapdragon X Elite CRD" \
  --target-runtime onnx

# Copy the exported models into the project
mkdir -p python/models/whisper
cp build/whisper_small_en/WhisperEncoder.onnx python/models/whisper/
cp build/whisper_small_en/WhisperDecoder.onnx python/models/whisper/
```

Verify model paths match `python/.env`:
```
WHISPER_ONNX_ENCODER=models/whisper/WhisperEncoder.onnx
WHISPER_ONNX_DECODER=models/whisper/WhisperDecoder.onnx
```

### Step 5: Export Qwen 2.5 1.5B for QNN

```bash
# Export Qwen 2.5 1.5B Instruct for QNN via onnxruntime-genai
python -m qai_hub_models.models.qwen2_5_7b_instruct_quantized.export \
  --device "Snapdragon X Elite CRD" \
  --target-runtime onnx

# Copy the exported model directory
cp -r build/qwen2_5/ python/models/qwen-qnn/
```

Verify model path matches `python/.env`:
```
QNN_LLM_MODEL_PATH=models/qwen-qnn
```

### Step 6: Verify NPU is being used

Run the app and check stderr output for these log lines:

```
[qnn_utils] QNNExecutionProvider detected
[asr] Using NPU (ONNX+QNN) Whisper backend
[llm] Using NPU (onnxruntime-genai + QNN) backend
```

If you see `QNNExecutionProvider not found`, the QNN SDK is not properly installed or the `QnnHtp.dll` is not on your PATH.

### Quick test (without the full app)

```bash
cd python
python -c "from qnn_utils import is_npu_available; print('NPU:', is_npu_available())"
```

### Benchmarking NPU vs CPU

A built-in benchmark tool compares latency, throughput, and resource usage between the NPU and CPU backends.

**Install optional dependency** (for CPU/memory usage metrics):

```bash
pip install psutil
```

**Run the benchmark:**

```bash
cd python

# Full benchmark (ASR + LLM, 3 rounds each)
python benchmark.py

# More rounds for stable numbers
python benchmark.py --rounds 5

# LLM only
python benchmark.py --skip-asr

# ASR only
python benchmark.py --skip-llm

# Use your own audio file for ASR testing
python benchmark.py --audio path/to/recording.wav
```

The benchmark loads each backend independently, runs a warmup pass, then times N rounds. It prints a side-by-side comparison table:

```
  Metric                              CPU                  NPU              Speedup
  ------------------------------------------------------------------------------------
  Mean latency                    1842.3 ms             412.7 ms              4.46x
  Tokens/sec (avg)                8.2 tok/s           34.1 tok/s              4.16x
  CPU usage (avg)                    87.3%               12.1%
  Peak memory                      1204 MB              843 MB
```

On a CPU-only machine the NPU columns will show `n/a` — the CPU benchmarks still run normally.
