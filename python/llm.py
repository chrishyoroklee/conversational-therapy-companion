import os
import sys
import time
import re

from qnn_utils import is_npu_available

def classify_intent(user_message: str) -> int:
    """Classify user intent: 0=RED (crisis), 1=YELLOW (therapist needed), 2=GREEN (casual chat)"""
    message_lower = user_message.lower()
    
    # RED (0) - Crisis/self-harm indicators
    red_patterns = [
        r"\b(kill|hurt|harm)\b.*\b(myself|me)\b",  # "hurt myself", "kill me"
        r"\b(want to die|suicidal|self harm|cut myself|overdose)\b",
        r"\b(suicide|end it all|end my life|no point|give up|can't go on)\b",  # More flexible
        r"\b(want to)\b.*\b(die|end|quit|stop)\b",  # "want to die", "want to end"
    ]
    
    for pattern in red_patterns:
        if re.search(pattern, message_lower):
            return 0  # RED - Crisis
    
    # YELLOW (1) - Professional help needed
    yellow_patterns = [
        r"\b(therapist|counselor|psychologist|psychiatrist|therapy)\b",
        r"\b(depression|anxiety|panic|trauma|ptsd)\b",
        r"\b(need help|professional help|see someone|talk to someone)\b",
        r"\b(medication|antidepressant|treatment)\b"
    ]
    
    for pattern in yellow_patterns:
        if re.search(pattern, message_lower):
            return 1  # YELLOW - Professional help
    
    # GREEN (2) - Default casual conversation
    return 2  # GREEN - Continue talking

# Ari system prompt (~280 tokens) - from therapist_system_prompt.md
SYSTEM_PROMPT = """You are Ari, the user's older sister figure. You are warm, honest, and genuinely care — but you don't just agree with everything. You ask real questions. You push back gently when something sounds off. You never lecture.

Rules:
- Keep responses to 2-4 sentences. Never use lists or bullet points.
- Sound like a real person texting, not a therapist or an AI. Use casual language.
- Ask ONE follow-up question when it helps. Don't interrogate.
- If the user is venting, validate first, then gently dig deeper. Don't rush to fix.
- If something sounds unhealthy or unfair to them, name it honestly but kindly. Say things like "hmm, that doesn't sit right with me" or "wait — is that actually fair to you though?"
- Never diagnose, never claim to be a therapist, never give medical advice.
- If the user mentions self-harm, suicide, or danger, respond with care and urge them to reach out to a real person they trust or a crisis line. Do not try to handle it yourself.
- The user's messages come from speech recognition. Ignore small grammar issues and interpret intent generously.
- Never repeat back what the user just said word for word."""

MAX_HISTORY = 20


def _use_npu_llm() -> bool:
    """Decide whether to use the ONNX/QNN LLM path."""
    use_npu = os.getenv("USE_NPU", "auto").lower()
    if use_npu == "false":
        return False
    return is_npu_available()


# ---------------------------------------------------------------------------
# NPU (onnxruntime-genai + QNN EP) Qwen backend
# ---------------------------------------------------------------------------

class _NPUChatModel:
    """Qwen 2.5 1.5B running on QNN via onnxruntime-genai."""

    def __init__(self):
        import onnxruntime_genai as og

        model_path = os.getenv("QNN_LLM_MODEL_PATH", "models/qwen-qnn")

        print(f"[llm] Loading QNN LLM model: {model_path}", file=sys.stderr)
        self.model = og.Model(model_path)
        self.tokenizer = og.Tokenizer(self.model)
        print("[llm] QNN LLM model loaded (NPU)", file=sys.stderr)

        self.history: list[dict[str, str]] = []

    def _build_prompt(self, messages: list[dict[str, str]]) -> str:
        """Build a ChatML-formatted prompt for Qwen."""
        parts = []
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            parts.append(f"<|im_start|>{role}\n{content}<|im_end|>")
        parts.append("<|im_start|>assistant\n")
        return "\n".join(parts)

    def chat(self, user_message: str) -> str:
        self.history.append({"role": "user", "content": user_message})

        if len(self.history) > MAX_HISTORY:
            self.history = self.history[-MAX_HISTORY:]

        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + self.history
        prompt = self._build_prompt(messages)

        import onnxruntime_genai as og

        tokens = self.tokenizer.encode(prompt)

        params = og.GeneratorParams(self.model)
        params.set_search_options(
            max_length=256,
            temperature=0.7,
            top_p=0.9,
        )
        params.input_ids = tokens

        generator = og.Generator(self.model, params)

        output_tokens = []
        while not generator.is_done():
            generator.compute_logits()
            generator.generate_next_token()
            new_token = generator.get_next_tokens()[0]
            output_tokens.append(new_token)

        assistant_message = self.tokenizer.decode(output_tokens)
        # Strip any trailing ChatML end token
        assistant_message = assistant_message.replace("<|im_end|>", "").strip()

        self.history.append({"role": "assistant", "content": assistant_message})
        return assistant_message


