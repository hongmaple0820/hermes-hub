'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MessageSquare, Bot, Puzzle, TrendingUp, TrendingDown,
  BarChart3, DollarSign, Hash, Zap, Activity,
  CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw,
  Cpu, Loader2, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ Types ============

interface DashboardAnalytics {
  agents: { total: number; online: number; builtin: number; acrp: number; acrpConnected: number };
  conversations: { total: number; convsPerDay: { date: string; count: number }[] };
  messages: { total: number; messagesPerDay: { date: string; count: number }[] };
  providers: { total: number; active: number };
  skills: { total: number; totalInvocations: number };
  chatRooms: { total: number };
}

interface UsageAnalyticsData {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  dailyUsage: { date: string; inputTokens: number; outputTokens: number; cost: number }[];
  byAgent: { agentId: string; agentName: string; tokens: number; cost: number }[];
  byModel: { model: string; tokens: number; cost: number }[];
}

interface SkillAnalyticsData {
  totalInvocations: number;
  invocationsBySkill: { capabilityId: string; name: string; count: number }[];
  invocationsByStatus: Record<string, number>;
  recentInvocations: {
    id: string;
    capabilityId: string;
    capabilityName: string;
    status: string;
    duration: number | null;
    error: string | null;
    createdAt: string;
    completedAt: string | null;
  }[];
  topSkills: { capabilityId: string; name: string; total: number; successCount: number; successRate: number }[];
}

// ============ Helpers ============

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCost(n: number): string {
  if (n < 0.01 && n > 0) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function computeTrend(data: number[]): { percentage: number; isUp: boolean } {
  if (data.length < 2) return { percentage: 0, isUp: true };
  const recent = data.slice(-3).reduce((a, b) => a + b, 0);
  const earlier = data.slice(0, 3).reduce((a, b) => a + b, 0);
  if (earlier === 0) return { percentage: recent > 0 ? 100 : 0, isUp: recent >= 0 };
  const pct = Math.round(((recent - earlier) / earlier) * 100);
  return { percentage: Math.abs(pct), isUp: pct >= 0 };
}

// ============ Sub-components ============

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    success: { color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Success' },
    failed: { color: 'text-red-600 bg-red-500/10 border-red-500/20', icon: <XCircle className="w-3 h-3" />, label: 'Failed' },
    timeout: { color: 'text-amber-600 bg-amber-500/10 border-amber-500/20', icon: <AlertTriangle className="w-3 h-3" />, label: 'Timeout' },
    pending: { color: 'text-muted-foreground bg-muted border-border', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
    sent: { color: 'text-cyan-600 bg-cyan-500/10 border-cyan-500/20', icon: <RefreshCw className="w-3 h-3" />, label: 'Sent' },
    executing: { color: 'text-amber-600 bg-amber-500/10 border-amber-500/20', icon: <Activity className="w-3 h-3" />, label: 'Executing' },
  };
  const c = config[status] || config.pending;
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border', c.color)}>
      {c.icon}
      {c.label}
    </span>
  );
}

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

