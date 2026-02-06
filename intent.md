# Intent Classification System

## Overview
3-tier intent classification for therapy companion responses: RED (crisis), YELLOW (professional help), GREEN (casual chat).

## Classification Categories

### 🔴 RED - Crisis/Emergency (Intent = 0)
**Triggers**: Self-harm, suicide, immediate danger
- Keywords: "kill myself", "want to die", "hurt myself", "suicide", "end it all", "no point", "give up", "can't go on"
- **Action**: 
  - Immediate crisis response
  - Provide 911 / National Suicide Prevention Lifeline
  - Direct to emergency services
  - Do NOT continue casual conversation

### 🟡 YELLOW - Professional Help Needed (Intent = 1) 
**Triggers**: Mental health concerns, therapy requests
- Keywords: "therapist", "counselor", "depression", "anxiety", "panic", "trauma", "PTSD", "need help", "professional help", "medication"
- **Action**:
  - Validate feelings
  - Suggest professional support
  - **Future**: Google Maps API integration to find local therapists
  - Encourage reaching out to trusted person

### 🟢 GREEN - Casual Conversation (Intent = 2)
**Triggers**: Everything else (default)
- General chat, daily struggles, seeking support
- **Action**: 
  - Continue supportive conversation
  - Ask open questions
  - Provide emotional support
  - Stay present and empathetic

## Implementation Status

### ✅ Completed
- [x] Basic regex pattern matching
- [x] Intent classification function 
- [x] Integration with LLM system prompt
- [x] Logging of classified intents

### 🚧 In Progress
- [ ] Enhanced pattern detection (fuzzy matching)
- [ ] Context-aware classification (history consideration)

### 📅 Future Features
- [ ] **RED**: 911 auto-dial integration
- [ ] **RED**: Crisis hotline directory (988 Suicide & Crisis Lifeline)
- [ ] **YELLOW**: Google Maps API therapist finder
- [ ] **YELLOW**: Insurance provider matching
- [ ] **GREEN**: Mood tracking integration
- [ ] ML-based intent classification (replace regex)

## Pattern Examples

### RED Examples
- "I want to hurt myself"
- "There's no point in living"
- "I'm thinking about suicide"
- "I can't go on anymore"

### YELLOW Examples  
- "I think I need to see a therapist"
- "My anxiety is getting worse"
- "I need professional help"
- "Do you know any counselors?"

### GREEN Examples
- "I'm feeling sad today"
- "Work was stressful"
- "I'm lonely"
- "Tell me about your day"

## Technical Notes
- Uses regex patterns for fast classification
- Falls back to GREEN (casual) by default
- Intent logged for debugging and analytics
- System prompt dynamically updated based on intent