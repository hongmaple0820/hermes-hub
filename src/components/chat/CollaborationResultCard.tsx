'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Radio,
  GitBranch,
  RefreshCw,
  ThumbsUp,
  Bot,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CollabType = 'delegate' | 'handoff' | 'broadcast' | 'pipeline' | 'round-robin' | 'consensus';

interface AgentResult {
  agentId: string;
  agentName: string;
  content: string;
  success: boolean;
  error?: string;
  duration: number;
  tokenUsage?: { input: number; output: number };
}

interface CollaborationResult {
  type: CollabType;
  success: boolean;
  results: AgentResult[];
  aggregatedResult?: string;
  duration: number;
  errors: string[];
}

interface CollaborationResultCardProps {
  result: CollaborationResult;
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<CollabType, { icon: React.ReactNode; color: string; bgColor: string; labelKey: string }> = {
  delegate: {
    icon: <ArrowRight className="w-3.5 h-3.5" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
    labelKey: 'collaboration.typeDelegate',
  },
  handoff: {
    icon: <ArrowRight className="w-3.5 h-3.5" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
    labelKey: 'collaboration.typeHandoff',
  },
  broadcast: {
    icon: <Radio className="w-3.5 h-3.5" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
    labelKey: 'collaboration.typeBroadcast',
  },
  pipeline: {
    icon: <GitBranch className="w-3.5 h-3.5" />,
    color: 'text-violet-600',
    bgColor: 'bg-violet-500/10',
    labelKey: 'collaboration.typePipeline',
  },
  'round-robin': {
    icon: <RefreshCw className="w-3.5 h-3.5" />,
    color: 'text-sky-600',
    bgColor: 'bg-sky-500/10',
    labelKey: 'collaboration.typeRoundRobin',
  },
  consensus: {
    icon: <ThumbsUp className="w-3.5 h-3.5" />,
    color: 'text-rose-600',
    bgColor: 'bg-rose-500/10',
    labelKey: 'collaboration.typeConsensus',
  },
};

const AGENT_COLORS = [
  { bg: 'bg-emerald-500/15', text: 'text-emerald-700', border: 'border-emerald-500/30' },
  { bg: 'bg-amber-500/15', text: 'text-amber-700', border: 'border-amber-500/30' },
  { bg: 'bg-violet-500/15', text: 'text-violet-700', border: 'border-violet-500/30' },
  { bg: 'bg-sky-500/15', text: 'text-sky-700', border: 'border-sky-500/30' },
  { bg: 'bg-rose-500/15', text: 'text-rose-700', border: 'border-rose-500/30' },
  { bg: 'bg-orange-500/15', text: 'text-orange-700', border: 'border-orange-500/30' },
];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CollaborationResultCard({ result, compact = false }: CollaborationResultCardProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const typeConfig = TYPE_CONFIG[result.type] || TYPE_CONFIG.broadcast;
  const successCount = result.results.filter((r) => r.success).length;
  const totalTokens = result.results.reduce((sum, r) => sum + (r.tokenUsage?.input || 0) + (r.tokenUsage?.output || 0), 0);

  return (
    <Card className={cn(
      'border-l-4 overflow-hidden transition-all duration-200',
      result.success ? 'border-l-emerald-500' : 'border-l-rose-500',
    )}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Type badge */}
            <Badge variant="outline" className={cn('gap-1 text-[10px]', typeConfig.color, typeConfig.bgColor)}>
              {typeConfig.icon}
              {t(typeConfig.labelKey)}
            </Badge>
            {/* Success/failure badge */}
            {result.success ? (
              <Badge className="gap-1 text-[10px] bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-0">
                <CheckCircle2 className="w-3 h-3" />
                {t('collaboration.success')}
              </Badge>
            ) : (
              <Badge className="gap-1 text-[10px] bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 border-0">
                <XCircle className="w-3 h-3" />
                {t('collaboration.failed')}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(result.duration)}
            </span>
            {totalTokens > 0 && (
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {totalTokens} tokens
              </span>
            )}
            <span>{successCount}/{result.results.length}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-3 pt-0 space-y-2">
        {/* Aggregated Result */}
        {result.aggregatedResult && !compact && (
          <div className="rounded-lg bg-muted/50 p-3 mt-2">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('collaboration.overallResult')}</p>
            <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
              <MarkdownRenderer content={result.aggregatedResult.slice(0, expanded ? undefined : 300)} />
            </div>
          </div>
        )}

        {/* Agent Contributions */}
        <div className="space-y-1.5">
          {result.results.map((ar, i) => {
            const color = AGENT_COLORS[i % AGENT_COLORS.length];
            const summary = ar.content.slice(0, expanded ? undefined : 120);
            return (
              <div
                key={ar.agentId + i}
                className={cn('rounded-lg border p-2.5', color.border, color.bg)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-5 h-5 rounded-full flex items-center justify-center', color.bg)}>
                      <Bot className={cn('w-3 h-3', color.text)} />
                    </div>
                    <span className={cn('text-xs font-medium', color.text)}>{ar.agentName}</span>
                    {ar.success ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-rose-500" />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{formatDuration(ar.duration)}</span>
                </div>
                {ar.success ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {summary}
                    {!expanded && ar.content.length > 120 && '...'}
                  </p>
                ) : (
                  <p className="text-xs text-rose-600">{ar.error || t('collaboration.agentFailed')}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Errors */}
        {result.errors.length > 0 && (
          <div className="rounded-lg bg-rose-500/5 border border-rose-500/20 p-2.5">
            <p className="text-[10px] font-medium text-rose-600 mb-1">{t('collaboration.errors')}</p>
            {result.errors.map((err, i) => (
              <p key={i} className="text-xs text-rose-600/80">{err}</p>
            ))}
          </div>
        )}

        {/* Expand button */}
        {result.aggregatedResult && result.aggregatedResult.length > 300 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs gap-1 h-7"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3" /> {t('collaboration.showLess')}
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" /> {t('collaboration.showMore')}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
