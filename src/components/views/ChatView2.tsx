'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Bot, ChevronDown, Wrench, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api-client';
import { useAppStore } from '@/lib/store';
import { io, Socket } from 'socket.io-client';
import { ThreadList } from './chat/ThreadList';
import { MessageArea, type Message } from './chat/MessageArea';
import { ChatInput } from './chat/ChatInput';
import { AgentSelector, type MockAgent } from './chat/AgentSelector';
import type { Run } from './chat/RunCard';
import type { Step } from './chat/StepTimeline';

// ---------------------------------------------------------------------------
// Types
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
// Data mappers: API response → UI types
// ---------------------------------------------------------------------------

/**
 * Extract thread ID from a conversationId that may be in "thread:{threadId}" format.
 * Used to handle both new format (threadId) and legacy format (conversationId).
 */
function extractThreadId(conversationId?: string): string | undefined {
  if (!conversationId) return undefined;
  if (conversationId.startsWith('thread:')) {
    return conversationId.replace('thread:', '');
  }
  return conversationId;
}

function mapApiThreadToThreadInfo(apiThread: any): ThreadInfo {
  return {
    id: apiThread.id,
    title: apiThread.title || 'Untitled Thread',
    lastMessage: apiThread._count?.messages > 0
      ? `${apiThread._count.messages} message${apiThread._count.messages > 1 ? 's' : ''}`
      : 'No messages yet',
    updatedAt: apiThread.updatedAt,
    status: apiThread.status || 'active',
    runCount: apiThread._count?.runs || 0,
    agentId: apiThread.agentId,
  };
}

function mapApiMessageToMessage(apiMsg: any): Message {
  const role = apiMsg.senderType === 'user' ? 'user' as const
    : apiMsg.senderType === 'agent' ? 'agent' as const
    : 'system' as const;
  return {
    id: apiMsg.id,
    role,
    content: apiMsg.content,
    timestamp: apiMsg.createdAt,
  };
}

function parseStepDetail(detailStr: string): Record<string, any> {
  try {
    return JSON.parse(detailStr || '{}');
  } catch {
    return {};
  }
}

function mapApiStepToStep(apiStep: any): Step {
  const detail = parseStepDetail(apiStep.detail);
  return {
    id: apiStep.id,
    type: apiStep.type as Step['type'],
    status: apiStep.status as Step['status'],
    content: detail.message || detail.content,
    toolName: detail.name || detail.calls?.[0]?.name,
    toolParams: detail.calls?.[0]?.arguments
      ? JSON.stringify(detail.calls[0].arguments)
      : undefined,
    toolResult: detail.result || detail.error,
    startedAt: apiStep.startedAt,
    completedAt: apiStep.completedAt,
  };
}

function mapApiRunToRun(apiRun: any, runNumber: number): Run {
  return {
    id: apiRun.id,
    runNumber,
    status: apiRun.status as Run['status'],
    steps: (apiRun.steps || []).map(mapApiStepToStep),
    startedAt: apiRun.startedAt,
    completedAt: apiRun.completedAt,
  };
}

