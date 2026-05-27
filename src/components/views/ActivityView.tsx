'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, RefreshCw, Filter, ChevronDown, ChevronRight,
  Check, X, Loader2, MessageSquare, Wrench, Zap, Clock,
  ArrowRight, RotateCcw, ExternalLink, BarChart3,
  Timer, Hash, AlertTriangle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api-client';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type RunStatus = 'completed' | 'failed' | 'in_progress' | 'cancelled' | 'queued' | 'requires_action';
type StepType = 'message_creation' | 'tool_calls' | 'tool_execution';
type StepStatus = 'queued' | 'in_progress' | 'completed' | 'failed';

interface Step {
  id: string;
  type: StepType;
  status: StepStatus;
  detail: string; // JSON string
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface RunData {
  id: string;
  threadId: string;
  status: RunStatus;
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
    agent: {
      id: string;
      name: string;
      avatar: string | null;
    };
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getDateGroup(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  if (dDate.getTime() === today.getTime()) return 'today';
  if (dDate.getTime() === yesterday.getTime()) return 'yesterday';
  const diffDays = Math.floor((today.getTime() - dDate.getTime()) / 86400000);
  if (diffDays <= 7) return 'thisWeek';
  return 'older';
}

function getDateGroupLabel(group: string, t: (key: string) => string): string {
  switch (group) {
    case 'today': return t('activity.today');
    case 'yesterday': return t('activity.yesterday');
    case 'thisWeek': return t('activity.thisWeek');
    case 'older': return t('activity.older');
    default: return group;
  }
}

const dateGroupOrder = ['today', 'yesterday', 'thisWeek', 'older'];

/** Parse step detail JSON safely */
function parseDetail(detail: string): Record<string, unknown> {
  try {
    return JSON.parse(detail || '{}');
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------
const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  completed: {
    icon: <Check className="w-3.5 h-3.5" />,
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    label: 'activity.statusCompleted',
  },
  failed: {
    icon: <X className="w-3.5 h-3.5" />,
    color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
    label: 'activity.statusFailed',
  },
  in_progress: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    label: 'activity.statusInProgress',
  },
  cancelled: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30',
    label: 'activity.statusCancelled',
  },
  queued: {
    icon: <Clock className="w-3.5 h-3.5" />,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    label: 'activity.statusQueued',
  },
  requires_action: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
    label: 'activity.statusRequiresAction',
  },
};

const stepTypeIcons: Record<StepType, React.ReactNode> = {
  message_creation: <MessageSquare className="w-3.5 h-3.5" />,
  tool_calls: <Wrench className="w-3.5 h-3.5" />,
  tool_execution: <Zap className="w-3.5 h-3.5" />,
};

const stepTypeLabelKeys: Record<StepType, string> = {
  message_creation: 'activity.stepMessageCreation',
  tool_calls: 'activity.stepToolCalls',
  tool_execution: 'activity.stepToolExecution',
};

const stepStatusConfig: Record<StepStatus, { icon: React.ReactNode; dotColor: string }> = {
  completed: {
    icon: <Check className="w-3 h-3 text-emerald-500" />,
    dotColor: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
  },
  in_progress: {
    icon: <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />,
    dotColor: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
  },
  failed: {
    icon: <X className="w-3 h-3 text-red-500" />,
    dotColor: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
  },
  queued: {
    icon: <span className="w-3 h-3 rounded-full bg-muted-foreground/30 inline-block" />,
    dotColor: 'bg-muted border-border text-muted-foreground',
  },
};

