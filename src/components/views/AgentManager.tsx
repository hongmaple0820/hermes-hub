'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Bot, Plus, Trash2, Eye, MoreHorizontal, Pencil, Search, Wifi, WifiOff, Clock, Sparkles, AlertTriangle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AgentForm {
  name: string;
  description: string;
  systemPrompt: string;
  mode: string;
  providerId: string;
  model: string;
  isPublic: boolean;
  temperature: number;
  maxTokens: number;
  apiKey: string;
  agentType: string;
  agentVersion: string;
}

const defaultForm: AgentForm = {
  name: '',
  description: '',
  systemPrompt: '',
  mode: 'builtin',
  providerId: '',
  model: '',
  isPublic: false,
  temperature: 0.7,
  maxTokens: 2048,
  apiKey: '',
  agentType: 'hermes-agent',
  agentVersion: '',
};

const AGENT_EMOJIS: Record<string, string> = {
  'hermes-agent': '🤖',
  'openclaw': '🦞',
  'claude-code': '🧠',
  'codex': '💻',
  'trae': '⚡',
  'custom': '🔧',
};

type FilterMode = 'all' | 'builtin' | 'acrp';

export function AgentManager() {
  const { agents, setAgents, providers, setCurrentView, setSelectedAgentId } = useAppStore();
  const { t } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AgentForm>({ ...defaultForm });

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState<any>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  // ACRP success dialog
  const [showAcrpSuccess, setShowAcrpSuccess] = useState(false);
  const [createdAcrpAgent, setCreatedAcrpAgent] = useState<any>(null);

  // Agent status auto-refresh
  const [agentStatuses, setAgentStatuses] = useState<Record<string, { status: string; wsConnected: boolean; lastHeartbeatAt: string | null }>>({});

  const refreshAgentStatuses = useCallback(async () => {
    try {
      const acrpAgents = agents.filter((a: any) => a.mode === 'acrp');
      if (acrpAgents.length === 0) return;

      const result = await api.getAcrpAgents();
      const statusMap: Record<string, { status: string; wsConnected: boolean; lastHeartbeatAt: string | null }> = {};
      for (const agent of result.agents) {
        statusMap[agent.id] = {
          status: agent.status || 'offline',
          wsConnected: agent.wsConnected || false,
          lastHeartbeatAt: agent.lastHeartbeatAt || null,
        };
      }
      setAgentStatuses((prev) => ({ ...prev, ...statusMap }));
    } catch {
      // Silently fail - status refresh is best effort
    }
  }, [agents]);

  useEffect(() => {
    const interval = setInterval(refreshAgentStatuses, 30000);
    return () => clearInterval(interval);
  }, [refreshAgentStatuses]);

  // Initial status fetch
  useEffect(() => {
    refreshAgentStatuses();
  }, [refreshAgentStatuses]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error(t('common.required'));
      return;
    }
    if (form.mode === 'acrp' && !form.description.trim()) {
      toast.error(t('common.required'));
      return;
    }
    setCreating(true);
    try {
      const createData: any = {
        ...form,
        providerId: form.providerId || undefined,
        model: form.model || undefined,
        temperature: form.temperature,
        maxTokens: form.maxTokens,
      };
      if (form.mode === 'acrp') {
        createData.agentType = form.agentType;
        createData.agentVersion = form.agentVersion || undefined;
      }
      const result = await api.createAgent(createData);
      setAgents([result.agent, ...agents]);
      setShowCreate(false);

      if (form.mode === 'acrp') {
        setCreatedAcrpAgent(result.agent);
        setShowAcrpSuccess(true);
      }

      setForm({ ...defaultForm });
      if (form.mode !== 'acrp') {
        toast.success(t('agents.created'));
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (agent: any) => {
    setEditingAgent(agent);
    setForm({
      name: agent.name || '',
      description: agent.description || '',
      systemPrompt: agent.systemPrompt || '',
      mode: agent.mode || 'builtin',
      providerId: agent.providerId || '',
      model: agent.model || '',
      isPublic: agent.isPublic || false,
      temperature: agent.temperature ?? 0.7,
      maxTokens: agent.maxTokens ?? 2048,
      apiKey: agent.apiKey || '',
      agentType: agent.agentType || 'hermes-agent',
      agentVersion: agent.agentVersion || '',
    });
    setShowEdit(true);
  };

  const handleUpdate = async () => {
    if (!editingAgent || !form.name.trim()) {
      toast.error(t('common.required'));
      return;
    }
    setSaving(true);
    try {
      const updateData: any = {
        ...form,
        providerId: form.providerId || undefined,
        model: form.model || undefined,
      };
      if (form.mode === 'acrp') {
        updateData.agentType = form.agentType;
        updateData.agentVersion = form.agentVersion || undefined;
      }
      const result = await api.updateAgent(editingAgent.id, updateData);
      setAgents(agents.map((a: any) => a.id === editingAgent.id ? result.agent : a));
      setShowEdit(false);
      setEditingAgent(null);
      setForm({ ...defaultForm });
      toast.success(t('agents.updated'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (agent: any) => {
    setDeletingAgent(agent);
    setDeleteConfirmName('');
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAgent) return;
    if (deleteConfirmName !== deletingAgent.name) {
      toast.error(t('common.required'));
      return;
    }
    setDeleting(true);
    try {
      await api.deleteAgent(deletingAgent.id);
      setAgents(agents.filter((a: any) => a.id !== deletingAgent.id));
      setShowDeleteConfirm(false);
      setDeletingAgent(null);
      setDeleteConfirmName('');
      toast.success(t('agents.deleted'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleting(false);
    }
  };

  // Filter & search agents
  const filteredAgents = agents.filter((agent: any) => {
    const matchesSearch = !searchQuery || agent.name.toLowerCase().includes(searchQuery.toLowerCase()) || (agent.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterMode === 'all' || agent.mode === filterMode;
    return matchesSearch && matchesFilter;
  });

  const modeLabels: Record<string, string> = {
    builtin: t('agents.modeBuiltinShort'),
    acrp: t('agents.modeAcrpShort'),
  };

  const modeColors: Record<string, string> = {
    builtin: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    acrp: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
  };

  const modeGradients: Record<string, string> = {
    builtin: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    acrp: 'bg-gradient-to-r from-cyan-500 to-cyan-400',
  };

  const getStatusDot = (agent: any) => {
    const status = agentStatuses[agent.id]?.status || agent.status || 'offline';
    const isAcrp = agent.mode === 'acrp';
    const wsConnected = agentStatuses[agent.id]?.wsConnected;

    if (isAcrp) {
      return wsConnected ? 'online' : 'offline';
    }

    if (status === 'online') return 'online';
    if (status === 'busy') return 'busy';
    if (status === 'error') return 'error';
    return 'offline';
  };

  const statusDotColors: Record<string, string> = {
    online: 'bg-emerald-500',
    busy: 'bg-amber-500',
    error: 'bg-red-500',
    offline: 'bg-gray-300',
  };

  const formatLastActive = (agent: any) => {
    const lastHeartbeat = agentStatuses[agent.id]?.lastHeartbeatAt;
    const updatedAt = agent.updatedAt;
    const dateStr = lastHeartbeat || updatedAt;
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return t('common.online').toLowerCase();
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      const diffDays = Math.floor(diffHrs / 24);
      return `${diffDays}d ago`;
    } catch {
      return null;
    }
  };

  const renderFormFields = (isEdit: boolean) => (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>{t('agents.nameLabel')} *</Label>
        <Input placeholder={t('agents.namePlaceholder')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>{t('agents.descriptionLabel')} {form.mode === 'acrp' && '*'}</Label>
        <Textarea placeholder={t('agents.descriptionPlaceholder')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
      </div>
      <div className="space-y-2">
        <Label>{t('agents.modeLabel')}</Label>
        <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })} disabled={isEdit}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="builtin">{t('agents.modeBuiltin')}</SelectItem>
            <SelectItem value="acrp">{t('agents.modeAcrp')}</SelectItem>
          </SelectContent>
        </Select>
        {form.mode === 'acrp' && (
          <p className="text-xs text-muted-foreground">{t('agents.modeAcrpDesc')}</p>
        )}
      </div>

      {/* ACRP-specific configuration */}
      {form.mode === 'acrp' && (
        <div className="space-y-4 p-4 rounded-lg border border-cyan-200 bg-cyan-50/50 dark:bg-cyan-950/20 dark:border-cyan-800">
          <div className="space-y-2">
            <Label>{t('agents.agentType')}</Label>
            <Select value={form.agentType} onValueChange={(v) => setForm({ ...form, agentType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hermes-agent">Hermes Agent</SelectItem>
                <SelectItem value="openclaw">OpenClaw</SelectItem>
                <SelectItem value="claude-code">Claude Code</SelectItem>
                <SelectItem value="codex">Codex</SelectItem>
                <SelectItem value="trae">Trae</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('agents.agentVersion')} ({t('common.optional').toLowerCase()})</Label>
            <Input placeholder="e.g., 1.0.0" value={form.agentVersion} onChange={(e) => setForm({ ...form, agentVersion: e.target.value })} />
          </div>
        </div>
      )}

      {form.mode === 'builtin' && (
        <>
          <div className="space-y-2">
            <Label>{t('agents.providerLabel')}</Label>
            <Select value={form.providerId} onValueChange={(v) => setForm({ ...form, providerId: v })}>
              <SelectTrigger><SelectValue placeholder={t('agents.providerPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {providers.length === 0 ? (
                  <SelectItem value="none" disabled>{t('agents.noProviders')}</SelectItem>
                ) : (
                  providers.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.provider})</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {providers.length === 0 && (
              <p className="text-xs text-amber-600">{t('agents.addProviderFirst')}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t('agents.modelOverride')}</Label>
            <Input placeholder={t('agents.modelOverridePlaceholder')} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('agents.temperature')}: {form.temperature}</Label>
              <input type="range" min="0" max="2" step="0.1" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })} className="w-full" />
            </div>
            <div className="space-y-2">
              <Label>{t('agents.maxTokens')}</Label>
              <Input type="number" value={form.maxTokens} onChange={(e) => setForm({ ...form, maxTokens: parseInt(e.target.value) || 2048 })} />
            </div>
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label>{t('agents.systemPrompt')}</Label>
        <Textarea placeholder={t('agents.systemPromptPlaceholder')} value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} rows={4} />
      </div>

      {form.mode === 'builtin' && (
        <div className="space-y-2">
          <Label>{t('agents.apiKeyOptional')}</Label>
          <Input type="password" placeholder={t('agents.apiKeyPlaceholder')} value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Switch checked={form.isPublic} onCheckedChange={(v) => setForm({ ...form, isPublic: v })} />
        <Label>{t('agents.isPublic')}</Label>
      </div>

      {isEdit ? (
        <Button onClick={handleUpdate} className="w-full" disabled={saving}>
          {saving ? t('agents.saving') : t('agents.save')}
        </Button>
      ) : (
        <Button onClick={handleCreate} className="w-full" disabled={creating}>
          {creating ? t('agents.creating') : t('agents.create')}
        </Button>
      )}
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('agents.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('agents.subtitle')}</p>
        </div>
        <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) setForm({ ...defaultForm }); }}>
          <Button className="gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> {t('agents.create')}
          </Button>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('agents.createTitle')}</DialogTitle>
            </DialogHeader>
            {renderFormFields(false)}
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('agents.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'builtin', 'acrp'] as FilterMode[]).map((mode) => (
            <Button
              key={mode}
              variant={filterMode === mode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterMode(mode)}
              className="text-xs"
            >
              {mode === 'all' ? t('agents.filterAll') : mode === 'builtin' ? t('agents.filterBuiltin') : t('agents.filterAcrp')}
            </Button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {filteredAgents.length} {filteredAgents.length === 1 ? 'agent' : 'agents'}
        </span>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={(open) => { setShowEdit(open); if (!open) { setEditingAgent(null); setForm({ ...defaultForm }); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('agents.editTitle')}</DialogTitle>
          </DialogHeader>
          {renderFormFields(true)}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => { setShowDeleteConfirm(open); if (!open) { setDeletingAgent(null); setDeleteConfirmName(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('agents.deleteConfirmTitle')}</DialogTitle>
            <DialogDescription className="space-y-2">
              {deletingAgent && (
                <>
                  <span>{t('agents.deleteConfirmDesc')}</span>
                  <div className="flex items-center gap-2 mt-2 p-2 rounded bg-destructive/10 text-destructive text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="font-medium">{deletingAgent.name}</span>
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-sm">{t('agents.typeAgentName')}</Label>
            <Input
              placeholder={deletingAgent?.name || ''}
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setDeletingAgent(null); setDeleteConfirmName(''); }}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteConfirmName !== deletingAgent?.name || deleting}
            >
              {deleting ? t('common.loading') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ACRP Success Dialog */}
      <Dialog open={showAcrpSuccess} onOpenChange={setShowAcrpSuccess}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-500" />
              {t('agents.agentCreated')}
            </DialogTitle>
            <DialogDescription>
              {t('agents.agentCreatedDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full gap-2 bg-cyan-600 hover:bg-cyan-700"
              onClick={() => {
                setShowAcrpSuccess(false);
                if (createdAcrpAgent) {
                  setSelectedAgentId(createdAcrpAgent.id);
                  setCurrentView('agent-control');
                }
                setCreatedAcrpAgent(null);
              }}
            >
              <Wifi className="w-4 h-4" /> {t('agents.generateToken')}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowAcrpSuccess(false);
                setCreatedAcrpAgent(null);
              }}
            >
              {t('agents.generateLater')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {agents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('agents.noAgentsTitle')}</h3>
            <p className="text-muted-foreground text-sm mb-4">{t('agents.noAgentsDesc')}</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> {t('agents.create')}
            </Button>
          </CardContent>
        </Card>
      ) : filteredAgents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Search className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('common.noResults')}</h3>
            <p className="text-muted-foreground text-sm">{t('agents.searchPlaceholder')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent: any) => {
            const statusKey = getStatusDot(agent);
            const lastActive = formatLastActive(agent);
            const isAcrp = agent.mode === 'acrp';
            const wsConnected = agentStatuses[agent.id]?.wsConnected;
            const skillCount = agent.skills?.length || 0;
            const agentEmoji = isAcrp ? (AGENT_EMOJIS[agent.agentType] || AGENT_EMOJIS['custom']) : null;

            return (
              <Card
                key={agent.id}
                className="group relative overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
              >
                {/* Gradient top border */}
                <div className={cn('h-1 w-full', modeGradients[agent.mode] || 'bg-gradient-to-r from-gray-400 to-gray-300')} />

                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Avatar with emoji */}
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg',
                        isAcrp ? 'bg-cyan-500/10' : 'bg-primary/10'
                      )}>
                        {agentEmoji ? (
                          <span>{agentEmoji}</span>
                        ) : (
                          <Bot className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{agent.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={cn('text-[10px]', modeColors[agent.mode])}>
                            {modeLabels[agent.mode]}
                          </Badge>
                          {/* Skill count badge */}
                          {skillCount > 0 && (
                            <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                              {t('agents.skillCount', { count: skillCount })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Status indicator */}
                      <div className="flex items-center gap-1.5">
                        <div className={cn('w-2 h-2 rounded-full', statusDotColors[statusKey])} />
                        {isAcrp && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[9px] px-1.5 py-0',
                              wsConnected
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200'
                                : 'bg-gray-500/10 text-gray-500 border-gray-200'
                            )}
                          >
                            {wsConnected ? (
                              <><Wifi className="w-2.5 h-2.5 mr-0.5" /> {t('agents.connected')}</>
                            ) : (
                              <><WifiOff className="w-2.5 h-2.5 mr-0.5" /> {t('agents.disconnected')}</>
                            )}
                          </Badge>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedAgentId(agent.id); setCurrentView('agent-detail'); }}>
                            <Eye className="w-4 h-4 mr-2" /> {t('common.view')} {t('common.details')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(agent)}>
                            <Pencil className="w-4 h-4 mr-2" /> {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(agent)}>
                            <Trash2 className="w-4 h-4 mr-2" /> {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {agent.description || t('common.noData')}
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
                      onClick={() => handleEdit(agent)}
                    >
                      <Pencil className="w-3 h-3" /> {t('common.edit')}
                    </Button>
                  </div>
                  {/* Footer: Last active + Connections */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                    <div className="flex items-center gap-2">
                      {lastActive && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {t('agents.lastActive')}: {lastActive}
                        </span>
                      )}
                      {agent.connections?.length > 0 && (
                        <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                          {t('agents.connectionsCount', { count: agent.connections.length })}
                        </span>
                      )}
                    </div>
                    {isAcrp && agent.agentType && (
                      <span className="text-[10px] text-muted-foreground">
                        {agent.agentType}{agent.agentVersion ? ` v${agent.agentVersion}` : ''}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
