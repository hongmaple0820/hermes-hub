'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Bot, Sparkles, Code, Globe, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { RunCard, type Run } from './RunCard';
import type { Step } from './StepTimeline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ThreadStatus = 'active' | 'completed' | 'in_progress' | 'failed' | 'queued';

export type MessageRole = 'user' | 'agent' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  run?: Run;
  tokenCount?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface MessageAreaProps {
  messages: Message[];
  agentName: string;
  isTyping: boolean;
  threadTitle?: string;
  onSuggestionClick?: (text: string) => void;
  showEmptyState?: boolean;
  streamingContent?: string;
  runs?: Run[];
}

const quickSuggestions = [
  { icon: <Sparkles className="w-3.5 h-3.5" />, text: 'What can you help me with?' },
  { icon: <Code className="w-3.5 h-3.5" />, text: 'Write a function to sort an array' },
  { icon: <Globe className="w-3.5 h-3.5" />, text: 'Search for the latest React news' },
  { icon: <Zap className="w-3.5 h-3.5" />, text: 'Help me debug this error' },
];

function formatFullTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Compute a rough token count from text content
function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Rough estimate: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

export function MessageArea({
  messages,
  agentName,
  isTyping,
  threadTitle,
  onSuggestionClick,
  showEmptyState,
  streamingContent,
  runs,
}: MessageAreaProps) {
  const { t } = useI18n();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, streamingContent]);

  // Build a map of runId -> runNumber for "Run #N" labels
  const runNumberMap = new Map<string, number>();
  (runs || []).forEach((run) => {
    runNumberMap.set(run.id, run.runNumber);
  });

  // Empty state
  if (showEmptyState || messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Bot className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-1">{threadTitle || agentName}</h3>
        <p className="text-sm text-muted-foreground mb-6">{t('chat2.quickStartDesc')}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
          {quickSuggestions.map((suggestion, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.2 }}
              onClick={() => onSuggestionClick?.(suggestion.text)}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-border hover:bg-accent/50 hover:border-primary/30 hover:shadow-sm transition-all duration-200 text-left"
            >
              <span className="text-muted-foreground shrink-0">{suggestion.icon}</span>
              <span className="text-xs text-muted-foreground">{suggestion.text}</span>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-background via-background to-muted/20">
        <AnimatePresence>
          {messages.map((msg, index) => {
            // System messages: centered, muted, small text
            if (msg.role === 'system') {
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center"
                >
                  <div className="bg-muted/60 rounded-lg px-4 py-1.5 max-w-[80%]">
                    <p className="text-xs text-muted-foreground italic">{msg.content}</p>
                  </div>
                </motion.div>
              );
            }

            const isUser = msg.role === 'user';
            const isAgentStreaming = msg.role === 'agent' && msg.id.startsWith('msg-run-') && !msg.content && streamingContent;
            const isCancelled = msg.role === 'agent' && msg.content === '[Cancelled]';
            const isPlaceholder = msg.role === 'agent' && msg.id.startsWith('msg-run-') && !msg.content && !streamingContent;

            // Extract run ID from message ID for "Run #N" label
            const runIdFromMsg = msg.id.startsWith('msg-run-') ? msg.id.replace('msg-run-', '') : null;
            const runNumber = runIdFromMsg ? runNumberMap.get(runIdFromMsg) : null;

            return (
              <div key={msg.id}>
                {/* Run #N label above run blocks */}
                {runNumber && (
                  <div className={cn('flex items-center gap-1.5 mb-1', isUser ? 'justify-end' : 'justify-start')}>
                    <span className="text-[10px] text-muted-foreground/60 font-medium">
                      {t('chat2.run')} #{runNumber}
                    </span>
                  </div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02, duration: 0.2 }}
                  className={cn('flex gap-3', isUser ? 'flex-row-reverse' : '')}
                >
                  <Avatar className="w-7 h-7 shrink-0">
                    <AvatarFallback
                      className={cn(
                        'text-[10px]',
                        isUser
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-primary/10 text-primary'
                      )}
                    >
                      {isUser ? 'You' : <Bot className="w-3.5 h-3.5" />}
                    </AvatarFallback>
                  </Avatar>

                  <div className={cn('max-w-[75%] space-y-1', isUser ? 'items-end' : 'items-start')}>
                    {/* Message bubble */}
                    {msg.content && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'rounded-2xl px-4 py-2.5',
                              isUser
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : isCancelled
                                  ? 'bg-muted/50 border border-border/50 rounded-bl-md italic'
                                  : 'bg-card dark:bg-card/80 border border-border dark:border-border/80 rounded-bl-md'
                            )}
                          >
                            <p className={cn(
                              'text-sm whitespace-pre-wrap',
                              isCancelled && 'text-muted-foreground'
                            )}>
                              {msg.content}
                            </p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px]">
                          {formatFullTimestamp(msg.timestamp)}
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Placeholder agent message while waiting for stream — show "thinking..." */}
                    {isPlaceholder && (
                      <div className="bg-card dark:bg-card/80 border border-border dark:border-border/80 rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">
                            {t('chat2.thinkingLabel')}
                          </p>
                          <div className="flex gap-1 items-center h-4">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Run visualization */}
                    {msg.run && <RunCard run={msg.run} />}

                    {/* Token count below agent messages */}
                    {msg.role === 'agent' && msg.content && msg.content !== '[Cancelled]' && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground/50">
                          ~{estimateTokenCount(msg.content)} {t('chat2.tokens')}
                        </span>
                      </div>
                    )}

                    {/* Timestamp (visible on mobile, tooltip on desktop) */}
                    <div className={cn('flex items-center gap-1', isUser ? 'justify-end' : 'justify-start')}>
                      <span className="text-[10px] text-muted-foreground dark:text-muted-foreground/80">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </AnimatePresence>

        {/* Streaming content — show as a live agent message bubble */}
        {streamingContent && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] text-muted-foreground/60 font-medium">
                {t('chat2.streamingLabel')}
              </span>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <Avatar className="w-7 h-7 shrink-0">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  <Bot className="w-3.5 h-3.5" />
                </AvatarFallback>
              </Avatar>
              <div className="max-w-[75%] space-y-1 items-start">
                <div className="bg-card dark:bg-card/80 border border-border dark:border-border/80 rounded-2xl rounded-bl-md px-4 py-2.5 relative overflow-hidden">
                  {/* Shimmer effect on streaming message */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-shimmer" />
                  <p className="text-sm whitespace-pre-wrap relative z-10">{streamingContent}</p>
                  <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom relative z-10" />
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Typing indicator — animated dots */}
        {isTyping && !streamingContent && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                <Bot className="w-3.5 h-3.5" />
              </AvatarFallback>
            </Avatar>
            <div className="bg-card dark:bg-card/80 border border-border dark:border-border/80 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  {agentName} {t('chat2.agentTyping')}
                </p>
                <div className="flex gap-1 items-center h-4">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>
    </TooltipProvider>
  );
}
