import { NextRequest, NextResponse } from 'next/server';

// Internal API - fetch agent runtime config (called by agent-runtime service)
// No auth required - this is an internal service-to-service call
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Use direct DB access for internal calls
    const { db } = await import('@/lib/db');

    const agent = await db.agent.findUnique({
      where: { id },
      include: {
        provider: { select: { id: true, name: true, provider: true, apiKey: true, baseUrl: true, defaultModel: true, isActive: true } },
        agentTools: {
          where: { isEnabled: true },
          include: { tool: true },
          orderBy: { priority: 'asc' },
        },
        skills: {
          where: { isEnabled: true },
          include: { skill: true },
          orderBy: { priority: 'asc' },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Build LLM config from agent + provider
    const provider = agent.provider;
    const llmConfig = provider ? {
      provider: provider.provider,
      model: agent.model || provider.defaultModel || 'gpt-3.5-turbo',
      apiKey: provider.apiKey || '',
      baseUrl: provider.baseUrl || (provider.provider === 'openai' ? 'https://api.openai.com/v1' :
                provider.provider === 'anthropic' ? 'https://api.anthropic.com/v1' :
                provider.provider === 'google' ? 'https://generativelanguage.googleapis.com/v1beta' :
                'https://api.openai.com/v1'),
      temperature: agent.temperature ?? 0.7,
      maxTokens: agent.maxTokens ?? 2048,
      systemPrompt: agent.systemPrompt || '',
    } : null;

    // Build tool definitions from agent's bound tools (new Tool system)
    const toolDefinitions = agent.agentTools.map(at => {
      const tool = at.tool;
      let parameters = {};
      try { parameters = JSON.parse(tool.parameters || '{}'); } catch {}
      let handlerConfig = {};
      try { handlerConfig = JSON.parse(at.config || tool.handlerConfig || '{}'); } catch {}

      return {
        id: tool.id,
        name: tool.name,
        displayName: tool.displayName,
        description: tool.description,
        parameters,
        handlerType: tool.handlerType,
        handlerConfig,
        category: tool.category,
      };
    });

    // Also include skills as tools for backward compatibility
    const skillTools = agent.skills.map(as => {
      const skill = as.skill;
      let parameters: any[] = [];
      try { parameters = JSON.parse(skill.parameters || '[]'); } catch {}
      const properties: Record<string, any> = {};
      const required: string[] = [];
      for (const param of parameters) {
        properties[param.name] = { type: param.type || 'string', description: param.description || '' };
        if (param.required) required.push(param.name);
      }

      let callbackUrl = as.callbackUrl || skill.callbackUrl || skill.handlerUrl;

      return {
        id: skill.id,
        name: `skill_${skill.name}`,
        displayName: skill.displayName,
        description: skill.description,
        parameters: { type: 'object', properties, required: required.length > 0 ? required : undefined },
        handlerType: skill.handlerType,
        handlerConfig: {
          callbackUrl,
          endpointToken: as.endpointToken || skill.endpointToken,
          callbackSecret: as.callbackSecret || skill.callbackSecret,
          connectionMode: skill.connectionMode,
        },
        category: skill.category,
      };
    });

    // Merge: new tools first, then legacy skill tools
    const allTools = [...toolDefinitions, ...skillTools];

    // Build endpoint config for remote runtime
    const endpointConfig = {
      endpointUrl: agent.callbackUrl,
      endpointType: (agent.agentType === 'hermes-agent' || agent.mode === 'acrp') ? 'websocket' as const : 'http' as const,
      authToken: agent.apiKey,
      agentToken: agent.agentToken,
    };

    return NextResponse.json({
      agentConfig: {
        id: agent.id,
        name: agent.name,
        mode: agent.mode,
        runtime: agent.runtime,
        llmConfig,
        tools: allTools,
        endpointConfig,
        systemPrompt: agent.systemPrompt,
      },
    });
  } catch (error) {
    console.error('Get agent runtime config error:', error);
    return NextResponse.json({ error: 'Failed to get agent config' }, { status: 500 });
  }
}
