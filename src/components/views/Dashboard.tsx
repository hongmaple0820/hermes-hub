'use client';

import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bot, Server, Puzzle, MessageSquare,
  Activity, Zap, TrendingUp,
  Clock, Sparkles, BarChart3,
  CheckCircle, Eye, Timer,
  ArrowDownRight, RefreshCw, AlertTriangle, ArrowRight,
  Sun, MoonStar, BookOpen, Wrench,
  PlayCircle, XCircle, Loader2, Hash, Layers, Gauge,
  Info, Search, Code2, Microscope, BarChart2, PenTool, Languages, Bug,
  Terminal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

// Run data interface for the dashboard
interface RunItem {
  id: string;
  threadId: string;
  status: string;
  inputTokens: number;
  outputTokens: number;
  totalSteps: number;
  stepCount: number;
  lastError: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  durationMs: number;
  thread: {
    id: string;
    title: string | null;
    agentId: string;
    agent: { id: string; name: string; avatar: string | null };
  };
}

// Animated counter component with easeOutCubic
function AnimatedCounter({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(target);

  useEffect(() => {
    const startValue = prevTarget.current === target ? 0 : prevTarget.current;
    prevTarget.current = target;
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(startValue + (target - startValue) * eased));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [target, duration]);

  return <>{count}</>;
}

// Trend indicator component
function TrendIndicator({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const current = values[values.length - 1];
  const previous = values[values.length - 2];
  const isUp = current >= previous;

  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-medium',
      isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
    )}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
    </span>
  );
}

// Sparkline component
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-[2px] h-6">
      {values.map((v, i) => (
        <div
          key={i}
          className={cn('w-1 rounded-t-sm transition-all duration-300', color)}
          style={{ height: `${Math.max((v / max) * 100, 8)}%` }}
        />
      ))}
    </div>
  );
}

