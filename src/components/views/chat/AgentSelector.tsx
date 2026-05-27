'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bot, Cpu, Globe, Radio, Loader2, Plus, Wrench, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface MockAgent {
  id: string;
  name: string;
  description: string;
  status: 'online' | 'offline' | 'busy';
  mode: 'builtin' | 'acrp' | 'custom_api';
  model?: string;
  toolsCount?: number;
}

interface AgentSelectorProps {
  onSelectAgent: (agent: MockAgent) => void;
}

// ---------------------------------------------------------------------------
// Agent-specific conversation starters
// ---------------------------------------------------------------------------
function getConversationStarters(agent: MockAgent): string[] {
  const starters: string[] = [];

  // Generate based on mode
  if (agent.mode === 'acrp') {
    starters.push('What capabilities do you have?');
    starters.push('Run a diagnostic check');
  } else if (agent.mode === 'custom_api') {
    starters.push('What endpoints are available?');
    starters.push('Test your connection');
  } else {
    starters.push('Hello! What can you help me with?');
    starters.push('Explain a concept to me');
  }

  // Add based on description keywords
  const desc = agent.description.toLowerCase();
  if (desc.includes('code') || desc.includes('develop') || desc.includes('program')) {
    starters.push('Help me write some code');
  }
  if (desc.includes('debug') || desc.includes('fix') || desc.includes('error')) {
    starters.push('Help me debug an issue');
  }
  if (desc.includes('search') || desc.includes('web') || desc.includes('internet')) {
    starters.push('Search for the latest news');
  }
  if (desc.includes('data') || desc.includes('analyz') || desc.includes('report')) {
    starters.push('Analyze this data for me');
  }

  // Ensure we have at least 2 starters
  if (starters.length < 2) {
    starters.push('What can you do?');
  }

  return starters.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AgentSelector({ onSelectAgent }: AgentSelectorProps) {
  const { t } = useI18n();
  const { agents, setAgents, user } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentToolCounts, setAgentToolCounts] = useState<Record<string, number>>({});
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);

  // Fetch real agents from API if store is empty
  useEffect(() => {
    if (agents.length > 0) return;

    async function fetchAgents() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getAgents();
        setAgents(data.agents || []);
      } catch (err: any) {
        console.error('[AgentSelector] Failed to fetch agents:', err);
        setError(err.message || 'Failed to load agents');
      } finally {
        setLoading(false);
      }
    }

    fetchAgents();
  }, [agents.length, setAgents]);

  // Fetch tool counts for each agent
  useEffect(() => {
    async function fetchToolCounts() {
      for (const agent of agents) {
        try {
          const data = await api.getAgentTools(agent.id);
          const count = (data.agentTools || []).filter((at: any) => at.isEnabled !== false).length;
          setAgentToolCounts((prev) => ({ ...prev, [agent.id]: count }));
        } catch {
          setAgentToolCounts((prev) => ({ ...prev, [agent.id]: 0 }));
        }
      }
    }

    if (agents.length > 0 && agents.length <= 20) {
      fetchToolCounts();
    }
  }, [agents]);

  // Convert real agents to MockAgent format
  const displayAgents: MockAgent[] = agents.map((a: any) => ({
    id: a.id,
    name: a.name,
    description: a.description || '',
    status: a.status || 'offline',
    mode: a.mode || a.runtime || 'builtin',
    model: a.model || undefined,
    toolsCount: agentToolCounts[a.id] || 0,
  }));

  const modeIcon = (mode: string) => {
    switch (mode) {
      case 'acrp':
        return <Radio className="w-3.5 h-3.5" />;
      case 'custom_api':
        return <Globe className="w-3.5 h-3.5" />;
      default:
        return <Cpu className="w-3.5 h-3.5" />;
    }
  };

  const modeLabel = (mode: string) => {
    switch (mode) {
      case 'acrp':
        return 'ACRP';
      case 'custom_api':
        return t('chat2.agentRemote');
      default:
        return t('chat2.agentBuiltin');
    }
  };

  const handleCreateAgent = () => {
    const store = useAppStore.getState();
    store.setCurrentView('agentBuilder');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-3xl w-full">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Bot className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-1">{t('chat2.selectAgent')}</h2>
          <p className="text-sm text-muted-foreground">{t('chat2.selectAgentDesc')}</p>
        </motion.div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Loading agents...</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-8">
            <p className="text-sm text-destructive mb-2">{error}</p>
            <Badge variant="outline" className="text-xs">
              Please create an agent first
            </Badge>
          </div>
        )}

        {/* Agent Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayAgents.map((agent, index) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06, duration: 0.25 }}
                onMouseEnter={() => setHoveredAgent(agent.id)}
                onMouseLeave={() => setHoveredAgent(null)}
              >
                <Card
                  className={cn(
                    'cursor-pointer hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 rounded-xl',
                    hoveredAgent === agent.id && 'border-primary/40 shadow-md -translate-y-0.5'
                  )}
                  onClick={() => onSelectAgent(agent)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                          agent.status === 'online'
                            ? 'bg-primary/10'
                            : 'bg-muted'
                        )}
                      >
                        <Bot
                          className={cn(
                            'w-5 h-5',
                            agent.status === 'online' ? 'text-primary' : 'text-muted-foreground'
                          )}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium truncate">{agent.name}</span>
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full shrink-0',
                              agent.status === 'online' && 'bg-emerald-500 animate-pulse',
                              agent.status === 'busy' && 'bg-amber-500',
                              agent.status === 'offline' && 'bg-muted-foreground/40'
                            )}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {agent.description}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5">
                            {modeIcon(agent.mode)}
                            {modeLabel(agent.mode)}
                          </Badge>
                          {agent.model && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                              {agent.model}
                            </Badge>
                          )}
                          {agent.toolsCount > 0 && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5">
                              <Wrench className="w-2.5 h-2.5" />
                              {agent.toolsCount} {t('chat2.agentTools')}
                            </Badge>
                          )}
                        </div>

                        {/* Conversation starters */}
                        {hoveredAgent === agent.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 space-y-1"
                          >
                            <span className="text-[10px] text-muted-foreground/70 font-medium">
                              {t('chat2.conversationStarter')}
                            </span>
                            {getConversationStarters(agent).map((starter, i) => (
                              <button
                                key={i}
                                className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectAgent(agent);
                                }}
                              >
                                <MessageSquare className="w-3 h-3 shrink-0" />
                                {starter}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {/* Create New Agent Card */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: displayAgents.length * 0.06, duration: 0.25 }}
            >
              <Card
                className="cursor-pointer hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 rounded-xl border-dashed"
                onClick={handleCreateAgent}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/5 border border-dashed border-primary/20">
                      <Plus className="w-5 h-5 text-primary/60" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-primary/80">{t('chat2.createAgent')}</p>
                      <p className="text-xs text-muted-foreground">{t('chat2.createAgentDesc')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {!loading && !error && displayAgents.length === 0 && (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t('chat2.noAgents')}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{t('chat2.noAgentsDesc')}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-1.5"
              onClick={handleCreateAgent}
            >
              <Plus className="w-3.5 h-3.5" />
              {t('chat2.createAgent')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
