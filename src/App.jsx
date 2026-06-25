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
const TextIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '-2px' }}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
)
const AudioModeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '-2px' }}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
)
const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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
    <div className={isUser ? "user-message" : "bot-message"} style={{
      display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 16, width: '100%',
      animation: 'fadeIn 0.2s ease-out',
    }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: 4,
          background: 'var(--accent)', color: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0, marginTop: 4,
        }}>
          {CONFIG.AGENT_INITIAL}
        </div>
      )}

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        alignItems: isUser ? 'flex-end' : 'flex-start',
        maxWidth: isUser ? '85%' : '100%', flex: 1, minWidth: 0,
      }}>
        {/* Badges — permanent in history (Challenge 07) */}
        {msg.badge && <Badge type={msg.badge} tool={msg.tool} />}

        {/* Attached image (Challenge 05) */}
        {msg.image && (
          <img src={msg.image} alt="Adjunto" style={{
            maxWidth: 220, maxHeight: 180, borderRadius: 8,
            border: '0.5px solid var(--border)', objectFit: 'cover',
          }} />
        )}

        {/* Text content */}
        <div className={isUser ? "user-bubble" : ""} style={{
          fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          ...( !isUser ? { padding: '4px 0', color: 'var(--text-primary)' } : {} )
        }}>
          {msg.content}
        </div>

        {/* Listen button (Challenge 03) */}
        {!isUser && (
          <button onClick={() => onSpeak(msg.content)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 8px', fontSize: 12, marginTop: 4,
            background: 'transparent', border: 'none',
            borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer',
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
  
  const [sessions, setSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('finbot_sessions')) || [] } catch { return [] }
  })
  const [currentSessionId, setCurrentSessionId] = useState(() => {
    return localStorage.getItem('finbot_current_session_id') || localStorage.getItem('finbot_session_id') || null
  })
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [outputMode, setOutputMode]   = useState('text')  // text | audio
  const [recording, setRecording]     = useState(false)
  const [transcript, setTranscript]   = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const [imageBase64, setImageBase64]   = useState(null)
  const [imageMime, setImageMime]       = useState(null)
  const [speaking, setSpeaking]         = useState(false)
  const [sidebarOpen, setSidebarOpen]   = useState(false)

  const recorderRef  = useRef(null)
  const bottomRef    = useRef(null)
  const textareaRef  = useRef(null)
  const fileInputRef = useRef(null)

  // Migration of legacy single chat
  useEffect(() => {
    if (sessions.length === 0) {
      const legacyMsgs = JSON.parse(localStorage.getItem('finbot_messages') || '[]');
      const legacyHist = JSON.parse(localStorage.getItem('finbot_history') || '[]');
      let legacySid = localStorage.getItem('finbot_session_id');
      
      if (legacyMsgs.length > 0) {
        if (!legacySid) legacySid = 'session-' + Date.now();
        const legacySession = {
          id: legacySid,
          title: legacyMsgs[0]?.content?.substring(0, 30) + '...' || 'Chat Anterior',
          messages: legacyMsgs,
          apiHistory: legacyHist,
          updatedAt: Date.now()
        };
        setSessions([legacySession]);
        setCurrentSessionId(legacySid);
      }
    }
  }, []);

  // Persist sessions and active session ID
  useEffect(() => {
    localStorage.setItem('finbot_sessions', JSON.stringify(sessions))
    if (currentSessionId) {
      localStorage.setItem('finbot_current_session_id', currentSessionId)
      localStorage.setItem('finbot_session_id', currentSessionId) // For backward compatibility
    } else {
      localStorage.removeItem('finbot_current_session_id')
    }
  }, [sessions, currentSessionId])

  // Sync active messages to current session
  useEffect(() => {
    if (messages.length === 0 && apiHistory.length === 0) return;
    
    let sid = currentSessionId;
    if (!sid) {
      sid = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      setCurrentSessionId(sid);
    }

    setSessions(prev => {
      const existing = prev.find(s => s.id === sid);
      const title = existing?.title || (messages[0]?.content?.substring(0, 30) + '...') || 'Nuevo Chat';
      
      if (existing) {
        return prev.map(s => s.id === sid ? { ...s, messages, apiHistory, updatedAt: Date.now() } : s);
      } else {
        return [{ id: sid, title, messages, apiHistory, updatedAt: Date.now() }, ...prev];
      }
    });

    // Also keep legacy storage for immediate reloads
    localStorage.setItem('finbot_messages', JSON.stringify(messages))
    localStorage.setItem('finbot_history', JSON.stringify(apiHistory))
  }, [messages, apiHistory])

  // Auto-scroll to last message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const loadSession = (sid) => {
    const session = sessions.find(s => s.id === sid);
    if (session) {
      setCurrentSessionId(sid);
      setMessages(session.messages);
      setApiHistory(session.apiHistory);
      if (window.innerWidth <= 768) setSidebarOpen(false);
    }
  }

  const createNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setApiHistory([]);
    if (window.innerWidth <= 768) setSidebarOpen(false);
  }

  const deleteSession = (sid, e) => {
    e.stopPropagation();
    setDeleteConfirmId(sid);
  }

  const confirmDeleteSession = () => {
    if (!deleteConfirmId) return;
    setSessions(prev => prev.filter(s => s.id !== deleteConfirmId));
    if (deleteConfirmId === currentSessionId) {
      createNewChat();
    }
    setDeleteConfirmId(null);
  }

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

    let activeSid = currentSessionId;
    if (!activeSid) {
      activeSid = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      setCurrentSessionId(activeSid);
    }

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
        activeSid
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
  }, [input, apiHistory, imageBase64, imagePreview, imageMime, outputMode, loading, currentSessionId])

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="app-layout">
      {deleteConfirmId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-primary)', padding: 24, borderRadius: 12,
            width: '90%', maxWidth: 320, border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)', textAlign: 'center'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: 8, color: 'var(--text-primary)', fontSize: 18 }}>¿Eliminar chat?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.4 }}>
              Esta acción no se puede deshacer. Se perderá el historial de esta conversación.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => setDeleteConfirmId(null)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteSession}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--red)', color: 'white', cursor: 'pointer', fontWeight: 500 }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ───────────────────────────────────────── */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '0.5px solid var(--border)' }}>
           <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{CONFIG.AGENT_INITIAL}</div>
           <span style={{ fontWeight: 600 }}>{CONFIG.AGENT_NAME}</span>
           <button className="hide-on-desktop" onClick={() => setSidebarOpen(false)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <button
            onClick={createNewChat}
            style={{
              padding: '10px 14px', background: 'var(--bg-surface)', border: '0.5px solid var(--border)',
              borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left',
              display: 'flex', gap: 8, alignItems: 'center'
            }}
          >
            <span>+</span> Nuevo Chat
          </button>

          {sessions.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Historial</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '250px', overflowY: 'auto' }}>
                {[...sessions].sort((a,b) => b.updatedAt - a.updatedAt).map(s => (
                  <div key={s.id} style={{ display: 'flex', gap: 4, alignItems: 'center', background: currentSessionId === s.id ? 'var(--bg-surface)' : 'transparent', borderRadius: 6 }}>
                    <button 
                      onClick={() => loadSession(s.id)}
                      style={{
                        padding: '8px 12px', flex: 1, background: 'transparent',
                        border: 'none', color: currentSessionId === s.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer', textAlign: 'left', fontSize: 13,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}
                    >
                      {s.title}
                    </button>
                    <button 
                      onClick={(e) => deleteSession(s.id, e)}
                      style={{ padding: '8px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.7 }}
                      title="Eliminar chat"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Configuración</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, background: 'var(--bg-primary)', padding: 4, borderRadius: 8 }}>
                <button onClick={() => { setOutputMode('text'); cancelSpeech(); }} style={{ flex: 1, padding: '6px', border: 'none', background: outputMode === 'text' ? 'var(--bg-surface2)' : 'transparent', color: outputMode === 'text' ? 'white' : 'var(--text-muted)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <TextIcon /> Texto
                </button>
                <button onClick={() => setOutputMode('audio')} style={{ flex: 1, padding: '6px', border: 'none', background: outputMode === 'audio' ? 'var(--bg-surface2)' : 'transparent', color: outputMode === 'audio' ? 'white' : 'var(--text-muted)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <AudioModeIcon /> Audio
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 'auto', fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>Modelo: {CONFIG.OPENAI_MODEL}</div>
            <div>Caché: {Math.round(CONFIG.CACHE_THRESHOLD * 100)}%</div>
          </div>
        </div>
      </div>

      {/* ── Main View ───────────────────────────────────────── */}
      <div className="main-view">
        {/* Mobile Header */}
        <div className="hide-on-desktop" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)', zIndex: 10, position: 'sticky', top: 0 }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <span style={{ fontWeight: 600, fontSize: 16 }}>{CONFIG.AGENT_NAME}</span>
          <button onClick={createNewChat} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
        </div>

      {/* ── Chat ─────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="chat-centered">

        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 12px var(--accent-border))' }}>
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 16, marginBottom: 6 }}>
              {CONFIG.AGENT_NAME}
            </p>
            <p style={{ fontSize: 13, marginBottom: 24, color: 'var(--text-secondary)' }}>
              Asistente financiero multilingüe · Detecta tu idioma automáticamente
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
      </div>

      {/* ── Input area ────────────────────────────────────── */}
      <div className="floating-input-wrapper">
        <div className="floating-input">
          {transcript && (
            <div style={{ fontSize: 12, color: 'var(--blue)', padding: '0 8px' }}>
              🎙️ {transcript}
            </div>
          )}
          
          {imagePreview && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 8px' }}>
              <img src={imagePreview} alt="Preview" style={{ height: 40, borderRadius: 4, objectFit: 'cover' }} />
              <button onClick={clearImage} style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12 }}>✕ Quitar</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: '4px 8px' }}>
            <label style={{ width: 32, height: 32, borderRadius: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'var(--bg-primary)' }}>
              <span style={{ fontSize: 24, lineHeight: 0, marginTop: -2 }}>+</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={e => handleImageFile(e.target.files[0])} />
            </label>

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
              placeholder="Mensaje..."
              rows={1}
              style={{
                flex: 1, resize: 'none', padding: '6px 8px', fontSize: 16,
                border: 'none', background: 'transparent', color: 'var(--text-primary)',
                maxHeight: 120, overflowY: 'auto', outline: 'none', fontFamily: 'inherit'
              }}
            />

            {input.trim() || imageBase64 ? (
              <button
                onClick={() => sendMessage()}
                disabled={loading}
                style={{
                  width: 32, height: 32, borderRadius: 16, border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: 'var(--text-primary)', color: 'var(--bg-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <SendIcon />
              </button>
            ) : (
              <button
                onClick={recording ? stopRecording : startRecording}
                style={{ width: 32, height: 32, borderRadius: 16, border: 'none', cursor: 'pointer', background: recording ? 'var(--red)' : 'transparent', color: recording ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {recording ? <StopIcon /> : <MicIcon />}
              </button>
            )}
          </div>
          <div className="hide-on-mobile" style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
             {CONFIG.AGENT_NAME} puede cometer errores. Considera verificar la información importante.
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
