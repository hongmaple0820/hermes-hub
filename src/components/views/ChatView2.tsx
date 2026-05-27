'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Bot, ChevronDown, Wrench, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { ThreadList } from './chat/ThreadList';
import { MessageArea, createMockThreads, createMockMessages, type Message, type ThreadInfo } from './chat/MessageArea';
import { ChatInput } from './chat/ChatInput';
import { AgentSelector, type MockAgent } from './chat/AgentSelector';
import type { Run, RunStatus } from './chat/RunCard';
import type { Step, StepStatus, StepType } from './chat/StepTimeline';

// ---------------------------------------------------------------------------
// ChatView2 — Main Container
// ---------------------------------------------------------------------------
export default function ChatView2() {
  const { t } = useI18n();

  // State
  const [selectedAgent, setSelectedAgent] = useState<MockAgent | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({});
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRunInProgress, setIsRunInProgress] = useState(false);
  const [toolPanelOpen, setToolPanelOpen] = useState(false);
  const [mobileThreadListOpen, setMobileThreadListOpen] = useState(false);

  // Derived
  const currentMessages = activeThreadId ? messagesMap[activeThreadId] || [] : [];
  const currentThread = threads.find((th) => th.id === activeThreadId);
  const agentName = selectedAgent?.name || 'Agent';

  // Mock bound tools
  const boundTools = selectedAgent
    ? [
        { id: 't1', name: 'web_search', description: 'Search the web for information' },
        { id: 't2', name: 'code_interpreter', description: 'Execute code and analyze results' },
        { id: 't3', name: 'file_reader', description: 'Read files from the workspace' },
      ]
    : [];

  // Handlers
  const handleSelectAgent = useCallback(
    (agent: MockAgent) => {
      setSelectedAgent(agent);
      // Create mock threads for this agent
      const mockThreads = createMockThreads(agent.id);
      setThreads(mockThreads);

      // Create mock messages for each thread
      const msgMap: Record<string, Message[]> = {};
      for (const thread of mockThreads) {
        msgMap[thread.id] = createMockMessages(thread.id);
      }
      setMessagesMap(msgMap);

      // Select first thread if available
      if (mockThreads.length > 0) {
        setActiveThreadId(mockThreads[0].id);
      }
    },
    []
  );

  const handleNewThread = useCallback(() => {
    if (!selectedAgent) return;
    const newId = `thread-${Date.now()}`;
    const newThread: ThreadInfo = {
      id: newId,
      title: 'New Conversation',
      lastMessage: t('chat2.noMessages'),
      updatedAt: new Date().toISOString(),
      status: 'active',
      runCount: 0,
      agentId: selectedAgent.id,
    };
    setThreads((prev) => [newThread, ...prev]);
    setMessagesMap((prev) => ({ ...prev, [newId]: [] }));
    setActiveThreadId(newId);
  }, [selectedAgent, t]);

  const handleDeleteThread = useCallback(
    (threadId: string) => {
      setThreads((prev) => prev.filter((th) => th.id !== threadId));
      setMessagesMap((prev) => {
        const next = { ...prev };
        delete next[threadId];
        return next;
      });
      if (activeThreadId === threadId) {
        const remaining = threads.filter((th) => th.id !== threadId);
        setActiveThreadId(remaining.length > 0 ? remaining[0].id : null);
      }
    },
    [activeThreadId, threads]
  );

  const handleSelectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
  }, []);

  const handleSend = useCallback(() => {
    if (!input.trim() || !activeThreadId) return;
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    // Add user message
    setMessagesMap((prev) => ({
      ...prev,
      [activeThreadId]: [...(prev[activeThreadId] || []), userMsg],
    }));

    // Update thread
    setThreads((prev) =>
      prev.map((th) =>
        th.id === activeThreadId
          ? {
              ...th,
              lastMessage: input.trim().slice(0, 60),
              updatedAt: new Date().toISOString(),
            }
          : th
      )
    );

    setInput('');
    setIsTyping(true);
    setIsRunInProgress(true);

    // Simulate agent response with a run
    const runId = `run-${Date.now()}`;
    const msgId = `msg-${Date.now() + 1}`;

    // Create a simulated run with in_progress status
    const simulatedRun: Run = {
      id: runId,
      runNumber:
        (currentMessages.filter((m) => m.run).length || 0) + 1,
      status: 'in_progress',
      steps: [
        {
          id: `${runId}-step-1`,
          type: 'message_creation' as StepType,
          status: 'in_progress' as StepStatus,
          startedAt: new Date().toISOString(),
        },
        {
          id: `${runId}-step-2`,
          type: 'tool_calls' as StepType,
          status: 'queued' as StepStatus,
          toolName: 'web_search',
          toolParams: `{"query": "${input.trim().slice(0, 40)}"}`,
        },
        {
          id: `${runId}-step-3`,
          type: 'tool_execution' as StepType,
          status: 'queued' as StepStatus,
        },
        {
          id: `${runId}-step-4`,
          type: 'message_creation' as StepType,
          status: 'queued' as StepStatus,
        },
      ],
      startedAt: new Date().toISOString(),
    };

    // Add run message immediately
    const agentRunMsg: Message = {
      id: msgId,
      role: 'agent',
      content: '',
      timestamp: new Date().toISOString(),
      run: simulatedRun,
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeThreadId]: [...(prev[activeThreadId] || []), userMsg, agentRunMsg],
    }));

    // Simulate step completion over time
    setTimeout(() => {
      // Step 1 completed, step 2 in progress
      setMessagesMap((prev) => {
        const msgs = prev[activeThreadId] || [];
        return {
          ...prev,
          [activeThreadId]: msgs.map((m) =>
            m.id === msgId && m.run
              ? {
                  ...m,
                  run: {
                    ...m.run,
                    steps: m.run.steps.map((s, i) =>
                      i === 0
                        ? { ...s, status: 'completed' as StepStatus, content: 'Analyzing request...' }
                        : i === 1
                        ? { ...s, status: 'in_progress' as StepStatus }
                        : s
                    ),
                  },
                }
              : m
          ),
        };
      });
    }, 800);

    setTimeout(() => {
      // Step 2 completed, step 3 in progress
      setMessagesMap((prev) => {
        const msgs = prev[activeThreadId] || [];
        return {
          ...prev,
          [activeThreadId]: msgs.map((m) =>
            m.id === msgId && m.run
              ? {
                  ...m,
                  run: {
                    ...m.run,
                    steps: m.run.steps.map((s, i) =>
                      i === 0
                        ? { ...s, status: 'completed' as StepStatus, content: 'Analyzing request...' }
                        : i === 1
                        ? { ...s, status: 'completed' as StepStatus }
                        : i === 2
                        ? {
                            ...s,
                            status: 'completed' as StepStatus,
                            toolResult: 'Found 8 relevant results from the search.',
                          }
                        : i === 3
                        ? { ...s, status: 'in_progress' as StepStatus }
                        : s
                    ),
                  },
                }
              : m
          ),
        };
      });
    }, 2500);

    setTimeout(() => {
      // All steps completed, add final message
      const responseText =
        'Based on my research, here are the key findings:\n\n' +
        '1. **Current trends** show significant growth in this area\n' +
        '2. **Expert analysis** suggests continued momentum\n' +
        '3. **Key developments** include new frameworks and tools\n\n' +
        'Would you like me to dive deeper into any of these points?';

      setMessagesMap((prev) => {
        const msgs = prev[activeThreadId] || [];
        return {
          ...prev,
          [activeThreadId]: msgs.map((m) =>
            m.id === msgId && m.run
              ? {
                  ...m,
                  run: {
                    ...m.run,
                    status: 'completed' as RunStatus,
                    steps: m.run.steps.map((s) => ({
                      ...s,
                      status: 'completed' as StepStatus,
                    })),
                  },
                }
              : m
          ),
        };
      });

      // Add the final response as a separate message
      const finalMsg: Message = {
        id: `msg-${Date.now() + 2}`,
        role: 'agent',
        content: responseText,
        timestamp: new Date().toISOString(),
      };

      setMessagesMap((prev) => ({
        ...prev,
        [activeThreadId]: [...(prev[activeThreadId] || []), finalMsg],
      }));

      // Update thread info
      setThreads((prev) =>
        prev.map((th) =>
          th.id === activeThreadId
            ? {
                ...th,
                lastMessage: responseText.slice(0, 60),
                updatedAt: new Date().toISOString(),
                status: 'completed',
                runCount: th.runCount + 1,
              }
            : th
        )
      );

      setIsTyping(false);
      setIsRunInProgress(false);
    }, 4000);
  }, [input, activeThreadId, currentMessages]);

  const handleSuggestionClick = useCallback(
    (text: string) => {
      setInput(text);
      // Auto-send after a brief delay
      setTimeout(() => {
        const userMsg: Message = {
          id: `msg-${Date.now()}`,
          role: 'user',
          content: text,
          timestamp: new Date().toISOString(),
        };
        if (activeThreadId) {
          setMessagesMap((prev) => ({
            ...prev,
            [activeThreadId]: [...(prev[activeThreadId] || []), userMsg],
          }));
          setThreads((prev) =>
            prev.map((th) =>
              th.id === activeThreadId
                ? { ...th, lastMessage: text.slice(0, 60), updatedAt: new Date().toISOString() }
                : th
            )
          );
        }
      }, 100);
    },
    [activeThreadId]
  );

  const handleBackToAgents = useCallback(() => {
    setSelectedAgent(null);
    setActiveThreadId(null);
    setThreads([]);
    setMessagesMap({});
  }, []);

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
      {/* Chat Header */}
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-card/50 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 md:hidden mr-1"
            onClick={() => setMobileThreadListOpen(true)}
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
          />
        </div>

        {/* Thread list - mobile (Sheet) */}
        <div className="md:hidden">
          <ThreadList
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={(id) => {
              handleSelectThread(id);
              setMobileThreadListOpen(false);
            }}
            onNewThread={handleNewThread}
            onDeleteThread={handleDeleteThread}
            agentName={agentName}
            isMobile
          />
        </div>

        {/* Messages + Input */}
        <div className="flex-1 flex flex-col min-w-0">
          <MessageArea
            messages={currentMessages}
            agentName={agentName}
            isTyping={isTyping}
            threadTitle={currentThread?.title}
            onSuggestionClick={handleSuggestionClick}
            showEmptyState={currentMessages.length === 0}
          />

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
              <div className="flex flex-wrap gap-2">
                {boundTools.map((tool) => (
                  <Badge
                    key={tool.id}
                    variant="outline"
                    className="text-[11px] h-6 px-2 cursor-default hover:bg-accent/50 transition-colors"
                  >
                    <Wrench className="w-3 h-3 mr-1" />
                    {tool.name}
                    <span className="text-muted-foreground ml-1.5">— {tool.description}</span>
                  </Badge>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
