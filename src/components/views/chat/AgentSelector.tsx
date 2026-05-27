'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Cpu, Globe, Radio, Loader2 } from 'lucide-react';
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
}

interface AgentSelectorProps {
  onSelectAgent: (agent: MockAgent) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AgentSelector({ onSelectAgent }: AgentSelectorProps) {
  const { t } = useI18n();
  const { agents, setAgents, user } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Convert real agents to MockAgent format
  const displayAgents: MockAgent[] = agents.map((a: any) => ({
    id: a.id,
    name: a.name,
    description: a.description || '',
    status: a.status || 'offline',
    mode: a.mode || a.runtime || 'builtin',
    model: a.model || undefined,
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

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
      <div className="max-w-2xl w-full">
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
              >
                <Card
                  className="cursor-pointer hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 rounded-xl"
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
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5">
                            {modeIcon(agent.mode)}
                            {agent.mode === 'acrp' ? 'ACRP' : agent.mode === 'custom_api' ? 'Custom' : 'Builtin'}
                          </Badge>
                          {agent.model && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                              {agent.model}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && !error && displayAgents.length === 0 && (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t('chat2.noAgents')}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{t('chat2.noAgentsDesc')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
