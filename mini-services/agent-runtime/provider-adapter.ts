/**
 * Provider Adapter — Maps our LLMProvider DB model to pi-ai's getModel()
 *
 * Responsibilities:
 *   1. Map our provider names (openai, anthropic, google, ollama, custom, z-ai) to pi-ai provider keys
 *   2. Dynamically set API keys via environment variables before creating model objects
 *   3. Handle custom/baseUrl providers (OpenAI-compatible endpoints)
 *   4. Support creating model objects via pi-ai's getModel()
 *   5. List available providers and models via pi-ai's getProviders() / getModels()
 */

import {
  getModel,
  getProviders,
  getModels,
  registerBuiltInApiProviders,
  type Model,
} from '@earendil-works/pi-ai'
import {
  type LLMProviderConfig,
  PROVIDER_NAME_MAP,
  PROVIDER_ENV_KEY_MAP,
  type ProviderInfo,
} from './types'

// ============================================================================
// Initialize Pi-AI Built-in Providers
// ============================================================================

// Must be called before getProviders() / getModels() / getModel()
try {
  registerBuiltInApiProviders()
  console.log('[PROVIDER-ADAPTER] Registered built-in pi-ai providers')
} catch (err: any) {
  console.warn(`[PROVIDER-ADAPTER] Failed to register built-in providers: ${err.message}`)
}

// ============================================================================
// Provider Name Mapping
// ============================================================================

/**
 * Resolve our internal provider name to a pi-ai provider key.
 * Falls back to the raw name if no mapping exists (pi-ai may still support it).
 */
export function resolvePiProvider(ourProvider: string): string {
  return PROVIDER_NAME_MAP[ourProvider] ?? ourProvider
}

/**
 * Get the environment variable name that pi-ai reads for a given provider.
 */
export function getEnvKeyForProvider(piProvider: string): string {
  return PROVIDER_ENV_KEY_MAP[piProvider] ?? `${piProvider.toUpperCase()}_API_KEY`
}

// ============================================================================
// API Key Management
// ============================================================================

/**
 * Temporarily set the API key for a provider in process.env.
 * pi-ai reads API keys from environment variables.
 *
 * Returns a cleanup function that restores the original env value.
 */
export function setApiKeyForProvider(piProvider: string, apiKey: string): () => void {
  const envKey = getEnvKeyForProvider(piProvider)
  const previousValue = process.env[envKey]
  process.env[envKey] = apiKey

  return () => {
    if (previousValue === undefined) {
      delete process.env[envKey]
    } else {
      process.env[envKey] = previousValue
    }
  }
}

/**
 * Set API keys for a provider from our LLMProviderConfig.
 * Returns a cleanup function.
 */
export function setApiKeyFromConfig(config: LLMProviderConfig): () => void {
  const piProvider = resolvePiProvider(config.provider)
  const apiKey = config.apiKey

  if (!apiKey) {
    // No API key — return no-op cleanup
    return () => {}
  }

  return setApiKeyForProvider(piProvider, apiKey)
}

// ============================================================================
// Model Creation
// ============================================================================

/**
 * Create a pi-ai Model object from our LLMProviderConfig.
 *
 * This sets the API key in env, creates the model, then cleans up the env.
 * For custom providers with baseUrl, it falls back to OpenAI-compatible mode.
 */
export function createModelFromConfig(config: LLMProviderConfig): Model {
  const piProvider = resolvePiProvider(config.provider)
  const modelId = config.defaultModel || resolveDefaultModel(piProvider)
  const cleanup = setApiKeyFromConfig(config)

  try {
    const model = getModel(piProvider, modelId)

    // Handle custom baseUrl for OpenAI-compatible endpoints
    if (config.provider === 'custom' && config.baseUrl) {
      // pi-ai models typically support baseUrl override via model options
      // We attach it as a property that the runtime can use
      ;(model as any)._baseUrl = config.baseUrl
    }

    // Also handle Ollama which typically needs a baseUrl
    if (piProvider === 'ollama' && config.baseUrl) {
      ;(model as any)._baseUrl = config.baseUrl
      // Set OLLAMA base URL env var
      const prevBaseUrl = process.env.OLLAMA_API_BASE
      process.env.OLLAMA_API_BASE = config.baseUrl
      ;(model as any)._cleanupBaseUrl = () => {
        if (prevBaseUrl === undefined) {
          delete process.env.OLLAMA_API_BASE
        } else {
          process.env.OLLAMA_API_BASE = prevBaseUrl
        }
      }
    }

    return model
  } finally {
    // Clean up env after model creation
    // Note: pi-ai may need the key during streaming, so we keep it set
    // The runtime.ts will handle final cleanup when the run completes
    // For now, don't clean up — the runtime manages the lifecycle
  }
}

