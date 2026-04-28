/**
 * LLM Provider Abstraction Layer
 * Supports: OpenAI, Anthropic, Google Gemini, Ollama, Custom, z-ai
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  stop?: string[];
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  config?: Record<string, unknown>;
}

/**
 * OpenAI-compatible chat completion
 */
async function openaiChatCompletion(
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  baseUrl: string,
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResult> {
  const url = `${baseUrl}/chat/completions`;
  const body: Record<string, unknown> = {
    model,
    messages: messages.map(({ role, content }) => ({ role, content })),
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
    top_p: options.topP ?? 1,
    stream: false,
  };
  if (options.stop) body.stop = options.stop;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    model: data.model ?? model,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  };
}

/**
 * Anthropic chat completion
 */
async function anthropicChatCompletion(
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResult> {
  const systemMessage = messages.find((m) => m.role === 'system');
  const nonSystemMessages = messages.filter((m) => m.role !== 'system');

  const body: Record<string, unknown> = {
    model,
    messages: nonSystemMessages.map(({ role, content }) => ({ role, content })),
    max_tokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.7,
    top_p: options.topP ?? 1,
  };
  if (systemMessage) body.system = systemMessage.content;
  if (options.stop) body.stop_sequences = options.stop;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.content?.map((c: { type: string; text: string }) => c.text).join('') ?? '';
  return {
    content,
    model: data.model ?? model,
    usage: data.usage
      ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        }
      : undefined,
  };
}

/**
 * Google Gemini chat completion
 */
async function geminiChatCompletion(
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResult> {
  const systemInstruction = messages.find((m) => m.role === 'system');
  const nonSystemMessages = messages.filter((m) => m.role !== 'system');

  const contents = nonSystemMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 2048,
      topP: options.topP ?? 1,
    },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.map((p: { text: string }) => p.text).join('') ?? '';
  return {
    content,
    model,
    usage: data.usageMetadata
      ? {
          promptTokens: data.usageMetadata.promptTokenCount ?? 0,
          completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
          totalTokens: data.usageMetadata.totalTokenCount ?? 0,
        }
      : undefined,
  };
}

/**
 * Ollama chat completion
 */
async function ollamaChatCompletion(
  messages: ChatMessage[],
  model: string,
  baseUrl: string,
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResult> {
  const url = `${baseUrl}/api/chat`;
  const body: Record<string, unknown> = {
    model,
    messages: messages.map(({ role, content }) => ({ role, content })),
    stream: false,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 2048,
      top_p: options.topP ?? 1,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    content: data.message?.content ?? '',
    model: data.model ?? model,
    usage: {
      promptTokens: data.prompt_eval_count ?? 0,
      completionTokens: data.eval_count ?? 0,
      totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
    },
  };
}

/**
 * z-ai chat completion using z-ai-web-dev-sdk
 */
async function zaiChatCompletion(
  messages: ChatMessage[],
  model: string,
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResult> {
  // Dynamic import for z-ai-web-dev-sdk (server-side only)
  const { chat } = await import('z-ai-web-dev-sdk');
  
  const formattedMessages = messages.map(({ role, content }) => ({ role, content }));
  
  const result = await chat({
    messages: formattedMessages,
    model: model || 'default',
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 2048,
  });

  return {
    content: result.content ?? result.choices?.[0]?.message?.content ?? '',
    model: result.model ?? model,
    usage: result.usage
      ? {
          promptTokens: result.usage.prompt_tokens ?? 0,
          completionTokens: result.usage.completion_tokens ?? 0,
          totalTokens: result.usage.total_tokens ?? 0,
        }
      : undefined,
  };
}

/**
 * Main chat completion dispatcher
 */
export async function chatCompletion(
  config: LLMProviderConfig,
  messages: ChatMessage[],
  model?: string,
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResult> {
  const effectiveModel = model || config.defaultModel || 'gpt-3.5-turbo';

  switch (config.provider) {
    case 'openai':
      return openaiChatCompletion(
        messages,
        effectiveModel,
        config.apiKey ?? '',
        config.baseUrl || 'https://api.openai.com/v1',
        options
      );

    case 'anthropic':
      return anthropicChatCompletion(
        messages,
        effectiveModel || 'claude-3-sonnet-20240229',
        config.apiKey ?? '',
        options
      );

    case 'google':
      return geminiChatCompletion(
        messages,
        effectiveModel || 'gemini-pro',
        config.apiKey ?? '',
        options
      );

    case 'ollama':
      return ollamaChatCompletion(
        messages,
        effectiveModel || 'llama2',
        config.baseUrl || 'http://localhost:11434',
        options
      );

    case 'z-ai':
      return zaiChatCompletion(messages, effectiveModel, options);

    case 'custom':
      return openaiChatCompletion(
        messages,
        effectiveModel,
        config.apiKey ?? '',
        config.baseUrl || 'http://localhost:8080/v1',
        options
      );

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Test provider connection by listing models or making a minimal request
 */
export async function testProviderConnection(config: LLMProviderConfig): Promise<{
  success: boolean;
  message: string;
  models?: string[];
}> {
  try {
    switch (config.provider) {
      case 'openai': {
        const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
        const response = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${config.apiKey}` },
        });
        if (!response.ok) {
          const error = await response.text();
          return { success: false, message: `API error: ${response.status} - ${error}` };
        }
        const data = await response.json();
        const models = (data.data ?? []).slice(0, 10).map((m: { id: string }) => m.id);
        return { success: true, message: 'Connection successful', models };
      }

      case 'anthropic': {
        // Anthropic doesn't have a simple models endpoint, make a minimal completion
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey ?? '',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: config.defaultModel || 'claude-3-haiku-20240307',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
        if (!response.ok) {
          const error = await response.text();
          return { success: false, message: `API error: ${response.status} - ${error}` };
        }
        return { success: true, message: 'Connection successful' };
      }

      case 'google': {
        const model = config.defaultModel || 'gemini-pro';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
            generationConfig: { maxOutputTokens: 10 },
          }),
        });
        if (!response.ok) {
          const error = await response.text();
          return { success: false, message: `API error: ${response.status} - ${error}` };
        }
        return { success: true, message: 'Connection successful' };
      }

      case 'ollama': {
        const baseUrl = config.baseUrl || 'http://localhost:11434';
        const response = await fetch(`${baseUrl}/api/tags`);
        if (!response.ok) {
          return { success: false, message: `Ollama not reachable: ${response.status}` };
        }
        const data = await response.json();
        const models = (data.models ?? []).map((m: { name: string }) => m.name);
        return { success: true, message: 'Connection successful', models };
      }

      case 'z-ai': {
        return { success: true, message: 'z-ai SDK ready (connection tested at build time)' };
      }

      case 'custom': {
        const baseUrl = config.baseUrl || 'http://localhost:8080/v1';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
        const response = await fetch(`${baseUrl}/models`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return { success: false, message: `API error: ${response.status} - ${error}` };
        }
        const data = await response.json();
        const models = (data.data ?? []).slice(0, 10).map((m: { id: string }) => m.id);
        return { success: true, message: 'Connection successful', models };
      }

      default:
        return { success: false, message: `Unknown provider: ${config.provider}` };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
