'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Users, Plus, Trash2, Bot, User, Hash, MessageSquare,
  Circle, LogIn, Search, Wifi, WifiOff, Sparkles,
  Send, ArrowLeft, Radio, Loader2, Smile,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { io, Socket } from 'socket.io-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoomForm {
  name: string;
  description: string;
  isPublic: boolean;
  selectedAgentIds: string[];
}

interface RoomMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  type?: string;
  timestamp: string;
  senderInfo?: { id: string; name: string; type: string; avatar?: string | null };
  saved?: boolean;
}

interface OnlineParticipant {
  userId: string;
  username: string;
  connectedAt: string;
}

interface TypingUser {
  userId: string;
  username: string;
  isTyping: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatRoomManager() {
  const { chatRooms, setChatRooms, agents, user } = useAppStore();
  const { t } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState<RoomForm>({
    name: '',
    description: '',
    isPublic: true,
    selectedAgentIds: [],
  });

  // Room detail state
  const [activeRoom, setActiveRoom] = useState<any | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [onlineParticipants, setOnlineParticipants] = useState<OnlineParticipant[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [showParticipants, setShowParticipants] = useState(false);

  // Socket.IO
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const joinedRoomsRef = useRef<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // Socket.IO Connection
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const currentUser = user;
    if (!currentUser?.id) return;

    // Connect to chat-service via Caddy gateway
    const socket = io('/?XTransformPort=3003', {
      auth: {
        userId: currentUser.id,
        username: currentUser.name || `User-${currentUser.id.substring(0, 6)}`,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[ChatRoom] Socket.IO connected:', socket.id);

      // Re-join rooms that we were in
      joinedRoomsRef.current.forEach(roomId => {
        socket.emit('room:join', { roomId });
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('[ChatRoom] Socket.IO disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[ChatRoom] Socket.IO connection error:', err.message);
    });

    // Listen for room messages from other users
    socket.on('room:message', (message: RoomMessage) => {
      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    // Listen for message sent confirmation
    socket.on('room:message:sent', (message: RoomMessage) => {
      setMessages(prev => {
        // Replace optimistic message with confirmed one
        const existingIdx = prev.findIndex(m => m.id === message.id || (m.senderId === message.senderId && m.content === message.content && m.timestamp === message.timestamp));
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = message;
          return updated;
        }
        return [...prev, message];
      });
    });

    // Listen for typing events
    socket.on('room:typing', (data: TypingUser) => {
      if (data.userId === currentUser?.id) return; // Ignore own typing
      setTypingUsers(prev => {
        const next = new Map(prev);
        if (data.isTyping) {
          next.set(data.userId, data.username);
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    });

    // Listen for participant updates
    socket.on('room:participants', (data: { roomId: string; participants: OnlineParticipant[]; onlineCount: number }) => {
      setOnlineParticipants(data.participants);
    });

    // Listen for room:join events (other users joining)
    socket.on('room:join', (data: { roomId: string; userId: string; username: string; timestamp: string }) => {
      // Refresh participants
      if (activeRoom?.id === data.roomId) {
        socket.emit('room:participants', { roomId: data.roomId });
      }
    });

    // Listen for room:leave events (other users leaving)
    socket.on('room:leave', (data: { roomId: string; userId: string; username: string; timestamp: string }) => {
      if (activeRoom?.id === data.roomId) {
        socket.emit('room:participants', { roomId: data.roomId });
        setTypingUsers(prev => {
          const next = new Map(prev);
          next.delete(data.userId);
          return next;
        });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, activeRoom?.id]);

  // ---------------------------------------------------------------------------
  // Auto-scroll to bottom
  // ---------------------------------------------------------------------------

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // ---------------------------------------------------------------------------
  // Room Actions
  // ---------------------------------------------------------------------------

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error(t('chatRooms.nameRequired'));
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

  const handleDelete = async (id: string) => {
    try {
      await api.deleteChatRoom(id);
      setChatRooms(chatRooms.filter((r: any) => r.id !== id));
      if (activeRoom?.id === id) {
        handleLeaveRoom();
      }
      toast.success(t('chatRooms.roomDeleted'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      toast.error(t('chatRooms.enterJoinCode'));
      return;
    }
    try {
      const result = await api.joinChatRoom(joinCode);
      if (result.room) {
        setChatRooms([result.room, ...chatRooms]);
        toast.success(result.alreadyMember ? t('chatRooms.joinSuccess') : t('chatRooms.joinedRoom'));
      } else {
        toast.success(t('chatRooms.joinSuccess'));
      }
      setShowJoinDialog(false);
      setJoinCode('');
    } catch (error: any) {
      toast.error(error.message || t('chatRooms.joinFailed'));
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

  // ---------------------------------------------------------------------------
  // Enter / Leave Room Detail
  // ---------------------------------------------------------------------------

  const handleEnterRoom = async (room: any) => {
    setActiveRoom(room);
    setMessages([]);
    setTypingUsers(new Map());
    setOnlineParticipants([]);
    setLoadingMessages(true);

    // Join Socket.IO room
    if (socketRef.current?.connected) {
      socketRef.current.emit('room:join', { roomId: room.id }, (response: any) => {
        if (response?.participants) {
          setOnlineParticipants(response.participants);
        }
      });
    }
    joinedRoomsRef.current.add(room.id);

    // Load messages from API
    try {
      const result = await api.getChatRoomMessages(room.id);
      const loadedMessages = (result.messages || []).map((m: any) => ({
        id: m.id,
        roomId: m.roomId,
        senderId: typeof m.senderInfo === 'string' ? JSON.parse(m.senderInfo).id : m.senderInfo?.id || '',
        senderName: typeof m.senderInfo === 'string' ? JSON.parse(m.senderInfo).name : m.senderInfo?.name || 'Unknown',
        content: m.content,
        type: m.type || 'text',
        timestamp: m.createdAt,
        senderInfo: typeof m.senderInfo === 'string' ? JSON.parse(m.senderInfo) : m.senderInfo,
      }));
      setMessages(loadedMessages);
    } catch (err: any) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleLeaveRoom = useCallback(() => {
    if (activeRoom && socketRef.current?.connected) {
      socketRef.current.emit('room:leave', { roomId: activeRoom.id });
    }
    if (activeRoom) {
      joinedRoomsRef.current.delete(activeRoom.id);
    }
    setActiveRoom(null);
    setMessages([]);
    setTypingUsers(new Map());
    setOnlineParticipants([]);
    setShowParticipants(false);
  }, [activeRoom]);

  // ---------------------------------------------------------------------------
  // Send Message
  // ---------------------------------------------------------------------------

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeRoom || sendingMessage) return;
    const content = newMessage.trim();
    setSendingMessage(true);
    setNewMessage('');

    // Clear typing state
    if (socketRef.current?.connected) {
      socketRef.current.emit('room:typing', { roomId: activeRoom.id, isTyping: false });
    }

    // Optimistic: add message locally
    const optimisticMessage: RoomMessage = {
      id: `temp-${Date.now()}`,
      roomId: activeRoom.id,
      senderId: user?.id || '',
      senderName: user?.name || 'You',
      content,
      type: 'text',
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      // Send via REST API for persistence (source of truth)
      await api.sendChatRoomMessage(activeRoom.id, content);

      // Also emit via Socket.IO for real-time broadcast to others
      if (socketRef.current?.connected) {
        socketRef.current.emit('room:message', {
          roomId: activeRoom.id,
          content,
          type: 'text',
        });
      }

      // Remove optimistic message (will be replaced by Socket.IO events)
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
      // Keep optimistic message but mark as failed
    } finally {
      setSendingMessage(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Typing Indicator
  // ---------------------------------------------------------------------------

  const handleTyping = (value: string) => {
    setNewMessage(value);

    if (!socketRef.current?.connected || !activeRoom) return;

    // Emit typing start
    socketRef.current.emit('room:typing', { roomId: activeRoom.id, isTyping: true });

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 3s of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('room:typing', { roomId: activeRoom!.id, isTyping: false });
    }, 3000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ---------------------------------------------------------------------------
  // Room Status Helpers
  // ---------------------------------------------------------------------------

  const getRoomStatus = (room: any): 'active' | 'inactive' => {
    const memberCount = room.members?.length || 0;
    const agentCount = room.agents?.length || 0;
    return memberCount > 0 || agentCount > 0 ? 'active' : 'inactive';
  };

  const getParticipantCount = (room: any): number => {
    return (room.members?.length || 0) + (room.agents?.length || 0);
  };

  // Filter rooms by search
  const filteredRooms = chatRooms.filter((room: any) =>
    !searchQuery ||
    room.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Format timestamp
  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // ---------------------------------------------------------------------------
  // Room Detail Chat View
  // ---------------------------------------------------------------------------

  if (activeRoom) {
    const typingNames = Array.from(typingUsers.values());
    const isTyping = typingNames.length > 0;

    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] max-w-7xl mx-auto">
        {/* Chat Header */}
        <div className="flex items-center gap-3 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={handleLeaveRoom}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold truncate">{activeRoom.name}</h2>
              <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                <Radio className="w-3 h-3 text-emerald-500" />
                {t('chatRooms.realtime')}
              </Badge>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {onlineParticipants.length} {t('chatRooms.onlineMembers')}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {activeRoom.description || t('chatRooms.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className={cn('gap-1', showParticipants && 'bg-accent')}
              onClick={() => setShowParticipants(!showParticipants)}
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">{onlineParticipants.length}</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Messages Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <ScrollArea className="flex-1 px-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-muted-foreground text-sm">{t('chatRooms.noMessages')}</p>
                </div>
              ) : (
                <div className="py-4 space-y-3">
                  {messages.map((msg) => {
                    const isOwn = msg.senderId === user?.id;
                    const isAgent = msg.senderInfo?.type === 'agent' || msg.type === 'agent';

                    return (
                      <div key={msg.id} className={cn('flex gap-2', isOwn ? 'justify-end' : 'justify-start')}>
                        {!isOwn && (
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-medium',
                            isAgent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                          )}>
                            {isAgent ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                          </div>
                        )}
                        <div className={cn('max-w-[75%] min-w-0', isOwn ? 'items-end' : 'items-start')}>
                          {!isOwn && (
                            <p className={cn('text-xs mb-0.5 font-medium', isAgent ? 'text-primary' : 'text-muted-foreground')}>
                              {msg.senderName}
                              {isAgent && <Bot className="w-3 h-3 inline ml-1" />}
                            </p>
                          )}
                          <div className={cn(
                            'rounded-2xl px-3 py-2 text-sm break-words',
                            isOwn
                              ? 'bg-primary text-primary-foreground rounded-br-sm'
                              : isAgent
                                ? 'bg-primary/10 border border-primary/20 rounded-bl-sm'
                                : 'bg-muted rounded-bl-sm'
                          )}>
                            {msg.content}
                          </div>
                          <p className={cn('text-[10px] text-muted-foreground mt-0.5', isOwn ? 'text-right' : 'text-left')}>
                            {formatTime(msg.timestamp)}
                          </p>
                        </div>
                        {isOwn && (
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 text-xs font-medium text-primary-foreground">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Typing indicator */}
                  {isTyping && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          {typingNames.length === 1
                            ? t('chatRooms.typing', { name: typingNames[0] })
                            : `${typingNames.length} ${t('chatRooms.typingMultiple')}`
                          }
                        </p>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-3 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex items-center gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => handleTyping(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('chatRooms.messagePlaceholder')}
                  className="flex-1"
                  disabled={sendingMessage}
                />
                <Button
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendingMessage}
                >
                  {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Online Participants Sidebar */}
          {showParticipants && (
            <div className="w-64 border-l bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 hidden sm:block">
              <div className="p-3 border-b">
                <h3 className="text-sm font-semibold">{t('chatRooms.onlineMembers')}</h3>
                <p className="text-xs text-muted-foreground">{onlineParticipants.length} online</p>
              </div>
              <ScrollArea className="h-[calc(100%-3.5rem)]">
                <div className="p-2 space-y-1">
                  {onlineParticipants.map((p) => (
                    <div key={p.userId} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent transition-colors">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <Circle className="absolute -bottom-0.5 -right-0.5 w-3 h-3 fill-emerald-500 text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.username}</p>
                        <p className="text-[10px] text-emerald-500">{t('chatRooms.realtime')}</p>
                      </div>
                    </div>
                  ))}
                  {onlineParticipants.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">{t('chatRooms.noOnlineMembers')}</p>
                  )}
                </div>

                {/* Show room agents */}
                {activeRoom.agents?.length > 0 && (
                  <>
                    <Separator className="my-2" />
                    <div className="p-2 space-y-1">
                      <p className="text-xs text-muted-foreground px-2 font-medium">{t('chatRooms.agentsInRoom')}</p>
                      {activeRoom.agents.map((agent: any, i: number) => (
                        <div key={agent.id || i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent transition-colors">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-primary" />
                          </div>
                          <p className="text-sm font-medium truncate">{agent.name || `Agent ${i + 1}`}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Room List View
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('chatRooms.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('chatRooms.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
            <Button variant="outline" className="gap-2" onClick={() => setShowJoinDialog(true)}>
              <LogIn className="w-4 h-4" /> {t('chatRooms.joinRoom')}
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('chatRooms.joinRoomTitle')}</DialogTitle>
                <DialogDescription>{t('chatRooms.joinRoomDesc')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>{t('chatRooms.joinCode')}</Label>
                  <Input
                    placeholder={t('chatRooms.joinCodePlaceholder')}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                  />
                </div>
                <Button onClick={handleJoinRoom} className="w-full gap-2">
                  <LogIn className="w-4 h-4" /> {t('chatRooms.joinRoom')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> {t('chatRooms.createRoom')}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{t('chatRooms.createRoomTitle')}</DialogTitle>
                <DialogDescription>{t('chatRooms.createRoomDesc')}</DialogDescription>
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
                  <Textarea
                    placeholder={t('chatRooms.roomDescriptionPlaceholder')}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={form.isPublic}
                    onCheckedChange={(v) => setForm({ ...form, isPublic: v })}
                  />
                  <Label>{t('chatRooms.publicRoom')}</Label>
                  {form.isPublic && (
                    <Badge variant="outline" className="text-[10px] gap-1 ml-auto">
                      <Wifi className="w-3 h-3" /> {t('chatRooms.publicBadge')}
                    </Badge>
                  )}
                  {!form.isPublic && (
                    <Badge variant="outline" className="text-[10px] gap-1 ml-auto">
                      <WifiOff className="w-3 h-3" /> {t('chatRooms.privateBadge')}
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Bot className="w-4 h-4" /> {t('chatRooms.addAgents')}
                  </Label>
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
                          {agent.status && (
                            <Circle className={cn(
                              'w-2 h-2 ml-1',
                              agent.status === 'online' ? 'fill-emerald-500 text-emerald-500' :
                              agent.status === 'busy' ? 'fill-amber-500 text-amber-500' :
                              'fill-gray-400 text-gray-400'
                            )} />
                          )}
                          {form.selectedAgentIds.includes(agent.id) && (
                            <Badge className="ml-auto text-[10px]">{t('chatRooms.selected')}</Badge>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreate(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={handleCreate} disabled={creating} className="gap-2">
                    {creating ? t('chatRooms.creating') : <><Plus className="w-4 h-4" /> {t('chatRooms.createRoom')}</>}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      {chatRooms.length > 0 && (
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('chatRooms.searchPlaceholder')}
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {/* Room List */}
      {chatRooms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">{t('chatRooms.noRoomsTitle')}</h3>
            <p className="text-muted-foreground text-sm mb-2 max-w-sm text-center">{t('chatRooms.noRoomsDesc')}</p>
            <p className="text-muted-foreground text-xs mb-6 max-w-sm text-center">{t('chatRooms.noRoomsHint')}</p>
            <div className="flex items-center gap-3">
              <Button onClick={() => setShowCreate(true)} className="gap-2">
                <Plus className="w-4 h-4" /> {t('chatRooms.createRoom')}
              </Button>
              <Button variant="outline" onClick={() => setShowJoinDialog(true)} className="gap-2">
                <LogIn className="w-4 h-4" /> {t('chatRooms.joinRoom')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : filteredRooms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Search className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('chatRooms.noSearchResults')}</h3>
            <p className="text-muted-foreground text-sm">{t('chatRooms.tryDifferentSearch')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map((room: any) => {
            const status = getRoomStatus(room);
            const participantCount = getParticipantCount(room);
            const agentCount = room.agents?.length || 0;
            const memberCount = room.members?.length || 0;

            return (
              <Card
                key={room.id}
                className="hover:shadow-md transition-shadow group cursor-pointer"
                onClick={() => handleEnterRoom(room)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                        status === 'active'
                          ? 'bg-emerald-500/10'
                          : 'bg-muted'
                      )}>
                        <Users className={cn(
                          'w-5 h-5',
                          status === 'active' ? 'text-emerald-500' : 'text-muted-foreground'
                        )} />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{room.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {/* Real-time badge */}
                          <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-200">
                            <Radio className="w-3 h-3" />
                            {t('chatRooms.realtime')}
                          </Badge>
                          {/* Public/Private badge */}
                          <Badge variant="outline" className="text-[10px]">
                            {room.isPublic ? t('chatRooms.public') : t('chatRooms.private')}
                          </Badge>
                          {/* Join code */}
                          {room.joinCode && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Hash className="w-3 h-3" /> {room.joinCode}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); handleDelete(room.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {room.description || t('common.noData')}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {/* Participant count badge */}
                    <span className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full">
                      <Users className="w-3 h-3" /> {participantCount} {t('chatRooms.participants')}
                    </span>
                    {memberCount > 0 && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {memberCount}
                      </span>
                    )}
                    {agentCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Bot className="w-3 h-3" /> {agentCount}
                      </span>
                    )}
                  </div>
                  {/* Agent avatars row */}
                  {room.agents && room.agents.length > 0 && (
                    <div className="flex items-center gap-1 mt-3">
                      {room.agents.slice(0, 5).map((agent: any, i: number) => (
                        <div
                          key={agent.id || i}
                          className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center border border-background -ml-1 first:ml-0"
                          title={agent.name || `Agent ${i + 1}`}
                        >
                          <Bot className="w-3 h-3 text-primary" />
                        </div>
                      ))}
                      {room.agents.length > 5 && (
                        <span className="text-[10px] text-muted-foreground ml-1">
                          +{room.agents.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
