'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
}

const quickSuggestions = [
  { icon: <Sparkles className="w-3.5 h-3.5" />, text: 'What can you help me with?' },
  { icon: <Code className="w-3.5 h-3.5" />, text: 'Write a function to sort an array' },
  { icon: <Globe className="w-3.5 h-3.5" />, text: 'Search for the latest React news' },
  { icon: <Zap className="w-3.5 h-3.5" />, text: 'Help me debug this error' },
];

export function MessageArea({
  messages,
  agentName,
  isTyping,
  threadTitle,
  onSuggestionClick,
  showEmptyState,
  streamingContent,
}: MessageAreaProps) {
  const { t } = useI18n();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, streamingContent]);

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
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <AnimatePresence>
        {messages.map((msg, index) => {
          if (msg.role === 'system') {
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-center"
              >
                <div className="bg-muted rounded-lg px-4 py-1.5 max-w-[80%]">
                  <p className="text-xs text-muted-foreground italic">{msg.content}</p>
                </div>
              </motion.div>
            );
          }

          const isUser = msg.role === 'user';

          return (
            <motion.div
              key={msg.id}
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
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-2.5',
                      isUser
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-card dark:bg-card/80 border border-border dark:border-border/80 rounded-bl-md'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                )}

                {/* Run visualization */}
                {msg.run && <RunCard run={msg.run} />}

                {/* Timestamp */}
                <div className={cn('flex items-center gap-1', isUser ? 'justify-end' : 'justify-start')}>
                  <span className="text-[10px] text-muted-foreground dark:text-muted-foreground/80">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Streaming content — show as a live agent message bubble */}
      {streamingContent && (
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
            <div className="bg-card dark:bg-card/80 border border-border dark:border-border/80 rounded-2xl rounded-bl-md px-4 py-2.5">
              <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
              <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Typing indicator */}
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
  );
}
