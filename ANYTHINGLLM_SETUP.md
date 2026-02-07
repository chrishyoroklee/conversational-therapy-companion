# AnythingLLM Setup Guide (NPU Acceleration)

This guide shows how to set up AnythingLLM to run Llama 3.1 8B on your Snapdragon X Elite NPU.

## Step 1: Install AnythingLLM Desktop

1. Download AnythingLLM from https://anythingllm.com/download
2. Install the Windows ARM64 version for Snapdragon X Elite
3. Launch AnythingLLM

## Step 2: Configure NPU Backend

1. In AnythingLLM settings, go to **LLM Preferences**
2. Select **AnythingLLM NPU** as the LLM provider
3. This ensures the model runs on the Qualcomm NPU instead of CPU

## Step 3: Setup Llama 3.1 8B Model

1. In LLM settings, select **Llama 3.1 8B Chat** model
2. AnythingLLM will download and configure the model for NPU
3. Wait for the model to finish downloading (~4-8GB)

## Step 4: Enable Developer API

1. Go to **Settings** → **Developer API**
2. Click **Generate API Key**
3. Copy the API key (you'll need this for the .env file)
4. Verify the API server is running at `http://localhost:3001`

## Step 5: Configure Your App

1. Open `.env` file in your project root
2. Update these lines:
   ```
   USE_ANYTHINGLLM=true
   ANYTHINGLLM_API_KEY=your_api_key_here
   ```

3. Install requests package (if not already installed):
   ```bash
   pip install requests
   ```

## Step 6: Test the Setup

1. Start your app:
   ```bash
   npm run dev
   ```

2. You should see in the logs:
   ```
   [llm] Using AnythingLLM backend
   [llm] Connecting to AnythingLLM at http://localhost:3001/api/v1
   [llm] AnythingLLM connection successful
   ```

3. Try recording some audio and chatting!

## Current Configuration

Your `.env` is currently set to:
- **ASR (Whisper)**: CPU with faster-whisper (due to SDK version issues)
- **LLM**: CPU with llama-cpp (default) OR AnythingLLM (when USE_ANYTHINGLLM=true)
- **TTS**: Edge TTS (cloud streaming)

## Performance Expectations

With AnythingLLM on NPU:
- **LLM latency**: ~2-4 seconds for responses (NPU accelerated)
- **ASR latency**: ~3-5 seconds (CPU - faster-whisper)
- **Total response time**: ~5-9 seconds

## Troubleshooting

### "Failed to connect to AnythingLLM"
- Make sure AnythingLLM desktop app is running
- Check if API server is accessible: http://localhost:3001/api/v1
- Verify your API key is correct in `.env`

### "LLM not available"
- Make sure you generated an API key in AnythingLLM settings
- Check that the model is fully downloaded in AnythingLLM

### Model runs on CPU instead of NPU
- In AnythingLLM settings, verify **AnythingLLM NPU** is selected
- Restart AnythingLLM after changing the provider

## Alternative: CPU-Only Mode

If AnythingLLM doesn't work, keep it disabled:
```
USE_ANYTHINGLLM=false
```

The app will use the existing CPU backend (`llama-cpp-python` with Qwen 2.5 0.5B), which is slower but works reliably.
