// ============================================================
// CHALLENGE 07 + 08 — Web App with indicators + Integrator
// Full UI: chat, modes, tool/cache badges, voice, image
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react'
import { CONFIG } from './config.js'
import { checkCache, addToCache } from './cache.js'
import { callFinBot } from './api.js'
import { TOOL_LABELS } from './tools.js'
import { speakText, cancelSpeech, createRecorder, transcribeWithWhisper } from './voice.js'

// ── Inline SVG icons ─────────────────────────────────────────
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)
const MicIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </svg>
)
const StopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
)
const ImgIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
  </svg>
)
const SpeakerIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
)

// ── Dot loader ────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '10px 14px' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)',
          animation: 'bounce 1.2s infinite', animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  )
}

// ── Badge component ───────────────────────────────────────────
function Badge({ type, tool }) {
  if (type === 'cache') return (
    <span style={{
      display: 'inline-block', fontSize: 11, padding: '2px 8px',
      background: 'rgba(0,255,136,0.12)', color: 'var(--accent)',
      border: '0.5px solid var(--accent-border)',
      borderRadius: 4, fontWeight: 500, letterSpacing: '0.02em',
    }}>■ Caché</span>
  )
  if (type === 'tool') {
    if (!tool || tool === '0' || tool === 0 || typeof tool === 'object') return null;
    return (
      <span style={{
        display: 'inline-block', fontSize: 11, padding: '2px 8px',
        background: 'var(--blue-dim)', color: 'var(--blue)',
        border: '0.5px solid var(--blue-border)',
        borderRadius: 4, fontWeight: 500,
      }}>⚙ {TOOL_LABELS[tool] || tool}</span>
    )
  }
  return null
}

// ── Message bubble ────────────────────────────────────────────
function Message({ msg, onSpeak }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 10, alignItems: 'flex-end',
      animation: 'fadeIn 0.2s ease-out',
    }}>
      {!isUser && (
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'var(--accent)', color: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 600, flexShrink: 0,
        }}>
          {CONFIG.AGENT_INITIAL}
        </div>
      )}

      <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 5, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        {/* Badges — permanent in history (Challenge 07) */}
        {msg.badge && <Badge type={msg.badge} tool={msg.tool} />}

        {/* Attached image (Challenge 05) */}
        {msg.image && (
          <img src={msg.image} alt="Adjunto" style={{
            maxWidth: 220, maxHeight: 180, borderRadius: 8,
            border: '0.5px solid var(--border)', objectFit: 'cover',
          }} />
        )}

        {/* Text bubble */}
        <div style={{
          padding: '10px 14px',
          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: isUser ? 'var(--accent)' : 'var(--bg-surface)',
          color: isUser ? '#000' : 'var(--text-primary)',
          border: isUser ? 'none' : '0.5px solid var(--border)',
          fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {msg.content}
        </div>

        {/* Listen button (Challenge 03) */}
        {!isUser && (
          <button onClick={() => onSpeak(msg.content)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '2px 8px', fontSize: 11,
            background: 'transparent', border: '0.5px solid var(--border)',
            borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer',
          }}>
            <SpeakerIcon /> Escuchar
          </button>
        )}
      </div>
    </div>
  )
}

// Mode button
function ModeBtn({ active, color, onClick, children }) {
  const colors = {
    green: { active: { background: 'rgba(0,255,136,0.12)', color: 'var(--accent)', border: '0.5px solid var(--accent-border)' } },
    blue:  { active: { background: 'var(--blue-dim)', color: 'var(--blue)', border: '0.5px solid var(--blue-border)' } },
  }
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
      fontFamily: 'var(--font)', transition: 'all 0.15s',
      ...(active
        ? (colors[color]?.active || colors.green.active)
        : { background: 'transparent', color: 'var(--text-muted)', border: '0.5px solid var(--border)' }),
    }}>
      {children}
    </button>
  )
}

