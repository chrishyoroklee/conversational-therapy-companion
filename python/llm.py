import os
import sys
import time
import re


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

def load_system_prompt():
    """Load system prompt from system-prompt.md file"""
    try:
        # Get the directory of this script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        # Go up one level to project root and find system-prompt.md
        prompt_path = os.path.join(os.path.dirname(script_dir), "system-prompt.md")

        if os.path.exists(prompt_path):
            with open(prompt_path, 'r', encoding='utf-8') as f:
                full_prompt = f.read()
                # Use a condensed version for faster processing
                return CONDENSED_SYSTEM_PROMPT
        else:
            print(f"Warning: system-prompt.md not found at {prompt_path}, using fallback", file=sys.stderr)
            return CONDENSED_SYSTEM_PROMPT
    except Exception as e:
        print(f"Error loading system prompt: {e}, using fallback", file=sys.stderr)
        return CONDENSED_SYSTEM_PROMPT

CONDENSED_SYSTEM_PROMPT = """You are Ari, the user's older sister figure. You are warm, honest, and genuinely care — but you don't just agree with everything. You ask real questions. You push back gently when something sounds off. You never lecture.
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

DEFAULT_SYSTEM_PROMPT = """You are a compassionate and thoughtful supportive companion. Your role is to:
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

        # Load system prompt from file
        self.system_prompt = load_system_prompt()
        print("System prompt loaded", file=sys.stderr)

        self.history: list[dict[str, str]] = []

    def warmup(self) -> None:
        """Pre-warm the LLM by doing a quick inference with system prompt.
        
        This initializes the KV cache so the first real user message is faster.
        """
        print("Warming up LLM...", file=sys.stderr)
        start_time = time.time()
        
        # Do a minimal inference to warm up the model
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": "hi"}
        ]
        
        self.model.create_chat_completion(
            messages=messages,
            max_tokens=1,  # Generate just 1 token to minimize warmup time
            temperature=0.7,
        )
        
        warmup_time = time.time() - start_time
        print(f"LLM warmup complete in {warmup_time:.2f}s", file=sys.stderr)

    def chat(self, user_message: str) -> dict:
        start_time = time.time()

        # Classify intent first
        intent = classify_intent(user_message)
        risk_names = {0: "red", 1: "yellow", 2: "green"}
        risk_level = risk_names[intent]
        intent_labels = {0: "RED (Crisis)", 1: "YELLOW (Professional Help)", 2: "GREEN (Casual)"}
        print(f"Intent classified: {intent} - {intent_labels[intent]}", file=sys.stderr)

        # RED - crisis: skip generation, trigger crisis UI
        if intent == 0:
            return {"risk_level": "red", "assistant_text": "", "actions": ["crisis"]}

        # YELLOW - append a professional-help nudge to the system prompt
        if intent == 1:
            formatted_prompt = self.system_prompt.replace("{INTENT}", str(intent))
            formatted_prompt += "\n\nThe user may benefit from professional support. Acknowledge their feelings warmly, then gently note that a counselor or therapist could help. Still provide a caring, substantive reply."
        else:
            formatted_prompt = self.system_prompt.replace("{INTENT}", str(intent))

        # Generate normal assistant response for GREEN and YELLOW
        self.history.append({"role": "user", "content": user_message})

        if len(self.history) > MAX_HISTORY:
            self.history = self.history[-MAX_HISTORY:]

        messages = [{"role": "system", "content": formatted_prompt}] + self.history

        inference_start = time.time()
        response = self.model.create_chat_completion(
            messages=messages,
            max_tokens=64,
            temperature=0.4,
            top_p=0.8,
            top_k=20,
            repeat_penalty=1.1,
            stop=["\\n\\n", "\\n", ".", "!", "?"],
        )
        inference_time = time.time() - inference_start

        assistant_message = response["choices"][0]["message"]["content"]
        self.history.append({"role": "assistant", "content": assistant_message})

        total_time = time.time() - start_time
        print(f"LLM timing: inference={inference_time:.2f}s, total={total_time:.2f}s", file=sys.stderr)

        return {"risk_level": risk_level, "assistant_text": assistant_message, "actions": []}
