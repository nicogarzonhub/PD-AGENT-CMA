// 
// API Client — n8n Router + Direct OpenAI Fallback
//
// n8n mode   (recommended): calls the n8n webhook which orchestrates
//            the entire pipeline (RAG, OpenAI, tools) on the server.
// Direct mode (fallback): calls OpenAI directly from the
//            browser if no webhook is configured.
// 

import { CONFIG, SYSTEM_PROMPT } from './config.js'
import { TOOL_DEFINITIONS, executeTool } from './tools.js'
import { retrieveRAG } from './rag.js'

// Helpers
function buildUserContent(text, imageBase64, imageMime) {
  const ragContext = retrieveRAG(text)
  const fullText = ragContext
    ? `${text}\n\n[RAG_CONTEXT]\n${ragContext}\n[/RAG_CONTEXT]`
    : text

  if (imageBase64) {
    return [
      { type: 'text', text: fullText },
      {
        type: 'image_url',
        image_url: { url: `data:${imageMime || 'image/jpeg'};base64,${imageBase64}` },
      },
    ]
  }
  return fullText
}

// n8n Mode — calls the webhook 

async function callViaN8n(webhookUrl, apiMessages, userText, imageBase64, imageMime) {
  const ragContext = retrieveRAG(userText);

  // Generamos o recuperamos un Session ID único para que n8n maneje la memoria de forma nativa
  let sessionId = localStorage.getItem('finbot_session_id');
  if (!sessionId) {
    sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('finbot_session_id', sessionId);
  }

  const payload = {
    sessionId:  sessionId,
    message:    userText, // Clean message to prevent memory pollution
    history:    apiMessages,
    ragContext: ragContext || null,
    systemPrompt: SYSTEM_PROMPT,
    imageBase64: imageBase64 || null,
    imageMime:   imageMime   || null,
  }

  const response = await fetch(webhookUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error || `n8n webhook error ${response.status}`)
  }

  const data = await response.json()

  // Expects n8n to return: { text: string, toolUsed?: string }
  let parsedTool = data.toolUsed;
  if (
    !parsedTool || 
    parsedTool === '0' || 
    parsedTool === 0 || 
    parsedTool === '{}' || 
    parsedTool === '[object Object]' || 
    typeof parsedTool === 'object'
  ) {
    parsedTool = null;
  }

  return {
    text:        data.text || data.output || data.message || 'No response.',
    toolUsed:    parsedTool,
    rawMessages: [
      ...apiMessages,
      { role: 'user',      content: userText },
      { role: 'assistant', content: data.text || '' },
    ],
  }
}

//  Direct Mode — calls OpenAI from the browser 

async function callDirectOpenAI(apiKey, apiMessages, userText, imageBase64, imageMime) {
  const userContent = buildUserContent(userText, imageBase64, imageMime)

  const conversationHistory = [
    ...apiMessages,
    { role: 'user', content: userContent },
  ]

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory,
  ]

  // First call 
  const firstRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:       CONFIG.OPENAI_MODEL,
      messages,
      tools:       TOOL_DEFINITIONS,
      temperature: 0.7,
    }),
  })

  if (!firstRes.ok) {
    const err = await firstRes.json().catch(() => ({}))
    throw new Error(err?.error?.message || `API error ${firstRes.status}`)
  }

  const firstData   = await firstRes.json()
  const firstMsg    = firstData.choices[0].message

  // No tool used → direct response 
  if (!firstMsg.tool_calls?.length) {
    return {
      text:        firstMsg.content || 'No response.',
      toolUsed:    null,
      rawMessages: [...conversationHistory, firstMsg],
    }
  }

  // Tool use 
  const toolCall   = firstMsg.tool_calls[0]
  const toolName   = toolCall.function.name
  const toolArgs   = JSON.parse(toolCall.function.arguments)
  const toolResult = await executeTool(toolName, toolArgs)

  const messagesWithTool = [
    ...messages,
    firstMsg,
    {
      role:         'tool',
      tool_call_id: toolCall.id,
      name:         toolName,
      content:      JSON.stringify(toolResult),
    },
  ]

  //  Second call 
  const secondRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:       CONFIG.OPENAI_MODEL,
      messages:    messagesWithTool,
      tools:       TOOL_DEFINITIONS,
      temperature: 0.7,
    }),
  })

  if (!secondRes.ok) {
    const err = await secondRes.json().catch(() => ({}))
    throw new Error(err?.error?.message || `API error ${secondRes.status}`)
  }

  const secondData = await secondRes.json()
  const finalMsg   = secondData.choices[0].message

  return {
    text:     finalMsg.content || 'No response.',
    toolUsed: toolName,
    rawMessages: [
      ...conversationHistory,
      firstMsg,
      { role: 'tool', tool_call_id: toolCall.id, name: toolName, content: JSON.stringify(toolResult) },
      finalMsg,
    ],
  }
}

// Exported main function 

/**
 * Routes the request:
 *   1. If n8n webhook is configured → calls the webhook.
 *   2. If not → calls OpenAI directly (fallback mode).
 */
export async function callFinBot(apiMessages, userText, imageBase64 = null, imageMime = null) {
  const webhookUrl = CONFIG.N8N_WEBHOOK_URL || import.meta.env?.VITE_N8N_WEBHOOK || ''
  const apiKey     = CONFIG.OPENAI_API_KEY  || import.meta.env?.VITE_OPENAI_KEY  || ''

  //  n8n Mode 
  if (webhookUrl) {
    console.info('[FinBot] Routing through n8n →', webhookUrl)
    return callViaN8n(webhookUrl, apiMessages, userText, imageBase64, imageMime)
  }

  // Fallback: direct OpenAI 
  if (!apiKey) {
    return {
      text: '⚠️ No configuration found. Add VITE_N8N_WEBHOOK (recommended) or VITE_OPENAI_KEY to your .env file',
      toolUsed: null,
    }
  }

  console.info('[FinBot] Direct OpenAI mode (no n8n)')
  return callDirectOpenAI(apiKey, apiMessages, userText, imageBase64, imageMime)
}
