'use client';

import { motion } from 'framer-motion';
import { Loader2, Check, X, MessageSquare, Wrench, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type StepType = 'message_creation' | 'tool_calls' | 'tool_execution';
export type StepStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface Step {
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
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface StepTimelineProps {
  steps: Step[];
}

const stepIconMap: Record<StepType, React.ReactNode> = {
  message_creation: <MessageSquare className="w-3.5 h-3.5" />,
  tool_calls: <Wrench className="w-3.5 h-3.5" />,
  tool_execution: <Zap className="w-3.5 h-3.5" />,
};

const stepTypeLabelKey: Record<StepType, string> = {
  message_creation: 'chat2.stepMessageCreation',
  tool_calls: 'chat2.stepToolCalls',
  tool_execution: 'chat2.stepToolExecution',
};

export function StepTimeline({ steps }: StepTimelineProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-0">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const icon = stepIconMap[step.type];
        const statusIcon = getStatusIcon(step.status);

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
              {/* Dot */}
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0 border',
                  step.status === 'completed' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
                  step.status === 'in_progress' && 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
                  step.status === 'failed' && 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
                  step.status === 'cancelled' && 'bg-muted border-border text-muted-foreground',
                  step.status === 'queued' && 'bg-muted border-border text-muted-foreground'
                )}
              >
                {step.status === 'in_progress' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  icon
                )}
              </div>
              {/* Line */}
              {!isLast && (
                <div
                  className={cn(
                    'w-px flex-1 min-h-[20px]',
                    step.status === 'completed' ? 'bg-emerald-500/20' : 'bg-border'
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className={cn('pb-3 flex-1 min-w-0', isLast && 'pb-0')}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground/80">
                  {step.toolName || t(stepTypeLabelKey[step.type])}
                </span>
                <span className="shrink-0">{statusIcon}</span>
              </div>

              {/* Step details */}
              {step.type === 'tool_calls' && step.toolParams && (
                <div className="mt-1 text-[11px] text-muted-foreground bg-muted/50 rounded-md px-2 py-1 font-mono truncate max-w-[280px]">
                  {step.toolParams}
                </div>
              )}

              {step.type === 'tool_calls' && step.status === 'in_progress' && (
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{t('chat2.toolSearching')}</span>
                </div>
              )}

              {step.type === 'tool_execution' && step.toolResult && (
                <details className="mt-1">
                  <summary className="text-[11px] text-primary cursor-pointer hover:underline">
                    {t('chat2.toolResult')}
                  </summary>
                  <div className="mt-1 text-[11px] text-muted-foreground bg-muted/50 rounded-md px-2 py-1.5 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto max-w-[280px]">
                    {step.toolResult}
                  </div>
                </details>
              )}

              {step.type === 'message_creation' && step.content && step.status === 'completed' && (
                <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                  {step.content}
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function getStatusIcon(status: StepStatus): React.ReactNode {
  switch (status) {
    case 'completed':
      return <Check className="w-3 h-3 text-emerald-500" />;
    case 'in_progress':
      return <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />;
    case 'failed':
      return <X className="w-3 h-3 text-red-500" />;
    case 'cancelled':
      return <X className="w-3 h-3 text-muted-foreground" />;
    case 'queued':
      return <span className="w-3 h-3 rounded-full bg-muted-foreground/30 inline-block" />;
  }
}
