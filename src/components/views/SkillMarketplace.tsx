'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Puzzle, Search, Plus, Download, Check, Code, CloudSun, FileText, Globe,
  BarChart3, Mail, Bell, Volume2, Database, Image, Languages, Zap,
  Copy, Link2, Activity, Settings2, Play, ExternalLink, ChevronRight,
  Shield, Heart, Terminal, BookOpen, ArrowRight, Eye, EyeOff,
  Wifi, WifiOff, Radio, Server, Cable, Globe as GlobeIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Icon & Category Maps ──────────────────────────────────────

const iconMap: Record<string, React.ElementType> = {
  Search, Code, Image, FileText, Languages, Bell, Globe, BarChart3, Mail, Volume2, Database, CloudSun, Zap, Puzzle,
};

const categoryColors: Record<string, string> = {
  communication: 'bg-blue-500/10 text-blue-600 border-blue-200',
  productivity: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  development: 'bg-violet-500/10 text-violet-600 border-violet-200',
  data: 'bg-amber-500/10 text-amber-600 border-amber-200',
  media: 'bg-rose-500/10 text-rose-600 border-rose-200',
  utility: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
};

const categoryBadgeColors: Record<string, string> = {
  communication: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  productivity: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  development: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  data: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  media: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  utility: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

const handlerTypeColors: Record<string, string> = {
  builtin: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  webhook: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  websocket: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  streaming: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
};

const CATEGORY_KEYS: Record<string, string> = {
  all: 'skills.categoryAll',
  communication: 'skills.categoryCommunication',
  productivity: 'skills.categoryProductivity',
  development: 'skills.categoryDevelopment',
  data: 'skills.categoryData',
  media: 'skills.categoryMedia',
  utility: 'skills.categoryUtility',
};

// ─── Connection Mode type ────────────────────────────────────

type ConnectionMode = 'websocket' | 'http_callback' | 'hybrid';

interface ConnectionInfo {
  endpointToken: string | null;
  callbackUrl: string | null;
  callbackSecret: string | null;
  wsStatus: { connected: boolean; lastHeartbeat: string | null; socketId: string | null };
  wsConnectUrl: string | null;
  connectionMode: string;
}

// ─── Status Indicator ──────────────────────────────────────────

function StatusDot({ status, pulse }: { status: 'connected' | 'registering' | 'disconnected' | 'error'; pulse?: boolean }) {
  const colorMap: Record<string, string> = {
    connected: 'bg-green-500',
    registering: 'bg-yellow-500',
    disconnected: 'bg-gray-400',
    error: 'bg-red-500',
  };
  const labelMap: Record<string, string> = {
    connected: 'skillProtocol.wsConnected',
    registering: 'skillProtocol.wsRegistering',
    disconnected: 'skillProtocol.wsDisconnected',
    error: 'skillProtocol.wsError',
  };
  const { t } = useI18n();
  const color = colorMap[status] || 'bg-gray-400';
  const label = t(labelMap[status] || 'skillProtocol.wsDisconnected');

  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2.5 w-2.5">
        {pulse && status === 'connected' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        )}
        <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5 shrink-0', color)} />
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Copy Button ───────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t('common.copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={handleCopy}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {label && <span>{label}</span>}
    </Button>
  );
}

// ─── Monospace Field ───────────────────────────────────────────

function MonospaceField({ value, masked, label, copyLabel }: { value: string; masked?: boolean; label: string; copyLabel?: string }) {
  const [show, setShow] = useState(false);
  const display = masked && !show ? value.slice(0, 8) + '••••••••' : value;

  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md font-mono break-all select-all">
          {display}
        </code>
        {masked && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => setShow(!show)}>
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </Button>
        )}
        <CopyButton text={value} label={copyLabel} />
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────

