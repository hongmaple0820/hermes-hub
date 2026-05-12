'use client';

import { useState } from 'react';
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
import {
  Users, Plus, Trash2, Bot, User, Hash, MessageSquare,
  Circle, LogIn, Search, Wifi, WifiOff, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface RoomForm {
  name: string;
  description: string;
  isPublic: boolean;
  selectedAgentIds: string[];
}

export function ChatRoomManager() {
  const { chatRooms, setChatRooms, agents } = useAppStore();
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
      const result = await api.joinChatRoom?.(joinCode).catch(() => null);
      if (result?.room) {
        setChatRooms([result.room, ...chatRooms]);
        toast.success(t('chatRooms.joinedRoom'));
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

  // Determine room status based on available data
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
              <Card key={room.id} className="hover:shadow-md transition-shadow group">
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
                          {/* Status indicator */}
                          <Badge variant="outline" className={cn(
                            'text-[10px] gap-1',
                            status === 'active'
                              ? 'text-emerald-600 border-emerald-200'
                              : 'text-muted-foreground'
                          )}>
                            <Circle className={cn(
                              'w-2 h-2',
                              status === 'active' ? 'fill-emerald-500 text-emerald-500' : 'fill-gray-400 text-gray-400'
                            )} />
                            {status === 'active' ? t('chatRooms.active') : t('chatRooms.inactive')}
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
                      onClick={() => handleDelete(room.id)}
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
