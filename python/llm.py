import os
import sys
import time
import re
from llama_cpp import Llama

def classify_intent(user_message: str) -> int:
    """Classify user intent: 0=RED (crisis), 1=YELLOW (therapist needed), 2=GREEN (casual chat)"""
    message_lower = user_message.lower()
    
    # RED (0) - Crisis/self-harm indicators
    red_patterns = [
        r"\b(kill|hurt|harm|suicide|die|death|end it all)\b.*\b(myself|me)\b",
        r"\b(want to die|suicidal|self harm|cut myself|overdose)\b",
        r"\b(no point|give up|can't go on|end my life)\b"
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

CONDENSED_SYSTEM_PROMPT = """You are a supportive, warm older sister-like companion. Help users feel heard and less alone.

Key traits: warm, calm, non-judgmental, use simple human language.
- Listen actively and empathetically  
- Ask gentle, open questions
- Offer brief reflections
- Keep responses short (1-2 sentences) and conversational
- Never diagnose or give medical advice
- Encourage professional help when needed

Respond naturally as a caring friend would."""

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

    def chat(self, user_message: str) -> str:
        start_time = time.time()
        
        # Classify intent first
        intent = classify_intent(user_message)
        intent_names = {0: "RED (Crisis)", 1: "YELLOW (Professional Help)", 2: "GREEN (Casual)"}
        print(f"Intent classified: {intent} - {intent_names[intent]}", file=sys.stderr)
        
        # Use classified intent in system prompt
        formatted_prompt = self.system_prompt.replace("{INTENT}", str(intent))
        
        self.history.append({"role": "user", "content": user_message})

        # Keep history within window
        if len(self.history) > MAX_HISTORY:
            self.history = self.history[-MAX_HISTORY:]

        messages = [{"role": "system", "content": formatted_prompt}] + self.history
        
        inference_start = time.time()
        response = self.model.create_chat_completion(
            messages=messages,
            max_tokens=64,  # Reduced from 128 for faster response
            temperature=0.4,  # Slightly lower for faster generation
            top_p=0.8,
            top_k=20,  # Add top-k for faster sampling
            repeat_penalty=1.1,  # Prevent repetition
            stop=["\\n\\n", "\\n", ".", "!", "?"],  # Stop early for conciseness
        )
        inference_time = time.time() - inference_start
        
        assistant_message = response["choices"][0]["message"]["content"]
        self.history.append({"role": "assistant", "content": assistant_message})
        
        total_time = time.time() - start_time
        print(f"LLM timing: inference={inference_time:.2f}s, total={total_time:.2f}s", file=sys.stderr)
        
        return assistant_message