export function SkillMarketplace() {
  const { skills, agents } = useAppStore();
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [installing, setInstalling] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('store');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState('all');

  // My Skills state
  const [agentSkills, setAgentSkills] = useState<any[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [generatingEndpoint, setGeneratingEndpoint] = useState<string | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState<string | null>(null);
  const [configJson, setConfigJson] = useState('{}');

  // WebSocket connection info per binding
  const [connectionInfos, setConnectionInfos] = useState<Record<string, ConnectionInfo>>({});
  const [loadingConnectionInfo, setLoadingConnectionInfo] = useState<Record<string, boolean>>({});
  const [httpCallbackExpanded, setHttpCallbackExpanded] = useState<Record<string, boolean>>({});

  // Generate endpoint dialog
  const [generatedEndpoint, setGeneratedEndpoint] = useState<{
    url: string; token: string; callbackSecret: string;
    wsConnectUrl: string; wsDirectUrl: string; connectionMode: string;
  } | null>(null);
  const [showEndpointDialog, setShowEndpointDialog] = useState(false);

  // Callback editing state
  const [editingCallback, setEditingCallback] = useState<string | null>(null);
  const [callbackUrlValue, setCallbackUrlValue] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  // Refresh interval ref
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const EVENT_OPTIONS = ['message', 'command', 'status', 'heartbeat', 'tool_call', 'tool_result'];

  // Load installed skills when My Skills tab is selected
  const loadInstalledSkills = useCallback(async () => {
    if (selectedAgentFilter === 'all') {
      setLoadingSkills(true);
      try {
        const allSkills: any[] = [];
        for (const agent of agents) {
          try {
            const res = await api.getAgentSkills(agent.id);
            const mapped = (res.skills || []).map((s: any) => ({
              ...s,
              agentId: agent.id,
              agentName: agent.name,
            }));
            allSkills.push(...mapped);
          } catch {
            // skip agents with no skills
          }
        }
        setAgentSkills(allSkills);
      } finally {
        setLoadingSkills(false);
      }
    } else {
      setLoadingSkills(true);
      try {
        const res = await api.getAgentSkills(selectedAgentFilter);
        const agent = agents.find((a: any) => a.id === selectedAgentFilter);
        const mapped = (res.skills || []).map((s: any) => ({
          ...s,
          agentId: selectedAgentFilter,
          agentName: agent?.name || '',
        }));
        setAgentSkills(mapped);
      } catch {
        setAgentSkills([]);
      } finally {
        setLoadingSkills(false);
      }
    }
  }, [selectedAgentFilter, agents]);

  // Load connection info for a specific binding
  const loadConnectionInfo = useCallback(async (agentId: string, skillId: string) => {
    const key = `${agentId}-${skillId}`;
    setLoadingConnectionInfo((prev) => ({ ...prev, [key]: true }));
    try {
      const info = await api.getSkillConnectionInfo(agentId, skillId);
      setConnectionInfos((prev) => ({ ...prev, [key]: info }));
    } catch {
      // Connection info may not be available yet
    } finally {
      setLoadingConnectionInfo((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  // Load all connection infos for installed skills
  const loadAllConnectionInfos = useCallback(async () => {
    for (const as of agentSkills) {
      await loadConnectionInfo(as.agentId, as.skillId);
    }
  }, [agentSkills, loadConnectionInfo]);

  useEffect(() => {
    if (activeTab === 'mySkills') {
      loadInstalledSkills();
    }
  }, [activeTab, loadInstalledSkills]);

  // Auto-refresh connection info periodically
  useEffect(() => {
    if (activeTab === 'mySkills' && agentSkills.length > 0) {
      loadAllConnectionInfos();
      refreshIntervalRef.current = setInterval(loadAllConnectionInfos, 15000);
      return () => {
        if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      };
    }
  }, [activeTab, agentSkills.length, loadAllConnectionInfos]);

  const categories = useMemo(() => {
    const cats = new Set(skills.map((s: any) => s.category));
    return ['all', ...Array.from(cats)];
  }, [skills]);

  const filteredSkills = useMemo(() => {
    return skills.filter((s: any) => {
      const matchesSearch = !search ||
        s.displayName.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [skills, search, selectedCategory]);

  // Group agent skills by agent
  const groupedAgentSkills = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const sk of agentSkills) {
      const key = sk.agentId;
      if (!groups[key]) groups[key] = [];
      groups[key].push(sk);
    }
    return groups;
  }, [agentSkills]);

  const handleInstall = async (skillId: string, agentId: string) => {
    setInstalling(skillId);
    try {
      await api.installSkill(skillId, { agentId });
      toast.success(t('skills.installed'));
      setShowInstall(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setInstalling(null);
    }
  };

  const handleGenerateEndpoint = async (agentId: string, skillId: string) => {
    const bindingKey = `${agentId}-${skillId}`;
    setGeneratingEndpoint(bindingKey);
    try {
      const res = await api.generateSkillEndpoint(agentId, skillId);
      setGeneratedEndpoint({
        url: res.endpointUrl,
        token: res.endpointToken,
        callbackSecret: res.callbackSecret,
        wsConnectUrl: res.wsConnectUrl || '/?XTransformPort=3004',
        wsDirectUrl: res.wsDirectUrl || 'ws://localhost:3004/',
        connectionMode: res.connectionMode || 'websocket',
      });
      setShowEndpointDialog(true);
      toast.success(t('skillProtocol.endpointGenerated'));
      loadInstalledSkills();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setGeneratingEndpoint(null);
    }
  };

  const handleRegenerateEndpoint = async (agentId: string, skillId: string) => {
    const bindingKey = `${agentId}-${skillId}`;
    setGeneratingEndpoint(bindingKey);
    try {
      const res = await api.regenerateSkillEndpoint(agentId, skillId);
      setGeneratedEndpoint({
        url: res.endpointUrl,
        token: res.endpointToken,
        callbackSecret: res.callbackSecret,
        wsConnectUrl: res.wsConnectUrl || '/?XTransformPort=3004',
        wsDirectUrl: res.wsDirectUrl || 'ws://localhost:3004/',
        connectionMode: res.connectionMode || 'websocket',
      });
      setShowEndpointDialog(true);
      toast.success(t('skillProtocol.endpointRegenerated'));
      loadInstalledSkills();
      loadConnectionInfo(agentId, skillId);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setGeneratingEndpoint(null);
    }
  };

  const handleTestConnection = async (agentId: string, skillId: string, endpointToken: string) => {
    try {
      const connInfo = connectionInfos[`${agentId}-${skillId}`];
      if (connInfo?.wsStatus.connected) {
        toast.info(t('skillProtocol.testingWs'));
      }
      await api.testSkillConnection(agentId, skillId);
      toast.success(t('skillProtocol.testSent'));
    } catch (error: any) {
      toast.error(t('skillProtocol.testFailed') + ': ' + error.message);
    }
  };

  const handleSaveCallback = async (agentId: string, skillId: string) => {
    try {
      await api.updateAgentSkill(agentId, skillId, {
        callbackUrl: callbackUrlValue,
        subscribedEvents: selectedEvents,
      });
      toast.success(t('skillProtocol.callbackSaved'));
      setEditingCallback(null);
      loadInstalledSkills();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleToggleSkill = async (agentId: string, skillId: string, enabled: boolean) => {
    try {
      await api.updateAgentSkill(agentId, skillId, { enabled });
      toast.success(enabled ? t('skillProtocol.skillEnabled') : t('skillProtocol.skillDisabled'));
      loadInstalledSkills();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleUpdatePriority = async (agentId: string, skillId: string, priority: number) => {
    try {
      await api.updateAgentSkill(agentId, skillId, { priority });
      loadInstalledSkills();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSaveConfig = async (agentId: string, skillId: string) => {
    try {
      const parsed = JSON.parse(configJson);
      await api.updateAgentSkill(agentId, skillId, { config: parsed });
      toast.success(t('skillProtocol.configSaved'));
      setShowConfigDialog(null);
      loadInstalledSkills();
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        toast.error(t('skillProtocol.invalidJson'));
      } else {
        toast.error(error.message);
      }
    }
  };

  const getSkillById = (id: string) => skills.find((s: any) => s.id === id);

  // ─── Tab 1: Skill Store ────────────────────────────────────

  const renderSkillStore = () => (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('skills.searchPlaceholder')}
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setSelectedCategory(cat)}
            >
              {CATEGORY_KEYS[cat] ? t(CATEGORY_KEYS[cat]) : cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Skills Grid */}
      {filteredSkills.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Puzzle className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('skills.noSkillsTitle')}</h3>
            <p className="text-muted-foreground text-sm">{t('skills.noSkillsDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSkills.map((skill: any) => {
            const Icon = iconMap[skill.icon] || Puzzle;
            const installedCount = agentSkills.filter((as: any) => as.skillId === skill.id).length;

            return (
              <Card
                key={skill.id}
                className="hover:shadow-md transition-all duration-200 flex flex-col cursor-pointer group"
                onClick={() => setShowDetail(skill.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border', categoryColors[skill.category] || 'bg-accent')}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm group-hover:text-primary transition-colors">{skill.displayName}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', categoryBadgeColors[skill.category] || '')}>
                          {CATEGORY_KEYS[skill.category] ? t(CATEGORY_KEYS[skill.category]) : skill.category}
                        </Badge>
                        {skill.handlerType && (
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', handlerTypeColors[skill.handlerType] || '')}>
                            {skill.handlerType}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-xs text-muted-foreground line-clamp-3 mb-4 flex-1">
                    {skill.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">v{skill.version}</span>
                      {installedCount > 0 && (
                        <span className="text-[10px] text-emerald-600">{t('skillProtocol.installedOnAgents', { count: installedCount })}</span>
                      )}
                    </div>
                    <Dialog open={showInstall === skill.id} onOpenChange={(v) => { setShowInstall(v ? skill.id : null); }}>
                      <DialogContent onClick={(e) => e.stopPropagation()}>
                        <DialogHeader>
                          <DialogTitle>{t('common.install')} {skill.displayName}</DialogTitle>
                          <DialogDescription>{t('skills.installTo', { skill: skill.displayName })}</DialogDescription>
                        </DialogHeader>
                        {agents.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">{t('skills.noAgents')}</p>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {agents.map((agent: any) => (
                              <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent">
                                <div>
                                  <p className="text-sm font-medium">{agent.name}</p>
                                  <p className="text-xs text-muted-foreground">{agent.mode}</p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleInstall(skill.id, agent.id)}
                                  disabled={installing === skill.id}
                                  className="gap-1"
                                >
                                  {installing === skill.id ? <Zap className="w-3 h-3 animate-pulse" /> : <Plus className="w-3 h-3" />}
                                  {t('common.install')}
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      onClick={(e) => { e.stopPropagation(); setShowInstall(skill.id); }}
                    >
                      <Download className="w-3 h-3" /> {t('common.install')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  // ─── Tab 2: My Skills (MAJOR REDESIGN) ──────────────────────

  const renderMySkills = () => (
    <div className="space-y-6">
      {/* Agent selector */}
      <div className="flex items-center gap-4">
        <Label className="text-sm font-medium shrink-0">{t('skillProtocol.selectAgent')}</Label>
        <Select value={selectedAgentFilter} onValueChange={setSelectedAgentFilter}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('skillProtocol.allAgents')}</SelectItem>
            {agents.map((agent: any) => (
              <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={loadInstalledSkills} className="gap-1">
          <Activity className="w-3 h-3" /> {t('common.refresh')}
        </Button>
      </div>

      {loadingSkills ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : agentSkills.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Puzzle className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('skillProtocol.noInstalledSkills')}</h3>
            <p className="text-muted-foreground text-sm">{t('skillProtocol.noInstalledSkillsDesc')}</p>
            <Button variant="outline" size="sm" className="mt-4 gap-1" onClick={() => setActiveTab('store')}>
              <ChevronRight className="w-3 h-3" /> {t('skillProtocol.store')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedAgentSkills).map(([agentId, skillsList]) => {
            const agent = agents.find((a: any) => a.id === agentId);
            return (
              <div key={agentId} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{agent?.name || agentId}</h3>
                  <Badge variant="outline" className="text-xs">{skillsList.length} {t('skills.title').toLowerCase()}</Badge>
                </div>
                <div className="space-y-4">
                  {skillsList.map((agentSkill: any) => {
                    const skillDef = getSkillById(agentSkill.skillId) || agentSkill;
                    const Icon = iconMap[skillDef.icon] || Puzzle;
                    const bindingKey = `${agentId}-${agentSkill.skillId}`;
                    const endpointToken = agentSkill.endpointToken || '';
                    const callbackSecret = agentSkill.callbackSecret || '';
                    const callbackUrl = agentSkill.callbackUrl || '';
                    const subscribedEvents: string[] = agentSkill.subscribedEvents || [];
                    const priority = agentSkill.priority ?? 0;
                    const enabled = agentSkill.enabled !== false;
                    const hasEndpoint = !!endpointToken;

                    const connInfo = connectionInfos[bindingKey];
                    const isLoadingConn = loadingConnectionInfo[bindingKey];
                    const wsConnected = connInfo?.wsStatus?.connected || false;
                    const wsLastHeartbeat = connInfo?.wsStatus?.lastHeartbeat;
                    const wsSocketId = connInfo?.wsStatus?.socketId;
                    const wsConnectUrl = connInfo?.wsConnectUrl || '/?XTransformPort=3004';
                    const connectionMode = connInfo?.connectionMode || agentSkill.connectionMode || 'websocket';
                    const isHttpCallbackExpanded = httpCallbackExpanded[bindingKey] || false;
                    const isEditingCallback = editingCallback === bindingKey;

                    const wsStatus: 'connected' | 'registering' | 'disconnected' | 'error' = wsConnected ? 'connected' : (hasEndpoint ? 'disconnected' : 'disconnected');

                    return (
                      <Card key={bindingKey} className="overflow-hidden">
                        <CardContent className="p-4 space-y-4">
                          {/* Header row */}
                          <div className="flex items-start gap-3">
                            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border', categoryColors[skillDef.category] || 'bg-accent')}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{skillDef.displayName || agentSkill.skillId}</span>
                                {skillDef.handlerType && (
                                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', handlerTypeColors[skillDef.handlerType] || '')}>
                                    {skillDef.handlerType}
                                  </Badge>
                                )}
                                <StatusDot status={wsStatus} pulse={wsConnected} />
                              </div>
                              {skillDef.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{skillDef.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1.5">
                                <Label className="text-xs text-muted-foreground">{enabled ? t('skillProtocol.enableSkill') : t('skillProtocol.disableSkill')}</Label>
                                <Switch
                                  checked={enabled}
                                  onCheckedChange={(checked) => handleToggleSkill(agentId, agentSkill.skillId, checked)}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Connection Mode Selector */}
                          <div className="flex items-center gap-3">
                            <Label className="text-xs font-medium text-muted-foreground shrink-0">{t('skillProtocol.connectionMode')}</Label>
                            <Select
                              value={connectionMode}
                              onValueChange={async (mode) => {
                                try {
                                  await api.updateAgentSkill(agentId, agentSkill.skillId, { connectionMode: mode });
                                  toast.success(t('skillProtocol.connectionModeUpdated'));
                                  loadInstalledSkills();
                                  loadConnectionInfo(agentId, agentSkill.skillId);
                                } catch (error: any) {
                                  toast.error(error.message);
                                }
                              }}
                            >
                              <SelectTrigger className="w-48 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="websocket">
                                  <div className="flex items-center gap-2">
                                    <Wifi className="w-3 h-3" />
                                    <span>WebSocket</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="http_callback">
                                  <div className="flex items-center gap-2">
                                    <GlobeIcon className="w-3 h-3" />
                                    <span>HTTP Callback</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="hybrid">
                                  <div className="flex items-center gap-2">
                                    <Cable className="w-3 h-3" />
                                    <span>Hybrid</span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* ─── WebSocket Section (PRIMARY) ─── */}
                          {(connectionMode === 'websocket' || connectionMode === 'hybrid') && (
                            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{t('skillProtocol.wsConnection')}</span>
                                {wsConnected && (
                                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[10px] px-1.5 py-0">
                                    <Radio className="w-2.5 h-2.5 mr-1" /> Live
                                  </Badge>
                                )}
                              </div>

                              {hasEndpoint ? (
                                <>
                                  {/* Connection URL */}
                                  <MonospaceField
                                    label={t('skillProtocol.wsConnectUrl')}
                                    value={wsConnectUrl}
                                    copyLabel={t('skillProtocol.copyUrl')}
                                  />

                                  {/* Direct URL */}
                                  <MonospaceField
                                    label={t('skillProtocol.wsDirectUrl')}
                                    value="ws://localhost:3004/"
                                    copyLabel={t('skillProtocol.copyUrl')}
                                  />

                                  {/* Endpoint Token */}
                                  <MonospaceField
                                    label={t('skillProtocol.endpointToken')}
                                    value={endpointToken}
                                    masked
                                    copyLabel={t('skillProtocol.copyToken')}
                                  />

                                  {/* Quick Connect Link */}
                                  <div className="space-y-1">
                                    <Label className="text-xs font-medium text-muted-foreground">{t('skillProtocol.quickConnectLink')}</Label>
                                    <div className="flex items-center gap-2">
                                      <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md font-mono break-all select-all border border-dashed">
                                        {wsConnectUrl}#token={endpointToken}
                                      </code>
                                      <Button
                                        variant="default"
                                        size="sm"
                                        className="gap-1 text-xs shrink-0 bg-emerald-600 hover:bg-emerald-700"
                                        onClick={() => {
                                          const link = `${wsConnectUrl}#token=${endpointToken}`;
                                          navigator.clipboard.writeText(link);
                                          toast.success(t('skillProtocol.connectLinkCopied'));
                                        }}
                                      >
                                        <Copy className="w-3 h-3" /> {t('skillProtocol.copyConnectLink')}
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Connection Status */}
                                  <div className="flex items-center gap-4 flex-wrap pt-2 border-t border-emerald-200 dark:border-emerald-800">
                                    <div className="flex items-center gap-2">
                                      {wsConnected ? (
                                        <Wifi className="w-4 h-4 text-emerald-500" />
                                      ) : (
                                        <WifiOff className="w-4 h-4 text-gray-400" />
                                      )}
                                      <span className="text-xs font-medium">{wsConnected ? t('skillProtocol.wsConnected') : t('skillProtocol.wsDisconnected')}</span>
                                    </div>
                                    {wsLastHeartbeat && (
                                      <div className="flex items-center gap-1">
                                        <Heart className="w-3 h-3 text-red-400" />
                                        <span className="text-xs text-muted-foreground">{t('skillProtocol.lastHeartbeat')}: {new Date(wsLastHeartbeat).toLocaleTimeString()}</span>
                                      </div>
                                    )}
                                    {wsSocketId && (
                                      <div className="flex items-center gap-1">
                                        <Server className="w-3 h-3 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground font-mono">{wsSocketId}</span>
                                      </div>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="gap-1 text-xs h-6 px-2"
                                      onClick={() => loadConnectionInfo(agentId, agentSkill.skillId)}
                                      disabled={isLoadingConn}
                                    >
                                      <Activity className="w-3 h-3" /> {t('skillProtocol.refreshStatus')}
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <div className="flex flex-col items-center gap-3 py-4">
                                  <Cable className="w-8 h-8 text-muted-foreground" />
                                  <p className="text-sm text-muted-foreground">{t('skillProtocol.noEndpointYet')}</p>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="gap-1"
                                    disabled={generatingEndpoint === bindingKey}
                                    onClick={() => handleGenerateEndpoint(agentId, agentSkill.skillId)}
                                  >
                                    {generatingEndpoint === bindingKey ? (
                                      <Zap className="w-3 h-3 animate-pulse" />
                                    ) : (
                                      <Link2 className="w-3 h-3" />
                                    )}
                                    {t('skillProtocol.generateEndpoint')}
                                  </Button>
                                </div>
                              )}

                              {/* Regenerate endpoint */}
                              {hasEndpoint && (
                                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1 text-xs"
                                    disabled={generatingEndpoint === bindingKey}
                                    onClick={() => handleRegenerateEndpoint(agentId, agentSkill.skillId)}
                                  >
                                    {generatingEndpoint === bindingKey ? (
                                      <Zap className="w-3 h-3 animate-pulse" />
                                    ) : (
                                      <Link2 className="w-3 h-3" />
                                    )}
                                    {t('skillProtocol.regenerateEndpoint')}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ─── HTTP Callback Section (SECONDARY, collapsed) ─── */}
                          {(connectionMode === 'http_callback' || connectionMode === 'hybrid') && (
                            <div className="rounded-lg border border-border bg-muted/30 p-3">
                              <button
                                className="flex items-center gap-2 w-full text-left"
                                onClick={() => setHttpCallbackExpanded((prev) => ({ ...prev, [bindingKey]: !prev[bindingKey] }))}
                              >
                                <GlobeIcon className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{t('skillProtocol.httpCallback')}</span>
                                <ChevronRight className={cn('w-3 h-3 transition-transform', isHttpCallbackExpanded && 'rotate-90')} />
                                {callbackUrl && !isHttpCallbackExpanded && (
                                  <code className="text-xs text-muted-foreground font-mono truncate ml-2">{callbackUrl}</code>
                                )}
                              </button>
                              {isHttpCallbackExpanded && (
                                <div className="mt-3 space-y-3">
                                  {isEditingCallback ? (
                                    <div className="space-y-3">
                                      <Input
                                        value={callbackUrlValue}
                                        onChange={(e) => setCallbackUrlValue(e.target.value)}
                                        placeholder="https://your-agent.com/callback"
                                        className="text-sm"
                                      />
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">{t('skillProtocol.events')}</Label>
                                        <div className="flex flex-wrap gap-2">
                                          {EVENT_OPTIONS.map((evt) => (
                                            <div key={evt} className="flex items-center gap-1.5">
                                              <Checkbox
                                                id={`evt-${bindingKey}-${evt}`}
                                                checked={selectedEvents.includes(evt)}
                                                onCheckedChange={(checked) => {
                                                  if (checked) {
                                                    setSelectedEvents([...selectedEvents, evt]);
                                                  } else {
                                                    setSelectedEvents(selectedEvents.filter((e) => e !== evt));
                                                  }
                                                }}
                                              />
                                              <Label htmlFor={`evt-${bindingKey}-${evt}`} className="text-xs cursor-pointer">{evt}</Label>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button size="sm" onClick={() => handleSaveCallback(agentId, agentSkill.skillId)}>{t('skillProtocol.saveCallback')}</Button>
                                        <Button size="sm" variant="outline" onClick={() => setEditingCallback(null)}>{t('common.cancel')}</Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md font-mono truncate">
                                          {callbackUrl || '—'}
                                        </code>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="gap-1 text-xs shrink-0"
                                          onClick={() => {
                                            setEditingCallback(bindingKey);
                                            setCallbackUrlValue(callbackUrl);
                                            setSelectedEvents(subscribedEvents.length > 0 ? subscribedEvents : ['message']);
                                          }}
                                        >
                                          <Settings2 className="w-3 h-3" /> {t('skillProtocol.configureCallback')}
                                        </Button>
                                      </div>
                                      {callbackSecret && (
                                        <MonospaceField
                                          label={t('skillProtocol.callbackSecret')}
                                          value={callbackSecret}
                                          masked
                                          copyLabel={t('skillProtocol.copySecret')}
                                        />
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* ─── Controls row ─── */}
                          <div className="flex items-center gap-3 flex-wrap pt-1 border-t">
                            {/* Priority */}
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground">{t('skillProtocol.priority')}</Label>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={priority}
                                onChange={(e) => handleUpdatePriority(agentId, agentSkill.skillId, parseInt(e.target.value) || 0)}
                                className="w-16 h-7 text-xs text-center"
                              />
                            </div>

                            <div className="flex-1" />

                            {/* Test Connection */}
                            {hasEndpoint && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-xs"
                                onClick={() => handleTestConnection(agentId, agentSkill.skillId, endpointToken)}
                              >
                                <Play className="w-3 h-3" /> {t('skillProtocol.testConnection')}
                              </Button>
                            )}

                            {/* Configure Skill */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-xs"
                              onClick={() => {
                                setShowConfigDialog(bindingKey);
                                try {
                                  setConfigJson(JSON.stringify(agentSkill.config || {}, null, 2));
                                } catch {
                                  setConfigJson('{}');
                                }
                              }}
                            >
                              <Settings2 className="w-3 h-3" /> {t('skillProtocol.configureSkill')}
                            </Button>

                            {/* Uninstall */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-xs text-destructive hover:text-destructive"
                              onClick={async () => {
                                try {
                                  await api.uninstallSkill(agentSkill.skillId, agentId);
                                  toast.success(t('common.uninstall'));
                                  loadInstalledSkills();
                                } catch (error: any) {
                                  toast.error(error.message);
                                }
                              }}
                            >
                              {t('common.uninstall')}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Generate/Regenerate Endpoint Dialog */}
      <Dialog open={showEndpointDialog} onOpenChange={(v) => { if (!v) { setShowEndpointDialog(false); setGeneratedEndpoint(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-500" />
              {t('skillProtocol.endpointGenerated')}
            </DialogTitle>
            <DialogDescription>{t('skillProtocol.endpointGeneratedDesc')}</DialogDescription>
          </DialogHeader>
          {generatedEndpoint && (
            <div className="space-y-4">
              {/* WebSocket Connection URL */}
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">WebSocket</span>
                </div>
                <MonospaceField
                  label={t('skillProtocol.wsConnectUrl')}
                  value={generatedEndpoint.wsConnectUrl}
                  copyLabel={t('skillProtocol.copyUrl')}
                />
                <MonospaceField
                  label={t('skillProtocol.wsDirectUrl')}
                  value={generatedEndpoint.wsDirectUrl}
                  copyLabel={t('skillProtocol.copyUrl')}
                />
              </div>

              <MonospaceField
                label={t('skillProtocol.endpointToken')}
                value={generatedEndpoint.token}
                masked
                copyLabel={t('skillProtocol.copyToken')}
              />
              <MonospaceField
                label={t('skillProtocol.callbackSecret')}
                value={generatedEndpoint.callbackSecret}
                masked
                copyLabel={t('skillProtocol.copySecret')}
              />

              <Separator />

              {/* Quick Connect Link */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">{t('skillProtocol.quickConnectLink')}</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md font-mono break-all select-all">
                    {generatedEndpoint.wsConnectUrl}#token={generatedEndpoint.token}
                  </code>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1 text-xs shrink-0"
                    onClick={() => {
                      const link = `${generatedEndpoint.wsConnectUrl}#token=${generatedEndpoint.token}`;
                      navigator.clipboard.writeText(link);
                      toast.success(t('skillProtocol.connectLinkCopied'));
                    }}
                  >
                    <Copy className="w-3 h-3" /> {t('skillProtocol.copyConnectLink')}
                  </Button>
                </div>
              </div>

              {/* Code snippet */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">{t('skillProtocol.codeSnippet')}</Label>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto font-mono">
{`// Connect via Socket.IO
import { io } from 'socket.io-client';

const socket = io('${generatedEndpoint.wsConnectUrl}', {
  auth: { endpointToken: '${generatedEndpoint.token}' }
});

socket.on('connect', () => {
  socket.emit('skill:register', {
    name: 'my-agent',
    capabilities: ['search']
  });
});`}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Skill Config Dialog */}
      <Dialog open={!!showConfigDialog} onOpenChange={(v) => { if (!v) setShowConfigDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('skillProtocol.skillConfig')}</DialogTitle>
            <DialogDescription>{t('skillProtocol.configureSkill')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              className="font-mono text-xs min-h-[200px]"
              placeholder="{}"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowConfigDialog(null)}>{t('common.cancel')}</Button>
              <Button size="sm" onClick={() => {
                const bindingKey = showConfigDialog!;
                const parts = bindingKey.split('-');
                const aId = parts[0];
                const sId = parts.slice(1).join('-');
                handleSaveConfig(aId, sId);
              }}>{t('common.save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  // ─── Tab 3: Protocol Docs (REDESIGNED for WebSocket) ──────

  const renderProtocolDocs = () => (
    <div className="space-y-6 max-w-4xl">
      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            {t('skillProtocol.quickStart')}
          </CardTitle>
          <CardDescription>{t('skillProtocol.quickStartDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {['1', '2', '3', '4'].map((step) => (
            <div key={step} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                {step}
              </span>
              <p className="text-sm mt-0.5">{t(`skillProtocol.quickStartStep${step}`)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Protocol Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Shield className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-xs text-muted-foreground">{t('skillProtocol.protocolVersion')}</p>
            <p className="text-lg font-bold">2.0.0</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Heart className="w-6 h-6 mx-auto mb-2 text-red-500" />
            <p className="text-xs text-muted-foreground">{t('skillProtocol.heartbeatInterval')}</p>
            <p className="text-lg font-bold">30s</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Wifi className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
            <p className="text-xs text-muted-foreground">{t('skillProtocol.transport')}</p>
            <p className="text-lg font-bold">WebSocket</p>
          </CardContent>
        </Card>
      </div>

      {/* WebSocket Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cable className="w-4 h-4" />
            {t('skillProtocol.wsConnectionGuide')}
          </CardTitle>
          <CardDescription>{t('skillProtocol.wsConnectionGuideDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible defaultValue="javascript">
            <AccordionItem value="javascript">
              <AccordionTrigger className="text-sm flex items-center gap-2">
                <Code className="w-4 h-4" /> JavaScript / TypeScript (socket.io-client)
              </AccordionTrigger>
              <AccordionContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto font-mono whitespace-pre-wrap">
{`import { io } from 'socket.io-client';

const socket = io('/?XTransformPort=3004', {
  auth: {
    endpointToken: 'sk_your_endpoint_token_here'
  }
});

socket.on('connect', () => {
  console.log('Connected to Hermes Hub!');
  
  // Register this agent
  socket.emit('skill:register', {
    name: 'my-agent',
    version: '1.0.0',
    capabilities: ['search', 'code_generation'],
    platform: 'hermes-agent'
  });
});

// Receive tool calls from the hub
socket.on('skill:invoke', (data) => {
  console.log('Tool call received:', data);
  
  // Process the tool call...
  const result = executeSkill(data.skillName, data.params);
  
  // Send result back
  socket.emit('skill:invoke-response', {
    requestId: data.requestId,
    result: { response: result }
  });
});

// Send heartbeat
setInterval(() => {
  socket.emit('skill:heartbeat', {
    status: 'online',
    metrics: { uptime: process.uptime() }
  });
}, 30000);

// Send proactive messages
socket.emit('skill:event', {
  type: 'message',
  data: {
    conversationId: 'conv_xxx',
    content: 'Hello from my agent!'
  }
});

socket.on('disconnect', () => {
  console.log('Disconnected from Hermes Hub');
});`}
                </pre>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="python">
              <AccordionTrigger className="text-sm flex items-center gap-2">
                <Terminal className="w-4 h-4" /> Python (python-socketio)
              </AccordionTrigger>
              <AccordionContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto font-mono whitespace-pre-wrap">
{`import socketio

sio = socketio.SimpleClient()

@sio.on('connect')
def on_connect():
    print('Connected to Hermes Hub!')
    sio.emit('skill:register', {
        'name': 'my-agent',
        'version': '1.0.0',
        'capabilities': ['search', 'code_generation'],
        'platform': 'hermes-agent'
    })

@sio.on('skill:invoke')
def on_invoke(data):
    print(f'Tool call: {data["skillName"]}')
    result = execute_skill(data['skillName'], data['params'])
    sio.emit('skill:invoke-response', {
        'requestId': data['requestId'],
        'result': {'response': result}
    })

sio.connect('ws://localhost:3004', 
    socketio_path='/',
    auth={'endpointToken': 'sk_your_token_here'})`}
                </pre>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="curl">
              <AccordionTrigger className="text-sm flex items-center gap-2">
                <Globe className="w-4 h-4" /> HTTP API (fallback)
              </AccordionTrigger>
              <AccordionContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto font-mono whitespace-pre-wrap">
{`# Register a skill endpoint
curl -X POST https://your-domain/api/skill-protocol/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "endpointToken": "sk_your_token_here",
    "agentInfo": {
      "name": "my-agent",
      "callbackUrl": "https://your-agent.com/callback",
      "capabilities": ["search"]
    }
  }'

# Send an event
curl -X POST https://your-domain/api/skill-protocol/events \\
  -H "Authorization: Bearer sk_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": {
      "type": "message",
      "data": {"text": "Hello from external agent"}
    }
  }'

# Send heartbeat
curl -X POST https://your-domain/api/skill-protocol/heartbeat \\
  -H "Content-Type: application/json" \\
  -d '{
    "endpointToken": "sk_your_token_here",
    "status": "alive"
  }'`}
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Event Types Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4" />
            {t('skillProtocol.eventTypes')}
          </CardTitle>
          <CardDescription>{t('skillProtocol.eventTypesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="min-w-[500px]">
              <div className="grid grid-cols-[1fr_120px_2fr] gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                <span>Event</span>
                <span>Direction</span>
                <span>Description</span>
              </div>
              {[
                { event: 'skill:register', dir: 'Agent → Hub', desc: 'Register agent capabilities after connecting' },
                { event: 'skill:registered', dir: 'Hub → Agent', desc: 'Registration confirmed with assigned agent ID' },
                { event: 'skill:heartbeat', dir: 'Agent → Hub', desc: 'Send heartbeat to maintain connection (every 30s)' },
                { event: 'skill:heartbeat-ack', dir: 'Hub → Agent', desc: 'Heartbeat acknowledged with server time' },
                { event: 'skill:invoke', dir: 'Hub → Agent', desc: 'Tool call from LLM — agent should process and respond' },
                { event: 'skill:invoke-response', dir: 'Agent → Hub', desc: 'Tool result response back to the hub' },
                { event: 'skill:event', dir: 'Agent → Hub', desc: 'General event (message, status update, proactive msg)' },
                { event: 'skill:event-ack', dir: 'Hub → Agent', desc: 'Event acknowledged with event ID' },
                { event: 'skill:notification', dir: 'Hub → Agent', desc: 'Notification from hub (config update, system msg)' },
              ].map(({ event, dir, desc }) => (
                <div key={event} className="grid grid-cols-[1fr_120px_2fr] gap-2 text-xs py-2 border-b border-border/50 items-center">
                  <code className="font-mono font-medium text-primary/80">{event}</code>
                  <Badge variant="outline" className={cn(
                    'text-[10px] px-1.5 py-0 w-fit',
                    dir.startsWith('Agent') ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                  )}>
                    {dir}
                  </Badge>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Supported Platforms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="w-4 h-4" />
            {t('skillProtocol.supportedPlatforms')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                name: 'hermes-agent',
                desc: 'Python-based AI agent framework with built-in Socket.IO client',
                icon: Terminal,
                color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
              },
              {
                name: 'openclaw',
                desc: 'Open source agent framework supporting WebSocket connections',
                icon: Code,
                color: 'bg-violet-500/10 text-violet-600 border-violet-200',
              },
              {
                name: 'Custom',
                desc: 'Any WebSocket/Socket.IO client can connect using the protocol',
                icon: Cable,
                color: 'bg-amber-500/10 text-amber-600 border-amber-200',
              },
            ].map(({ name, desc, icon: PlatformIcon, color }) => (
              <div key={name} className="flex items-start gap-3 p-4 rounded-lg border border-border">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border', color)}>
                  <PlatformIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            {t('skillProtocol.authentication')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('skillProtocol.authDesc')}</p>
          <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto font-mono whitespace-pre-wrap">
{`// Socket.IO authentication
const socket = io('/?XTransformPort=3004', {
  auth: {
    endpointToken: 'sk_your_endpoint_token_here'
  }
});

// The token is validated on connection.
// Invalid tokens will be rejected with a connect_error event.

socket.on('connect_error', (err) => {
  console.error('Connection failed:', err.message);
});`}
          </pre>
        </CardContent>
      </Card>

      {/* Heartbeat Protocol */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Heart className="w-4 h-4" />
            {t('skillProtocol.heartbeatProtocol')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('skillProtocol.heartbeatDesc')}</p>
          <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto font-mono whitespace-pre-wrap">
{`// Send heartbeat every 30 seconds
setInterval(() => {
  socket.emit('skill:heartbeat', {
    status: 'online',
    metrics: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().heapUsed
    }
  });
}, 30000);

// Receive heartbeat acknowledgement
socket.on('skill:heartbeat-ack', (data) => {
  console.log('Heartbeat acknowledged:', data.serverTime);
});`}
          </pre>
        </CardContent>
      </Card>

      {/* Message Format */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('skillProtocol.messageFormat')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible defaultValue="invoke">
            <AccordionItem value="invoke">
              <AccordionTrigger className="text-sm">skill:invoke (Hub → Agent)</AccordionTrigger>
              <AccordionContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto font-mono whitespace-pre-wrap">
{`{
  "requestId": "req_abc123",
  "skillName": "web_search",
  "params": {
    "query": "latest news about AI"
  },
  "conversationId": "conv_xxx",
  "timestamp": "2024-01-15T10:30:00Z"
}`}
                </pre>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="invoke-response">
              <AccordionTrigger className="text-sm">skill:invoke-response (Agent → Hub)</AccordionTrigger>
              <AccordionContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto font-mono whitespace-pre-wrap">
{`{
  "requestId": "req_abc123",
  "result": {
    "response": "Search results for AI news...",
    "sources": ["https://..."]
  }
}`}
                </pre>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="event">
              <AccordionTrigger className="text-sm">skill:event (Agent → Hub)</AccordionTrigger>
              <AccordionContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto font-mono whitespace-pre-wrap">
{`{
  "type": "message",
  "data": {
    "conversationId": "conv_xxx",
    "content": "Hello from my agent!"
  }
}`}
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );

  // ─── Skill Detail Dialog ────────────────────────────────────

  const renderSkillDetail = () => {
    const skill = getSkillById(showDetail || '');
    if (!skill) return null;
    const Icon = iconMap[skill.icon] || Puzzle;
    const installedCount = agentSkills.filter((as: any) => as.skillId === skill.id).length;

    return (
      <Dialog open={!!showDetail} onOpenChange={(v) => { if (!v) setShowDetail(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center border', categoryColors[skill.category] || 'bg-accent')}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <span>{skill.displayName}</span>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className={cn('text-[10px]', categoryBadgeColors[skill.category] || '')}>
                    {CATEGORY_KEYS[skill.category] ? t(CATEGORY_KEYS[skill.category]) : skill.category}
                  </Badge>
                  <Badge variant="outline" className={cn('text-[10px]', handlerTypeColors[skill.handlerType] || '')}>
                    {skill.handlerType}
                  </Badge>
                  <span className="text-xs text-muted-foreground">v{skill.version}</span>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Description */}
            <div>
              <h4 className="text-sm font-semibold mb-1">{t('common.description')}</h4>
              <p className="text-sm text-muted-foreground">{skill.description}</p>
            </div>

            {/* Installed indicator */}
            <div className="flex items-center gap-2">
              {installedCount > 0 ? (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Check className="w-3 h-3" />
                  {t('skillProtocol.installedOnAgents', { count: installedCount })}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">{t('skillProtocol.notInstalled')}</Badge>
              )}
            </div>

            <Separator />

            {/* Parameters */}
            {skill.parameters && (
              <div>
                <h4 className="text-sm font-semibold mb-2">{t('skillProtocol.parameters')}</h4>
                <div className="space-y-2">
                  {typeof skill.parameters === 'object' && skill.parameters.properties ? (
                    Object.entries(skill.parameters.properties).map(([key, schema]: [string, any]) => (
                      <div key={key} className="flex items-start gap-3 p-2 rounded-md bg-muted/50">
                        <code className="text-xs font-mono font-medium shrink-0">{key}</code>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">{schema.type || 'any'}</span>
                          {schema.description && <span className="ml-2">— {schema.description}</span>}
                          {skill.parameters.required?.includes(key) && (
                            <Badge variant="outline" className="ml-2 text-[10px] py-0">{t('common.required')}</Badge>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <pre className="text-xs bg-muted p-3 rounded-md font-mono overflow-x-auto">
                      {JSON.stringify(skill.parameters, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* Config Schema */}
            {skill.configSchema && (
              <div>
                <h4 className="text-sm font-semibold mb-2">{t('skillProtocol.configSchema')}</h4>
                <pre className="text-xs bg-muted p-3 rounded-md font-mono overflow-x-auto max-h-48">
                  {typeof skill.configSchema === 'string' ? skill.configSchema : JSON.stringify(skill.configSchema, null, 2)}
                </pre>
              </div>
            )}

            {/* Handler Type */}
            <div>
              <h4 className="text-sm font-semibold mb-1">{t('skillProtocol.handlerType')}</h4>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn('text-xs', handlerTypeColors[skill.handlerType] || '')}>
                  {skill.handlerType}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {t(`skillProtocol.handlerTypes.${skill.handlerType}` as any) || skill.handlerType}
                </span>
              </div>
            </div>

            <Separator />

            {/* Install button */}
            <Dialog open={showInstall === skill.id && showDetail === skill.id} onOpenChange={(v) => { if (!v) setShowInstall(null); }}>
              <Button className="w-full gap-1" onClick={() => setShowInstall(skill.id)}>
                <Download className="w-4 h-4" /> {t('skillProtocol.installToAgent')}
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('common.install')} {skill.displayName}</DialogTitle>
                  <DialogDescription>{t('skills.installTo', { skill: skill.displayName })}</DialogDescription>
                </DialogHeader>
                {agents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t('skills.noAgents')}</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {agents.map((agent: any) => (
                      <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent">
                        <div>
                          <p className="text-sm font-medium">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">{agent.mode}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleInstall(skill.id, agent.id)}
                          disabled={installing === skill.id}
                          className="gap-1"
                        >
                          {installing === skill.id ? <Zap className="w-3 h-3 animate-pulse" /> : <Plus className="w-3 h-3" />}
                          {t('common.install')}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('skillProtocol.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('skillProtocol.subtitle')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="store" className="gap-1.5">
            <Puzzle className="w-3.5 h-3.5" />
            {t('skillProtocol.store')}
          </TabsTrigger>
          <TabsTrigger value="mySkills" className="gap-1.5">
            <Settings2 className="w-3.5 h-3.5" />
            {t('skillProtocol.mySkills')}
          </TabsTrigger>
          <TabsTrigger value="protocolDocs" className="gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            {t('skillProtocol.protocolDocs')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="store">{renderSkillStore()}</TabsContent>
        <TabsContent value="mySkills">{renderMySkills()}</TabsContent>
        <TabsContent value="protocolDocs">{renderProtocolDocs()}</TabsContent>
      </Tabs>

      {renderSkillDetail()}
    </div>
  );
}
