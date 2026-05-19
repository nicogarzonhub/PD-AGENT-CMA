# AGENT CMA — Full AI Agent

Bilingual conversational financial agent built for the 2026 RIWI hackathon/simulation.
It covers all 8 challenges: advanced system prompt, tool calling, voice (STT/TTS), RAG, vision, semantic caching, UI with badges, and an end-to-end integration flow.

## Stack

- **Frontend**: React 18 + Vite
- **AI**: OpenAI (gpt-4o-mini / gpt-4o)
- **STT (Speech-to-Text)**: Whisper API (OpenAI) with fallback to Web Speech API
- **TTS (Text-to-Speech)**: Web Speech Synthesis API (native browser feature, no key needed)
- **RAG**: Local embeddings + cosine similarity (no external vector database needed)
- **Cache**: In-memory semantic cache using n-grams

## Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure API keys
cp .env.example .env
# Edit .env and add your API keys

# 3. Run in development mode
npm run dev
# Open http://localhost:3000

# 4. Build for production
npm run build
```

## Quick Configuration

Edit `src/config.js` to customize the agent:

```js
AGENT_NAME: "AGENT CMA",           // Agent's name
COMPANY_NAME: "...",            // Company name
OPENAI_API_KEY: "sk-proj-...",   // Or use .env variables
OPENAI_MODEL: "gpt-4o-mini",     // Model to use
CACHE_THRESHOLD: 0.90,          // Semantic cache threshold (0 to 1)
```

## Operational Tools (Tool Calling)

FinBot is equipped with three custom operational tools that allow it to perform real-time calculations and fetch live data instead of just hallucinating responses. When the AI determines it needs one of these tools, it pauses text generation, executes the corresponding JavaScript function locally, and uses the result to build its final answer.

### 1.  `calculate_interest` (Compound Interest Calculator)
*   **Purpose**: Used when the user asks about investments, expected returns, or how much their money will grow over a specific period.
*   **How it works**: It executes a real compound interest mathematical formula (`A = P * (1 + r/n)^(n*t)`). It takes the initial capital (`principal`), the annual interest rate (`rate`), and the timeframe (`years`), and returns the final amount, the generated interest, and the effective monthly rate.

### 2. `get_usd_rate` (USD to COP Exchange Rate)
*   **Purpose**: Triggered when the user asks for the current dollar price, the TRM (Tasa Representativa del Mercado), or wants to convert US Dollars (USD) to Colombian Pesos (COP).
*   **How it works**: Currently, it simulates a baseline reference rate (around 4127 COP) by adding or subtracting a random variation (±25 COP) to mimic real-time market fluctuations. In a production environment, this function should be connected to a live exchange rate API.

### 3. ₿ `get_crypto_price` (Cryptocurrency Prices)
*   **Purpose**: Activated when the user asks for the current value of Bitcoin, Ethereum, Solana, or any other supported cryptocurrency.
*   **How it works**: It makes a real HTTP fetch request to the **CoinGecko** public API. It returns the current price in both USD and COP, along with the 24-hour price change percentage. If the API fails or is unreachable, it includes a fallback mechanism with approximate hardcoded prices so the user always receives an answer.

## Implemented Challenges

| Challenge | Module | File |
|-----------|--------|------|
| 01 | Bilingual Agent + Memory | `src/config.js` (SYSTEM_PROMPT) |
| 02 | 3 Tools (Interest, USD, Crypto) | `src/tools.js` |
| 03 | Voice Pipeline STT + TTS | `src/voice.js` |
| 04 | RAG over Web Content | `src/rag.js` |
| 05 | Multimodal Vision (Images) | `src/api.js` + `src/App.jsx` |
| 06 | Semantic Cache with Cosine | `src/cache.js` |
| 07 | UI with Tool & Cache Badges | `src/App.jsx` |
| 08 | End-to-End Integration Flow | `src/App.jsx` (sendMessage) |

## Architecture Flow

```
User
  │
  ├─ checkCache() ──────────────► Instant response + "■ Caché" badge
  │
  └─ callFinBot()
       │
       ├─ retrieveRAG() ─────────► Injects context into the prompt
       │
       ├─ OpenAI API (1st call)
       │    │
       │    ├─ No tool_calls ──► Direct text response
       │    │
       │    └─ Has tool_calls
       │         │
       │         ├─ executeTool() ──► calculate_interest / get_usd_rate / get_crypto_price
       │         │
       │         └─ OpenAI API (2nd call with tool results)
       │              └─► Final response + "⚙ Tool" badge
       │
       └─ addToCache() ──────────► Saves interaction for future similar queries
```

## Technical Notes

- **Whisper**: Without `OPENAI_API_KEY`, it falls back to the native Web Speech API (Chrome/Edge). Add the key to use the real Whisper model.
- **CoinGecko**: Free public API without a key. If it fails (e.g., CORS issues in some environments), the automatic fallback is activated.
- **Cache**: In-memory storage. It resets when the page is reloaded. To persist it, serialize `CACHE_STORE` to `localStorage`.
- **API Keys in Production**: Never expose API keys in the frontend code. Always use server-side environment variables (e.g., Vercel, Railway, etc.) or a backend proxy like n8n.
