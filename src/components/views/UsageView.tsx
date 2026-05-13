'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BarChart3, DollarSign, Zap, Hash, Users, Loader2, TrendingUp,
  Activity, CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw,
  Bot, Cpu, Coins,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ============ Types ============

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
  recentInvocations: { id: string; capabilityId: string; capabilityName: string; status: string; duration: number | null; error: string | null; createdAt: string; completedAt: string | null }[];
  topSkills: { capabilityId: string; name: string; total: number; successCount: number; successRate: number }[];
}

// ============ Constants ============

const DONUT_COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899'];

const BAR_COLORS = {
  input: '#10b981',
  output: '#8b5cf6',
  cost: '#f59e0b',
};

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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============ Sub-components ============

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    success: { color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Success' },
    failed: { color: 'text-red-600 bg-red-500/10 border-red-500/20', icon: <XCircle className="w-3 h-3" />, label: 'Failed' },
    timeout: { color: 'text-amber-600 bg-amber-500/10 border-amber-500/20', icon: <AlertTriangle className="w-3 h-3" />, label: 'Timeout' },
    pending: { color: 'text-muted-foreground bg-muted border-border', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
    sent: { color: 'text-cyan-600 bg-cyan-500/10 border-cyan-500/20', icon: <RefreshCw className="w-3 h-3" />, label: 'Sent' },
    executing: { color: 'text-violet-600 bg-violet-500/10 border-violet-500/20', icon: <Activity className="w-3 h-3" />, label: 'Executing' },
  };
  const c = config[status] || config.pending;
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border', c.color)}>
      {c.icon}
      {c.label}
    </span>
  );
}

