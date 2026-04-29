import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const DEFAULT_SKILLS = [
  {
    name: 'web-search',
    displayName: 'Web Search',
    description: 'Search the web for real-time information, news, and data. Returns relevant results with sources.',
    category: 'communication',
    icon: 'Search',
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'query', type: 'string', required: true, description: 'Search query string' },
      { name: 'maxResults', type: 'number', required: false, description: 'Maximum number of results (default: 5)' },
      { name: 'language', type: 'string', required: false, description: 'Language code for results (e.g., en, zh)' },
    ]),
    events: JSON.stringify(['message', 'command']),
  },
  {
    name: 'weather-query',
    displayName: 'Weather Query',
    description: 'Get current weather information and forecasts for any location worldwide.',
    category: 'utility',
    icon: 'CloudSun',
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'location', type: 'string', required: true, description: 'City or location name' },
      { name: 'unit', type: 'string', required: false, description: 'Temperature unit (celsius/fahrenheit)', enum: ['celsius', 'fahrenheit'] },
      { name: 'forecast', type: 'boolean', required: false, description: 'Include 5-day forecast' },
    ]),
    events: JSON.stringify(['message']),
  },
  {
    name: 'code-execution',
    displayName: 'Code Execution',
    description: 'Execute code in various programming languages (Python, JavaScript, etc.) and return the output.',
    category: 'development',
    icon: 'Code',
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'code', type: 'string', required: true, description: 'Source code to execute' },
      { name: 'language', type: 'string', required: true, description: 'Programming language', enum: ['python', 'javascript', 'typescript', 'bash', 'rust', 'go'] },
      { name: 'timeout', type: 'number', required: false, description: 'Execution timeout in seconds (default: 30)' },
    ]),
    events: JSON.stringify(['message', 'command', 'tool_result']),
  },
  {
    name: 'image-generation',
    displayName: 'Image Generation',
    description: 'Generate images from text descriptions using AI image generation models.',
    category: 'media',
    icon: 'Image',
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'prompt', type: 'string', required: true, description: 'Image description/prompt' },
      { name: 'size', type: 'string', required: false, description: 'Image size (e.g., 1024x1024, 512x512)', enum: ['256x256', '512x512', '1024x1024'] },
      { name: 'style', type: 'string', required: false, description: 'Image style (natural, vivid)', enum: ['natural', 'vivid'] },
      { name: 'quality', type: 'string', required: false, description: 'Image quality (standard, hd)', enum: ['standard', 'hd'] },
    ]),
    events: JSON.stringify(['message', 'command']),
  },
  {
    name: 'document-processing',
    displayName: 'Document Processing',
    description: 'Read, write, and process documents in various formats (PDF, Word, Excel, etc.).',
    category: 'productivity',
    icon: 'FileText',
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'action', type: 'string', required: true, description: 'Action to perform', enum: ['read', 'write', 'convert', 'summarize', 'extract'] },
      { name: 'fileUrl', type: 'string', required: false, description: 'URL or path of the document' },
      { name: 'format', type: 'string', required: false, description: 'Output format (pdf, docx, xlsx, txt, md)', enum: ['pdf', 'docx', 'xlsx', 'txt', 'md'] },
      { name: 'content', type: 'string', required: false, description: 'Content to write (for write action)' },
    ]),
    events: JSON.stringify(['message', 'tool_result']),
  },
  {
    name: 'translation',
    displayName: 'Translation',
    description: 'Translate text between languages with high accuracy, supporting 100+ languages.',
    category: 'communication',
    icon: 'Languages',
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'text', type: 'string', required: true, description: 'Text to translate' },
      { name: 'targetLang', type: 'string', required: true, description: 'Target language code (e.g., en, zh, ja, ko)' },
      { name: 'sourceLang', type: 'string', required: false, description: 'Source language code (auto-detect if omitted)' },
      { name: 'formality', type: 'string', required: false, description: 'Formality level', enum: ['formal', 'informal'] },
    ]),
    events: JSON.stringify(['message']),
  },
  {
    name: 'reminder',
    displayName: 'Reminder',
    description: 'Set reminders and scheduled notifications. Supports one-time and recurring reminders.',
    category: 'productivity',
    icon: 'Bell',
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'message', type: 'string', required: true, description: 'Reminder message' },
      { name: 'time', type: 'string', required: true, description: 'When to remind (ISO date or natural language)' },
      { name: 'repeat', type: 'string', required: false, description: 'Repeat interval', enum: ['daily', 'weekly', 'monthly', 'yearly'] },
      { name: 'priority', type: 'string', required: false, description: 'Priority level', enum: ['low', 'medium', 'high'] },
    ]),
    events: JSON.stringify(['message', 'command', 'status']),
  },
  {
    name: 'http-request',
    displayName: 'HTTP Request',
    description: 'Make HTTP requests to any API endpoint. Supports GET, POST, PUT, DELETE methods.',
    category: 'development',
    icon: 'Globe',
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'url', type: 'string', required: true, description: 'Request URL' },
      { name: 'method', type: 'string', required: true, description: 'HTTP method', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
      { name: 'headers', type: 'object', required: false, description: 'Request headers as key-value pairs' },
      { name: 'body', type: 'object', required: false, description: 'Request body (for POST/PUT/PATCH)' },
      { name: 'timeout', type: 'number', required: false, description: 'Request timeout in seconds (default: 30)' },
    ]),
    events: JSON.stringify(['message', 'command', 'tool_result']),
  },
  {
    name: 'data-analysis',
    displayName: 'Data Analysis',
    description: 'Analyze datasets, generate statistics, create visualizations, and extract insights from data.',
    category: 'data',
    icon: 'BarChart3',
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'data', type: 'string', required: true, description: 'Data source (URL, CSV text, or file reference)' },
      { name: 'analysis', type: 'string', required: true, description: 'Type of analysis', enum: ['summary', 'trend', 'comparison', 'correlation', 'outlier'] },
      { name: 'visualize', type: 'boolean', required: false, description: 'Generate visualization (default: false)' },
      { name: 'format', type: 'string', required: false, description: 'Output format', enum: ['text', 'json', 'chart', 'table'] },
    ]),
    events: JSON.stringify(['message', 'tool_result']),
  },
  {
    name: 'email-sender',
    displayName: 'Email Sender',
    description: 'Send emails to specified recipients with customizable subject and content.',
    category: 'communication',
    icon: 'Mail',
    handlerType: 'webhook',
    parameters: JSON.stringify([
      { name: 'to', type: 'string', required: true, description: 'Recipient email address' },
      { name: 'subject', type: 'string', required: true, description: 'Email subject line' },
      { name: 'body', type: 'string', required: true, description: 'Email content (plain text or HTML)' },
      { name: 'cc', type: 'string', required: false, description: 'CC recipients (comma-separated)' },
      { name: 'html', type: 'boolean', required: false, description: 'Whether body is HTML (default: false)' },
    ]),
    events: JSON.stringify(['message', 'command', 'status']),
  },
  {
    name: 'text-to-speech',
    displayName: 'Text to Speech',
    description: 'Convert text to natural-sounding speech in multiple languages and voices.',
    category: 'media',
    icon: 'Volume2',
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'text', type: 'string', required: true, description: 'Text to convert to speech' },
      { name: 'voice', type: 'string', required: false, description: 'Voice selection (e.g., alloy, echo, fable)', enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] },
      { name: 'language', type: 'string', required: false, description: 'Language code (e.g., en, zh)' },
      { name: 'speed', type: 'number', required: false, description: 'Speech speed (0.5-2.0, default: 1.0)' },
    ]),
    events: JSON.stringify(['message']),
  },
  {
    name: 'database-query',
    displayName: 'Database Query',
    description: 'Execute SQL queries against configured databases and return results.',
    category: 'data',
    icon: 'Database',
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'query', type: 'string', required: true, description: 'SQL query to execute' },
      { name: 'database', type: 'string', required: false, description: 'Database connection name or identifier' },
      { name: 'limit', type: 'number', required: false, description: 'Maximum rows to return (default: 100)' },
      { name: 'dryRun', type: 'boolean', required: false, description: 'Validate query without executing (default: false)' },
    ]),
    events: JSON.stringify(['message', 'command', 'tool_result']),
  },
];

export async function POST() {
  try {
    let created = 0;
    let skipped = 0;

    for (const skillData of DEFAULT_SKILLS) {
      const existing = await db.skill.findUnique({
        where: { name: skillData.name },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await db.skill.create({ data: skillData });
      created++;
    }

    return NextResponse.json({
      message: `Skills seeded: ${created} created, ${skipped} already existed`,
      created,
      skipped,
      total: DEFAULT_SKILLS.length,
    });
  } catch (error) {
    console.error('Seed skills error:', error);
    return NextResponse.json(
      { error: 'Failed to seed skills', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
