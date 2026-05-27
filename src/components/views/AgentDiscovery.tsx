'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, Compass, Bot, Zap, Code, MessageSquare,
  Palette, Database, Loader2, AlertCircle, User,
  ArrowRight, Copy, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---- Types ----
interface DiscoveredAgent {
  id: string;
  name: string;
  description: string | null;
  mode: string;
  avatar: string | null;
  isPublic: boolean;
  status: string;
  systemPrompt: string | null;
  modelOverride: string | null;
  temperature: number | null;
  maxTokens: number | null;
  provider?: { id: string; name: string; provider: string };
  user?: { id: string; name: string; avatar: string | null };
  skills?: { skill: { id: string; name: string; displayName: string; icon: string | null } }[];
  _count?: { conversations: number };
  createdAt: string;
  updatedAt: string;
}

// ---- Categories ----
const categories = [
  { id: 'all', labelKey: 'discovery.all', icon: Compass },
  { id: 'productivity', labelKey: 'discovery.productivity', icon: Zap },
  { id: 'development', labelKey: 'discovery.development', icon: Code },
  { id: 'communication', labelKey: 'discovery.communication', icon: MessageSquare },
  { id: 'creative', labelKey: 'discovery.creative', icon: Palette },
  { id: 'data', labelKey: 'discovery.data', icon: Database },
];

// ---- Mode badge styling ----
const modeStyles: Record<string, { bg: string; text: string; border: string; labelKey: string }> = {
  builtin: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    labelKey: 'discovery.builtin',
  },
  remote: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-500/20',
    labelKey: 'discovery.remote',
  },
  workflow: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/20',
    labelKey: 'discovery.workflow',
  },
  acrp: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-500/20',
    labelKey: 'discovery.remote',
  },
};

function getModeBadge(mode: string) {
  return modeStyles[mode] || modeStyles.builtin;
}

// ---- Agent avatar emoji ----
const agentEmojis = ['🤖', '🧠', '💡', '🦾', '🔮', '🎭', '🛸', '⚡', '🌟', '🎯', '🦊', '🐉'];

function getAgentEmoji(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return agentEmojis[Math.abs(hash) % agentEmojis.length];
}

