import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

const BUILT_IN_TOOLS = [
  {
    name: 'web_search',
    displayName: 'Web Search',
    description: 'Search the web for information using search engines. Returns relevant results with titles, URLs, and snippets.',
    category: 'utility',
    handlerType: 'builtin',
    handlerConfig: JSON.stringify({ impl: 'web_search' }),
    parameters: JSON.stringify({
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query string',
        },
        num_results: {
          type: 'number',
          description: 'Number of results to return (default: 5)',
          default: 5,
        },
      },
      required: ['query'],
    }),
  },
  {
    name: 'code_execute',
    displayName: 'Code Execute',
    description: 'Execute code in a secure sandbox environment. Supports multiple programming languages. Returns stdout, stderr, and exit code.',
    category: 'development',
    handlerType: 'builtin',
    handlerConfig: JSON.stringify({ impl: 'code_execute' }),
    parameters: JSON.stringify({
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The code to execute',
        },
        language: {
          type: 'string',
          description: 'Programming language (python, javascript, typescript, bash)',
          enum: ['python', 'javascript', 'typescript', 'bash'],
          default: 'python',
        },
        timeout: {
          type: 'number',
          description: 'Execution timeout in seconds (default: 30)',
          default: 30,
        },
      },
      required: ['code'],
    }),
  },
  {
    name: 'file_read',
    displayName: 'File Read',
    description: 'Read file contents from the filesystem. Supports text files with configurable encoding and line range selection.',
    category: 'utility',
    handlerType: 'builtin',
    handlerConfig: JSON.stringify({ impl: 'file_read' }),
    parameters: JSON.stringify({
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to read',
        },
        encoding: {
          type: 'string',
          description: 'File encoding (default: utf-8)',
          default: 'utf-8',
        },
        start_line: {
          type: 'number',
          description: 'Start line number (1-indexed, optional)',
        },
        end_line: {
          type: 'number',
          description: 'End line number (inclusive, optional)',
        },
      },
      required: ['path'],
    }),
  },
  {
    name: 'file_write',
    displayName: 'File Write',
    description: 'Write content to a file on the filesystem. Creates parent directories if they do not exist.',
    category: 'utility',
    handlerType: 'builtin',
    handlerConfig: JSON.stringify({ impl: 'file_write' }),
    parameters: JSON.stringify({
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to write',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
        mode: {
          type: 'string',
          description: 'Write mode: overwrite or append',
          enum: ['overwrite', 'append'],
          default: 'overwrite',
        },
      },
      required: ['path', 'content'],
    }),
  },
  {
    name: 'calculator',
    displayName: 'Calculator',
    description: 'Perform mathematical calculations and evaluate expressions. Supports basic arithmetic, trigonometry, logarithms, and more.',
    category: 'utility',
    handlerType: 'builtin',
    handlerConfig: JSON.stringify({ impl: 'calculator' }),
    parameters: JSON.stringify({
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate (e.g., "2 + 3 * 4", "sin(pi/4)", "log(100)")',
        },
        precision: {
          type: 'number',
          description: 'Number of decimal places for the result (default: 10)',
          default: 10,
        },
      },
      required: ['expression'],
    }),
  },
  {
    name: 'http_request',
    displayName: 'HTTP Request',
    description: 'Make HTTP requests to external APIs and services. Supports GET, POST, PUT, PATCH, DELETE methods with custom headers and body.',
    category: 'development',
    handlerType: 'http',
    handlerConfig: JSON.stringify({}),
    parameters: JSON.stringify({
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to make the request to',
        },
        method: {
          type: 'string',
          description: 'HTTP method',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          default: 'GET',
        },
        headers: {
          type: 'object',
          description: 'HTTP headers as key-value pairs',
        },
        body: {
          type: 'string',
          description: 'Request body (for POST, PUT, PATCH)',
        },
        timeout: {
          type: 'number',
          description: 'Request timeout in seconds (default: 30)',
          default: 30,
        },
      },
      required: ['url'],
    }),
  },
];

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const created: string[] = [];
    const skipped: string[] = [];

    for (const toolData of BUILT_IN_TOOLS) {
      const existing = await db.tool.findUnique({ where: { name: toolData.name } });
      if (existing) {
        skipped.push(toolData.name);
        continue;
      }

      await db.tool.create({
        data: {
          userId: null, // System tool
          name: toolData.name,
          displayName: toolData.displayName,
          description: toolData.description,
          category: toolData.category,
          handlerType: toolData.handlerType,
          handlerConfig: toolData.handlerConfig,
          parameters: toolData.parameters,
          isPublic: true,
        },
      });
      created.push(toolData.name);
    }

    return NextResponse.json({
      data: {
        created,
        skipped,
        message: `Seeded ${created.length} tools, ${skipped.length} already existed`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Seed tools error:', error);
    return NextResponse.json(
      { error: 'Failed to seed tools', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
