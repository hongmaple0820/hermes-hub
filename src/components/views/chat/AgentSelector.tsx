'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Bot,
  Cpu,
  Globe,
  Radio,
  Loader2,
  Plus,
  Wrench,
  MessageSquare,
  Search,
  Sparkles,
  Code2,
  PenTool,
  HelpCircle,
  ArrowRight,
  LayoutGrid,
  List,
} from 'lucide-react';
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
// Quick-start suggestion cards for empty state
// ---------------------------------------------------------------------------
interface QuickStartCard {
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
  prompt: string;
  gradient: string;
}

const QUICK_START_CARDS: QuickStartCard[] = [
  {
    icon: <MessageSquare className="w-7 h-7" />,
    titleKey: 'chat2.quickChat',
    descKey: 'chat2.quickChatDesc',
    prompt: 'Hello! I need help with a conversation assistant.',
    gradient: 'from-cyan-500/10 to-blue-500/10',
  },
  {
    icon: <Code2 className="w-7 h-7" />,
    titleKey: 'chat2.quickCode',
    descKey: 'chat2.quickCodeDesc',
    prompt: 'Help me write and review code.',
    gradient: 'from-emerald-500/10 to-green-500/10',
  },
  {
    icon: <PenTool className="w-7 h-7" />,
    titleKey: 'chat2.quickWrite',
    descKey: 'chat2.quickWriteDesc',
    prompt: 'Help me with writing and content creation.',
    gradient: 'from-amber-500/10 to-orange-500/10',
  },
];