// ---------------------------------------------------------------------------
// Step Timeline Component
// ---------------------------------------------------------------------------
function RunStepTimeline({ steps, loading }: { steps: Step[]; loading: boolean }) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-6 h-6 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">{t('activity.noSteps')}</p>
    );
  }

  return (
    <div className="space-y-0">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const sConfig = stepStatusConfig[step.status as StepStatus] || stepStatusConfig.queued;
        const detail = parseDetail(step.detail);
        const stepDuration =
          step.startedAt && step.completedAt
            ? new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()
            : undefined;

        // Extract tool info from detail
        const toolName =
          step.type === 'tool_calls'
            ? ((detail as Record<string, unknown>)?.calls as Array<Record<string, unknown>>)?.[0]?.name as string | undefined
            : step.type === 'tool_execution'
            ? (detail as Record<string, unknown>)?.name as string | undefined
            : undefined;

        const toolParams =
          step.type === 'tool_calls' && (detail as Record<string, unknown>)?.calls
            ? JSON.stringify((detail as Record<string, unknown>)?.calls)
            : undefined;

        const toolResult =
          step.type === 'tool_execution'
            ? ((detail as Record<string, unknown>)?.result as string) ||
              ((detail as Record<string, unknown>)?.error as string) ||
              undefined
            : undefined;

        const messageContent =
          step.type === 'message_creation'
            ? ((detail as Record<string, unknown>)?.message_id as string)
              ? undefined // We don't have the message content from step detail alone
              : undefined
            : undefined;

        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06, duration: 0.2 }}
            className="relative flex gap-3"
          >
            {/* Timeline connector */}
            <div className="flex flex-col items-center shrink-0">
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0 border',
                  sConfig.dotColor
                )}
              >
                {step.status === 'in_progress' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  stepTypeIcons[step.type as StepType] || <MessageSquare className="w-3.5 h-3.5" />
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'w-px flex-1 min-h-[20px]',
                    step.status === 'completed' ? 'bg-emerald-500/20' : 'bg-border'
                  )}
                />
              )}
            </div>

            {/* Step content */}
            <div className={cn('pb-3 flex-1 min-w-0', isLast && 'pb-0')}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground/80">
                  {toolName || t(stepTypeLabelKeys[step.type as StepType] || step.type)}
                </span>
                <span className="shrink-0">{sConfig.icon}</span>
                {stepDuration !== undefined && stepDuration > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatDuration(stepDuration)}
                  </span>
                )}
              </div>

              {/* Tool params */}
              {step.type === 'tool_calls' && toolParams && (
                <div className="mt-1 text-[11px] text-muted-foreground bg-muted/50 rounded-md px-2 py-1 font-mono truncate max-w-[400px]">
                  {toolParams}
                </div>
              )}

              {/* Tool result */}
              {step.type === 'tool_execution' && toolResult && (
                <details className="mt-1">
                  <summary className="text-[11px] text-primary cursor-pointer hover:underline">
                    {t('activity.toolResult')}
                  </summary>
                  <div className="mt-1 text-[11px] text-muted-foreground bg-muted/50 rounded-md px-2 py-1.5 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto max-w-[400px]">
                    {toolResult}
                  </div>
                </details>
              )}

              {/* Step error */}
              {step.status === 'failed' && (detail as Record<string, unknown>)?.error && (
                <div className="mt-1 text-[11px] text-red-500 bg-red-500/5 rounded-md px-2 py-1">
                  {(detail as Record<string, unknown>)?.error as string}
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run Card Component
// ---------------------------------------------------------------------------
function RunCardComponent({ run, runIndex }: { run: RunData; runIndex: number }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsLoaded, setStepsLoaded] = useState(false);

  const sConfig = statusConfig[run.status] || statusConfig.queued;

  // Lazy-load steps when expanding
  const handleExpand = useCallback(async () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);

    if (nextExpanded && !stepsLoaded) {
      setStepsLoading(true);
      try {
        const result = await api.getRunSteps(run.id);
        setSteps(result.steps || []);
        setStepsLoaded(true);
      } catch (err) {
        console.error('Failed to load steps:', err);
        toast.error(t('activity.failedToLoadSteps'));
      } finally {
        setStepsLoading(false);
      }
    }
  }, [expanded, stepsLoaded, run.id, t]);

  const completedSteps = steps.filter((s) => s.status === 'completed').length;
  const agentName = run.thread?.agent?.name || t('activity.unknownAgent');
  const threadTitle = run.thread?.title;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, delay: runIndex * 0.03 }}
      layout
    >
      <Card className="overflow-hidden hover:shadow-md hover:border-primary/20 dark:hover:border-primary/15 transition-all duration-200">
        <CardContent className="p-0">
          {/* Header - clickable to expand */}
          <button
            onClick={handleExpand}
            className="w-full text-left px-4 py-3 hover:bg-accent/30 transition-colors"
          >
            <div className="flex items-center gap-2 flex-wrap">
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="text-xs font-semibold text-foreground/80">
                {t('activity.run')} #{run.id.slice(-6)}
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{agentName}</span>
              <Badge
                variant="outline"
                className={cn('text-[10px] h-4 px-1.5 border', sConfig.color)}
              >
                {run.status === 'in_progress' && <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />}
                {t(sConfig.label)}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                • {run.stepCount} {t('activity.steps')}
              </span>
              {run.durationMs > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  • {formatDuration(run.durationMs)}
                </span>
              )}
            </div>
            <div className="ml-6 mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground/70">
              <span>{formatTime(run.startedAt || run.createdAt)}</span>
              {run.completedAt && (
                <>
                  <ArrowRight className="w-2.5 h-2.5" />
                  <span>{formatTime(run.completedAt)}</span>
                </>
              )}
            </div>
          </button>

          {/* Expanded detail */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 border-t border-border/50 pt-3">
                  {/* Error message */}
                  {run.lastError && (
                    <div className="mb-3 text-xs text-red-500 bg-red-500/5 rounded-md px-3 py-2">
                      {run.lastError}
                    </div>
                  )}

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground mb-3">
                    {threadTitle && (
                      <span className="flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {t('activity.thread')}: &ldquo;{threadTitle}&rdquo;
                      </span>
                    )}
                    {run.durationMs > 0 && (
                      <span className="flex items-center gap-1">
                        <Timer className="w-3 h-3" />
                        {formatDuration(run.durationMs)}
                      </span>
                    )}
                    {run.inputTokens > 0 && (
                      <span>{run.inputTokens} {t('activity.tokensIn')}</span>
                    )}
                    {run.outputTokens > 0 && (
                      <span>{run.outputTokens} {t('activity.tokensOut')}</span>
                    )}
                  </div>

                  {/* Steps */}
                  <div className="mb-3">
                    <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {t('activity.steps')}
                    </h4>
                    <RunStepTimeline steps={steps} loading={stepsLoading} />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 gap-1.5"
                      onClick={() => {
                        // Navigate to chat2 view with the thread
                        const store = useAppStore.getState();
                        store.setCurrentView('chat2');
                        toast.info(t('activity.navigatingToThread'));
                      }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      {t('activity.viewThread')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 gap-1.5"
                      onClick={async () => {
                        try {
                          await api.createRun(run.threadId);
                          toast.success(t('activity.rerunStarted'));
                        } catch (err) {
                          toast.error(t('activity.rerunFailed'));
                        }
                      }}
                    >
                      <RotateCcw className="w-3 h-3" />
                      {t('activity.rerun')}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Stats Summary Component
// ---------------------------------------------------------------------------
function StatsSummary({ runs }: { runs: RunData[] }) {
  const { t } = useI18n();

  const todayRuns = runs.filter((r) => getDateGroup(r.startedAt || r.createdAt) === 'today');
  const completedToday = todayRuns.filter((r) => r.status === 'completed');
  const successRate = todayRuns.length > 0 ? Math.round((completedToday.length / todayRuns.length) * 100) : 0;
  const avgDuration = todayRuns.length > 0 && todayRuns.some((r) => r.durationMs > 0)
    ? Math.round(todayRuns.filter((r) => r.durationMs > 0).reduce((sum, r) => sum + r.durationMs, 0) / todayRuns.filter((r) => r.durationMs > 0).length)
    : 0;
  const totalInputTokens = todayRuns.reduce((sum, r) => sum + r.inputTokens, 0);
  const totalOutputTokens = todayRuns.reduce((sum, r) => sum + r.outputTokens, 0);

  const stats = [
    {
      label: t('activity.totalRunsToday'),
      value: todayRuns.length,
      icon: <Activity className="w-4 h-4" />,
      color: 'text-primary',
    },
    {
      label: t('activity.successRate'),
      value: `${successRate}%`,
      icon: <Check className="w-4 h-4" />,
      color: 'text-emerald-500',
    },
    {
      label: t('activity.avgDuration'),
      value: formatDuration(avgDuration),
      icon: <Timer className="w-4 h-4" />,
      color: 'text-amber-500',
    },
    {
      label: t('activity.totalTokens'),
      value: `${totalInputTokens + totalOutputTokens}`,
      icon: <BarChart3 className="w-4 h-4" />,
      color: 'text-violet-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.2 }}
        >
          <Card className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('shrink-0', stat.color)}>
                {stat.icon}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold leading-tight">{stat.value}</div>
                <div className="text-[11px] text-muted-foreground truncate">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------
function ActivitySkeleton() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <Skeleton className="w-4 h-4 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Run cards skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-3" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-3 w-12" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------
function EmptyActivityState() {
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Activity className="w-8 h-8 text-primary/60" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{t('activity.noActivity')}</h3>
      <p className="text-sm text-muted-foreground max-w-xs">{t('activity.noActivityDesc')}</p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-red-500/60" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{t('activity.loadError')}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-4">{error}</p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="w-4 h-4 mr-2" />
        {t('common.retry')}
      </Button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function ActivityView() {
  const { t } = useI18n();
  const { agents, setCurrentView } = useAppStore();

  // Data state
  const [runs, setRuns] = useState<RunData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch runs
  const fetchRuns = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params: { status?: string; agentId?: string; limit?: number } = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (agentFilter !== 'all') params.agentId = agentFilter;
      params.limit = 100;

      const result = await api.getAllRuns(params);
      setRuns(result.runs || []);
    } catch (err) {
      console.error('Failed to fetch runs:', err);
      setError(err instanceof Error ? err.message : t('activity.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, agentFilter, t]);

  // Initial fetch + refetch on filter change
  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Agent names for filter dropdown
  const agentNames = useMemo(() => {
    const names = new Set(
      runs
        .map((r) => r.thread?.agent?.name)
        .filter(Boolean) as string[]
    );
    return Array.from(names).sort();
  }, [runs]);

  // Agent ID → name mapping for filter display
  const agentIdToName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const agent of agents) {
      map[agent.id] = agent.name;
    }
    // Also add from runs
    for (const run of runs) {
      if (run.thread?.agent) {
        map[run.thread.agent.id] = run.thread.agent.name;
      }
    }
    return map;
  }, [agents, runs]);

  // Filtered runs (client-side additional filtering for display purposes)
  const filteredRuns = useMemo(() => {
    return runs;
  }, [runs]);

  // Group runs by date
  const groupedRuns = useMemo(() => {
    const groups: Record<string, RunData[]> = {};
    for (const run of filteredRuns) {
      const group = getDateGroup(run.startedAt || run.createdAt);
      if (!groups[group]) groups[group] = [];
      groups[group].push(run);
    }
    // Sort runs within each group (newest first)
    for (const key of Object.keys(groups)) {
      groups[key].sort(
        (a, b) =>
          new Date(b.startedAt || b.createdAt).getTime() -
          new Date(a.startedAt || a.createdAt).getTime()
      );
    }
    return groups;
  }, [filteredRuns]);

  const handleRefresh = async () => {
    await fetchRuns(true);
    toast.success(t('activity.refreshed'));
  };

  // Loading state
  if (loading) {
    return <ActivitySkeleton />;
  }

  // Error state (no runs loaded at all)
  if (error && runs.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">
        <ErrorState error={error} onRetry={() => fetchRuns()} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('activity.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('activity.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                {t('activity.filter')}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('activity.filterByAgent')}</Label>
                <Select value={agentFilter} onValueChange={setAgentFilter}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('activity.allAgents')}</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('activity.filterByStatus')}</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('activity.allStatuses')}</SelectItem>
                    <SelectItem value="completed">{t('activity.statusCompleted')}</SelectItem>
                    <SelectItem value="failed">{t('activity.statusFailed')}</SelectItem>
                    <SelectItem value="in_progress">{t('activity.statusInProgress')}</SelectItem>
                    <SelectItem value="cancelled">{t('activity.statusCancelled')}</SelectItem>
                    <SelectItem value="queued">{t('activity.statusQueued')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>

          {/* Refresh button */}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <StatsSummary runs={runs} />

      {/* Active filters indicators */}
      {(agentFilter !== 'all' || statusFilter !== 'all') && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-muted-foreground">{t('activity.filteringBy')}:</span>
          {agentFilter !== 'all' && (
            <Badge variant="outline" className="text-[10px] h-5 px-2 gap-1">
              {agentIdToName[agentFilter] || agentFilter}
              <button onClick={() => setAgentFilter('all')} className="hover:text-destructive">
                <X className="w-2.5 h-2.5" />
              </button>
            </Badge>
          )}
          {statusFilter !== 'all' && (
            <Badge variant="outline" className="text-[10px] h-5 px-2 gap-1">
              {statusConfig[statusFilter]?.label ? t(statusConfig[statusFilter].label) : statusFilter}
              <button onClick={() => setStatusFilter('all')} className="hover:text-destructive">
                <X className="w-2.5 h-2.5" />
              </button>
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] h-5 px-2 text-muted-foreground"
            onClick={() => { setAgentFilter('all'); setStatusFilter('all'); }}
          >
            {t('activity.clearFilters')}
          </Button>
        </div>
      )}

      {/* Error banner (if runs were loaded but refresh failed) */}
      {error && runs.length > 0 && (
        <div className="mb-4 text-xs text-red-500 bg-red-500/5 rounded-md px-3 py-2 flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" className="text-xs h-5" onClick={() => fetchRuns()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {/* Runs grouped by date */}
      {filteredRuns.length === 0 ? (
        <EmptyActivityState />
      ) : (
        <div className="space-y-6">
          {dateGroupOrder.map((group) => {
            const groupRuns = groupedRuns[group];
            if (!groupRuns || groupRuns.length === 0) return null;

            return (
              <div key={group}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {getDateGroupLabel(group, t)}
                  </h2>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {groupRuns.length}
                  </Badge>
                </div>
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {groupRuns.map((run, index) => (
                      <RunCardComponent key={run.id} run={run} runIndex={index} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