/**
 * Create a pi-ai Model object with API key set persistently for a run.
 * Returns both the model and a cleanup function.
 */
export function createModelForRun(config: LLMProviderConfig): { model: Model; cleanup: () => void } {
  const piProvider = resolvePiProvider(config.provider)
  const modelId = config.defaultModel || resolveDefaultModel(piProvider)

  // Set API key (will remain for duration of run)
  const keyCleanup = setApiKeyFromConfig(config)

  // Set base URL if needed
  let baseUrlCleanup: (() => void) | null = null
  if ((config.provider === 'custom' || piProvider === 'ollama') && config.baseUrl) {
    if (piProvider === 'ollama') {
      const prev = process.env.OLLAMA_API_BASE
      process.env.OLLAMA_API_BASE = config.baseUrl
      baseUrlCleanup = () => {
        if (prev === undefined) delete process.env.OLLAMA_API_BASE
        else process.env.OLLAMA_API_BASE = prev
      }
    } else if (config.provider === 'custom') {
      // For custom providers using OpenAI-compatible API, set OPENAI_BASE_URL
      const prev = process.env.OPENAI_BASE_URL
      process.env.OPENAI_BASE_URL = config.baseUrl
      baseUrlCleanup = () => {
        if (prev === undefined) delete process.env.OPENAI_BASE_URL
        else process.env.OPENAI_BASE_URL = prev
      }
    }
  }

  try {
    const model = getModel(piProvider, modelId)

    const cleanup = () => {
      keyCleanup()
      baseUrlCleanup?.()
    }

    return { model, cleanup }
  } catch (err) {
    // If model creation fails, clean up immediately
    keyCleanup()
    baseUrlCleanup?.()
    throw err
  }
}

/**
 * Resolve a sensible default model ID for a provider.
 * Used when no defaultModel is specified in the provider config.
 */
function resolveDefaultModel(piProvider: string): string {
  const defaults: Record<string, string> = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-sonnet-4-20250514',
    google: 'gemini-2.0-flash',
    deepseek: 'deepseek-chat',
    ollama: 'llama3.2',
    openrouter: 'openai/gpt-4o-mini',
    groq: 'llama-3.1-8b-instant',
    mistral: 'mistral-small-latest',
    xai: 'grok-2-mini',
    together: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    fireworks: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
    zai: 'glm-4-flash',
  }
  return defaults[piProvider] ?? 'gpt-4o-mini'
}

// ============================================================================
// Provider & Model Discovery (static data + on-demand loading)
// ============================================================================

// Static provider data - doesn't require pi-ai calls at runtime
// pi-ai getProviders()/getModels() calls are available but may cause
// stability issues in some environments, so we use static data by default

const STATIC_PROVIDERS: ProviderInfo[] = [
  { id: 'openai', name: 'OpenAI', envKey: 'OPENAI_API_KEY', configured: !!process.env.OPENAI_API_KEY },
  { id: 'anthropic', name: 'Anthropic', envKey: 'ANTHROPIC_API_KEY', configured: !!process.env.ANTHROPIC_API_KEY },
  { id: 'google', name: 'Google Gemini', envKey: 'GOOGLE_GENERATIVE_AI_API_KEY', configured: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY },
  { id: 'deepseek', name: 'DeepSeek', envKey: 'DEEPSEEK_API_KEY', configured: !!process.env.DEEPSEEK_API_KEY },
  { id: 'groq', name: 'Groq', envKey: 'GROQ_API_KEY', configured: !!process.env.GROQ_API_KEY },
  { id: 'mistral', name: 'Mistral', envKey: 'MISTRAL_API_KEY', configured: !!process.env.MISTRAL_API_KEY },
  { id: 'xai', name: 'xAI', envKey: 'XAI_API_KEY', configured: !!process.env.XAI_API_KEY },
  { id: 'openrouter', name: 'OpenRouter', envKey: 'OPENROUTER_API_KEY', configured: !!process.env.OPENROUTER_API_KEY },
  { id: 'together', name: 'Together AI', envKey: 'TOGETHER_AI_API_KEY', configured: !!process.env.TOGETHER_AI_API_KEY },
  { id: 'fireworks', name: 'Fireworks AI', envKey: 'FIREWORKS_API_KEY', configured: !!process.env.FIREWORKS_API_KEY },
  { id: 'ollama', name: 'Ollama', envKey: 'OLLAMA_API_KEY', configured: !!process.env.OLLAMA_API_KEY },
  { id: 'zai', name: 'Z AI', envKey: 'ZAI_API_KEY', configured: !!process.env.ZAI_API_KEY },
  { id: 'amazon-bedrock', name: 'Amazon Bedrock', envKey: 'AWS_ACCESS_KEY_ID', configured: !!process.env.AWS_ACCESS_KEY_ID },
  { id: 'azure-openai-responses', name: 'Azure OpenAI', envKey: 'AZURE_OPENAI_API_KEY', configured: !!process.env.AZURE_OPENAI_API_KEY },
  { id: 'google-vertex', name: 'Google Vertex AI', envKey: 'GOOGLE_APPLICATION_CREDENTIALS', configured: !!process.env.GOOGLE_APPLICATION_CREDENTIALS },
  { id: 'cerebras', name: 'Cerebras', envKey: 'CEREBRAS_API_KEY', configured: !!process.env.CEREBRAS_API_KEY },
  { id: 'huggingface', name: 'Hugging Face', envKey: 'HUGGINGFACE_API_KEY', configured: !!process.env.HUGGINGFACE_API_KEY },
]

