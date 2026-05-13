'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, X, MessageSquare, Bot, Clock, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  conversationName: string;
  agentName?: string;
  messagePreview: string;
  date: string;
  conversationId?: string;
  agentId?: string;
}

export function SessionSearch() {
  const { t } = useI18n();
  const { setCurrentView, setSelectedConversationId } = useAppStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Ctrl+K to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        if (!open) {
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Search when query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api.searchSessions(query);
        setResults(result.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard navigation in results
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, results, selectedIndex]);

  const handleSelect = (result: SearchResult) => {
    if (result.conversationId) {
      setSelectedConversationId(result.conversationId);
      setCurrentView('chat');
    }
    setOpen(false);
    setQuery('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => { setOpen(false); setQuery(''); }}
      />

      {/* Search Dialog */}
      <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg">
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
              placeholder={t('search.placeholder')}
              className="border-0 bg-transparent focus-visible:ring-0 text-base px-0"
            />
            {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          {query.trim() && (
            <ScrollArea className="max-h-[400px]">
              {results.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Search className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">{t('common.noResults')}</p>
                </div>
              ) : (
                <div className="py-2">
                  {results.map((result, index) => (
                    <div
                      key={result.id}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
                        index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
                      )}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        {result.agentName ? (
                          <Bot className="w-4 h-4 text-primary" />
                        ) : (
                          <MessageSquare className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium truncate">{result.conversationName}</span>
                          {result.agentName && (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {result.agentName}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{result.messagePreview}</p>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {new Date(result.date).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}

          {!query.trim() && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">{t('search.hint')}</p>
              <kbd className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted rounded">
                Ctrl + K
              </kbd>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
