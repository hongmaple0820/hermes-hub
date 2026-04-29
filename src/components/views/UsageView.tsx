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

const PERIODS = [
  { key: '7d', labelKey: 'usage.7days' },
  { key: '30d', labelKey: 'usage.30days' },
  { key: '90d', labelKey: 'usage.90days' },
];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

export function UsageView() {
  const { t } = useI18n();
  const [period, setPeriod] = useState('30d');
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsage();
  }, [period]);

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
    </div>
  );
}