// Cached model data (populated on first request)
const cachedModels = new Map<string, any[]>()

// Static model data for common providers to avoid runtime crashes
// These are the most commonly used models per provider
const STATIC_MODELS: Record<string, any[]> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', api: 'openai-responses', reasoning: false, contextWindow: 128000, maxOutputTokens: 16384 },
    { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai', api: 'openai-responses', reasoning: false, contextWindow: 128000, maxOutputTokens: 16384 },
    { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', api: 'openai-responses', reasoning: false, contextWindow: 1047576, maxOutputTokens: 32768 },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', provider: 'openai', api: 'openai-responses', reasoning: false, contextWindow: 1047576, maxOutputTokens: 32768 },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 nano', provider: 'openai', api: 'openai-responses', reasoning: false, contextWindow: 1047576, maxOutputTokens: 32768 },
    { id: 'o3', name: 'o3', provider: 'openai', api: 'openai-responses', reasoning: true, contextWindow: 200000, maxOutputTokens: 100000 },
    { id: 'o4-mini', name: 'o4-mini', provider: 'openai', api: 'openai-responses', reasoning: true, contextWindow: 200000, maxOutputTokens: 100000 },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', api: 'anthropic-messages', reasoning: false, contextWindow: 200000, maxOutputTokens: 16384 },
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', provider: 'anthropic', api: 'anthropic-messages', reasoning: true, contextWindow: 200000, maxOutputTokens: 16384 },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', api: 'anthropic-messages', reasoning: false, contextWindow: 200000, maxOutputTokens: 8192 },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', api: 'anthropic-messages', reasoning: false, contextWindow: 200000, maxOutputTokens: 8192 },
  ],
  google: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', api: 'google-generative-ai', reasoning: true, contextWindow: 1048576, maxOutputTokens: 65536 },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', api: 'google-generative-ai', reasoning: true, contextWindow: 1048576, maxOutputTokens: 65536 },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', api: 'google-generative-ai', reasoning: false, contextWindow: 1048576, maxOutputTokens: 8192 },
  ],
  deepseek: [
    { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'deepseek', api: 'openai-completions', reasoning: false, contextWindow: 128000, maxOutputTokens: 16384 },
    { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'deepseek', api: 'openai-completions', reasoning: true, contextWindow: 128000, maxOutputTokens: 16384 },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', api: 'openai-completions', reasoning: false, contextWindow: 128000, maxOutputTokens: 32768 },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'groq', api: 'openai-completions', reasoning: false, contextWindow: 128000, maxOutputTokens: 8192 },
  ],
  ollama: [
    { id: 'llama3.1', name: 'Llama 3.1', provider: 'ollama', api: 'openai-completions', reasoning: false, contextWindow: 128000, maxOutputTokens: 4096 },
    { id: 'qwen2.5', name: 'Qwen 2.5', provider: 'ollama', api: 'openai-completions', reasoning: false, contextWindow: 128000, maxOutputTokens: 4096 },
  ],
  openrouter: [
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openrouter', api: 'openai-completions', reasoning: false, contextWindow: 128000, maxOutputTokens: 16384 },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'openrouter', api: 'openai-completions', reasoning: false, contextWindow: 200000, maxOutputTokens: 8192 },
  ],
  zai: [
    { id: 'glm-4-flash', name: 'GLM-4 Flash', provider: 'zai', api: 'openai-completions', reasoning: false, contextWindow: 128000, maxOutputTokens: 4096 },
  ],
}

