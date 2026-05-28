'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Plus, Search, Trash2, X, MessageSquare, Menu, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

// ---------------------------------------------------------------------------
// Types — imported from ChatView2 instead of MessageArea to break circular dep
// ---------------------------------------------------------------------------
export interface ThreadInfo {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
  status: string;
  runCount: number;
  agentId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface ThreadListProps {
  threads: ThreadInfo[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onDeleteThread: (id: string) => void;
  agentName?: string;
  isMobile?: boolean;
  loading?: boolean;
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatCreationTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ThreadList({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  agentName,
  isMobile,
  loading,
}: ThreadListProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filtered = threads.filter((thread) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      thread.title.toLowerCase().includes(q) ||
      thread.lastMessage.toLowerCase().includes(q)
    );
  });

  const threadListContent = (
    <>
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm">{agentName || t('chat2.title')}</h2>
          <Button size="icon" className="w-7 h-7" variant="outline" onClick={onNewThread} disabled={loading}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder={t('chat2.searchThreads')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-7 h-8 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Thread List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && (
            <AnimatePresence>
              {filtered.map((thread, index) => (
                <motion.div
                  key={thread.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ delay: index * 0.03, duration: 0.15 }}
                  className="relative group"
                >
                  <button
                    onClick={() => onSelectThread(thread.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200',
                      activeThreadId === thread.id
                        ? 'bg-accent shadow-sm'
                        : 'hover:bg-accent/50 hover:shadow-sm hover:scale-[1.01]'
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium truncate">{thread.title}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {formatTimestamp(thread.updatedAt)}
                        </span>
                      </div>
                      {/* Last message preview */}
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {thread.lastMessage}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[9px] h-3.5 px-1',
                            thread.status === 'completed' && 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
                            thread.status === 'in_progress' && 'border-amber-500/30 text-amber-600 dark:text-amber-400',
                            thread.status === 'failed' && 'border-red-500/30 text-red-600 dark:text-red-400',
                            thread.status === 'active' && 'border-primary/30 text-primary',
                            thread.status === 'queued' && 'border-border text-muted-foreground'
                          )}
                        >
                          {thread.status}
                        </Badge>
                        {thread.runCount > 0 && (
                          <span className="text-[9px] text-muted-foreground">
                            {thread.runCount} run{thread.runCount > 1 ? 's' : ''}
                          </span>
                        )}
                        {/* Creation time */}
                        <span className="text-[9px] text-muted-foreground/60 ml-auto">
                          {formatCreationTime(thread.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </button>
                  {/* Delete button on hover */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(thread.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {!loading && filtered.length === 0 && search.trim() && (
            <div className="py-8 text-center">
              <Search className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{t('chat2.noThreads')}</p>
            </div>
          )}

          {!loading && threads.length === 0 && !search.trim() && (
            <div className="py-6 text-center">
              <MessageSquare className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">{t('chat2.noThreads')}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{t('chat2.noThreadsDesc')}</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('chat2.deleteThread')}</DialogTitle>
            <DialogDescription>{t('chat2.deleteThreadConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">{t('common.cancel')}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (deleteConfirmId) {
                  onDeleteThread(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  // Mobile: use Sheet
  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden w-8 h-8">
            <Menu className="w-4 h-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{t('chat2.title')}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-full">
            {threadListContent}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: inline sidebar
  return (
    <div className="w-72 border-r border-border flex flex-col shrink-0 bg-card/30">
      {threadListContent}
    </div>
  );
}
