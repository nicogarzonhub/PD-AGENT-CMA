//  Tool Calling
// Tool 1: calculate_interest  (custom logic)
// Tool 2: get_usd_rate        (hardcoded & documented)
// Tool 3: get_crypto_price    (CoinGecko API — free, no key)


//Tool definitions for the OpenAI API
export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "calculate_interest",
      description:
        "Calculates compound interest. Use when the user asks about investing money at an interest rate for a number of years, or asks how much money they will have after an investment period.",
      parameters: {
        type: "object",
        properties: {
          principal: {
            type: "number",
            description: "Initial investment amount in COP or USD",
          },
          rate: {
            type: "number",
            description: "Annual interest rate as a percentage. Example: 8 for 8% annual rate.",
          },
          years: {
            type: "number",
            description: "Number of years for the investment",
          },
        },
        required: ["principal", "rate", "years"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_usd_rate",
      description:
        "Returns the current USD to COP (Colombian Peso) exchange rate. Use when the user asks about the dollar price, USD/COP rate, or wants to convert dollars to pesos.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_crypto_price",
      description:
        "Returns the current price of a cryptocurrency in USD and COP using the CoinGecko public API. Use when the user asks about Bitcoin, Ethereum, or any other cryptocurrency price.",
      parameters: {
        type: "object",
        properties: {
          coin: {
            type: "string",
            description:
              "The CoinGecko coin ID. Examples: bitcoin, ethereum, litecoin, ripple, cardano, solana, dogecoin.",
          },
        },
        required: ["coin"],
      },
    },
  },
]

// ── Tool Executors

/**
 * Tool 1: Compound interest
 * Formula: A = P * (1 + r/n)^(n*t)
 * We use annual compounding (n=1)
 */
function calculateInterest({ principal, rate, years }) {
  const r = rate / 100
  const finalAmount = principal * Math.pow(1 + r, years)
  const interestGenerated = finalAmount - principal
  const effectiveMonthlyRate = (Math.pow(1 + r, 1 / 12) - 1) * 100

  return {
    principal: Math.round(principal),
    annual_rate_percent: rate,
    years,
    final_amount: Math.round(finalAmount),
    interest_generated: Math.round(interestGenerated),
    return_percentage: ((interestGenerated / principal) * 100).toFixed(2),
    effective_monthly_rate: effectiveMonthlyRate.toFixed(4),
    compounding: "annual",
  }
}

/**
 * Tool 2: USD/COP Rate
 * Hardcoded with ±25 variation to simulate a real-time market.
 * In production: use https://open.er-api.com/v6/latest/USD (free)
 * or https://api.exchangerate-api.com/v4/latest/USD
 */
function getUsdRate() {
  // Simulated realistic variation
  const baseRate = 4127
  const variation = Math.floor(Math.random() * 50) - 25
  const rate = baseRate + variation

  return {
    usd_to_cop: rate,
    cop_to_usd: (1 / rate).toFixed(8),
    source: "FinBot Reference Rate",
    // Note: replace with a real API in production
    // Suggested API: GET https://open.er-api.com/v6/latest/USD (free, no key)
    note: "Reference rate. For real-time rates, integrate open.er-api.com",
    timestamp: new Date().toISOString(),
  }
}

/**
 * Tool 3: Cryptocurrency prices — CoinGecko API
 * Documentation: https://www.coingecko.com/api/documentation
 * Endpoint: GET https://api.coingecko.com/api/v3/simple/price
 * No API key required for basic usage
 */
async function getCryptoPrice({ coin }) {
  const coinId = coin.toLowerCase().trim()

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd,cop&include_24hr_change=true`
    const response = await fetch(url)

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()
    const coinData = data[coinId]

    if (!coinData) {
      return {
        error: true,
        message: `Price not found for "${coin}". Verify the CoinGecko ID.`,
        suggestion: "Valid examples: bitcoin, ethereum, litecoin, ripple, solana",
      }
    }

    return {
      coin: coinId,
      price_usd: coinData.usd,
      price_cop: coinData.cop,
      change_24h_percent: coinData.usd_24h_change?.toFixed(2),
      source: "CoinGecko Public API",
      timestamp: new Date().toISOString(),
    }
  } catch (err) {
    // Fallback with approximate prices if CoinGecko is unresponsive
    const FALLBACK_PRICES = {
      bitcoin: 67800,
      ethereum: 3540,
      litecoin: 87,
      ripple: 0.52,
      solana: 145,
      dogecoin: 0.085,
      cardano: 0.38,
    }

    const usd = FALLBACK_PRICES[coinId]
    if (!usd) {
      return { error: true, message: `Could not fetch the price for "${coin}". API unavailable.` }
    }

    return {
      coin: coinId,
      price_usd: usd,
      price_cop: Math.round(usd * 4127),
      source: "FinBot Fallback (CoinGecko unavailable)",
      warning: "Approximate prices. External API is unreachable.",
      timestamp: new Date().toISOString(),
    }
  }
}

// ── Main Dispatcher
export async function executeTool(name, input) {
  switch (name) {
    case "calculate_interest":
      return calculateInterest(input)
    case "get_usd_rate":
      return getUsdRate()
    case "get_crypto_price":
      return await getCryptoPrice(input)
    default:
      return { error: true, message: `Unknown tool: ${name}` }
  }
}

// Labels for UI display
export const TOOL_LABELS = {
  calculate_interest: "📊 calculate_interest",
  get_usd_rate: "💱 get_usd_rate",
  get_crypto_price: "₿ get_crypto_price",
}
