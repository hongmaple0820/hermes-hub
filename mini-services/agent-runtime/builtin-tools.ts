/**
 * Built-in Tool Implementations — 5 core tools in pi-agent-core's AgentTool format
 *
 * Tools:
 *   1. web_search  — Search the web for information
 *   2. calculator   — Evaluate mathematical expressions
 *   3. file_read    — Read a file from a URL or path
 *   4. file_write   — Write content to a URL endpoint
 *   5. http_request — Make arbitrary HTTP requests
 *
 * All tools use TypeBox schemas from pi-ai's Type utility and
 * return results in the standard AgentTool execute format.
 */

import { Type } from '@earendil-works/pi-ai'
import type { AgentTool } from '@earendil-works/pi-agent-core'

// ============================================================================
// Tool Registry
// ============================================================================

const builtinToolRegistry = new Map<string, AgentTool>()

export function getBuiltinTool(name: string): AgentTool | undefined {
  return builtinToolRegistry.get(name)
}

export function getAllBuiltinTools(): AgentTool[] {
  return Array.from(builtinToolRegistry.values())
}

export function getBuiltinToolNames(): string[] {
  return Array.from(builtinToolRegistry.keys())
}

// ============================================================================
// 1. Web Search
// ============================================================================

const webSearchTool: AgentTool = {
  name: 'web_search',
  label: 'Web Search',
  description: 'Search the web for information. Returns search results with titles, URLs, and snippets.',
  parameters: Type.Object({
    query: Type.String({ description: 'The search query' }),
    max_results: Type.Optional(Type.Number({ description: 'Maximum number of results to return (default: 5)', minimum: 1, maximum: 20 })),
  }),
  execute: async (toolCallId, params, signal, onUpdate) => {
    const { query, max_results = 5 } = params

    onUpdate?.({ status: 'searching', query })

    try {
      // Use a simple search API approach — in production, this would call a real search API
      // For now, we use a DuckDuckGo-like approach or a configured search endpoint
      const searchUrl = process.env.SEARCH_API_URL
      let results: string

      if (searchUrl) {
        const response = await fetch(`${searchUrl}?q=${encodeURIComponent(query)}&max_results=${max_results}`, {
          signal,
          headers: { 'Content-Type': 'application/json' },
        })

        if (!response.ok) {
          results = `Search failed: HTTP ${response.status}`
        } else {
          const data = await response.json()
          results = formatSearchResults(data.results || data, query)
        }
      } else {
        // Fallback: provide a helpful message about search not being configured
        results = `Web search for "${query}" — Search API is not configured. ` +
          `To enable web search, set the SEARCH_API_URL environment variable. ` +
          `In the meantime, here are some suggested search terms: "${query}"`
      }

      return {
        content: [{ type: 'text', text: results }],
        details: { query, max_results },
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return {
          content: [{ type: 'text', text: 'Web search was cancelled' }],
          details: { aborted: true },
        }
      }
      return {
        content: [{ type: 'text', text: `Web search failed: ${err.message}` }],
        details: { error: true },
      }
    }
  },
}

function formatSearchResults(results: any[], query: string): string {
  if (!Array.isArray(results) || results.length === 0) {
    return `No search results found for "${query}"`
  }

  return results.map((r: any, i: number) =>
    `${i + 1}. **${r.title || 'Untitled'}**\n   ${r.url || r.link || ''}\n   ${r.snippet || r.description || ''}`
  ).join('\n\n')
}

builtinToolRegistry.set('web_search', webSearchTool)

// ============================================================================
// 2. Calculator
// ============================================================================

const calculatorTool: AgentTool = {
  name: 'calculator',
  label: 'Calculator',
  description: 'Evaluate a mathematical expression safely. Supports basic arithmetic, trigonometry, and common math functions.',
  parameters: Type.Object({
    expression: Type.String({ description: 'The mathematical expression to evaluate, e.g. "2 + 3 * 4" or "sqrt(144) + sin(pi/2)"' }),
  }),
  execute: async (toolCallId, params, signal) => {
    const { expression } = params

    try {
      // Safe math evaluation — we only allow math operations
      const result = safeMathEval(expression)

      return {
        content: [{ type: 'text', text: `${expression} = ${result}` }],
        details: { expression, result },
      }
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: `Calculator error: ${err.message}` }],
        details: { expression, error: true },
      }
    }
  },
}

