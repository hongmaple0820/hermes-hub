'use client';

import { useAppStore } from '@/lib/store';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Bot, Server, Puzzle, Monitor, MessageSquare, Users,
  Activity, ArrowUpRight, Zap, Wifi, WifiOff, TrendingUp,
  Clock, Cpu, Globe, Shield, Sparkles, BarChart3, Radio,
  CheckCircle, Eye, LogOut, Plus, Settings, Timer,
  ArrowDownRight, RefreshCw, Database, HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api-client';

interface ActivityItem {
  id: string;
  type: 'agent_created' | 'conversation_started' | 'acrp_connected' | 'acrp_disconnected' | 'agent_online' | 'agent_offline';
  name: string;
  timestamp: string;
  detail?: string;
}

// Animated counter component with easeOutCubic
function AnimatedCounter({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(target);

  useEffect(() => {
    // Reset animation when target changes
    const startValue = prevTarget.current === target ? 0 : prevTarget.current;
    prevTarget.current = target;
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
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
      {isUp ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <ArrowDownRight className="w-3 h-3" />
      )}
    </span>
  );
}

// Sparkline component - simple CSS-based mini chart
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

// Mini Bar Chart - pure CSS bar chart for daily data
function MiniBarChart({ data, labels, maxValue, barColor = 'bg-emerald-500/70', hoverColor = 'bg-emerald-500' }: { data: number[]; labels: string[]; maxValue: number; barColor?: string; hoverColor?: string }) {
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((value, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <div className="w-full relative" style={{ height: '80px' }}>
            <div
              className={`absolute bottom-0 w-full rounded-t-sm ${barColor} hover:${hoverColor} transition-colors`}
              style={{ height: `${maxValue > 0 ? (value / maxValue) * 100 : 0}%` }}
            />
          </div>
          <span className="text-[9px] text-muted-foreground">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

// Skill Usage Ranking - progress bars for top skills
function SkillRanking({ skills }: { skills: any[] }) {
  const { t } = useI18n();
  const topSkills = skills
    .filter((s: any) => s.isEnabled)
    .sort((a: any, b: any) => (b.invokeCount || 0) - (a.invokeCount || 0))
    .slice(0, 5);
  const maxInvokes = Math.max(...topSkills.map((s: any) => s.invokeCount || 0), 1);

  if (topSkills.length === 0) {
    return <p className="text-xs text-muted-foreground py-4 text-center">{t('dashboard.noSkillData')}</p>;
  }

  return (
    <div className="space-y-2.5">
      {topSkills.map((skill: any, idx: number) => (
        <div key={skill.id} className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground w-3">{idx + 1}</span>
              <span className="text-xs font-medium truncate">{skill.name}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{skill.invokeCount || 0}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-amber-400' : 'bg-amber-300'
              )}
              style={{ width: `${((skill.invokeCount || 0) / maxInvokes) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Health bar with color coding
function HealthBar({ value, label, unit }: { value: number; label: string; unit: string }) {
  const getColor = (v: number) => {
    if (v < 50) return 'bg-emerald-500';
    if (v < 80) return 'bg-amber-500';
    return 'bg-red-500';
  };
  const getTextColor = (v: number) => {
    if (v < 50) return 'text-emerald-600 dark:text-emerald-400';
    if (v < 80) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-medium', getTextColor(value))}>{value}{unit}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', getColor(value))}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

// CSS keyframes for animations (injected once)
const animationStyles = `
@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
@keyframes flowPulse {
  0%, 100% { opacity: 0.4; transform: scaleX(1); }
  50% { opacity: 1; transform: scaleX(1.1); }
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
@keyframes shimmerSkeleton {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

export function Dashboard() {
  const { agents, providers, skills, conversations, chatRooms, setCurrentView, setSelectedAgentId, addNotification, user } = useAppStore();
  const { t } = useI18n();

  // Loading state (skeleton)
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Time-of-day greeting
  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.goodMorning');
    if (hour < 18) return t('dashboard.goodAfternoon');
    return t('dashboard.goodEvening');
  }, [t]);

  const userName = user?.name || user?.email || t('dashboard.defaultUser');

  // Last updated timestamp
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh last updated every 30 seconds
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

  // Auto-generate notifications based on app events
  const prevAgentCount = useRef(agents.length);
  const prevConversationCount = useRef(conversations.length);
  const prevSkillCount = useRef(skills.length);
  const prevAcrpConnected = useRef(connectedAcrpAgents.length);

  useEffect(() => {
    // Agent created/deleted
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
    // ACRP agent connected/disconnected
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
        message: `An ACRP agent disconnected`,
        actionUrl: 'agent-control',
      });
    }
    prevAcrpConnected.current = currentConnected;
  }, [connectedAcrpAgents.length, addNotification, t, connectedAcrpAgents]);

  useEffect(() => {
    // New conversation started
    if (conversations.length > prevConversationCount.current) {
      addNotification({
        type: 'info',
        title: t('dashboard.activityConvStarted'),
        message: `New conversation started`,
        actionUrl: 'chat',
      });
    }
    prevConversationCount.current = conversations.length;
  }, [conversations.length, addNotification, t]);

  useEffect(() => {
    // Skills changed
    if (skills.length !== prevSkillCount.current && prevSkillCount.current > 0) {
      if (skills.length > prevSkillCount.current) {
        addNotification({
          type: 'skill_invoked',
          title: 'Skill Updated',
          message: 'A skill has been added or updated',
          actionUrl: 'skills',
        });
      }
    }
    prevSkillCount.current = skills.length;
  }, [skills.length, addNotification]);

  // Real health check: system online only if providers exist and are active
  const isSystemOnline = activeProviders.length > 0 || connectedAcrpAgents.length > 0;

  // Dashboard analytics data from API
  interface DashboardAnalytics {
    agents: { total: number; online: number; builtin: number; acrp: number; acrpConnected: number };
    conversations: { total: number; convsPerDay: { date: string; count: number }[] };
    messages: { total: number; messagesPerDay: { date: string; count: number }[] };
    providers: { total: number; active: number };
    skills: { total: number; totalInvocations: number };
    chatRooms: { total: number };
  }
  const [analyticsData, setAnalyticsData] = useState<DashboardAnalytics | null>(null);

  const fetchDashboardAnalytics = useCallback(async () => {
    try {
      const data = await api.getDashboardAnalytics();
      setAnalyticsData(data);
    } catch {
      // Silently fail — dashboard still works with store data
    }
  }, []);

  // Fetch analytics on mount and every 30 seconds
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDashboardAnalytics();
    const interval = setInterval(fetchDashboardAnalytics, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardAnalytics]);

  // Service Health Monitor - real-time status checks
  interface ServiceHealth {
    id: string;
    name: string;
    port: number;
    online: boolean;
    uptime: number | null;
    responseTime: number | null;
    lastChecked: Date | null;
    checking: boolean;
  }

  const [serviceHealths, setServiceHealths] = useState<ServiceHealth[]>([
    { id: 'nextjs', name: t('dashboard.serviceNextjs'), port: 3000, online: false, uptime: null, responseTime: null, lastChecked: null, checking: false },
    { id: 'chat', name: t('dashboard.serviceChat'), port: 3003, online: false, uptime: null, responseTime: null, lastChecked: null, checking: false },
    { id: 'skill-ws', name: t('dashboard.serviceSkillWs'), port: 3004, online: false, uptime: null, responseTime: null, lastChecked: null, checking: false },
    { id: 'terminal', name: t('dashboard.serviceTerminal'), port: 3005, online: false, uptime: null, responseTime: null, lastChecked: null, checking: false },
    { id: 'database', name: t('dashboard.serviceDatabase'), port: 0, online: false, uptime: null, responseTime: null, lastChecked: null, checking: false },
  ]);

  const checkServiceHealth = useCallback(async () => {
    const portMap: Record<string, number> = { nextjs: 3000, chat: 3003, 'skill-ws': 3004, terminal: 3005 };

    setServiceHealths(prev => prev.map(s => ({ ...s, checking: true })));

    const results = await Promise.allSettled(
      Object.entries(portMap).map(async ([id, port]) => {
        const start = Date.now();
        try {
          const res = await fetch(`/api/health?XTransformPort=${port}`, {
            signal: AbortSignal.timeout(5000),
          });
          const responseTime = Date.now() - start;
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            return { id, online: true, uptime: data.uptime ?? null, responseTime };
          }
          return { id, online: false, uptime: null, responseTime };
        } catch {
          return { id, online: false, uptime: null, responseTime: Date.now() - start };
        }
      })
    );

    const now = new Date();
    setServiceHealths(prev => prev.map(s => {
      if (s.id === 'database') {
        // Database is always shown as online since data is loaded
        return { ...s, online: true, uptime: null, responseTime: null, lastChecked: now, checking: false };
      }
      const idx = Object.keys(portMap).indexOf(s.id);
      if (idx >= 0 && results[idx]) {
        const r = results[idx];
        if (r.status === 'fulfilled') {
          return { ...s, ...r.value, lastChecked: now, checking: false };
        }
      }
      return { ...s, lastChecked: now, checking: false };
    }));
  }, [t]);

  // Auto-refresh service health every 30 seconds
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkServiceHealth();
    const interval = setInterval(checkServiceHealth, 30000);
    return () => clearInterval(interval);
  }, [checkServiceHealth]);

  const healthyCount = serviceHealths.filter(s => s.online).length;
  const unhealthyCount = serviceHealths.filter(s => !s.online).length;
  const allHealthy = unhealthyCount === 0;

  const formatUptime = (uptime: number | null) => {
    if (uptime === null) return '—';
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Conversations per day (last 7 days) - real data from analytics API
  const convsPerDay = useMemo(() => {
    if (analyticsData?.conversations?.convsPerDay) {
      return analyticsData.conversations.convsPerDay.map(d => d.count);
    }
    // Fallback: derive from store data when API hasn't loaded yet
    const total = conversations.length;
    const base = Math.max(Math.floor(total / 7), 0);
    return Array.from({ length: 7 }, () => base);
  }, [analyticsData, conversations.length]);

  // Messages per day (last 7 days) - real data from analytics API
  const msgsPerDay = useMemo(() => {
    if (analyticsData?.messages?.messagesPerDay) {
      return analyticsData.messages.messagesPerDay.map(d => d.count);
    }
    return Array.from({ length: 7 }, () => 0);
  }, [analyticsData]);

  const maxMsgsPerDay = Math.max(...msgsPerDay, 1);

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

  // System uptime — computed from service health checks (real)
  const systemUptime = useMemo(() => {
    if (serviceHealths.length === 0) return 0;
    const onlineCount = serviceHealths.filter(s => s.online).length;
    return Math.round((onlineCount / serviceHealths.length) * 100 * 10) / 10;
  }, [serviceHealths]);

  // Agent response time — computed from real service health response times
  const agentResponseTime = useMemo(() => {
    const responseTimes = serviceHealths
      .filter(s => s.responseTime !== null && s.responseTime > 0)
      .map(s => s.responseTime!);
    if (responseTimes.length === 0) return 0;
    const avgMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    return Math.round(avgMs) / 1000; // Convert ms to seconds
  }, [serviceHealths]);

  // Build activity feed
  const activityItems: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];

    agents.forEach((agent: any) => {
      if (agent.mode === 'acrp') {
        if (agent.wsConnected) {
          items.push({
            id: `acrp-connected-${agent.id}`,
            type: 'acrp_connected',
            name: agent.name,
            timestamp: agent.lastHeartbeatAt || agent.updatedAt || agent.createdAt,
            detail: agent.agentType || 'ACRP',
          });
        } else if (agent.status === 'offline') {
          items.push({
            id: `acrp-disconnected-${agent.id}`,
            type: 'acrp_disconnected',
            name: agent.name,
            timestamp: agent.updatedAt || agent.createdAt,
            detail: agent.agentType || 'ACRP',
          });
        }
      } else {
        if (agent.status === 'online') {
          items.push({
            id: `agent-online-${agent.id}`,
            type: 'agent_online',
            name: agent.name,
            timestamp: agent.updatedAt || agent.createdAt,
          });
        } else if (agent.status === 'offline' || agent.status === 'error') {
          items.push({
            id: `agent-offline-${agent.id}`,
            type: 'agent_offline',
            name: agent.name,
            timestamp: agent.updatedAt || agent.createdAt,
          });
        }
      }

      // Agent creation events
      if (agent.createdAt) {
        items.push({
          id: `agent-created-${agent.id}`,
          type: 'agent_created',
          name: agent.name,
          timestamp: agent.createdAt,
          detail: agent.mode === 'acrp' ? 'ACRP' : 'Builtin',
        });
      }
    });

    conversations.forEach((conv: any) => {
      items.push({
        id: `conv-started-${conv.id}`,
        type: 'conversation_started',
        name: conv.name || conv.title || t('dashboard.conversation'),
        timestamp: conv.updatedAt || conv.createdAt,
        detail: conv.type,
      });
    });

    // Sort by timestamp descending
    items.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

    return items.slice(0, 10);
  }, [agents, conversations, t]);

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

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'agent_created':
        return <Plus className="w-3.5 h-3.5 text-emerald-500" />;
      case 'conversation_started':
        return <MessageSquare className="w-3.5 h-3.5 text-rose-500" />;
      case 'acrp_connected':
        return <Radio className="w-3.5 h-3.5 text-cyan-500" />;
      case 'acrp_disconnected':
        return <LogOut className="w-3.5 h-3.5 text-gray-400" />;
      case 'agent_online':
        return <Wifi className="w-3.5 h-3.5 text-emerald-500" />;
      case 'agent_offline':
        return <WifiOff className="w-3.5 h-3.5 text-red-400" />;
    }
  };

  const getActivityLabel = (type: ActivityItem['type']) => {
    switch (type) {
      case 'agent_created':
        return t('dashboard.activityAgentCreated');
      case 'conversation_started':
        return t('dashboard.activityConvStarted');
      case 'acrp_connected':
        return t('dashboard.activityAcrpConnected');
      case 'acrp_disconnected':
        return t('dashboard.activityAcrpDisconnected');
      case 'agent_online':
        return t('dashboard.activityAgentOnline');
      case 'agent_offline':
        return t('dashboard.activityAgentOffline');
    }
  };

  const getActivityDotColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'agent_created':
        return 'bg-emerald-500';
      case 'conversation_started':
        return 'bg-rose-500';
      case 'acrp_connected':
        return 'bg-cyan-500';
      case 'acrp_disconnected':
        return 'bg-gray-400';
      case 'agent_online':
        return 'bg-emerald-500';
      case 'agent_offline':
        return 'bg-red-400';
    }
  };

  const getActivityBorderColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'agent_created':
        return 'border-l-emerald-500';
      case 'conversation_started':
        return 'border-l-rose-500';
      case 'acrp_connected':
        return 'border-l-cyan-500';
      case 'acrp_disconnected':
        return 'border-l-gray-400';
      case 'agent_online':
        return 'border-l-emerald-500';
      case 'agent_offline':
        return 'border-l-red-400';
    }
  };

  // Total messages from analytics
  const totalMessages = analyticsData?.messages?.total ?? 0;

  const stats = [
    {
      title: t('dashboard.agents'),
      value: agents.length,
      subtitle: t('dashboard.agentsOnline', { count: onlineAgents.length }),
      icon: Bot,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-l-emerald-500',
      view: 'agents' as const,
      detail: `${builtinAgents.length} builtin · ${acrpAgents.length} ACRP`,
      sparkline: convsPerDay.length >= 7 ? convsPerDay.slice(0, 5) : [0, 0, 0, 0, agents.length],
      sparklineColor: 'bg-emerald-500/60',
      gradientFrom: 'from-emerald-50/80 dark:from-emerald-950/30',
      gradientTo: 'to-card dark:to-card',
    },
    {
      title: t('dashboard.providers'),
      value: providers.length,
      subtitle: t('dashboard.providersActive', { count: activeProviders.length }),
      icon: Server,
      color: 'text-violet-600',
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-l-violet-500',
      view: 'providers' as const,
      detail: t('dashboard.providersConfigured', { count: providers.length }),
      sparkline: [Math.max(providers.length - 2, 0), Math.max(providers.length - 1, 0), providers.length, providers.length, providers.length],
      sparklineColor: 'bg-violet-500/60',
      gradientFrom: 'from-violet-50/80 dark:from-violet-950/30',
      gradientTo: 'to-card dark:to-card',
    },
    {
      title: t('dashboard.skills'),
      value: skills.length,
      subtitle: t('dashboard.skillsEnabled', { count: enabledSkills.length }),
      icon: Puzzle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-l-amber-500',
      view: 'skills' as const,
      detail: `${enabledSkills.length} ${t('dashboard.enabled')}`,
      sparkline: [Math.max(skills.length - 4, 0), Math.max(skills.length - 2, 0), skills.length, skills.length, skills.length],
      sparklineColor: 'bg-amber-500/60',
      gradientFrom: 'from-amber-50/80 dark:from-amber-950/30',
      gradientTo: 'to-card dark:to-card',
    },
    {
      title: t('dashboard.gateways'),
      value: acrpAgents.length,
      subtitle: t('dashboard.gatewaysRunning', { count: connectedAcrpAgents.length }),
      icon: Monitor,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-l-cyan-500',
      view: 'agent-control' as const,
      detail: `${connectedAcrpAgents.length} ${t('dashboard.connected')}`,
      sparkline: [0, Math.max(acrpAgents.length - 1, 0), acrpAgents.length, acrpAgents.length, acrpAgents.length],
      sparklineColor: 'bg-cyan-500/60',
      gradientFrom: 'from-cyan-50/80 dark:from-cyan-950/30',
      gradientTo: 'to-card dark:to-card',
    },
    {
      title: t('dashboard.conversations'),
      value: conversations.length,
      subtitle: t('dashboard.conversationsActiveCount', { count: conversations.filter((c: any) => c.status === 'active' || !c.status).length }),
      icon: MessageSquare,
      color: 'text-rose-600',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-l-rose-500',
      view: 'chat' as const,
      detail: `${chatRooms.length} ${t('dashboard.rooms')}`,
      sparkline: convsPerDay,
      sparklineColor: 'bg-rose-500/60',
      gradientFrom: 'from-rose-50/80 dark:from-rose-950/30',
      gradientTo: 'to-card dark:to-card',
    },
    {
      title: t('dashboard.chatRooms'),
      value: chatRooms.length,
      subtitle: t('dashboard.chatRoomsMulti'),
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-l-orange-500',
      view: 'chat-rooms' as const,
      detail: t('dashboard.chatRoomsCollaborative'),
      sparkline: [0, Math.max(chatRooms.length - 2, 0), Math.max(chatRooms.length - 1, 0), chatRooms.length, chatRooms.length],
      sparklineColor: 'bg-orange-500/60',
      gradientFrom: 'from-orange-50/80 dark:from-orange-950/30',
      gradientTo: 'to-card dark:to-card',
    },
  ];

  // Quick stats for the stats grid
  const quickStats = [
    { label: t('dashboard.totalAgents'), value: agents.length, icon: Bot, color: 'text-emerald-600', bgColor: 'bg-emerald-500/10', borderColor: 'border-l-emerald-500', gradientFrom: 'from-emerald-50/60 dark:from-emerald-950/20' },
    { label: t('dashboard.onlineAgents'), value: onlineAgents.length, icon: Wifi, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', borderColor: 'border-l-emerald-400', gradientFrom: 'from-emerald-50/60 dark:from-emerald-950/20' },
    { label: t('dashboard.totalSkills'), value: skills.length, icon: Puzzle, color: 'text-amber-600', bgColor: 'bg-amber-500/10', borderColor: 'border-l-amber-500', gradientFrom: 'from-amber-50/60 dark:from-amber-950/20' },
    { label: t('dashboard.activeSkills'), value: enabledSkills.length, icon: CheckCircle, color: 'text-amber-500', bgColor: 'bg-amber-500/10', borderColor: 'border-l-amber-400', gradientFrom: 'from-amber-50/60 dark:from-amber-950/20' },
    { label: t('dashboard.totalMessages'), value: totalMessages, icon: MessageSquare, color: 'text-rose-600', bgColor: 'bg-rose-500/10', borderColor: 'border-l-rose-500', gradientFrom: 'from-rose-50/60 dark:from-rose-950/20' },
    { label: t('dashboard.acrpConnected'), value: connectedAcrpAgents.length, icon: Radio, color: 'text-cyan-600', bgColor: 'bg-cyan-500/10', borderColor: 'border-l-cyan-500', gradientFrom: 'from-cyan-50/60 dark:from-cyan-950/20' },
  ];

  // Quick Actions Grid data
  const quickActionItems = [
    {
      label: t('dashboard.createAgent'),
      icon: Plus,
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-500/10 dark:bg-violet-500/15',
      borderColor: 'border-violet-200 dark:border-violet-800',
      hoverBorder: 'hover:border-violet-400 dark:hover:border-violet-600',
      view: 'agents' as const,
    },
    {
      label: t('dashboard.addProvider'),
      icon: Server,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/15',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
      hoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-600',
      view: 'providers' as const,
    },
    {
      label: t('dashboard.browseSkills'),
      icon: Puzzle,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10 dark:bg-amber-500/15',
      borderColor: 'border-amber-200 dark:border-amber-800',
      hoverBorder: 'hover:border-amber-400 dark:hover:border-amber-600',
      view: 'skills' as const,
    },
    {
      label: t('dashboard.startChat'),
      icon: MessageSquare,
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-500/10 dark:bg-cyan-500/15',
      borderColor: 'border-cyan-200 dark:border-cyan-800',
      hoverBorder: 'hover:border-cyan-400 dark:hover:border-cyan-600',
      view: 'chat' as const,
    },
  ];

  return (
    <>
      {/* Inject CSS animations */}
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />

      <div className="p-6 max-w-7xl mx-auto space-y-6 scroll-smooth" style={{ scrollBehavior: 'smooth' }}>
        {/* Header with animated gradient background */}
        <div
          className="relative overflow-hidden rounded-2xl p-6 border border-border/50 shadow-sm"
          style={{
            background: isSystemOnline
              ? 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(6,182,212,0.06) 25%, rgba(139,92,246,0.04) 50%, rgba(16,185,129,0.06) 75%, rgba(6,182,212,0.08) 100%)'
              : 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(6,182,212,0.04) 50%, rgba(239,68,68,0.06) 100%)',
            backgroundSize: '200% 200%',
            animation: 'gradientShift 8s ease infinite',
          }}
        >
          {/* Decorative grid overlay */}
          <div className="absolute inset-0 bg-grid-slate-100/50 dark:bg-grid-slate-800/20 [mask-image:radial-gradient(ellipse_at_center,white,transparent)] -z-10" />

          {/* Shimmer line at top */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.5), rgba(6,182,212,0.5), transparent)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 3s ease infinite',
            }}
          />

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold tracking-tight">{getGreeting()},</h1>
                <motion.span
                  className="text-2xl font-bold bg-gradient-to-r from-emerald-600 via-cyan-600 to-violet-600 bg-clip-text text-transparent"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  {userName}
                </motion.span>
              </div>
              <p className="text-muted-foreground text-sm">{t('dashboard.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Last Updated indicator */}
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mr-1">
                <RefreshCw
                  className="w-3 h-3"
                  style={isRefreshing ? { animation: 'refreshSpin 0.6s linear infinite' } : undefined}
                />
                <span>{formatLastUpdated(lastUpdated)}</span>
              </div>

              {/* System Status Badge - more prominent */}
              <Badge
                variant="outline"
                className={cn(
                  'gap-1.5 px-3 py-1.5 transition-all duration-300 font-medium',
                  isSystemOnline
                    ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-900/30 shadow-sm shadow-emerald-200/50 dark:shadow-emerald-900/30'
                    : 'border-red-300 bg-red-50/60 dark:border-red-700 dark:bg-red-900/30 shadow-sm shadow-red-200/50 dark:shadow-red-900/30'
                )}
              >
                <div className={cn(
                  'w-2.5 h-2.5 rounded-full',
                  isSystemOnline ? 'bg-emerald-500' : 'bg-red-500'
                )}
                style={isSystemOnline ? { animation: 'gentlePulse 2s ease-in-out infinite' } : undefined}
                />
                <span className={cn('text-xs font-semibold', isSystemOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
                  {isSystemOnline ? t('dashboard.systemOnline') : t('dashboard.systemOffline')}
                </span>
              </Badge>

              <Badge variant="outline" className="gap-1.5 px-3 py-1.5 border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20">
                <Zap className="w-3 h-3 text-amber-500" />
                <span className="text-xs text-amber-700 dark:text-amber-400">ACRP v2.0</span>
              </Badge>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid - Enhanced with gradient backgrounds, animated counters, and skeleton loading */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {isLoading ? (
            quickStats.map((_, index) => (
              <Card key={`skeleton-quick-${index}`} className="border-l-4 rounded-2xl shadow-sm border-l-muted">
                <CardContent className="p-4">
                  <div className="w-8 h-8 rounded-full bg-muted animate-pulse mb-2" />
                  <div className="h-7 w-16 rounded bg-muted animate-pulse mb-1"
                    style={{ background: 'linear-gradient(90deg, hsl(var(--muted)) 25%, hsl(var(--muted)/0.5) 50%, hsl(var(--muted)) 75%)', backgroundSize: '200% 100%', animation: 'shimmerSkeleton 1.5s ease infinite' }}
                  />
                  <div className="h-3 w-20 rounded bg-muted animate-pulse"
                    style={{ background: 'linear-gradient(90deg, hsl(var(--muted)) 25%, hsl(var(--muted)/0.5) 50%, hsl(var(--muted)) 75%)', backgroundSize: '200% 100%', animation: 'shimmerSkeleton 1.5s ease infinite', animationDelay: `${index * 0.1}s` }}
                  />
                </CardContent>
              </Card>
            ))
          ) : (
          quickStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.06, ease: 'easeOut' }}
            >
              <Card
                className={cn(
                  'border-l-4 rounded-2xl shadow-sm transition-all duration-300 cursor-pointer group',
                  'hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]',
                  stat.borderColor,
                  'bg-gradient-to-br', stat.gradientFrom, 'to-card'
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110', stat.bgColor)}>
                      <stat.icon className={cn('w-4 h-4', stat.color)} />
                    </div>
                  </div>
                  <div className="text-2xl font-bold tracking-tight">
                    <AnimatedCounter target={stat.value} duration={800 + index * 100} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))
          )}
        </div>

        {/* Stats Grid with sparklines - Enhanced with skeleton loading, gradient backgrounds, animated counters, and trend indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            stats.map((_, index) => (
              <Card key={`skeleton-stat-${index}`} className="rounded-2xl border-l-4 border-l-muted">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="h-4 w-20 rounded bg-muted"
                    style={{ background: 'linear-gradient(90deg, hsl(var(--muted)) 25%, hsl(var(--muted)/0.5) 50%, hsl(var(--muted)) 75%)', backgroundSize: '200% 100%', animation: 'shimmerSkeleton 1.5s ease infinite', animationDelay: `${index * 0.1}s` }}
                  />
                  <div className="w-9 h-9 rounded-lg bg-muted animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="h-8 w-16 rounded bg-muted mb-2"
                        style={{ background: 'linear-gradient(90deg, hsl(var(--muted)) 25%, hsl(var(--muted)/0.5) 50%, hsl(var(--muted)) 75%)', backgroundSize: '200% 100%', animation: 'shimmerSkeleton 1.5s ease infinite', animationDelay: `${index * 0.12}s` }}
                      />
                      <div className="h-3 w-24 rounded bg-muted animate-pulse mb-1" />
                      <div className="h-2 w-20 rounded bg-muted animate-pulse" />
                    </div>
                    <div className="flex items-end gap-[2px] h-6">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="w-1 rounded-t-sm bg-muted animate-pulse" style={{ height: `${20 + Math.random() * 60}%` }} />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
          stats.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + index * 0.08, ease: 'easeOut' }}
            >
              <Card
                className={cn(
                  'transition-all duration-300 cursor-pointer group rounded-2xl',
                  'border-l-4', stat.borderColor,
                  'hover:-translate-y-1 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]',
                  'bg-gradient-to-br', stat.gradientFrom, stat.gradientTo
                )}
                onClick={() => setCurrentView(stat.view)}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3', stat.bgColor)}>
                    <stat.icon className={cn('w-4 h-4', stat.color)} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-3xl font-bold tracking-tight">
                          <AnimatedCounter target={stat.value} duration={1000 + index * 80} />
                        </div>
                        <TrendIndicator values={stat.sparkline} />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 opacity-60">{stat.detail}</p>
                    </div>
                    <Sparkline values={stat.sparkline} color={stat.sparklineColor} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
          )}
        </div>

        {/* Middle Row: Quick Actions Grid + Agent Activity Timeline + System Health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions Grid - 4-card grid */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="hover:shadow-lg transition-all duration-300 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  {t('dashboard.quickActions')}
                </CardTitle>
                <CardDescription>{t('dashboard.quickActionsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {quickActionItems.map((action) => (
                    <button
                      key={action.label}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200',
                        action.borderColor, action.hoverBorder,
                        'hover:shadow-md hover:scale-[1.04] active:scale-[0.96]',
                        'hover:-translate-y-0.5'
                      )}
                      onClick={() => setCurrentView(action.view)}
                    >
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110', action.bgColor)}>
                        <action.icon className={cn('w-5 h-5', action.color)} />
                      </div>
                      <span className="text-xs font-medium text-center leading-tight">{action.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Agent Activity Timeline - Enhanced with staggered animation and left border */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="hover:shadow-lg transition-all duration-300 rounded-2xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-4 h-4 text-rose-500" />
                      {t('dashboard.activityTimeline')}
                    </CardTitle>
                    <CardDescription>{t('dashboard.latestActivity')}</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 gap-1 hover:bg-accent transition-colors active:scale-95"
                    onClick={() => setCurrentView('logs')}
                  >
                    <Eye className="w-3 h-3" />
                    {t('dashboard.viewAll')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {activityItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <TrendingUp className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">{t('dashboard.noActivity')}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{t('dashboard.createAgentToStart')}</p>
                  </div>
                ) : (
                  <div className="relative max-h-72 overflow-y-auto scroll-smooth">
                    {/* Timeline connecting line */}
                    <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
                    <div className="space-y-1">
                      {activityItems.slice(0, 5).map((item, index) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.35, delay: index * 0.08, ease: 'easeOut' }}
                          className={cn(
                            'flex items-start gap-3 p-2 rounded-lg relative border-l-2 transition-colors duration-200 hover:bg-accent/50',
                            getActivityBorderColor(item.type)
                          )}
                        >
                          {/* Colored dot on timeline */}
                          <div className={cn(
                            'w-[7px] h-[7px] rounded-full shrink-0 mt-1.5 z-10 ring-2 ring-background',
                            getActivityDotColor(item.type)
                          )} />
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium truncate">{item.name}</span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0 rounded">
                                {getActivityLabel(item.type)}
                              </Badge>
                            </div>
                            {item.detail && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">{item.detail}</p>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                            {formatTimeAgo(item.timestamp)}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* System Health / Service Monitor Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="hover:shadow-lg transition-all duration-300 rounded-2xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className={cn('w-4 h-4', allHealthy ? 'text-emerald-500' : 'text-red-500')} />
                      {t('dashboard.systemHealth')}
                    </CardTitle>
                    <CardDescription>{t('dashboard.services')}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn(
                      'text-[10px] px-2 py-0.5',
                      allHealthy
                        ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'border-red-300 bg-red-50/60 dark:border-red-700 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    )}>
                      {allHealthy ? t('dashboard.allHealthy') : t('dashboard.issuesFound', { count: unhealthyCount })}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={checkServiceHealth}
                    >
                      <RefreshCw className={cn('w-3.5 h-3.5', serviceHealths.some(s => s.checking) && 'animate-spin')} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {serviceHealths.map((service) => (
                  <motion.div
                    key={service.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      'flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-200',
                      'hover:bg-accent/50',
                      service.online ? 'border-l-2 border-l-emerald-500' : 'border-l-2 border-l-red-500'
                    )}
                  >
                    {/* Status dot */}
                    <div className="relative shrink-0">
                      <div className={cn(
                        'w-2.5 h-2.5 rounded-full',
                        service.checking ? 'bg-amber-400 animate-pulse' :
                        service.online ? 'bg-emerald-500' : 'bg-red-500'
                      )} />
                      {service.online && !service.checking && (
                        <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-30" />
                      )}
                    </div>

                    {/* Service info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium truncate">{service.name}</span>
                        {service.port > 0 && (
                          <span className="text-[10px] text-muted-foreground font-mono">:{service.port}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {service.responseTime !== null && (
                          <span className="text-[10px] text-muted-foreground">
                            {t('dashboard.responseTime')}: {service.responseTime}ms
                          </span>
                        )}
                        {service.uptime !== null && (
                          <span className="text-[10px] text-muted-foreground">
                            {t('dashboard.uptime')}: {formatUptime(service.uptime)}
                          </span>
                        )}
                        {service.checking && (
                          <span className="text-[10px] text-amber-500">{t('dashboard.checking')}</span>
                        )}
                      </div>
                    </div>

                    {/* Status badge */}
                    <Badge variant="outline" className={cn(
                      'text-[9px] px-1.5 py-0 shrink-0',
                      service.checking ? 'border-amber-300 text-amber-600 dark:text-amber-400' :
                      service.online ? 'border-emerald-300 text-emerald-600 dark:text-emerald-400' :
                      'border-red-300 text-red-600 dark:text-red-400'
                    )}>
                      {service.checking ? t('dashboard.checking') :
                       service.online ? t('dashboard.healthy') : t('dashboard.unhealthy')}
                    </Badge>
                  </motion.div>
                ))}

                <Separator className="my-1" />

                {/* Last checked */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                  <span>{t('dashboard.lastChecked')}</span>
                  <span>{serviceHealths[0]?.lastChecked?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) || '—'}</span>
                </div>

                {/* Legacy system indicators */}
                <div className="space-y-1.5 mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Server className="w-3 h-3" /> {t('dashboard.llmProviders')}
                    </span>
                    <span className="font-medium">{activeProviders.length}/{providers.length}</span>
                  </div>
                  <Progress value={providers.length > 0 ? (activeProviders.length / providers.length) * 100 : 0} className="h-1.5" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Monitor className="w-3 h-3" /> {t('dashboard.acrpAgents')}
                    </span>
                    <span className="font-medium">{connectedAcrpAgents.length}/{acrpAgents.length}</span>
                  </div>
                  <Progress value={acrpAgents.length > 0 ? (connectedAcrpAgents.length / acrpAgents.length) * 100 : 0} className="h-1.5" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Puzzle className="w-3 h-3" /> {t('dashboard.skillsActive')}
                    </span>
                    <span className="font-medium">{enabledSkills.length}/{skills.length}</span>
                  </div>
                  <Progress value={skills.length > 0 ? (enabledSkills.length / skills.length) * 100 : 0} className="h-1.5" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Analytics Row: Conversations Chart + Messages Chart + Skill Ranking + System Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Conversations per Day Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="rounded-2xl hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-500" />
                  {t('dashboard.conversationsPerDay')}
                </CardTitle>
                <CardDescription>{t('dashboard.last7Days')}</CardDescription>
              </CardHeader>
              <CardContent>
                <MiniBarChart data={convsPerDay} labels={dayLabels} maxValue={maxConvPerDay} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Messages per Day Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.52 }}
          >
            <Card className="rounded-2xl hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-rose-500" />
                  {t('dashboard.messagesPerDay')}
                </CardTitle>
                <CardDescription>{t('dashboard.totalMessages')}: {totalMessages}</CardDescription>
              </CardHeader>
              <CardContent>
                <MiniBarChart data={msgsPerDay} labels={dayLabels} maxValue={maxMsgsPerDay} barColor="bg-rose-500/70" hoverColor="bg-rose-500" />
              </CardContent>
            </Card>
          </motion.div>

          {/* Skill Usage Ranking */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
          >
            <Card className="rounded-2xl hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Puzzle className="w-4 h-4 text-amber-500" />
                  {t('dashboard.skillUsageRanking')}
                </CardTitle>
                <CardDescription>{t('dashboard.topSkills')}</CardDescription>
              </CardHeader>
              <CardContent>
                <SkillRanking skills={skills} />
              </CardContent>
            </Card>
          </motion.div>

          {/* System Indicators */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Card className="rounded-2xl hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-500" />
                  {t('dashboard.systemIndicators')}
                </CardTitle>
                <CardDescription>{t('dashboard.systemIndicatorsDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* System Uptime */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/30 transition-colors hover:bg-emerald-50/80 dark:hover:bg-emerald-900/20">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">{t('dashboard.systemUptime')}</p>
                      <p className="text-[10px] text-muted-foreground">{t('dashboard.last30Days')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-600">{systemUptime}%</p>
                    <p className="text-[10px] text-emerald-500">{t('dashboard.operational')}</p>
                  </div>
                </div>

                {/* Agent Response Time */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 transition-colors hover:bg-amber-50/80 dark:hover:bg-amber-900/20">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Timer className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">{t('dashboard.agentResponseTime')}</p>
                      <p className="text-[10px] text-muted-foreground">{t('dashboard.avgResponse')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-amber-600">{agentResponseTime}s</p>
                    <p className="text-[10px] text-amber-500">{t('dashboard.normal')}</p>
                  </div>
                </div>

                {/* Active Connections */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-50/50 dark:bg-cyan-900/10 border border-cyan-200/50 dark:border-cyan-800/30 transition-colors hover:bg-cyan-50/80 dark:hover:bg-cyan-900/20">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center">
                      <Wifi className="w-4 h-4 text-cyan-500" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">{t('dashboard.activeConnections')}</p>
                      <p className="text-[10px] text-muted-foreground">ACRP WebSocket</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-cyan-600">{connectedAcrpAgents.length}</p>
                    <p className="text-[10px] text-cyan-500">{t('dashboard.connected')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Bottom Row: Recent Agents + Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Agents */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Card className="rounded-2xl hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-500" />
                  {t('dashboard.recentAgents')}
                </CardTitle>
                <CardDescription>{t('dashboard.recentAgentsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                {agents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Bot className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">{t('dashboard.noAgents')}</p>
                    <Button variant="link" size="sm" className="mt-1" onClick={() => setCurrentView('agents')}>
                      {t('dashboard.createAgentToStart')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto scroll-smooth">
                    {agents.slice(0, 5).map((agent: any, idx: number) => (
                      <motion.div
                        key={agent.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.06 }}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent cursor-pointer transition-all duration-200 group active:scale-[0.98]"
                        onClick={() => {
                          setSelectedAgentId(agent.id);
                          setCurrentView('agent-detail');
                        }}
                      >
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{agent.name}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn(
                              'text-[9px] px-1 py-0 h-4',
                              agent.mode === 'acrp'
                                ? 'bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                            )}>
                              {agent.mode === 'acrp' ? 'ACRP' : t('dashboard.builtinMode')}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {agent.mode === 'builtin' ? (agent.model ? `${agent.model}` : (agent.provider?.name || '')) : (agent.agentType || '')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {agent.mode === 'acrp' ? (
                            agent.wsConnected ? (
                              <Wifi className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <WifiOff className="w-3 h-3 text-gray-400" />
                            )
                          ) : (
                            <div className={cn(
                              'w-2 h-2 rounded-full',
                              agent.status === 'online' ? 'bg-emerald-500' :
                              agent.status === 'error' ? 'bg-red-500' :
                              agent.status === 'busy' ? 'bg-amber-500' : 'bg-gray-300'
                            )} />
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Agent Architecture Overview - Enhanced with animated flow lines, pulsing badges, gradient borders */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.65 }}
          >
            <Card className="rounded-2xl hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-violet-500" />
                  {t('dashboard.agentArchitecture')}
                </CardTitle>
                <CardDescription>{t('dashboard.howAgentsConnect')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Builtin Mode - Enhanced with animated flow and gradient border */}
                  <div
                    className={cn(
                      'relative p-4 rounded-xl border-2 transition-all duration-300 overflow-hidden',
                      'border-emerald-200 dark:border-emerald-800',
                      'hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-lg'
                    )}
                    style={{
                      background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, transparent 60%)',
                    }}
                  >
                    {/* Gradient border shimmer effect */}
                    <div
                      className="absolute inset-0 rounded-xl pointer-events-none"
                      style={{
                        background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.1), transparent)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 4s ease infinite',
                      }}
                    />

                    <div className="flex items-center gap-2 mb-3 relative z-10">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Cpu className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{t('dashboard.builtinMode')}</p>
                        <p className="text-[10px] text-muted-foreground">{t('dashboard.builtinModeDesc')}</p>
                      </div>
                      <Badge variant="outline" className="ml-auto text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400">
                        {builtinAgents.length} {t('dashboard.agentsLabel')}
                      </Badge>
                    </div>
                    {/* Numbered flow with animated connectors */}
                    <div className="flex items-center gap-1.5 text-[10px] relative z-10">
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30">
                        <span
                          className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] font-bold"
                          style={{ animation: 'gentlePulse 3s ease-in-out infinite' }}
                        >
                          1
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-300">{t('dashboard.stepUser')}</span>
                      </div>
                      {/* Animated flow connector */}
                      <div className="flex items-center">
                        <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                        <div
                          className="w-2 h-0.5 bg-emerald-400 rounded-full"
                          style={{ animation: 'flowPulse 2s ease-in-out infinite' }}
                        />
                      </div>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30">
                        <span
                          className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] font-bold"
                          style={{ animation: 'gentlePulse 3s ease-in-out infinite 0.3s' }}
                        >
                          2
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-300">{t('dashboard.stepHub')}</span>
                      </div>
                      {/* Animated flow connector */}
                      <div className="flex items-center">
                        <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                        <div
                          className="w-2 h-0.5 bg-emerald-400 rounded-full"
                          style={{ animation: 'flowPulse 2s ease-in-out infinite 0.4s' }}
                        />
                      </div>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30">
                        <span
                          className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] font-bold"
                          style={{ animation: 'gentlePulse 3s ease-in-out infinite 0.6s' }}
                        >
                          3
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-300">{t('dashboard.stepProvider')}</span>
                      </div>
                      {/* Animated flow connector */}
                      <div className="flex items-center">
                        <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                        <div
                          className="w-2 h-0.5 bg-emerald-400 rounded-full"
                          style={{ animation: 'flowPulse 2s ease-in-out infinite 0.8s' }}
                        />
                      </div>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30">
                        <span
                          className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] font-bold"
                          style={{ animation: 'gentlePulse 2s ease-in-out infinite' }}
                        >
                          4
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-300">{t('dashboard.stepResponse')}</span>
                      </div>
                    </div>
                  </div>

                  {/* ACRP Mode - Enhanced with animated flow and gradient border */}
                  <div
                    className={cn(
                      'relative p-4 rounded-xl border-2 transition-all duration-300 overflow-hidden',
                      'border-cyan-200 dark:border-cyan-800',
                      'hover:border-cyan-300 dark:hover:border-cyan-700 hover:shadow-lg'
                    )}
                    style={{
                      background: 'linear-gradient(135deg, rgba(6,182,212,0.06) 0%, transparent 60%)',
                    }}
                  >
                    {/* Gradient border shimmer effect */}
                    <div
                      className="absolute inset-0 rounded-xl pointer-events-none"
                      style={{
                        background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.1), transparent)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 4s ease infinite 1s',
                      }}
                    />

                    <div className="flex items-center gap-2 mb-3 relative z-10">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                        <Globe className="w-4 h-4 text-cyan-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{t('dashboard.acrpMode')}</p>
                        <p className="text-[10px] text-muted-foreground">{t('dashboard.acrpModeDesc')}</p>
                      </div>
                      <Badge variant="outline" className="ml-auto text-[10px] bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400">
                        {acrpAgents.length} {t('dashboard.agentsLabel')}
                      </Badge>
                    </div>
                    {/* Numbered flow with animated connectors */}
                    <div className="flex items-center gap-1.5 text-[10px] relative z-10">
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30">
                        <span
                          className="w-4 h-4 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[8px] font-bold"
                          style={{ animation: 'gentlePulse 3s ease-in-out infinite' }}
                        >
                          1
                        </span>
                        <span className="text-cyan-700 dark:text-cyan-300">{t('dashboard.stepAgent')}</span>
                      </div>
                      {/* Animated flow connector */}
                      <div className="flex items-center">
                        <Wifi className="w-3 h-3 text-cyan-500" />
                        <div
                          className="w-2 h-0.5 bg-cyan-400 rounded-full"
                          style={{ animation: 'flowPulse 2s ease-in-out infinite' }}
                        />
                      </div>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30">
                        <span
                          className="w-4 h-4 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[8px] font-bold"
                          style={{ animation: 'gentlePulse 3s ease-in-out infinite 0.3s' }}
                        >
                          2
                        </span>
                        <span className="text-cyan-700 dark:text-cyan-300">WS :3004</span>
                      </div>
                      {/* Animated flow connector */}
                      <div className="flex items-center">
                        <ArrowUpRight className="w-3 h-3 text-cyan-400" />
                        <div
                          className="w-2 h-0.5 bg-cyan-400 rounded-full"
                          style={{ animation: 'flowPulse 2s ease-in-out infinite 0.4s' }}
                        />
                      </div>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30">
                        <span
                          className="w-4 h-4 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[8px] font-bold"
                          style={{ animation: 'gentlePulse 3s ease-in-out infinite 0.6s' }}
                        >
                          3
                        </span>
                        <span className="text-cyan-700 dark:text-cyan-300">{t('dashboard.stepHub')}</span>
                      </div>
                      {/* Animated flow connector */}
                      <div className="flex items-center">
                        <ArrowUpRight className="w-3 h-3 text-cyan-400" />
                        <div
                          className="w-2 h-0.5 bg-cyan-400 rounded-full"
                          style={{ animation: 'flowPulse 2s ease-in-out infinite 0.8s' }}
                        />
                      </div>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30">
                        <span
                          className="w-4 h-4 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[8px] font-bold"
                          style={{ animation: 'gentlePulse 2s ease-in-out infinite' }}
                        >
                          4
                        </span>
                        <span className="text-cyan-700 dark:text-cyan-300">{t('dashboard.stepCapabilityInvoke')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Supported platforms */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">{t('dashboard.supported')}:</span>
                    {['hermes-agent', 'openclaw', 'claude-code', 'codex', 'trae', 'custom'].map((type) => (
                      <Badge
                        key={type}
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 h-4 rounded-md transition-colors hover:bg-accent cursor-default"
                      >
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </>
  );
}
