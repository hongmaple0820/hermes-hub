'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Bot, Plus, Trash2, Settings, Eye, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function AgentManager() {
  const { agents, setAgents, providers, setCurrentView, setSelectedAgentId } = useAppStore();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    mode: 'builtin',
    providerId: '',
    model: '',
    isPublic: false,
    temperature: 0.7,
    maxTokens: 2048,
    callbackUrl: '',
  });

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Agent name is required');
      return;
    }
    setCreating(true);
    try {
      const result = await api.createAgent({
        ...form,
        providerId: form.providerId || undefined,
        model: form.model || undefined,
        temperature: form.temperature,
        maxTokens: form.maxTokens,
      });
      setAgents([result.agent, ...agents]);
      setShowCreate(false);
      setForm({ name: '', description: '', systemPrompt: '', mode: 'builtin', providerId: '', model: '', isPublic: false, temperature: 0.7, maxTokens: 2048, callbackUrl: '' });
      toast.success('Agent created!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAgent(id);
      setAgents(agents.filter((a: any) => a.id !== id));
      toast.success('Agent deleted');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const modeLabels: Record<string, string> = {
    builtin: 'Built-in LLM',
    custom_api: 'Custom API',
    hermes: 'Hermes Agent',
  };

  const modeColors: Record<string, string> = {
    builtin: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    custom_api: 'bg-violet-500/10 text-violet-600 border-violet-200',
    hermes: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground text-sm">Create and manage your AI agents with multi-provider LLM support</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Agent Name *</Label>
                <Input placeholder="e.g., Code Assistant" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="What does this agent do?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Agent Mode</Label>
                <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="builtin">Built-in LLM (Use configured provider)</SelectItem>
                    <SelectItem value="custom_api">Custom API (Connect external service)</SelectItem>
                    <SelectItem value="hermes">Hermes Agent (Direct connection)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.mode === 'builtin' && (
                <>
                  <div className="space-y-2">
                    <Label>LLM Provider</Label>
                    <Select value={form.providerId} onValueChange={(v) => setForm({ ...form, providerId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select a provider" /></SelectTrigger>
                      <SelectContent>
                        {providers.length === 0 ? (
                          <SelectItem value="none" disabled>No providers configured</SelectItem>
                        ) : (
                          providers.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>{p.name} ({p.provider})</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {providers.length === 0 && (
                      <p className="text-xs text-amber-600">Please configure an LLM provider first</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Model Override (optional)</Label>
                    <Input placeholder="Leave empty to use provider default" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Temperature: {form.temperature}</Label>
                      <input type="range" min="0" max="2" step="0.1" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })} className="w-full" />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Tokens</Label>
                      <Input type="number" value={form.maxTokens} onChange={(e) => setForm({ ...form, maxTokens: parseInt(e.target.value) || 2048 })} />
                    </div>
                  </div>
                </>
              )}

              {form.mode === 'custom_api' && (
                <div className="space-y-2">
                  <Label>Callback URL *</Label>
                  <Input placeholder="https://your-api.com/callback" value={form.callbackUrl} onChange={(e) => setForm({ ...form, callbackUrl: e.target.value })} />
                </div>
              )}

              <div className="space-y-2">
                <Label>System Prompt</Label>
                <Textarea placeholder="Instructions for the agent..." value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} rows={4} />
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={form.isPublic} onCheckedChange={(v) => setForm({ ...form, isPublic: v })} />
                <Label>Make agent public (discoverable)</Label>
              </div>

              <Button onClick={handleCreate} className="w-full" disabled={creating}>
                {creating ? 'Creating...' : 'Create Agent'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {agents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No Agents Yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your first AI agent to get started</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Create Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent: any) => (
            <Card key={agent.id} className="hover:shadow-md transition-all group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{agent.name}</CardTitle>
                      <Badge variant="outline" className={cn('text-[10px] mt-1', modeColors[agent.mode])}>
                        {modeLabels[agent.mode]}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      agent.status === 'online' ? 'bg-emerald-500' :
                      agent.status === 'error' ? 'bg-red-500' :
                      agent.status === 'busy' ? 'bg-amber-500' : 'bg-gray-300'
                    )} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setSelectedAgentId(agent.id); setCurrentView('agent-detail'); }}>
                          <Eye className="w-4 h-4 mr-2" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(agent.id)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {agent.description || 'No description'}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {agent.provider && <span>{agent.provider.name}</span>}
                    {agent.model && <span>· {agent.model}</span>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => { setSelectedAgentId(agent.id); setCurrentView('agent-detail'); }}
                  >
                    <Settings className="w-3 h-3" /> Configure
                  </Button>
                </div>
                {/* Skills & Connections indicators */}
                {(agent.skills?.length > 0 || agent.connections?.length > 0) && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                    {agent.skills?.length > 0 && (
                      <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                        {agent.skills.length} skill{agent.skills.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {agent.connections?.length > 0 && (
                      <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                        {agent.connections.length} connection{agent.connections.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
