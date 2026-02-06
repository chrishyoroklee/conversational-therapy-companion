import os
import sys
from llama_cpp import Llama

def load_system_prompt():
    """Load system prompt from system-prompt.md file"""
    try:
        # Get the directory of this script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        # Go up one level to project root and find system-prompt.md
        prompt_path = os.path.join(os.path.dirname(script_dir), "system-prompt.md")
        
        if os.path.exists(prompt_path):
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read()
        else:
            print(f"Warning: system-prompt.md not found at {prompt_path}, using fallback", file=sys.stderr)
            return DEFAULT_SYSTEM_PROMPT
    except Exception as e:
        print(f"Error loading system prompt: {e}, using fallback", file=sys.stderr)
        return DEFAULT_SYSTEM_PROMPT

DEFAULT_SYSTEM_PROMPT = """You are a compassionate and thoughtful AI therapist. Your role is to:
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
        
        # Load system prompt from file
        self.system_prompt = load_system_prompt()
        print("System prompt loaded", file=sys.stderr)

        self.history: list[dict[str, str]] = []

    def chat(self, user_message: str) -> str:
        # For now, assume INTENT = 0 (Keep Talking) - you can extend this later
        # to analyze the user message and determine intent
        formatted_prompt = self.system_prompt.replace("{INTENT}", "0")
        
        self.history.append({"role": "user", "content": user_message})

        # Keep history within window
        if len(self.history) > MAX_HISTORY:
            self.history = self.history[-MAX_HISTORY:]

        messages = [{"role": "system", "content": formatted_prompt}] + self.history

        response = self.model.create_chat_completion(
            messages=messages,
            max_tokens=256,
            temperature=0.7,
            top_p=0.9,
        )

        assistant_message = response["choices"][0]["message"]["content"]
        self.history.append({"role": "assistant", "content": assistant_message})

        return assistant_message