// ---------------------------------------------------------------------------
// Agent-specific conversation starters
// ---------------------------------------------------------------------------
function getConversationStarters(agent: MockAgent): string[] {
  const starters: string[] = [];

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

  if (starters.length < 2) {
    starters.push('What can you do?');
  }

  return starters.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Skeleton card for loading state
// ---------------------------------------------------------------------------
function AgentCardSkeleton() {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-3 w-full bg-muted animate-pulse rounded" />
            <div className="flex gap-1.5">
              <div className="h-4 w-14 bg-muted animate-pulse rounded-full" />
              <div className="h-4 w-18 bg-muted animate-pulse rounded-full" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
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
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

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
  const displayAgents: MockAgent[] = useMemo(() =>
    agents.map((a: any) => ({
      id: a.id,
      name: a.name,
      description: a.description || '',
      status: a.status || 'offline',
      mode: a.mode || a.runtime || 'builtin',
      model: a.model || undefined,
      toolsCount: agentToolCounts[a.id] || 0,
    })),
    [agents, agentToolCounts]
  );

  // Filter agents by search query
  const filteredAgents = useMemo(() => {
    if (!debouncedSearch.trim()) return displayAgents;
    const q = debouncedSearch.toLowerCase();
    return displayAgents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.mode.toLowerCase().includes(q) ||
        (a.model && a.model.toLowerCase().includes(q))
    );
  }, [displayAgents, debouncedSearch]);

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

  // -------------------------------------------------------------------------
  // Empty State — Engaging hero with quick-start cards
  // -------------------------------------------------------------------------
  if (!loading && !error && displayAgents.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-lg w-full">
          {/* Hero illustration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 20 }}
              className="relative w-24 h-24 mx-auto mb-6"
            >
              {/* Gradient glow behind the bot icon */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 via-cyan-500/15 to-emerald-500/15 blur-xl" />
              <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 flex items-center justify-center">
                <Bot className="w-12 h-12 text-primary" />
              </div>
              {/* Sparkle accents */}
              <motion.div
                className="absolute -top-1 -right-1"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: 'spring' }}
              >
                <Sparkles className="w-5 h-5 text-amber-500" />
              </motion.div>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold mb-2"
            >
              {t('chat2.emptyHeroTitle')}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-sm text-muted-foreground max-w-sm mx-auto"
            >
              {t('chat2.emptyHeroDesc')}
            </motion.p>
          </motion.div>

          {/* Quick-start suggestion cards — proper cards with hover effects */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
          >
            {QUICK_START_CARDS.map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.35, ease: 'easeOut' }}
                whileHover={{ y: -4, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  handleCreateAgent();
                }}
                className={cn(
                  'relative flex flex-col items-center gap-3 p-5 rounded-2xl border border-border/60 bg-card cursor-pointer',
                  'hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10',
                  'transition-all duration-200 text-center group',
                  'bg-gradient-to-br',
                  card.gradient
                )}
              >
                {/* Large prominent icon */}
                <div className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg',
                  'group-hover:scale-110 group-hover:shadow-xl transition-all duration-300',
                  i === 0 && 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/25',
                  i === 1 && 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/25',
                  i === 2 && 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/25'
                )}>
                  {card.icon}
                </div>
                <span className="text-sm font-semibold">{t(card.titleKey)}</span>
                <span className="text-xs text-muted-foreground leading-relaxed">{t(card.descKey)}</span>
                {/* Subtle arrow indicator on hover */}
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <ArrowRight className="w-4 h-4 text-primary/50" />
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Primary CTA — prominent Create New Agent button */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex flex-col items-center gap-3"
          >
            <Button
              size="lg"
              className="gap-2 px-10 h-12 text-sm font-semibold rounded-2xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              onClick={handleCreateAgent}
            >
              <Plus className="w-5 h-5" />
              {t('chat2.createAgent')}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <p className="text-xs text-muted-foreground/70">{t('chat2.createAgentHint')}</p>
          </motion.div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main selector view — agents exist
  // -------------------------------------------------------------------------
  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-3xl w-full mx-auto">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 flex items-center justify-center mx-auto mb-4">
            <Bot className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-1">{t('chat2.selectAgent')}</h2>
          <p className="text-sm text-muted-foreground">{t('chat2.selectAgentDesc')}</p>
        </motion.div>

        {/* Search bar + view toggle + create button */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 mb-4"
        >
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('chat2.searchAgents')}
              className="pl-8 h-8 text-xs rounded-lg"
            />
          </div>
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-1.5 transition-colors',
                viewMode === 'grid' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-1.5 transition-colors',
                viewMode === 'list' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
          <Button
            size="sm"
            className="gap-1.5 h-8 text-xs rounded-lg shrink-0 shadow-sm hover:shadow-md"
            onClick={handleCreateAgent}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('chat2.createAgent')}</span>
          </Button>
        </motion.div>

        {/* Loading state — skeleton cards */}
        {loading && (
          <div className={cn(
            'grid gap-3',
            viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
          )}>
            {Array.from({ length: 4 }).map((_, i) => (
              <AgentCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-8">
            <HelpCircle className="w-10 h-10 text-destructive/40 mx-auto mb-3" />
            <p className="text-sm text-destructive mb-2">{error}</p>
            <p className="text-xs text-muted-foreground">{t('chat2.noAgentsDesc')}</p>
          </div>
        )}

        {/* Agent Grid/List */}
        {!loading && !error && (
          <>
            <AnimatePresence mode="popLayout">
              <div className={cn(
                'grid gap-3',
                viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
              )}>
                {filteredAgents.map((agent, index) => (
                  <motion.div
                    key={agent.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.04, duration: 0.2 }}
                    onMouseEnter={() => setHoveredAgent(agent.id)}
                    onMouseLeave={() => setHoveredAgent(null)}
                  >
                    <Card
                      className={cn(
                        'cursor-pointer hover:border-primary/40 hover:shadow-md dark:hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 rounded-xl group',
                        hoveredAgent === agent.id && 'border-primary/40 shadow-md dark:shadow-lg -translate-y-0.5',
                        // Gradient backgrounds based on mode
                        agent.mode === 'acrp' && 'bg-gradient-to-br from-card to-cyan-500/5 dark:from-card dark:to-cyan-500/10',
                        agent.mode === 'custom_api' && 'bg-gradient-to-br from-card to-amber-500/5 dark:from-card dark:to-amber-500/10',
                        agent.mode === 'builtin' && 'bg-gradient-to-br from-card to-emerald-500/5 dark:from-card dark:to-emerald-500/10',
                        viewMode === 'list' && 'hover:-translate-y-0'
                      )}
                      onClick={() => onSelectAgent(agent)}
                    >
                      <CardContent className={cn(
                        'p-4',
                        viewMode === 'list' && 'p-3'
                      )}>
                        {viewMode === 'grid' ? (
                          <div className="flex items-start gap-3">
                            <div
                              className="shrink-0 relative"
                            >
                              <Avatar className={cn(
                                'w-10 h-10 rounded-xl',
                                agent.status === 'online'
                                  ? 'ring-2 ring-emerald-500/30'
                                  : agent.status === 'busy'
                                    ? 'ring-2 ring-amber-500/30'
                                    : ''
                              )}>
                                <AvatarFallback className={cn(
                                  'rounded-xl text-xs font-semibold',
                                  agent.status === 'online'
                                    ? 'bg-emerald-500/15 text-emerald-600'
                                    : agent.status === 'busy'
                                      ? 'bg-amber-500/15 text-amber-600'
                                      : 'bg-primary/10 text-primary'
                                )}>
                                  {agent.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {/* Status indicator with pulse */}
                              {agent.status === 'online' && (
                                <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                                </span>
                              )}
                              {agent.status === 'busy' && (
                                <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                                </span>
                              )}
                              {agent.status === 'offline' && (
                                <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 rounded-full bg-muted-foreground/40" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-medium truncate">{agent.name}</span>
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

                              {/* Conversation starters on hover */}
                              <AnimatePresence>
                                {hoveredAgent === agent.id && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-3 space-y-1 overflow-hidden"
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
                              </AnimatePresence>
                            </div>
                          </div>
                        ) : (
                          /* List view layout */
                          <div className="flex items-center gap-3">
                            <div className="shrink-0 relative">
                              <Avatar className={cn(
                                'w-8 h-8 rounded-lg',
                                agent.status === 'online'
                                  ? 'ring-2 ring-emerald-500/30'
                                  : agent.status === 'busy'
                                    ? 'ring-2 ring-amber-500/30'
                                    : ''
                              )}>
                                <AvatarFallback className={cn(
                                  'rounded-lg text-[10px] font-semibold',
                                  agent.status === 'online'
                                    ? 'bg-emerald-500/15 text-emerald-600'
                                    : agent.status === 'busy'
                                      ? 'bg-amber-500/15 text-amber-600'
                                      : 'bg-primary/10 text-primary'
                                )}>
                                  {agent.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {/* Mini status dot */}
                              <span className={cn(
                                'absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background',
                                agent.status === 'online' && 'bg-emerald-500',
                                agent.status === 'busy' && 'bg-amber-500',
                                agent.status === 'offline' && 'bg-muted-foreground/40'
                              )} />
                            </div>
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{agent.name}</span>
                              <span
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full shrink-0',
                                  agent.status === 'online' && 'bg-emerald-500',
                                  agent.status === 'busy' && 'bg-amber-500',
                                  agent.status === 'offline' && 'bg-muted-foreground/40'
                                )}
                              />
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5 shrink-0">
                                {modeIcon(agent.mode)}
                                {modeLabel(agent.mode)}
                              </Badge>
                              {agent.model && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
                                  {agent.model}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px] hidden sm:block">
                              {agent.description}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>

            {/* No search results */}
            {!loading && filteredAgents.length === 0 && displayAgents.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8"
              >
                <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{t('chat2.noSearchResults')}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{t('chat2.tryDifferentSearch')}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs"
                  onClick={() => setSearchQuery('')}
                >
                  {t('chat2.clearSearch')}
                </Button>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
