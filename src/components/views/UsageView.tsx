'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BarChart3, DollarSign, Zap, Hash, Users, Loader2, TrendingUp, Database,
  Activity, CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UsageData {
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  sessionCount: number;
  cacheHitRate: number;
  modelBreakdown: { model: string; inputTokens: number; outputTokens: number; cost: number }[];
  dailyTrend: { date: string; inputTokens: number; outputTokens: number; cost: number }[];
}

interface SkillAnalyticsData {
  totalInvocations: number;
  invocationsBySkill: { capabilityId: string; name: string; count: number }[];
  invocationsByStatus: Record<string, number>;
  recentInvocations: { id: string; capabilityId: string; capabilityName: string; status: string; duration: number | null; error: string | null; createdAt: string; completedAt: string | null }[];
  topSkills: { capabilityId: string; name: string; total: number; successCount: number; successRate: number }[];
}

const PERIODS = [
  { key: '7d', labelKey: 'usage.7days' },
  { key: '30d', labelKey: 'usage.30days' },
  { key: '90d', labelKey: 'usage.90days' },
];

// Donut chart colors for top 5 skills
const DONUT_COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899'];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
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

// CSS-only Donut Chart Component
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

  // Build conic-gradient segments using reduce to avoid mutation
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

  // If there are remaining skills beyond top 5, add "Other" segment
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
      {/* Donut chart */}
      <div className="relative w-40 h-40 shrink-0">
        <div
          className="w-full h-full rounded-full"
          style={{
            background: `conic-gradient(${gradientStops})`,
          }}
        />
        {/* Center hole */}
        <div className="absolute inset-4 rounded-full bg-background flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-bold">{total}</p>
            <p className="text-[10px] text-muted-foreground">{t('analytics.totalInvocations')}</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2 text-sm flex-1 min-w-0">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="truncate flex-1 min-w-0">{s.name}</span>
            <span className="text-muted-foreground shrink-0">{s.percentage}%</span>
            <span className="text-muted-foreground text-xs shrink-0">({s.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Status badge for invocations
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

export function UsageView() {
  const { t } = useI18n();
  const [period, setPeriod] = useState('30d');
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [skillAnalytics, setSkillAnalytics] = useState<SkillAnalyticsData | null>(null);
  const [skillLoading, setSkillLoading] = useState(true);

  useEffect(() => {
    loadUsage();
  }, [period]);

  useEffect(() => {
    loadSkillAnalytics();
  }, []);

  const loadUsage = async () => {
    setLoading(true);
    try {
      const result = await api.getUsage(period);
      setUsage(result.usage || null);
    } catch {
      // Provide mock data for UI display
      setUsage({
        totalInputTokens: 2450000,
        totalOutputTokens: 890000,
        estimatedCost: 12.35,
        sessionCount: 156,
        cacheHitRate: 0.34,
        modelBreakdown: [
          { model: 'gpt-4o', inputTokens: 1200000, outputTokens: 450000, cost: 8.2 },
          { model: 'claude-3.5', inputTokens: 800000, outputTokens: 300000, cost: 3.1 },
          { model: 'gpt-4o-mini', inputTokens: 350000, outputTokens: 120000, cost: 0.85 },
          { model: 'gemini-pro', inputTokens: 100000, outputTokens: 20000, cost: 0.2 },
        ],
        dailyTrend: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(5, 10),
          inputTokens: Math.floor(Math.random() * 100000 + 50000),
          outputTokens: Math.floor(Math.random() * 40000 + 15000),
          cost: Math.random() * 0.8 + 0.2,
        })),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSkillAnalytics = async () => {
    setSkillLoading(true);
    try {
      const result = await api.getSkillAnalytics();
      setSkillAnalytics(result);
    } catch {
      // Return empty/zero data on error
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
  };

  const costStatus = usage
    ? usage.estimatedCost > 50
      ? { color: 'text-red-600', bgColor: 'bg-red-500/10', labelKey: 'usage.costHigh' }
      : usage.estimatedCost > 20
        ? { color: 'text-amber-600', bgColor: 'bg-amber-500/10', labelKey: 'usage.costMedium' }
        : { color: 'text-emerald-600', bgColor: 'bg-emerald-500/10', labelKey: 'usage.costLow' }
    : null;

  if (loading || !usage) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const maxModelInput = Math.max(...usage.modelBreakdown.map((m) => m.inputTokens), 1);
  const maxDailyCost = Math.max(...usage.dailyTrend.map((d) => d.cost), 0.01);

  // Calculate overall success rate from skill analytics
  const totalInvocations = skillAnalytics?.totalInvocations ?? 0;
  const successCount = skillAnalytics?.invocationsByStatus?.success ?? 0;
  const successRate = totalInvocations > 0 ? (successCount / totalInvocations) * 100 : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('usage.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('usage.subtitle')}</p>
        </div>
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList>
            {PERIODS.map((p) => (
              <TabsTrigger key={p.key} value={p.key} className="text-xs">
                {t(p.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Stat Cards */}
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
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('usage.estimatedCost')}</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(usage.estimatedCost)}</div>
            {costStatus && (
              <Badge variant="outline" className={cn('text-[10px] mt-1', costStatus.color)}>
                {t(costStatus.labelKey)}
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('usage.sessionCount')}</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-cyan-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usage.sessionCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Usage Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('usage.modelBreakdown')}</CardTitle>
            <CardDescription>{t('usage.modelBreakdownDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {usage.modelBreakdown.map((model) => (
                <div key={model.model} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{model.model}</span>
                    <span className="text-muted-foreground">{formatTokens(model.inputTokens + model.outputTokens)} · {formatCost(model.cost)}</span>
                  </div>
                  <div className="flex gap-1 h-4">
                    <div
                      className="bg-emerald-500 rounded-l-sm min-w-[2px]"
                      style={{ width: `${(model.inputTokens / maxModelInput) * 70}%` }}
                      title={`${t('usage.inputTokens')}: ${formatTokens(model.inputTokens)}`}
                    />
                    <div
                      className="bg-violet-400 rounded-r-sm min-w-[2px]"
                      style={{ width: `${(model.outputTokens / maxModelInput) * 30}%` }}
                      title={`${t('usage.outputTokens')}: ${formatTokens(model.outputTokens)}`}
                    />
                  </div>
                  <div className="flex gap-4 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> {t('usage.inputTokens')}: {formatTokens(model.inputTokens)}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet-400" /> {t('usage.outputTokens')}: {formatTokens(model.outputTokens)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Daily Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('usage.dailyTrend')}</CardTitle>
            <CardDescription>{t('usage.dailyTrendDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-[2px] h-40">
              {usage.dailyTrend.map((day, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm bg-amber-400 hover:bg-amber-500 transition-colors cursor-pointer group relative min-w-[3px]"
                  style={{ height: `${(day.cost / maxDailyCost) * 100}%` }}
                  title={`${day.date}: ${formatCost(day.cost)}`}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow whitespace-nowrap z-10">
                    {day.date}: {formatCost(day.cost)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
              <span>{usage.dailyTrend[0]?.date}</span>
              <span>{usage.dailyTrend[usage.dailyTrend.length - 1]?.date}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cache Hit Rate */}
      <Card className="mt-6">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('usage.cacheHitRate')}</p>
              <p className="text-xs text-muted-foreground">{t('usage.cacheHitRateDesc')}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{(usage.cacheHitRate * 100).toFixed(1)}%</p>
            <div className="w-32 h-2 bg-muted rounded-full mt-1">
              <div
                className="h-2 bg-cyan-500 rounded-full transition-all"
                style={{ width: `${usage.cacheHitRate * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========== Skill Analytics Section ========== */}
      <div className="mt-8">
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
                    {t('analytics.invocationStatus')}: {skillAnalytics?.invocationsByStatus?.success ?? 0} {t('analytics.successRate').split(' ')[0].toLowerCase()} / {skillAnalytics?.invocationsByStatus?.failed ?? 0} failed / {skillAnalytics?.invocationsByStatus?.timeout ?? 0} timeout
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
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('analytics.overview')}
                  </p>
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
                              {skill.successRate.toFixed(1)}% ({skill.successCount}/{skill.total})
                            </span>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full">
                            <div
                              className={cn(
                                'h-2 rounded-full transition-all',
                                skill.successRate >= 80 ? 'bg-emerald-500' : skill.successRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                              )}
                              style={{ width: `${skill.successRate}%` }}
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