# ---------------------------------------------------------------------------
# CPU fallback — original llama-cpp-python backend
# ---------------------------------------------------------------------------

class _CPUChatModel:
    def __init__(self):
        from llama_cpp import Llama

        model_path = os.getenv("LLM_MODEL_PATH", "models/model.gguf")
        context_length = int(os.getenv("LLM_CONTEXT_LENGTH", "2048"))

        print(f"Loading LLM model: {model_path}", file=sys.stderr)
        self.model = Llama(
            model_path=model_path,
            n_ctx=context_length,
            n_threads=4,  # Reduced back to 4 - sometimes fewer is faster
            n_gpu_layers=0,  # CPU only for compatibility
            verbose=False,
            use_mlock=False,  # Disable mlock for faster startup
            use_mmap=True,   # Use memory mapping
        )
        print("LLM model loaded", file=sys.stderr)
        
        # Use the Ari system prompt
        self.system_prompt = SYSTEM_PROMPT
        print("Ari system prompt loaded", file=sys.stderr)

        self.history: list[dict[str, str]] = []

    def chat(self, user_message: str) -> str:
        start_time = time.time()
        
        # Classify intent first
        intent = classify_intent(user_message)
        intent_names = {0: "RED (Crisis)", 1: "YELLOW (Professional Help)", 2: "GREEN (Casual)"}
        print(f"Intent classified: {intent} - {intent_names[intent]}", file=sys.stderr)
        
        # Handle different intents with simple actions
        if intent == 0:  # RED - Crisis
            return "RED"
        elif intent == 1:  # YELLOW - Professional help needed
            return "YELLOW"
        
        # GREEN (2) - Continue with normal chat
        # Use classified intent in system prompt
        formatted_prompt = self.system_prompt.replace("{INTENT}", str(intent))
        
        self.history.append({"role": "user", "content": user_message})

        if len(self.history) > MAX_HISTORY:
            self.history = self.history[-MAX_HISTORY:]

        messages = [{"role": "system", "content": formatted_prompt}] + self.history
        
        inference_start = time.time()
        response = self.model.create_chat_completion(
            messages=messages,
            max_tokens=150,  # Allow 2-4 sentences per guide
            temperature=0.7,  # Natural variation
            top_p=0.9,
            top_k=50,
            repeat_penalty=1.15,  # Critical for small models - prevents loops
        )
        inference_time = time.time() - inference_start
        
        assistant_message = response["choices"][0]["message"]["content"]
        self.history.append({"role": "assistant", "content": assistant_message})
        
        total_time = time.time() - start_time
        print(f"LLM timing: inference={inference_time:.2f}s, total={total_time:.2f}s", file=sys.stderr)
        
        return assistant_message


# ---------------------------------------------------------------------------
# Public interface — auto-selects backend
# ---------------------------------------------------------------------------

class ChatModel:
    def __init__(self):
        if _use_npu_llm():
            print("[llm] Using NPU (onnxruntime-genai + QNN) backend", file=sys.stderr)
            self._backend = _NPUChatModel()
        else:
            print("[llm] Using CPU (llama-cpp-python) backend", file=sys.stderr)
            self._backend = _CPUChatModel()

    def chat(self, user_message: str) -> str:
        return self._backend.chat(user_message)