export function AgentDiscovery() {
  const { t } = useI18n();
  const { agents, setCurrentView, setSelectedAgentId, user } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [discoveredAgents, setDiscoveredAgents] = useState<DiscoveredAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // ---- Fetch discovered agents ----
  const fetchAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params: { category?: string; search?: string } = {};
      if (activeCategory !== 'all') params.category = activeCategory;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await api.discoverAgents(params as any);
      const agentList = (res as any).agents || [];
      setDiscoveredAgents(agentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover agents');
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, debouncedSearch]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Check which agents the user already has (by name match)
  useEffect(() => {
    const myAgentNames = new Set(agents.map((a: any) => a.name));
    const installed = new Set<string>();
    discoveredAgents.forEach((agent) => {
      if (myAgentNames.has(agent.name)) {
        installed.add(agent.id);
      }
    });
    // Also check if the agent belongs to the current user
    discoveredAgents.forEach((agent) => {
      if (agent.user?.id === user?.id) {
        installed.add(agent.id);
      }
    });
    setInstalledIds(installed);
  }, [discoveredAgents, agents, user?.id]);

  // ---- Handle "Use" agent ----
  const handleUseAgent = (agent: DiscoveredAgent) => {
    setSelectedAgentId(agent.id);
    setCurrentView('chat2');
  };

  // ---- Handle "Install" agent ----
  const handleInstallAgent = async (agent: DiscoveredAgent) => {
    setInstallingId(agent.id);
    try {
      await api.createAgent({
        name: agent.name,
        description: agent.description || '',
        mode: agent.mode,
        systemPrompt: agent.systemPrompt || '',
        modelOverride: agent.modelOverride || undefined,
        temperature: agent.temperature || undefined,
        maxTokens: agent.maxTokens || undefined,
        isPublic: false,
      });
      setInstalledIds((prev) => new Set(prev).add(agent.id));
      toast.success(t('discovery.agentInstalled'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to install agent');
    } finally {
      setInstallingId(null);
    }
  };

  // ---- Loading skeletons ----
  if (isLoading && discoveredAgents.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Skeleton className="h-10 flex-1" />
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-8 w-20 rounded-full" />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Hero Section */}
        <div
          className="relative overflow-hidden rounded-xl p-6 border border-border/50"
          style={{
            background:
              'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(6,182,212,0.04) 50%, rgba(16,185,129,0.04) 100%)',
          }}
        >
          <div className="relative z-10">
            <h1 className="text-2xl font-bold flex items-center gap-2.5">
              <Compass className="w-6 h-6 text-primary" />
              {t('discovery.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-lg">
              {t('discovery.subtitle')}
            </p>
          </div>
          {/* Decorative background elements */}
          <div className="absolute top-2 right-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
          <div className="absolute bottom-0 right-20 w-16 h-16 bg-cyan-500/5 rounded-full blur-xl" />
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('discovery.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-lg"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                    isActive
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                      : 'bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent'
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {t(cat.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="w-12 h-12 mb-4 text-destructive" />
            <p className="text-lg font-medium text-foreground">{t('common.error')}</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchAgents}>
              {t('common.refresh')}
            </Button>
          </div>
        )}

        {/* Agent Grid */}
        {!error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {discoveredAgents.map((agent, idx) => {
              const modeBadge = getModeBadge(agent.mode);
              const isInstalled = installedIds.has(agent.id);
              const isInstalling = installingId === agent.id;
              const isOwnAgent = agent.user?.id === user?.id;
              const emoji = getAgentEmoji(agent.id);

              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.3, ease: 'easeOut' }}
                >
                  <Card className="rounded-xl hover:shadow-md hover:scale-[1.01] transition-all duration-200 hover:border-primary/20 group h-full">
                    <CardContent className="p-4 flex flex-col h-full">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Avatar */}
                        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0 text-xl group-hover:from-primary/15 group-hover:to-primary/10 transition-colors">
                          {emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">{agent.name}</p>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[9px] h-4 px-1.5',
                                modeBadge.bg,
                                modeBadge.text,
                                modeBadge.border
                              )}
                            >
                              {t(modeBadge.labelKey)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {agent.description || t('common.noData')}
                          </p>
                        </div>
                      </div>

                      {/* Author & meta info */}
                      <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground/70">
                        {agent.user?.name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {t('discovery.byAuthor', { author: agent.user.name })}
                          </span>
                        )}
                        {agent._count?.conversations !== undefined && agent._count.conversations > 0 && (
                          <span>{agent._count.conversations} {t('dashboard.conversations').toLowerCase()}</span>
                        )}
                      </div>

                      {/* Action button */}
                      <div className="mt-3 pt-3 border-t border-border/50">
                        {isInstalled || isOwnAgent ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs gap-1.5 rounded-lg"
                            onClick={() => handleUseAgent(agent)}
                          >
                            <Zap className="w-3 h-3" />
                            {t('discovery.useAgent')}
                            <ArrowRight className="w-3 h-3 ml-auto" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="w-full text-xs gap-1.5 rounded-lg"
                            disabled={isInstalling}
                            onClick={() => handleInstallAgent(agent)}
                          >
                            {isInstalling ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {t('common.loading')}
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                {t('discovery.installAgent')}
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!error && !isLoading && discoveredAgents.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Compass className="w-8 h-8 text-primary/50" />
            </div>
            <h3 className="text-base font-semibold mb-1">
              {debouncedSearch || activeCategory !== 'all'
                ? t('discovery.noResults')
                : t('discovery.noAgents')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {debouncedSearch || activeCategory !== 'all'
                ? t('common.noResults')
                : t('discovery.noAgentsDesc')}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
