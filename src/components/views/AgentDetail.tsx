'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bot, ArrowLeft, Plus, Trash2, Link2, Puzzle, Cable, MessageSquare,
  Power, PowerOff, Settings, Copy, ExternalLink,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function AgentDetail() {
  const { agents, setAgents, selectedAgentId, providers, skills, setCurrentView } = useAppStore();
  const agent = agents.find((a: any) => a.id === selectedAgentId) || null;
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [showAddPlugin, setShowAddPlugin] = useState(false);
  const [connectionForm, setConnectionForm] = useState({ type: 'http', name: '', config: '{}' });
  const [pluginForm, setPluginForm] = useState({ name: '', description: '', type: 'webhook', endpoint: '', authType: 'none', authToken: '' });

  if (!agent) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <Bot className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Agent not found</p>
        <Button variant="outline" onClick={() => setCurrentView('agents')} className="mt-4 gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Agents
        </Button>
      </div>
    );
  }

  const handleInstallSkill = async (skillId: string) => {
    try {
      await api.installSkill(skillId, { agentId: agent.id });
      const result = await api.getAgents();
      setAgents(result.agents);
      toast.success('Skill installed');
      setShowAddSkill(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleRemoveSkill = async (skillId: string) => {
    try {
      await api.removeAgentSkill(agent.id, skillId);
      const result = await api.getAgents();
      setAgents(result.agents);
      toast.success('Skill removed');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddConnection = async () => {
    try {
      await api.createAgentConnection(agent.id, connectionForm);
      const result = await api.getAgents();
      setAgents(result.agents);
      toast.success('Connection added');
      setShowAddConnection(false);
      setConnectionForm({ type: 'http', name: '', config: '{}' });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    try {
      await api.deleteAgentConnection(agent.id, connectionId);
      const result = await api.getAgents();
      setAgents(result.agents);
      toast.success('Connection removed');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddPlugin = async () => {
    try {
      await api.createAgentPlugin(agent.id, pluginForm);
      const result = await api.getAgents();
      setAgents(result.agents);
      toast.success('Plugin added');
      setShowAddPlugin(false);
      setPluginForm({ name: '', description: '', type: 'webhook', endpoint: '', authType: 'none', authToken: '' });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeletePlugin = async (pluginId: string) => {
    try {
      await api.deleteAgentPlugin(agent.id, pluginId);
      const result = await api.getAgents();
      setAgents(result.agents);
      toast.success('Plugin removed');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleStartChat = async () => {
    try {
      const result = await api.createConversation({ agentId: agent.id });
      toast.success('Chat started');
      setCurrentView('chat');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const installedSkillIds = new Set((agent.skills || []).map((as: any) => as.skillId || as.skill?.id));
  const availableSkills = skills.filter((s: any) => !installedSkillIds.has(s.id));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setCurrentView('agents')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{agent.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">{agent.mode}</Badge>
            <div className={cn('w-2 h-2 rounded-full', agent.status === 'online' ? 'bg-emerald-500' : agent.status === 'error' ? 'bg-red-500' : 'bg-gray-300')} />
            <span className="text-xs text-muted-foreground capitalize">{agent.status}</span>
          </div>
        </div>
        <Button className="gap-2" onClick={handleStartChat}>
          <MessageSquare className="w-4 h-4" /> Chat
        </Button>
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="skills">Skills ({(agent.skills || []).length})</TabsTrigger>
          <TabsTrigger value="connections">Connections ({(agent.connections || []).length})</TabsTrigger>
          <TabsTrigger value="plugins">Plugins ({(agent.plugins || []).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Agent Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><span className="text-xs text-muted-foreground">Mode</span><p className="text-sm font-medium">{agent.mode}</p></div>
                <div><span className="text-xs text-muted-foreground">Provider</span><p className="text-sm font-medium">{agent.provider?.name || 'Default (z-ai)'}</p></div>
                <div><span className="text-xs text-muted-foreground">Model</span><p className="text-sm font-medium">{agent.model || agent.provider?.defaultModel || 'Default'}</p></div>
                <div><span className="text-xs text-muted-foreground">Temperature</span><p className="text-sm font-medium">{agent.temperature ?? 0.7}</p></div>
                <div><span className="text-xs text-muted-foreground">Max Tokens</span><p className="text-sm font-medium">{agent.maxTokens ?? 2048}</p></div>
                <div><span className="text-xs text-muted-foreground">Public</span><p className="text-sm font-medium">{agent.isPublic ? 'Yes' : 'No'}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">System Prompt</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {agent.systemPrompt || 'No system prompt configured'}
                </p>
              </CardContent>
            </Card>
            {agent.mode === 'custom_api' && (
              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-base">Custom API Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div><span className="text-xs text-muted-foreground">Callback URL</span><p className="text-sm font-medium font-mono">{agent.callbackUrl || 'Not set'}</p></div>
                  {agent.apiKey && (
                    <div>
                      <span className="text-xs text-muted-foreground">API Key</span>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono bg-accent px-2 py-0.5 rounded">hk_•••••••</code>
                        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => { navigator.clipboard.writeText(agent.apiKey); toast.success('Copied!'); }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="skills">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Installed Skills</CardTitle>
                <CardDescription>Skills extend agent capabilities with standardized actions</CardDescription>
              </div>
              <Dialog open={showAddSkill} onOpenChange={setShowAddSkill}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Add Skill</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Add Skill</DialogTitle></DialogHeader>
                  <ScrollArea className="max-h-96">
                    <div className="space-y-2">
                      {availableSkills.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">All skills are already installed</p>
                      ) : (
                        availableSkills.map((skill: any) => (
                          <div key={skill.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{skill.displayName}</p>
                              <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleInstallSkill(skill.id)}>Install</Button>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {(agent.skills || []).length === 0 ? (
                <div className="text-center py-8">
                  <Puzzle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No skills installed yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {agent.skills.map((as: any) => (
                    <div key={as.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Puzzle className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{as.skill?.displayName || 'Unknown Skill'}</p>
                          <p className="text-xs text-muted-foreground">{as.skill?.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={as.isEnabled} disabled />
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleRemoveSkill(as.skillId)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connections">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Connections</CardTitle>
                <CardDescription>Connect your agent to external services and protocols</CardDescription>
              </div>
              <Dialog open={showAddConnection} onOpenChange={setShowAddConnection}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Add Connection</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Connection</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Connection Type</Label>
                      <Select value={connectionForm.type} onValueChange={(v) => setConnectionForm({ ...connectionForm, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="http">HTTP Webhook</SelectItem>
                          <SelectItem value="hermes">Hermes Protocol</SelectItem>
                          <SelectItem value="websocket">WebSocket</SelectItem>
                          <SelectItem value="cli">CLI Client</SelectItem>
                          <SelectItem value="acp">ACP Protocol</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input placeholder="Connection name" value={connectionForm.name} onChange={(e) => setConnectionForm({ ...connectionForm, name: e.target.value })} />
                    </div>
                    <Button onClick={handleAddConnection} className="w-full">Add Connection</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {(agent.connections || []).length === 0 ? (
                <div className="text-center py-8">
                  <Cable className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No connections configured</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {agent.connections.map((conn: any) => (
                    <div key={conn.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                          conn.type === 'hermes' ? 'bg-cyan-500/10' : 'bg-violet-500/10'
                        )}>
                          <Link2 className={cn('w-4 h-4', conn.type === 'hermes' ? 'text-cyan-600' : 'text-violet-600')} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{conn.name || conn.type}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{conn.type}</Badge>
                            <span className={cn('text-[10px]', conn.status === 'connected' ? 'text-emerald-600' : 'text-muted-foreground')}>
                              {conn.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDeleteConnection(conn.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plugins">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Plugins</CardTitle>
                <CardDescription>Custom plugins inspired by Feishu/DingTalk bot pattern</CardDescription>
              </div>
              <Dialog open={showAddPlugin} onOpenChange={setShowAddPlugin}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Add Plugin</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Plugin</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Plugin Name *</Label>
                      <Input placeholder="e.g., Jira Integration" value={pluginForm.name} onChange={(e) => setPluginForm({ ...pluginForm, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input placeholder="What does this plugin do?" value={pluginForm.description} onChange={(e) => setPluginForm({ ...pluginForm, description: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Plugin Type</Label>
                      <Select value={pluginForm.type} onValueChange={(v) => setPluginForm({ ...pluginForm, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="webhook">Webhook</SelectItem>
                          <SelectItem value="function">Function</SelectItem>
                          <SelectItem value="hermes-protocol">Hermes Protocol</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Endpoint URL</Label>
                      <Input placeholder="https://api.example.com/plugin" value={pluginForm.endpoint} onChange={(e) => setPluginForm({ ...pluginForm, endpoint: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Auth Type</Label>
                      <Select value={pluginForm.authType} onValueChange={(v) => setPluginForm({ ...pluginForm, authType: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="api_key">API Key</SelectItem>
                          <SelectItem value="bearer">Bearer Token</SelectItem>
                          <SelectItem value="oauth">OAuth</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {pluginForm.authType !== 'none' && (
                      <div className="space-y-2">
                        <Label>Auth Token</Label>
                        <Input placeholder="Your auth token" value={pluginForm.authToken} onChange={(e) => setPluginForm({ ...pluginForm, authToken: e.target.value })} />
                      </div>
                    )}
                    <Button onClick={handleAddPlugin} className="w-full">Add Plugin</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {(agent.plugins || []).length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No plugins configured</p>
                  <p className="text-xs text-muted-foreground mt-1">Add plugins to extend your agent like Feishu/DingTalk bots</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {agent.plugins.map((plugin: any) => (
                    <div key={plugin.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Settings className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{plugin.name}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{plugin.type}</Badge>
                            <Badge variant="outline" className="text-[10px]">{plugin.authType || 'no auth'}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={plugin.isEnabled} disabled />
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDeletePlugin(plugin.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
