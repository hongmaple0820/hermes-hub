'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Bot, Brain, Sparkles, ChevronDown, ChevronRight, Plus, Search,
  MessageSquare, Settings, Trash2, Edit, Power, PowerOff, Check,
  X, Loader2, AlertCircle, AlertTriangle, ArrowRight, ArrowLeft,
  CheckCircle2, XCircle, TestTube, Wifi, WifiOff, Puzzle,
  Server, Eye, EyeOff, Zap, Download, Clock
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { AgentCardSkeleton, ProviderCardSkeleton } from '@/components/shared/SkeletonLoaders';
import { StaggerList, StaggerItem } from '@/components/shared/PageTransition';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SKILL_STATUS_MAP } from '@/lib/skill-executor';
import { motion } from 'framer-motion';

// ─── Constants ────────────────────────────────────────────────

const PROVIDER_TYPES = [
  { value: 'openai', labelKey: 'providers.typeOpenai', icon: '🤖', defaultUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  { value: 'anthropic', labelKey: 'providers.typeAnthropic', icon: '🧠', defaultUrl: '', defaultModel: 'claude-3-sonnet-20240229' },
  { value: 'google', labelKey: 'providers.typeGoogle', icon: '💎', defaultUrl: '', defaultModel: 'gemini-pro' },
  { value: 'ollama', labelKey: 'providers.typeOllama', icon: '🦙', defaultUrl: 'http://localhost:11434', defaultModel: 'llama2' },
  { value: 'z-ai', labelKey: 'providers.typeZai', icon: '⚡', defaultUrl: '', defaultModel: 'default' },
  { value: 'custom', labelKey: 'providers.typeCustom', icon: '🔧', defaultUrl: 'http://localhost:8080/v1', defaultModel: '' },
];

const AGENT_EMOJIS: Record<string, string> = {
  'hermes-agent': '🤖',
  'openclaw': '🦞',
  'claude-code': '🧠',
  'codex': '💻',
  'trae': '⚡',
  'custom': '🔧',
};

const SKILL_ICON_MAP: Record<string, string> = {
  Search: '🔍', Code: '💻', Image: '🖼️', FileText: '📄', Languages: '🌐',
  Bell: '🔔', Globe: '🌍', BarChart3: '📊', Mail: '📧', Volume2: '🔊',
  Database: '🗄️', CloudSun: '🌤️', Zap: '⚡', Puzzle: '🧩',
};

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  communication: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  productivity: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  development: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  data: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  media: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  utility: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
};

const CATEGORY_KEYS: Record<string, string> = {
  all: 'skills.categoryAll',
  communication: 'skills.categoryCommunication',
  productivity: 'skills.categoryProductivity',
  development: 'skills.categoryDevelopment',
  data: 'skills.categoryData',
  media: 'skills.categoryMedia',
  utility: 'skills.categoryUtility',
  builtin: 'skills.categoryAll',
};

// ─── Agent Form ───────────────────────────────────────────────

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

