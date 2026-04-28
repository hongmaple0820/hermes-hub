'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, Send, Plus, Loader2, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function ChatView() {
  const { agents, conversations, setConversations, selectedConversationId, setSelectedConversationId } = useAppStore();
  const { t } = useI18n();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
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

  useEffect(() => {
    if (selectedConversationId) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [selectedConversationId, loadMessages]);

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

    // Optimistic update
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

      // Replace temp message with real one
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
        return [...filtered, result.message];
      });

      // Add agent reply if present
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
      // Remove optimistic message on error
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
    <div className="flex h-screen">
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
            {/* Chat Header */}
            <div className="px-6 py-3 border-b border-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{selectedConv.agent?.name || 'Chat'}</p>
                <p className="text-xs text-muted-foreground">{selectedConv.agent?.status === 'online' ? t('common.online') : t('common.offline')}</p>
              </div>
            </div>

            {/* Messages */}
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
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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

            {/* Input */}
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