// ---------------------------------------------------------------------------
// ChatView2 — Main Container (rewritten for real API + WebSocket)
// ---------------------------------------------------------------------------
export default function ChatView2() {
  const { t } = useI18n();
  const { user, agents } = useAppStore();

  // State
  const [selectedAgent, setSelectedAgent] = useState<MockAgent | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({});
  const [runsMap, setRunsMap] = useState<Record<string, Run[]>>({});
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRunInProgress, setIsRunInProgress] = useState(false);
  const [toolPanelOpen, setToolPanelOpen] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boundTools, setBoundTools] = useState<any[]>([]);
  const [streamingContent, setStreamingContent] = useState<Record<string, string>>({});

  // Socket.IO
  const socketRef = useRef<Socket | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  // Derived
  const currentMessages = activeThreadId
    ? messagesMap[activeThreadId] || []
    : [];
  const currentThread = threads.find((th) => th.id === activeThreadId);
  const agentName = selectedAgent?.name || 'Agent';

  // ---------------------------------------------------------------------------
  // Socket.IO Connection Management
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!user?.id) return;

    // Connect to agent-runtime service on port 3003 via Caddy gateway
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      auth: { userId: user.id },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[ChatView2] Socket.IO connected:', socket.id);
    });

    socket.on('connected', (data) => {
      console.log('[ChatView2] Socket confirmed:', data);
    });

    // Run lifecycle events
    socket.on('run:created', (data: { runId: string; threadId: string }) => {
      console.log('[ChatView2] Run created:', data);
      if (data.threadId) {
        refreshThreadRuns(data.threadId);
      }
    });

    socket.on('run:complete', (data: { runId: string; threadId: string; status: string; inputTokens: number; outputTokens: number }) => {
      console.log('[ChatView2] Run complete:', data);
      setIsRunInProgress(false);
      setIsTyping(false);

      if (data.threadId) {
        // Refresh messages from DB (replaces placeholder with real message)
        refreshThreadMessages(data.threadId);
        refreshThreadRuns(data.threadId);
        refreshThreadList();
      }
    });

    socket.on('run:error', (data: { runId: string; threadId: string; error: string }) => {
      console.log('[ChatView2] Run error:', data);
      setIsRunInProgress(false);
      setIsTyping(false);
      setError(data.error);

      if (data.threadId) {
        refreshThreadMessages(data.threadId);
        refreshThreadRuns(data.threadId);
      }

      // Auto-clear error after 5s
      setTimeout(() => setError(null), 5000);
    });

    // Streaming events — handle both threadId and conversationId formats
    // The runtime may emit with conversationId = "thread:{threadId}" format
    socket.on('agent:stream', (data: { conversationId?: string; threadId?: string; agentId: string; chunk: string; timestamp: string }) => {
      const threadId = data.threadId || extractThreadId(data.conversationId) || activeThreadIdRef.current;
      if (!threadId) return;

      setStreamingContent((prev) => ({
        ...prev,
        [threadId]: (prev[threadId] || '') + data.chunk,
      }));
    });

    socket.on('agent:stream-complete', (data: { conversationId?: string; threadId?: string; agentId: string; fullResponse: string; error?: boolean; timestamp: string }) => {
      const threadId = data.threadId || extractThreadId(data.conversationId) || activeThreadIdRef.current;
      if (!threadId) return;

      // Replace any placeholder agent message with the final response
      setMessagesMap((prev) => {
        const msgs = prev[threadId] || [];
        // Find the placeholder message (msg-run-*) and replace its content
        const updated = msgs.map((m) => {
          if (m.role === 'agent' && m.id.startsWith('msg-run-') && !m.content) {
            return { ...m, content: data.fullResponse, run: undefined };
          }
          return m;
        });
        // If no placeholder was found, add a new message
        const hasPlaceholder = msgs.some((m) => m.role === 'agent' && m.id.startsWith('msg-run-') && !m.content);
        if (!hasPlaceholder) {
          const finalMsg: Message = {
            id: `msg-agent-${Date.now()}`,
            role: 'agent',
            content: data.fullResponse,
            timestamp: data.timestamp || new Date().toISOString(),
          };
          return { ...prev, [threadId]: [...updated, finalMsg] };
        }
        return { ...prev, [threadId]: updated };
      });

      // Clear streaming content
      setStreamingContent((prev) => {
        const next = { ...prev };
        delete next[threadId];
        return next;
      });

      setIsTyping(false);
      setIsRunInProgress(false);

      // Refresh thread list for updated lastMessage
      refreshThreadList();
    });

    socket.on('disconnect', (reason) => {
      console.log('[ChatView2] Socket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[ChatView2] Socket connection error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  // ---------------------------------------------------------------------------
  // Data fetching helpers
  // ---------------------------------------------------------------------------
  const refreshThreadList = useCallback(async () => {
    if (!selectedAgent) return;
    try {
      const data = await api.getThreads(selectedAgent.id);
      setThreads((data.threads || []).map(mapApiThreadToThreadInfo));
    } catch (err: any) {
      console.error('[ChatView2] Failed to refresh threads:', err);
    }
  }, [selectedAgent]);

  const refreshThreadMessages = useCallback(async (threadId: string) => {
    try {
      const data = await api.getThreadMessages(threadId);
      const mappedMessages = (data.messages || []).map(mapApiMessageToMessage);
      setMessagesMap((prev) => ({ ...prev, [threadId]: mappedMessages }));
    } catch (err: any) {
      console.error('[ChatView2] Failed to refresh messages:', err);
    }
  }, []);

  const refreshThreadRuns = useCallback(async (threadId: string) => {
    try {
      const data = await api.getThreadRuns(threadId);
      const apiRuns = data.runs || [];
      // Sort by createdAt ascending for run numbering
      const sorted = [...apiRuns].sort((a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const mapped = sorted.map((run: any, index: number) => mapApiRunToRun(run, index + 1));
      setRunsMap((prev) => ({ ...prev, [threadId]: mapped }));
    } catch (err: any) {
      console.error('[ChatView2] Failed to refresh runs:', err);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleSelectAgent = useCallback(
    async (agent: MockAgent) => {
      setSelectedAgent(agent);
      setLoadingThreads(true);
      setError(null);

      try {
        // Fetch real threads for this agent
        const data = await api.getThreads(agent.id);
        const mappedThreads = (data.threads || []).map(mapApiThreadToThreadInfo);
        setThreads(mappedThreads);

        // Fetch agent tools
        try {
          const toolsData = await api.getAgentTools(agent.id);
          setBoundTools(toolsData.agentTools || []);
        } catch {
          setBoundTools([]);
        }

        // Select first thread if available
        if (mappedThreads.length > 0) {
          setActiveThreadId(mappedThreads[0].id);
          // Load messages and runs for the first thread
          setLoadingMessages(true);
          try {
            const msgData = await api.getThreadMessages(mappedThreads[0].id);
            setMessagesMap((prev) => ({
              ...prev,
              [mappedThreads[0].id]: (msgData.messages || []).map(mapApiMessageToMessage),
            }));
          } catch (err) {
            console.error('[ChatView2] Failed to load messages:', err);
          }
          try {
            const runsData = await api.getThreadRuns(mappedThreads[0].id);
            const sorted = [...(runsData.runs || [])].sort((a: any, b: any) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            setRunsMap((prev) => ({
              ...prev,
              [mappedThreads[0].id]: sorted.map((run: any, i: number) => mapApiRunToRun(run, i + 1)),
            }));
          } catch (err) {
            console.error('[ChatView2] Failed to load runs:', err);
          }
          setLoadingMessages(false);

          // Join thread room via Socket.IO
          socketRef.current?.emit('thread:join', { threadId: mappedThreads[0].id });
        }
      } catch (err: any) {
        console.error('[ChatView2] Failed to load threads:', err);
        setError(err.message || 'Failed to load threads');
      } finally {
        setLoadingThreads(false);
      }
    },
    []
  );

  const handleNewThread = useCallback(async () => {
    if (!selectedAgent) return;
    setError(null);

    try {
      const data = await api.createThread({
        agentId: selectedAgent.id,
        title: `New Conversation`,
      });
      const newThread = mapApiThreadToThreadInfo(data.thread);
      setThreads((prev) => [newThread, ...prev]);
      setMessagesMap((prev) => ({ ...prev, [newThread.id]: [] }));
      setRunsMap((prev) => ({ ...prev, [newThread.id]: [] }));
      setActiveThreadId(newThread.id);

      // Join thread room via Socket.IO
      socketRef.current?.emit('thread:join', { threadId: newThread.id });
    } catch (err: any) {
      console.error('[ChatView2] Failed to create thread:', err);
      setError(err.message || 'Failed to create thread');
    }
  }, [selectedAgent]);

  const handleDeleteThread = useCallback(
    async (threadId: string) => {
      setError(null);
      try {
        await api.deleteThread(threadId);

        // Leave thread room
        socketRef.current?.emit('thread:leave', { threadId });

        // Remove from local state
        setThreads((prev) => prev.filter((th) => th.id !== threadId));
        setMessagesMap((prev) => {
          const next = { ...prev };
          delete next[threadId];
          return next;
        });
        setRunsMap((prev) => {
          const next = { ...prev };
          delete next[threadId];
          return next;
        });

        if (activeThreadId === threadId) {
          const remaining = threads.filter((th) => th.id !== threadId);
          if (remaining.length > 0) {
            setActiveThreadId(remaining[0].id);
          } else {
            setActiveThreadId(null);
          }
        }
      } catch (err: any) {
        console.error('[ChatView2] Failed to delete thread:', err);
        setError(err.message || 'Failed to delete thread');
      }
    },
    [activeThreadId, threads]
  );

  const handleSelectThread = useCallback(
    async (threadId: string) => {
      // Leave previous thread room
      if (activeThreadId && activeThreadId !== threadId) {
        socketRef.current?.emit('thread:leave', { threadId: activeThreadId });
      }

      setActiveThreadId(threadId);
      setLoadingMessages(true);
      setError(null);

      // Join new thread room
      socketRef.current?.emit('thread:join', { threadId });

      try {
        // Fetch messages and runs in parallel
        const [msgData, runsData] = await Promise.all([
          api.getThreadMessages(threadId),
          api.getThreadRuns(threadId),
        ]);

        setMessagesMap((prev) => ({
          ...prev,
          [threadId]: (msgData.messages || []).map(mapApiMessageToMessage),
        }));

        const sorted = [...(runsData.runs || [])].sort((a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setRunsMap((prev) => ({
          ...prev,
          [threadId]: sorted.map((run: any, i: number) => mapApiRunToRun(run, i + 1)),
        }));
      } catch (err: any) {
        console.error('[ChatView2] Failed to load thread data:', err);
        setError(err.message || 'Failed to load thread');
      } finally {
        setLoadingMessages(false);
      }
    },
    [activeThreadId]
  );

  const handleSend = useCallback(async () => {
    if (!input.trim() || !activeThreadId || !selectedAgent) return;
    const content = input.trim();

    setError(null);
    setInput('');
    setIsTyping(true);
    setIsRunInProgress(true);

    // Optimistically add user message
    const optimisticUserMsg: Message = {
      id: `msg-pending-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessagesMap((prev) => ({
      ...prev,
      [activeThreadId]: [...(prev[activeThreadId] || []), optimisticUserMsg],
    }));

    try {
      // 1. Save message to DB
      const msgData = await api.sendThreadMessage(activeThreadId, content);
      const savedMsg = mapApiMessageToMessage(msgData.message);

      // Replace optimistic message with real one
      setMessagesMap((prev) => ({
        ...prev,
        [activeThreadId]: (prev[activeThreadId] || []).map((m) =>
          m.id === optimisticUserMsg.id ? savedMsg : m
        ),
      }));

      // 2. Create a Run
      const runData = await api.createRun(activeThreadId);
      const run = runData.run;

      // 3. Add a placeholder agent message with the run
      const runNumber = (runsMap[activeThreadId] || []).length + 1;
      const uiRun = mapApiRunToRun(run, runNumber);
      uiRun.status = 'in_progress';

      const agentRunMsg: Message = {
        id: `msg-run-${run.id}`,
        role: 'agent',
        content: '',
        timestamp: new Date().toISOString(),
        run: uiRun,
      };

      setMessagesMap((prev) => ({
        ...prev,
        [activeThreadId]: [...(prev[activeThreadId] || []), agentRunMsg],
      }));

      // Track this run
      setRunsMap((prev) => ({
        ...prev,
        [activeThreadId]: [...(prev[activeThreadId] || []), uiRun],
      }));

      // 4. Emit thread:message via Socket.IO to trigger execution
      socketRef.current?.emit('thread:message', {
        threadId: activeThreadId,
        content,
        agentId: selectedAgent.id,
      });

      // Update thread's lastMessage
      setThreads((prev) =>
        prev.map((th) =>
          th.id === activeThreadId
            ? {
                ...th,
                lastMessage: content.slice(0, 60),
                updatedAt: new Date().toISOString(),
              }
            : th
        )
      );
    } catch (err: any) {
      console.error('[ChatView2] Failed to send message:', err);
      setError(err.message || 'Failed to send message');
      setIsTyping(false);
      setIsRunInProgress(false);
    }
  }, [input, activeThreadId, selectedAgent, runsMap]);

  const handleSuggestionClick = useCallback(
    (text: string) => {
      setInput(text);
    },
    []
  );

  const handleBackToAgents = useCallback(() => {
    // Leave current thread room
    if (activeThreadId) {
      socketRef.current?.emit('thread:leave', { threadId: activeThreadId });
    }
    setSelectedAgent(null);
    setActiveThreadId(null);
    setThreads([]);
    setMessagesMap({});
    setRunsMap({});
    setBoundTools([]);
    setError(null);
  }, [activeThreadId]);

  // ---------------------------------------------------------------------------
  // Render: No agent selected → show AgentSelector
  // ---------------------------------------------------------------------------
  if (!selectedAgent) {
    return (
      <div className="h-full flex flex-col">
        <AgentSelector onSelectAgent={handleSelectAgent} />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Agent selected → show Chat UI
  // ---------------------------------------------------------------------------
  return (
    <div className="h-full flex flex-col">
      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2">
              <span className="text-xs text-destructive">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-5 text-xs text-destructive hover:text-destructive"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Header */}
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-card/50 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 md:hidden mr-1"
            onClick={() => {
              // On mobile, show thread list sheet
            }}
          >
            <Bot className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 mr-1"
            onClick={handleBackToAgents}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Avatar className="w-8 h-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              <Bot className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{agentName}</p>
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  selectedAgent.status === 'online' && 'bg-emerald-500 animate-pulse',
                  selectedAgent.status === 'busy' && 'bg-amber-500',
                  selectedAgent.status === 'offline' && 'bg-muted-foreground/40'
                )}
              />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-muted-foreground">
                {currentThread?.title || t('chat2.title')}
              </span>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                {selectedAgent.mode === 'acrp' ? 'ACRP' : 'Builtin'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Tool panel toggle */}
          <Collapsible open={toolPanelOpen} onOpenChange={setToolPanelOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-7">
                <Wrench className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('chat2.boundTools')}</span>
                {boundTools.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">
                    {boundTools.length}
                  </Badge>
                )}
                <ChevronDown
                  className={cn(
                    'w-3 h-3 transition-transform',
                    toolPanelOpen && 'rotate-180'
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Thread list - desktop */}
        <div className="hidden md:block">
          <ThreadList
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={handleSelectThread}
            onNewThread={handleNewThread}
            onDeleteThread={handleDeleteThread}
            agentName={agentName}
            loading={loadingThreads}
          />
        </div>

        {/* Thread list - mobile (Sheet) */}
        <div className="md:hidden">
          <ThreadList
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={handleSelectThread}
            onNewThread={handleNewThread}
            onDeleteThread={handleDeleteThread}
            agentName={agentName}
            isMobile
            loading={loadingThreads}
          />
        </div>

        {/* Messages + Input */}
        <div className="flex-1 flex flex-col min-w-0">
          {loadingMessages ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span className="text-sm text-muted-foreground">Loading messages...</span>
              </div>
            </div>
          ) : (
            <MessageArea
              messages={currentMessages}
              agentName={agentName}
              isTyping={isTyping}
              threadTitle={currentThread?.title}
              onSuggestionClick={handleSuggestionClick}
              showEmptyState={currentMessages.length === 0}
              streamingContent={activeThreadId ? streamingContent[activeThreadId] : undefined}
            />
          )}

          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            isRunInProgress={isRunInProgress}
          />
        </div>
      </div>

      {/* Tool Panel (collapsible) */}
      <AnimatePresence>
        {toolPanelOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="px-4 py-3 bg-card/30">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium">{t('chat2.boundTools')}</span>
                <span className="text-[10px] text-muted-foreground">{t('chat2.toolPanelDesc')}</span>
              </div>
              {boundTools.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {boundTools.map((at: any) => (
                    <Badge
                      key={at.id}
                      variant="outline"
                      className="text-[11px] h-6 px-2 cursor-default hover:bg-accent/50 transition-colors"
                    >
                      <Wrench className="w-3 h-3 mr-1" />
                      {at.tool?.displayName || at.tool?.name || 'Tool'}
                      {at.isEnabled === false && (
                        <span className="text-muted-foreground ml-1">(disabled)</span>
                      )}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No tools bound to this agent</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
