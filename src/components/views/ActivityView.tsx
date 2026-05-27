'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, RefreshCw, Filter, ChevronDown, ChevronRight,
  Check, X, Loader2, MessageSquare, Wrench, Zap, Clock,
  ArrowRight, Play, RotateCcw, ExternalLink, BarChart3,
  Users, Timer, Hash, AlertTriangle
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
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type RunStatus = 'completed' | 'failed' | 'in_progress' | 'cancelled';
type StepType = 'message_creation' | 'tool_calls' | 'tool_execution';
type StepStatus = 'queued' | 'in_progress' | 'completed' | 'failed';

interface Step {
  id: string;
  type: StepType;
  status: StepStatus;
  name?: string;
  content?: string;
  toolName?: string;
  toolParams?: string;
  toolResult?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

interface Run {
  id: string;
  runNumber: number;
  agentName: string;
  status: RunStatus;
  steps: Step[];
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  threadTitle?: string;
  inputTokens: number;
  outputTokens: number;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const yesterday = new Date(today.getTime() - 86400000);
const twoDaysAgo = new Date(today.getTime() - 2 * 86400000);
const threeDaysAgo = new Date(today.getTime() - 3 * 86400000);
const fiveDaysAgo = new Date(today.getTime() - 5 * 86400000);

function timeStr(base: Date, h: number, m: number, s: number): string {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, s).toISOString();
}

const mockRuns: Run[] = [
  {
    id: 'run-12',
    runNumber: 12,
    agentName: 'GPT Assistant',
    status: 'completed',
    startedAt: timeStr(today, 14, 32, 5),
    completedAt: timeStr(today, 14, 32, 6),
    durationMs: 1200,
    threadTitle: 'Help with API',
    inputTokens: 245,
    outputTokens: 128,
    steps: [
      {
        id: 's12-1',
        type: 'message_creation',
        status: 'completed',
        content: 'Let me search for that...',
        durationMs: 300,
      },
      {
        id: 's12-2',
        type: 'tool_calls',
        status: 'completed',
        toolName: 'web_search',
        toolParams: 'web_search({ query: "REST API best practices" })',
        durationMs: 100,
      },
      {
        id: 's12-3',
        type: 'tool_execution',
        status: 'completed',
        toolResult: 'Found 10 results about REST API design patterns...',
        durationMs: 500,
      },
      {
        id: 's12-4',
        type: 'message_creation',
        status: 'completed',
        content: 'Based on my search, here are the key REST API best practices...',
        durationMs: 300,
      },
    ],
  },
  {
    id: 'run-11',
    runNumber: 11,
    agentName: 'Code Helper',
    status: 'failed',
    startedAt: timeStr(today, 14, 28, 12),
    completedAt: timeStr(today, 14, 28, 13),
    durationMs: 800,
    threadTitle: 'Debug Python script',
    inputTokens: 180,
    outputTokens: 45,
    steps: [
      {
        id: 's11-1',
        type: 'message_creation',
        status: 'completed',
        content: 'Let me look at the error...',
        durationMs: 250,
      },
      {
        id: 's11-2',
        type: 'tool_calls',
        status: 'completed',
        toolName: 'code_execute',
        toolParams: 'code_execute({ language: "python", code: "import sys; ..." })',
        durationMs: 150,
      },
      {
        id: 's11-3',
        type: 'tool_execution',
        status: 'failed',
        toolResult: 'Error: ModuleNotFoundError: No module named "pandas"',
        durationMs: 400,
      },
    ],
  },
  {
    id: 'run-10',
    runNumber: 10,
    agentName: 'GPT Assistant',
    status: 'completed',
    startedAt: timeStr(today, 10, 15, 33),
    completedAt: timeStr(today, 10, 15, 36),
    durationMs: 3100,
    threadTitle: 'Explain transformers',
    inputTokens: 520,
    outputTokens: 380,
    steps: [
      {
        id: 's10-1',
        type: 'message_creation',
        status: 'completed',
        content: 'Great question! Let me explain transformer architecture...',
        durationMs: 200,
      },
      {
        id: 's10-2',
        type: 'message_creation',
        status: 'completed',
        content: 'Transformers use self-attention mechanisms to process...',
        durationMs: 1500,
      },
      {
        id: 's10-3',
        type: 'message_creation',
        status: 'completed',
        content: 'In summary, the key innovation is...',
        durationMs: 1400,
      },
    ],
  },
  {
    id: 'run-9',
    runNumber: 9,
    agentName: 'Code Helper',
    status: 'in_progress',
    startedAt: timeStr(today, 15, 45, 0),
    durationMs: 0,
    threadTitle: 'Refactor React component',
    inputTokens: 310,
    outputTokens: 0,
    steps: [
      {
        id: 's9-1',
        type: 'message_creation',
        status: 'completed',
        content: 'I\'ll help you refactor that component...',
        durationMs: 280,
      },
      {
        id: 's9-2',
        type: 'tool_calls',
        status: 'in_progress',
        toolName: 'file_read',
        toolParams: 'file_read({ path: "/src/components/App.tsx" })',
        durationMs: 0,
      },
    ],
  },
  {
    id: 'run-8',
    runNumber: 8,
    agentName: 'Data Analyst',
    status: 'completed',
    startedAt: timeStr(yesterday, 9, 15, 33),
    completedAt: timeStr(yesterday, 9, 15, 36),
    durationMs: 3100,
    threadTitle: 'Sales report analysis',
    inputTokens: 450,
    outputTokens: 290,
    steps: [
      {
        id: 's8-1',
        type: 'message_creation',
        status: 'completed',
        content: 'Analyzing the sales data...',
        durationMs: 300,
      },
      {
        id: 's8-2',
        type: 'tool_calls',
        status: 'completed',
        toolName: 'calculator',
        toolParams: 'calculator({ expression: "sum(sales_q4)" })',
        durationMs: 100,
      },
      {
        id: 's8-3',
        type: 'tool_execution',
        status: 'completed',
        toolResult: 'Result: $1,245,000',
        durationMs: 200,
      },
      {
        id: 's8-4',
        type: 'message_creation',
        status: 'completed',
        content: 'The Q4 sales total is $1,245,000...',
        durationMs: 2500,
      },
    ],
  },
  {
    id: 'run-7',
    runNumber: 7,
    agentName: 'GPT Assistant',
    status: 'cancelled',
    startedAt: timeStr(yesterday, 16, 22, 10),
    completedAt: timeStr(yesterday, 16, 22, 12),
    durationMs: 2000,
    threadTitle: 'Write documentation',
    inputTokens: 120,
    outputTokens: 30,
    steps: [
      {
        id: 's7-1',
        type: 'message_creation',
        status: 'completed',
        content: 'I\'ll write the documentation for...',
        durationMs: 300,
      },
      {
        id: 's7-2',
        type: 'message_creation',
        status: 'failed',
        content: 'Run was cancelled by user',
        durationMs: 1700,
      },
    ],
  },
  {
    id: 'run-6',
    runNumber: 6,
    agentName: 'Code Helper',
    status: 'completed',
    startedAt: timeStr(twoDaysAgo, 11, 30, 0),
    completedAt: timeStr(twoDaysAgo, 11, 30, 4),
    durationMs: 4000,
    threadTitle: 'Fix TypeScript errors',
    inputTokens: 600,
    outputTokens: 420,
    steps: [
      {
        id: 's6-1',
        type: 'message_creation',
        status: 'completed',
        content: 'Let me check those TypeScript errors...',
        durationMs: 400,
      },
      {
        id: 's6-2',
        type: 'tool_calls',
        status: 'completed',
        toolName: 'file_read',
        toolParams: 'file_read({ path: "/src/utils/helpers.ts" })',
        durationMs: 150,
      },
      {
        id: 's6-3',
        type: 'tool_execution',
        status: 'completed',
        toolResult: 'File content loaded (142 lines)',
        durationMs: 300,
      },
      {
        id: 's6-4',
        type: 'message_creation',
        status: 'completed',
        content: 'I found 3 type errors. Here are the fixes...',
        durationMs: 3150,
      },
    ],
  },
  {
    id: 'run-5',
    runNumber: 5,
    agentName: 'Data Analyst',
    status: 'failed',
    startedAt: timeStr(threeDaysAgo, 14, 0, 0),
    completedAt: timeStr(threeDaysAgo, 14, 0, 2),
    durationMs: 2000,
    threadTitle: 'Generate chart data',
    inputTokens: 200,
    outputTokens: 0,
    steps: [
      {
        id: 's5-1',
        type: 'message_creation',
        status: 'completed',
        content: 'I\'ll generate the chart data for you...',
        durationMs: 300,
      },
      {
        id: 's5-2',
        type: 'tool_calls',
        status: 'failed',
        toolName: 'http_request',
        toolParams: 'http_request({ url: "https://api.data.com/v1/chart" })',
        durationMs: 1700,
      },
    ],
  },
  {
    id: 'run-4',
    runNumber: 4,
    agentName: 'GPT Assistant',
    status: 'completed',
    startedAt: timeStr(fiveDaysAgo, 8, 45, 12),
    completedAt: timeStr(fiveDaysAgo, 8, 45, 13),
    durationMs: 900,
    threadTitle: 'Summarize article',
    inputTokens: 350,
    outputTokens: 200,
    steps: [
      {
        id: 's4-1',
        type: 'message_creation',
        status: 'completed',
        content: 'Here\'s a summary of the article...',
        durationMs: 900,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getDateGroup(iso: string): string {
  const d = new Date(iso);
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
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

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------
const statusConfig: Record<RunStatus, { icon: React.ReactNode; color: string; label: string }> = {
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
function RunStepTimeline({ steps }: { steps: Step[] }) {
  const { t } = useI18n();

  return (
    <div className="space-y-0">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const sConfig = stepStatusConfig[step.status];

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
                  stepTypeIcons[step.type]
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
                  {step.toolName || t(stepTypeLabelKeys[step.type])}
                </span>
                <span className="shrink-0">{sConfig.icon}</span>
                {step.durationMs !== undefined && step.durationMs > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatDuration(step.durationMs)}
                  </span>
                )}
              </div>

              {/* Tool params */}
              {step.type === 'tool_calls' && step.toolParams && (
                <div className="mt-1 text-[11px] text-muted-foreground bg-muted/50 rounded-md px-2 py-1 font-mono truncate max-w-[400px]">
                  {step.toolParams}
                </div>
              )}

              {/* Tool result */}
              {step.type === 'tool_execution' && step.toolResult && (
                <details className="mt-1">
                  <summary className="text-[11px] text-primary cursor-pointer hover:underline">
                    {t('activity.toolResult')}
                  </summary>
                  <div className="mt-1 text-[11px] text-muted-foreground bg-muted/50 rounded-md px-2 py-1.5 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto max-w-[400px]">
                    {step.toolResult}
                  </div>
                </details>
              )}

              {/* Message content */}
              {step.type === 'message_creation' && step.content && step.status === 'completed' && (
                <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                  &ldquo;{step.content}&rdquo;
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
function RunCardComponent({ run }: { run: Run }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const sConfig = statusConfig[run.status];
  const completedSteps = run.steps.filter((s) => s.status === 'completed').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      layout
    >
      <Card className="overflow-hidden hover:shadow-md hover:border-primary/20 dark:hover:border-primary/15 transition-all duration-200">
        <CardContent className="p-0">
          {/* Header - clickable to expand */}
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="w-full text-left px-4 py-3 hover:bg-accent/30 transition-colors"
          >
            <div className="flex items-center gap-2 flex-wrap">
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="text-xs font-semibold text-foreground/80">
                {t('activity.run')} #{run.runNumber}
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{run.agentName}</span>
              <Badge
                variant="outline"
                className={cn('text-[10px] h-4 px-1.5 border', sConfig.color)}
              >
                {run.status === 'in_progress' && <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />}
                {t(sConfig.label)}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                • {completedSteps}/{run.steps.length} {t('activity.steps')}
              </span>
              {run.durationMs > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  • {formatDuration(run.durationMs)}
                </span>
              )}
            </div>
            <div className="ml-6 mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground/70">
              <span>{formatTime(run.startedAt)}</span>
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
                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground mb-3">
                    {run.threadTitle && (
                      <span className="flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {t('activity.thread')}: &ldquo;{run.threadTitle}&rdquo;
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
                    <RunStepTimeline steps={run.steps} />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5">
                      <ExternalLink className="w-3 h-3" />
                      {t('activity.viewThread')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 gap-1.5"
                      onClick={() => toast.info(t('activity.rerunStarted'))}
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
function StatsSummary({ runs }: { runs: Run[] }) {
  const { t } = useI18n();

  const todayRuns = runs.filter((r) => getDateGroup(r.startedAt) === 'today');
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
// Main Component
// ---------------------------------------------------------------------------
export default function ActivityView() {
  const { t } = useI18n();
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Unique agent names
  const agentNames = useMemo(() => {
    const names = new Set(mockRuns.map((r) => r.agentName));
    return Array.from(names).sort();
  }, []);

  // Filtered runs
  const filteredRuns = useMemo(() => {
    return mockRuns.filter((run) => {
      const matchesAgent = agentFilter === 'all' || run.agentName === agentFilter;
      const matchesStatus = statusFilter === 'all' || run.status === statusFilter;
      return matchesAgent && matchesStatus;
    });
  }, [agentFilter, statusFilter]);

  // Group runs by date
  const groupedRuns = useMemo(() => {
    const groups: Record<string, Run[]> = {};
    for (const run of filteredRuns) {
      const group = getDateGroup(run.startedAt);
      if (!groups[group]) groups[group] = [];
      groups[group].push(run);
    }
    // Sort runs within each group (newest first)
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    }
    return groups;
  }, [filteredRuns]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 600));
    setRefreshing(false);
    toast.success(t('activity.refreshed'));
  };

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
                    {agentNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
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
      <StatsSummary runs={mockRuns} />

      {/* Active filters indicators */}
      {(agentFilter !== 'all' || statusFilter !== 'all') && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-muted-foreground">{t('activity.filteringBy')}:</span>
          {agentFilter !== 'all' && (
            <Badge variant="outline" className="text-[10px] h-5 px-2 gap-1">
              {agentFilter}
              <button onClick={() => setAgentFilter('all')} className="hover:text-destructive">
                <X className="w-2.5 h-2.5" />
              </button>
            </Badge>
          )}
          {statusFilter !== 'all' && (
            <Badge variant="outline" className="text-[10px] h-5 px-2 gap-1">
              {t(`activity.status${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1).replace('_', '')}`)}
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

      {/* Runs grouped by date */}
      {filteredRuns.length === 0 ? (
        <EmptyActivityState />
      ) : (
        <div className="space-y-6">
          {dateGroupOrder.map((group) => {
            const runs = groupedRuns[group];
            if (!runs || runs.length === 0) return null;

            return (
              <div key={group}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {getDateGroupLabel(group, t)}
                  </h2>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {runs.length}
                  </Badge>
                </div>
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {runs.map((run) => (
                      <RunCardComponent key={run.id} run={run} />
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


