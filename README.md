# ConvoLab

ConvoLab is a multimodal AI platform designed to enable two-way communication between two parties. It bridges the gap between languages, speech, and visual context, creating an immersive conversational experience. Supports  Multiple languages, translations and real-time communications and also provides Simulated Conversations.

> **To Help People Learn, Experience and Master Real-World Communication**.

**🌐 Live Website:** [https://convolab.xyz](https://convolab.xyz)

## Demo

https://github.com/user-attachments/assets/6489b635-94dc-47ad-882a-6c17ed79b209


## Application Overview

ConvoLab reimagines language learning by placing you in the center of a dynamic, two-way simulated conversation. Unlike static exercises, ConvoLab creates a living dialogue.

The User Interface is divided into two distinct interaction zones:
-   **Party A (Learner/User)**: The left panel is your command center. Here, you type or speak to input your inputs, manage your target languages, and receive real-time predictive assistance.
-   **Party B (AI Tutor/Roleplayer)**: The right panel is the Party B persona (AI). It reacts instantly to your inputs, provides translations, suggests "conversation sparks" to keep the chat going, and uses visual aids to reinforce understanding.

### Key Capabilities

-   **Interactive Context Engine**:
    -   Define the scenario (e.g., "Talking with a friend...") or click **"Feeling Lucky"** to let the AI generate a random,  real-world situation.
    - Translation: Multi-language support with real-time translations and **Voice Mode**.

-   **Auto-Play (Simulation Mode)**:
    -   Watch the AI simulate a conversation with itself in your target scenario.
    -   **Reading Mode**: Includes a karaoke-style word highlighter synced with the audio, adjustable from 60 to 300 WPM for reading practice.

-   **Cognitive Assistance**:
    -   **Conversation Sparks**: Don't know what to say next? One-click suggestions provide contextually appropriate replies.
    -   **Predictive Text**: As you type, the AI predicts the next few words, helping you construct sentences like a native.

-   **Visual Immersion**:
    -   Real-time generation and retrieval of images relevant to the conversation context, engaging visual memory.

## Architecture & UI Design

ConvoLab is built as a highly responsive **Single Page Application (SPA)** using **Next.js 14**. The architecture prioritizes low-latency state updates to maintain the illusion of seamless conversation.

### Tech Stack

-   **Framework**: Next.js 14 (App Router)
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS (with custom extensive config for dark mode aesthetics)
-   **Animation**: Framer Motion (for smooth micro-interactions and transitions)
-   **State Management**: React Hooks (Custom-built for conversation logic)
-   **Audio**: Web Audio API (Visualization) + Custom hooks for STT/TTS integration

### Modular Component Architecture

The frontend is structured around atomic, reusable components that manage their own isolated states while communicating via a central context.

```
components/
├── party-a/           # User Interaction Components
│   ├── PartyAPanel    # Main container handling Input & Audio Visuals
│   └── ...
├── party-b/           # AI Response Components
│   ├── PartyBPanel    # Main container handling Markdown rendering & Suggestions
│   └── ...
├── input/             # Shared Input Modules
│   └── ContextInput   # The "Hero" input for setting scenarios
├── shared/            # Universal UI Elements
│   ├── TTSSettings    # Global audio/speed configuration
│   └── AudioVisualizer # Frequency analyzer for voice feedback
```

### Core Logic Hooks

The application logic is decoupled from the UI, encapsulated in powerful custom hooks:

1.  **`usePartyA`**:
    -   Manages the User's "Turn".
    -   Handles Microphone streams, Speech-to-Text conversion, and text input accumulation.
    -   Orchestrates the "Predictive Text" state.

2.  **`usePartyB`**:
    -   Manages the AI's "Turn".
    -   Handles LLM streaming responses, real-time Translation requests, and Text-to-Speech playback.
    -   Manages the "Conversation Sparks" generation pipeline.

3.  **`useAutoPlay`**:
    -   The "Simulation Engine". It creates a loop where Party A's output feeds Party B, and Party B's output feeds back into Party A (as a simulated response), automating the dialogue flow.
    -   Syncs the "Typewriter Effect" and "Audio Highlighting" for the observation mode.

## Integration

While the focus is on the rich UI, the frontend connects to a robust localized or cloud-based backend via REST API.

-   **Endpoints**: The UI consumes `api/ai`, `api/audio`, and `api/multimodal` to fetch intelligence.
-   **Streaming**: Responses are streamed to the client to minimize perceived latency.

## Getting Started

### Prerequisites

-   **Node.js**: v18+
-   **Backend Running**: (See Backend README for setup)

### Installation

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Setup**
    Copy the example credentials:
    ```bash
    cp .env.example .env.local
    ```

3.  **Run Development Server**
    ```bash
    npm run dev
    ```

4.  **Launch**
    Visit [http://localhost:3000](http://localhost:3000).

## Contributing

We are constantly refining the UI/UX. If you have ideas for better visualization or smoother interaction flows, please open a PR!

## License

[MIT](LICENSE)
