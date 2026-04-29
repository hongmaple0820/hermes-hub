'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Bot, Send, Plus, Loader2, ArrowLeft, MessageSquare, Users, GitBranch, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { ContextIndicator } from '@/components/shared/ContextIndicator';

// ---------------------------------------------------------------------------
// Sub-component: Conversations Tab (1-on-1 chats)
// ---------------------------------------------------------------------------

function ConversationsPanel() {
  const { agents, conversations, setConversations, selectedConversationId, setSelectedConversationId } = useAppStore();
  const { t } = useI18n();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [lineage, setLineage] = useState<{ ancestors: any[]; totalMessages: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConv = conversations.find((c: any) => c.id === selectedConversationId);

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
  }, [messages]);

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

  const handleSend = async () => {
    if (!input.trim() || !selectedConversationId) return;
    const userMsg = input.trim();
    setInput('');
    setSending(true);

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
      const result = await api.sendMessage(selectedConversationId, userMsg);
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
      }
    } catch (error: any) {
      toast.error(error.message);
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full">
      {/* Conversation List */}
      <div className="w-72 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">{t('chat.conversations')}</h2>
          <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
            <DialogTrigger asChild>
              <Button size="icon" className="w-7 h-7"><Plus className="w-4 h-4" /></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t('chat.startNewChatTitle')}</DialogTitle></DialogHeader>
              <div className="space-y-2 mt-4">
                {agents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t('chat.noAgents')}</p>
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
                        <p className="text-xs text-muted-foreground">{agent.mode}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.map((conv: any) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversationId(conv.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                  selectedConversationId === conv.id ? 'bg-accent' : 'hover:bg-accent/50'
                )}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {conv.agent?.name || conv.name || 'Conversation'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.lastMessage?.content?.substring(0, 40) || t('chat.noMessages')}
                  </p>
                </div>
              </button>
            ))}
            {conversations.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t('chat.noConversations')}</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConv ? (
          <>
            <div className="px-6 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{selectedConv.agent?.name || 'Chat'}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">{selectedConv.agent?.status === 'online' ? t('common.online') : t('common.offline')}</p>
                    {lineage && lineage.ancestors.length > 0 && (
                      <Badge variant="outline" className="text-[10px] h-4 gap-1">
                        <GitBranch className="w-2.5 h-2.5" />
                        {t('context.lineage')}: {lineage.ancestors.length} · {t('context.totalMessages')}: {lineage.totalMessages}
                      </Badge>
                    )}
                  </div>
                </div>
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

            <ScrollArea className="flex-1 p-6">
              <div className="max-w-3xl mx-auto space-y-4">
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  messages.map((msg: any) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex gap-3',
                        msg.senderType === 'user' ? 'flex-row-reverse' : ''
                      )}
                    >
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarFallback className={cn(
                          'text-xs',
                          msg.senderType === 'user' ? 'bg-primary text-primary-foreground' : 'bg-accent'
                        )}>
                          {msg.senderType === 'user' ? 'You' : (msg.senderName?.[0] || 'A')}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          'max-w-[70%] rounded-2xl px-4 py-2.5',
                          msg.senderType === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-accent'
                        )}
                      >
                        {msg.senderType === 'agent' ? (
                          <MarkdownRenderer content={msg.content} />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        )}
                        <p className={cn(
                          'text-[10px] mt-1',
                          msg.senderType === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        )}>
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                {sending && (
                  <div className="flex gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs bg-accent">A</AvatarFallback>
                    </Avatar>
                    <div className="bg-accent rounded-2xl px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-border">
              <div className="max-w-3xl mx-auto flex items-center gap-2">
                <Input
                  placeholder={t('chat.typeMessage')}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                  className="flex-1"
                />
                <Button onClick={handleSend} disabled={sending || !input.trim()} size="icon">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <Bot className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-1">{t('chat.startConversation')}</h2>
            <p className="text-muted-foreground text-sm mb-4">{t('chat.selectAgent')}</p>
            <Button onClick={() => setShowNewChat(true)} className="gap-2">
              <Plus className="w-4 h-4" /> {t('chat.newChat')}
            </Button>
          </div>
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
  const [form, setForm] = useState({ name: '', description: '', isPublic: true, selectedAgentIds: [] as string[] });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const selectedRoom = chatRooms.find((r: any) => r.id === selectedRoomId);
  const roomAgents = selectedRoom?.agents || [];

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

    socket.on('room:join', (data: any) => {
      // Another user joined
    });

    socket.on('room:leave', (data: any) => {
      // Another user left
    });

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
  }, [roomMessages]);

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
      // Don't show error for real-time messages - Socket.IO is the primary channel
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
      {/* Room List */}
      <div className="w-72 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">{t('chatRooms.title')}</h2>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="icon" className="w-7 h-7"><Plus className="w-4 h-4" /></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t('chatRooms.createRoomTitle')}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>{t('chatRooms.roomName')} *</Label>
                  <Input placeholder={t('chatRooms.roomNamePlaceholder')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('chatRooms.roomDescription')}</Label>
                  <Input placeholder={t('chatRooms.roomDescriptionPlaceholder')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} />
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
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {chatRooms.map((room: any) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoomId(room.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                  selectedRoomId === room.id ? 'bg-accent' : 'hover:bg-accent/50'
                )}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{room.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px]">{room.isPublic ? t('chatRooms.public') : t('chatRooms.private')}</Badge>
                    <span className="text-[10px] text-muted-foreground">{t('chatRooms.agents', { count: room.agents?.length || 0 })}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6 shrink-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); handleDeleteRoom(room.id); }}
                >
                  <span className="text-xs">✕</span>
                </Button>
              </button>
            ))}
            {chatRooms.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t('chatRooms.noRoomsTitle')}</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Room Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            {/* Room Header */}
            <div className="px-6 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>
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
                {/* Context indicator for room */}
                <ContextIndicator type="room" id={selectedRoomId!} />
                <Button variant="ghost" size="sm" onClick={() => setSelectedRoomId(null)} className="gap-1">
                  <ArrowLeft className="w-3 h-3" /> {t('chat.backToRooms')}
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-6">
              <div className="max-w-3xl mx-auto space-y-4">
                {roomMessages.map((msg: any, idx: number) => (
                  <div
                    key={msg.id || idx}
                    className={cn(
                      'flex gap-3',
                      msg.senderType === 'agent' ? '' : ''
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
                          {new Date(msg.timestamp || msg.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="bg-accent rounded-2xl px-4 py-2.5">
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
                  <div className="flex gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs bg-emerald-500/10 text-emerald-600">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-accent rounded-2xl px-4 py-3">
                      <p className="text-xs text-muted-foreground mb-1">
                        {typingAgents.join(', ')} {t('chat.isTyping')}
                      </p>
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
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
            <div className="p-4 border-t border-border relative">
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
              <div className="max-w-3xl mx-auto flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    placeholder={t('chat.typeRoomMessage')}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleRoomKeyDown}
                    disabled={sending}
                  />
                </div>
                <Button onClick={handleRoomSend} disabled={sending || !input.trim()} size="icon">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <Users className="w-16 h-16 text-muted-foreground mb-4" />
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

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="conversations" className="flex flex-col h-full">
        <div className="px-6 pt-4 pb-0">
          <TabsList>
            <TabsTrigger value="conversations" className="gap-1.5">
              <MessageSquare className="w-4 h-4" /> {t('chat.tabConversations')}
            </TabsTrigger>
            <TabsTrigger value="rooms" className="gap-1.5">
              <Users className="w-4 h-4" /> {t('chat.tabRooms')}
            </TabsTrigger>
          </TabsList>
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
