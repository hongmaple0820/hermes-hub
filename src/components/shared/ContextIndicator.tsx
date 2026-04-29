'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Archive, Loader2, Zap } from 'lucide-react';

interface ContextIndicatorProps {
  type: 'conversation' | 'room';
  id: string;
  onCompressed?: () => void;
}

interface ContextStats {
  totalMessages: number;
  estimatedTokens: number;
  hasSnapshot: boolean;
  snapshotSummary?: string;
  compressionType?: string;
  snapshotTokenCount?: number;
  compressionConfig?: {
    triggerTokens: number;
    maxHistoryTokens: number;
    tailMessageCount: number;
  };
}

export function ContextIndicator({ type, id, onCompressed }: ContextIndicatorProps) {
  const { t } = useI18n();
  const [stats, setStats] = useState<ContextStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const loadStats = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await api.getContextDetails(type, id);
      setStats(result as unknown as ContextStats);
    } catch (error) {
      console.error('Failed to load context stats:', error);
    } finally {
      setLoading(false);
    }
  }, [type, id]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleForceCompress = async () => {
    if (!id || compressing) return;
    setCompressing(true);
    try {
      if (type === 'room') {
        await api.compressRoom(id);
      } else {
        await api.forceCompress(type, id);
      }
      await loadStats();
      onCompressed?.();
    } catch (error: any) {
      console.error('Failed to compress:', error);
    } finally {
      setCompressing(false);
    }
  };

  if (!stats || !id) return null;

  const triggerTokens = stats.compressionConfig?.triggerTokens || 100000;
  const progressPercent = Math.min((stats.estimatedTokens / triggerTokens) * 100, 100);
  const isNearLimit = progressPercent > 80;
  const isOverLimit = progressPercent >= 100;

  const getProgressColor = () => {
    if (isOverLimit) return 'bg-destructive';
    if (isNearLimit) return 'bg-amber-500';
    return 'bg-primary';
  };

  const formatTokenCount = (tokens: number) => {
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
    return String(tokens);
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Token progress indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getProgressColor()}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className={`text-[10px] whitespace-nowrap ${isOverLimit ? 'text-destructive' : isNearLimit ? 'text-amber-500' : 'text-muted-foreground'}`}>
                {formatTokenCount(stats.estimatedTokens)} / {formatTokenCount(triggerTokens)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-72">
            <div className="space-y-1 text-xs">
              <p className="font-medium">{t('context.title')}</p>
              <p>{t('context.tokenCount')}: {stats.estimatedTokens.toLocaleString()}</p>
              <p>{t('context.threshold')}: {triggerTokens.toLocaleString()}</p>
              <p>{t('context.triggerTokens')}: {stats.compressionConfig?.triggerTokens?.toLocaleString() || '100,000'}</p>
              <p>{t('context.maxHistoryTokens')}: {stats.compressionConfig?.maxHistoryTokens?.toLocaleString() || '32,000'}</p>
              <p>{t('context.tailMessageCount')}: {stats.compressionConfig?.tailMessageCount || 20}</p>
              {stats.hasSnapshot && (
                <>
                  <p>{t('context.compressionType')}: {stats.compressionType}</p>
                  <p>Snapshot tokens: {stats.snapshotTokenCount?.toLocaleString()}</p>
                </>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Compressed badge */}
        {stats.hasSnapshot && (
          <Badge variant="outline" className="text-[10px] h-5 gap-1">
            <Archive className="w-2.5 h-2.5" />
            {t('context.compressed')}
          </Badge>
        )}

        {/* Compressing indicator */}
        {compressing && (
          <Badge variant="outline" className="text-[10px] h-5 gap-1 text-amber-500 border-amber-500/30">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            {t('context.compressing')}
          </Badge>
        )}

        {/* Force compress button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6"
              onClick={handleForceCompress}
              disabled={compressing || loading}
            >
              <Zap className="w-3 h-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">{t('context.forceCompress')}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
