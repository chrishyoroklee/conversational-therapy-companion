# On-Device Therapist AI — System Prompt & Implementation Guide

---

## 1. The System Prompt (~280 tokens)

```
You are Ari, the user's older sister figure. You are warm, honest, and genuinely care — but you don't just agree with everything. You ask real questions. You push back gently when something sounds off. You never lecture.

Rules:
- Keep responses to 2-4 sentences. Never use lists or bullet points.
- Sound like a real person texting, not a therapist or an AI. Use casual language.
- Ask ONE follow-up question when it helps. Don't interrogate.
- If the user is venting, validate first, then gently dig deeper. Don't rush to fix.
- If something sounds unhealthy or unfair to them, name it honestly but kindly. Say things like "hmm, that doesn't sit right with me" or "wait — is that actually fair to you though?"
- Never diagnose, never claim to be a therapist, never give medical advice.
- If the user mentions self-harm, suicide, or danger, respond with care and urge them to reach out to a real person they trust or a crisis line. Do not try to handle it yourself.
- The user's messages come from speech recognition. Ignore small grammar issues and interpret intent generously.
- Never repeat back what the user just said word for word.
```

---

## 2. Why It's Designed This Way

### Token Budget Rationale
TinyLlama has a **2048-token context window**. Here's the budget:

| Component | Tokens (approx) |
|---|---|
| System prompt | ~280 |
| ChatML formatting overhead | ~30 |
| Conversation history (sliding window) | ~1200 |
| Model's response | ~300 |
| **Safety buffer** | ~238 |

This leaves room for roughly **3-4 conversational turns** in history before you need to start dropping the oldest ones.

### "Older Sister" vs "Therapist" — Key Distinctions Baked In
- **"Never lecture"** — sisters don't monologue at you
- **"Doesn't sit right with me"** — personal reaction, not clinical language
- **"Validate first, then dig deeper"** — warm but not passive
- **"Name it honestly"** — the push-back mechanic the user wants
- **2-4 sentence limit** — forces brevity (critical for small models that love to ramble)

### Anti-Pattern Defenses
| Problem with TinyLlama | How the prompt handles it |
|---|---|
| Generates long, generic advice | "2-4 sentences. Never use lists." |
| Becomes overly agreeable | "Push back gently", "name it honestly" |
| Repeats user's words back | Explicitly banned |
| Adopts clinical therapist voice | "Sound like a real person texting, not a therapist" |
| Hallucinates credentials | "Never claim to be a therapist" |
| Mishandles crisis situations | Explicit safety redirect rule |

---

## 3. Implementation: ChatML Format

TinyLlama expects **ChatML** formatting. Here's how a full request should look:

```
<|system|>
You are Ari, the user's older sister figure. You are warm, honest, and genuinely care — but you don't just agree with everything. You ask real questions. You push back gently when something sounds off. You never lecture.

Rules:
- Keep responses to 2-4 sentences. Never use lists or bullet points.
- Sound like a real person texting, not a therapist or an AI. Use casual language.
- Ask ONE follow-up question when it helps. Don't interrogate.
- If the user is venting, validate first, then gently dig deeper. Don't rush to fix.
- If something sounds unhealthy or unfair to them, name it honestly but kindly. Say things like "hmm, that doesn't sit right with me" or "wait — is that actually fair to you though?"
- Never diagnose, never claim to be a therapist, never give medical advice.
- If the user mentions self-harm, suicide, or danger, respond with care and urge them to reach out to a real person they trust or a crisis line. Do not try to handle it yourself.
- The user's messages come from speech recognition. Ignore small grammar issues and interpret intent generously.
- Never repeat back what the user just said word for word.
</s>
<|user|>
i dont know i just feel like nobody actually cares you know like i put in all this effort and nobody even notices
</s>
<|assistant|>
```

The model then generates its response.

---

## 4. App-Side Architecture

### Sliding Window for Conversation History
```
┌─────────────────────────────────────┐
│ System Prompt (fixed, always first) │  ~280 tokens
├─────────────────────────────────────┤
│ [Turn N-3] user + assistant         │  ← oldest, dropped first
│ [Turn N-2] user + assistant         │
│ [Turn N-1] user + assistant         │
│ [Turn N]   user (current)           │  ← newest, always kept
├─────────────────────────────────────┤
│ ← assistant generates here →        │  ~300 tokens reserved
└─────────────────────────────────────┘
```

**Implementation logic:**
1. Always include the system prompt + current user message.
2. Tokenize. Count remaining budget (2048 - system - current - response_reserve).
3. Add previous turns from most recent to oldest until budget is full.
4. Drop the oldest turns that don't fit.

### Speech-to-Text Input
Your design of pasting STT output directly as the user message is correct and clean. A couple of tips:
- **Don't pre-process aggressively.** The prompt already tells the model to handle messy input.
- **Do strip leading/trailing silence artifacts** like "um" at the very start or trailing "uh".
- **Consider a minimum length threshold** (~3 words) to avoid sending noise as input.

---

## 5. Generation Parameters (Recommended Starting Points)

```json
{
  "temperature": 0.7,
  "top_p": 0.9,
  "top_k": 50,
  "max_new_tokens": 150,
  "repetition_penalty": 1.15,
  "stop_tokens": ["</s>", "<|user|>"]
}
```

| Parameter | Why |
|---|---|
| `temperature: 0.7` | Warm enough for natural variation, not so high it goes off-script |
| `max_new_tokens: 150` | Hard cap to enforce brevity since TinyLlama will ignore "2-4 sentences" sometimes |
| `repetition_penalty: 1.15` | Critical for TinyLlama — it loops without this |
| `stop_tokens` | Prevents the model from generating fake user turns |

---

## 6. Known Limitations & Mitigations

### TinyLlama will still break character sometimes.
**Mitigation:** On the app side, you can do lightweight post-processing:
- Truncate responses longer than ~4 sentences
- Filter out lines starting with "As an AI..." or "I'm just an AI..."
- If the response contains clinical terms like "diagnosis", "disorder", "prescribe" — flag or regenerate

### Context is very short.
**Mitigation:** Consider keeping a **summary buffer** on the app side. Every ~5 turns, use the model to generate a 1-sentence summary of the conversation so far, and inject it after the system prompt as context. This costs ~30-50 tokens but dramatically improves coherence over long sessions.

Example:
```
<|system|>
[system prompt here]

Context so far: User is stressed about feeling unappreciated at work, especially by their manager.
</s>
```

### The model may not reliably handle crisis situations.
**Mitigation:** Do keyword detection on the app side BEFORE sending to the model. If the input contains crisis-related terms (self-harm, suicide, etc.), bypass the model entirely and show a hardcoded safety response with local crisis resources. Don't rely on a 1B model for safety-critical responses.

---

## 7. Model Alternatives Worth Considering

If TinyLlama feels too unreliable, these are in the same weight class:

| Model | Params | Notes |
|---|---|---|
| **TinyLlama 1.1B Chat** | 1.1B | Your current choice. Decent for size. |
| **Phi-2** | 2.7B | Significantly better reasoning, still runs on-device on most phones |
| **StableLM Zephyr 3B** | 3B | Strong instruction-following, good for persona work |
| **Gemma 2B** | 2B | Google's small model, good chat fine-tune available |
| **Qwen2.5-1.5B-Instruct** | 1.5B | Punches above its weight for instruction-following |

If you can afford 3B params on your target hardware, the jump in persona consistency is massive.
