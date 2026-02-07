# CODE_YELLOW — Implementation Plan

## Overview

CODE_YELLOW is a safety escalation flow that activates when the existing intent classifier detects elevated concern in a user's message. The classifier already emits `{ "type": "code_yellow", "triggered": true }` via JSON Lines — this plan covers everything that happens **after** that event is received. The system shifts the chat into a supportive non-directive mode and only makes a network request (Google Maps Places API) if the user explicitly consents and provides a ZIP code. No conversation data is ever shared, persisted, or transmitted.

---

## 1. IPC Channels for CODE_YELLOW

**File:** `src/main/ipc.ts`

Register new IPC handlers:

| Channel | Direction | Purpose |
|---|---|---|
| `code-yellow:triggered` | Main → Renderer | Notify UI that CODE_YELLOW was detected |
| `code-yellow:consent` | Renderer → Main | User consents (or declines) to look up help |
| `code-yellow:zip-lookup` | Renderer → Main | User submits a 5-digit ZIP code |
| `code-yellow:results` | Main → Renderer | Return therapist results or fallback resources |

**File:** `src/preload/index.ts`

Expose through `therapyAPI`:
```ts
codeYellow: {
  onTriggered: (callback: () => void) => void
  sendConsent: (consented: boolean) => void
  submitZip: (zip: string) => void
  onResults: (callback: (data: CodeYellowResults) => void) => void
}
```

---

## 2. Main Process — ZIP Lookup & Results Window

**File:** `src/main/codeYellow.ts` (new)

This module handles all sensitive logic in the main process:

### 2a. Google Maps Places API Lookup

- On receiving `code-yellow:zip-lookup` with a valid 5-digit ZIP:
  1. Geocode the ZIP to lat/lng using the Google Geocoding API.
  2. Query Google Maps Places API (Nearby Search) for `therapist | psychologist | counselor` within a reasonable radius.
  3. Return structured results: name, address, phone number, rating (if available).
- The API key is stored in a `.env` file (gitignored) and loaded via `process.env` at runtime. It is never bundled into renderer code.
- The ZIP code is held only in memory for the duration of the request and immediately discarded. It is never written to disk or logged.

### 2b. Isolated Results Window

- Results are displayed in a **separate `BrowserWindow`** with the following properties:
  - `nodeIntegration: false`
  - `contextIsolation: true`
  - No access to the chat window or LLM context
  - No `webContents` messaging back to the chat renderer
- The window receives results via a dedicated preload script that only exposes the results payload.
- This hard separation ensures the user clearly sees: "This is external information, not AI-generated advice."

### 2c. Offline Fallback

If the API call fails, the user declines consent, or no network is available, display static fallback resources:

- **988 Suicide & Crisis Lifeline** — Call or text 988
- **Crisis Text Line** — Text HOME to 741741
- **SAMHSA National Helpline** — 1-800-662-4357
- **Psychology Today Therapist Directory** — https://www.psychologytoday.com/us/therapists
- **Open Path Collective** — https://openpathcollective.org

These are hardcoded strings with no network dependency.

---

## 3. Renderer — Chat UI Safety Flow

**File:** `src/renderer/src/components/CodeYellowOverlay.tsx` (new)

When `code-yellow:triggered` is received:

### Step 1 — Supportive Message (No Consent Yet)

- The chat UI **stops generating therapeutic responses**.
- A full-screen overlay or inline card appears with supportive, non-directive language:
  > "It sounds like you might be going through something really difficult. I want to make sure you have access to the right support. Would you like me to help you find a professional near you?"
- Two buttons: **"Yes, help me find someone"** / **"No thanks"**
- No pressure, no countdown, no auto-action.

### Step 2 — ZIP Code Modal (If Consented)

- A small modal appears with a single input field for a 5-digit ZIP code.
- Client-side validation: exactly 5 digits, no letters or symbols.
- A clear note: *"Your ZIP code is used only for this search and is never saved."*
- Submit sends the ZIP to main process via `code-yellow:zip-lookup`.

### Step 3 — Results or Fallback

- If results are returned: the isolated `BrowserWindow` opens showing nearby professionals.
- If fallback: the overlay displays the static crisis resources listed above.
- The user can dismiss and return to the chat at any time.

### Re-entry

- After the user dismisses the overlay, normal chat resumes.
- CODE_YELLOW will not re-trigger for the remainder of the current session to avoid repeated interruptions. A flag in renderer state tracks this.

---

## 4. Security & Privacy Guarantees

| Concern | Mitigation |
|---|---|
| Conversation data leakage | No chat content is included in any IPC message or API request |
| ZIP code persistence | ZIP is held in memory only, never written to disk or logs |
| API key exposure | Key lives in `.env` (gitignored), loaded only in main process, never sent to renderer |
| Renderer ↔ Results isolation | Results window is a separate `BrowserWindow` with no shared context |
| Network minimalism | Only one geocode + one places request, only when user explicitly consents |
| Fallback availability | Static crisis resources always available with zero network dependency |

---

## 5. File Summary

| File | Action | Description |
|---|---|---|
| `src/main/codeYellow.ts` | Create | Places API lookup, results window creation, fallback logic |
| `src/main/ipc.ts` | Modify | Register CODE_YELLOW IPC channels |
| `src/main/index.ts` | Modify | Import and initialize codeYellow module |
| `src/preload/index.ts` | Modify | Expose `codeYellow` API surface on `therapyAPI` |
| `src/renderer/src/components/CodeYellowOverlay.tsx` | Create | Overlay UI with consent flow, ZIP input, and fallback display |
| `src/renderer/src/App.tsx` | Modify | Mount `CodeYellowOverlay` and listen for trigger events |
| `src/renderer/src/types/index.ts` | Modify | Add `CodeYellowResults` type definitions |
| `.env` | Create | Store `GOOGLE_MAPS_API_KEY` (gitignored) |
| `.gitignore` | Modify | Ensure `.env` is listed |

---

## 6. Implementation Order

1. **IPC channels** — wire up main ↔ renderer communication for `code_yellow` events
2. **Main process module** — API lookup, results window, fallback
3. **Preload bridge** — expose `codeYellow` methods
4. **Renderer overlay** — consent flow, ZIP modal, results/fallback display
5. **Testing** — manual trigger, consent/decline paths, API failure fallback, window isolation
