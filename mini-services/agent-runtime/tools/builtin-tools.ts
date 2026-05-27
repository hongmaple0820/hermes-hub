// ============================================================
// Hermes Agent Runtime 2.0 — Built-in Tool Implementations
// ============================================================

import type { BuiltinToolImplementation, ExecutionContext, ToolResult } from '../types'

// ---------------------------------------------------------------------------
// 1. web_search — Returns mock search results (placeholder)
// ---------------------------------------------------------------------------
export const webSearchTool: BuiltinToolImplementation = {
  name: 'web_search',
  description: 'Search the web for information. Returns relevant search results.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query string' },
      count: { type: 'number', description: 'Number of results to return (default: 5)', default: 5 },
    },
    required: ['query'],
  },
  async execute(params: { query: string; count?: number }, _context: ExecutionContext): Promise<ToolResult> {
    const start = Date.now()
    const count = params.count || 5
    // Mock search results — in production this would call a real search API
    const results = Array.from({ length: Math.min(count, 10) }, (_, i) => ({
      title: `Search result ${i + 1} for "${params.query}"`,
      url: `https://example.com/result-${i + 1}`,
      snippet: `This is a mock search result for the query "${params.query}". In production, this would contain a real snippet from the web page.`,
    }))
    return {
      success: true,
      data: { query: params.query, results, totalResults: count },
      duration_ms: Date.now() - start,
    }
  },
}

// ---------------------------------------------------------------------------
// 2. calculator — Evaluates math expressions safely
// ---------------------------------------------------------------------------
export const calculatorTool: BuiltinToolImplementation = {
  name: 'calculator',
  description: 'Evaluate mathematical expressions. Supports basic arithmetic, trigonometric functions, and more.',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'The mathematical expression to evaluate (e.g., "2 + 3 * 4", "Math.sqrt(16)")' },
    },
    required: ['expression'],
  },
  async execute(params: { expression: string }, _context: ExecutionContext): Promise<ToolResult> {
    const start = Date.now()
    try {
      // Safe math evaluation — only allow numeric and math operations
      const sanitized = params.expression
        .replace(/[^0-9+\-*/().%\s^eE]/g, '') // Allow only safe characters
        .replace(/\^/g, '**')                    // Convert ^ to ** for exponentiation

      if (!sanitized.trim()) {
        return { success: false, error: 'Invalid expression', duration_ms: Date.now() - start }
      }

      // Use Function constructor for safe evaluation with only Math context
      const mathScope = {
        abs: Math.abs, ceil: Math.ceil, floor: Math.floor, round: Math.round,
        sqrt: Math.sqrt, pow: Math.pow, min: Math.min, max: Math.max,
        sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log,
        log2: Math.log2, log10: Math.log10, PI: Math.PI, E: Math.E,
        random: Math.random,
      }
      const fn = new Function(...Object.keys(mathScope), `"use strict"; return (${sanitized})`)
      const result = fn(...Object.values(mathScope))

      return {
        success: true,
        data: { expression: params.expression, result: Number(result) },
        duration_ms: Date.now() - start,
      }
    } catch (err: any) {
      return {
        success: false,
        error: `Calculation error: ${err.message}`,
        duration_ms: Date.now() - start,
      }
    }
  },
}

// ---------------------------------------------------------------------------
// 3. file_read — Returns mock file content
// ---------------------------------------------------------------------------
export const fileReadTool: BuiltinToolImplementation = {
  name: 'file_read',
  description: 'Read the content of a file. Returns the file content as a string.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'The path of the file to read' },
      encoding: { type: 'string', description: 'File encoding (default: utf-8)', default: 'utf-8' },
    },
    required: ['path'],
  },
  async execute(params: { path: string; encoding?: string }, _context: ExecutionContext): Promise<ToolResult> {
    const start = Date.now()
    // Mock file read — in production this would read from the file system or storage
    return {
      success: true,
      data: {
        path: params.path,
        encoding: params.encoding || 'utf-8',
        content: `[Mock file content] This is the content of "${params.path}". In production, this would return the actual file content.`,
        size: 256,
        lastModified: new Date().toISOString(),
      },
      duration_ms: Date.now() - start,
    }
  },
}

// ---------------------------------------------------------------------------
// 4. file_write — Returns mock success
// ---------------------------------------------------------------------------
export const fileWriteTool: BuiltinToolImplementation = {
  name: 'file_write',
  description: 'Write content to a file. Creates the file if it does not exist.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'The path of the file to write' },
      content: { type: 'string', description: 'The content to write to the file' },
      append: { type: 'boolean', description: 'Whether to append to the file (default: false)', default: false },
    },
    required: ['path', 'content'],
  },
  async execute(params: { path: string; content: string; append?: boolean }, _context: ExecutionContext): Promise<ToolResult> {
    const start = Date.now()
    // Mock file write — in production this would write to the file system or storage
    return {
      success: true,
      data: {
        path: params.path,
        bytesWritten: Buffer.byteLength(params.content, 'utf-8'),
        append: params.append || false,
        writtenAt: new Date().toISOString(),
      },
      duration_ms: Date.now() - start,
    }
  },
}

// ---------------------------------------------------------------------------
// 5. http_request — Makes actual HTTP requests
// ---------------------------------------------------------------------------
export const httpRequestTool: BuiltinToolImplementation = {
  name: 'http_request',
  description: 'Make an HTTP request to a specified URL. Supports GET, POST, PUT, DELETE methods.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to make the request to' },
      method: { type: 'string', description: 'HTTP method (GET, POST, PUT, DELETE)', enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
      headers: { type: 'object', description: 'HTTP headers as key-value pairs', default: {} },
      body: { type: 'string', description: 'Request body (for POST/PUT)' },
      timeout: { type: 'number', description: 'Request timeout in milliseconds (default: 10000)', default: 10000 },
    },
    required: ['url'],
  },
  async execute(params: {
    url: string
    method?: string
    headers?: Record<string, string>
    body?: string
    timeout?: number
  }, _context: ExecutionContext): Promise<ToolResult> {
    const start = Date.now()
    try {
      const method = (params.method || 'GET').toUpperCase()
      const timeout = params.timeout || 10000

      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...params.headers,
        },
        signal: AbortSignal.timeout(timeout),
      }

      if (method === 'POST' || method === 'PUT') {
        fetchOptions.body = params.body || ''
      }

      const response = await fetch(params.url, fetchOptions)
      const contentType = response.headers.get('content-type') || ''
      let data: any

      if (contentType.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }

      return {
        success: response.ok,
        data: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: data,
        },
        duration_ms: Date.now() - start,
      }
    } catch (err: any) {
      return {
        success: false,
        error: `HTTP request failed: ${err.message}`,
        duration_ms: Date.now() - start,
      }
    }
  },
}

// ---------------------------------------------------------------------------
// Registry of all built-in tools
// ---------------------------------------------------------------------------
export const builtinTools: BuiltinToolImplementation[] = [
  webSearchTool,
  calculatorTool,
  fileReadTool,
  fileWriteTool,
  httpRequestTool,
]

export function getBuiltinTool(name: string): BuiltinToolImplementation | undefined {
  return builtinTools.find(t => t.name === name)
}
