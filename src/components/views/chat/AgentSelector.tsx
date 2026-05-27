'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Cpu, Globe, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/lib/store';

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
  const { agents } = useAppStore();

  // Convert real agents + add some mock agents if none exist
  const displayAgents: MockAgent[] =
    agents.length > 0
      ? agents.map((a: any) => ({
          id: a.id,
          name: a.name,
          description: a.description || '',
          status: a.status || 'offline',
          mode: a.mode || 'builtin',
          model: a.modelOverride || undefined,
        }))
      : [
          {
            id: 'mock-agent-1',
            name: 'Code Assistant',
            description: 'Expert in code review, debugging, and architecture advice',
            status: 'online',
            mode: 'builtin',
            model: 'gpt-4o',
          },
          {
            id: 'mock-agent-2',
            name: 'Research Analyst',
            description: 'Deep research and analysis with web search capability',
            status: 'online',
            mode: 'builtin',
            model: 'claude-3.5',
          },
          {
            id: 'mock-agent-3',
            name: 'Data Scientist',
            description: 'Data analysis, visualization, and ML model building',
            status: 'busy',
            mode: 'builtin',
          },
          {
            id: 'mock-agent-4',
            name: 'Creative Writer',
            description: 'Content creation, storytelling, and copywriting',
            status: 'offline',
            mode: 'acrp',
          },
        ];

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

        {/* Agent Grid */}
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

        {displayAgents.length === 0 && (
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
