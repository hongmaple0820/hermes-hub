'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText, Search, RefreshCw, Trash2, Loader2, ChevronDown, ChevronRight,
  Bug, Info, AlertTriangle, AlertCircle, Terminal,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LogEntry {
  id?: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  logger?: string;
  message: string;
  metadata?: Record<string, any>;
}

const LOG_TYPES = [
  { key: 'agent', labelKey: 'logs.agent', icon: Terminal },
  { key: 'gateway', labelKey: 'logs.gateway', icon: FileText },
  { key: 'error', labelKey: 'logs.error', icon: AlertCircle },
  { key: 'access', labelKey: 'logs.access', icon: Info },
];

const LEVEL_CONFIG: Record<string, { color: string; bgColor: string; icon: React.ElementType }> = {
  debug: { color: 'text-gray-500', bgColor: 'bg-gray-500/10', icon: Bug },
  info: { color: 'text-sky-600', bgColor: 'bg-sky-500/10', icon: Info },
  warn: { color: 'text-amber-600', bgColor: 'bg-amber-500/10', icon: AlertTriangle },
  error: { color: 'text-red-600', bgColor: 'bg-red-500/10', icon: AlertCircle },
};

const LIMITS = [50, 100, 200];

export function LogsView() {
  const { t } = useI18n();
  const [logType, setLogType] = useState('agent');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState(100);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(() => new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLogs();
  }, [logType, limit]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const result = await api.getLogs(logType, limit);
      setLogs(result.logs || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const toggleExpand = (index: number) => {
    const key = String(index);
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleClear = () => {
    setLogs([]);
    setExpandedEntries(new Set());
  };

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    const matchesSearch = !searchQuery ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.logger?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const levelCounts = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('logs.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('logs.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMITS.map((l) => (
                <SelectItem key={l} value={String(l)}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadLogs} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
          <Button variant="outline" size="icon" onClick={handleClear}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('logs.searchPlaceholder')}
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          <Button
            variant={levelFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            className="text-xs"
            onClick={() => setLevelFilter('all')}
          >
            {t('logs.all')} ({logs.length})
          </Button>
          {Object.entries(LEVEL_CONFIG).map(([level, config]) => (
            <Button
              key={level}
              variant={levelFilter === level ? 'default' : 'outline'}
              size="sm"
              className={cn('text-xs gap-1', levelFilter !== level && config.color)}
              onClick={() => setLevelFilter(level)}
            >
              <config.icon className="w-3 h-3" />
              {t(`logs.${level}`)}
              {levelCounts[level] !== undefined && <span>({levelCounts[level]})</span>}
            </Button>
          ))}
        </div>
      </div>

      {/* Log Type Tabs */}
      <Tabs value={logType} onValueChange={setLogType} className="mb-4">
        <TabsList>
          {LOG_TYPES.map((type) => (
            <TabsTrigger key={type.key} value={type.key} className="gap-1.5 text-xs">
              <type.icon className="w-3.5 h-3.5" /> {t(type.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Log Entries */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('logs.noLogsTitle')}</h3>
            <p className="text-muted-foreground text-sm">{t('logs.noLogsDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ScrollArea className="h-[600px]" ref={scrollRef}>
            <div className="divide-y divide-border">
              {filteredLogs.map((log, index) => {
                const levelCfg = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info;
                const LevelIcon = levelCfg.icon;
                const isExpanded = expandedEntries.has(String(index));
                const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

                return (
                  <div key={index} className="hover:bg-accent/50 transition-colors">
                    <div
                      className="flex items-start gap-3 px-4 py-2.5 cursor-pointer"
                      onClick={() => hasMetadata && toggleExpand(index)}
                    >
                      {hasMetadata ? (
                        isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        )
                      ) : (
                        <div className="w-4 shrink-0" />
                      )}
                      <LevelIcon className={cn('w-4 h-4 shrink-0 mt-0.5', levelCfg.color)} />
                      <span className="text-xs text-muted-foreground font-mono shrink-0 w-[170px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <Badge variant="outline" className={cn('text-[10px] shrink-0', levelCfg.color)}>
                        {log.level.toUpperCase()}
                      </Badge>
                      {log.logger && (
                        <span className="text-xs font-mono text-muted-foreground shrink-0 max-w-[150px] truncate">
                          [{log.logger}]
                        </span>
                      )}
                      <span className="text-sm flex-1 min-w-0 truncate">{log.message}</span>
                    </div>
                    {isExpanded && hasMetadata && (
                      <div className="px-4 pb-3 pl-12">
                        <pre className="text-xs font-mono bg-muted rounded p-3 overflow-x-auto max-h-60">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </Card>
      )}

      {/* Auto-scroll toggle */}
      <div className="flex items-center justify-between mt-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded"
          />
          {t('logs.autoScroll')}
        </label>
        <span className="text-xs text-muted-foreground">
          {t('logs.showingCount', { count: filteredLogs.length, total: logs.length })}
        </span>
      </div>
    </div>
  );
}