/**
 * Pre-load provider data at startup.
 * Only loads the static provider list; model data is loaded on demand.
 */
export function preloadProviderData(): void {
  console.log(`[PROVIDER-ADAPTER] Using ${STATIC_PROVIDERS.length} static providers`)
}

/**
 * List all supported providers with their configuration status.
 */
export function listProviders(): ProviderInfo[] {
  return STATIC_PROVIDERS
}

/**
 * List available models for a given provider.
 * Models are loaded on first request and cached.
 * Returns empty array if the provider is not available.
 */
export function listModelsForProvider(piProvider: string): any[] {
  if (cachedModels.has(piProvider)) {
    return cachedModels.get(piProvider)!
  }

  // Use static model data to avoid crashes from pi-ai getModels()
  // which may have issues with certain providers in Bun runtime
  const staticModels = STATIC_MODELS[piProvider]
  if (staticModels) {
    cachedModels.set(piProvider, staticModels)
    return staticModels
  }

  // Try pi-ai getModels for providers not in our static list
  try {
    const models = getModels(piProvider)
    if (!Array.isArray(models)) {
      cachedModels.set(piProvider, [])
      return []
    }
    // Extract only safe, serializable fields from model objects
    const safeModels = models.map((m: any) => {
      try {
        return {
          id: m.id || m.modelId || '',
          name: m.name || m.id || '',
          provider: m.provider || piProvider,
          api: m.api || '',
          reasoning: !!m.reasoning,
          contextWindow: m.contextWindow || m.maxContextTokens || null,
          maxOutputTokens: m.maxOutputTokens || null,
        }
      } catch {
        return { id: 'unknown', name: 'Unknown', provider: piProvider, api: '' }
      }
    })
    cachedModels.set(piProvider, safeModels)
    return safeModels
  } catch (err: any) {
    console.warn(`[PROVIDER] Failed to list models for ${piProvider}: ${err.message}`)
    cachedModels.set(piProvider, [])
    return []
  }
}

/**
 * Format a provider key into a human-readable name.
 */
function formatProviderName(id: string): string {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    'openai-codex': 'OpenAI Codex',
    anthropic: 'Anthropic',
    google: 'Google Gemini',
    'google-vertex': 'Google Vertex AI',
    'amazon-bedrock': 'Amazon Bedrock',
    'azure-openai-responses': 'Azure OpenAI',
    deepseek: 'DeepSeek',
    ollama: 'Ollama',
    openrouter: 'OpenRouter',
    groq: 'Groq',
    mistral: 'Mistral',
    xai: 'xAI',
    together: 'Together AI',
    fireworks: 'Fireworks AI',
    zai: 'Z AI',
    cerebras: 'Cerebras',
    'cloudflare-ai-gateway': 'Cloudflare AI Gateway',
    'cloudflare-workers-ai': 'Cloudflare Workers AI',
    'github-copilot': 'GitHub Copilot',
    huggingface: 'Hugging Face',
    'kimi-coding': 'Kimi Coding',
    minimax: 'MiniMax',
    'minimax-cn': 'MiniMax (CN)',
    moonshotai: 'Moonshot AI',
    'moonshotai-cn': 'Moonshot AI (CN)',
    opencode: 'OpenCode',
    'opencode-go': 'OpenCode Go',
    'vercel-ai-gateway': 'Vercel AI Gateway',
    xiaomi: 'Xiaomi',
    'xiaomi-token-plan-ams': 'Xiaomi Token (AMS)',
    'xiaomi-token-plan-cn': 'Xiaomi Token (CN)',
    'xiaomi-token-plan-sgp': 'Xiaomi Token (SGP)',
  }
  return names[id] ?? id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// ============================================================================
// Config Parsing Helpers
// ============================================================================

/**
 * Parse the JSON config string from LLMProvider into structured data.
 */
export function parseProviderConfig(configStr: string): {
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
} {
  try {
    return JSON.parse(configStr || '{}')
  } catch {
    return {}
  }
}

/**
 * Parse the JSON models array from LLMProvider.
 */
export function parseModels(modelsStr: string): string[] {
  try {
    return JSON.parse(modelsStr || '[]')
  } catch {
    return []
  }
}
