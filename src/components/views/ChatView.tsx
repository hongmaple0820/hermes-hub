'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Bot, Send, Plus, Loader2, ArrowLeft, MessageSquare, Users, GitBranch, ArrowRight,
  Paperclip, Smile, Check, CheckCheck, Clock, Copy, Trash2, Search, ChevronDown,
  Sparkles, Zap, BookOpen, Code, Globe, Radio, X, Download, Upload, Square
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { ContextIndicator } from '@/components/shared/ContextIndicator';
import { EmptyState } from '@/components/shared/EmptyState';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_INPUT_LENGTH = 4000;
const CHAR_COUNT_THRESHOLD = 3500;

// ---------------------------------------------------------------------------
// Sub-component: Typing Indicator
// ---------------------------------------------------------------------------
function TypingIndicator({ agentName }: { agentName: string }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarFallback className="text-xs bg-primary/10 text-primary">
          <Bot className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>
      <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {agentName} {t('chat.thinking')}
          </p>
          <div className="flex gap-1 items-center h-4">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Message Bubble
// ---------------------------------------------------------------------------
function MessageBubble({
  msg,
  onCopy,
  onDelete,
}: {
  msg: any;
  onCopy: (content: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);
  const isUser = msg.senderType === 'user';
  const isSystem = msg.senderType === 'system';

  // Message status (visual only)
  const getStatus = () => {
    if (!isUser) return null;
    // Simulate status: older messages are "read", latest is "delivered"
    const age = Date.now() - new Date(msg.createdAt).getTime();
    if (age > 10000) return 'read';
    if (age > 3000) return 'delivered';
    return 'sent';
  };
  const status = getStatus();

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Relative time formatting
  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (seconds < 60) return t('chat.justNow');
    if (minutes < 60) return t('chat.minutesAgo', { count: minutes });
    if (hours < 24) return t('chat.hoursAgo', { count: hours });
    if (days < 7) return t('chat.daysAgo', { count: days });
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (isSystem) {
    return (
      <div className="flex justify-center animate-in fade-in duration-200">
        <div className="bg-muted rounded-lg px-4 py-1.5 max-w-[80%]">
          <p className="text-xs text-muted-foreground italic">{msg.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex gap-3 group animate-in fade-in slide-in-from-bottom-2 duration-300',
        isUser ? 'flex-row-reverse' : ''
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarFallback
          className={cn(
            'text-xs',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-primary/10 text-primary'
          )}
        >
          {isUser ? (
            <span className="text-[11px] font-medium">You</span>
          ) : (
            <Bot className="w-4 h-4" />
          )}
        </AvatarFallback>
      </Avatar>
      <div className={cn('max-w-[70%] relative', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-card border border-border rounded-bl-md'
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <MarkdownRenderer content={msg.content} />
          )}
        </div>

        {/* Timestamp & Status - shown on hover */}
        <div
          className={cn(
            'flex items-center gap-1.5 mt-1 transition-opacity duration-150',
            hovered ? 'opacity-100' : 'opacity-0',
            isUser ? 'justify-end' : 'justify-start'
          )}
        >
          <span className="text-[10px] text-muted-foreground">
            {formatTime(msg.createdAt)}
          </span>
          <span className="text-[10px] text-muted-foreground/60">·</span>
          <span className="text-[10px] text-muted-foreground/70">
            {formatRelativeTime(msg.createdAt)}
          </span>
          {isUser && status && (
            <>
              <span className="text-[10px] text-muted-foreground/60">·</span>
              <span className="text-muted-foreground">
                {status === 'sent' && <Clock className="w-3 h-3" />}
                {status === 'delivered' && <Check className="w-3 h-3" />}
                {status === 'read' && <CheckCheck className="w-3 h-3 text-primary" />}
              </span>
            </>
          )}
        </div>

        {/* Hover actions */}
        {hovered && (
          <div
            className={cn(
              'absolute -top-2 flex items-center gap-0.5 bg-popover border border-border rounded-lg shadow-sm p-0.5 z-10',
              isUser ? 'left-0' : 'right-0'
            )}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6"
                    onClick={() => onCopy(msg.content)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {t('chat.copyMessage')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 text-destructive hover:text-destructive"
                    onClick={() => onDelete(msg.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {t('chat.deleteMessage')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Auto-expanding Textarea
// ---------------------------------------------------------------------------
function AutoExpandingTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
  maxLength = MAX_INPUT_LENGTH,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  disabled?: boolean;
  maxLength?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      const maxHeight = 4 * 24; // ~4 lines
      ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px';
    }
  }, [value]);

  const nearLimit = value.length > CHAR_COUNT_THRESHOLD;

  return (
    <div className="flex-1 relative">
      <Textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        disabled={disabled}
        maxLength={maxLength}
        rows={1}
        className="resize-none min-h-[40px] max-h-[96px] pr-2 py-2.5 text-sm"
      />
      {nearLimit && (
        <span className={cn(
          'absolute bottom-1 right-2 text-[10px]',
          value.length >= maxLength ? 'text-destructive' : 'text-muted-foreground'
        )}>
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Empty State
// ---------------------------------------------------------------------------
function EmptyChatState({ onStartChat }: { onStartChat: () => void }) {
  const { agents, conversations } = useAppStore();
  const { t } = useI18n();

  const defaultAgent = agents.find((a: any) => a.name === 'Hermes Assistant') || agents[0];
  const hasNoConversations = conversations.length === 0;

  const quickSuggestions = [
    { icon: <Sparkles className="w-4 h-4" />, text: t('chat.suggestionWhatCanYouDo') },
    { icon: <Globe className="w-4 h-4" />, text: t('chat.suggestionSearch') },
    { icon: <Code className="w-4 h-4" />, text: t('chat.suggestionTranslate') },
  ];

  const suggestions = [
    { icon: <Sparkles className="w-4 h-4" />, text: t('chat.firstMessage1'), gradient: 'from-emerald-500/10 to-emerald-500/5' },
    { icon: <Code className="w-4 h-4" />, text: t('chat.firstMessage2'), gradient: 'from-violet-500/10 to-violet-500/5' },
    { icon: <Globe className="w-4 h-4" />, text: t('chat.firstMessage3'), gradient: 'from-cyan-500/10 to-cyan-500/5' },
  ];

  const capabilities = [
    { icon: <Zap className="w-4 h-4" />, label: t('chat.emptyCapSkills') },
    { icon: <Radio className="w-4 h-4" />, label: t('chat.emptyCapACRP') },
    { icon: <Bot className="w-4 h-4" />, label: t('chat.emptyCapMulti') },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      {/* Hero Section with animated icon */}
      <motion.div
        className="relative mb-6"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 flex items-center justify-center shadow-lg shadow-primary/10 relative">
          <MessageSquare className="w-12 h-12 text-primary" />
          <Sparkles className="w-5 h-5 text-amber-500 absolute -top-1 -right-1" />
        </div>
        {/* Decorative floating dots */}
        <motion.div
          className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-emerald-500"
          animate={{ y: [-2, 2, -2] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-2 -left-2 w-2.5 h-2.5 rounded-full bg-cyan-500"
          animate={{ y: [2, -2, 2] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        <h2 className="text-xl font-bold mb-2">{t('chat.emptyTitle')}</h2>
        <p className="text-sm text-muted-foreground max-w-md">{t('chat.emptyDescription')}</p>
      </motion.div>

      {/* Default Agent Prominent Card - shown when no conversations exist */}
      {hasNoConversations && defaultAgent && (
        <motion.div
          className="w-full max-w-sm mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18 }}
        >
          <Card
            className="cursor-pointer border-2 border-primary/20 hover:border-primary/40 hover:shadow-lg transition-all duration-200 active:scale-[0.98] overflow-hidden"
            onClick={onStartChat}
          >
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-primary to-cyan-500" />
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-7 h-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base truncate">{defaultAgent.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {defaultAgent.description || t('chat.defaultAgentReady')}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-emerald-600">{t('common.online')}</span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">{t('chat.agentCapabilities')}</span>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Big Start Chat Button - shown when no conversations exist */}
      {hasNoConversations && (
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22 }}
        >
          <Button onClick={onStartChat} size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow h-12 px-6 text-base">
            <MessageSquare className="w-5 h-5" />
            {t('chat.startNewChat')}
          </Button>
        </motion.div>
      )}

      {/* Quick suggestion chips */}
      {hasNoConversations && (
        <motion.div
          className="flex flex-wrap items-center justify-center gap-2 mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          {quickSuggestions.map((s, i) => (
            <button
              key={i}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background hover:bg-accent hover:border-primary/30 transition-all duration-200 text-sm text-muted-foreground hover:text-foreground"
              onClick={onStartChat}
            >
              <span className="text-primary">{s.icon}</span>
              {s.text}
            </button>
          ))}
        </motion.div>
      )}

      {/* Capabilities showcase */}
      {!hasNoConversations && (
        <motion.div
          className="flex items-center gap-4 mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {capabilities.map((cap, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30">
              <span className="text-primary">{cap.icon}</span>
              <span className="text-xs text-muted-foreground">{cap.label}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Regular Start Chat Button (when has conversations) */}
      {!hasNoConversations && (
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <Button onClick={onStartChat} className="gap-2 shadow-md hover:shadow-lg transition-shadow">
            <Plus className="w-4 h-4" />
            {t('chat.startNewChat')}
          </Button>
        </motion.div>
      )}

      {/* Agent Cards */}
      {agents.length > 0 && !hasNoConversations && (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {agents.slice(0, 4).map((agent: any) => (
            <Card
              key={agent.id}
              className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
              onClick={onStartChat}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{agent.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      agent.status === 'online' ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                    )} />
                    <span className="text-[10px] text-muted-foreground">
                      {agent.status === 'online' ? t('common.online') : t('common.offline')}
                    </span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      {agent.mode === 'acrp' ? 'ACRP' : 'Builtin'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* First message suggestions */}
      <motion.div
        className="space-y-2 w-full max-w-md"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
      >
        <p className="text-xs text-muted-foreground text-center mb-3">{t('chat.quickStartSuggestions')}</p>
        {suggestions.map((s, i) => (
          <button
            key={i}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-xl border border-border transition-all duration-200 text-left',
              'hover:shadow-sm hover:-translate-y-0.5 active:scale-[0.98]',
              'bg-gradient-to-r', s.gradient
            )}
            onClick={onStartChat}
          >
            <span className="text-muted-foreground">{s.icon}</span>
            <span className="text-sm text-muted-foreground">{s.text}</span>
          </button>
        ))}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Agent Selector Header
// ---------------------------------------------------------------------------
function AgentSelectorHeader({
  agent,
  agents,
  onSwitchAgent,
}: {
  agent: any;
  agents: any[];
  onSwitchAgent: (agentId: string) => void;
}) {
  const { t } = useI18n();
  const isOnline = agent?.status === 'online';
  const mode = agent?.mode || 'builtin';

  return (
    <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-card/50">
      <div className="flex items-center gap-3">
        <Avatar className="w-9 h-9">
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            <Bot className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{agent?.name || 'Agent'}</p>
            <span className={cn(
              'w-2 h-2 rounded-full',
              isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'
            )} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground">
              {isOnline ? t('common.online') : t('common.offline')}
            </span>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
              {mode === 'acrp' ? 'ACRP' : 'Builtin'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {agents.length > 1 && (
          <Select value={agent?.id} onValueChange={onSwitchAgent}>
            <SelectTrigger size="sm" className="w-[160px] h-7 text-xs">
              <SelectValue placeholder="Switch agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      a.status === 'online' ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                    )} />
                    <span>{a.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Conversations Tab (1-on-1 chats)
// ---------------------------------------------------------------------------

function ConversationsPanel() {
  const { agents, conversations, setConversations, selectedConversationId, setSelectedConversationId } = useAppStore();
  const { t } = useI18n();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [lineage, setLineage] = useState<{ ancestors: any[]; totalMessages: number } | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const selectedConv = conversations.find((c: any) => c.id === selectedConversationId);

  // Filter conversations by search
  const filteredConversations = conversations.filter((conv: any) => {
    if (!sidebarSearch.trim()) return true;
    const q = sidebarSearch.toLowerCase();
    return (
      (conv.agent?.name || '').toLowerCase().includes(q) ||
      (conv.lastMessage?.content || '').toLowerCase().includes(q) ||
      (conv.name || '').toLowerCase().includes(q)
    );
  });

  const loadMessages = useCallback(async () => {
    if (!selectedConversationId) return;
    setLoadingMessages(true);
    try {
      const result = await api.getMessages(selectedConversationId);
      setMessages(result.messages || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedConversationId]);

  // Load lineage info
  const loadLineage = useCallback(async () => {
    if (!selectedConversationId) return;
    try {
      const result = await api.getConversationLineage(selectedConversationId);
      setLineage(result as any);
    } catch {
      // Lineage not available yet or no data
    }
  }, [selectedConversationId]);

  useEffect(() => {
    if (selectedConversationId) {
      loadMessages();
      loadLineage();
    } else {
      setMessages([]);
      setLineage(null);
    }
  }, [selectedConversationId, loadMessages, loadLineage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending, streamingContent]);

  const handleStartChat = async (agentId: string) => {
    try {
      const result = await api.createConversation({ agentId });
      const convs = await api.getConversations();
      setConversations(convs.conversations || []);
      setSelectedConversationId(result.conversation.id);
      setShowNewChat(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteConversation = async (convId: string) => {
    try {
      await fetch(`/api/conversations/${convId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
      const convs = await api.getConversations();
      setConversations(convs.conversations || []);
      if (selectedConversationId === convId) {
        setSelectedConversationId(null);
      }
      toast.success(t('common.deleted'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedConversationId) return;
    const userMsg = input.trim();
    setInput('');
    setSending(true);
    setStreaming(false);
    setStreamingContent('');

    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      content: userMsg,
      type: 'text',
      senderType: 'user',
      senderName: 'You',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      // Try SSE streaming first
      const abortController = new AbortController();
      abortRef.current = abortController;

      const response = await fetch(`/api/conversations/${selectedConversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'x-user-id': api.getUserId() || '',
        },
        body: JSON.stringify({ content: userMsg }),
        signal: abortController.signal,
      });

      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        // SSE streaming response
        setSending(false);
        setStreaming(true);
        setStreamingContent('');

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(trimmed.slice(6));

              if (data.type === 'chunk' && data.content) {
                accumulated += data.content;
                setStreamingContent(accumulated);
              } else if (data.type === 'done') {
                // Stream complete - replace streaming content with final message
                setStreaming(false);
                setStreamingContent('');
                const agentMsg = {
                  id: data.messageId || `agent-${Date.now()}`,
                  content: accumulated,
                  type: 'text',
                  senderType: 'agent',
                  senderName: selectedConv?.agent?.name || 'Agent',
                  createdAt: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, agentMsg]);
                // Refresh conversations list for sidebar preview
                api.getConversations().then(result => setConversations(result.conversations || [])).catch(() => {});
              } else if (data.type === 'error') {
                setStreaming(false);
                setStreamingContent('');
                toast.error(data.error || t('chat.streamingError'));
                // Still show whatever was accumulated
                if (accumulated) {
                  const agentMsg = {
                    id: `agent-${Date.now()}`,
                    content: accumulated,
                    type: 'text',
                    senderType: 'agent',
                    senderName: selectedConv?.agent?.name || 'Agent',
                    createdAt: new Date().toISOString(),
                  };
                  setMessages((prev) => [...prev, agentMsg]);
                }
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

        abortRef.current = null;
      } else {
        // Non-SSE response (fallback to JSON)
        const result = await response.json();
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
          return [...filtered, result.message];
        });

        if (result.agentReply) {
          const agentMsg = {
            id: `agent-${Date.now()}`,
            content: result.agentReply.content,
            type: 'text',
            senderType: 'agent',
            senderName: selectedConv?.agent?.name || 'Agent',
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, agentMsg]);
          // Refresh conversations list for sidebar preview
          api.getConversations().then(result => setConversations(result.conversations || [])).catch(() => {});
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // User cancelled the stream
        setStreaming(false);
        setStreamingContent('');
      } else {
        toast.error(error.message);
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      }
    } finally {
      setSending(false);
      setStreaming(false);
      setStreamingContent('');
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast.success(t('chat.copied'));
    });
  }, [t]);

  const handleDeleteMessage = useCallback((msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    toast.success(t('common.deleted'));
  }, []);

  const handleSwitchAgent = async (agentId: string) => {
    await handleStartChat(agentId);
  };

  return (
    <div className="flex h-full">
      {/* Conversation Sidebar */}
      <div className="w-72 border-r border-border flex flex-col shrink-0 hidden md:flex">
        {/* Sidebar Header */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm">{t('chat.conversations')}</h2>
            <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
              <DialogTrigger asChild>
                <Button size="icon" className="w-7 h-7" variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('chat.startNewChatTitle')}</DialogTitle>
                  <DialogDescription className="sr-only">{t('chat.startNewChatTitle')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 mt-4">
                  {agents.length === 0 ? (
                    <div className="text-center py-6 space-y-3">
                      <Bot className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                      <p className="text-sm text-muted-foreground">{t('chat.noAgents')}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={async () => {
                          try {
                            await api.quickstartSetup();
                            setShowNewChat(false);
                            // Reload data so agents appear
                            const agentsResult = await api.getAgents();
                            const { setAgents } = useAppStore.getState();
                            setAgents(agentsResult.agents || []);
                          } catch (error: any) {
                            toast.error(error.message);
                          }
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {t('quickstart.autoSetup')}
                      </Button>
                    </div>
                  ) : (
                    agents.map((agent: any) => (
                      <div
                        key={agent.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent cursor-pointer"
                        onClick={() => handleStartChat(agent.id)}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{agent.name}</p>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              agent.status === 'online' ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                            )} />
                            <span className="text-xs text-muted-foreground">{agent.mode}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder={t('chat.searchConversations')}
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="pl-8 pr-7 h-8 text-xs"
            />
            {sidebarSearch && (
              <button
                onClick={() => setSidebarSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={t('chat.clearSearch')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {filteredConversations.map((conv: any) => (
              <div key={conv.id} className="relative group">
                <button
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                    selectedConversationId === conv.id
                      ? 'bg-accent'
                      : 'hover:bg-accent/50'
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">
                        {conv.agent?.name || conv.name || 'Conversation'}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                        {conv.lastMessage?.createdAt
                          ? new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.lastMessage?.content?.substring(0, 50) || t('chat.noMessages')}
                    </p>
                  </div>
                  {/* Unread badge (simulated) */}
                  {conv.unreadCount > 0 && (
                    <Badge className="h-5 min-w-5 text-[10px] px-1.5 shrink-0">
                      {conv.unreadCount}
                    </Badge>
                  )}
                </button>
                {/* Delete button - visible on hover */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirmId(conv.id);
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            {filteredConversations.length === 0 && sidebarSearch.trim() && (
              <div className="py-8 text-center">
                <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('chat.noConversationsFound')}</p>
              </div>
            )}
            {conversations.length === 0 && !sidebarSearch.trim() && (
              <div className="py-4 text-center">
                <MessageSquare className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">{t('emptyState.noConversations')}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Delete confirmation dialog */}
        <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('chat.deleteConversationTitle')}</DialogTitle>
              <DialogDescription className="sr-only">{t('chat.deleteConversationDesc')}</DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t('chat.deleteConversationDesc')}
            </p>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="sm">{t('common.cancel')}</Button>
              </DialogClose>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteConfirmId && handleDeleteConversation(deleteConfirmId)}
              >
                {t('common.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedConv ? (
          <>
            {/* Agent Selector Header */}
            <AgentSelectorHeader
              agent={selectedConv.agent}
              agents={agents}
              onSwitchAgent={handleSwitchAgent}
            />

            {/* Chat Header (context + continue) */}
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                {lineage && lineage.ancestors.length > 0 && (
                  <Badge variant="outline" className="text-[10px] h-4 gap-1">
                    <GitBranch className="w-2.5 h-2.5" />
                    {t('context.lineage')}: {lineage.ancestors.length} · {t('context.totalMessages')}: {lineage.totalMessages}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ContextIndicator type="conversation" id={selectedConversationId!} />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={async () => {
                    try {
                      const result = await api.continueConversation(selectedConversationId!, selectedConv.agentId);
                      const convs = await api.getConversations();
                      setConversations(convs.conversations || []);
                      setSelectedConversationId(result.conversationId);
                      toast.success(t('context.continueInNewSession'));
                    } catch (error: any) {
                      toast.error(error.message);
                    }
                  }}
                >
                  <ArrowRight className="w-3 h-3" />
                  <span className="hidden sm:inline">{t('context.continueInNewSession')}</span>
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4 md:p-6" ref={scrollAreaRef}>
              <div className="max-w-3xl mx-auto space-y-3">
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 && !sending ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Bot className="w-12 h-12 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">{t('chat.noMessages')}</p>
                  </div>
                ) : (
                  messages.map((msg: any) => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      onCopy={handleCopyMessage}
                      onDelete={handleDeleteMessage}
                    />
                  ))
                )}

                {/* Streaming content - show as agent message being built */}
                {streaming && streamingContent && (
                  <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="max-w-[70%] bg-card border border-border rounded-2xl rounded-bl-md px-4 py-2.5">
                      <MarkdownRenderer content={streamingContent} />
                      <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom" />
                    </div>
                  </div>
                )}

                {/* Typing Indicator (shown while waiting for first chunk) */}
                {sending && !streaming && (
                  <TypingIndicator
                    agentName={selectedConv?.agent?.name || 'Agent'}
                  />
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Enhanced Input Area */}
            <div className="p-3 md:p-4 border-t border-border">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-end gap-2 bg-card border border-border rounded-xl px-3 py-2 focus-within:border-primary/50 transition-colors">
                  {/* Attachment button */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0 text-muted-foreground hover:text-foreground">
                          <Paperclip className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Attach file</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Auto-expanding textarea */}
                  <AutoExpandingTextarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('chat.sendMessage')}
                    disabled={sending}
                  />

                  {/* Emoji button */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0 text-muted-foreground hover:text-foreground">
                          <Smile className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Emoji</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Stop streaming button */}
                  {streaming && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-8 h-8 shrink-0"
                      onClick={() => {
                        abortRef.current?.abort();
                        setStreaming(false);
                        setStreamingContent('');
                      }}
                      aria-label={t('chat.stopStreaming')}
                      title={t('chat.stopStreaming')}
                    >
                      <Square className="w-4 h-4" />
                    </Button>
                  )}

                  {/* Send button */}
                  <Button
                    onClick={handleSend}
                    disabled={sending || streaming || !input.trim()}
                    size="icon"
                    className="w-8 h-8 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                  Enter to send · Shift+Enter for new line
                </p>
              </div>
            </div>
          </>
        ) : (
          <EmptyChatState onStartChat={() => setShowNewChat(true)} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Rooms Tab (multi-agent chat rooms with messaging)
// ---------------------------------------------------------------------------

function RoomsPanel() {
  const { chatRooms, setChatRooms, agents, user } = useAppStore();
  const { t } = useI18n();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomMessages, setRoomMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [typingAgents, setTypingAgents] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');
  const [form, setForm] = useState({ name: '', description: '', isPublic: true, selectedAgentIds: [] as string[] });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const selectedRoom = chatRooms.find((r: any) => r.id === selectedRoomId);
  const roomAgents = selectedRoom?.agents || [];

  const filteredRooms = chatRooms.filter((room: any) => {
    if (!roomSearch.trim()) return true;
    const q = roomSearch.toLowerCase();
    return (room.name || '').toLowerCase().includes(q) || (room.description || '').toLowerCase().includes(q);
  });

  // Socket.IO connection
  useEffect(() => {
    if (!user?.id) return;

    const socket = io('/?XTransformPort=3003', {
      auth: {
        userId: user.id,
        username: user.name || user.email || 'User',
      },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('[ChatView] Socket.IO connected');
    });

    socket.on('room:message', (data: any) => {
      setRoomMessages((prev) => [...prev, data]);
    });

    socket.on('room:join', () => {});
    socket.on('room:leave', () => {});

    socket.on('agent:typing', (data: any) => {
      if (data.isTyping) {
        setTypingAgents((prev) => prev.includes(data.agentName) ? prev : [...prev, data.agentName]);
      } else {
        setTypingAgents((prev) => prev.filter((n) => n !== data.agentName));
      }
    });

    socket.on('agent:stream-complete', (data: any) => {
      setTypingAgents((prev) => prev.filter((n) => n !== data.agentName));
      if (!data.error) {
        setRoomMessages((prev) => [...prev, {
          id: `agent-msg-${Date.now()}`,
          roomId: data.conversationId || selectedRoomId,
          senderId: data.agentId,
          senderName: data.agentName || 'Agent',
          content: data.fullResponse,
          senderType: 'agent',
          timestamp: data.timestamp || new Date().toISOString(),
        }]);
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, user?.name, user?.email, selectedRoomId]);

  // Join/leave room via Socket.IO
  useEffect(() => {
    if (selectedRoomId && socketRef.current) {
      socketRef.current.emit('room:join', { roomId: selectedRoomId });
      return () => {
        socketRef.current?.emit('room:leave', { roomId: selectedRoomId });
      };
    }
  }, [selectedRoomId]);

  // Load room messages
  const loadRoomMessages = useCallback(async () => {
    if (!selectedRoomId) return;
    try {
      const result = await api.getChatRoomMessages(selectedRoomId);
      setRoomMessages(result.messages || []);
    } catch (error: any) {
      toast.error(error.message);
    }
  }, [selectedRoomId]);

  useEffect(() => {
    if (selectedRoomId) {
      loadRoomMessages();
    } else {
      setRoomMessages([]);
    }
  }, [selectedRoomId, loadRoomMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomMessages, typingAgents]);

  const handleCreateRoom = async () => {
    if (!form.name.trim()) {
      toast.error(t('common.required'));
      return;
    }
    setCreating(true);
    try {
      const result = await api.createChatRoom({
        name: form.name,
        description: form.description,
        isPublic: form.isPublic,
        agentIds: form.selectedAgentIds,
      });
      setChatRooms([result.room, ...chatRooms]);
      setShowCreate(false);
      setForm({ name: '', description: '', isPublic: true, selectedAgentIds: [] });
      toast.success(t('chatRooms.roomCreated'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRoom = async (id: string) => {
    try {
      await api.deleteChatRoom(id);
      setChatRooms(chatRooms.filter((r: any) => r.id !== id));
      if (selectedRoomId === id) setSelectedRoomId(null);
      toast.success(t('chatRooms.roomDeleted'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleAgent = (agentId: string) => {
    setForm((prev) => ({
      ...prev,
      selectedAgentIds: prev.selectedAgentIds.includes(agentId)
        ? prev.selectedAgentIds.filter((id) => id !== agentId)
        : [...prev.selectedAgentIds, agentId],
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    // Detect @mention
    const atMatch = value.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1].toLowerCase());
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionQuery(null);
    }
  };

  const handleMentionSelect = (agentName: string) => {
    const atMatch = input.match(/@(\w*)$/);
    if (atMatch) {
      setInput(input.replace(/@\w*$/, `@${agentName} `));
    }
    setShowMentions(false);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const filteredMentionAgents = roomAgents.filter((a: any) =>
    !mentionQuery || a.name?.toLowerCase().includes(mentionQuery)
  );

  const handleRoomSend = async () => {
    if (!input.trim() || !selectedRoomId) return;
    const msg = input.trim();
    setInput('');
    setSending(true);

    // Send via Socket.IO
    if (socketRef.current) {
      socketRef.current.emit('room:message', {
        roomId: selectedRoomId,
        content: msg,
      });
    }

    // Also persist via REST API
    try {
      await api.sendChatRoomMessage(selectedRoomId, msg);
    } catch (error: any) {
      console.error('Failed to persist room message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleRoomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleRoomSend();
    }
  };

  return (
    <div className="flex h-full">
      {/* Room List Sidebar */}
      <div className="w-72 border-r border-border flex flex-col shrink-0 hidden md:flex">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm">{t('chatRooms.title')}</h2>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button size="icon" className="w-7 h-7" variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('chatRooms.createRoomTitle')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>{t('chatRooms.roomName')} *</Label>
                    <Input
                      placeholder={t('chatRooms.roomNamePlaceholder')}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('chatRooms.roomDescription')}</Label>
                    <Input
                      placeholder={t('chatRooms.roomDescriptionPlaceholder')}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isPublic}
                      onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                    />
                    <Label>{t('chatRooms.publicRoom')}</Label>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('chatRooms.addAgents')}</Label>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {agents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('chatRooms.noAgents')}</p>
                      ) : (
                        agents.map((agent: any) => (
                          <div
                            key={agent.id}
                            className={cn(
                              'flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors',
                              form.selectedAgentIds.includes(agent.id)
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:bg-accent'
                            )}
                            onClick={() => toggleAgent(agent.id)}
                          >
                            <Bot className="w-4 h-4 text-primary" />
                            <span className="text-sm">{agent.name}</span>
                            {form.selectedAgentIds.includes(agent.id) && (
                              <Badge className="ml-auto text-[10px]">{t('chatRooms.selected')}</Badge>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <Button onClick={handleCreateRoom} className="w-full" disabled={creating}>
                    {creating ? 'Creating...' : t('chatRooms.createRoom')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {/* Room search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder={t('chatRooms.searchPlaceholder')}
              value={roomSearch}
              onChange={(e) => setRoomSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {filteredRooms.map((room: any) => (
              <div key={room.id} className="relative group">
                <button
                  onClick={() => setSelectedRoomId(room.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                    selectedRoomId === room.id ? 'bg-accent' : 'hover:bg-accent/50'
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{room.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">
                        {room.isPublic ? t('chatRooms.public') : t('chatRooms.private')}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {t('chatRooms.agents', { count: room.agents?.length || 0 })}
                      </span>
                    </div>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 w-6 h-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); handleDeleteRoom(room.id); }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            {chatRooms.length === 0 && (
              <div className="py-8 text-center">
                <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('chatRooms.noRoomsTitle')}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Room Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedRoom ? (
          <>
            {/* Room Header */}
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-card/50">
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    <Users className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{selectedRoom.name}</p>
                  <div className="flex items-center gap-2">
                    {selectedRoom.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-48">{selectedRoom.description}</p>
                    )}
                    {roomAgents.length > 0 && (
                      <div className="flex items-center gap-1">
                        {roomAgents.slice(0, 3).map((a: any) => (
                          <Badge key={a.id} variant="outline" className="text-[10px] gap-1">
                            <Bot className="w-2.5 h-2.5" /> {a.name}
                          </Badge>
                        ))}
                        {roomAgents.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{roomAgents.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ContextIndicator type="room" id={selectedRoomId!} />
                <Button variant="ghost" size="sm" onClick={() => setSelectedRoomId(null)} className="gap-1">
                  <ArrowLeft className="w-3 h-3" /> {t('chat.backToRooms')}
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 md:p-6">
              <div className="max-w-3xl mx-auto space-y-3">
                {roomMessages.map((msg: any, idx: number) => (
                  <div
                    key={msg.id || idx}
                    className={cn(
                      'flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300',
                    )}
                  >
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarFallback className={cn(
                        'text-xs',
                        msg.senderType === 'agent' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary text-primary-foreground'
                      )}>
                        {msg.senderType === 'agent' ? <Bot className="w-4 h-4" /> : (msg.senderName?.[0] || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="max-w-[70%]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">{msg.senderName || 'Unknown'}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.timestamp || msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-2.5">
                        {msg.senderType === 'agent' ? (
                          <MarkdownRenderer content={msg.content} />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {typingAgents.length > 0 && (
                  <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs bg-emerald-500/10 text-emerald-600">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                      <p className="text-xs text-muted-foreground mb-1.5">
                        {typingAgents.join(', ')} {t('chat.typing')}
                      </p>
                      <div className="flex gap-1.5 items-center h-4">
                        <span className="w-2 h-2 rounded-full bg-emerald-500/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-emerald-500/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-emerald-500/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                {roomMessages.length === 0 && typingAgents.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">{t('chat.noMessages')}</p>
                    <p className="text-muted-foreground text-xs mt-1">{t('chat.startRoomChat')}</p>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input with @mention */}
            <div className="p-3 md:p-4 border-t border-border relative">
              {showMentions && filteredMentionAgents.length > 0 && (
                <div className="absolute bottom-full left-4 right-4 mb-1 bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                  <div className="p-1">
                    <p className="text-[10px] text-muted-foreground px-2 py-1">{t('chat.mentionAgents')}</p>
                    {filteredMentionAgents.map((a: any) => (
                      <button
                        key={a.id}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent text-left"
                        onClick={() => handleMentionSelect(a.name)}
                      >
                        <Bot className="w-4 h-4 text-primary" />
                        <span>{a.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 focus-within:border-primary/50 transition-colors">
                  <div className="flex-1 relative">
                    <Input
                      ref={inputRef}
                      placeholder={t('chat.typeRoomMessage')}
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleRoomKeyDown}
                      disabled={sending}
                      className="border-0 shadow-none focus-visible:ring-0 bg-transparent"
                    />
                  </div>
                  <Button onClick={handleRoomSend} disabled={sending || !input.trim()} size="icon" className="w-8 h-8 shrink-0">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <Users className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-1">{t('chatRooms.title')}</h2>
            <p className="text-muted-foreground text-sm mb-4">{t('chat.selectRoom')}</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> {t('chatRooms.createRoom')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ChatView with Tabs
// ---------------------------------------------------------------------------

export function ChatView() {
  const { t } = useI18n();
  const { conversations, selectedConversationId } = useAppStore();

  const selectedConv = conversations.find((c: any) => c.id === selectedConversationId);

  const handleExportConversation = useCallback(() => {
    if (!selectedConv) return;
    const exportData = {
      conversation: {
        id: selectedConv.id,
        name: selectedConv.name || selectedConv.agent?.name,
        agentId: selectedConv.agentId,
        agentName: selectedConv.agent?.name,
        agentMode: selectedConv.agent?.mode,
        createdAt: selectedConv.createdAt,
        updatedAt: selectedConv.updatedAt,
      },
      exportedAt: new Date().toISOString(),
      format: 'hermes-hub-chat-export-v1',
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${selectedConv.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('chat.exportSuccess'));
  }, [selectedConv, t]);

  const handleImportConversation = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.conversation) {
          toast.error(t('chat.importInvalidFormat'));
          return;
        }
        toast.success(t('chat.importSuccess'));
      } catch {
        toast.error(t('chat.importFailed'));
      }
    };
    input.click();
  }, [t]);

  return (
    <div className="h-full flex flex-col">
      <h1 className="sr-only">{t('chat.title')}</h1>
      <Tabs defaultValue="conversations" className="flex flex-col h-full">
        <div className="px-4 md:px-6 pt-4 pb-0 flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="conversations" className="gap-1.5">
              <MessageSquare className="w-4 h-4" /> {t('chat.tabConversations')}
            </TabsTrigger>
            <TabsTrigger value="rooms" className="gap-1.5">
              <Users className="w-4 h-4" /> {t('chat.tabRooms')}
            </TabsTrigger>
          </TabsList>
          {selectedConv && (
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-muted-foreground hover:text-foreground"
                      onClick={handleExportConversation}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {t('chat.exportConversation')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-muted-foreground hover:text-foreground"
                      onClick={handleImportConversation}
                    >
                      <Upload className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {t('chat.importConversation')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
        <TabsContent value="conversations" className="flex-1 mt-0">
          <ConversationsPanel />
        </TabsContent>
        <TabsContent value="rooms" className="flex-1 mt-0">
          <RoomsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
