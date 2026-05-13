'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ─── Agent Card Skeleton ────────────────────────────────────────
export function AgentCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-1 w-full bg-muted animate-pulse" />
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
            <div className="flex items-center gap-3 mt-2">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
          <Skeleton className="h-8 flex-1 rounded-md" />
          <Skeleton className="w-8 h-8 rounded-md" />
          <Skeleton className="w-8 h-8 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Provider Card Skeleton ────────────────────────────────────
export function ProviderCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <Skeleton className="h-3 w-32 font-mono" />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          <Skeleton className="h-7 w-24 rounded-md" />
          <div className="flex items-center gap-1">
            <Skeleton className="w-7 h-7 rounded-md" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Chat Message Skeleton ────────────────────────────────────
export function MessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={cn('flex gap-3 animate-in fade-in duration-300', isUser && 'flex-row-reverse')}>
      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      <div className="max-w-[70%] space-y-2">
        <Skeleton
          className={cn(
            'h-20 rounded-2xl',
            isUser ? 'bg-primary/20 rounded-br-md' : 'rounded-bl-md'
          )}
        />
      </div>
    </div>
  );
}

// ─── Stat Card Skeleton ───────────────────────────────────────
export function StatCardSkeleton() {
  return (
    <Card className="border-l-4 border-l-muted">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="w-9 h-9 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  );
}

// ─── Workflow Card Skeleton ────────────────────────────────────
export function WorkflowCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-4 mt-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-14" />
        </div>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
          <Skeleton className="h-8 flex-1 rounded-md" />
          <Skeleton className="w-8 h-8 rounded-md" />
          <Skeleton className="w-8 h-8 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Table Row Skeleton ───────────────────────────────────────
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-border/50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-2.5 px-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}
