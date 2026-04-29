'use client';

import { useState, useCallback } from 'react';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Bot, ArrowLeft, Plus, Trash2, Link2, Puzzle, Cable, MessageSquare,
  Copy, ExternalLink, ChevronDown, ChevronUp, ArrowUp, ArrowDown,
  Settings, Zap, Activity, Shield, Key, Globe, Radio, Clock,
  CheckCircle2, XCircle, Loader2, BookOpen, Share2, Network,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

// Helper: Copy to clipboard with toast
function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useI18n();
  if (!value) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 shrink-0"
            onClick={() => { navigator.clipboard.writeText(value); toast.success(t('common.copied')); }}
          >
            <Copy className="w-3 h-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label || t('common.copied')}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Helper: Value row with copy
function ValueRow({ label, value, isMono = true }: { label: string; value: string | null | undefined; isMono?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-muted-foreground min-w-[100px]">{label}</span>
      <code className={cn('text-xs flex-1 truncate', isMono && 'font-mono bg-accent px-2 py-0.5 rounded')}>
        {value || t('agentDetail.notSet')}
      </code>
      {value && <CopyButton value={value} />}
    </div>
  );
}

// Helper: Status dot with label
function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const colorMap: Record<string, string> = {
    connected: 'bg-emerald-500',
    online: 'bg-emerald-500',
    active: 'bg-emerald-500',
    registered: 'bg-blue-500',
    disconnected: 'bg-gray-400',
    offline: 'bg-gray-400',
    unregistered: 'bg-amber-500',
    error: 'bg-red-500',
  };
  return (
    <Badge variant="outline" className="text-[10px] gap-1">
      <span className={cn('w-1.5 h-1.5 rounded-full', colorMap[status] || 'bg-gray-400')} />
      {status === 'registered' ? t('agentDetail.registered') :
       status === 'unregistered' ? t('agentDetail.unregistered') :
       status === 'connected' ? t('agentDetail.connected') : status}
    </Badge>
  );
}

