'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Plus, Trash2, Bot, User, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function ChatRoomManager() {
  const { chatRooms, setChatRooms, agents } = useAppStore();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    isPublic: true,
    selectedAgentIds: [] as string[],
  });

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Room name is required');
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
      toast.success('Chat room created!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAgent(id);
      setChatRooms(chatRooms.filter((r: any) => r.id !== id));
      toast.success('Room deleted');
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Chat Rooms</h1>
          <p className="text-muted-foreground text-sm">Multi-agent collaboration rooms with context compression</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Create Room</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Chat Room</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Room Name *</Label>
                <Input placeholder="e.g., Research Team" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input placeholder="What is this room about?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} />
                <Label>Public room</Label>
              </div>
              <div className="space-y-2">
                <Label>Add Agents</Label>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {agents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No agents available</p>
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
                          <Badge className="ml-auto text-[10px]">Selected</Badge>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={creating}>
                {creating ? 'Creating...' : 'Create Room'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {chatRooms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No Chat Rooms</h3>
            <p className="text-muted-foreground text-sm mb-4">Create a multi-agent chat room</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Create Room
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chatRooms.map((room: any) => (
            <Card key={room.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{room.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{room.isPublic ? 'Public' : 'Private'}</Badge>
                        {room.joinCode && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Hash className="w-3 h-3" /> {room.joinCode}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(room.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{room.description || 'No description'}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {room.members?.length || 0} members</span>
                  <span className="flex items-center gap-1"><Bot className="w-3 h-3" /> {room.agents?.length || 0} agents</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
