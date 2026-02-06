import os
import sys

from qnn_utils import is_npu_available

SYSTEM_PROMPT = """You are a compassionate and thoughtful AI therapist. Your role is to:
- Listen actively and empathetically to what the user shares
- Ask open-ended questions to help them explore their thoughts and feelings
- Offer gentle reflections and observations
- Never provide medical diagnoses or prescribe medication
- Encourage professional help when appropriate
- Maintain a warm, non-judgmental, and supportive tone
- Keep responses concise and conversational (2-4 sentences)

Remember: You are a supportive companion, not a replacement for professional therapy."""

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
            n_threads=4,
            verbose=False,
        )
        print("LLM model loaded", file=sys.stderr)

        self.history: list[dict[str, str]] = []

    def chat(self, user_message: str) -> str:
        self.history.append({"role": "user", "content": user_message})

        if len(self.history) > MAX_HISTORY:
            self.history = self.history[-MAX_HISTORY:]

        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + self.history

        response = self.model.create_chat_completion(
            messages=messages,
            max_tokens=256,
            temperature=0.7,
            top_p=0.9,
        )

        assistant_message = response["choices"][0]["message"]["content"]
        self.history.append({"role": "assistant", "content": assistant_message})

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