const defaultAgentForm: AgentForm = {
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

// ─── Provider Form ────────────────────────────────────────────

interface ProviderForm {
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  isActive: boolean;
}

const defaultProviderForm: ProviderForm = {
  name: '',
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  defaultModel: '',
  isActive: true,
};

// ─── Main Component ───────────────────────────────────────────

export function AgentPanel() {
  const {
    agents, setAgents,
    providers, setProviders,
    skills,
    setCurrentView, setSelectedAgentId,
    setSelectedConversationId, setConversations,
  } = useAppStore();
  const { t } = useI18n();

  // ─── Panel section state ─────────────────────────
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    agents: true,
    models: false,
    skills: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // ─── Agent search ────────────────────────────────
  const [agentSearch, setAgentSearch] = useState('');

  const filteredAgents = useMemo(() => {
    return agents.filter((agent: any) => {
      const q = agentSearch.toLowerCase();
      return !q || agent.name.toLowerCase().includes(q) || (agent.description || '').toLowerCase().includes(q);
    });
  }, [agents, agentSearch]);

  // ─── Agent status ────────────────────────────────
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
      setAgentStatuses(prev => ({ ...prev, ...statusMap }));
    } catch {
      // Silently fail
    }
  }, [agents]);

  useEffect(() => {
    const interval = setInterval(refreshAgentStatuses, 30000);
    return () => clearInterval(interval);
  }, [refreshAgentStatuses]);

  useEffect(() => {
    refreshAgentStatuses();
  }, [refreshAgentStatuses]);

  // ─── Agent CRUD ──────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AgentForm>({ ...defaultAgentForm });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Create wizard steps
  const [createStep, setCreateStep] = useState(1);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [useZAI, setUseZAI] = useState(true);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState<any>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  // ACRP success dialog
  const [showAcrpSuccess, setShowAcrpSuccess] = useState(false);
  const [createdAcrpAgent, setCreatedAcrpAgent] = useState<any>(null);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = t('agents.nameRequired');
    else if (form.name.trim().length < 2) errors.name = t('agents.nameMinLength');
    else if (form.name.trim().length > 50) errors.name = t('agents.nameMaxLength');
    if (form.mode === 'acrp' && !form.description.trim()) errors.description = t('agents.descRequired');
    if (form.systemPrompt.length > 4000) errors.systemPrompt = t('agents.systemPromptMaxLength');
    if (form.mode === 'builtin') {
      if (form.temperature < 0 || form.temperature > 2) errors.temperature = t('agents.temperatureRange');
      if (form.maxTokens < 1 || form.maxTokens > 32000) errors.maxTokens = t('agents.maxTokensRange');
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    setCreating(true);
    try {
      let providerId = form.providerId;
      if (useZAI) {
        const existingZAI = providers.find((p: any) => p.provider === 'z-ai');
        if (existingZAI) {
          providerId = existingZAI.id;
        } else {
          try {
            await api.quickstartSetup();
            const providersResult = await api.getProviders();
            const zaiProvider = (providersResult.providers || []).find((p: any) => p.provider === 'z-ai');
            if (zaiProvider) {
              providerId = zaiProvider.id;
              setProviders(providersResult.providers || []);
            }
          } catch {
            toast.warning(t('agents.noProvider'));
          }
        }
      }
      const createData: any = {
        name: form.name,
        description: form.description,
        systemPrompt: form.systemPrompt || undefined,
        mode: form.mode,
        providerId: providerId || undefined,
        model: form.model || undefined,
        temperature: Math.round(form.temperature * 10) / 10,
        maxTokens: form.maxTokens,
        isPublic: form.isPublic,
      };
      if (form.mode === 'acrp') {
        createData.agentType = form.agentType;
        createData.agentVersion = form.agentVersion || undefined;
      }
      const result = await api.createAgent(createData);
      setAgents([result.agent, ...agents]);
      setShowCreate(false);
      setValidationErrors({});
      setCreateStep(1);

      // Auto-install selected skills
      if (selectedSkillIds.length > 0 && result.agent?.id) {
        for (const skillId of selectedSkillIds) {
          try {
            await api.installSkill(skillId, { agentId: result.agent.id });
          } catch {
            // Skip individual skill installation failures
          }
        }
      }

      if (form.mode === 'acrp') {
        setCreatedAcrpAgent(result.agent);
        setShowAcrpSuccess(true);
      }

      setForm({ ...defaultAgentForm });
      setSelectedSkillIds([]);
      if (form.mode !== 'acrp') {
        toast.success(t('agents.created'));
        try {
          const convResult = await api.createConversation({ agentId: result.agent.id });
          const convs = await api.getConversations();
          setConversations(convs.conversations || []);
          setSelectedConversationId(convResult.conversation.id);
          setCurrentView('chat');
        } catch {
          // Navigation to chat is optional
        }
      }
    } catch (error: any) {
      const errMsg = error?.message || 'Unknown error';
      toast.error(`${t('agents.createTitle')}: ${errMsg}`);
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
    if (!editingAgent) return;
    if (!validateForm()) return;
    setSaving(true);
    try {
      const updateData: any = { ...form, providerId: form.providerId || undefined, model: form.model || undefined };
      if (form.mode === 'acrp') {
        updateData.agentType = form.agentType;
        updateData.agentVersion = form.agentVersion || undefined;
      }
      const result = await api.updateAgent(editingAgent.id, updateData);
      setAgents(agents.map((a: any) => a.id === editingAgent.id ? result.agent : a));
      setShowEdit(false);
      setEditingAgent(null);
      setForm({ ...defaultAgentForm });
      setValidationErrors({});
      toast.success(t('agents.updated'));
    } catch (error: any) {
      toast.error(error?.message || 'Unknown error');
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

  const handleStartChat = async (agent: any) => {
    try {
      const convResult = await api.createConversation({ agentId: agent.id });
      const convs = await api.getConversations();
      setConversations(convs.conversations || []);
      setSelectedConversationId(convResult.conversation.id);
      setCurrentView('chat');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to start chat');
    }
  };

  const handleViewDetail = (agentId: string) => {
    setSelectedAgentId(agentId);
    setCurrentView('agent-detail');
  };

  // ─── Provider CRUD ───────────────────────────────
  const [showProviderCreate, setShowProviderCreate] = useState(false);
  const [creatingProvider, setCreatingProvider] = useState(false);
  const [showProviderEdit, setShowProviderEdit] = useState(false);
  const [editingProvider, setEditingProvider] = useState<any>(null);
  const [savingProvider, setSavingProvider] = useState(false);
  const [providerForm, setProviderForm] = useState<ProviderForm>({ ...defaultProviderForm });
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [showProviderDelete, setShowProviderDelete] = useState(false);
  const [deletingProvider, setDeletingProvider] = useState<any>(null);

  const handleProviderTypeChange = (type: string) => {
    const pt = PROVIDER_TYPES.find(p => p.value === type);
    setProviderForm({
      ...providerForm,
      provider: type,
      baseUrl: pt?.defaultUrl || '',
      defaultModel: pt?.defaultModel || '',
    });
  };

  const handleCreateProvider = async () => {
    if (!providerForm.name.trim()) {
      toast.error(t('common.required'));
      return;
    }
    setCreatingProvider(true);
    try {
      const result = await api.createProvider({
        ...providerForm,
        models: JSON.stringify([]),
        config: JSON.stringify({}),
      });
      setProviders([result.provider, ...providers]);
      setShowProviderCreate(false);
      setProviderForm({ ...defaultProviderForm });
      toast.success(t('providers.created'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreatingProvider(false);
    }
  };

  const handleEditProvider = (provider: any) => {
    setEditingProvider(provider);
    setProviderForm({
      name: provider.name || '',
      provider: provider.provider || 'openai',
      apiKey: provider.apiKey || '',
      baseUrl: provider.baseUrl || '',
      defaultModel: provider.defaultModel || '',
      isActive: provider.isActive !== false,
    });
    setShowProviderEdit(true);
  };

  const handleUpdateProvider = async () => {
    if (!editingProvider || !providerForm.name.trim()) {
      toast.error(t('common.required'));
      return;
    }
    setSavingProvider(true);
    try {
      const result = await api.updateProvider(editingProvider.id, {
        ...providerForm,
        models: JSON.stringify([]),
        config: JSON.stringify({}),
      });
      setProviders(providers.map((p: any) => p.id === editingProvider.id ? result.provider : p));
      setShowProviderEdit(false);
      setEditingProvider(null);
      setProviderForm({ ...defaultProviderForm });
      toast.success(t('providers.updated'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSavingProvider(false);
    }
  };

  const handleTestProvider = async (id: string) => {
    setTesting(id);
    try {
      const result = await api.testProvider(id);
      setTestResults({ ...testResults, [id]: result });
      if (result.success) {
        toast.success(t('providers.connectionSuccess'));
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      setTestResults({ ...testResults, [id]: { success: false, message: error.message } });
      toast.error(error.message);
    } finally {
      setTesting(null);
    }
  };

  const handleDeleteProvider = async () => {
    if (!deletingProvider) return;
    try {
      await api.deleteProvider(deletingProvider.id);
      setProviders(providers.filter((p: any) => p.id !== deletingProvider.id));
      toast.success(t('providers.deleted'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setShowProviderDelete(false);
      setDeletingProvider(null);
    }
  };

  // ─── Skills state ────────────────────────────────
  const [skillSearch, setSkillSearch] = useState('');
  const [agentSkills, setAgentSkills] = useState<any[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [installingSkill, setInstallingSkill] = useState<string | null>(null);

  // Get the currently selected agent (or first agent) for skill toggle context
  const activeAgentId = useMemo(() => {
    const { selectedAgentId } = useAppStore.getState();
    return selectedAgentId || (agents.length > 0 ? agents[0].id : null);
  }, [agents]);

  const loadAgentSkills = useCallback(async () => {
    if (agents.length === 0) return;
    setLoadingSkills(true);
    try {
      const allSkills: any[] = [];
      for (const agent of agents) {
        try {
          const res = await api.getAgentSkills(agent.id);
          const mapped = (res.skills || []).map((s: any) => ({ ...s, agentId: agent.id, agentName: agent.name }));
          allSkills.push(...mapped);
        } catch {
          // skip
        }
      }
      setAgentSkills(allSkills);
    } finally {
      setLoadingSkills(false);
    }
  }, [agents]);

  useEffect(() => {
    loadAgentSkills();
  }, [loadAgentSkills]);

  const filteredSkills = useMemo(() => {
    const q = skillSearch.toLowerCase();
    return skills.filter((s: any) => {
      return !q || (s.displayName || s.name || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q);
    });
  }, [skills, skillSearch]);

  const isSkillInstalledForAgent = useCallback((skillId: string, agentId: string | null) => {
    if (!agentId) return false;
    return agentSkills.some((as: any) => as.skillId === skillId && as.agentId === agentId);
  }, [agentSkills]);

  const handleToggleSkill = async (skillId: string, agentId: string) => {
    const isInstalled = isSkillInstalledForAgent(skillId, agentId);
    const skillName = skills.find((s: any) => s.id === skillId)?.displayName || skills.find((s: any) => s.id === skillId)?.name || 'Skill';
    const agentName = agents.find((a: any) => a.id === agentId)?.name || '';
    setInstallingSkill(skillId);
    try {
      if (isInstalled) {
        await api.uninstallSkill(skillId, agentId);
        toast.success(t('skills.uninstalledFor', { skill: skillName, agent: agentName }));
      } else {
        await api.installSkill(skillId, { agentId });
        toast.success(t('skills.installedFor', { skill: skillName, agent: agentName }));
      }
      loadAgentSkills();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setInstallingSkill(null);
    }
  };

  // Count enabled skills for active agent
  const enabledSkillCount = useMemo(() => {
    if (!activeAgentId) return 0;
    return agentSkills.filter((as: any) => as.agentId === activeAgentId).length;
  }, [agentSkills, activeAgentId]);

  // ─── Agent status helpers ────────────────────────
  const getStatusDot = (agent: any) => {
    const status = agentStatuses[agent.id]?.status || agent.status || 'offline';
    const isAcrp = agent.mode === 'acrp';
    const wsConnected = agentStatuses[agent.id]?.wsConnected;
    if (isAcrp) return wsConnected ? 'online' : 'offline';
    if (status === 'online') return 'online';
    if (status === 'busy') return 'busy';
    if (status === 'error') return 'error';
    return 'offline';
  };

  const statusDotColors: Record<string, string> = {
    online: 'bg-emerald-500',
    busy: 'bg-amber-500',
    error: 'bg-rose-500',
    offline: 'bg-gray-300',
  };

  const modeGradients: Record<string, string> = {
    builtin: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    acrp: 'bg-gradient-to-r from-cyan-500 to-cyan-400',
  };

  const modeLabels: Record<string, string> = {
    builtin: t('agents.modeBuiltinShort'),
    acrp: t('agents.modeAcrpShort'),
  };

  const modeColors: Record<string, string> = {
    builtin: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    acrp: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
  };

  const getProviderName = (providerId: string) => {
    const p = providers.find((prov: any) => prov.id === providerId);
    return p?.name || p?.provider || '';
  };

  // ─── Edit form renderer ──────────────────────────
  const renderEditFormFields = () => (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>{t('agents.nameLabel')} *</Label>
        <Input
          placeholder={t('agents.namePlaceholder')}
          value={form.name}
          onChange={(e) => { setForm({ ...form, name: e.target.value }); if (validationErrors.name) setValidationErrors({ ...validationErrors, name: '' }); }}
          className={cn(validationErrors.name && 'border-red-500 focus-visible:ring-red-500')}
        />
        {validationErrors.name && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {validationErrors.name}</p>}
      </div>
      <div className="space-y-2">
        <Label>{t('agents.descriptionLabel')} {form.mode === 'acrp' && '*'}</Label>
        <Textarea
          placeholder={t('agents.descriptionPlaceholder')}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label>{t('agents.modeLabel')}</Label>
        <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })} disabled>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="builtin">{t('agents.modeBuiltin')}</SelectItem>
            <SelectItem value="acrp">{t('agents.modeAcrp')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {form.mode === 'builtin' && (
        <>
          <div className="space-y-2">
            <Label>{t('agents.providerLabel')}</Label>
            <Select value={form.providerId} onValueChange={(v) => setForm({ ...form, providerId: v })}>
              <SelectTrigger><SelectValue placeholder={t('agents.providerPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {providers.length === 0 ? (
                  <SelectItem value="none" disabled>{t('agents.noProviders')}</SelectItem>
                ) : providers.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.provider})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('agents.modelOverride')}</Label>
            <Input placeholder={t('agents.modelOverridePlaceholder')} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('agents.temperature')}: {Math.round(form.temperature * 10) / 10}</Label>
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
        <p className="text-xs text-muted-foreground">{form.systemPrompt.length}/4000</p>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.isPublic} onCheckedChange={(v) => setForm({ ...form, isPublic: v })} />
        <Label>{t('agents.isPublic')}</Label>
      </div>
      <Button onClick={handleUpdate} className="w-full" disabled={saving}>
        {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('agents.saving')}</> : t('agents.save')}
      </Button>
    </div>
  );

  // ─── Render ──────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="w-6 h-6" /> {t('agents.panelTitle')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t('agents.panelSubtitle')}</p>
      </div>

      {/* ════════════════════════════════════════════════════════
          SECTION 1: 我的智能体 (My Agents) — always visible
          ════════════════════════════════════════════════════════ */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-semibold">{t('agents.myAgents')}</h2>
            <Badge variant="outline" className="text-xs">{agents.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('agents.searchPlaceholder')}
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => { setShowCreate(true); setCreateStep(1); setForm({ ...defaultAgentForm }); setSelectedSkillIds([]); setUseZAI(true); setValidationErrors({}); }}
            >
              <Plus className="w-4 h-4" /> {t('agents.createAgent')}
            </Button>
          </div>
        </div>

        {agents.length === 0 ? (
          <Card className="border-dashed">
            <EmptyState
              icon={Bot}
              title={t('agents.noAgents')}
              description={t('agents.noAgentsDesc')}
              actionLabel={t('agents.createAgent')}
              onAction={() => { setShowCreate(true); setCreateStep(1); }}
            />
          </Card>
        ) : filteredAgents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="w-10 h-10 text-muted-foreground mb-3" />
              <h3 className="text-sm font-semibold mb-1">{t('common.noResults')}</h3>
              <p className="text-muted-foreground text-xs">{t('agents.searchPlaceholder')}</p>
            </CardContent>
          </Card>
        ) : (
          <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent: any) => {
              const statusKey = getStatusDot(agent);
              const isAcrp = agent.mode === 'acrp';
              const skillCount = agent.skills?.length || 0;
              const agentEmoji = isAcrp ? (AGENT_EMOJIS[agent.agentType] || AGENT_EMOJIS['custom']) : null;
              const providerName = getProviderName(agent.providerId);

              return (
                <StaggerItem key={agent.id}>
                <Card
                  key={agent.id}
                  className="group relative overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                  onClick={() => handleViewDetail(agent.id)}
                >
                  <div className={cn('h-1 w-full', modeGradients[agent.mode] || 'bg-gradient-to-r from-gray-400 to-gray-300')} />
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg shrink-0 relative">
                        {agentEmoji || '🤖'}
                        <span className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background', statusDotColors[statusKey])} />
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold truncate">{agent.name}</h3>
                          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 shrink-0', modeColors[agent.mode])}>
                            {modeLabels[agent.mode]}
                          </Badge>
                        </div>
                        {agent.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{agent.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                          {skillCount > 0 && (
                            <span className="flex items-center gap-0.5"><Sparkles className="w-3 h-3" /> {t('agents.skillCount', { count: skillCount })}</span>
                          )}
                          {providerName && (
                            <span className="flex items-center gap-0.5"><Brain className="w-3 h-3" /> {providerName}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 text-xs h-8"
                        onClick={(e) => { e.stopPropagation(); handleStartChat(agent); }}
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> {t('agents.startChat')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 shrink-0"
                        onClick={(e) => { e.stopPropagation(); handleEdit(agent); }}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 shrink-0 text-muted-foreground hover:text-rose-500"
                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(agent); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                </StaggerItem>
              );
            })}
          </StaggerList>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════
          SECTION 2: AI 模型 (AI Models) — collapsible
          ════════════════════════════════════════════════════════ */}
      <section className="mb-6">
        <button
          className="flex items-center gap-2 w-full text-left group py-2"
          onClick={() => toggleSection('models')}
        >
          {expandedSections.models ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform" />
          )}
          <Brain className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold">{t('agents.aiModels')}</h2>
          <Badge variant="outline" className="text-xs">{providers.length}</Badge>
        </button>

        {expandedSections.models && (
          <div className="mt-3 space-y-4">
            <div className="flex items-center justify-end">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => { setShowProviderCreate(true); setProviderForm({ ...defaultProviderForm }); }}
              >
                <Plus className="w-4 h-4" /> {t('agents.addModel')}
              </Button>
            </div>

            {providers.length === 0 ? (
              <Card className="border-dashed">
                <EmptyState
                  icon={Server}
                  title={t('agents.noProviders')}
                  description={t('providers.noProvidersDesc')}
                  actionLabel={t('agents.addModel')}
                  onAction={() => setShowProviderCreate(true)}
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {providers.map((provider: any) => {
                  const pt = PROVIDER_TYPES.find(p => p.value === provider.provider);
                  const testResult = testResults[provider.id];
                  const isZAI = provider.provider === 'z-ai';

                  return (
                    <motion.div key={provider.id} whileHover={{ scale: 1.02 }} transition={{ duration: 0.15 }}>
                    <Card className="hover:shadow-md transition-shadow rounded-xl">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-lg shrink-0">
                            {pt?.icon || '🔧'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold truncate">{provider.name}</h3>
                              {isZAI ? (
                                <Badge className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                                  {t('agents.builtIn')}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                                  {pt ? t(pt.labelKey) : provider.provider}
                                </Badge>
                              )}
                              {provider.isActive === false && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-amber-600 border-amber-200">{t('common.inactive')}</Badge>
                              )}
                            </div>
                            {provider.defaultModel && (
                              <p className="text-xs font-mono text-muted-foreground mt-1">{provider.defaultModel}</p>
                            )}
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs h-7"
                            onClick={() => handleTestProvider(provider.id)}
                            disabled={testing === provider.id}
                          >
                            {testing === provider.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <TestTube className="w-3 h-3" />}
                            {testing === provider.id ? t('providers.testing') : t('providers.testConnection')}
                          </Button>
                          <div className="flex items-center gap-1">
                            {testResult && (
                              testResult.success
                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                : <XCircle className="w-4 h-4 text-rose-500" />
                            )}
                            <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleEditProvider(provider)}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            {!isZAI && (
                              <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-rose-500" onClick={() => { setDeletingProvider(provider); setShowProviderDelete(true); }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {testResult && !testResult.success && (
                          <p className="text-xs text-rose-500 mt-1 line-clamp-1">{testResult.message}</p>
                        )}
                      </CardContent>
                    </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════
          SECTION 3: 可用技能 (Available Skills) — collapsible
          ════════════════════════════════════════════════════════ */}
      <section className="mb-6">
        <button
          className="flex items-center gap-2 w-full text-left group py-2"
          onClick={() => toggleSection('skills')}
        >
          {expandedSections.skills ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform" />
          )}
          <Sparkles className="w-5 h-5 text-violet-500" />
          <h2 className="text-lg font-semibold">{t('agents.availableSkills')}</h2>
          <Badge variant="outline" className="text-xs">
            {enabledSkillCount}/{skills.length} {t('agents.skillCountEnabled')}
          </Badge>
        </button>

        {expandedSections.skills && (
          <div className="mt-3 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('skills.searchPlaceholder')}
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>

            {activeAgentId && (
              <p className="text-xs text-muted-foreground">
                {t('agents.skillToggleHint')} <span className="font-medium">{agents.find((a: any) => a.id === activeAgentId)?.name || ''}</span>
              </p>
            )}

            {filteredSkills.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Puzzle className="w-10 h-10 text-muted-foreground mb-3" />
                  <h3 className="text-sm font-semibold mb-1">{t('agents.noSkills')}</h3>
                  <p className="text-muted-foreground text-xs">{t('skills.tryDifferentSearch')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredSkills.map((skill: any) => {
                  const isInstalled = isSkillInstalledForAgent(skill.id, activeAgentId);
                  const categoryColor = CATEGORY_BADGE_COLORS[skill.category] || CATEGORY_BADGE_COLORS.utility;
                  const categoryLabel = CATEGORY_KEYS[skill.category] ? t(CATEGORY_KEYS[skill.category]) : skill.category;
                  const skillIcon = SKILL_ICON_MAP[skill.icon] || '🧩';
                  const isToggling = installingSkill === skill.id;
                  const skillStatus = SKILL_STATUS_MAP[skill.name] || 'active';
                  const isComingSoon = skillStatus === 'coming-soon';
                  const isBeta = skillStatus === 'beta';

                  return (
                    <Card
                      key={skill.id}
                      className={cn(
                        'flex flex-col overflow-hidden transition-all duration-200',
                        isComingSoon && 'opacity-70',
                        isInstalled && !isComingSoon ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10' : 'hover:shadow-md',
                      )}
                    >
                      <CardContent className="p-3 flex-1 flex flex-col">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm shrink-0">
                            {skillIcon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-medium truncate">{skill.displayName || skill.name}</h3>
                              {isComingSoon && (
                                <Badge className="text-[8px] h-4 px-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 shrink-0">
                                  {t('skills.comingSoon')}
                                </Badge>
                              )}
                              {isBeta && (
                                <Badge className="text-[8px] h-4 px-1 bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800 shrink-0">
                                  {t('skills.beta')}
                                </Badge>
                              )}
                            </div>
                            <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 mt-1', categoryColor)}>
                              {categoryLabel}
                            </Badge>
                          </div>
                        </div>
                        {skill.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-2 flex-1">
                            {isComingSoon ? t('skills.comingSoonDesc', { skill: skill.displayName || skill.name }) : skill.description}
                          </p>
                        )}
                        {/* Toggle button */}
                        <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-end">
                          {isComingSoon ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 text-xs h-7 text-muted-foreground cursor-not-allowed"
                                  disabled
                                >
                                  <Clock className="w-3 h-3" />
                                  {t('skills.comingSoon')}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{t('skills.comingSoonTooltip', { skill: skill.displayName || skill.name })}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : activeAgentId ? (
                            <Button
                              size="sm"
                              variant={isInstalled ? 'outline' : 'default'}
                              className={cn(
                                'gap-1.5 text-xs h-7',
                                isInstalled && 'text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30',
                              )}
                              onClick={() => handleToggleSkill(skill.id, activeAgentId)}
                              disabled={isToggling}
                            >
                              {isToggling ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : isInstalled ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <Plus className="w-3 h-3" />
                              )}
                              {isInstalled ? t('agents.enabled') : t('agents.disabled')}
                            </Button>
                          ) : (
                            <p className="text-xs text-muted-foreground">{t('agents.noAgents')}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════
          DIALOGS
          ════════════════════════════════════════════════════════ */}

      {/* Create Agent Wizard Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) { setForm({ ...defaultAgentForm }); setValidationErrors({}); setCreateStep(1); setSelectedSkillIds([]); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('agents.createTitle')}</DialogTitle>
            <DialogDescription className="sr-only">{t('agents.createTitle')}</DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-2 mb-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 transition-colors',
                  createStep === step ? 'bg-primary text-primary-foreground' :
                  createStep > step ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                )}>
                  {createStep > step ? <Check className="w-3.5 h-3.5" /> : step}
                </div>
                <span className={cn(
                  'text-xs hidden sm:inline',
                  createStep === step ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}>
                  {step === 1 ? t('agents.stepName') : step === 2 ? t('agents.stepModel') : t('agents.stepSkills')}
                </span>
                {step < 3 && <div className={cn('flex-1 h-0.5', createStep > step ? 'bg-emerald-500' : 'bg-muted')} />}
              </div>
            ))}
          </div>

          {/* Step 1: Name + Description */}
          {createStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('agents.nameLabel')} *</Label>
                <Input
                  placeholder={t('agents.namePlaceholder')}
                  value={form.name}
                  onChange={(e) => { setForm({ ...form, name: e.target.value }); if (validationErrors.name) setValidationErrors({ ...validationErrors, name: '' }); }}
                  className={cn(validationErrors.name && 'border-red-500 focus-visible:ring-red-500')}
                />
                {validationErrors.name && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {validationErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('agents.descriptionLabel')}</Label>
                <Textarea
                  placeholder={t('agents.descriptionPlaceholder')}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('agents.modeLabel')}</Label>
                <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="builtin">{t('agents.modeBuiltin')}</SelectItem>
                    <SelectItem value="acrp">{t('agents.modeAcrp')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => { if (!form.name.trim()) { setValidationErrors({ name: t('agents.nameRequired') }); return; } setCreateStep(2); }}>
                {t('agents.nextStep')} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Step 2: AI Model */}
          {createStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div
                  className={cn('p-4 rounded-lg border-2 cursor-pointer transition-all', useZAI ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30')}
                  onClick={() => setUseZAI(true)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">Z-AI {t('agents.builtIn')}</p>
                      <p className="text-xs text-muted-foreground">{t('agents.zaiDescription')}</p>
                    </div>
                    {useZAI && <Check className="w-5 h-5 text-primary shrink-0" />}
                  </div>
                </div>
                <div
                  className={cn('p-4 rounded-lg border-2 cursor-pointer transition-all', !useZAI ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30')}
                  onClick={() => setUseZAI(false)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{t('agents.customProvider')}</p>
                      <p className="text-xs text-muted-foreground">{t('agents.customProviderDesc')}</p>
                    </div>
                    {!useZAI && <Check className="w-5 h-5 text-primary shrink-0" />}
                  </div>
                </div>
              </div>
              {!useZAI && (
                <div className="space-y-3">
                  <Label>{t('agents.providerLabel')}</Label>
                  {providers.filter((p: any) => p.provider !== 'z-ai').length === 0 ? (
                    <div className="p-4 rounded-lg border border-dashed border-border bg-muted/30 text-center space-y-2">
                      <Server className="w-6 h-6 text-muted-foreground/50 mx-auto" />
                      <p className="text-xs text-muted-foreground">{t('agents.noProviders')}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => { setShowCreate(false); setShowProviderCreate(true); }}
                      >
                        <Plus className="w-3 h-3" /> {t('agents.addModel')}
                      </Button>
                      <p className="text-[10px] text-muted-foreground">{t('agents.orUseBuiltIn')}</p>
                    </div>
                  ) : (
                    <Select value={form.providerId} onValueChange={(v) => setForm({ ...form, providerId: v })}>
                      <SelectTrigger><SelectValue placeholder={t('agents.providerPlaceholder')} /></SelectTrigger>
                      <SelectContent>
                        {providers.filter((p: any) => p.provider !== 'z-ai').map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name} ({p.provider})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="space-y-2">
                    <Label>{t('agents.modelOverride')}</Label>
                    <Input placeholder={t('agents.modelOverridePlaceholder')} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setCreateStep(1)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> {t('agents.prevStep')}
                </Button>
                <Button className="flex-1" onClick={() => setCreateStep(3)}>
                  {t('agents.nextStep')} <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Capabilities / Skills — BUG FIX: skills properly destructured from store */}
          {createStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('agents.selectSkillsDesc')}</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {skills
                  .filter((s: any) => s.category === 'builtin' || s.category === 'communication' || s.category === 'search' || s.category === 'productivity')
                  .slice(0, 12)
                  .map((skill: any) => {
                    const isSelected = selectedSkillIds.includes(skill.id);
                    const isDefault = skill.name === 'web-search' || skill.name === 'translation';
                    return (
                      <div
                        key={skill.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer',
                          isSelected ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30'
                        )}
                        onClick={() => {
                          setSelectedSkillIds(prev =>
                            isSelected ? prev.filter(id => id !== skill.id) : [...prev, skill.id]
                          );
                        }}
                      >
                        <Checkbox checked={isSelected} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{skill.displayName || skill.name}</span>
                            {isDefault && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1 text-emerald-600 border-emerald-200">
                                {t('agents.recommended')}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">{skill.description || ''}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setCreateStep(2)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> {t('agents.prevStep')}
                </Button>
                <Button className="flex-1" onClick={handleCreate} disabled={creating}>
                  {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('agents.creatingAgent')}</> : t('agents.createAndChat')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Agent Dialog */}
      <Dialog open={showEdit} onOpenChange={(open) => { setShowEdit(open); if (!open) { setEditingAgent(null); setForm({ ...defaultAgentForm }); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('agents.editTitle')}</DialogTitle>
            <DialogDescription className="sr-only">{t('agents.editTitle')}</DialogDescription>
          </DialogHeader>
          {renderEditFormFields()}
        </DialogContent>
      </Dialog>

      {/* Delete Agent Confirmation Dialog */}
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
            <Input placeholder={deletingAgent?.name || ''} value={deleteConfirmName} onChange={(e) => setDeleteConfirmName(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setDeletingAgent(null); setDeleteConfirmName(''); }}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteConfirmName !== deletingAgent?.name || deleting}>
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
            <DialogDescription>{t('agents.agentCreatedDesc')}</DialogDescription>
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
            <Button variant="outline" className="w-full" onClick={() => { setShowAcrpSuccess(false); setCreatedAcrpAgent(null); }}>
              {t('agents.generateLater')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Provider Dialog */}
      <Dialog open={showProviderCreate} onOpenChange={setShowProviderCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('providers.addTitle')}</DialogTitle>
            <DialogDescription className="sr-only">{t('providers.addTitle')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t('providers.providerName')} *</Label>
              <Input placeholder={t('providers.providerNamePlaceholder')} value={providerForm.name} onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('providers.providerType')}</Label>
              <Select value={providerForm.provider} onValueChange={handleProviderTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDER_TYPES.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value}>{pt.icon} {t(pt.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {providerForm.provider !== 'z-ai' && (
              <>
                <div className="space-y-2">
                  <Label>{t('providers.apiKey')}</Label>
                  <Input type="password" placeholder="sk-..." value={providerForm.apiKey} onChange={(e) => setProviderForm({ ...providerForm, apiKey: e.target.value })} />
                </div>
                {['openai', 'ollama', 'custom'].includes(providerForm.provider) && (
                  <div className="space-y-2">
                    <Label>{t('providers.baseUrl')}</Label>
                    <Input placeholder={PROVIDER_TYPES.find(p => p.value === providerForm.provider)?.defaultUrl} value={providerForm.baseUrl} onChange={(e) => setProviderForm({ ...providerForm, baseUrl: e.target.value })} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t('providers.defaultModel')}</Label>
                  <Input placeholder="e.g., gpt-4o" value={providerForm.defaultModel} onChange={(e) => setProviderForm({ ...providerForm, defaultModel: e.target.value })} />
                </div>
              </>
            )}
            <Button onClick={handleCreateProvider} className="w-full" disabled={creatingProvider}>
              {creatingProvider ? `${t('providers.add')}...` : t('providers.add')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Provider Dialog */}
      <Dialog open={showProviderEdit} onOpenChange={(open) => { setShowProviderEdit(open); if (!open) { setEditingProvider(null); setProviderForm({ ...defaultProviderForm }); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('providers.editTitle')}</DialogTitle>
            <DialogDescription className="sr-only">{t('providers.editTitle')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t('providers.providerName')} *</Label>
              <Input placeholder={t('providers.providerNamePlaceholder')} value={providerForm.name} onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('providers.providerType')}</Label>
              <Select value={providerForm.provider} onValueChange={handleProviderTypeChange} disabled>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDER_TYPES.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value}>{pt.icon} {t(pt.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {providerForm.provider !== 'z-ai' && (
              <>
                <div className="space-y-2">
                  <Label>{t('providers.apiKey')}</Label>
                  <Input type="password" placeholder="sk-..." value={providerForm.apiKey} onChange={(e) => setProviderForm({ ...providerForm, apiKey: e.target.value })} />
                </div>
                {['openai', 'ollama', 'custom'].includes(providerForm.provider) && (
                  <div className="space-y-2">
                    <Label>{t('providers.baseUrl')}</Label>
                    <Input placeholder={PROVIDER_TYPES.find(p => p.value === providerForm.provider)?.defaultUrl} value={providerForm.baseUrl} onChange={(e) => setProviderForm({ ...providerForm, baseUrl: e.target.value })} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t('providers.defaultModel')}</Label>
                  <Input placeholder="e.g., gpt-4o" value={providerForm.defaultModel} onChange={(e) => setProviderForm({ ...providerForm, defaultModel: e.target.value })} />
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={providerForm.isActive} onCheckedChange={(v) => setProviderForm({ ...providerForm, isActive: v })} />
              <Label>{t('providers.isActive')}</Label>
            </div>
            <Button onClick={handleUpdateProvider} className="w-full" disabled={savingProvider}>
              {savingProvider ? t('providers.saving') : t('providers.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Provider Confirmation Dialog */}
      <Dialog open={showProviderDelete} onOpenChange={(open) => { setShowProviderDelete(open); if (!open) setDeletingProvider(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('providers.deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('providers.deleteConfirmDesc')}</DialogDescription>
          </DialogHeader>
          {deletingProvider && (
            <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 text-destructive text-sm">
              <Trash2 className="w-4 h-4 shrink-0" />
              <span className="font-medium">{deletingProvider.name}</span>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowProviderDelete(false); setDeletingProvider(null); }}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteProvider}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
