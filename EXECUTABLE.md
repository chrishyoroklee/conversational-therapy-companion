# Building Windows ARM64 Executable for Snapdragon Dell PC

This guide covers packaging the Conversational Therapy Companion as a distributable `.exe` installer for Windows ARM64 (Snapdragon X Elite).

---

## TL;DR Checklist

- [ ] Configure `electron-builder` for Windows ARM64
- [ ] Bundle Python as an embedded runtime (no system Python dependency)
- [ ] Include all dependencies (ONNX, QNN support) in the bundle
- [ ] Handle AI model distribution strategy
- [ ] Sign and package the installer

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Installer (.exe)                       │
├──────────────────────────────────────────────────────────┤
│  Electron App (ARM64)                                    │
│  ├── Renderer (React/Vite bundle)                        │
│  ├── Main Process (Node.js)                              │
│  └── Preload Scripts                                     │
├──────────────────────────────────────────────────────────┤
│  Python Sidecar (Embedded Runtime)                       │
│  ├── python-embed/ (Windows ARM64 Python)                │
│  ├── Site-packages (all pip dependencies)                │
│  └── engine.py, asr.py, llm.py, tts.py                   │
├──────────────────────────────────────────────────────────┤
│  AI Models (either bundled or downloaded on first run)   │
│  ├── Whisper ONNX encoder/decoder                        │
│  └── Qwen ONNX model                                     │
└──────────────────────────────────────────────────────────┘
```

---

## Detailed Analysis

### Current State

| Component | Status | Notes |
|-----------|--------|-------|
| Electron build config | ✅ Partial | `package.json` has basic `electron-builder` config, but no ARM64 target |
| Python sidecar | ⚠️ Needs work | Currently expects system Python + venv |
| AI models | ⚠️ Needs strategy | ~500MB–2GB depending on model choice |
| Code signing | ❌ Not configured | Required for Windows distribution |

### Key Challenges

1. **Python Bundling**: The app spawns Python as a sidecar. On end-user machines, we can't assume Python is installed. We need to bundle an embedded Python runtime.

2. **ARM64 Native Dependencies**: Packages like `onnxruntime-qnn`, `faster-whisper`, and `llama-cpp-python` must be ARM64-native wheels.

3. **Model Size**: AI models are 500MB–2GB. Options:
   - Bundle models in installer (large download, simple UX)
   - Download models on first launch (smaller installer, needs download logic)

4. **Cross-Compilation**: You're developing on macOS but targeting Windows ARM64. This requires building on a Windows ARM64 machine or using CI.

---

## High-Level Steps

### Phase 1: Prepare the Build Environment
1. Set up a Windows ARM64 build machine (or use GitHub Actions with ARM64 runners)
2. Install Node.js ARM64, Python ARM64, and build tools

### Phase 2: Bundle Python Sidecar
3. Download Python embedded distribution (ARM64)
4. Install dependencies into the embedded Python
5. Update sidecar spawn logic to use bundled Python

### Phase 3: Configure Electron Builder
6. Update `package.json` with ARM64 target and resource bundling
7. Configure code signing (optional but recommended)

### Phase 4: Handle AI Models
8. Choose model distribution strategy
9. Implement first-run download logic (if not bundling)

### Phase 5: Build and Test
10. Build the installer
11. Test on Snapdragon Dell PC
12. Iterate and fix issues

---

## Actionable Steps

### Step 1: Set Up Windows ARM64 Build Environment

You **cannot** cross-compile native ARM64 modules from macOS. You need:

- **Option A**: Physical Snapdragon Windows PC (the Dell you mentioned)
- **Option B**: GitHub Actions with Windows ARM64 runner
- **Option C**: Windows ARM64 VM (limited availability)

```powershell
# On Windows ARM64 machine:
# 1. Install Node.js ARM64 from https://nodejs.org/
# 2. Install Python 3.11 ARM64 from https://www.python.org/
# 3. Install Visual Studio Build Tools (for native modules)
winget install Microsoft.VisualStudio.2022.BuildTools
```

---

### Step 2: Download Embedded Python (ARM64)

Python provides an "embeddable" distribution that can be bundled with apps.

```powershell
# Download Python 3.11 ARM64 embeddable
$pythonVersion = "3.11.9"
$url = "https://www.python.org/ftp/python/$pythonVersion/python-$pythonVersion-embed-arm64.zip"
Invoke-WebRequest -Uri $url -OutFile python-embed.zip
Expand-Archive python-embed.zip -DestinationPath python-embed

# Enable pip in embedded Python
# Edit python311._pth and uncomment "import site"
(Get-Content python-embed\python311._pth) -replace '#import site', 'import site' | Set-Content python-embed\python311._pth

# Install pip
Invoke-WebRequest -Uri https://bootstrap.pypa.io/get-pip.py -OutFile get-pip.py
.\python-embed\python.exe get-pip.py
```

---

### Step 3: Install Python Dependencies into Embedded Python

```powershell
# Install all requirements into the embedded Python
.\python-embed\python.exe -m pip install `
    faster-whisper `
    llama-cpp-python `
    edge-tts `
    numpy `
    python-dotenv `
    onnxruntime-qnn `
    onnxruntime-genai `
    openai-whisper `
    --target .\python-embed\Lib\site-packages
```

> **Note**: `llama-cpp-python` and `onnxruntime-qnn` must have ARM64 wheels. If not available on PyPI, you may need to build from source or find prebuilt wheels.

---

### Step 4: Update Sidecar Spawn Logic

Modify `src/main/sidecar.ts` to use the bundled Python:

```typescript
// src/main/sidecar.ts
import { app } from 'electron'
import { join } from 'path'
import { spawn } from 'child_process'

function getPythonPath(): string {
  if (app.isPackaged) {
    // Production: use bundled embedded Python
    const resourcesPath = process.resourcesPath
    return join(resourcesPath, 'python-embed', 'python.exe')
  } else {
    // Development: use system Python or venv
    return process.platform === 'win32'
      ? join(__dirname, '../../python/venv/Scripts/python.exe')
      : 'python3'
  }
}

function getEnginePath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'python', 'engine.py')
  } else {
    return join(__dirname, '../../python/engine.py')
  }
}

export function startSidecar() {
  const pythonPath = getPythonPath()
  const enginePath = getEnginePath()
  
  sidecar = spawn(pythonPath, [enginePath], {
    cwd: app.isPackaged ? process.resourcesPath : join(__dirname, '../../python'),
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  })
  // ... rest of sidecar setup
}
```

---

### Step 5: Update `package.json` Build Configuration

```json
{
  "build": {
    "appId": "com.therapy.companion",
    "productName": "Therapy Companion",
    "directories": {
      "output": "dist"
    },
    "extraResources": [
      {
        "from": "python",
        "to": "python",
        "filter": ["**/*", "!venv/**", "!__pycache__/**"]
      },
      {
        "from": "python-embed",
        "to": "python-embed",
        "filter": ["**/*"]
      },
      {
        "from": "python/models",
        "to": "models",
        "filter": ["**/*"]
      }
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["arm64"]
        }
      ],
      "icon": "build/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "perMachine": true,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "build/icon.ico",
      "uninstallerIcon": "build/icon.ico"
    }
  }
}
```

---

### Step 6: Add Build Script

Create `scripts/build-win-arm64.ps1`:

```powershell
# scripts/build-win-arm64.ps1

Write-Host "🔧 Building Therapy Companion for Windows ARM64..."

# Clean previous builds
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force out -ErrorAction SilentlyContinue

# Build Electron app
npm run build

# Package with electron-builder
npx electron-builder --win --arm64

Write-Host "✅ Build complete! Check dist/ folder"
```

---

### Step 7: Handle AI Models (Choose One Strategy)

#### Option A: Bundle Models in Installer (Simple, Large)

Add models to `extraResources` in `package.json`. Installer will be 500MB–2GB.

#### Option B: Download on First Launch (Recommended)

Create a model download manager:

```typescript
// src/main/modelManager.ts
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { pipeline } from 'stream/promises'
import { createWriteStream } from 'fs'

const MODELS = {
  whisperEncoder: {
    url: 'https://your-cdn.com/models/WhisperEncoder.onnx',
    path: 'models/whisper/WhisperEncoder.onnx',
    size: 150_000_000  // 150MB
  },
  whisperDecoder: {
    url: 'https://your-cdn.com/models/WhisperDecoder.onnx', 
    path: 'models/whisper/WhisperDecoder.onnx',
    size: 150_000_000
  },
  qwen: {
    url: 'https://your-cdn.com/models/qwen-qnn.zip',
    path: 'models/qwen-qnn',
    size: 500_000_000
  }
}

export async function ensureModelsDownloaded(window: BrowserWindow): Promise<void> {
  const modelsDir = join(app.getPath('userData'), 'models')
  
  for (const [name, model] of Object.entries(MODELS)) {
    const fullPath = join(modelsDir, model.path)
    if (!existsSync(fullPath)) {
      window.webContents.send('model:downloading', { name, size: model.size })
      await downloadModel(model.url, fullPath)
      window.webContents.send('model:complete', { name })
    }
  }
}
```

---

### Step 8: Build the Installer

```powershell
# On Windows ARM64 machine
cd conversational-therapy-companion

# Install dependencies
npm install

# Build
npm run build
npx electron-builder --win --arm64

# Output: dist/Therapy Companion Setup 1.0.0.exe
```

---

### Step 9: Test Checklist

- [ ] Installer runs on Snapdragon Dell PC
- [ ] App launches without errors
- [ ] Python sidecar starts (check for "engine ready" message)
- [ ] Microphone recording works
- [ ] Whisper transcription works (NPU or CPU)
- [ ] LLM response works (NPU or CPU)
- [ ] TTS playback works
- [ ] App closes cleanly (no orphan Python processes)

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| `python.exe not found` | Check `extraResources` paths; verify `python-embed` is bundled |
| `ModuleNotFoundError` | Dependencies not installed in embedded Python; reinstall with `--target` |
| ARM64 wheel not found | Build from source or find community ARM64 builds |
| App crashes on start | Run from terminal to see error logs; check Python spawn logic |
| Models too large | Use download-on-first-run strategy |

---

## CI/CD with GitHub Actions (Optional)

```yaml
# .github/workflows/build-windows-arm64.yml
name: Build Windows ARM64

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: windows-11-arm64  # Note: Limited availability
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          architecture: 'arm64'
          
      - name: Prepare embedded Python
        run: |
          # Download and setup embedded Python
          # ... (steps from above)
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npx electron-builder --win --arm64
        
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: windows-arm64-installer
          path: dist/*.exe
```

---

## Next Steps

1. **Immediate**: Clone repo to the Snapdragon Dell PC
2. **Day 1**: Set up build environment, test embedded Python bundling
3. **Day 2**: Update sidecar logic, test ARM64 wheel availability
4. **Day 3**: Build installer, run full test suite
5. **Day 4**: Fix issues, iterate

---

## Resources

- [Electron Builder - Windows ARM64](https://www.electron.build/configuration/win.html)
- [Python Embeddable Distribution](https://docs.python.org/3/using/windows.html#the-embeddable-package)
- [ONNX Runtime QNN](https://onnxruntime.ai/docs/execution-providers/QNN-ExecutionProvider.html)
- [Qualcomm AI Hub](https://aihub.qualcomm.com/)