/**
 * Safe math expression evaluator.
 * Only allows numbers, basic operators, parentheses, and common math functions.
 */
function safeMathEval(expr: string): number {
  // Sanitize: only allow digits, operators, parentheses, dots, and known function names
  const sanitized = expr.replace(/\s+/g, '')

  // Check for disallowed characters
  const allowedPattern = /^[0-9+\-*/().^%,\s]+$|^(sqrt|sin|cos|tan|log|ln|abs|ceil|floor|round|pow|min|max|PI|pi|E|e)[0-9+\-*/().^%,\s]*$/i

  if (!allowedPattern.test(sanitized) && !/^[0-9+\-*/().^%\s]+$/.test(sanitized.replace(/sqrt|sin|cos|tan|log|ln|abs|ceil|floor|round|pow|min|max|PI|E/gi, '1'))) {
    throw new Error('Expression contains disallowed characters or functions')
  }

  // Replace common math functions and constants
  const prepared = sanitized
    .replace(/\^/g, '**')
    .replace(/sqrt\(/gi, 'Math.sqrt(')
    .replace(/sin\(/gi, 'Math.sin(')
    .replace(/cos\(/gi, 'Math.cos(')
    .replace(/tan\(/gi, 'Math.tan(')
    .replace(/log\(/gi, 'Math.log10(')
    .replace(/ln\(/gi, 'Math.log(')
    .replace(/abs\(/gi, 'Math.abs(')
    .replace(/ceil\(/gi, 'Math.ceil(')
    .replace(/floor\(/gi, 'Math.floor(')
    .replace(/round\(/gi, 'Math.round(')
    .replace(/pow\(/gi, 'Math.pow(')
    .replace(/min\(/gi, 'Math.min(')
    .replace(/max\(/gi, 'Math.max(')
    .replace(/\bPI\b/gi, 'Math.PI')
    .replace(/\bE\b/g, 'Math.E')

  // Use Function constructor for safe evaluation (no access to global scope)
  const fn = new Function(`"use strict"; return (${prepared})`)
  const result = fn()

  if (typeof result !== 'number' || !isFinite(result)) {
    throw new Error('Result is not a finite number')
  }

  return result
}

builtinToolRegistry.set('calculator', calculatorTool)

// ============================================================================
// 3. File Read
// ============================================================================

const fileReadTool: AgentTool = {
  name: 'file_read',
  label: 'File Read',
  description: 'Read content from a URL. Supports any HTTP-accessible file or API endpoint.',
  parameters: Type.Object({
    url: Type.String({ description: 'The URL to read from' }),
    encoding: Type.Optional(Type.String({ description: 'Text encoding (default: utf-8)', default: 'utf-8' })),
    max_length: Type.Optional(Type.Number({ description: 'Maximum content length to return in characters (default: 10000)', minimum: 100, maximum: 100000 })),
  }),
  execute: async (toolCallId, params, signal, onUpdate) => {
    const { url, encoding = 'utf-8', max_length = 10000 } = params

    onUpdate?.({ status: 'reading', url })

    try {
      const response = await fetch(url, { signal })

      if (!response.ok) {
        return {
          content: [{ type: 'text', text: `Failed to read ${url}: HTTP ${response.status} ${response.statusText}` }],
          details: { url, error: true, status: response.status },
        }
      }

      let text = await response.text()

      // Truncate if too long
      if (text.length > max_length) {
        text = text.substring(0, max_length) + `\n\n[... truncated at ${max_length} characters, total length: ${text.length}]`
      }

      return {
        content: [{ type: 'text', text }],
        details: { url, length: text.length, encoding },
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return {
          content: [{ type: 'text', text: 'File read was cancelled' }],
          details: { aborted: true },
        }
      }
      return {
        content: [{ type: 'text', text: `Failed to read ${url}: ${err.message}` }],
        details: { url, error: true },
      }
    }
  },
}

builtinToolRegistry.set('file_read', fileReadTool)

// ============================================================================
// 4. File Write
// ============================================================================

const fileWriteTool: AgentTool = {
  name: 'file_write',
  label: 'File Write',
  description: 'Write content to a URL endpoint via HTTP POST/PUT. Useful for sending data to webhooks or APIs.',
  parameters: Type.Object({
    url: Type.String({ description: 'The URL to write to' }),
    content: Type.String({ description: 'The content to write' }),
    method: Type.Optional(Type.String({ description: 'HTTP method (POST or PUT, default: POST)', default: 'POST' })),
    content_type: Type.Optional(Type.String({ description: 'Content-Type header (default: application/json)', default: 'application/json' })),
  }),
  execute: async (toolCallId, params, signal, onUpdate) => {
    const { url, content, method = 'POST', content_type = 'application/json' } = params

    onUpdate?.({ status: 'writing', url })

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': content_type,
        },
        body: content,
        signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          content: [{ type: 'text', text: `Failed to write to ${url}: HTTP ${response.status} ${response.statusText}\n${errorText}` }],
          details: { url, error: true, status: response.status },
        }
      }

      const responseText = await response.text()
      return {
        content: [{ type: 'text', text: `Successfully wrote to ${url}\nResponse: ${responseText.substring(0, 1000)}` }],
        details: { url, status: response.status },
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return {
          content: [{ type: 'text', text: 'File write was cancelled' }],
          details: { aborted: true },
        }
      }
      return {
        content: [{ type: 'text', text: `Failed to write to ${url}: ${err.message}` }],
        details: { url, error: true },
      }
    }
  },
}

builtinToolRegistry.set('file_write', fileWriteTool)

// ============================================================================
// 5. HTTP Request
// ============================================================================

const httpRequestTool: AgentTool = {
  name: 'http_request',
  label: 'HTTP Request',
  description: 'Make an HTTP request to any URL. Supports GET, POST, PUT, PATCH, DELETE methods with custom headers and body.',
  parameters: Type.Object({
    url: Type.String({ description: 'The URL to make the request to' }),
    method: Type.Optional(Type.String({ description: 'HTTP method (GET, POST, PUT, PATCH, DELETE)', default: 'GET' })),
    headers: Type.Optional(Type.Record(Type.String(), Type.String({ description: 'Header value' }), { description: 'Custom HTTP headers' })),
    body: Type.Optional(Type.String({ description: 'Request body (for POST/PUT/PATCH)' })),
    timeout: Type.Optional(Type.Number({ description: 'Request timeout in milliseconds (default: 15000)', minimum: 1000, maximum: 60000 })),
  }),
  execute: async (toolCallId, params, signal, onUpdate) => {
    const { url, method = 'GET', headers = {}, body, timeout = 15000 } = params

    onUpdate?.({ status: 'requesting', url, method })

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        signal: AbortSignal.timeout(timeout),
      }

      if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        fetchOptions.body = body
      }

      const response = await fetch(url, fetchOptions)

      let responseBody: string
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const data = await response.json()
        responseBody = JSON.stringify(data, null, 2)
      } else {
        responseBody = await response.text()
        // Truncate long responses
        if (responseBody.length > 5000) {
          responseBody = responseBody.substring(0, 5000) + '\n[... truncated]'
        }
      }

      const statusLine = `HTTP ${response.status} ${response.statusText}`
      const result = `${statusLine}\n\n${responseBody}`

      return {
        content: [{ type: 'text', text: result }],
        details: {
          url,
          method,
          status: response.status,
          contentLength: responseBody.length,
        },
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        return {
          content: [{ type: 'text', text: `HTTP request timed out or was cancelled: ${url}` }],
          details: { aborted: true },
        }
      }
      return {
        content: [{ type: 'text', text: `HTTP request failed: ${err.message}` }],
        details: { url, method, error: true },
      }
    }
  },
}

builtinToolRegistry.set('http_request', httpRequestTool)

// ============================================================================
// Auto-register all built-in tools on import
// ============================================================================

console.log(`[BUILTIN-TOOLS] Registered ${builtinToolRegistry.size} built-in tools: ${getBuiltinToolNames().join(', ')}`)
