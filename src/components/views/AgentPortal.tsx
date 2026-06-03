'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Bot, Plus, Search, Wifi, WifiOff, Zap, Link2, Copy, ChevronDown, ChevronUp, Sparkles, Terminal, Pencil, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type FilterMode = 'all' | 'builtin' | 'external' | 'template';
type CreateMode = 'builtin' | 'external' | 'template';

interface AgentForm {
  name: string;
  description: string;
  systemPrompt: string;
  providerId: string;
  model: string;
  isPublic: boolean;
  temperature: number;
  maxTokens: number;
}

interface ExternalForm {
  name: string;
  description: string;
  agentType: string;
}

const defaultAgentForm: AgentForm = {
  name: '', description: '', systemPrompt: '',
  providerId: '', model: '', isPublic: false,
  temperature: 0.7, maxTokens: 2048,
};

const defaultExternalForm: ExternalForm = {
  name: '', description: '', agentType: 'hermes-agent',
};

const AGENT_TYPE_ICONS: Record<string, string> = {
  'hermes-agent': 'H', 'openclaw': 'O', 'claude-code': 'C', 'codex': 'D', 'trae': 'T', 'custom': '?',
};

const AGENT_TYPE_COLORS: Record<string, string> = {
  'hermes-agent': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'openclaw': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'claude-code': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'codex': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  'trae': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  'custom': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const AGENT_TYPES = ['hermes-agent', 'openclaw', 'claude-code', 'codex', 'trae', 'custom'];

export function AgentPortal() {
  const { agents, setAgents, providers, setCurrentView, setSelectedAgentId } = useAppStore();
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [createMode, setCreateMode] = useState<CreateMode | null>(null);
  const [agentForm, setAgentForm] = useState<AgentForm>({ ...defaultAgentForm });
  const [externalForm, setExternalForm] = useState<ExternalForm>({ ...defaultExternalForm });
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const [connectResult, setConnectResult] = useState<{ agentToken: string; connectGuide: { python: string; javascript: string; cli: string } } | null>(null);

  const [agentStatuses, setAgentStatuses] = useState<Record<string, { wsConnected: boolean; lastHeartbeatAt: string | null }>>({});

  const refreshAgentStatuses = useCallback(async () => {
    try {
      const acrpAgents = agents.filter((a: any) => a.mode === 'acrp');
      if (acrpAgents.length === 0) return;
      const result = await api.getAcrpAgents();
      const statusMap: Record<string, { wsConnected: boolean; lastHeartbeatAt: string | null }> = {};
      for (const agent of result.agents) {
        statusMap[agent.id] = { wsConnected: agent.wsConnected || false, lastHeartbeatAt: agent.lastHeartbeatAt };
      }
      setAgentStatuses(statusMap);
    } catch { }
  }, [agents]);

  useEffect(() => {
    const timer = setTimeout(() => void refreshAgentStatuses(), 0);
    const interval = setInterval(() => void refreshAgentStatuses(), 30000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [agents]);

  useEffect(() => {
    if (createMode === 'template') {
      api.getAgentTemplates().then(r => setTemplates(r.templates)).catch(() => { });
    }
  }, [createMode]);

  const loadAgents = useCallback(async () => {
    try {
      const result = await api.getAgents();
      setAgents(result.agents);
    } catch (error: any) {
      toast.error(error.message);
    }
  }, [setAgents]);

  const handleCreateBuiltin = async () => {
    if (!agentForm.name) { toast.error('Name is required'); return; }
    setCreating(true);
    try {
      const result: any = await api.createBuiltinAssistant({
        name: agentForm.name,
        description: agentForm.description,
        systemPrompt: agentForm.systemPrompt,
        providerId: agentForm.providerId || undefined,
        model: agentForm.model || undefined,
        temperature: agentForm.temperature,
        maxTokens: agentForm.maxTokens,
      });
      toast.success('Assistant created!');
      setSelectedAgentId(result.agent.id);
      setCurrentView('agent-detail');
      await loadAgents();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateExternal = async () => {
    if (!externalForm.name) { toast.error('Name is required'); return; }
    setCreating(true);
    try {
      const result: any = await api.createExternalAgent({
        name: externalForm.name,
        description: externalForm.description,
        agentType: externalForm.agentType,
      });
      toast.success('External Agent created!');
      setConnectResult({ agentToken: result.agentToken, connectGuide: result.connectGuide });
      setSelectedAgentId(result.agent.id);
      setCurrentView('agent-detail');
      await loadAgents();
    } catch (error: any) {
      toast.error(error.message);
      setCreating(false);
    }
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplateId) { toast.error('Select a template'); return; }
    setCreating(true);
    try {
      const tmpl = templates.find((t: any) => t.id === selectedTemplateId);
      const result: any = await api.createFromTemplate({
        templateId: selectedTemplateId,
        name: tmpl?.displayName || undefined,
      });
      toast.success('Agent created from template!');
      if (result.agentToken && result.connectGuide) {
        setConnectResult({ agentToken: result.agentToken, connectGuide: result.connectGuide });
      }
      setSelectedAgentId(result.agent.id);
      setCurrentView('agent-detail');
      await loadAgents();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAgent) return;
    setDeleting(true);
    try {
      await api.deleteAgent(deletingAgent.id);
      toast.success('Agent deleted');
      setShowDeleteConfirm(false);
      setDeletingAgent(null);
      await loadAgents();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredAgents = agents.filter((a: any) => {
    const matchesSearch = !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase()) || (a.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterMode === 'all' || (filterMode === 'builtin' && a.mode === 'builtin') || (filterMode === 'external' && a.mode === 'acrp');
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('agents.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('agents.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setCreateMode('builtin')}>
          <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{t('agentPortal.createBuiltin')}</h3>
              <p className="text-xs text-muted-foreground">{t('agentPortal.createBuiltinDesc')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setCreateMode('external')}>
          <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
              <Link2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-semibold">{t('agentPortal.createExternal')}</h3>
              <p className="text-xs text-muted-foreground">{t('agentPortal.createExternalDesc')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setCreateMode('template')}>
          <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
              <Sparkles className="w-6 h-6 text-violet-500" />
            </div>
            <div>
              <h3 className="font-semibold">{t('agentPortal.createFromTemplate')}</h3>
              <p className="text-xs text-muted-foreground">{t('agentPortal.createFromTemplateDesc')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('agents.searchPlaceholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1">
          {(['all', 'builtin', 'external'] as FilterMode[]).map(mode => (
            <Button key={mode} variant={filterMode === mode ? 'default' : 'outline'} size="sm" onClick={() => setFilterMode(mode)}>
              {mode === 'all' ? t('agents.filterAll') : mode === 'builtin' ? t('agents.filterBuiltin') : t('agents.filterExternal')}
            </Button>
          ))}
        </div>
      </div>

      {filteredAgents.length === 0 ? (
        <EmptyState icon={Bot} title={t('agents.noAgents')} description={t('agents.noAgentsDesc')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent: any) => {
            const isOnline = agent.mode === 'acrp' ? (agentStatuses[agent.id]?.wsConnected ?? agent.wsConnected) : (agent.status === 'online');
            const typeBadge = agent.mode === 'acrp' ? (AGENT_TYPE_COLORS[agent.agentType || 'custom'] || AGENT_TYPE_COLORS.custom) : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            const typeIcon = agent.mode === 'acrp' ? (AGENT_TYPE_ICONS[agent.agentType || 'custom'] || '?') : 'B';

            return (
              <Card key={agent.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => { setSelectedAgentId(agent.id); setCurrentView('agent-detail'); }}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg', typeBadge)}>
                        {typeIcon}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{agent.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">{agent.description || (agent.mode === 'acrp' ? 'External Agent' : 'Built-in Assistant')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOnline ? (
                        <Badge variant="outline" className="text-[10px] gap-1 border-emerald-300 text-emerald-600">
                          <Wifi className="w-3 h-3" /> {t('common.online')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <WifiOff className="w-3 h-3" /> {t('common.offline')}
                        </Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeletingAgent(agent); setShowDeleteConfirm(true); }}>
                            <Trash2 className="w-4 h-4 mr-2" /> {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {agent.mode === 'acrp' ? 'External' : 'Built-in'}
                    </Badge>
                    {agent.model && <Badge variant="outline" className="text-[10px]">{agent.model}</Badge>}
                    {agent.skills?.length > 0 && <Badge variant="outline" className="text-[10px]">{agent.skills.length} skills</Badge>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Builtin Dialog */}
      <Dialog open={createMode === 'builtin'} onOpenChange={open => !open && setCreateMode(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('agentPortal.createBuiltin')}</DialogTitle>
            <DialogDescription>{t('agentPortal.createBuiltinDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('agents.nameLabel')}</Label>
              <Input placeholder={t('agents.namePlaceholder')} value={agentForm.name} onChange={e => setAgentForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('agents.descriptionLabel')}</Label>
              <Input placeholder={t('agents.descriptionPlaceholder')} value={agentForm.description} onChange={e => setAgentForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('agents.systemPrompt')}</Label>
              <Textarea placeholder={t('agents.systemPromptPlaceholder')} value={agentForm.systemPrompt} onChange={e => setAgentForm(f => ({ ...f, systemPrompt: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>{t('agents.providerLabel')}</Label>
              <Select value={agentForm.providerId} onValueChange={v => setAgentForm(f => ({ ...f, providerId: v }))}>
                <SelectTrigger><SelectValue placeholder={t('agents.providerPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {providers.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.provider})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateMode(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreateBuiltin} disabled={creating || !agentForm.name}>
              {creating ? 'Creating...' : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create External Dialog */}
      <Dialog open={createMode === 'external'} onOpenChange={open => { if (!open) { setCreateMode(null); setConnectResult(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('agentPortal.createExternal')}</DialogTitle>
            <DialogDescription>{t('agentPortal.createExternalDesc')}</DialogDescription>
          </DialogHeader>
          {!connectResult ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t('agents.nameLabel')}</Label>
                <Input placeholder="My Hermes Agent" value={externalForm.name} onChange={e => setExternalForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('agents.descriptionLabel')}</Label>
                <Input placeholder={t('agents.descriptionPlaceholder')} value={externalForm.description} onChange={e => setExternalForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('agentPortal.agentType')}</Label>
                <Select value={externalForm.agentType} onValueChange={v => setExternalForm(f => ({ ...f, agentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AGENT_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateMode(null)}>{t('common.cancel')}</Button>
                <Button onClick={handleCreateExternal} disabled={creating || !externalForm.name}>
                  {creating ? 'Creating...' : t('common.create')}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <Zap className="w-5 h-5 text-emerald-500" />
                <span className="font-medium text-emerald-700 dark:text-emerald-400">{t('agentPortal.createdSuccess')}</span>
              </div>
              <div className="space-y-2">
                <Label>{t('agentPortal.agentToken')}</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-accent px-3 py-2 rounded-lg">{connectResult.agentToken}</code>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => { navigator.clipboard.writeText(connectResult.agentToken); toast.success(t('common.copied')); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full">
                  <ChevronDown className="w-4 h-4" /> {t('agentPortal.connectCode')}
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 mt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Python</Label>
                    <pre className="text-xs bg-accent p-3 rounded-lg overflow-x-auto">{connectResult.connectGuide.python}</pre>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">JavaScript</Label>
                    <pre className="text-xs bg-accent p-3 rounded-lg overflow-x-auto">{connectResult.connectGuide.javascript}</pre>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CLI</Label>
                    <pre className="text-xs bg-accent p-3 rounded-lg overflow-x-auto">{connectResult.connectGuide.cli}</pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <DialogFooter>
                <Button onClick={() => { setCreateMode(null); setConnectResult(null); }}>{t('common.done')}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create From Template Dialog */}
      <Dialog open={createMode === 'template'} onOpenChange={open => !open && setCreateMode(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('agentPortal.createFromTemplate')}</DialogTitle>
            <DialogDescription>{t('agentPortal.createFromTemplateDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {templates.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-muted-foreground">Loading templates...</div>
            ) : templates.map((tmpl: any) => (
              <Card key={tmpl.id} className={cn('cursor-pointer transition-all', selectedTemplateId === tmpl.id ? 'ring-2 ring-primary shadow-md' : 'hover:shadow-sm')} onClick={() => setSelectedTemplateId(tmpl.id)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg font-bold">
                      {tmpl.icon || 'T'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold truncate">{tmpl.displayName}</h4>
                      <p className="text-xs text-muted-foreground truncate">{tmpl.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateMode(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreateFromTemplate} disabled={creating || !selectedTemplateId}>
              {creating ? 'Creating...' : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('agents.deleteConfirm')}</DialogTitle>
            <DialogDescription>{t('agents.deleteConfirmDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting...' : t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}