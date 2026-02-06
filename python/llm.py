import os
import sys
from llama_cpp import Llama

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


class ChatModel:
    def __init__(self):
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

        # Keep history within window
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
