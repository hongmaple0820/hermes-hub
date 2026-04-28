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
      { name: 'query', type: 'string', required: true, description: 'Search query' },
      { name: 'maxResults', type: 'number', required: false, description: 'Maximum number of results (default: 5)' },
    ]),
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
      { name: 'unit', type: 'string', required: false, description: 'Temperature unit (celsius/fahrenheit)' },
    ]),
  },
  {
    name: 'code-execution',
    displayName: 'Code Execution',
    description: 'Execute code in various programming languages (Python, JavaScript, etc.) and return the output.',
    category: 'development',
    icon: 'Code',
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'code', type: 'string', required: true, description: 'Code to execute' },
      { name: 'language', type: 'string', required: true, description: 'Programming language' },
    ]),
  },
  {
    name: 'image-generation',
    displayName: 'Image Generation',
    description: 'Generate images from text descriptions using AI image generation models.',
    category: 'media',
    icon: 'Image',
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'prompt', type: 'string', required: true, description: 'Image description' },
      { name: 'size', type: 'string', required: false, description: 'Image size (e.g., 1024x1024)' },
    ]),
  },
  {
    name: 'document-processing',
    displayName: 'Document Processing',
    description: 'Read, write, and process documents in various formats (PDF, Word, Excel, etc.).',
    category: 'productivity',
    icon: 'FileText',
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'action', type: 'string', required: true, description: 'Action: read, write, convert, summarize' },
      { name: 'fileUrl', type: 'string', required: false, description: 'URL of the document' },
    ]),
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
      { name: 'targetLang', type: 'string', required: true, description: 'Target language code' },
      { name: 'sourceLang', type: 'string', required: false, description: 'Source language code (auto-detect if omitted)' },
    ]),
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
      { name: 'repeat', type: 'string', required: false, description: 'Repeat interval (daily, weekly, monthly)' },
    ]),
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
      { name: 'method', type: 'string', required: true, description: 'HTTP method' },
      { name: 'headers', type: 'object', required: false, description: 'Request headers' },
      { name: 'body', type: 'object', required: false, description: 'Request body' },
    ]),
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
      { name: 'analysis', type: 'string', required: true, description: 'Type of analysis (summary, trend, comparison, etc.)' },
    ]),
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
      { name: 'subject', type: 'string', required: true, description: 'Email subject' },
      { name: 'body', type: 'string', required: true, description: 'Email content' },
    ]),
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
      { name: 'voice', type: 'string', required: false, description: 'Voice selection' },
      { name: 'language', type: 'string', required: false, description: 'Language code' },
    ]),
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
      { name: 'database', type: 'string', required: false, description: 'Database connection name' },
    ]),
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
