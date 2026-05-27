'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { StepTimeline, type Step } from './StepTimeline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type RunStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface Run {
  id: string;
  runNumber: number;
  status: RunStatus;
  steps: Step[];
  startedAt?: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface RunCardProps {
  run: Run;
}

const statusColorMap: Record<RunStatus, string> = {
  queued: 'bg-muted text-muted-foreground border-border',
  in_progress: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
  completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

const statusLabelKey: Record<RunStatus, string> = {
  queued: 'chat2.runStatusQueued',
  in_progress: 'chat2.runStatusInProgress',
  completed: 'chat2.runStatusCompleted',
  failed: 'chat2.runStatusFailed',
  cancelled: 'chat2.runStatusFailed',
};

export function RunCard({ run }: RunCardProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(run.status === 'in_progress');

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="my-2 rounded-xl border border-border bg-muted/30 dark:bg-muted/20 overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}

        <span className="text-xs font-semibold text-foreground/80">
          {t('chat2.run')} #{run.runNumber}
        </span>

        <Badge
          variant="outline"
          className={cn('text-[10px] h-4 px-1.5 border', statusColorMap[run.status])}
        >
          {run.status === 'in_progress' && <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />}
          {t(statusLabelKey[run.status])}
        </Badge>

        <span className="text-[10px] text-muted-foreground ml-auto">
          {run.steps.filter((s) => s.status === 'completed').length}/{run.steps.length} steps
        </span>
      </button>

      {/* Steps */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pl-5">
              <StepTimeline steps={run.steps} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