// Main App 
export default function App() {
  const [messages, setMessages]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('finbot_messages')) || [] } catch { return [] }
  })
  const [apiHistory, setApiHistory]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('finbot_history'))  || [] } catch { return [] }
  })
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [outputMode, setOutputMode]   = useState('text')  // text | audio
  const [recording, setRecording]     = useState(false)
  const [transcript, setTranscript]   = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const [imageBase64, setImageBase64]   = useState(null)
  const [imageMime, setImageMime]       = useState(null)
  const [speaking, setSpeaking]         = useState(false)

  const recorderRef  = useRef(null)
  const bottomRef    = useRef(null)
  const textareaRef  = useRef(null)
  const fileInputRef = useRef(null)

  // Auto-scroll to last message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Persist messages to localStorage
  useEffect(() => {
    localStorage.setItem('finbot_messages', JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    localStorage.setItem('finbot_history', JSON.stringify(apiHistory))
  }, [apiHistory])

  // ── Image processing (Challenge 05) ────────────────────────────────────
  const handleImageFile = (file) => {
    if (!file) return
    setImageMime(file.type)
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target.result)
      setImageBase64(e.target.result.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  const clearImage = () => {
    setImagePreview(null)
    setImageBase64(null)
    setImageMime(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  //  Voice recording 
  const startRecording = async () => {
    try {
      const recorder = createRecorder(async (blob) => {
        try {
          const text = await transcribeWithWhisper(blob)
          setTranscript(text)
          setInput(text)
        } catch {
          setTranscript('[Error al transcribir. Intenta de nuevo.]')
        }
      })
      await recorder.start()
      recorderRef.current = recorder
      setRecording(true)
    } catch {
      alert('Micrófono no disponible. Verifica permisos del navegador.')
    }
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    setRecording(false)
  }

  //  Send message 
  const sendMessage = useCallback(async (textOverride) => {
    const text = (textOverride ?? input).trim()
    if (!text && !imageBase64) return
    if (loading) return

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: text || '(imagen adjunta)',
      image: imagePreview,
      badge: null,
      tool: null,
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setTranscript('')
    setLoading(true)
    cancelSpeech()

    // API History with memory window (Challenge 01)
    const trimmedHistory = apiHistory.slice(-CONFIG.MEMORY_WINDOW)

    //  Semantic cache
    const cached = !imageBase64 ? checkCache(text) : null

    if (cached) {
      await new Promise(r => setTimeout(r, 250)) // simula latencia mínima

      const botMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: cached.response,
        badge: 'cache',
        tool: null,
      }
      setMessages(prev => [...prev, botMsg])

      // Update API history with cached response
      setApiHistory(prev => [
        ...prev.slice(-CONFIG.MEMORY_WINDOW),
        { role: 'user', content: text },
        { role: 'assistant', content: cached.response },
      ])

      if (outputMode === 'audio') {
        setSpeaking(true)
        speakText(cached.response, () => setSpeaking(false))
      }

      setLoading(false)
      clearImage()
      return
    }

    // API Call 
    try {
      const { text: responseText, toolUsed, rawMessages } = await callFinBot(
        trimmedHistory,
        text,
        imageBase64,
        imageMime,
      )

      const botMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: responseText,
        badge: toolUsed ? 'tool' : null,
        tool: toolUsed,
      }

      setMessages(prev => [...prev, botMsg])

      // Cache if no tool was used (informational responses)
      if (!toolUsed && !imageBase64 && text.length > 10) {
        addToCache(text, responseText)
      }

      // Update API history from raw returned messages
      if (rawMessages) {
        setApiHistory(rawMessages.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : m.content,
        })).slice(-CONFIG.MEMORY_WINDOW))
      }

      if (outputMode === 'audio') {
        setSpeaking(true)
        speakText(responseText, () => setSpeaking(false))
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Error: ${err.message}`,
        badge: null,
        tool: null,
      }])
    }

    setLoading(false)
    clearImage()
  }, [input, apiHistory, imageBase64, imagePreview, imageMime, outputMode, loading])

  // ── Render ───────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* ── Header ───────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-secondary)', borderBottom: '0.5px solid var(--border)',
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
        flexShrink: 0,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 14, color: '#000',
        }}>
          {CONFIG.AGENT_INITIAL}
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
            {CONFIG.AGENT_NAME}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>
            {CONFIG.COMPANY_NAME} · Bilingüe · RAG · Vision · Tools
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {speaking && (
            <span style={{ fontSize: 11, color: 'var(--accent)', animation: 'pulse 1s infinite' }}>
              🔊 hablando...
            </span>
          )}
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>en línea</span>
          <button
            onClick={() => {
              if (window.confirm('¿Borrar toda la conversación?')) {
                setMessages([])
                setApiHistory([])
                localStorage.removeItem('finbot_messages')
                localStorage.removeItem('finbot_history')
              }
            }}
            title="Limpiar chat"
            style={{
              marginLeft: 8, padding: '3px 10px', fontSize: 11,
              background: 'transparent', border: '0.5px solid var(--border)',
              borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            🗑️ Limpiar
          </button>
        </div>
      </div>

      {/* ── Mode bar (Challenge 07) ───────────────────────────── */}
      <div style={{
        background: 'var(--bg-secondary)', borderBottom: '0.5px solid var(--border)',
        padding: '8px 20px', display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Salida</span>
          <ModeBtn active={outputMode === 'text'}  color="blue" onClick={() => { setOutputMode('text'); cancelSpeech(); }}>📝 Texto</ModeBtn>
          <ModeBtn active={outputMode === 'audio'} color="blue" onClick={() => setOutputMode('audio')}>🔊 Audio</ModeBtn>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>Caché: {Math.round(CONFIG.CACHE_THRESHOLD * 100)}%</span>
          <span>Memoria: {CONFIG.MEMORY_WINDOW / 2} turnos</span>
          <span>Modelo: {CONFIG.OPENAI_MODEL}</span>
        </div>
      </div>

      {/* ── Chat ─────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>💼</div>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 16, marginBottom: 6 }}>
              {CONFIG.AGENT_NAME}
            </p>
            <p style={{ fontSize: 13, marginBottom: 24, color: 'var(--text-secondary)' }}>
              Asistente financiero bilingüe · Detecta tu idioma automáticamente
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {CONFIG.QUICK_PROMPTS.map(q => (
                <button key={q} onClick={() => sendMessage(q)} style={{
                  padding: '7px 14px', fontSize: 12, borderRadius: 6,
                  border: '0.5px solid var(--border-hover)', background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font)',
                }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <Message key={msg.id} msg={msg} onSpeak={(text) => {
            cancelSpeech()
            setSpeaking(true)
            speakText(text, () => setSpeaking(false))
          }} />
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13, color: '#000',
            }}>
              {CONFIG.AGENT_INITIAL}
            </div>
            <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '14px 14px 14px 4px' }}>
              <ThinkingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Transcript (Challenge 03) ──────────────────────────── */}
      {transcript && (
        <div style={{
          background: 'var(--blue-dim)', borderTop: '0.5px solid var(--blue-border)',
          padding: '8px 20px', fontSize: 12, color: 'var(--blue)',
        }}>
          <strong>Transcripción:</strong> {transcript}
        </div>
      )}

      {/* ── Image preview (Challenge 05) ───────────────────────── */}
      {imagePreview && (
        <div style={{
          background: 'var(--bg-surface)', borderTop: '0.5px solid var(--border)',
          padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <img src={imagePreview} alt="Preview" style={{
            height: 52, borderRadius: 6, border: '0.5px solid var(--border)', objectFit: 'cover',
          }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Imagen adjunta</span>
          <button onClick={clearImage} style={{
            marginLeft: 'auto', padding: '3px 10px', fontSize: 12,
            background: 'transparent', border: '0.5px solid var(--border)',
            borderRadius: 4, color: 'var(--red)', cursor: 'pointer', fontFamily: 'var(--font)',
          }}>✕ Quitar</button>
        </div>
      )}

      {/* ── Input area ────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-secondary)', borderTop: '0.5px solid var(--border)',
        padding: '12px 20px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>

          {/* Voice button (Challenge 03) */}
          <button
            onClick={recording ? stopRecording : startRecording}
            aria-label={recording ? 'Detener grabación' : 'Iniciar grabación'}
            style={{
              width: 42, height: 42, borderRadius: '50%', border: 'none',
              cursor: 'pointer', flexShrink: 0,
              background: recording ? 'var(--red)' : 'var(--bg-surface2)',
              color: recording ? '#fff' : 'var(--text-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: recording ? 'pulse 1s infinite' : 'none',
            }}
          >
            {recording ? <StopIcon /> : <MicIcon />}
          </button>

          {/* Image button (Challenge 05) */}
          <label style={{
            width: 42, height: 42, borderRadius: 8, cursor: 'pointer',
            border: '0.5px solid var(--border)', background: 'var(--bg-surface2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', flexShrink: 0,
          }}>
            <ImgIcon />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={e => handleImageFile(e.target.files[0])}
            />
          </label>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Escribe, graba o adjunta imagen... (Enter para enviar)"
            rows={1}
            style={{
              flex: 1, resize: 'none', padding: '11px 14px', fontSize: 14,
              borderRadius: 8, border: '0.5px solid var(--border)',
              background: 'var(--bg-surface)', color: 'var(--text-primary)',
              fontFamily: 'var(--font)', lineHeight: 1.5,
              maxHeight: 100, overflowY: 'auto',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
          />

          {/* Send button */}
          <button
            onClick={() => sendMessage()}
            disabled={loading || (!input.trim() && !imageBase64)}
            aria-label="Enviar mensaje"
            style={{
              width: 42, height: 42, borderRadius: 8, border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer', flexShrink: 0,
              background: loading || (!input.trim() && !imageBase64)
                ? 'var(--bg-surface2)'
                : 'var(--accent)',
              color: loading || (!input.trim() && !imageBase64) ? 'var(--text-muted)' : '#000',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            <SendIcon />
          </button>
        </div>

        {/* Legend */}
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>
            <span style={{ background: 'rgba(0,255,136,0.12)', color: 'var(--accent)', padding: '1px 5px', borderRadius: 3 }}>■ Caché</span>
            {' '}respuesta instantánea
          </span>
          <span>
            <span style={{ background: 'var(--blue-dim)', color: 'var(--blue)', padding: '1px 5px', borderRadius: 3 }}>⚙ Tool</span>
            {' '}herramienta activada
          </span>
          <span style={{ marginLeft: 'auto' }}>Shift+Enter = nueva línea</span>
        </div>
      </div>
    </div>
  )
}