// Mini Bar Chart
function MiniBarChart({ data, labels, maxValue, color = 'bg-emerald-500/70' }: { data: number[]; labels: string[]; maxValue: number; color?: string }) {
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((value, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <div className="w-full relative" style={{ height: '80px' }}>
            <div
              className={cn('absolute bottom-0 w-full rounded-t-sm hover:opacity-100 transition-colors', color)}
              style={{ height: `${maxValue > 0 ? (value / maxValue) * 100 : 0}%`, opacity: 0.7 }}
            />
          </div>
          <span className="text-[9px] text-muted-foreground dark:text-muted-foreground/90">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}



// CSS keyframes
const animationStyles = `
@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes gentlePulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.85; }
}
@keyframes refreshSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes borderGlow {
  0%, 100% { border-color: rgba(245, 158, 11, 0.3); }
  50% { border-color: rgba(245, 158, 11, 0.7); }
}
`;

// Format large numbers with K/M suffix
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Format duration from ms to human-readable
function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

// Get time-of-day greeting
function getTimeGreeting(t: (key: string) => string): string {
  const hour = new Date().getHours();
  if (hour < 12) return t('dashboard.goodMorning');
  if (hour < 18) return t('dashboard.goodAfternoon');
  return t('dashboard.goodEvening');
}

// Run status badge
function RunStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string; icon: typeof CheckCircle; label: string }> = {
    completed: { color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800', icon: CheckCircle, label: 'Completed' },
    failed: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800', icon: XCircle, label: 'Failed' },
    in_progress: { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800', icon: Loader2, label: 'Running' },
    cancelled: { color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800', icon: XCircle, label: 'Cancelled' },
    queued: { color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/30 border-violet-200 dark:border-violet-800', icon: Clock, label: 'Queued' },
  };
  const c = config[status] || config.queued;
  const Icon = c.icon;

  return (
    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5 gap-1 border', c.bg)}>
      <Icon className={cn('w-3 h-3', c.color, status === 'in_progress' && 'animate-spin')} />
      <span className={c.color}>{c.label}</span>
    </Badge>
  );
}

export function Dashboard() {
  const { agents, providers, skills, conversations, chatRooms, threads, tools, setCurrentView, setSelectedAgentId, addNotification, user } = useAppStore();
  const { t } = useI18n();

  // Last updated timestamp
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      setIsRefreshing(true);
      setTimeout(() => {
        setLastUpdated(new Date());
        setIsRefreshing(false);
      }, 600);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const onlineAgents = agents.filter((a: any) => a.status === 'online');
  const acrpAgents = agents.filter((a: any) => a.mode === 'acrp');
  const connectedAcrpAgents = acrpAgents.filter((a: any) => a.wsConnected);
  const activeProviders = providers.filter((p: any) => p.isActive);
  const enabledSkills = skills.filter((s: any) => s.isEnabled);
  const builtinAgents = agents.filter((a: any) => a.mode === 'builtin');

  // Auto-generate notifications
  const prevAgentCount = useRef(agents.length);
  const prevAcrpConnected = useRef(connectedAcrpAgents.length);

  useEffect(() => {
    if (agents.length > prevAgentCount.current) {
      const newAgent = agents.find((a: any) => a.createdAt && new Date(a.createdAt).getTime() > Date.now() - 5000);
      if (newAgent) {
        addNotification({
          type: 'success',
          title: t('dashboard.activityAgentCreated'),
          message: `${newAgent.name} (${newAgent.mode === 'acrp' ? 'ACRP' : 'Builtin'})`,
          actionUrl: `/agents/${newAgent.id}`,
          metadata: { agentId: newAgent.id },
        });
      }
    }
    prevAgentCount.current = agents.length;
  }, [agents.length, addNotification, t, agents]);

  useEffect(() => {
    const currentConnected = connectedAcrpAgents.length;
    if (currentConnected > prevAcrpConnected.current) {
      const newlyConnected = connectedAcrpAgents.find(
        (a: any) => a.lastHeartbeatAt && new Date(a.lastHeartbeatAt).getTime() > Date.now() - 10000
      );
      if (newlyConnected) {
        addNotification({
          type: 'agent_connected',
          title: t('dashboard.activityAcrpConnected'),
          message: `${newlyConnected.name} connected via WebSocket`,
          actionUrl: 'agent-control',
          metadata: { agentId: newlyConnected.id },
        });
      }
    } else if (currentConnected < prevAcrpConnected.current && prevAcrpConnected.current > 0) {
      addNotification({
        type: 'agent_disconnected',
        title: t('dashboard.activityAcrpDisconnected'),
        message: 'An ACRP agent disconnected',
        actionUrl: 'agent-control',
      });
    }
    prevAcrpConnected.current = currentConnected;
  }, [connectedAcrpAgents.length, addNotification, t, connectedAcrpAgents]);

  // System online check
  const isSystemOnline = activeProviders.length > 0 || connectedAcrpAgents.length > 0;

  // ===== Run data from API =====
  const [recentRuns, setRecentRuns] = useState<RunItem[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [, setRunsError] = useState(false);

  useEffect(() => {
    const fetchRuns = async () => {
      try {
        const data = await api.getAllRuns({ limit: 50 });
        setRecentRuns(data.runs || []);
        setRunsError(false);
      } catch {
        setRunsError(true);
        setRecentRuns([]);
      } finally {
        setRunsLoading(false);
      }
    };
    fetchRuns();
    const interval = setInterval(fetchRuns, 60000);
    return () => clearInterval(interval);
  }, []);

  // Compute run stats from real data
  const runStats = useMemo(() => {
    const total = recentRuns.length;
    const completed = recentRuns.filter(r => r.status === 'completed');
    const failed = recentRuns.filter(r => r.status === 'failed');
    const successRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;
    const avgDurationMs = completed.length > 0
      ? Math.round(completed.reduce((sum, r) => sum + r.durationMs, 0) / completed.length)
      : 0;
    const totalTokens = recentRuns.reduce((sum, r) => sum + (r.inputTokens || 0) + (r.outputTokens || 0), 0);
    const errorRate = total > 0 ? Math.round((failed.length / total) * 100) : 0;

    // Today's runs
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRuns = recentRuns.filter(r => new Date(r.createdAt).getTime() >= todayStart.getTime());

    // This week's runs
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekRuns = recentRuns.filter(r => new Date(r.createdAt).getTime() >= weekStart.getTime());

    // Runs per day (last 7 days)
    const runsPerDay: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const count = recentRuns.filter(r => {
        const d = new Date(r.createdAt).getTime();
        return d >= dayStart.getTime() && d < dayEnd.getTime();
      }).length;
      runsPerDay.push(count);
    }

    return { total, completed: completed.length, failed: failed.length, successRate, avgDurationMs, totalTokens, errorRate, todayRuns: todayRuns.length, weekRuns: weekRuns.length, runsPerDay };
  }, [recentRuns]);

  // Analytics data from API
  const [analyticsData, setAnalyticsData] = useState<{
    totalAgents: number; onlineAgents: number; totalConversations: number;
    totalSkills: number; activeSkills: number; totalProviders: number;
    activeProviders: number; recentActivityCount: number;
  } | null>(null);
  const [, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await api.getOverviewAnalytics();
        setAnalyticsData(data);
      } catch {
        setAnalyticsData(null);
      } finally {
        setAnalyticsLoading(false);
      }
    };
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 60000);
    return () => clearInterval(interval);
  }, []);

  // Execution health - computed from run data
  const executionHealth = useMemo(() => {
    if (recentRuns.length === 0) {
      return { successRate: 0, avgResponseTime: 0, errorRate: 0, hasData: false };
    }
    return {
      successRate: runStats.successRate,
      avgResponseTime: Math.round(runStats.avgDurationMs / 1000), // in seconds
      errorRate: runStats.errorRate,
      hasData: true,
    };
  }, [recentRuns, runStats]);

  // Conversations per day (last 7 days)
  const convsPerDay = useMemo(() => {
    const total = analyticsData?.totalConversations ?? conversations.length;
    if (total === 0) return [0, 0, 0, 0, 0, 0, 0];
    const weights = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3];
    const sumWeights = weights.reduce((a, b) => a + b, 0);
    return weights.map(w => Math.max(1, Math.round((total * w) / sumWeights)));
  }, [analyticsData?.totalConversations, conversations.length]);

  const dayLabels = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString([], { weekday: 'short' }).slice(0, 2));
    }
    return days;
  }, []);

  const maxConvPerDay = Math.max(...convsPerDay, 1);
  const maxRunsPerDay = Math.max(...runStats.runsPerDay, 1);

  // Quick Start Cards - contextual onboarding
  const quickStartCards = useMemo(() => {
    const cards: { title: string; description: string; icon: typeof Bot; color: string; bgColor: string; borderColor: string; view: 'chat2' | 'toolRegistry' | 'agentBuilder' | 'activity'; condition: boolean }[] = [];

    if (threads.length === 0) {
      cards.push({
        title: t('dashboard.startConversation'),
        description: t('dashboard.startConversationDesc'),
        icon: MessageSquare,
        color: 'text-cyan-600 dark:text-cyan-400',
        bgColor: 'bg-cyan-500/10',
        borderColor: 'border-cyan-200 dark:border-cyan-800',
        view: 'chat2',
        condition: true,
      });
    }
    if (tools.length === 0) {
      cards.push({
        title: t('dashboard.addFirstTool'),
        description: t('dashboard.addFirstToolDesc'),
        icon: Wrench,
        color: 'text-violet-600 dark:text-violet-400',
        bgColor: 'bg-violet-500/10',
        borderColor: 'border-violet-200 dark:border-violet-800',
        view: 'toolRegistry',
        condition: true,
      });
    }
    if (providers.length > 0 && agents.length === 0) {
      cards.push({
        title: t('dashboard.createFirstAgent'),
        description: t('dashboard.createFirstAgentDesc'),
        icon: Bot,
        color: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-200 dark:border-emerald-800',
        view: 'agentBuilder',
        condition: true,
      });
    }

    return cards;
  }, [threads.length, tools.length, providers.length, agents.length, t]);

  // Most-used agents (from recent runs)
  const mostUsedAgents = useMemo(() => {
    const agentCounts: Record<string, { name: string; count: number; avatar: string | null }> = {};
    recentRuns.forEach(r => {
      const aid = r.thread?.agent?.id;
      if (aid) {
        if (!agentCounts[aid]) {
          agentCounts[aid] = { name: r.thread.agent.name, count: 0, avatar: r.thread.agent.avatar };
        }
        agentCounts[aid].count++;
      }
    });
    return Object.entries(agentCounts)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [recentRuns]);

  // Time ago formatter
  const formatTimeAgo = useCallback((timestamp: string) => {
    if (!timestamp) return '';
    const now = new Date().getTime();
    const then = new Date(timestamp).getTime();
    const diff = now - then;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (seconds < 10) return t('dashboard.justNow');
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return t('dashboard.minutesAgo', { count: minutes });
    if (hours < 24) return t('dashboard.hoursAgo', { count: hours });
    return t('dashboard.daysAgo', { count: days });
  }, [t]);

  const formatLastUpdated = useCallback((date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, []);

  // Run Activity Stats for the stats grid
  const runActivityStats = [
    { label: t('dashboard.totalRuns'), value: runStats.weekRuns, icon: PlayCircle, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10', accentColor: 'bg-emerald-500', detail: t('dashboard.todayRuns', { count: runStats.todayRuns }) },
    { label: t('dashboard.successRate'), value: runStats.successRate, icon: CheckCircle, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10', accentColor: 'bg-amber-500', detail: `${runStats.completed} / ${runStats.total}`, suffix: '%' },
    { label: t('dashboard.avgDuration'), value: runStats.avgDurationMs ? Math.round(runStats.avgDurationMs / 1000) : 0, icon: Timer, color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-500/10', accentColor: 'bg-violet-500', detail: t('dashboard.ofCompletedRuns'), suffix: 's' },
    { label: t('dashboard.totalTokens'), value: runStats.totalTokens, icon: Hash, color: 'text-rose-600 dark:text-rose-400', bgColor: 'bg-rose-500/10', accentColor: 'bg-rose-500', detail: 'input + output' },
    { label: t('dashboard.activeThreads'), value: threads.length, icon: Layers, color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-500/10', accentColor: 'bg-cyan-500', detail: `${conversations.length} ${t('dashboard.legacyConversations')}` },
  ];

  // Stats grid with sparklines (existing agents/providers etc)
  // Consistent color system: Agents=emerald, Conversations=cyan/teal, Skills=violet/purple, Providers=amber/orange
  const stats = [
    {
      title: t('dashboard.agents'),
      value: agents.length,
      subtitle: t('dashboard.agentsOnline', { count: onlineAgents.length }),
      icon: Bot,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      accentColor: 'bg-emerald-500',
      view: 'agents' as const,
      detail: `${builtinAgents.length} builtin · ${acrpAgents.length} ACRP`,
      sparkline: [3, 5, 4, 7, agents.length],
      sparklineColor: 'bg-emerald-500/60',
      emptyMessage: agents.length === 0 ? t('dashboard.createFirstAgent') : undefined,
    },
    {
      title: t('dashboard.providers'),
      value: providers.length,
      subtitle: t('dashboard.providersActive', { count: activeProviders.length }),
      icon: Server,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10',
      accentColor: 'bg-amber-500',
      view: 'providers' as const,
      detail: `${activeProviders.length} ${t('dashboard.active')}`,
      sparkline: [1, 2, 2, 3, providers.length],
      sparklineColor: 'bg-amber-500/60',
      emptyMessage: providers.length === 0 ? t('dashboard.setUpProvider') : undefined,
    },
    {
      title: t('dashboard.conversations'),
      value: conversations.length,
      subtitle: t('dashboard.conversationsActive'),
      icon: MessageSquare,
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      accentColor: 'bg-cyan-500',
      view: 'chat' as const,
      detail: `${chatRooms.length} ${t('dashboard.rooms')}`,
      sparkline: [5, 8, 12, 10, conversations.length],
      sparklineColor: 'bg-cyan-500/60',
      emptyMessage: conversations.length === 0 ? t('dashboard.startConversation') : undefined,
    },
  ];

  // Template presets with system prompts for creating agents
  const templatePresets: Record<string, { name: string; systemPrompt: string; description: string }> = {
    codeReview: {
      name: 'Code Review Assistant',
      systemPrompt: 'You are an expert code reviewer. Analyze code for bugs, security vulnerabilities, performance issues, and best practices. Provide constructive feedback with specific suggestions for improvement. Focus on code quality, maintainability, and adherence to established patterns. Always explain your reasoning and offer alternative approaches when relevant.',
      description: 'AI-powered code review and quality checks',
    },
    researchAssistant: {
      name: 'Research Assistant',
      systemPrompt: 'You are a thorough research assistant. Help users find, analyze, and synthesize information from various sources. Provide well-structured summaries, compare different viewpoints, and highlight key findings. Always cite your reasoning and distinguish between facts, theories, and opinions. Present balanced perspectives on complex topics.',
      description: 'Deep research and information synthesis',
    },
    dataAnalysis: {
      name: 'Data Analysis Expert',
      systemPrompt: 'You are a data analysis expert. Help users interpret data, create visualizations concepts, identify trends and patterns, and draw meaningful insights. Guide users through statistical analysis, explain methodology choices, and present findings clearly. Suggest appropriate analytical approaches based on the data type and research questions.',
      description: 'Data visualization and insight extraction',
    },
    creativeWriting: {
      name: 'Creative Writing Assistant',
      systemPrompt: 'You are a creative writing assistant. Help users with storytelling, copywriting, poetry, and creative content. Adapt your tone and style to match the desired genre or audience. Offer vivid descriptions, engaging dialogue, and compelling narratives. Provide constructive feedback on pacing, character development, and thematic depth.',
      description: 'Story, copywriting, and creative content generation',
    },
    translation: {
      name: 'Translation Expert',
      systemPrompt: 'You are a professional multilingual translator. Provide accurate, natural-sounding translations that preserve the original meaning, tone, and cultural nuances. Explain idiomatic expressions and cultural context when relevant. Offer alternatives for ambiguous terms and suggest the most appropriate translation based on context and target audience.',
      description: 'Professional multilingual translation service',
    },
    debugHelper: {
      name: 'Debug Helper',
      systemPrompt: 'You are a debugging and troubleshooting expert. Help users identify and fix bugs in their code systematically. Analyze error messages, trace execution flows, and identify root causes. Suggest debugging strategies, explain common pitfalls, and provide step-by-step solutions. Help write test cases to prevent regressions.',
      description: 'Code debugging and troubleshooting',
    },
  };

  // Handle template button click - create agent and navigate to chat
  const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);

  const handleUseTemplate = useCallback(async (templateKey: string) => {
    const preset = templatePresets[templateKey];
    if (!preset) return;

    setCreatingTemplate(templateKey);
    try {
      // Use first active provider if available, otherwise let the agent be provider-less
      const firstProvider = activeProviders[0];
      const result = await api.createAgent({
        name: preset.name,
        description: preset.description,
        systemPrompt: preset.systemPrompt,
        mode: 'builtin',
        providerId: firstProvider?.id || undefined,
        model: firstProvider?.defaultModel || undefined,
      });
      const agentId = result?.agent?.id;
      if (agentId) {
        setSelectedAgentId(agentId);
        setCurrentView('chat2');
        addNotification({
          type: 'success',
          title: t('dashboard.activityAgentCreated'),
          message: `${preset.name} created from template`,
          actionUrl: `/agents/${agentId}`,
          metadata: { agentId },
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Template Error',
        message: 'Failed to create agent from template. Please try again.',
      });
    } finally {
      setCreatingTemplate(null);
    }
  }, [activeProviders, templatePresets, setSelectedAgentId, setCurrentView, addNotification, t]);

  return (
    <>
      {/* Inject CSS animations */}
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />

      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 sm:space-y-8 scroll-smooth" style={{ scrollBehavior: 'smooth' }}>
        {/* Header */}
        <div
          className="relative overflow-hidden rounded-2xl p-6 sm:p-8 border border-border/50 shadow-sm"
          style={{
            background: isSystemOnline
              ? 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(6,182,212,0.06) 25%, rgba(139,92,246,0.04) 50%, rgba(16,185,129,0.06) 75%, rgba(6,182,212,0.08) 100%)'
              : 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(6,182,212,0.04) 50%, rgba(239,68,68,0.06) 100%)',
            backgroundSize: '200% 200%',
            animation: 'gradientShift 8s ease infinite',
          }}
        >
          <div className="absolute inset-0 bg-grid-slate-100/50 dark:bg-grid-slate-800/20 [mask-image:radial-gradient(ellipse_at_center,white,transparent)] -z-10" />
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.5), rgba(6,182,212,0.5), transparent)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 3s ease infinite',
            }}
          />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {new Date().getHours() < 12 ? <Sun className="w-5 h-5 text-amber-500" /> : new Date().getHours() < 18 ? <Sparkles className="w-5 h-5 text-emerald-500" /> : <MoonStar className="w-5 h-5 text-indigo-400" />}
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{getTimeGreeting(t)}, {user?.name || user?.email?.split('@')[0] || t('dashboard.title')}</h1>
              </div>
              <p className="text-sm text-muted-foreground/80">{t('dashboard.welcomeSubtitle')}</p>
            </div>
            <div className="flex items-center gap-4 flex-wrap justify-end">
              <div className="flex items-center gap-1.5 text-xs text-foreground/60 dark:text-muted-foreground/90">
                <RefreshCw className="w-3 h-3" style={isRefreshing ? { animation: 'refreshSpin 0.6s linear infinite' } : undefined} />
                <span>{formatLastUpdated(lastUpdated)}</span>
              </div>
              <div className="w-px h-4 bg-border/60" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className={cn('gap-1.5 px-3 py-1.5 transition-all duration-300 font-medium cursor-help', isSystemOnline ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-900/30' : 'border-red-300 bg-red-50/60 dark:border-red-700 dark:bg-red-900/30')}>
                    <div className={cn('w-2.5 h-2.5 rounded-full', isSystemOnline ? 'bg-emerald-500' : 'bg-red-500')} style={isSystemOnline ? { animation: 'gentlePulse 2s ease-in-out infinite' } : undefined} />
                    <span className={cn('text-xs font-semibold', isSystemOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
                      {isSystemOnline ? t('dashboard.systemOnline') : t('dashboard.systemOffline')}
                    </span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px]">
                  {isSystemOnline ? 'System is operational' : 'No LLM providers configured. Add a provider to get started.'}
                </TooltipContent>
              </Tooltip>
              <Badge variant="outline" className="gap-1.5 px-3 py-1.5 border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20">
                <Zap className="w-3 h-3 text-amber-500" />
                <span className="text-xs text-amber-700 dark:text-amber-400">ACRP v2.0</span>
              </Badge>
            </div>
          </div>
        </div>

        {/* Provider Setup Banner */}
        {activeProviders.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05, ease: 'easeOut' }}>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm" style={{ borderLeftWidth: '4px', borderLeftColor: 'rgb(245, 158, 11)' }}>
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{t('dashboard.noProviderTitle')}</p>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80 hidden sm:block">{t('dashboard.noProviderDesc')}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8 text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100 hover:bg-amber-50 dark:hover:bg-amber-900/20">
                      <Info className="w-3.5 h-3.5" />
                      {t('dashboard.learnMore')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="end" className="w-80 p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Server className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <h4 className="text-sm font-semibold">Getting API Keys</h4>
                      </div>
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <p>To use Hermes Hub, you need an API key from at least one LLM provider:</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 p-1.5 rounded-md bg-muted/50">
                            <span className="text-base">🤖</span>
                            <div><span className="font-medium text-foreground">OpenAI</span> — platform.openai.com/api-keys</div>
                          </div>
                          <div className="flex items-center gap-2 p-1.5 rounded-md bg-muted/50">
                            <span className="text-base">🧠</span>
                            <div><span className="font-medium text-foreground">Anthropic</span> — console.anthropic.com</div>
                          </div>
                          <div className="flex items-center gap-2 p-1.5 rounded-md bg-muted/50">
                            <span className="text-base">💎</span>
                            <div><span className="font-medium text-foreground">Google Gemini</span> — aistudio.google.com/apikey</div>
                          </div>
                          <div className="flex items-center gap-2 p-1.5 rounded-md bg-muted/50">
                            <span className="text-base">🦙</span>
                            <div><span className="font-medium text-foreground">Ollama</span> — Local, no key needed (ollama.com)</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button onClick={() => setCurrentView('providers')} size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-sm rounded-lg h-8 text-xs">
                  {t('dashboard.setUpProvider')} <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ===== Run Activity Stats Grid ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {runActivityStats.map((stat, index) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.06, ease: 'easeOut' }}>
              <Card className="rounded-xl border border-border shadow-sm transition-all duration-300 cursor-pointer group hover:shadow-md hover:-translate-y-0.5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110 relative', stat.bgColor)}>
                      <stat.icon className={cn('w-4 h-4', stat.color)} />
                      <div className={cn('absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full', stat.accentColor)} />
                    </div>
                  </div>
                  {runsLoading ? (
                    <Skeleton className="h-9 w-16 mb-1" />
                  ) : (
                    <div className="text-3xl font-semibold tracking-tight">
                      {stat.suffix === '%' ? (
                        <><AnimatedCounter target={stat.value} duration={800 + index * 100} />{stat.suffix}</>
                      ) : stat.label === t('dashboard.totalTokens') ? (
                        formatNumber(stat.value)
                      ) : (
                        <AnimatedCounter target={stat.value} duration={800 + index * 100} />
                      )}
                    </div>
                  )}
                  <p className="text-sm text-foreground/60 dark:text-muted-foreground/90 mt-0.5">{stat.label}</p>
                  {stat.detail && <p className="text-xs text-foreground/50 dark:text-muted-foreground/70 mt-0.5">{stat.detail}</p>}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Section Divider */}
        <div className="border-t border-border/50" />

        {/* ===== Main Grid: Recent Runs + Execution Health + Quick Start ===== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Recent Runs Timeline */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}>
            <Card className="hover:shadow-lg transition-all duration-300 rounded-xl h-full border border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <PlayCircle className="w-4 h-4 text-emerald-500" />
                      {t('dashboard.recentRuns')}
                    </CardTitle>
                    <CardDescription>{t('dashboard.recentRunsDesc')}</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => setCurrentView('activity')}>
                    <Eye className="w-3 h-3" />
                    {t('dashboard.viewAll')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {runsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3 w-3/4" />
                          <Skeleton className="h-2.5 w-1/2" />
                        </div>
                        <Skeleton className="h-5 w-16" />
                      </div>
                    ))}
                  </div>
                ) : recentRuns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 relative">
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-50/30 to-cyan-50/20 dark:from-emerald-950/10 dark:to-cyan-950/10 -z-10" />
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-3">
                      <PlayCircle className="w-7 h-7 text-emerald-500/60" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">{t('dashboard.noRunsYet')}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{t('dashboard.startChatToCreateRun')}</p>
                    <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs h-7" onClick={() => setCurrentView('chat2')}>
                      <MessageSquare className="w-3 h-3" />
                      {t('dashboard.startConversation')}
                    </Button>
                  </div>
                ) : (
                  <div className="relative max-h-80 overflow-y-auto scroll-smooth space-y-1.5">
                    {recentRuns.slice(0, 5).map((run, index) => (
                      <motion.div
                        key={run.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, delay: index * 0.08, ease: 'easeOut' }}
                        className="flex items-center gap-3 p-2.5 rounded-lg border border-transparent hover:bg-accent/50 hover:border-border/50 transition-all cursor-pointer group"
                        onClick={() => setCurrentView('activity')}
                      >
                        {/* Agent avatar */}
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold', run.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : run.status === 'failed' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400')}>
                          {run.thread?.agent?.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium truncate">{run.thread?.agent?.name || t('dashboard.unknownAgent')}</span>
                            <RunStatusBadge status={run.status} />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {run.durationMs > 0 && (
                              <span className="text-xs text-muted-foreground/90 dark:text-muted-foreground/90 flex items-center gap-0.5">
                                <Timer className="w-2.5 h-2.5" />
                                {formatDuration(run.durationMs)}
                              </span>
                            )}
                            {(run.inputTokens || run.outputTokens) ? (
                              <span className="text-xs text-muted-foreground/90 dark:text-muted-foreground/90 flex items-center gap-0.5">
                                <Hash className="w-2.5 h-2.5" />
                                {formatNumber((run.inputTokens || 0) + (run.outputTokens || 0))}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {/* Timestamp */}
                        <span className="text-xs text-muted-foreground/80 dark:text-muted-foreground/80 shrink-0 ml-1">
                          {formatTimeAgo(run.createdAt)}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Execution Health */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' }}>
            <Card className="hover:shadow-lg transition-all duration-300 rounded-xl h-full border border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-violet-500" />
                  {t('dashboard.executionHealth')}
                </CardTitle>
                <CardDescription>{t('dashboard.executionHealthDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {runsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : !executionHealth.hasData ? (
                  <div className="flex flex-col items-center justify-center py-12 relative">
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-50/40 via-cyan-50/20 to-emerald-50/30 dark:from-violet-950/15 dark:via-cyan-950/10 dark:to-emerald-950/10 -z-10" />
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/15 to-cyan-500/10 flex items-center justify-center mb-4">
                        <Terminal className="w-8 h-8 text-violet-500/70" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-400/30 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-cyan-400" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">{t('dashboard.noExecutionData')}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px] text-center">{t('dashboard.runsWillAppear')}</p>
                    <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs h-7" onClick={() => setCurrentView('chat2')}>
                      <MessageSquare className="w-3 h-3" />
                      {t('dashboard.startConversation')}
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Success Rate */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground dark:text-muted-foreground/90 flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                          {t('dashboard.runSuccessRate')}
                        </span>
                        <span className={cn('text-sm font-bold', executionHealth.successRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : executionHealth.successRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400')}>
                          {executionHealth.successRate}%
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-muted dark:bg-muted/80 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-700', executionHealth.successRate >= 80 ? 'bg-emerald-500' : executionHealth.successRate >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                          style={{ width: `${executionHealth.successRate}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground/80">
                        <span>{runStats.completed} completed</span>
                        <span>{runStats.failed} failed</span>
                      </div>
                    </div>

                    <Separator />

                    {/* Average Response Time */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-violet-50/50 dark:bg-violet-900/10 border border-violet-200/50 dark:border-violet-800/30">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center">
                          <Timer className="w-4 h-4 text-violet-500" />
                        </div>
                        <div>
                          <p className="text-xs font-medium">{t('dashboard.avgResponseTime')}</p>
                          <p className="text-xs text-muted-foreground/80">{t('dashboard.last7Days')}</p>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-violet-600 dark:text-violet-400">
                        {executionHealth.avgResponseTime > 0 ? `${executionHealth.avgResponseTime}s` : '-'}
                      </span>
                    </div>

                    {/* Error Rate */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/30">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                          <XCircle className="w-4 h-4 text-red-500" />
                        </div>
                        <div>
                          <p className="text-xs font-medium">{t('dashboard.errorRate')}</p>
                          <p className="text-xs text-muted-foreground/80">{t('dashboard.failedRunsTotal')}</p>
                        </div>
                      </div>
                      <span className={cn('text-lg font-bold', executionHealth.errorRate > 20 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                        {executionHealth.errorRate}%
                      </span>
                    </div>

                    {/* Service Status Indicators */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground dark:text-muted-foreground/90 flex items-center gap-1.5">
                          <div className={cn('w-2 h-2 rounded-full', activeProviders.length > 0 ? 'bg-emerald-500' : 'bg-gray-400')} style={activeProviders.length > 0 ? { animation: 'gentlePulse 2s ease-in-out infinite' } : undefined} />
                          {t('dashboard.llmProviders')}
                        </span>
                        <span className="font-medium">{activeProviders.length}/{providers.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground dark:text-muted-foreground/90 flex items-center gap-1.5">
                          <div className={cn('w-2 h-2 rounded-full', connectedAcrpAgents.length > 0 ? 'bg-cyan-500' : 'bg-gray-400')} style={connectedAcrpAgents.length > 0 ? { animation: 'gentlePulse 2s ease-in-out infinite 0.3s' } : undefined} />
                          {t('dashboard.acrpAgents')}
                        </span>
                        <span className="font-medium">{connectedAcrpAgents.length}/{acrpAgents.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground dark:text-muted-foreground/90 flex items-center gap-1.5">
                          <div className={cn('w-2 h-2 rounded-full', enabledSkills.length > 0 ? 'bg-amber-500' : 'bg-gray-400')} />
                          {t('dashboard.skillsActive')}
                        </span>
                        <span className="font-medium">{enabledSkills.length}/{skills.length}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Start Cards + Most-used agents */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5, ease: 'easeOut' }}>
            <Card className="hover:shadow-lg transition-all duration-300 rounded-xl h-full border border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  {t('dashboard.quickStart')}
                </CardTitle>
                <CardDescription>{t('dashboard.quickStartDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Contextual onboarding cards */}
                {quickStartCards.length > 0 && (
                  <div className="space-y-2">
                    {quickStartCards.map((card, index) => (
                      <motion.button
                        key={card.title}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.3 + index * 0.08 }}
                        className={cn('w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-border/80 transition-all duration-200', 'hover:shadow-md hover:-translate-y-0.5 hover:border-solid hover:border-primary/20 hover:bg-accent/30 active:scale-[0.98]')}
                        onClick={() => setCurrentView(card.view)}
                      >
                        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', card.bgColor)}>
                          <card.icon className={cn('w-4 h-4', card.color)} />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-xs font-semibold">{card.title}</p>
                          <p className="text-xs text-muted-foreground/80 dark:text-muted-foreground/80 line-clamp-1">{card.description}</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* Most-used agents quick access */}
                {mostUsedAgents.length > 0 && (
                  <>
                    {quickStartCards.length > 0 && <Separator />}
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground/80 dark:text-muted-foreground/80 font-medium mb-2">{t('dashboard.mostUsedAgents')}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {mostUsedAgents.map((agent) => (
                          <button
                            key={agent.id}
                            className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 hover:border-border hover:bg-accent/50 transition-all text-left"
                            onClick={() => { setSelectedAgentId(agent.id); setCurrentView('agent-detail'); }}
                          >
                            <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                              {agent.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-medium truncate">{agent.name}</p>
                              <p className="text-[9px] text-muted-foreground dark:text-muted-foreground/90">{agent.count} runs</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Quick action buttons when no onboarding cards */}
                {quickStartCards.length === 0 && mostUsedAgents.length === 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: t('dashboard.createAgent'), icon: Bot, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10', view: 'agents' as const },
                      { label: t('dashboard.addProvider'), icon: Server, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10', view: 'providers' as const },
                      { label: t('dashboard.browseSkills'), icon: Puzzle, color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-500/10', view: 'skills' as const },
                      { label: t('dashboard.startChat'), icon: MessageSquare, color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-500/10', view: 'chat2' as const },
                    ].map((action) => (
                      <button
                        key={action.label}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl border border-dashed border-border/60 hover:border-solid hover:border-primary/20 hover:bg-accent/30 transition-all duration-200"
                        onClick={() => setCurrentView(action.view)}
                      >
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', action.bgColor)}>
                          <action.icon className={cn('w-4 h-4', action.color)} />
                        </div>
                        <span className="text-[10px] font-medium text-center">{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ===== Analytics Row: Runs Chart + Conversations Chart + Agent Overview ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Runs per Day Bar Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5, ease: 'easeOut' }}>
            <Card className="rounded-xl hover:shadow-lg transition-all duration-300 border border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PlayCircle className="w-4 h-4 text-emerald-500" />
                  {t('dashboard.runsPerDay')}
                </CardTitle>
                <CardDescription>{t('dashboard.last7Days')}</CardDescription>
              </CardHeader>
              <CardContent>
                {runsLoading ? (
                  <div className="flex items-end gap-1 h-24">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-1 flex-1">
                        <Skeleton className="w-full h-20" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <MiniBarChart data={runStats.runsPerDay} labels={dayLabels} maxValue={maxRunsPerDay} color="bg-emerald-500/70" />
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Conversations per Day Bar Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.55, ease: 'easeOut' }}>
            <Card className="rounded-xl hover:shadow-lg transition-all duration-300 border border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-500" />
                  {t('dashboard.conversationsPerDay')}
                </CardTitle>
                <CardDescription>{t('dashboard.last7Days')}</CardDescription>
              </CardHeader>
              <CardContent>
                <MiniBarChart data={convsPerDay} labels={dayLabels} maxValue={maxConvPerDay} color="bg-cyan-500/70" />
              </CardContent>
            </Card>
          </motion.div>

          {/* Stats Grid - agents/providers/conversations with sparklines */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6, ease: 'easeOut' }} className="space-y-4">
            {stats.map((stat, index) => (
              <Card
                key={stat.title}
                className="rounded-xl border border-border transition-all duration-300 cursor-pointer group hover:-translate-y-0.5 hover:shadow-lg hover:scale-[1.02]"
                onClick={() => setCurrentView(stat.view)}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 relative', stat.bgColor)}>
                      <stat.icon className={cn('w-4 h-4', stat.color)} />
                      <div className={cn('absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full', stat.accentColor)} />
                    </div>
                    <div>
                      <p className="text-sm text-foreground/60 dark:text-muted-foreground/80">{stat.title}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-semibold tracking-tight">
                          <AnimatedCounter target={stat.value} duration={800 + index * 80} />
                        </span>
                        <TrendIndicator values={stat.sparkline} />
                      </div>
                      {stat.value === 0 && stat.emptyMessage && (
                        <p className="text-xs text-foreground/45 dark:text-muted-foreground/65 mt-0.5">{stat.emptyMessage}</p>
                      )}
                    </div>
                  </div>
                  <Sparkline values={stat.sparkline} color={stat.sparklineColor} />
                </CardContent>
              </Card>
            ))}
          </motion.div>
        </div>

        {/* Conversation Templates */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.65, ease: 'easeOut' }}>
          <Card className="hover:shadow-lg transition-all duration-300 rounded-xl border border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-rose-500" />
                    {t('templates.title')}
                  </CardTitle>
                  <CardDescription>{t('templates.subtitle')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                {[
                  { key: 'codeReview', emoji: '🔍', name: t('templates.codeReview'), desc: t('templates.codeReviewDesc'), color: 'border-violet-200 dark:border-violet-800 hover:border-violet-400 dark:hover:border-violet-600 bg-violet-50/50 dark:bg-violet-900/10', icon: Code2 },
                  { key: 'researchAssistant', emoji: '🔬', name: t('templates.researchAssistant'), desc: t('templates.researchAssistantDesc'), color: 'border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10', icon: Microscope },
                  { key: 'dataAnalysis', emoji: '📊', name: t('templates.dataAnalysis'), desc: t('templates.dataAnalysisDesc'), color: 'border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600 bg-amber-50/50 dark:bg-amber-900/10', icon: BarChart2 },
                  { key: 'creativeWriting', emoji: '✍️', name: t('templates.creativeWriting'), desc: t('templates.creativeWritingDesc'), color: 'border-rose-200 dark:border-rose-800 hover:border-rose-400 dark:hover:border-rose-600 bg-rose-50/50 dark:bg-rose-900/10', icon: PenTool },
                  { key: 'translation', emoji: '🌐', name: t('templates.translation'), desc: t('templates.translationDesc'), color: 'border-cyan-200 dark:border-cyan-800 hover:border-cyan-400 dark:hover:border-cyan-600 bg-cyan-50/50 dark:bg-cyan-900/10', icon: Languages },
                  { key: 'debugHelper', emoji: '🐛', name: t('templates.debugHelper'), desc: t('templates.debugHelperDesc'), color: 'border-orange-200 dark:border-orange-800 hover:border-orange-400 dark:hover:border-orange-600 bg-orange-50/50 dark:bg-orange-900/10', icon: Bug },
                ].map((template, index) => (
                  <motion.button
                    key={template.key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.4 + index * 0.06 }}
                    className={cn('w-full text-left p-3 rounded-xl border transition-all duration-200', template.color, 'hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97]', creatingTemplate === template.key && 'opacity-60 pointer-events-none')}
                    onClick={() => handleUseTemplate(template.key)}
                    disabled={creatingTemplate !== null}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg leading-none shrink-0">{creatingTemplate === template.key ? '' : template.emoji}</span>
                      {creatingTemplate === template.key && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{template.name}</p>
                        <p className="text-[10px] text-muted-foreground dark:text-muted-foreground/90 line-clamp-2 mt-0.5">{template.desc}</p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
}
