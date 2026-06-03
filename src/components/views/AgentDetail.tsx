'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Bot, ArrowLeft, Plus, Trash2, MessageSquare, Copy, ChevronDown, ChevronUp,
  Settings, Zap, Activity, Shield, Key, Radio, Clock, Globe, Puzzle,
  CheckCircle2, XCircle, Loader2, Send, History, User, Sparkles,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

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

function formatTime(ts: string | null | undefined) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

interface UnifiedDetail {
  agent: any;
  skills: any[];
  connectionStatus: any;
  recentActivities: any[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  skillInvocations?: any[];
}

export function AgentDetail() {
  const { agents, setAgents, selectedAgentId, providers, skills, setCurrentView } = useAppStore();
  const { t } = useI18n();
  const agent = agents.find((a: any) => a.id === selectedAgentId) || null;

  const [unifiedDetail, setUnifiedDetail] = useState<UnifiedDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showAddSkill, setShowAddSkill] = useState(false);
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());
  const [testLoading, setTestLoading] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; latency?: number; error?: string }>>({});
  const [showConfigDialog, setShowConfigDialog] = useState<string | null>(null);
  const [configValue, setConfigValue] = useState('{}');
  const [connectionInfoOpen, setConnectionInfoOpen] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);

  const [activities, setActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadUnifiedDetail = useCallback(async () => {
    if (!selectedAgentId) return;
    setDetailLoading(true);
    try {
      const result = await api.getAgentUnifiedDetail(selectedAgentId);
      setUnifiedDetail(result as any);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDetailLoading(false);
    }
  }, [selectedAgentId]);

  const refreshAgent = useCallback(async () => {
    try {
      const result = await api.getAgents();
      setAgents(result.agents);
      await loadUnifiedDetail();
    } catch (error: any) {
      toast.error(error.message);
    }
  }, [setAgents, loadUnifiedDetail]);

  const loadActivities = useCallback(async () => {
    if (!selectedAgentId) return;
    setActivitiesLoading(true);
    try {
      const result = await api.getAgentActivities(selectedAgentId, 20);
      setActivities((result as any).activities || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActivitiesLoading(false);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    loadUnifiedDetail();
  }, [loadUnifiedDetail]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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

  const unifiedSkills = unifiedDetail?.skills || [];
  const connectionStatus = unifiedDetail?.connectionStatus || {};
  const enabledSkillsCount = unifiedSkills.filter((s: any) => s.isEnabled).length;

  const handleAttachSkill = async (skillId: string) => {
    try {
      await api.attachSkillToAgent(agent.id, skillId);
      await refreshAgent();
      toast.success(t('agentDetail.skillInstalled'));
      setShowAddSkill(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDetachSkill = async (skillId: string) => {
    try {
      await api.detachSkillFromAgent(agent.id, skillId);
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

  const toggleSkillExpanded = (id: string) => {
    setExpandedSkills(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatSending) return;
    const content = chatInput.trim();
    setChatInput('');
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatSending(true);
    try {
      const result = await api.sendAgentChat(agent.id, content) as any;
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.reply || '',
        timestamp: new Date().toISOString(),
        skillInvocations: result.skillInvocations || [],
      };
      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: t('agentDetail.chatError', { error: error.message }),
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setChatSending(false);
    }
  };

  const installedSkillIds = new Set(unifiedSkills.map((s: any) => s.skillId || s.id));
  const availableSkills = skills.filter((s: any) => !installedSkillIds.has(s.id));

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
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
            <span className="text-xs text-muted-foreground">{t('agentDetail.skillsCount', { count: enabledSkillsCount })}</span>
          </div>
        </div>
        {detailLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      <Tabs defaultValue="configuration" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="configuration">{t('agentDetail.tabConfiguration')}</TabsTrigger>
          <TabsTrigger value="chat">{t('agentDetail.tabChat')}</TabsTrigger>
          <TabsTrigger value="history" onClick={loadActivities}>{t('agentDetail.tabHistory')}</TabsTrigger>
        </TabsList>

        {/* ========== CONFIGURATION TAB ========== */}
        <TabsContent value="configuration">
          <div className="space-y-6">

            {/* Basic Info */}
            <Card>
              <CardHeader><CardTitle className="text-base">{t('agentDetail.basicInfo')}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">{t('agentDetail.mode')}</Label>
                    <p className="text-sm font-medium">{agent.mode}</p>
                  </div>
                  <div>
                    <Label className="text-xs">{t('agentDetail.provider')}</Label>
                    <p className="text-sm font-medium">{agent.provider?.name || t('agentDetail.defaultProvider')}</p>
                  </div>
                  <div>
                    <Label className="text-xs">{t('agentDetail.model')}</Label>
                    <p className="text-sm font-medium">{agent.model || agent.provider?.defaultModel || t('agentDetail.default')}</p>
                  </div>
                  <div>
                    <Label className="text-xs">{t('agentDetail.temperature')}</Label>
                    <p className="text-sm font-medium">{agent.temperature ?? 0.7}</p>
                  </div>
                  <div>
                    <Label className="text-xs">{t('agentDetail.maxTokens')}</Label>
                    <p className="text-sm font-medium">{agent.maxTokens ?? 2048}</p>
                  </div>
                  <div>
                    <Label className="text-xs">{t('agentDetail.public')}</Label>
                    <p className="text-sm font-medium">{agent.isPublic ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <Label className="text-xs">{t('agentDetail.description')}</Label>
                    <p className="text-sm text-muted-foreground">{agent.description || t('agentDetail.notSet')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Prompt */}
            <Card>
              <CardHeader><CardTitle className="text-base">{t('agentDetail.systemPrompt')}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {agent.systemPrompt || t('agentDetail.noSystemPrompt')}
                </p>
              </CardContent>
            </Card>

            {/* API Key */}
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
                    <p className="text-xs text-muted-foreground">{t('agentDetail.endpointExplanation')}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('agentDetail.notSet')}</p>
                )}
              </CardContent>
            </Card>

            {/* Connection Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4" /> {t('agentDetail.connectionStatus')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-accent">
                    <p className="text-2xl font-bold">{enabledSkillsCount}</p>
                    <p className="text-xs text-muted-foreground">{t('agentDetail.skillsCount', { count: enabledSkillsCount })}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-accent">
                    <p className="text-2xl font-bold">{connectionStatus.wsConnected ? 1 : 0}</p>
                    <p className="text-xs text-muted-foreground">{connectionStatus.wsConnected ? t('common.online') : t('common.offline')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Attached Skills */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">{t('agentDetail.equippedSkills')}</CardTitle>
                  <CardDescription>{t('agentDetail.equippedSkillsDesc')}</CardDescription>
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
                              <Button size="sm" variant="outline" onClick={() => handleAttachSkill(skill.id)}>{t('common.install')}</Button>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {unifiedSkills.length === 0 ? (
                  <div className="text-center py-8">
                    <Puzzle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">{t('agentDetail.noSkills')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {unifiedSkills.map((us: any, idx: number) => {
                      const skillId = us.skillId || us.id;
                      const isExpanded = expandedSkills.has(us.id || skillId);
                      const testResult = testResults[skillId];
                      const isTesting = testLoading.has(skillId);
                      const sourceType = us.sourceType || (us.skill ? 'skill' : 'plugin');
                      const displayName = us.skill?.displayName || us.displayName || us.name || 'Unknown Skill';
                      const iconBg = sourceType === 'plugin' ? 'bg-blue-500/10' : 'bg-amber-500/10';
                      const iconColor = sourceType === 'plugin' ? 'text-blue-600' : 'text-amber-600';
                      const IconComponent = sourceType === 'plugin' ? Settings : Puzzle;

                      return (
                        <Card key={us.id || skillId} className="overflow-hidden">
                          <div className="p-4">
                            <div className="flex items-center gap-3">
                              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
                                <IconComponent className={cn('w-4 h-4', iconColor)} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">{displayName}</p>
                                  <Badge variant="outline" className="text-[10px]">{sourceType}</Badge>
                                  {us.skill?.category && <Badge variant="outline" className="text-[10px]">{us.skill.category}</Badge>}
                                  <StatusBadge status={us.endpointUrl ? 'registered' : 'unregistered'} />
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground">{t('agentDetail.priority')}: {us.priority ?? idx}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Switch checked={us.isEnabled} onCheckedChange={(v) => handleToggleSkill(skillId, v)} />
                                <Separator orientation="vertical" className="h-5" />
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
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => {
                                        setConfigValue(JSON.stringify(us.config || {}, null, 2));
                                        setShowConfigDialog(skillId);
                                      }}>
                                        <Settings className="w-3.5 h-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{t('agentDetail.configureSkill')}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => toggleSkillExpanded(us.id || skillId)}>
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDetachSkill(skillId)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

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

                            <Collapsible open={isExpanded} onOpenChange={() => toggleSkillExpanded(us.id || skillId)}>
                              <CollapsibleContent>
                                <Separator className="my-3" />
                                <div className="space-y-3 pl-1">
                                  <p className="text-xs font-medium text-muted-foreground">{t('agentDetail.endpointDetails')}</p>
                                  <ValueRow label={t('agentDetail.endpointUrl')} value={us.endpointUrl} />
                                  <ValueRow label={t('agentDetail.endpointToken')} value={us.endpointToken} />
                                  <ValueRow label={t('agentDetail.callbackSecret')} value={us.callbackSecret} />
                                  {!us.endpointUrl && (
                                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { api.generateSkillEndpoint(agent.id, skillId).then(() => refreshAgent()); }}>
                                      <Globe className="w-3.5 h-3.5" /> {t('agentDetail.generateEndpoint')}
                                    </Button>
                                  )}
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {t('agentDetail.lastHeartbeat')}: {formatTime(us.lastHeartbeat)}
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

            {/* Connection Info - ACRP only, collapsible */}
            {agent.mode === 'acrp' && (
              <Collapsible open={connectionInfoOpen} onOpenChange={setConnectionInfoOpen}>
                <Card>
                  <CardHeader>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full flex items-center justify-between p-0 h-auto">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Radio className="w-4 h-4" /> {t('agentDetail.connectionInfo')}
                        </CardTitle>
                        {connectionInfoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="space-y-4">
                      <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                        <p className="text-xs text-cyan-700 dark:text-cyan-400">{t('agents.modeAcrpDesc')}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">{t('agentDetail.connectionStatus')}</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <div className={cn('w-2.5 h-2.5 rounded-full', connectionStatus.wsConnected ? 'bg-emerald-500' : 'bg-gray-300')} />
                            <span className="text-sm font-medium">{connectionStatus.wsConnected ? t('common.online') : t('common.offline')}</span>
                          </div>
                        </div>
                        {agent.agentToken && (
                          <div>
                            <Label className="text-xs">Agent Token</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-xs font-mono bg-accent px-2 py-0.5 rounded flex-1 truncate">{agent.agentToken.substring(0, 12)}•••</code>
                              <CopyButton value={agent.agentToken} />
                            </div>
                          </div>
                        )}
                        {agent.agentType && (
                          <div>
                            <Label className="text-xs">{t('acrp.agentType')}</Label>
                            <p className="text-sm font-medium">{agent.agentType}</p>
                          </div>
                        )}
                        {agent.agentVersion && (
                          <div>
                            <Label className="text-xs">{t('acrp.agentVersion')}</Label>
                            <p className="text-sm font-medium">{agent.agentVersion}</p>
                          </div>
                        )}
                        {agent.lastHeartbeatAt && (
                          <div>
                            <Label className="text-xs">{t('acrp.lastHeartbeat')}</Label>
                            <p className="text-sm font-medium">{formatTime(agent.lastHeartbeatAt)}</p>
                          </div>
                        )}
                        {connectionStatus.capabilities && connectionStatus.capabilities.length > 0 && (
                          <div className="sm:col-span-2">
                            <Label className="text-xs">{t('acrp.capabilities')}</Label>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {connectionStatus.capabilities.map((cap: any) => (
                                <Badge key={cap.id || cap.name} variant="outline" className="text-[10px]">{cap.name || cap.category}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="sm:col-span-2">
                          <Label className="text-xs">{t('agentDetail.connectCode')}</Label>
                          <div className="mt-1 p-2 rounded bg-accent">
                            <code className="text-xs font-mono whitespace-pre-wrap">
                              {`const socket = io('${connectionStatus.wsConnectUrl || '/acrp/ws'}', {\n  auth: { token: '${agent.agentToken?.substring(0, 8)}•••' }\n});`}
                            </code>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}
          </div>
        </TabsContent>

        {/* ========== CHAT TAB ========== */}
        <TabsContent value="chat">
          <Card className="flex flex-col h-[600px]">
            <CardHeader className="shrink-0 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> {t('agentDetail.chatTitle', { name: agent.name })}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 px-4 pb-4">
              <ScrollArea className="flex-1 min-h-0 pr-2">
                <div className="space-y-4">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-12">
                      <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">{t('agentDetail.chatEmpty')}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('agentDetail.chatEmptyHint')}</p>
                    </div>
                  )}
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      <div className={cn(
                        'max-w-[80%] rounded-lg px-3 py-2',
                        msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-accent'
                      )}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-[10px] mt-1 opacity-70">{formatTime(msg.timestamp)}</p>
                        {msg.skillInvocations && msg.skillInvocations.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
                            <p className="text-[10px] text-muted-foreground">{t('agentDetail.skillCalls')}:</p>
                            {msg.skillInvocations.map((inv: any, i: number) => (
                              <Badge key={i} variant="outline" className="text-[10px] gap-1 mr-1">
                                <Zap className="w-2.5 h-2.5" />
                                {inv.name || inv.skillId || inv.capabilityId}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {chatSending && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      </div>
                      <div className="max-w-[80%] rounded-lg px-3 py-2 bg-accent">
                        <p className="text-sm text-muted-foreground">{t('agentDetail.chatThinking')}</p>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              <div className="shrink-0 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    placeholder={t('agentDetail.chatPlaceholder')}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                    disabled={chatSending}
                  />
                  <Button className="gap-2 shrink-0" onClick={handleSendChat} disabled={chatSending || !chatInput.trim()}>
                    <Send className="w-4 h-4" /> {t('agentDetail.chatSend')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== HISTORY TAB ========== */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4" /> {t('agentDetail.historyTitle')}
              </CardTitle>
              <CardDescription>{t('agentDetail.historyDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {activitiesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{t('agentDetail.noActivities')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity: any) => {
                    const typeIcon = {
                      conversation: <MessageSquare className="w-4 h-4" />,
                      skill_invocation: <Zap className="w-4 h-4" />,
                      capability_invocation: <Shield className="w-4 h-4" />,
                      connection: <Radio className="w-4 h-4" />,
                      agent_event: <Bot className="w-4 h-4" />,
                    }[activity.type] || <Activity className="w-4 h-4" />;
                    const typeBg = {
                      conversation: 'bg-emerald-500/10 text-emerald-600',
                      skill_invocation: 'bg-amber-500/10 text-amber-600',
                      capability_invocation: 'bg-blue-500/10 text-blue-600',
                      connection: 'bg-purple-500/10 text-purple-600',
                      agent_event: 'bg-cyan-500/10 text-cyan-600',
                    }[activity.type] || 'bg-gray-500/10 text-gray-600';

                    return (
                      <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', typeBg)}>
                          {typeIcon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{activity.title || activity.summary || activity.type}</p>
                            <Badge variant="outline" className="text-[10px]">{activity.type}</Badge>
                          </div>
                          {activity.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatTime(activity.timestamp || activity.createdAt)}
                            {activity.status && (
                              <Badge variant="outline" className="text-[10px]">{activity.status}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Config Dialog */}
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
                handleSaveConfig(showConfigDialog);
              }}>{t('common.save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}