function SkillDonutChart({ data }: { data: { name: string; count: number }[] }) {
  const { t } = useI18n();
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-32 h-32 rounded-full border-4 border-muted flex items-center justify-center">
          <span className="text-sm text-muted-foreground">{t('analytics.noData')}</span>
        </div>
      </div>
    );
  }

  const top5 = data.slice(0, 5);
  const top5Total = top5.reduce((sum, d) => sum + d.count, 0);

  const segments = top5.reduce<{ name: string; count: number; percentage: string; color: string; start: number; angle: number }[]>(
    (acc, d, i) => {
      const angle = (d.count / total) * 360;
      const start = acc.length > 0 ? acc[acc.length - 1].start + acc[acc.length - 1].angle : 0;
      acc.push({
        name: d.name,
        count: d.count,
        percentage: ((d.count / total) * 100).toFixed(1),
        color: DONUT_COLORS[i],
        start,
        angle,
      });
      return acc;
    },
    [],
  );

  if (top5Total < total) {
    const otherCount = total - top5Total;
    const angle = (otherCount / total) * 360;
    const start = segments.length > 0 ? segments[segments.length - 1].start + segments[segments.length - 1].angle : 0;
    segments.push({
      name: 'Other',
      count: otherCount,
      percentage: ((otherCount / total) * 100).toFixed(1),
      color: '#6b7280',
      start,
      angle,
    });
  }

  const gradientStops = segments
    .map((s) => `${s.color} ${s.start}deg ${s.start + s.angle}deg`)
    .join(', ');

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-40 h-40 shrink-0">
        <div
          className="w-full h-full rounded-full"
          style={{ background: `conic-gradient(${gradientStops})` }}
        />
        <div className="absolute inset-4 rounded-full bg-background flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-bold">{total}</p>
            <p className="text-[10px] text-muted-foreground">{t('analytics.totalInvocations')}</p>
          </div>
        </div>
      </div>
      <div className="space-y-2 text-sm flex-1 min-w-0">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="truncate flex-1 min-w-0">{s.name}</span>
            <span className="text-muted-foreground shrink-0">{s.percentage}%</span>
            <span className="text-muted-foreground text-xs shrink-0">({s.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Daily Token Usage Bar Chart (CSS-based, stacked bars)
function DailyTokenBarChart({ data }: { data: { date: string; inputTokens: number; outputTokens: number; cost: number }[] }) {
  const { t } = useI18n();
  const maxTokens = Math.max(...data.map((d) => d.inputTokens + d.outputTokens), 1);

  return (
    <div className="space-y-3">
      {/* Chart */}
      <div className="flex items-end gap-[3px] h-44">
        {data.map((day, i) => {
          const totalH = ((day.inputTokens + day.outputTokens) / maxTokens) * 100;
          const inputH = day.inputTokens / (day.inputTokens + day.outputTokens || 1) * totalH;
          const outputH = totalH - inputH;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col justify-end min-w-[3px] group relative cursor-pointer"
              style={{ height: '100%' }}
            >
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
      {/* X-axis labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0] ? formatDate(data[0].date) : ''}</span>
        <span>{data[data.length - 1] ? formatDate(data[data.length - 1].date) : ''}</span>
      </div>
      {/* Legend */}
      <div className="flex gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BAR_COLORS.input }} /> {t('usage.inputTokens')}</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BAR_COLORS.output }} /> {t('usage.outputTokens')}</span>
      </div>
    </div>
  );
}

// Cost card with status indicator
function CostCard({ cost }: { cost: number }) {
  const { t } = useI18n();
  const costStatus = cost > 50
    ? { color: 'text-red-600', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20', labelKey: 'usage.costHigh', icon: AlertTriangle }
    : cost > 20
      ? { color: 'text-amber-600', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20', labelKey: 'usage.costMedium', icon: Coins }
      : { color: 'text-emerald-600', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20', labelKey: 'usage.costLow', icon: CheckCircle2 };

  const Icon = costStatus.icon;

  return (
    <Card className={cn('border', costStatus.borderColor)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t('usage.estimatedCost')}</p>
            <p className="text-3xl font-bold mt-1">{formatCost(cost)}</p>
            <Badge variant="outline" className={cn('text-[10px] mt-2', costStatus.color, costStatus.bgColor)}>
              <Icon className="w-3 h-3 mr-1" />
              {t(costStatus.labelKey)}
            </Badge>
          </div>
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', costStatus.bgColor)}>
            <DollarSign className={cn('w-6 h-6', costStatus.color)} />
          </div>
        </div>
        <div className="mt-4 text-[11px] text-muted-foreground">
          Estimated based on $0.01/1K input tokens + $0.03/1K output tokens
        </div>
      </CardContent>
    </Card>
  );
}

// ============ Main Component ============

export function UsageView() {
  const { t } = useI18n();
  const [usage, setUsage] = useState<UsageAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skillAnalytics, setSkillAnalytics] = useState<SkillAnalyticsData | null>(null);
  const [skillLoading, setSkillLoading] = useState(true);

  const loadUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getUsageAnalytics();
      setUsage(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage data');
      // Provide empty default data so the UI still renders
      setUsage({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        dailyUsage: Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return { date: d.toISOString().slice(0, 10), inputTokens: 0, outputTokens: 0, cost: 0 };
        }),
        byAgent: [],
        byModel: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSkillAnalytics = useCallback(async () => {
    setSkillLoading(true);
    try {
      const result = await api.getSkillAnalytics();
      setSkillAnalytics(result);
    } catch {
      setSkillAnalytics({
        totalInvocations: 0,
        invocationsBySkill: [],
        invocationsByStatus: { success: 0, failed: 0, timeout: 0, pending: 0, sent: 0, executing: 0 },
        recentInvocations: [],
        topSkills: [],
      });
    } finally {
      setSkillLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsage();
    loadSkillAnalytics();
  }, [loadUsage, loadSkillAnalytics]);

  // Loading state
  if (loading && !usage) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!usage) return null;

  const totalInvocations = skillAnalytics?.totalInvocations ?? 0;
  const successCount = skillAnalytics?.invocationsByStatus?.success ?? 0;
  const successRate = totalInvocations > 0 ? (successCount / totalInvocations) * 100 : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('usage.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('usage.subtitle')} — Last 7 days</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadUsage}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('usage.inputTokens')}</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Hash className="w-4 h-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTokens(usage.totalInputTokens)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('usage.outputTokens')}</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-violet-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTokens(usage.totalOutputTokens)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tokens</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-cyan-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTokens(usage.totalTokens)}</div>
          </CardContent>
        </Card>
        <CostCard cost={usage.estimatedCost} />
      </div>

      {/* Daily Token Usage + Cost Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Daily Token Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Daily Token Usage</CardTitle>
            <CardDescription>Input and output tokens per day over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyTokenBarChart data={usage.dailyUsage} />
          </CardContent>
        </Card>

        {/* Daily Cost Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Cost</CardTitle>
            <CardDescription>Estimated cost per day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-[3px] h-44">
              {usage.dailyUsage.map((day, i) => {
                const maxCost = Math.max(...usage.dailyUsage.map((d) => d.cost), 0.001);
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm transition-opacity hover:opacity-80 cursor-pointer group relative min-w-[3px]"
                    style={{
                      height: `${(day.cost / maxCost) * 100}%`,
                      backgroundColor: BAR_COLORS.cost,
                    }}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow whitespace-nowrap z-10">
                      {formatDate(day.date)}: {formatCost(day.cost)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
              <span>{usage.dailyUsage[0] ? formatDate(usage.dailyUsage[0].date) : ''}</span>
              <span>{usage.dailyUsage[usage.dailyUsage.length - 1] ? formatDate(usage.dailyUsage[usage.dailyUsage.length - 1].date) : ''}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown by Agent + Model */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* By Agent */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              Cost by Agent
            </CardTitle>
            <CardDescription>Token usage and cost breakdown per agent</CardDescription>
          </CardHeader>
          <CardContent>
            {usage.byAgent.length > 0 ? (
              <ScrollArea className="max-h-72">
                <div className="space-y-3">
                  {usage.byAgent.map((agent) => {
                    const maxTokens = usage.byAgent[0]?.tokens || 1;
                    return (
                      <div key={agent.agentId} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate">{agent.agentName}</span>
                          <span className="text-muted-foreground shrink-0 ml-2">
                            {formatTokens(agent.tokens)} · {formatCost(agent.cost)}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full">
                          <div
                            className="h-2 bg-primary rounded-full transition-all"
                            style={{ width: `${(agent.tokens / maxTokens) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <Bot className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No agent usage data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Model */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              {t('modelBreakdown')}
            </CardTitle>
            <CardDescription>{t('modelBreakdownDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {usage.byModel.length > 0 ? (
              <ScrollArea className="max-h-72">
                <div className="space-y-3">
                  {usage.byModel.map((model) => {
                    const maxTokens = usage.byModel[0]?.tokens || 1;
                    return (
                      <div key={model.model} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate">{model.model}</span>
                          <span className="text-muted-foreground shrink-0 ml-2">
                            {formatTokens(model.tokens)} · {formatCost(model.cost)}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full">
                          <div
                            className="h-2 bg-violet-500 rounded-full transition-all"
                            style={{ width: `${(model.tokens / maxTokens) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <Cpu className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No model usage data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ========== Skill Analytics Section ========== */}
      <div className="mt-2">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">{t('analytics.skillAnalytics')}</h2>
        </div>

        {skillLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Skill Analytics Summary Cards */}
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
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-violet-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
                  <div className="w-full h-2 bg-muted rounded-full mt-2">
                    <div
                      className={cn(
                        'h-2 rounded-full transition-all',
                        successRate >= 80 ? 'bg-emerald-500' : successRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      )}
                      style={{ width: `${successRate}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t('analytics.topSkills')}</CardTitle>
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-amber-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{skillAnalytics?.topSkills?.length ?? 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">{t('analytics.overview')}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Skill Usage Donut Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('analytics.skillAnalytics')}</CardTitle>
                  <CardDescription>{t('analytics.topSkills')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {skillAnalytics && skillAnalytics.invocationsBySkill.length > 0 ? (
                    <SkillDonutChart data={skillAnalytics.invocationsBySkill} />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Activity className="w-10 h-10 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">{t('analytics.noData')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Success Rate by Skill */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('analytics.successRate')}</CardTitle>
                  <CardDescription>{t('analytics.invocationStatus')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {skillAnalytics && skillAnalytics.topSkills.length > 0 ? (
                    <div className="space-y-4">
                      {skillAnalytics.topSkills.map((skill, i) => (
                        <div key={skill.capabilityId} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium truncate flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: DONUT_COLORS[i] || '#6b7280' }}
                              />
                              {skill.name}
                            </span>
                            <span className="text-muted-foreground shrink-0 ml-2">
                              {(skill.successRate ?? 0).toFixed(1)}% ({skill.successCount ?? 0}/{skill.total ?? 0})
                            </span>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full">
                            <div
                              className={cn(
                                'h-2 rounded-full transition-all',
                                skill.successRate >= 80 ? 'bg-emerald-500' : (skill.successRate ?? 0) >= 50 ? 'bg-amber-500' : 'bg-red-500'
                              )}
                              style={{ width: `${skill.successRate ?? 0}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <TrendingUp className="w-10 h-10 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">{t('analytics.noData')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Invocations Table */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">{t('analytics.recentInvocations')}</CardTitle>
                <CardDescription>{t('analytics.overview')}</CardDescription>
              </CardHeader>
              <CardContent>
                {skillAnalytics && skillAnalytics.recentInvocations.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">{t('analytics.topSkills')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Status</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Duration</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skillAnalytics.recentInvocations.map((inv) => (
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
                    <Clock className="w-10 h-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">{t('analytics.noData')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
