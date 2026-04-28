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
import { useI18n } from '@/i18n';

export function AgentDetail() {
  const { agents, setAgents, selectedAgentId, providers, skills, setCurrentView } = useAppStore();
  const { t } = useI18n();
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
        <p className="text-muted-foreground">{t('agentDetail.notFound')}</p>
        <Button variant="outline" onClick={() => setCurrentView('agents')} className="mt-4 gap-2">
          <ArrowLeft className="w-4 h-4" /> {t('agentDetail.backToAgents')}
        </Button>
      </div>
    );
  }

  const handleInstallSkill = async (skillId: string) => {
    try {
      await api.installSkill(skillId, { agentId: agent.id });
      const result = await api.getAgents();
      setAgents(result.agents);
      toast.success(t('agentDetail.skillInstalled'));
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
      toast.success(t('agentDetail.skillRemoved'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddConnection = async () => {
    try {
      await api.createAgentConnection(agent.id, connectionForm);
      const result = await api.getAgents();
      setAgents(result.agents);
      toast.success(t('agentDetail.connectionAdded'));
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
      toast.success(t('agentDetail.connectionRemoved'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddPlugin = async () => {
    try {
      await api.createAgentPlugin(agent.id, pluginForm);
      const result = await api.getAgents();
      setAgents(result.agents);
      toast.success(t('agentDetail.pluginAdded'));
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
      toast.success(t('agentDetail.pluginRemoved'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleStartChat = async () => {
    try {
      const result = await api.createConversation({ agentId: agent.id });
      toast.success(t('agentDetail.chatStarted'));
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
          <TabsTrigger value="skills">{t('agentDetail.installedSkills')} ({(agent.skills || []).length})</TabsTrigger>
          <TabsTrigger value="connections">{t('agentDetail.connections')} ({(agent.connections || []).length})</TabsTrigger>
          <TabsTrigger value="plugins">{t('agentDetail.plugins')} ({(agent.plugins || []).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">{t('agentDetail.configuration')}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><span className="text-xs text-muted-foreground">{t('agentDetail.mode')}</span><p className="text-sm font-medium">{agent.mode}</p></div>
                <div><span className="text-xs text-muted-foreground">{t('agentDetail.provider')}</span><p className="text-sm font-medium">{agent.provider?.name || t('agentDetail.defaultProvider')}</p></div>
                <div><span className="text-xs text-muted-foreground">{t('agentDetail.model')}</span><p className="text-sm font-medium">{agent.model || agent.provider?.defaultModel || t('agentDetail.default')}</p></div>
                <div><span className="text-xs text-muted-foreground">Temperature</span><p className="text-sm font-medium">{agent.temperature ?? 0.7}</p></div>
                <div><span className="text-xs text-muted-foreground">Max Tokens</span><p className="text-sm font-medium">{agent.maxTokens ?? 2048}</p></div>
                <div><span className="text-xs text-muted-foreground">{t('agentDetail.public')}</span><p className="text-sm font-medium">{agent.isPublic ? 'Yes' : 'No'}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">{t('agentDetail.systemPrompt')}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {agent.systemPrompt || t('agentDetail.noSystemPrompt')}
                </p>
              </CardContent>
            </Card>
            {agent.mode === 'custom_api' && (
              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-base">{t('agentDetail.customApiConfig')}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div><span className="text-xs text-muted-foreground">{t('agentDetail.callbackUrlLabel')}</span><p className="text-sm font-medium font-mono">{agent.callbackUrl || t('agentDetail.notSet')}</p></div>
                  {agent.apiKey && (
                    <div>
                      <span className="text-xs text-muted-foreground">{t('agentDetail.apiKey')}</span>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono bg-accent px-2 py-0.5 rounded">hk_•••••••</code>
                        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => { navigator.clipboard.writeText(agent.apiKey); toast.success(t('common.copied')); }}>
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
                <CardTitle className="text-base">{t('agentDetail.installedSkills')}</CardTitle>
                <CardDescription>{t('agentDetail.installedSkillsDesc')}</CardDescription>
              </div>
              <Dialog open={showAddSkill} onOpenChange={setShowAddSkill}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> {t('agentDetail.addSkill')}</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>{t('agentDetail.addSkill')}</DialogTitle></DialogHeader>
                  <ScrollArea className="max-h-96">
                    <div className="space-y-2">
                      {availableSkills.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">{t('agentDetail.allSkillsInstalled')}</p>
                      ) : (
                        availableSkills.map((skill: any) => (
                          <div key={skill.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{skill.displayName}</p>
                              <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleInstallSkill(skill.id)}>{t('common.install')}</Button>
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
                  <p className="text-sm text-muted-foreground">{t('agentDetail.noSkills')}</p>
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
                <CardTitle className="text-base">{t('agentDetail.connections')}</CardTitle>
                <CardDescription>{t('agentDetail.connectionsDesc')}</CardDescription>
              </div>
              <Dialog open={showAddConnection} onOpenChange={setShowAddConnection}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> {t('agentDetail.addConnection')}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t('agentDetail.addConnection')}</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>{t('agentDetail.connectionType')}</Label>
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
                      <Label>{t('agentDetail.connectionName')}</Label>
                      <Input placeholder={t('agentDetail.connectionNamePlaceholder')} value={connectionForm.name} onChange={(e) => setConnectionForm({ ...connectionForm, name: e.target.value })} />
                    </div>
                    <Button onClick={handleAddConnection} className="w-full">{t('agentDetail.addConnection')}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {(agent.connections || []).length === 0 ? (
                <div className="text-center py-8">
                  <Cable className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('agentDetail.noConnections')}</p>
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
                <CardTitle className="text-base">{t('agentDetail.plugins')}</CardTitle>
                <CardDescription>{t('agentDetail.pluginsDesc')}</CardDescription>
              </div>
              <Dialog open={showAddPlugin} onOpenChange={setShowAddPlugin}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> {t('agentDetail.addPlugin')}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t('agentDetail.addPlugin')}</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>{t('agentDetail.pluginName')} *</Label>
                      <Input placeholder={t('agentDetail.pluginNamePlaceholder')} value={pluginForm.name} onChange={(e) => setPluginForm({ ...pluginForm, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('agentDetail.pluginDesc')}</Label>
                      <Input placeholder={t('agentDetail.pluginDescPlaceholder')} value={pluginForm.description} onChange={(e) => setPluginForm({ ...pluginForm, description: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('agentDetail.pluginType')}</Label>
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
                      <Label>{t('agentDetail.pluginEndpoint')}</Label>
                      <Input placeholder={t('agentDetail.pluginEndpointPlaceholder')} value={pluginForm.endpoint} onChange={(e) => setPluginForm({ ...pluginForm, endpoint: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('agentDetail.pluginAuthType')}</Label>
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
                        <Label>{t('agentDetail.pluginAuthToken')}</Label>
                        <Input placeholder={t('agentDetail.pluginAuthToken')} value={pluginForm.authToken} onChange={(e) => setPluginForm({ ...pluginForm, authToken: e.target.value })} />
                      </div>
                    )}
                    <Button onClick={handleAddPlugin} className="w-full">{t('agentDetail.addPlugin')}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {(agent.plugins || []).length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('agentDetail.noPlugins')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('agentDetail.noPluginsHint')}</p>
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
