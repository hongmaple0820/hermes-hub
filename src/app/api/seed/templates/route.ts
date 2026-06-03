import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const DEFAULT_TEMPLATES = [
  {
    name: 'research-assistant',
    displayName: 'Research Assistant',
    description: 'A built-in AI assistant for code development, debugging, and technical research. Pre-configured with web search, PDF reading, and code execution skills.',
    category: 'assistant',
    icon: 'B',
    systemPrompt: 'You are a skilled research and development assistant. Help the user with coding, debugging, technical research, and documentation. Use available skills to search the web, read documents, and execute code when needed.',
    agentType: null,
    skillIds: '[]',
    config: '{}',
  },
  {
    name: 'operations-assistant',
    displayName: 'Operations Assistant',
    description: 'An AI assistant for content planning, data analysis, and market research. Comes with chart generation, PPT creation, and spreadsheet skills.',
    category: 'assistant',
    icon: 'O',
    systemPrompt: 'You are an operations assistant specialized in content planning, data analysis, and market research. Use available tools to create charts, presentations, and analyze data.',
    agentType: null,
    skillIds: '[]',
    config: '{}',
  },
  {
    name: 'content-writer',
    displayName: 'Content Writer',
    description: 'An AI assistant for copywriting, SEO optimization, and content strategy. Pre-loaded with blog writing and SEO skills.',
    category: 'assistant',
    icon: 'W',
    systemPrompt: 'You are a professional content writer. Create engaging copy, optimize content for SEO, and develop content strategies. Use web search to research topics and trending content.',
    agentType: null,
    skillIds: '[]',
    config: '{}',
  },
  {
    name: 'finance-analyst',
    displayName: 'Finance Analyst',
    description: 'An AI assistant for stock analysis, market research, and financial reports. Equipped with stock analysis and finance skills.',
    category: 'assistant',
    icon: 'F',
    systemPrompt: 'You are a finance analysis assistant. Help with stock analysis, market research, and financial report generation. Use available tools to fetch financial data and create analysis reports.',
    agentType: null,
    skillIds: '[]',
    config: '{}',
  },
  {
    name: 'project-manager',
    displayName: 'Project Manager',
    description: 'An AI assistant for task tracking, progress management, and team coordination.',
    category: 'assistant',
    icon: 'P',
    systemPrompt: 'You are a project management assistant. Help with task tracking, progress management, scheduling, and team coordination.',
    agentType: null,
    skillIds: '[]',
    config: '{}',
  },
  {
    name: 'hermes-agent-template',
    displayName: 'Hermes Agent Connection',
    description: 'Connect a Hermes Agent to the Hub. The agent will automatically register all its capabilities as skills once connected via ACRP.',
    category: 'worker',
    icon: 'H',
    systemPrompt: null,
    agentType: 'hermes-agent',
    skillIds: '[]',
    config: '{}',
  },
];

export async function POST() {
  try {
    const results: any[] = [];

    for (const template of DEFAULT_TEMPLATES) {
      const existing = await db.agentTemplate.findUnique({ where: { name: template.name } });
      if (!existing) {
        const created = await db.agentTemplate.create({ data: template });
        results.push(created as any);
      } else {
        results.push(existing as any);
      }
    }

    return NextResponse.json({ templates: results, count: results.length });
  } catch (error) {
    console.error('Seed templates error:', error);
    return NextResponse.json({ error: 'Failed to seed templates' }, { status: 500 });
  }
}