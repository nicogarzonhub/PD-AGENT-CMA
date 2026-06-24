# AGENT CMA — Full-Stack AI Financial Assistant

A sophisticated, bilingual conversational AI agent built for my professional portfolio. This project demonstrates end-to-end integration of modern AI capabilities into a React web application, showcasing advanced agentic behaviors, real-time tool execution, and high-performance optimizations.

**Live Demo:** [https://pd-agent-cma.vercel.app/](https://pd-agent-cma.vercel.app/)  
**GitHub Repository:** [https://github.com/nicogarzonhub/PD-AGENT-CMA](https://github.com/nicogarzonhub/PD-AGENT-CMA)

---

## 🌟 Core Features

This project integrates several advanced AI paradigms into a cohesive architecture:

- ** Multilingual Agent & Memory**: A robust system prompt and context window management that auto-detects and seamlessly responds in any language the user speaks. Includes multi-session chat history.
- ** Autonomous Tool Calling**: The agent can pause text generation, fetch real-time data or perform calculations via internal tools, and resume answering based on factual data.
- ** Voice Pipeline (STT/TTS)**: Integrated OpenAI Whisper API for Speech-to-Text and native browser Web Speech Synthesis for Text-to-Speech interactions.
- ** Retrieval-Augmented Generation (RAG)**: Uses local vector embeddings and cosine similarity to inject domain-specific context into the prompt before hitting the LLM.
- **Multimodal Vision**: Users can attach images to their queries. The agent analyzes the images contextually along with the text.
- ** Semantic Caching**: An ultra-fast, in-memory cache system using n-grams and cosine similarity to serve instant answers for repeated or semantically similar queries, saving API costs and reducing latency.
- ** Polished React UI**: A ChatGPT-inspired responsive interface featuring floating input, tool usage badges (`⚙ Tool`), cache hit badges (`■ Caché`), and chat session management.

##  Tech Stack

- **Frontend**: React 18 + Vite, Custom CSS (Responsive & Modern Aesthetics)
- **AI Models**: OpenAI (`gpt-4o-mini` / `gpt-4o`)
- **Integration**: Supports both direct OpenAI API execution and webhook routing via **n8n** for low-code backend orchestration.

##  Operational Tools

To prevent LLM hallucinations, the agent is equipped with custom tools that fetch deterministic data:

### 1. `get_usd_rate` (USD/COP Exchange Rate)
Simulates a real-time market exchange rate for US Dollars to Colombian Pesos. Designed to be easily hot-swapped with a live Exchange Rate API like `open.er-api.com`.

### 2. `get_crypto_price` (Live Cryptocurrencies)
Makes HTTP requests to the **CoinGecko API** to fetch the real-time USD and COP prices of requested cryptocurrencies, along with 24h market fluctuations. Includes a robust fallback mechanism if the public API rate-limits the request.

##  Architecture Flow

```text
User Input (Text / Voice / Image)
  │
  ├─ checkCache() ──────────────► [Cache Hit] ──► Instant Response + "■ Caché" badge
  │
  └─ [Cache Miss] ──► processChat()
       │
       ├─ retrieveRAG() ─────────► Injects domain knowledge into the prompt payload
       │
       ├─ LLM Execution (OpenAI / n8n)
       │    │
       │    ├─ No tool_calls ──► Direct text response
       │    │
       │    └─ Has tool_calls
       │         │
       │         ├─ executeTool() ──► interest / usd_rate / crypto
       │         │
       │         └─ LLM Re-Evaluation (Analyzes tool results)
       │              └─► Final natural language response + "⚙ Tool" badge
       │
       └─ addToCache() ──────────► Memorizes the semantic interaction for future use
```

## Installation & Setup

1. **Clone the repository and install dependencies**
   ```bash
   git clone https://github.com/nicogarzonhub/PD-AGENT-CMA.git
   cd PD-AGENT-CMA
   npm install
   ```

2. **Configure Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   # Required for direct fallback mode and Whisper API
   VITE_OPENAI_KEY=sk-your-openai-api-key
   
   # Optional: Route traffic through your custom n8n webhook workflow
   VITE_N8N_WEBHOOK=https://your-n8n-instance.cloud/webhook/finbot
   ```

3. **Run the Development Server**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` (or the port provided by Vite) to view the application.

##  Configuration

You can easily tweak the agent's behavior by editing `src/config.js`:
- `AGENT_NAME` / `COMPANY_NAME`: Change the bot's identity and persona.
- `OPENAI_MODEL`: Switch between `gpt-4o-mini`, `gpt-4o`, etc.
- `CACHE_THRESHOLD`: Adjust how strict the semantic cache matching should be (e.g., `0.90`).
- `MEMORY_WINDOW`: Control how many previous messages are sent to the LLM to maintain context.
