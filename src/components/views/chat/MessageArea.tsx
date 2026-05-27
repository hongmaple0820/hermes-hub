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

export interface ThreadInfo {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
  status: ThreadStatus;
  runCount: number;
  agentId: string;
}

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
}: MessageAreaProps) {
  const { t } = useI18n();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

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

      {/* Typing indicator */}
      {isTyping && (
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

// ---------------------------------------------------------------------------
// Mock Data Factory
// ---------------------------------------------------------------------------
export function createMockThreads(agentId: string): ThreadInfo[] {
  return [
    {
      id: 'thread-1',
      title: 'Web Search Demo',
      lastMessage: 'Based on my search, here are the findings...',
      updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      status: 'completed',
      runCount: 2,
      agentId,
    },
    {
      id: 'thread-2',
      title: 'Code Review Request',
      lastMessage: 'I found several issues in your code...',
      updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      status: 'completed',
      runCount: 1,
      agentId,
    },
    {
      id: 'thread-3',
      title: 'Active Research Thread',
      lastMessage: 'Currently searching for relevant data...',
      updatedAt: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
      status: 'in_progress',
      runCount: 1,
      agentId,
    },
  ];
}

export function createMockMessages(threadId: string): Message[] {
  if (threadId === 'thread-1') {
    return [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Search the web for the latest news about AI agents in 2025',
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      },
      {
        id: 'msg-2',
        role: 'agent',
        content: '',
        timestamp: new Date(Date.now() - 1000 * 60 * 4.5).toISOString(),
        run: {
          id: 'run-1',
          runNumber: 1,
          status: 'completed',
          steps: [
            {
              id: 'step-1',
              type: 'message_creation',
              status: 'completed',
              content: 'Analyzing your request...',
              startedAt: new Date(Date.now() - 1000 * 60 * 4.5).toISOString(),
              completedAt: new Date(Date.now() - 1000 * 60 * 4.4).toISOString(),
            },
            {
              id: 'step-2',
              type: 'tool_calls',
              status: 'completed',
              toolName: 'web_search',
              toolParams: '{"query": "AI agents 2025 latest news"}',
              startedAt: new Date(Date.now() - 1000 * 60 * 4.4).toISOString(),
              completedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
            },
            {
              id: 'step-3',
              type: 'tool_execution',
              status: 'completed',
              toolResult: 'Found 15 results about AI agents in 2025, including articles from TechCrunch, Wired, and Arxiv.',
              startedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
              completedAt: new Date(Date.now() - 1000 * 60 * 3.8).toISOString(),
            },
            {
              id: 'step-4',
              type: 'message_creation',
              status: 'completed',
              content: 'Based on my search, here are the findings about AI agents in 2025...',
              startedAt: new Date(Date.now() - 1000 * 60 * 3.8).toISOString(),
              completedAt: new Date(Date.now() - 1000 * 60 * 3.5).toISOString(),
            },
          ],
          startedAt: new Date(Date.now() - 1000 * 60 * 4.5).toISOString(),
          completedAt: new Date(Date.now() - 1000 * 60 * 3.5).toISOString(),
        },
      },
      {
        id: 'msg-3',
        role: 'agent',
        content:
          'Based on my search, here are the key findings about AI agents in 2025:\n\n1. **Multi-Agent Systems** are becoming the standard architecture for complex tasks\n2. **Tool-use capabilities** have dramatically improved with better function calling\n3. **Autonomous agents** like Devin and others are making waves in software engineering\n4. **Agent frameworks** like LangGraph, CrewAI, and AutoGen continue to evolve',
        timestamp: new Date(Date.now() - 1000 * 60 * 3.5).toISOString(),
      },
      {
        id: 'msg-4',
        role: 'user',
        content: 'That\'s great! Can you search for more details about multi-agent frameworks?',
        timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      },
      {
        id: 'msg-5',
        role: 'agent',
        content: '',
        timestamp: new Date(Date.now() - 1000 * 60 * 1.5).toISOString(),
        run: {
          id: 'run-2',
          runNumber: 2,
          status: 'completed',
          steps: [
            {
              id: 'step-5',
              type: 'message_creation',
              status: 'completed',
              startedAt: new Date(Date.now() - 1000 * 60 * 1.5).toISOString(),
            },
            {
              id: 'step-6',
              type: 'tool_calls',
              status: 'completed',
              toolName: 'web_search',
              toolParams: '{"query": "multi-agent frameworks comparison 2025"}',
              startedAt: new Date(Date.now() - 1000 * 60 * 1.4).toISOString(),
            },
            {
              id: 'step-7',
              type: 'tool_execution',
              status: 'completed',
              toolResult: 'Found 23 results. Key frameworks: LangGraph (orchestration), CrewAI (role-based), AutoGen (conversation), Camel (communication).',
              startedAt: new Date(Date.now() - 1000 * 60 * 1.1).toISOString(),
            },
            {
              id: 'step-8',
              type: 'message_creation',
              status: 'completed',
              content: 'Here\'s a detailed comparison of multi-agent frameworks...',
              startedAt: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
            },
          ],
          startedAt: new Date(Date.now() - 1000 * 60 * 1.5).toISOString(),
          completedAt: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
        },
      },
    ];
  }

  if (threadId === 'thread-2') {
    return [
      {
        id: 'msg-6',
        role: 'user',
        content: 'Can you review this function for potential bugs?\n\n```python\ndef process_data(items):\n    result = []\n    for i in range(len(items)):\n        if items[i] > 0:\n            result.append(items[i] * 2)\n    return result\n```',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      },
      {
        id: 'msg-7',
        role: 'agent',
        content: '',
        timestamp: new Date(Date.now() - 1000 * 60 * 29.5).toISOString(),
        run: {
          id: 'run-3',
          runNumber: 1,
          status: 'completed',
          steps: [
            {
              id: 'step-9',
              type: 'message_creation',
              status: 'completed',
              startedAt: new Date(Date.now() - 1000 * 60 * 29.5).toISOString(),
            },
            {
              id: 'step-10',
              type: 'message_creation',
              status: 'completed',
              content: 'I found several issues in your code...',
              startedAt: new Date(Date.now() - 1000 * 60 * 29).toISOString(),
            },
          ],
          startedAt: new Date(Date.now() - 1000 * 60 * 29.5).toISOString(),
          completedAt: new Date(Date.now() - 1000 * 60 * 29).toISOString(),
        },
      },
      {
        id: 'msg-8',
        role: 'agent',
        content:
          'I found several issues in your code:\n\n1. **Type safety**: The function doesn\'t check if `items` is iterable or if elements support comparison/multiplication\n2. **Pythonic iteration**: Using `range(len())` instead of direct iteration\n3. **Missing docstring**: No documentation for the function\n\nHere\'s an improved version:\n\n```python\ndef process_data(items: list[int | float]) -> list[int | float]:\n    """Process items by filtering positives and doubling them."""\n    return [item * 2 for item in items if item > 0]\n```',
        timestamp: new Date(Date.now() - 1000 * 60 * 29).toISOString(),
      },
    ];
  }

  if (threadId === 'thread-3') {
    return [
      {
        id: 'msg-9',
        role: 'user',
        content: 'Research the current state of WebAssembly adoption',
        timestamp: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
      },
      {
        id: 'msg-10',
        role: 'agent',
        content: '',
        timestamp: new Date(Date.now() - 1000 * 60 * 0.5).toISOString(),
        run: {
          id: 'run-4',
          runNumber: 1,
          status: 'in_progress',
          steps: [
            {
              id: 'step-11',
              type: 'message_creation',
              status: 'completed',
              startedAt: new Date(Date.now() - 1000 * 60 * 0.5).toISOString(),
            },
            {
              id: 'step-12',
              type: 'tool_calls',
              status: 'in_progress',
              toolName: 'web_search',
              toolParams: '{"query": "WebAssembly adoption 2025 statistics"}',
              startedAt: new Date(Date.now() - 1000 * 60 * 0.4).toISOString(),
            },
            {
              id: 'step-13',
              type: 'tool_execution',
              status: 'queued',
              toolName: 'code_interpreter',
              toolParams: '{"code": "analyze_wasm_trends()"}',
            },
            {
              id: 'step-14',
              type: 'message_creation',
              status: 'queued',
            },
          ],
          startedAt: new Date(Date.now() - 1000 * 60 * 0.5).toISOString(),
        },
      },
    ];
  }

  return [];
}