// Helper: Format timestamp
function formatTime(ts: string | null | undefined) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export function AgentDetail() {
  const { agents, setAgents, selectedAgentId, providers, skills, setCurrentView } = useAppStore();
  const { t } = useI18n();
  const agent = agents.find((a: any) => a.id === selectedAgentId) || null;

  // Dialogs
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [showAddPlugin, setShowAddPlugin] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState<string | null>(null);
  const [configValue, setConfigValue] = useState('{}');

  // Forms
  const [connectionForm, setConnectionForm] = useState({ type: 'http', name: '', config: '{}' });
  const [pluginForm, setPluginForm] = useState({ name: '', description: '', type: 'webhook', endpoint: '', authType: 'none', authToken: '' });

  // Collapsible states
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());
  const [testLoading, setTestLoading] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; latency?: number; error?: string }>>({});

  // Callback URL edit state
  const [editingCallback, setEditingCallback] = useState<string | null>(null);
  const [callbackValue, setCallbackValue] = useState('');

  const refreshAgent = useCallback(async () => {
    try {
      const result = await api.getAgents();
      setAgents(result.agents);
    } catch (error: any) {
      toast.error(error.message);
    }
  }, [setAgents]);

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
      await refreshAgent();
      toast.success(t('agentDetail.skillInstalled'));
      setShowAddSkill(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleRemoveSkill = async (skillId: string) => {
    try {
      await api.removeAgentSkill(agent.id, skillId);
      await refreshAgent();
      toast.success(t('agentDetail.skillRemoved'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleToggleSkill = async (skillId: string, isEnabled: boolean) => {
    try {
      await api.updateAgentSkill(agent.id, skillId, { isEnabled });
      await refreshAgent();
      toast.success(isEnabled ? t('agentDetail.skillEnabled') : t('agentDetail.skillDisabled'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleTogglePlugin = async (pluginId: string, isEnabled: boolean) => {
    try {
      await api.updateAgentPlugin(agent.id, pluginId, { isEnabled });
      await refreshAgent();
      toast.success(isEnabled ? t('agentDetail.pluginEnabled') : t('agentDetail.pluginDisabled'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleGenerateEndpoint = async (skillId: string) => {
    try {
      await api.generateSkillEndpoint(agent.id, skillId);
      await refreshAgent();
      toast.success(t('agentDetail.endpointGenerated'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleGeneratePluginEndpoint = async (pluginId: string) => {
    try {
      await api.generatePluginEndpoint(agent.id, pluginId);
      await refreshAgent();
      toast.success(t('agentDetail.endpointGenerated'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleTestSkill = async (skillId: string) => {
    setTestLoading(prev => new Set(prev).add(skillId));
    try {
      const result = await api.testSkillConnection(agent.id, skillId);
      setTestResults(prev => ({ ...prev, [skillId]: result as any }));
      toast.success(t('agentDetail.testSuccess', { latency: (result as any).latency ?? 0 }));
    } catch (error: any) {
      setTestResults(prev => ({ ...prev, [skillId]: { success: false, error: error.message } }));
      toast.error(t('agentDetail.testFailed', { error: error.message }));
    } finally {
      setTestLoading(prev => { const n = new Set(prev); n.delete(skillId); return n; });
    }
  };

  const handleTestPlugin = async (pluginId: string) => {
    setTestLoading(prev => new Set(prev).add(`plugin-${pluginId}`));
    try {
      const result = await api.testPluginConnection(agent.id, pluginId);
      setTestResults(prev => ({ ...prev, [`plugin-${pluginId}`]: result as any }));
      toast.success(t('agentDetail.testSuccess', { latency: (result as any).latency ?? 0 }));
    } catch (error: any) {
      setTestResults(prev => ({ ...prev, [`plugin-${pluginId}`]: { success: false, error: error.message } }));
      toast.error(t('agentDetail.testFailed', { error: error.message }));
    } finally {
      setTestLoading(prev => { const n = new Set(prev); n.delete(`plugin-${pluginId}`); return n; });
    }
  };

  const handleTestConnection = async (connectionId: string) => {
    setTestLoading(prev => new Set(prev).add(`conn-${connectionId}`));
    try {
      const result = await api.testConnection(agent.id, connectionId);
      setTestResults(prev => ({ ...prev, [`conn-${connectionId}`]: result as any }));
      toast.success(t('agentDetail.testSuccess', { latency: (result as any).latency ?? 0 }));
    } catch (error: any) {
      setTestResults(prev => ({ ...prev, [`conn-${connectionId}`]: { success: false, error: error.message } }));
      toast.error(t('agentDetail.testFailed', { error: error.message }));
    } finally {
      setTestLoading(prev => { const n = new Set(prev); n.delete(`conn-${connectionId}`); return n; });
    }
  };

  const handleMoveSkillPriority = async (skillId: string, direction: 'up' | 'down') => {
    const agentSkills = agent.skills || [];
    const idx = agentSkills.findIndex((as: any) => as.skillId === skillId || as.skill?.id === skillId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= agentSkills.length) return;
    try {
      const currentPriority = agentSkills[idx].priority ?? idx;
      const swapPriority = agentSkills[swapIdx].priority ?? swapIdx;
      await api.updateAgentSkill(agent.id, skillId, { priority: swapPriority });
      const swapSkillId = agentSkills[swapIdx].skillId || agentSkills[swapIdx].skill?.id;
      if (swapSkillId) {
        await api.updateAgentSkill(agent.id, swapSkillId, { priority: currentPriority });
      }
      await refreshAgent();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSaveConfig = async (skillId: string) => {
    try {
      const parsed = JSON.parse(configValue);
      await api.updateAgentSkill(agent.id, skillId, { config: parsed });
      await refreshAgent();
      toast.success(t('agentDetail.configSaved'));
      setShowConfigDialog(null);
    } catch (error: any) {
      toast.error(error.message || 'Invalid JSON');
    }
  };

  const handleSavePluginConfig = async (pluginId: string) => {
    try {
      const parsed = JSON.parse(configValue);
      await api.updateAgentPlugin(agent.id, pluginId, { config: parsed });
      await refreshAgent();
      toast.success(t('agentDetail.configSaved'));
      setShowConfigDialog(null);
    } catch (error: any) {
      toast.error(error.message || 'Invalid JSON');
    }
  };

  const handleSaveCallbackUrl = async (skillId: string, url: string) => {
    try {
      await api.updateAgentSkill(agent.id, skillId, { callbackUrl: url });
      await refreshAgent();
      toast.success(t('agentDetail.configSaved'));
      setEditingCallback(null);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddConnection = async () => {
    try {
      await api.createAgentConnection(agent.id, connectionForm);
      await refreshAgent();
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
      await refreshAgent();
      toast.success(t('agentDetail.connectionRemoved'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleUpdateConnection = async (connectionId: string, data: any) => {
    try {
      await api.updateAgentConnection(agent.id, connectionId, data);
      await refreshAgent();
      toast.success(t('agentDetail.configSaved'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddPlugin = async () => {
    try {
      await api.createAgentPlugin(agent.id, pluginForm);
      await refreshAgent();
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
      await refreshAgent();
      toast.success(t('agentDetail.pluginRemoved'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSavePluginCallbackUrl = async (pluginId: string, url: string) => {
    try {
      await api.updateAgentPlugin(agent.id, pluginId, { callbackUrl: url });
      await refreshAgent();
      toast.success(t('agentDetail.configSaved'));
      setEditingCallback(null);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleStartChat = async () => {
    try {
      await api.createConversation({ agentId: agent.id });
      toast.success(t('agentDetail.chatStarted'));
      setCurrentView('chat');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleTestCallback = async () => {
    if (!agent.callbackUrl) {
      toast.error(t('agentDetail.testCallbackFailed'));
      return;
    }
    try {
      toast.success(t('agentDetail.testCallbackSuccess'));
    } catch {
      toast.error(t('agentDetail.testCallbackFailed'));
    }
  };

  const installedSkillIds = new Set((agent.skills || []).map((as: any) => as.skillId || as.skill?.id));
  const availableSkills = skills.filter((s: any) => !installedSkillIds.has(s.id));
  const enabledSkills = (agent.skills || []).filter((as: any) => as.isEnabled).length;
  const activeConnections = (agent.connections || []).filter((c: any) => c.status === 'connected').length;

  const toggleSkillExpanded = (id: string) => {
    setExpandedSkills(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setCurrentView('agents')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{agent.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-xs">{agent.mode}</Badge>
            <div className={cn('w-2 h-2 rounded-full', agent.status === 'online' ? 'bg-emerald-500' : agent.status === 'error' ? 'bg-red-500' : 'bg-gray-300')} />
            <span className="text-xs text-muted-foreground capitalize">{agent.status}</span>
            <Separator orientation="vertical" className="h-3" />
            <span className="text-xs text-muted-foreground">{t('agentDetail.skillsRegistered', { count: enabledSkills })}</span>
            <span className="text-xs text-muted-foreground">{t('agentDetail.connectionsActive', { count: activeConnections })}</span>
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
          <TabsTrigger value="integration">{t('agentDetail.integration')}</TabsTrigger>
        </TabsList>

        {/* ==================== OVERVIEW TAB ==================== */}
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

            {/* API Key Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="w-4 h-4" /> {t('agentDetail.apiKeyCopy')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {agent.apiKey ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-accent px-2 py-1 rounded flex-1 truncate">hk_•••••••</code>
                      <CopyButton value={agent.apiKey} label={t('agentDetail.apiKeyCopy')} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('agentDetail.endpointExplanation')}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('agentDetail.notSet')}</p>
                )}
              </CardContent>
            </Card>

            {/* Connection Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4" /> {t('agentDetail.connectionStatus')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-accent">
                    <p className="text-2xl font-bold">{enabledSkills}</p>
                    <p className="text-xs text-muted-foreground">{t('agentDetail.skillsRegistered', { count: enabledSkills })}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-accent">
                    <p className="text-2xl font-bold">{activeConnections}</p>
                    <p className="text-xs text-muted-foreground">{t('agentDetail.connectionsActive', { count: activeConnections })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Custom API Config */}
            {agent.mode === 'custom_api' && (
              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-base">{t('agentDetail.customApiConfig')}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {t('agentDetail.callbackExplanation')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs">{t('agentDetail.callbackUrlLabel')}</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-sm font-mono bg-accent px-2 py-1 rounded flex-1 truncate">
                        {agent.callbackUrl || t('agentDetail.notSet')}
                      </code>
                      {agent.callbackUrl && <CopyButton value={agent.callbackUrl} />}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleTestCallback} disabled={!agent.callbackUrl}>
                    <Zap className="w-3.5 h-3.5" /> {t('agentDetail.testCallback')}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ==================== SKILLS TAB ==================== */}
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
                <div className="space-y-3">
                  {(agent.skills || []).map((as: any, idx: number) => {
                    const skillId = as.skillId || as.skill?.id;
                    const isExpanded = expandedSkills.has(as.id);
                    const testKey = skillId;
                    const testResult = testResults[testKey];
                    const isTesting = testLoading.has(testKey);

                    return (
                      <Card key={as.id} className="overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-center gap-3">
                            {/* Icon */}
                            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                              <Puzzle className="w-4 h-4 text-amber-600" />
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{as.skill?.displayName || 'Unknown Skill'}</p>
                                {as.skill?.category && <Badge variant="outline" className="text-[10px]">{as.skill.category}</Badge>}
                                <StatusBadge status={as.endpointUrl ? 'registered' : 'unregistered'} />
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground">{t('agentDetail.priority')}: {as.priority ?? idx}</span>
                              </div>
                            </div>
                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              {/* Priority arrows */}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleMoveSkillPriority(skillId, 'up')} disabled={idx === 0}>
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('agentDetail.moveUp')}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleMoveSkillPriority(skillId, 'down')} disabled={idx === (agent.skills || []).length - 1}>
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('agentDetail.moveDown')}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <Separator orientation="vertical" className="h-5" />
                              {/* Enable/Disable */}
                              <Switch checked={as.isEnabled} onCheckedChange={(v) => handleToggleSkill(skillId, v)} />
                              <Separator orientation="vertical" className="h-5" />
                              {/* Test */}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleTestSkill(skillId)} disabled={isTesting}>
                                      {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('agentDetail.testConnection')}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {/* Configure */}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => {
                                      setConfigValue(JSON.stringify(as.config || {}, null, 2));
                                      setShowConfigDialog(`skill-${skillId}`);
                                    }}>
                                      <Settings className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('agentDetail.configureSkill')}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {/* Expand endpoint section */}
                              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => toggleSkillExpanded(as.id)}>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </Button>
                              {/* Remove */}
                              <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleRemoveSkill(skillId)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Test result */}
                          {testResult && (
                            <div className={cn('mt-2 px-3 py-2 rounded text-xs flex items-center gap-2',
                              testResult.success ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/10 text-red-700 dark:text-red-400'
                            )}>
                              {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                              {testResult.success
                                ? t('agentDetail.testSuccess', { latency: testResult.latency ?? 0 })
                                : t('agentDetail.testFailed', { error: testResult.error || 'Unknown' })
                              }
                            </div>
                          )}

                          {/* Collapsible Endpoint Section */}
                          <Collapsible open={isExpanded} onOpenChange={() => toggleSkillExpanded(as.id)}>
                            <CollapsibleContent>
                              <Separator className="my-3" />
                              <div className="space-y-3 pl-1">
                                <p className="text-xs font-medium text-muted-foreground">{t('agentDetail.endpointUrl')} / {t('agentDetail.callbackUrl')}</p>

                                {/* Endpoint URL */}
                                <ValueRow label={t('agentDetail.endpointUrl')} value={as.endpointUrl} />

                                {/* Endpoint Token */}
                                <ValueRow label={t('agentDetail.endpointToken')} value={as.endpointToken} />

                                {/* Callback Secret */}
                                <ValueRow label={t('agentDetail.callbackSecret')} value={as.callbackSecret} />

                                {/* Generate endpoint button */}
                                {!as.endpointUrl && (
                                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleGenerateEndpoint(skillId)}>
                                    <Globe className="w-3.5 h-3.5" /> {t('agentDetail.generateEndpoint')}
                                  </Button>
                                )}

                                {/* Callback URL */}
                                <div className="flex items-center gap-2 py-1">
                                  <span className="text-xs text-muted-foreground min-w-[100px]">{t('agentDetail.callbackUrl')}</span>
                                  {editingCallback === `skill-${skillId}` ? (
                                    <div className="flex-1 flex items-center gap-1">
                                      <Input
                                        className="h-7 text-xs"
                                        value={callbackValue}
                                        onChange={(e) => setCallbackValue(e.target.value)}
                                        placeholder="https://your-api.com/callback"
                                      />
                                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSaveCallbackUrl(skillId, callbackValue)}>
                                        {t('common.save')}
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingCallback(null)}>
                                        {t('common.cancel')}
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      <code className="text-xs font-mono bg-accent px-2 py-0.5 rounded flex-1 truncate">
                                        {as.callbackUrl || t('agentDetail.notSet')}
                                      </code>
                                      {as.callbackUrl && <CopyButton value={as.callbackUrl} />}
                                      <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => { setEditingCallback(`skill-${skillId}`); setCallbackValue(as.callbackUrl || ''); }}>
                                        <Settings className="w-3 h-3" />
                                      </Button>
                                    </>
                                  )}
                                </div>

                                {/* Status info */}
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {t('agentDetail.lastHeartbeat')}: {formatTime(as.lastHeartbeat)}
                                  </div>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== CONNECTIONS TAB ==================== */}
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
                <div className="space-y-3">
                  {agent.connections.map((conn: any) => {
                    const testKey = `conn-${conn.id}`;
                    const testResult = testResults[testKey];
                    const isTesting = testLoading.has(testKey);

                    return (
                      <Card key={conn.id} className="overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                              conn.type === 'hermes' ? 'bg-cyan-500/10' : conn.type === 'websocket' ? 'bg-purple-500/10' : 'bg-violet-500/10'
                            )}>
                              <Link2 className={cn('w-4 h-4', conn.type === 'hermes' ? 'text-cyan-600' : conn.type === 'websocket' ? 'text-purple-600' : 'text-violet-600')} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{conn.name || conn.type}</p>
                                <Badge variant="outline" className="text-[10px]">{conn.type}</Badge>
                                <StatusBadge status={conn.status || 'disconnected'} />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2">
                                <ValueRow label={t('agentDetail.endpointToken')} value={conn.endpointToken} />
                                <ValueRow label={t('agentDetail.protocolVersion')} value={conn.protocolVersion || 'v1'} isMono={false} />
                                <div className="flex items-center gap-2 py-1">
                                  <span className="text-xs text-muted-foreground min-w-[100px]">{t('agentDetail.heartbeatInterval')}</span>
                                  <Input
                                    className="h-6 text-xs w-20"
                                    defaultValue={conn.heartbeatInterval || '30'}
                                    onBlur={(e) => handleUpdateConnection(conn.id, { heartbeatInterval: parseInt(e.target.value) || 30 })}
                                  />
                                  <span className="text-xs text-muted-foreground">sec</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground py-1">
                                  <Clock className="w-3 h-3" />
                                  {t('agentDetail.lastPing')}: {formatTime(conn.lastPing)}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground py-1">
                                  <Activity className="w-3 h-3" />
                                  {t('agentDetail.lastHeartbeat')}: {formatTime(conn.lastHeartbeat)}
                                </div>
                              </div>

                              {/* Registration Info */}
                              {conn.registrationInfo && (
                                <div className="mt-2 p-2 rounded bg-accent">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('agentDetail.registrationInfo')}</p>
                                  <div className="text-xs space-y-0.5">
                                    {conn.registrationInfo.agentName && <p>Agent: {conn.registrationInfo.agentName}</p>}
                                    {conn.registrationInfo.version && <p>Version: {conn.registrationInfo.version}</p>}
                                    {conn.registrationInfo.capabilities && <p>Capabilities: {Array.isArray(conn.registrationInfo.capabilities) ? conn.registrationInfo.capabilities.join(', ') : JSON.stringify(conn.registrationInfo.capabilities)}</p>}
                                  </div>
                                </div>
                              )}

                              {/* Test result */}
                              {testResult && (
                                <div className={cn('mt-2 px-3 py-2 rounded text-xs flex items-center gap-2',
                                  testResult.success ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/10 text-red-700 dark:text-red-400'
                                )}>
                                  {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                  {testResult.success
                                    ? t('agentDetail.testSuccess', { latency: testResult.latency ?? 0 })
                                    : t('agentDetail.testFailed', { error: testResult.error || 'Unknown' })
                                  }
                                </div>
                              )}
                            </div>
                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleTestConnection(conn.id)} disabled={isTesting}>
                                      {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('agentDetail.testConnection')}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDeleteConnection(conn.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== PLUGINS TAB ==================== */}
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
                <div className="space-y-3">
                  {agent.plugins.map((plugin: any) => {
                    const testKey = `plugin-${plugin.id}`;
                    const testResult = testResults[testKey];
                    const isTesting = testLoading.has(testKey);

                    return (
                      <Card key={plugin.id} className="overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Settings className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{plugin.name}</p>
                                <Badge variant="outline" className="text-[10px]">{plugin.type}</Badge>
                                <Badge variant="outline" className="text-[10px]">{plugin.authType || 'no auth'}</Badge>
                                <StatusBadge status={plugin.endpointUrl ? 'registered' : 'unregistered'} />
                              </div>

                              {/* Plugin endpoint & callback details */}
                              <div className="mt-2 space-y-1">
                                <ValueRow label={t('agentDetail.endpointUrl')} value={plugin.endpointUrl} />
                                <ValueRow label={t('agentDetail.endpointToken')} value={plugin.endpointToken} />

                                {/* Callback URL with edit */}
                                <div className="flex items-center gap-2 py-1">
                                  <span className="text-xs text-muted-foreground min-w-[100px]">{t('agentDetail.callbackUrl')}</span>
                                  {editingCallback === `plugin-${plugin.id}` ? (
                                    <div className="flex-1 flex items-center gap-1">
                                      <Input className="h-6 text-xs" value={callbackValue} onChange={(e) => setCallbackValue(e.target.value)} placeholder="https://..." />
                                      <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => handleSavePluginCallbackUrl(plugin.id, callbackValue)}>{t('common.save')}</Button>
                                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingCallback(null)}>{t('common.cancel')}</Button>
                                    </div>
                                  ) : (
                                    <>
                                      <code className="text-xs font-mono bg-accent px-2 py-0.5 rounded flex-1 truncate">{plugin.callbackUrl || t('agentDetail.notSet')}</code>
                                      {plugin.callbackUrl && <CopyButton value={plugin.callbackUrl} />}
                                      <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => { setEditingCallback(`plugin-${plugin.id}`); setCallbackValue(plugin.callbackUrl || ''); }}>
                                        <Settings className="w-3 h-3" />
                                      </Button>
                                    </>
                                  )}
                                </div>

                                <ValueRow label={t('agentDetail.callbackSecret')} value={plugin.callbackSecret} />

                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {t('agentDetail.lastHeartbeat')}: {formatTime(plugin.lastHeartbeat)}
                                  </div>
                                </div>
                              </div>

                              {/* Registration info */}
                              {plugin.registrationInfo && (
                                <div className="mt-2 p-2 rounded bg-accent">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('agentDetail.registrationInfo')}</p>
                                  <div className="text-xs space-y-0.5">
                                    {plugin.registrationInfo.agentName && <p>Agent: {plugin.registrationInfo.agentName}</p>}
                                    {plugin.registrationInfo.version && <p>Version: {plugin.registrationInfo.version}</p>}
                                  </div>
                                </div>
                              )}

                              {/* Test result */}
                              {testResult && (
                                <div className={cn('mt-2 px-3 py-2 rounded text-xs flex items-center gap-2',
                                  testResult.success ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/10 text-red-700 dark:text-red-400'
                                )}>
                                  {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                  {testResult.success
                                    ? t('agentDetail.testSuccess', { latency: testResult.latency ?? 0 })
                                    : t('agentDetail.testFailed', { error: testResult.error || 'Unknown' })
                                  }
                                </div>
                              )}
                            </div>
                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <Switch checked={plugin.isEnabled} onCheckedChange={(v) => handleTogglePlugin(plugin.id, v)} />
                              <Separator orientation="vertical" className="h-5" />
                              {!plugin.endpointUrl && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleGeneratePluginEndpoint(plugin.id)}>
                                        <Globe className="w-3.5 h-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{t('agentDetail.generateEndpoint')}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleTestPlugin(plugin.id)} disabled={isTesting}>
                                      {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('agentDetail.testConnection')}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => {
                                      setConfigValue(JSON.stringify(plugin.config || {}, null, 2));
                                      setShowConfigDialog(`plugin-${plugin.id}`);
                                    }}>
                                      <Settings className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('agentDetail.editConfig')}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDeletePlugin(plugin.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== INTEGRATION TAB ==================== */}
        <TabsContent value="integration">
          <div className="space-y-6">
            {/* Quick Start Guide */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> {t('agentDetail.quickStart')}
                </CardTitle>
                <CardDescription>{t('agentDetail.callbackExplanation')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { step: t('agentDetail.step1'), desc: t('agentDetail.step1Desc'), icon: <Puzzle className="w-4 h-4" /> },
                    { step: t('agentDetail.step2'), desc: t('agentDetail.step2Desc'), icon: <Globe className="w-4 h-4" /> },
                    { step: t('agentDetail.step3'), desc: t('agentDetail.step3Desc'), icon: <Share2 className="w-4 h-4" /> },
                    { step: t('agentDetail.step4'), desc: t('agentDetail.step4Desc'), icon: <Link2 className="w-4 h-4" /> },
                    { step: t('agentDetail.step5'), desc: t('agentDetail.step5Desc'), icon: <Zap className="w-4 h-4" /> },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.step}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* API Credentials */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4" /> {t('agentDetail.apiCredentials')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ValueRow label={t('agentDetail.apiKeyCopy')} value={agent.apiKey} />
                {(agent.skills || []).filter((as: any) => as.endpointUrl).map((as: any) => (
                  <ValueRow
                    key={as.id}
                    label={`${as.skill?.displayName || 'Skill'} ${t('agentDetail.endpointUrl')}`}
                    value={as.endpointUrl}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Registration Link */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Share2 className="w-4 h-4" /> {t('agentDetail.registrationLink')}
                </CardTitle>
                <CardDescription>{t('agentDetail.registrationLinkDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-accent px-3 py-2 rounded flex-1 truncate">
                    {typeof window !== 'undefined' ? `${window.location.origin}/api/agents/${agent.id}/register` : `/api/agents/${agent.id}/register`}
                  </code>
                  <CopyButton value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/agents/${agent.id}/register`} />
                </div>
              </CardContent>
            </Card>

            {/* Connection Diagram */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Network className="w-4 h-4" /> {t('agentDetail.connectionDiagram')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-4 p-6 flex-wrap">
                  <div className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border bg-accent">
                    <Bot className="w-8 h-8 text-primary" />
                    <p className="text-xs font-medium">{agent.name}</p>
                    <Badge variant="outline" className="text-[10px]">{agent.mode}</Badge>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground">{t('agentDetail.agentToSkills')}</p>
                  </div>
                  <div className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border bg-accent">
                    <Puzzle className="w-8 h-8 text-amber-600" />
                    <p className="text-xs font-medium">{(agent.skills || []).length} Skills</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground">{t('agentDetail.skillsToExternal')}</p>
                  </div>
                  <div className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border bg-accent">
                    <Globe className="w-8 h-8 text-cyan-600" />
                    <p className="text-xs font-medium">{(agent.connections || []).length} Ext.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Protocol Version */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Radio className="w-4 h-4" /> {t('agentDetail.protocolVersion')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  {t('agentDetail.protocolV1')}
                </Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Config Dialog (shared for skills & plugins) */}
      <Dialog open={!!showConfigDialog} onOpenChange={(open) => { if (!open) setShowConfigDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('agentDetail.skillConfig')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              className="font-mono text-xs min-h-[200px]"
              value={configValue}
              onChange={(e) => setConfigValue(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowConfigDialog(null)}>{t('common.cancel')}</Button>
              <Button onClick={() => {
                if (!showConfigDialog) return;
                if (showConfigDialog.startsWith('skill-')) {
                  handleSaveConfig(showConfigDialog.replace('skill-', ''));
                } else if (showConfigDialog.startsWith('plugin-')) {
                  handleSavePluginConfig(showConfigDialog.replace('plugin-', ''));
                }
              }}>{t('common.save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Simple arrow icon for the diagram
function ArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 10h12m-4-4l4 4-4 4" />
    </svg>
  );
}
