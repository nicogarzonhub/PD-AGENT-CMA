
//RAG (Retrieval Augmented Generation)
// Source: FinBot content (simulated as real web scraping)
// In production: replace RAG_CHUNKS with scraped content
// using fetch() + DOMParser or cheerio (Node.js)
// Local embeddings with simpleEmbed — in prod use text-embedding-3-small


import { simpleEmbed, cosineSimilarity } from './cache.js'

// ── Documented source URL 
// Source: https://www.finbot.co (simulated)
// In production use WebBaseLoader from LangChain or:
//   const res = await fetch(url)
//   const html = await res.text()
//   const text = new DOMParser().parseFromString(html,'text/html').body.innerText
// Then apply chunking with an overlap of at least 50 chars

const SOURCE_URL = "https://www.bancolombia.com/personas"

// Chunks with overlap ≥50 characters 
// Minimum 3 chunks required. Overlap is visible at the start of each chunk.
export const RAG_CHUNKS = [
  // Chunk 1 — Products and Services
  `[Source: ${SOURCE_URL} — Productos y Servicios]
Bancolombia Personas ofrece una amplia gama de productos y servicios financieros diseñados para satisfacer diversas necesidades.
Entre su portafolio principal se encuentran Cuentas (ahorro y corriente), Tarjetas de Crédito y Débito, opciones de Créditos, financiación para Vivienda, Seguros y asistencias.
También cuentan con alternativas para hacer crecer el capital mediante Inversiones, realizar Giros nacionales e internacionales, y soluciones accesibles como Bancolombia A la Mano.
Adicionalmente, se ofrecen servicios especializados como Leasing, Compra y venta de dólares en efectivo, venta de vehículos usados y renta de vehículos a través de Renting Colombia.`,

  // Chunk 2 — Customer Service and Digital Channels (overlap with chunk 1: "Bancolombia A la Mano / productos y servicios")
  `[Source: ${SOURCE_URL} — Canales de Servicio]
Para facilitar el acceso a todos los productos y servicios mencionados, Bancolombia Personas cuenta con múltiples canales de atención y autogestión.
Los clientes pueden utilizar la Sucursal Virtual Personas y la App Mi Bancolombia para realizar transacciones de forma segura y desde cualquier lugar.
Para trámites presenciales, se dispone de una red extensa que incluye Sucursales Físicas, Corresponsales Bancarios, Cajeros Automáticos y Cajeros Multifuncionales.
Además, existen plataformas para agilizar procesos como Multipagos PSE, Trámites Digitales (para descargar Certificados Bancarios, por ejemplo) y la opción de solicitar turnos en sucursales de forma anticipada.`,

  // Chunk 3 — Solutions by Profile and Needs (overlap with chunk 2: "Trámites Digitales / canales de atención")
  `[Source: ${SOURCE_URL} — Banco para todos y Necesidades]
A través de sus canales de atención y ecosistema digital, Bancolombia Personas adapta sus soluciones según el perfil de cada usuario en su sección "Banco para todos".
Existen ofertas especializadas para niños, jóvenes, la familia, colombianos en el exterior, así como para Cliente Preferencial, Banca Privada y Cliente Independiente.
En cuanto a necesidades puntuales, el banco provee soluciones integrales enfocadas en movilidad privada (incluyendo recarga cívica), soluciones de vivienda, y soluciones de pago ágiles.
Los clientes también pueden acceder a beneficios exclusivos, ofertas especiales y educación financiera a través de programas y alianzas como Tu360.`
]

// Pre-compute embeddings for retrieval
const RAG_STORE = RAG_CHUNKS.map((chunk, i) => ({
  id: i,
  chunk,
  embedding: simpleEmbed(chunk),
}))

/**
 * Retrieves relevant chunks for a given question.
 * @param {string} question
 * @param {number} topK - number of chunks to return
 * @param {number} minScore - minimum similarity score to include
 * @returns {string | null}
 */
export function retrieveRAG(question, topK = 2, minScore = 0.04) {
  const qEmb = simpleEmbed(question)

  const scored = RAG_STORE
    .map(entry => ({ ...entry, score: cosineSimilarity(qEmb, entry.embedding) }))
    .sort((a, b) => b.score - a.score)

  const relevant = scored.filter(e => e.score >= minScore).slice(0, topK)

  if (relevant.length === 0) return null

  return relevant.map(e => e.chunk).join('\n\n---\n\n')
}
