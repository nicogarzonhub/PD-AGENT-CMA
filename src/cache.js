// 
//  Semantic Cache
// Embeddings by n-grams + cosine similarity in-memory
// In production: replace simpleEmbed() with
//   POST https://api.openai.com/v1/embeddings (text-embedding-3-small)
//

import { CONFIG } from './config.js'

// Bilingual financial vocabulary for local embedding
const VOCAB = [
  "horario","atención","hora","abierto","cerrado","schedule","open","hours","when",
  "contraseña","password","recuperar","recover","reset","clave","acceso","login",
  "transferencia","transfer","demora","tiempo","cuanto","how long","envío","send",
  "tasa","rate","dólar","usd","cop","cambio","exchange","peso","dollar",
  "cuenta","account","saldo","balance","dinero","money","fondos","funds",
  "bitcoin","crypto","criptomoneda","btc","eth","ethereum","precio","price","coin",
  "interés","interest","inversión","investment","plazo","cdt","ahorro","savings","rendimiento",
  "tarjeta","card","crédito","credit","débito","debit","visa","mastercard",
  "préstamo","loan","cuota","fee","mensual","monthly","pago","payment",
  "soporte","support","ayuda","help","problema","problem","error","issue","fallo",
  "producto","product","servicio","service","finbot","fintech","banco","bank",
  "colombia","estados unidos","usa","bogotá","medellín","miami",
  "seguridad","security","fraude","fraud","bloqueo","block","robo","theft",
  "apertura","opening","cierre","closure","requisito","requirement","documento","document",
]

/**
 * Generates a local embedding vector based on vocabulary n-grams.
 * @param {string} text
 * @returns {number[]}
 */
export function simpleEmbed(text) {
  const t = text.toLowerCase().replace(/[^a-záéíóúñ0-9\s]/g, '').trim()
  // Ignoramos palabras muy cortas (como "en", "la", "de") para evitar falsos positivos
  const words = t.split(/\s+/).filter(w => w.length > 3)
  const vec = VOCAB.map(w => words.some(word => word.includes(w) || w.includes(word)) ? 1 : 0)
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map(v => v / norm)
}

/**
 * Calculates cosine similarity between two vectors.
 * Numpy equivalent: np.dot(a,b) / (np.linalg.norm(a) * np.linalg.norm(b))
 */
export function cosineSimilarity(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0)
}

// ── Pre-populated FAQs
const FAQ_DATA = [
  {
    question: "¿Cuál es el horario de atención de AGENT CMA?",
    response: "AGENT CMA está disponible 24/7 a través de nuestros canales digitales. Nuestros asesores humanos atienden de lunes a viernes de 8:00 a.m. a 6:00 p.m. y sábados de 9:00 a.m. a 1:00 p.m., hora Colombia."
  },
  {
    question: "¿Cómo recupero mi contraseña?",
    response: "Para recuperar su contraseña, ingrese a nuestra aplicación o sitio web y seleccione '¿Olvidó su contraseña?'. Recibirá un código de verificación a su correo o número de celular registrado. Si no recuerda sus datos de contacto, comuníquese con nuestra línea de soporte al 01 8000 123 456."
  },
  {
    question: "¿Cuánto demora una transferencia?",
    response: "Las transferencias entre cuentas AGENT CMA son inmediatas (24/7). Para transferencias a otros bancos en Colombia, el tiempo es de hasta 2 horas hábiles. Las transferencias internacionales pueden tomar entre 1 y 3 días hábiles según el país destino."
  },
  {
    question: "¿Cuáles son los productos de AGENT CMA?",
    response: "AGENT CMA ofrece: Cuenta de Ahorros Digital (sin cuota de manejo), Cuenta Corriente Empresarial, CDT con tasas competitivas (hasta 11% EA), Tarjeta de Crédito AGENT CMA Visa con 1.5% cashback, y Préstamos Personales desde $500.000 COP. Todos 100% en línea."
  },
  {
    question: "What are AGENT CMA's service hours?",
    response: "AGENT CMA is available 24/7 through our digital channels. Our human advisors are available Monday through Friday from 8:00 AM to 6:00 PM and Saturdays from 9:00 AM to 1:00 PM, Colombia time."
  },
  {
    question: "How do I reset my password?",
    response: "To reset your password, open our app or website and tap 'Forgot Password?'. You'll receive a verification code to your registered email or phone. If you don't have access to those, please call our support line at +1 305 456 7890."
  },
  {
    question: "¿Cómo reporto un fraude o transacción no reconocida?",
    response: "Si detecta una transacción no reconocida, bloquee su tarjeta inmediatamente desde la app FinBot en 'Tarjetas > Bloquear'. Luego llame al 01 8000 123 456 (Colombia) o +1 305 456 7890 (USA) disponible 24/7. También puede abrir un caso en la app desde 'Soporte > Reportar fraude'."
  },
]

// Pre-compute embeddings when the module loads
const CACHE_STORE = FAQ_DATA.map(entry => ({
  ...entry,
  embedding: simpleEmbed(entry.question),
}))

/**
 * Searches the semantic cache.
 * @param {string} question
 * @returns {{ response: string, similarity: number } | null}
 */
export function checkCache(question) {
  const qEmb = simpleEmbed(question)
  let best = null
  let bestSim = -1

  for (const entry of CACHE_STORE) {
    const sim = cosineSimilarity(qEmb, entry.embedding)
    if (sim > bestSim) {
      bestSim = sim
      best = entry
    }
  }

  if (bestSim >= CONFIG.CACHE_THRESHOLD) {
    return { response: best.response, similarity: bestSim }
  }
  return null
}

/**
 * Adds a new entry to the cache at runtime.
 */
export function addToCache(question, response) {
  CACHE_STORE.push({
    question,
    response,
    embedding: simpleEmbed(question),
  })
}
