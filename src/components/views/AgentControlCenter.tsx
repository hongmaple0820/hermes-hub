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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Monitor, Wifi, WifiOff, Radio, Copy, Check, Play, RotateCcw, RefreshCw,
  Settings2, ChevronRight, Terminal, Eye, EyeOff, Clock, Zap, Activity,
  Bot, Server, Cable, Globe, Code, BookOpen, ArrowRight, Shield,
  MessageSquare, Database, Brain, Cpu, Heart, Star, Send, AlertTriangle,
  Key, Link2, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Icon Map ────────────────────────────────────────────────

const iconMap: Record<string, React.ElementType> = {
  Monitor, Bot, Server, Cable, Globe, Code, BookOpen, Terminal,
  MessageSquare, Database, Brain, Cpu, Heart, Star, Settings2,
  Shield, Activity, Zap, Send, Link2, Key, ExternalLink,
};

const agentTypeColors: Record<string, string> = {
  'hermes-agent': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'openclaw': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'claude-code': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'codex': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  'trae': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  'custom': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const categoryColors: Record<string, string> = {
  model: 'bg-violet-500/10 text-violet-600 border-violet-200',
  skill: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  soul: 'bg-rose-500/10 text-rose-600 border-rose-200',
  memory: 'bg-amber-500/10 text-amber-600 border-amber-200',
  gateway: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
  chat: 'bg-blue-500/10 text-blue-600 border-blue-200',
  im: 'bg-teal-500/10 text-teal-600 border-teal-200',
  system: 'bg-gray-500/10 text-gray-600 border-gray-200',
  general: 'bg-slate-500/10 text-slate-600 border-slate-200',
};

const categoryBadgeColors: Record<string, string> = {
  model: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  skill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  soul: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  memory: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  gateway: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  chat: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  im: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  system: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  general: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

// ─── Status Dot ──────────────────────────────────────────────

function StatusDot({ online, pulse }: { online: boolean; pulse?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2.5 w-2.5">
        {pulse && online && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        )}
        <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5 shrink-0', online ? 'bg-green-500' : 'bg-gray-400')} />
      </span>
      <span className="text-xs text-muted-foreground">{online ? t('common.online') : t('common.offline')}</span>
    </div>
  );
}

// ─── Copy Button ─────────────────────────────────────────────

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

// ─── Monospace Field ─────────────────────────────────────────

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

// ─── Schema Form Generator ───────────────────────────────────

function SchemaForm({ schema, values, onChange }: {
  schema: Record<string, any>;
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
}) {
  const { t } = useI18n();
  const properties = schema.properties || {};
  const required = schema.required || [];

  if (!properties || Object.keys(properties).length === 0) {
    return <p className="text-xs text-muted-foreground italic">{t('acrp.noCapabilities')}</p>;
  }

  return (
    <div className="space-y-3">
      {Object.entries(properties).map(([key, prop]: [string, any]) => {
        const isRequired = required.includes(key);
        const currentValue = values[key] ?? prop.default ?? '';

        return (
          <div key={key} className="space-y-1">
            <Label className="text-xs font-medium">
              {prop.title || key}
              {isRequired && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            {prop.description && (
              <p className="text-[10px] text-muted-foreground">{prop.description}</p>
            )}

            {prop.enum ? (
              <Select value={String(currentValue)} onValueChange={(v) => onChange(key, v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={prop.title || key} />
                </SelectTrigger>
                <SelectContent>
                  {prop.enum.map((opt: string) => (
                    <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : prop.type === 'boolean' ? (
              <Select value={String(currentValue)} onValueChange={(v) => onChange(key, v === 'true')}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">true</SelectItem>
                  <SelectItem value="false">false</SelectItem>
                </SelectContent>
              </Select>
            ) : prop.type === 'number' || prop.type === 'integer' ? (
              <Input
                type="number"
                value={currentValue}
                onChange={(e) => onChange(key, Number(e.target.value))}
                className="h-8 text-xs"
                placeholder={prop.title || key}
              />
            ) : (
              <Input
                value={currentValue}
                onChange={(e) => onChange(key, e.target.value)}
                className="h-8 text-xs"
                placeholder={prop.title || key}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Code Block ──────────────────────────────────────────────

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="relative">
      <div className="absolute top-2 right-2">
        <CopyButton text={code} />
      </div>
      <pre className="bg-muted text-xs p-4 rounded-lg overflow-x-auto font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function AgentControlCenter() {
  const { agents, setAgents } = useAppStore();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('connected');

  // ACRP agents state
  const [acrpAgents, setAcrpAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Remote Control state
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [agentDetail, setAgentDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Invocation dialog
  const [invocationCapability, setInvocationCapability] = useState<any>(null);
  const [invocationParams, setInvocationParams] = useState<Record<string, any>>({});
  const [invoking, setInvoking] = useState(false);
  const [invocationResult, setInvocationResult] = useState<any>(null);
  const [showInvocationDialog, setShowInvocationDialog] = useState(false);

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<{ type: string; data: any } | null>(null);

  // Generate token dialog
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<any>(null);
  const [tokenAgentId, setTokenAgentId] = useState<string>('');

  // Quick commands
  const [sendingCommand, setSendingCommand] = useState<string | null>(null);

  // Auto-refresh
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load ACRP agents
  const loadAcrpAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const res = await api.getAcrpAgents();
      setAcrpAgents(res.agents || []);
    } catch {
      // API may not be available yet
      setAcrpAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  // Load agent detail for Remote Control
  const loadAgentDetail = useCallback(async (agentId: string) => {
    if (!agentId) return;
    setLoadingDetail(true);
    try {
      const res = await api.getAcrpAgent(agentId);
      setAgentDetail(res);
    } catch {
      setAgentDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // Load ACRP agents when Connected Agents tab is active
  useEffect(() => {
    if (activeTab === 'connected') {
      loadAcrpAgents();
    }
  }, [activeTab, loadAcrpAgents]);

  // Auto-refresh connected agents
  useEffect(() => {
    if (activeTab === 'connected') {
      refreshIntervalRef.current = setInterval(loadAcrpAgents, 15000);
      return () => {
        if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      };
    }
  }, [activeTab, loadAcrpAgents]);

  // Load agent detail when selected
  useEffect(() => {
    if (activeTab === 'control' && selectedAgentId) {
      loadAgentDetail(selectedAgentId);
    }
  }, [activeTab, selectedAgentId, loadAgentDetail]);

  // Agents that have ACRP token
  const acrpEnabledAgents = useMemo(() => {
    return agents.filter((a: any) => a.agentToken);
  }, [agents]);

  // Group capabilities by category
  const groupedCapabilities = useMemo(() => {
    if (!agentDetail?.capabilities) return {};
    const groups: Record<string, any[]> = {};
    for (const cap of agentDetail.capabilities) {
      const cat = cap.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(cap);
    }
    return groups;
  }, [agentDetail]);

  // Handle generate token
  const handleGenerateToken = async (agentId: string) => {
    setGeneratingToken(true);
    try {
      const res = await api.generateAcrpToken(agentId);
      setGeneratedToken(res);
      setTokenAgentId(agentId);
      setShowTokenDialog(true);
      toast.success(t('acrp.generateToken'));
      // Refresh agents list
      const agentsRes = await api.getAgents();
      setAgents(agentsRes.agents || []);
      loadAcrpAgents();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setGeneratingToken(false);
    }
  };

  // Handle invoke capability
  const handleInvokeCapability = async () => {
    if (!selectedAgentId || !invocationCapability) return;
    setInvoking(true);
    setInvocationResult(null);
    try {
      const res = await api.invokeCapability(selectedAgentId, invocationCapability.capabilityId, invocationParams);
      setInvocationResult({ success: true, data: res });
      toast.success(t('acrp.invocationSuccess'));
    } catch (error: any) {
      setInvocationResult({ success: false, error: error.message });
      toast.error(t('acrp.invocationFailed') + ': ' + error.message);
    } finally {
      setInvoking(false);
    }
  };

  // Handle quick command
  const handleQuickCommand = async (command: string) => {
    if (!selectedAgentId) return;
    setSendingCommand(command);
    try {
      await api.sendAgentCommand(selectedAgentId, command);
      toast.success(t('acrp.sendCommand'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSendingCommand(null);
    }
  };

  // Handle revoke token
  const handleRevokeToken = async (agentId: string) => {
    try {
      await api.revokeAcrpToken(agentId);
      toast.success(t('acrp.revokeToken'));
      const agentsRes = await api.getAgents();
      setAgents(agentsRes.agents || []);
      loadAcrpAgents();
    } catch (error: any) {
      toast.error(error.message);
    }
    setConfirmAction(null);
  };

  // Open invocation dialog
  const openInvocationDialog = (capability: any) => {
    if (capability.uiHints?.confirmRequired) {
      setConfirmAction({ type: 'invoke', data: capability });
    } else {
      startInvocation(capability);
    }
  };

  const startInvocation = (capability: any) => {
    setInvocationCapability(capability);
    setInvocationParams({});
    setInvocationResult(null);
    setShowInvocationDialog(true);
    setConfirmAction(null);
  };

  // Format time ago
  const formatTimeAgo = (dateStr: string | null | undefined) => {
    if (!dateStr) return t('common.noData');
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diff < 60) return `${diff}s ago`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return date.toLocaleDateString();
    } catch {
      return t('common.noData');
    }
  };

  // ─── Tab 1: Connected Agents ───────────────────────────────

  const renderConnectedAgents = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t('acrp.connectedAgents')}</h2>
          <p className="text-sm text-muted-foreground">
            ACRP (Agent Capability Registration Protocol) — {t('acrp.title')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadAcrpAgents} className="gap-1">
            <RefreshCw className="w-3 h-3" /> {t('common.refresh')}
          </Button>
          {agents.length > 0 && (
            <Select value={tokenAgentId} onValueChange={setTokenAgentId}>
              <SelectTrigger className="w-52 h-9 text-xs">
                <SelectValue placeholder={t('acrp.selectAgent')} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent: any) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <span>{agent.name}</span>
                      {agent.agentToken && <Badge variant="outline" className="text-[10px] px-1 py-0 bg-emerald-50 text-emerald-600">ACRP</Badge>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            size="sm"
            className="gap-1"
            disabled={!tokenAgentId || generatingToken}
            onClick={() => handleGenerateToken(tokenAgentId)}
          >
            {generatingToken ? <Zap className="w-3 h-3 animate-pulse" /> : <Key className="w-3 h-3" />}
            {t('acrp.generateToken')}
          </Button>
        </div>
      </div>

      {loadingAgents ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : acrpAgents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Monitor className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('acrp.noAgents')}</h3>
            <p className="text-muted-foreground text-sm text-center max-w-md">{t('acrp.noAgentsDesc')}</p>
            <Button variant="outline" size="sm" className="mt-4 gap-1" onClick={() => setActiveTab('setup')}>
              <BookOpen className="w-3 h-3" /> {t('acrp.setupGuide')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {acrpAgents.map((agent: any) => {
            const isOnline = agent.liveStatus?.connected || agent.wsConnected || agent.status === 'online';
            const lastHeartbeat = agent.liveStatus?.lastHeartbeat || agent.lastHeartbeatAt;
            const capabilityCount = agent.capabilities?.length || agent._count?.capabilities || 0;
            const agentType = agent.agentType || agent.agentMetadata?.agentType || 'custom';

            return (
              <Card key={agent.id} className="hover:shadow-md transition-all duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm truncate">{agent.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', agentTypeColors[agentType] || agentTypeColors.custom)}>
                            {agentType}
                          </Badge>
                          {agent.agentVersion && (
                            <span className="text-[10px] text-muted-foreground">v{agent.agentVersion}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <StatusDot online={isOnline} pulse={isOnline} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Heart className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{t('acrp.lastHeartbeat')}:</span>
                      <span className="font-medium">{formatTimeAgo(lastHeartbeat)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{t('acrp.capabilities')}:</span>
                      <span className="font-medium">{capabilityCount}</span>
                    </div>
                    {agent.agentMetadata?.platform && (
                      <div className="flex items-center gap-1.5 col-span-2">
                        <Server className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{t('acrp.platform')}:</span>
                        <span className="font-medium truncate">{agent.agentMetadata.platform}</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs h-7"
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setActiveTab('control');
                      }}
                    >
                      <Monitor className="w-3 h-3" /> {t('acrp.remoteControl')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs h-7"
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setActiveTab('control');
                      }}
                    >
                      <Activity className="w-3 h-3" /> {t('acrp.capabilities')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs h-7 text-destructive hover:text-destructive"
                      onClick={() => setConfirmAction({ type: 'revoke', data: agent })}
                    >
                      <AlertTriangle className="w-3 h-3" /> {t('acrp.revokeToken')}
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

  // ─── Tab 2: Remote Control ─────────────────────────────────

  const renderRemoteControl = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Label className="text-sm font-medium shrink-0">{t('acrp.selectAgent')}</Label>
        <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder={t('acrp.selectAgent')} />
          </SelectTrigger>
          <SelectContent>
            {acrpAgents.map((agent: any) => (
              <SelectItem key={agent.id} value={agent.id}>
                <div className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', (agent.liveStatus?.connected || agent.wsConnected) ? 'bg-green-500' : 'bg-gray-400')} />
                  <span>{agent.name}</span>
                </div>
              </SelectItem>
            ))}
            {acrpEnabledAgents
              .filter((a: any) => !acrpAgents.some((aa: any) => aa.id === a.id))
              .map((agent: any) => (
                <SelectItem key={agent.id} value={agent.id}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    <span>{agent.name}</span>
                    <span className="text-[10px] text-muted-foreground">(offline)</span>
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {selectedAgentId && (
          <Button variant="outline" size="sm" onClick={() => loadAgentDetail(selectedAgentId)} className="gap-1">
            <RefreshCw className="w-3 h-3" /> {t('common.refresh')}
          </Button>
        )}
      </div>

      {!selectedAgentId ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Monitor className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('acrp.selectAgent')}</h3>
            <p className="text-muted-foreground text-sm">Select an ACRP agent to control remotely</p>
          </CardContent>
        </Card>
      ) : loadingDetail ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !agentDetail ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <WifiOff className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('common.noData')}</h3>
            <p className="text-muted-foreground text-sm">Agent data could not be loaded</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Agent Info Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bot className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{agentDetail.agent?.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', agentTypeColors[agentDetail.agent?.agentType || agentDetail.agent?.agentMetadata?.agentType || 'custom'])}>
                        {agentDetail.agent?.agentType || agentDetail.agent?.agentMetadata?.agentType || 'custom'}
                      </Badge>
                      {agentDetail.agent?.agentVersion && (
                        <span className="text-xs text-muted-foreground">{t('acrp.agentVersion')}: {agentDetail.agent.agentVersion}</span>
                      )}
                      <StatusDot
                        online={agentDetail.liveStatus?.connected || agentDetail.agent?.wsConnected || false}
                        pulse={agentDetail.liveStatus?.connected}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t('acrp.platform')}</p>
                  <p className="font-medium">{agentDetail.agent?.agentMetadata?.platform || agentDetail.agent?.platform || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('acrp.lastHeartbeat')}</p>
                  <p className="font-medium">{formatTimeAgo(agentDetail.liveStatus?.lastHeartbeat || agentDetail.agent?.lastHeartbeatAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('acrp.capabilities')}</p>
                  <p className="font-medium">{agentDetail.capabilities?.length || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('common.status')}</p>
                  <div className="flex items-center gap-1.5">
                    {(agentDetail.liveStatus?.connected || agentDetail.agent?.wsConnected) ? (
                      <>
                        <Wifi className="w-3.5 h-3.5 text-green-500" />
                        <span className="font-medium text-green-600">{t('common.online')}</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium text-muted-foreground">{t('common.offline')}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Commands */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t('acrp.quickCommands')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { command: 'restart', icon: RotateCcw, label: t('acrp.restart') },
                  { command: 'reload_config', icon: RefreshCw, label: t('acrp.reloadConfig') },
                  { command: 'update_skills', icon: Zap, label: t('acrp.updateSkills') },
                ].map(({ command, icon: Icon, label }) => (
                  <Button
                    key={command}
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={!!sendingCommand}
                    onClick={() => handleQuickCommand(command)}
                  >
                    {sendingCommand === command ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                    {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Capabilities Grid */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">{t('acrp.capabilities')}</h3>
            {Object.keys(groupedCapabilities).length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Zap className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">{t('acrp.noCapabilities')}</p>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="multiple" defaultValue={Object.keys(groupedCapabilities)} className="space-y-2">
                {Object.entries(groupedCapabilities).map(([category, caps]) => (
                  <AccordionItem key={category} value={category} className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', categoryBadgeColors[category] || categoryBadgeColors.general)}>
                          {t(`acrp.category_${category}`)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{caps.length} {t('acrp.capabilities').toLowerCase()}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {caps.map((cap: any) => {
                          const IconComp = cap.uiHints?.icon ? (iconMap[cap.uiHints.icon] || Zap) : Zap;
                          return (
                            <Card
                              key={cap.capabilityId || cap.id}
                              className="hover:shadow-md transition-all cursor-pointer group border"
                              onClick={() => openInvocationDialog(cap)}
                            >
                              <CardContent className="p-3 space-y-2">
                                <div className="flex items-start gap-2">
                                  <div className={cn('w-8 h-8 rounded-md flex items-center justify-center shrink-0 border', categoryColors[category] || categoryColors.general)}>
                                    <IconComp className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">{cap.name}</p>
                                    {cap.description && (
                                      <p className="text-[10px] text-muted-foreground line-clamp-2">{cap.description}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <Badge variant="outline" className={cn('text-[9px] px-1 py-0', categoryBadgeColors[category] || categoryBadgeColors.general)}>
                                    {t(`acrp.category_${category}`)}
                                  </Badge>
                                  {cap.invokeCount > 0 && (
                                    <span className="text-[10px] text-muted-foreground">{cap.invokeCount}x invoked</span>
                                  )}
                                </div>
                                {cap.uiHints?.confirmRequired && (
                                  <div className="flex items-center gap-1 text-[10px] text-amber-600">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Requires confirmation</span>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>

          {/* Invocation History */}
          {agentDetail.recentInvocations && agentDetail.recentInvocations.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t('acrp.invocationHistory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {agentDetail.recentInvocations.map((inv: any, idx: number) => (
                      <div key={inv.id || idx} className="flex items-center gap-3 p-3 rounded-lg border text-xs">
                        <div className={cn(
                          'w-2 h-2 rounded-full shrink-0',
                          inv.status === 'success' ? 'bg-green-500' :
                          inv.status === 'failed' ? 'bg-red-500' :
                          inv.status === 'timeout' ? 'bg-amber-500' :
                          'bg-blue-500'
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{inv.capability?.name || inv.capabilityId}</span>
                            <Badge variant="outline" className={cn(
                              'text-[9px] px-1 py-0',
                              inv.status === 'success' ? 'bg-green-50 text-green-700' :
                              inv.status === 'failed' ? 'bg-red-50 text-red-700' :
                              inv.status === 'timeout' ? 'bg-amber-50 text-amber-700' :
                              'bg-blue-50 text-blue-700'
                            )}>
                              {inv.status}
                            </Badge>
                          </div>
                          {inv.params && (
                            <p className="text-muted-foreground truncate mt-0.5">
                              {typeof inv.params === 'string' ? inv.params : JSON.stringify(inv.params).slice(0, 80)}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {inv.duration && <p className="text-muted-foreground">{inv.duration}ms</p>}
                          <p className="text-muted-foreground">{formatTimeAgo(inv.createdAt || inv.invokedAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );

  // ─── Tab 3: Setup Guide ────────────────────────────────────

  const renderSetupGuide = () => {
    const jsCode = `import { io } from 'socket.io-client';

// 1. Connect with your agent token
const socket = io('/?XTransformPort=3004', {
  auth: { agentToken: 'acrp_YOUR_TOKEN_HERE' },
});

socket.on('connect', () => {
  console.log('Connected to Hermes Hub!');

  // 2. Register your agent
  socket.emit('agent:register', {
    name: 'My Agent',
    version: '1.0.0',
    platform: 'Node.js',
    capabilities: [
      {
        capabilityId: 'model.switch',
        name: 'Switch Model',
        category: 'model',
        description: 'Switch the LLM model',
        parameters: {
          type: 'object',
          properties: {
            model: { type: 'string', enum: ['gpt-4', 'claude-3'] }
          },
          required: ['model']
        },
        uiHints: { confirmRequired: true, icon: 'Cpu' }
      }
    ]
  });
});

// 3. Send heartbeats
setInterval(() => {
  socket.emit('agent:heartbeat', { status: 'online' });
}, 30000);

// 4. Handle capability invocations
socket.on('capability:invoke', (data) => {
  console.log('Capability invoked:', data);
  // Execute the capability...
  socket.emit('capability:result', {
    invocationId: data.invocationId,
    status: 'success',
    result: { message: 'Done!' }
  });
});

// 5. Handle commands
socket.on('agent:command', (data) => {
  console.log('Command received:', data.command);
});`;

    const pythonCode = `import socketio

# 1. Connect with your agent token
sio = socketio.SimpleClient()
sio.connect(
    'ws://localhost:3004/',
    auth={'agentToken': 'acrp_YOUR_TOKEN_HERE'}
)

# 2. Register your agent
sio.emit('agent:register', {
    'name': 'My Python Agent',
    'version': '1.0.0',
    'platform': 'Python',
    'capabilities': [
        {
            'capabilityId': 'skill.install',
            'name': 'Install Skill',
            'category': 'skill',
            'description': 'Install a new skill',
            'parameters': {
                'type': 'object',
                'properties': {
                    'skillName': {'type': 'string'}
                },
                'required': ['skillName']
            }
        }
    ]
})

# 3. Heartbeat
import threading
def heartbeat():
    while True:
        sio.emit('agent:heartbeat', {'status': 'online'})
        sio.sleep(30)

threading.Thread(target=heartbeat, daemon=True).start()

# 4. Handle invocations
@sio.on('capability:invoke')
def on_invoke(data):
    print(f'Capability invoked: {data}')
    sio.emit('capability:result', {
        'invocationId': data['invocationId'],
        'status': 'success',
        'result': {'message': 'Done!'}
    })

@sio.on('agent:command')
def on_command(data):
    print(f'Command: {data["command"]}')

sio.wait()`;

    const registrationPayload = `{
  "name": "My Agent",
  "version": "1.0.0",
  "platform": "Node.js / Python / Go",
  "capabilities": [
    {
      "capabilityId": "model.switch",
      "name": "Switch Model",
      "category": "model",
      "description": "Switch the active LLM model",
      "parameters": {
        "type": "object",
        "properties": {
          "model": {
            "type": "string",
            "enum": ["gpt-4", "claude-3", "gemini-pro"]
          }
        },
        "required": ["model"]
      },
      "uiHints": {
        "confirmRequired": true,
        "icon": "Cpu"
      }
    },
    {
      "capabilityId": "skill.install",
      "name": "Install Skill",
      "category": "skill",
      "description": "Install a new skill to the agent",
      "parameters": {
        "type": "object",
        "properties": {
          "skillName": { "type": "string" },
          "config": { "type": "object" }
        },
        "required": ["skillName"]
      }
    }
  ]
}`;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">{t('acrp.setupGuide')}</h2>
          <p className="text-sm text-muted-foreground">
            ACRP (Agent Capability Registration Protocol) — Connect and control external agents remotely
          </p>
        </div>

        {/* Step-by-step guide */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { step: 1, title: t('acrp.step1'), desc: 'Create an agent in the Agents page first', icon: Bot, color: 'bg-emerald-500/10 text-emerald-600' },
            { step: 2, title: t('acrp.step2'), desc: 'Generate a connection token for that agent', icon: Key, color: 'bg-violet-500/10 text-violet-600' },
            { step: 3, title: t('acrp.step3'), desc: 'Copy the connection URL and token', icon: Copy, color: 'bg-amber-500/10 text-amber-600' },
            { step: 4, title: t('acrp.step4'), desc: 'Configure your agent with the connection info', icon: Cable, color: 'bg-cyan-500/10 text-cyan-600' },
          ].map(({ step, title, desc, icon: Icon, color }) => (
            <Card key={step} className="relative">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className={cn('w-8 h-8 rounded-md flex items-center justify-center border', color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">STEP {step}</span>
                </div>
                <h4 className="text-sm font-semibold">{title}</h4>
                <p className="text-xs text-muted-foreground">{desc}</p>
                {step < 4 && (
                  <ArrowRight className="absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hidden lg:block" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Code Examples */}
        <Accordion type="multiple" defaultValue={['js-example', 'python-example', 'registration']} className="space-y-2">
          <AccordionItem value="js-example" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium">JavaScript (socket.io-client)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <CodeBlock code={jsCode} language="javascript" />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="python-example" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium">Python (python-socketio)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <CodeBlock code={pythonCode} language="python" />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="registration" className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <FileIcon className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Registration Payload</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <CodeBlock code={registrationPayload} language="json" />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Supported Agent Types */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t('acrp.supportedTypes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { type: 'hermes-agent', label: 'Hermes Agent', desc: 'Python-based agent' },
                { type: 'openclaw', label: 'OpenClaw', desc: 'Open source agent' },
                { type: 'claude-code', label: 'Claude Code', desc: 'Anthropic agent' },
                { type: 'codex', label: 'Codex', desc: 'OpenAI agent' },
                { type: 'trae', label: 'Trae', desc: 'AI IDE agent' },
                { type: 'custom', label: 'Custom', desc: 'Any WS client' },
              ].map(({ type, label, desc }) => (
                <div key={type} className="flex flex-col items-center gap-2 p-3 rounded-lg border text-center">
                  <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', agentTypeColors[type])}>
                    {type}
                  </Badge>
                  <span className="text-xs font-medium">{label}</span>
                  <span className="text-[10px] text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ─── Main Render ───────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t('acrp.title')}</h1>
            <p className="text-sm text-muted-foreground">ACRP — Agent Capability Registration Protocol</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="border-b px-6">
            <TabsList className="bg-transparent h-12">
              <TabsTrigger value="connected" className="gap-1.5 data-[state=active]:bg-accent">
                <Wifi className="w-3.5 h-3.5" />
                {t('acrp.connectedAgents')}
              </TabsTrigger>
              <TabsTrigger value="control" className="gap-1.5 data-[state=active]:bg-accent">
                <Monitor className="w-3.5 h-3.5" />
                {t('acrp.remoteControl')}
              </TabsTrigger>
              <TabsTrigger value="setup" className="gap-1.5 data-[state=active]:bg-accent">
                <BookOpen className="w-3.5 h-3.5" />
                {t('acrp.setupGuide')}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 p-6">
            <TabsContent value="connected" className="mt-0">
              {renderConnectedAgents()}
            </TabsContent>
            <TabsContent value="control" className="mt-0">
              {renderRemoteControl()}
            </TabsContent>
            <TabsContent value="setup" className="mt-0">
              {renderSetupGuide()}
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Generate Token Dialog */}
      <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('acrp.connectionToken')}</DialogTitle>
            <DialogDescription>Use these credentials to connect your agent via ACRP</DialogDescription>
          </DialogHeader>
          {generatedToken && (
            <div className="space-y-4">
              <MonospaceField
                label={t('acrp.connectionToken')}
                value={generatedToken.agentToken}
                masked
                copyLabel={t('skillProtocol.copyToken')}
              />
              <MonospaceField
                label={t('acrp.connectionUrl')}
                value={generatedToken.wsConnectUrl || '/?XTransformPort=3004'}
                copyLabel={t('skillProtocol.copyUrl')}
              />
              {generatedToken.wsDirectUrl && (
                <MonospaceField
                  label="Direct WebSocket URL"
                  value={generatedToken.wsDirectUrl}
                  copyLabel={t('skillProtocol.copyUrl')}
                />
              )}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Quick Connect Link</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md font-mono break-all select-all border border-dashed">
                    {generatedToken.wsConnectUrl || '/?XTransformPort=3004'}#token={generatedToken.agentToken}
                  </code>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1 text-xs shrink-0"
                    onClick={() => {
                      const link = `${generatedToken.wsConnectUrl || '/?XTransformPort=3004'}#token=${generatedToken.agentToken}`;
                      navigator.clipboard.writeText(link);
                      toast.success(t('skillProtocol.connectLinkCopied'));
                    }}
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invocation Dialog */}
      <Dialog open={showInvocationDialog} onOpenChange={setShowInvocationDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('acrp.invoke')}: {invocationCapability?.name}
            </DialogTitle>
            <DialogDescription>
              {invocationCapability?.description || 'Execute this capability on the remote agent'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Category badge */}
            {invocationCapability?.category && (
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', categoryBadgeColors[invocationCapability.category] || categoryBadgeColors.general)}>
                {t(`acrp.category_${invocationCapability.category}`)}
              </Badge>
            )}

            {/* Parameters form */}
            {invocationCapability?.parameters && invocationCapability.parameters.properties && Object.keys(invocationCapability.parameters.properties).length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Parameters</Label>
                <SchemaForm
                  schema={invocationCapability.parameters}
                  values={invocationParams}
                  onChange={(key, value) => setInvocationParams((prev) => ({ ...prev, [key]: value }))}
                />
              </div>
            )}

            {/* Invoke button */}
            <Button
              className="w-full gap-1.5"
              disabled={invoking}
              onClick={handleInvokeCapability}
            >
              {invoking ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {t('acrp.invoking')}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  {t('acrp.invoke')}
                </>
              )}
            </Button>

            {/* Result */}
            {invocationResult && (
              <Card className={cn('border', invocationResult.success ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800')}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {invocationResult.success ? (
                      <>
                        <Check className="w-4 h-4 text-green-500" />
                        {t('acrp.invocationSuccess')}
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        {t('acrp.invocationFailed')}
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48 font-mono">
                    {JSON.stringify(invocationResult.success ? invocationResult.data : { error: invocationResult.error }, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'revoke' ? t('acrp.revokeToken') : t('acrp.invoke')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'revoke'
                ? t('acrp.confirmRevoke')
                : t('acrp.confirmInvoke')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={cn(confirmAction?.type === 'revoke' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
              onClick={() => {
                if (confirmAction?.type === 'revoke') {
                  handleRevokeToken(confirmAction.data.id);
                } else if (confirmAction?.type === 'invoke') {
                  startInvocation(confirmAction.data);
                }
              }}
            >
              {confirmAction?.type === 'revoke' ? t('acrp.revokeToken') : t('acrp.invoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Small helper component for Setup Guide
function FileIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}