function SkeletonCard() {
  return (
    <Card className="border-l-4 border-l-muted">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          <div className="w-9 h-9 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="h-8 w-20 rounded bg-muted animate-pulse mb-2" />
        <div className="h-3 w-28 rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

// ============ Main Component ============

export function AnalyticsDashboard() {
  const { t } = useI18n();

  // State for all analytics data
  const [dashboard, setDashboard] = useState<DashboardAnalytics | null>(null);
  const [usage, setUsage] = useState<UsageAnalyticsData | null>(null);
  const [skillAnalytics, setSkillAnalytics] = useState<SkillAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch all data
  const loadAllData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const defaultUsage: UsageAnalyticsData = {
      totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, estimatedCost: 0,
      dailyUsage: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return { date: d.toISOString().slice(0, 10), inputTokens: 0, outputTokens: 0, cost: 0 };
      }),
      byAgent: [], byModel: [],
    };

    const defaultSkills: SkillAnalyticsData = {
      totalInvocations: 0,
      invocationsBySkill: [],
      invocationsByStatus: { success: 0, failed: 0, timeout: 0, pending: 0, sent: 0, executing: 0 },
      recentInvocations: [], topSkills: [],
    };

    try {
      const [dashData, usageData, skillsData] = await Promise.allSettled([
        api.getDashboardAnalytics(),
        api.getUsageAnalytics(),
        api.getSkillAnalytics(),
      ]);

      if (dashData.status === 'fulfilled') setDashboard(dashData.value);
      if (usageData.status === 'fulfilled') setUsage(usageData.value);
      else setUsage(defaultUsage);
      if (skillsData.status === 'fulfilled') setSkillAnalytics(skillsData.value);
      else setSkillAnalytics(defaultSkills);
    } catch {
      setUsage(defaultUsage);
      setSkillAnalytics(defaultSkills);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Derived data
  const dayLabels = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString([], { weekday: 'short' }).slice(0, 2));
    }
    return days;
  }, []);

  const msgsPerDay = useMemo(() => {
    if (dashboard?.messages?.messagesPerDay) {
      return dashboard.messages.messagesPerDay.map(d => d.count);
    }
    return Array(7).fill(0);
  }, [dashboard]);

  const convsPerDay = useMemo(() => {
    if (dashboard?.conversations?.convsPerDay) {
      return dashboard.conversations.convsPerDay.map(d => d.count);
    }
    return Array(7).fill(0);
  }, [dashboard]);

  const totalInvocations = skillAnalytics?.totalInvocations ?? 0;
  const successCount = skillAnalytics?.invocationsByStatus?.success ?? 0;
  const successRate = totalInvocations > 0 ? (successCount / totalInvocations) * 100 : 0;

  // Token usage breakdown
  const BAR_COLORS = {
    input: '#10b981',
    output: '#f59e0b',
    cost: '#f59e0b',
  };

  // ============ Loading State ============
  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="h-7 w-48 rounded bg-muted animate-pulse mb-2" />
            <div className="h-4 w-64 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2"><CardContent className="p-6"><div className="h-64 rounded bg-muted animate-pulse" /></CardContent></Card>
          <Card><CardContent className="p-6"><div className="h-64 rounded bg-muted animate-pulse" /></CardContent></Card>
        </div>
      </div>
    );
  }

  // ============ Overview Cards ============
  const overviewCards = [
    {
      title: t('analyticsDash.totalConversations'),
      value: dashboard?.conversations?.total ?? 0,
      trend: computeTrend(convsPerDay),
      icon: MessageSquare,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-l-emerald-500',
      sparkline: convsPerDay.length >= 7 ? convsPerDay.slice(-7) : Array(7).fill(0),
      sparkColor: 'bg-emerald-500/60',
    },
    {
      title: t('analyticsDash.totalMessages'),
      value: dashboard?.messages?.total ?? 0,
      trend: computeTrend(msgsPerDay),
      icon: BarChart3,
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-l-amber-500',
      sparkline: msgsPerDay.length >= 7 ? msgsPerDay.slice(-7) : Array(7).fill(0),
      sparkColor: 'bg-amber-500/60',
    },
    {
      title: t('analyticsDash.activeAgents'),
      value: dashboard?.agents?.online ?? 0,
      trend: { percentage: 0, isUp: true },
      icon: Bot,
      color: 'text-rose-600',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-l-rose-500',
      sparkline: [0, 0, 0, 0, dashboard?.agents?.online ?? 0, dashboard?.agents?.online ?? 0, dashboard?.agents?.online ?? 0],
      sparkColor: 'bg-rose-500/60',
    },
    {
      title: t('analyticsDash.skillsUsed'),
      value: dashboard?.skills?.totalInvocations ?? 0,
      trend: { percentage: 0, isUp: true },
      icon: Puzzle,
      color: 'text-slate-600 dark:text-slate-400',
      bgColor: 'bg-slate-500/10',
      borderColor: 'border-l-slate-500',
      sparkline: [0, 0, 0, 0, Math.floor((dashboard?.skills?.totalInvocations ?? 0) / 3), Math.floor((dashboard?.skills?.totalInvocations ?? 0) / 2), dashboard?.skills?.totalInvocations ?? 0],
      sparkColor: 'bg-slate-500/60',
    },
  ];

  // Top agents by usage
  const topAgents = (usage?.byAgent || []).slice(0, 5);
  // Top skills
  const topSkillsList = (skillAnalytics?.topSkills || []).slice(0, 5);
  const maxMsgsPerDay = Math.max(...msgsPerDay, 1);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('analyticsDash.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('analyticsDash.subtitle')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadAllData(true)}
          disabled={refreshing}
          className="gap-1.5"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          {t('analyticsDash.refresh')}
        </Button>
        </div>

      {/* ============ Section 1: Overview Cards ============ */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {overviewCards.map((card, index) => (
            <Card key={card.title} className={cn('border-l-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5', card.borderColor)}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">{card.title}</span>
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', card.bgColor)}>
                    <card.icon className={cn('w-4 h-4', card.color)} />
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-bold tracking-tight">{formatTokens(card.value)}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {card.trend.percentage > 0 && (
                        <span className={cn(
                          'inline-flex items-center gap-0.5 text-[11px] font-medium',
                          card.trend.isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        )}>
                          {card.trend.isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {card.trend.percentage}%
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">{t('analyticsDash.vsLastPeriod')}</span>
                    </div>
                  </div>
                  <Sparkline values={card.sparkline} color={card.sparkColor} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ============ Section 2: Activity Chart ============ */}
      <section>
        <h2 className="text-lg font-semibold mb-4">{t('analyticsDash.activityTitle')}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 7-Day Activity Bar Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t('analyticsDash.messagesPerDay')}</CardTitle>
              <CardDescription>{t('analyticsDash.last7Days')}</CardDescription>
            </CardHeader>
            <CardContent>
              {msgsPerDay.some(v => v > 0) ? (
                <div className="space-y-3">
                  {/* Bar Chart */}
                  <div className="flex items-end gap-[6px] h-44">
                    {msgsPerDay.map((value, i) => (
                      <div key={i} className="flex flex-col items-center gap-1 flex-1">
                        <div className="w-full relative" style={{ height: '140px' }}>
                          {/* Tooltip on hover */}
                          <div
                            className="absolute bottom-0 w-full rounded-t-md bg-emerald-500/70 hover:bg-emerald-500 transition-colors cursor-pointer group relative"
                            style={{ height: `${maxMsgsPerDay > 0 ? (value / maxMsgsPerDay) * 100 : 0}%` }}
                          >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col bg-popover text-popover-foreground text-[10px] px-2 py-1.5 rounded shadow-lg border whitespace-nowrap z-10">
                              <span className="font-medium">{dayLabels[i]}</span>
                              <span>{value} {t('analyticsDash.messages')}</span>
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{dayLabels[i]}</span>
                      </div>
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="flex gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/70" /> {t('analyticsDash.messages')}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <BarChart3 className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t('analyticsDash.noActivityData')}</p>
                  <p className="text-xs text-muted-foreground/70">{t('analyticsDash.startChattingHint')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Agents + Top Skills */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('analyticsDash.topAgents')}</CardTitle>
              <CardDescription>{t('analyticsDash.byMessageCount')}</CardDescription>
            </CardHeader>
            <CardContent>
              {topAgents.length > 0 ? (
                <div className="space-y-3">
                  {topAgents.map((agent, i) => {
                    const maxT = topAgents[0]?.tokens || 1;
                    return (
                      <div key={agent.agentId} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground w-3">{i + 1}</span>
                            <span className="font-medium truncate max-w-[120px]">{agent.agentName}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">{formatTokens(agent.tokens)} · {formatCost(agent.cost)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              i === 0 ? 'bg-emerald-500' : i === 1 ? 'bg-emerald-400' : 'bg-emerald-300'
                            )}
                            style={{ width: `${(agent.tokens / maxT) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                    <Bot className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t('analyticsDash.noAgentData')}</p>
                </div>
              )}

              {/* Top Skills by invocations */}
              {topSkillsList.length > 0 && (
                <>
                  <div className="border-t border-border mt-4 pt-4">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-3">{t('analyticsDash.topSkillsByInvocations')}</h4>
                    <div className="space-y-2.5">
                      {topSkillsList.map((skill, i) => (
                        <div key={skill.capabilityId} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground w-3">{i + 1}</span>
                              <span className="font-medium truncate max-w-[120px]">{skill.name}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">{skill.total}x</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-amber-400' : 'bg-amber-300'
                              )}
                              style={{ width: `${(skill.total / (topSkillsList[0]?.total || 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ============ Section 3: Usage Stats ============ */}
      <section>
        <h2 className="text-lg font-semibold mb-4">{t('analyticsDash.usageTitle')}</h2>

        {/* Token Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('usage.inputTokens')}</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Hash className="w-4 h-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatTokens(usage?.totalInputTokens ?? 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('usage.outputTokens')}</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatTokens(usage?.totalOutputTokens ?? 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('analyticsDash.totalTokens')}</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-slate-500/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatTokens(usage?.totalTokens ?? 0)}</div>
            </CardContent>
          </Card>
          {/* Cost Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('usage.estimatedCost')}</p>
                  <p className="text-3xl font-bold mt-1">{formatCost(usage?.estimatedCost ?? 0)}</p>
                  {(usage?.estimatedCost ?? 0) > 0 && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] mt-2',
                        (usage?.estimatedCost ?? 0) > 50
                          ? 'text-rose-600 bg-rose-500/10 border-rose-500/20'
                          : (usage?.estimatedCost ?? 0) > 20
                            ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
                            : 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                      )}
                    >
                      <DollarSign className="w-3 h-3 mr-0.5" />
                      {(usage?.estimatedCost ?? 0) > 50 ? t('usage.costHigh') : (usage?.estimatedCost ?? 0) > 20 ? t('usage.costMedium') : t('usage.costLow')}
                    </Badge>
                  )}
                </div>
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center',
                  (usage?.estimatedCost ?? 0) > 50 ? 'bg-rose-500/10' : (usage?.estimatedCost ?? 0) > 20 ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                )}>
                  <DollarSign className={cn(
                    'w-6 h-6',
                    (usage?.estimatedCost ?? 0) > 50 ? 'text-rose-600' : (usage?.estimatedCost ?? 0) > 20 ? 'text-amber-600' : 'text-emerald-600'
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Token Chart + Model Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Daily Token Usage Stacked Bar Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t('analyticsDash.dailyTokenUsage')}</CardTitle>
              <CardDescription>{t('analyticsDash.dailyTokenUsageDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {(usage?.dailyUsage ?? []).some(d => d.inputTokens + d.outputTokens > 0) ? (
                <div className="space-y-3">
                  <div className="flex items-end gap-[3px] h-44">
                    {(usage?.dailyUsage ?? []).map((day, i) => {
                      const maxTokens = Math.max(...(usage?.dailyUsage ?? []).map((d) => d.inputTokens + d.outputTokens), 1);
                      const totalH = ((day.inputTokens + day.outputTokens) / maxTokens) * 100;
                      const inputH = day.inputTokens / (day.inputTokens + day.outputTokens || 1) * totalH;
                      const outputH = totalH - inputH;
                      return (
                        <div key={i} className="flex-1 flex flex-col justify-end min-w-[3px] group relative" style={{ height: '100%' }}>
                          <div className="flex flex-col w-full" style={{ height: `${totalH}%` }}>
                            <div
                              className="w-full rounded-t-sm transition-opacity group-hover:opacity-80"
                              style={{ height: `${(outputH / totalH) * 100}%`, backgroundColor: BAR_COLORS.output, minHeight: day.outputTokens > 0 ? '2px' : '0' }}
                            />
                            <div
                              className="w-full rounded-b-sm transition-opacity group-hover:opacity-80"
                              style={{ height: `${(inputH / totalH) * 100}%`, backgroundColor: BAR_COLORS.input, minHeight: day.inputTokens > 0 ? '2px' : '0' }}
                            />
                          </div>
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col bg-popover text-popover-foreground text-[10px] px-2 py-1.5 rounded shadow-lg border whitespace-nowrap z-10">
                            <span className="font-medium">{formatDate(day.date)}</span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: BAR_COLORS.input }} />
                              {t('usage.inputTokens')}: {formatTokens(day.inputTokens)}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: BAR_COLORS.output }} />
                              {t('usage.outputTokens')}: {formatTokens(day.outputTokens)}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: BAR_COLORS.cost }} />
                              Cost: {formatCost(day.cost)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{usage?.dailyUsage?.[0] ? formatDate(usage.dailyUsage[0].date) : ''}</span>
                    <span>{usage?.dailyUsage?.[6] ? formatDate(usage.dailyUsage[6].date) : ''}</span>
                  </div>
                  <div className="flex gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BAR_COLORS.input }} /> {t('usage.inputTokens')}</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BAR_COLORS.output }} /> {t('usage.outputTokens')}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <BarChart3 className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t('analyticsDash.noUsageData')}</p>
                  <p className="text-xs text-muted-foreground/70">{t('analyticsDash.startChattingHint')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Model Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                {t('usage.modelBreakdown')}
              </CardTitle>
              <CardDescription>{t('usage.modelBreakdownDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {(usage?.byModel ?? []).length > 0 ? (
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {(usage?.byModel ?? []).map((model) => {
                    const maxT = usage?.byModel?.[0]?.tokens || 1;
                    return (
                      <div key={model.model} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate">{model.model}</span>
                          <span className="text-muted-foreground shrink-0 ml-2">
                            {formatTokens(model.tokens)} · {formatCost(model.cost)}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full">
                          <div className="h-2 bg-amber-500 rounded-full transition-all" style={{ width: `${(model.tokens / maxT) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                    <Cpu className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t('analyticsDash.noModelData')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Daily Usage Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('analyticsDash.dailyUsageTable')}</CardTitle>
            <CardDescription>{t('analyticsDash.dailyUsageTableDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {(usage?.dailyUsage ?? []).some(d => d.inputTokens + d.outputTokens > 0) ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">{t('analyticsDash.date')}</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground text-xs">{t('usage.inputTokens')}</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground text-xs">{t('usage.outputTokens')}</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground text-xs">{t('analyticsDash.totalTokens')}</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground text-xs">{t('usage.estimatedCost')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(usage?.dailyUsage ?? []).map((day) => (
                      <tr key={day.date} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                        <td className="py-2.5 px-3 font-medium">{formatDate(day.date)}</td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground">{formatTokens(day.inputTokens)}</td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground">{formatTokens(day.outputTokens)}</td>
                        <td className="py-2.5 px-3 text-right">{formatTokens(day.inputTokens + day.outputTokens)}</td>
                        <td className="py-2.5 px-3 text-right">{formatCost(day.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                  <BarChart3 className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">{t('analyticsDash.noUsageData')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ============ Section 4: Skills Analytics ============ */}
      <section>
        <h2 className="text-lg font-semibold mb-4">{t('analyticsDash.skillsTitle')}</h2>

        {/* Skill Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('analytics.totalInvocations')}</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalInvocations}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {skillAnalytics?.invocationsByStatus?.success ?? 0} success / {skillAnalytics?.invocationsByStatus?.failed ?? 0} failed / {skillAnalytics?.invocationsByStatus?.timeout ?? 0} timeout
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('analytics.successRate')}</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
              <div className="w-full h-2 bg-muted rounded-full mt-2">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all',
                    successRate >= 80 ? 'bg-emerald-500' : successRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                  )}
                  style={{ width: `${successRate}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('analytics.topSkills')}</CardTitle>
              <div className="w-8 h-8 rounded-lg bg-slate-500/10 flex items-center justify-center">
                <Puzzle className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{skillAnalytics?.topSkills?.length ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('analytics.overview')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Skill Success Rate + Invocations by Skill */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Skill Success Rate Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('analytics.successRate')}</CardTitle>
              <CardDescription>{t('analytics.invocationStatus')}</CardDescription>
            </CardHeader>
            <CardContent>
              {topSkillsList.length > 0 ? (
                <div className="space-y-4">
                  {topSkillsList.map((skill, i) => (
                    <div key={skill.capabilityId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate">{skill.name}</span>
                        <span className="text-muted-foreground shrink-0 ml-2">
                          {(skill.successRate ?? 0).toFixed(1)}% ({skill.successCount ?? 0}/{skill.total ?? 0})
                        </span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full">
                        <div
                          className={cn(
                            'h-2 rounded-full transition-all',
                            skill.successRate >= 80 ? 'bg-emerald-500' : (skill.successRate ?? 0) >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                          )}
                          style={{ width: `${skill.successRate ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <TrendingUp className="w-7 h-7 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t('analytics.noData')}</p>
                  <p className="text-xs text-muted-foreground/70">{t('analyticsDash.startChattingHint')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Skill Invocations Ranking */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('analyticsDash.skillRanking')}</CardTitle>
              <CardDescription>{t('analyticsDash.skillRankingDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {(skillAnalytics?.invocationsBySkill ?? []).length > 0 ? (
                <div className="space-y-4">
                  {(skillAnalytics?.invocationsBySkill ?? []).slice(0, 6).map((skill, i) => {
                    const maxC = skillAnalytics?.invocationsBySkill?.[0]?.count || 1;
                    return (
                      <div key={skill.capabilityId} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground w-3">{i + 1}</span>
                            <span className="font-medium truncate">{skill.name}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">{skill.count}x</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-amber-400' : 'bg-amber-300'
                            )}
                            style={{ width: `${(skill.count / maxC) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <Puzzle className="w-7 h-7 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t('analytics.noData')}</p>
                  <p className="text-xs text-muted-foreground/70">{t('analyticsDash.startChattingHint')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Invocations Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('analytics.recentInvocations')}</CardTitle>
            <CardDescription>{t('analytics.overview')}</CardDescription>
          </CardHeader>
          <CardContent>
            {(skillAnalytics?.recentInvocations ?? []).length > 0 ? (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">{t('analyticsDash.skill')}</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">{t('analyticsDash.statusCol')}</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">{t('analyticsDash.duration')}</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">{t('analyticsDash.time')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(skillAnalytics?.recentInvocations ?? []).map((inv) => (
                      <tr key={inv.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-sm">{inv.capabilityName}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={inv.status} />
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {formatDuration(inv.duration)}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">
                          {formatTimeAgo(inv.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Clock className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">{t('analytics.noData')}</p>
                <p className="text-xs text-muted-foreground/70">{t('analyticsDash.startChattingHint')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
