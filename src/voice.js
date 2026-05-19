// 
//  Voice Pipeline
// STT: Whisper API (OpenAI) or Web Speech API (fallback)
// TTS: Web Speech Synthesis API (free, no key)
//      In production: ElevenLabs or OpenAI TTS for better quality

import { CONFIG } from './config.js'

// STT — Speech to Text

/**
 * Transcribes an audio Blob using OpenAI's Whisper API.
 * Requires OPENAI_API_KEY in config.js.
 * Accepts files up to 25 MB: .mp3, .wav, .webm, .ogg, .m4a
 *
 * In production:
 *   POST https://api.openai.com/v1/audio/transcriptions
 *   Headers: Authorization: Bearer <key>
 *   Body: FormData with file and model=whisper-1
 */
export async function transcribeWithWhisper(audioBlob) {
  const apiKey = CONFIG.OPENAI_API_KEY || import.meta.env?.VITE_OPENAI_KEY || ''

  if (!apiKey) {
    // Fallback: Web Speech API (Chrome/Edge only, requires connection)
    return transcribeWithWebSpeech(audioBlob)
  }

  const formData = new FormData()
  formData.append('file', audioBlob, 'recording.webm')
  formData.append('model', 'whisper-1')
  formData.append('language', 'es') // auto-detects if omitted

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Whisper error ${response.status}`)
  }

  const data = await response.json()
  return data.text
}

/**
 * Fallback: Web Speech API for transcription without Whisper.
 * Works in Chrome/Edge. Firefox does not support it.
 * Does not process Blobs — returns guide text for the user.
 */
function transcribeWithWebSpeech() {
  return new Promise((resolve) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      resolve('[Add your OPENAI_API_KEY in config.js to enable Whisper STT]')
      return
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'es-CO'

    recognition.onresult = (event) => {
      resolve(event.results[0][0].transcript)
    }
    recognition.onerror = () => {
      resolve('[Voice recognition error. Try again.]')
    }
    recognition.start()
  })
}

// ── Recording with MediaRecorder API ─

export function createRecorder(onStop) {
  let mediaRecorder = null
  let chunks = []
  let stream = null

  const start = async () => {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(stream)
    chunks = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' })
      stream.getTracks().forEach(t => t.stop())
      onStop(blob)
    }

    mediaRecorder.start()
  }

  const stop = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
  }

  return { start, stop }
}

//  TTS — Text to Speech

/**
 * Synthesizes text to speech using Web Speech Synthesis API.
 * Free, no key. Available in all modern browsers.
 *
 * For production with better quality:
 *   - OpenAI TTS: POST https://api.openai.com/v1/audio/speech
 *   - ElevenLabs: POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
 */
export function speakText(text, onEnd) {
  if (!window.speechSynthesis) {
    console.warn('TTS not available in this browser')
    onEnd?.()
    return
  }

  // Cancel ongoing synthesis
  window.speechSynthesis.cancel()

  // Limit to 600 characters to avoid cuts in some browsers
  const utterance = new SpeechSynthesisUtterance(text.slice(0, 600))

  // Detect language by special Spanish characters
  const isSpanish = /[áéíóúñ¿¡]/.test(text)
  utterance.lang = isSpanish ? 'es-CO' : 'en-US'
  utterance.rate = 0.9
  utterance.pitch = 1.0
  utterance.volume = 1.0

  // Select best available voice
  const voices = window.speechSynthesis.getVoices()
  const preferred = voices.find(v =>
    isSpanish
      ? v.lang.startsWith('es') && v.name.includes('Google')
      : v.lang.startsWith('en') && v.name.includes('Google')
  ) || voices.find(v => isSpanish ? v.lang.startsWith('es') : v.lang.startsWith('en'))

  if (preferred) utterance.voice = preferred

  utterance.onend = () => onEnd?.()
  utterance.onerror = () => onEnd?.()

  window.speechSynthesis.speak(utterance)
}

export function cancelSpeech() {
  window.speechSynthesis?.cancel()
}
