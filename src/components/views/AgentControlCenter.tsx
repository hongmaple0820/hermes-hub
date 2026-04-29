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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Monitor, Wifi, WifiOff, Radio, Copy, Check, Play, RotateCcw, RefreshCw,
  Settings2, ChevronRight, Terminal, Eye, EyeOff, Clock, Zap, Activity,
  Bot, Server, Cable, Globe, Code, BookOpen, ArrowRight, Shield,
  MessageSquare, Database, Brain, Cpu, Heart, Star, Send, AlertTriangle,
  Key, Link2, ExternalLink, FileJson, Timer, XCircle, CheckCircle2,
  Hourglass, Loader2, Search, Layers, Unplug, Plug,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Icon Map ────────────────────────────────────────────────

const iconMap: Record<string, React.ElementType> = {
  Monitor, Bot, Server, Cable, Globe, Code, BookOpen, Terminal,
  MessageSquare, Database, Brain, Cpu, Heart, Star, Settings2,
  Shield, Activity, Zap, Send, Link2, Key, ExternalLink,
  FileJson, Timer, Search, Layers,
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

const statusIcons: Record<string, { icon: React.ElementType; color: string }> = {
  success: { icon: CheckCircle2, color: 'text-green-500' },
  failed: { icon: XCircle, color: 'text-red-500' },
  timeout: { icon: Hourglass, color: 'text-amber-500' },
  pending: { icon: Loader2, color: 'text-blue-500' },
  sent: { icon: Send, color: 'text-sky-500' },
  executing: { icon: Loader2, color: 'text-indigo-500' },
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

// ─── Code Block with syntax highlighting ─────────────────────

function CodeBlock({ code, language }: { code: string; language: string }) {
  const { t } = useI18n();
  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-muted/80 backdrop-blur-sm">
          {language}
        </Badge>
        <CopyButton text={code} label={t('common.copied')} />
      </div>
      <pre className="bg-zinc-950 text-zinc-100 text-xs p-4 rounded-lg overflow-x-auto font-mono leading-relaxed border border-zinc-800">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── Skeleton Loader ─────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
        <Skeleton className="h-px w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonDetail() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-60" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </CardContent>
      </Card>
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
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

  // Auto-refresh for Remote Control
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [refreshAgo, setRefreshAgo] = useState<string>('');
  const controlRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshAgoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Invocation dialog
  const [invocationCapability, setInvocationCapability] = useState<any>(null);
  const [invocationParams, setInvocationParams] = useState<Record<string, any>>({});
  const [invoking, setInvoking] = useState(false);
  const [invocationResult, setInvocationResult] = useState<any>(null);
  const [showInvocationDialog, setShowInvocationDialog] = useState(false);

  // Invocation result detail dialog
  const [showResultDetail, setShowResultDetail] = useState(false);
  const [resultDetailData, setResultDetailData] = useState<any>(null);

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<{ type: string; data: any } | null>(null);

  // Revoke token confirmation
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [revokeAgent, setRevokeAgent] = useState<any>(null);
  const [revokeConfirmName, setRevokeConfirmName] = useState('');

  // Generate token dialog
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<any>(null);
  const [tokenAgentId, setTokenAgentId] = useState<string>('');

  // Quick commands
  const [sendingCommand, setSendingCommand] = useState<string | null>(null);

  // Test connection (Setup Guide)
  const [testingConnection, setTestingConnection] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState<{ success: boolean; message: string } | null>(null);

  // Auto-refresh
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load ACRP agents
  const loadAcrpAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const res = await api.getAcrpAgents();
      setAcrpAgents(res.agents || []);
    } catch {
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
      setLastRefreshedAt(new Date());
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

  // Auto-refresh connected agents (15s)
  useEffect(() => {
    if (activeTab === 'connected') {
      refreshIntervalRef.current = setInterval(loadAcrpAgents, 15000);
      return () => {
        if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      };
    }
  }, [activeTab, loadAcrpAgents]);

  // Auto-refresh Remote Control tab (15s) + refresh ago indicator
  useEffect(() => {
    if (activeTab === 'control' && selectedAgentId) {
      controlRefreshRef.current = setInterval(() => {
        loadAgentDetail(selectedAgentId);
      }, 15000);

      refreshAgoRef.current = setInterval(() => {
        if (lastRefreshedAt) {
          const diff = Math.floor((Date.now() - lastRefreshedAt.getTime()) / 1000);
          setRefreshAgo(formatRefreshAgo(diff));
        }
      }, 1000);

      return () => {
        if (controlRefreshRef.current) clearInterval(controlRefreshRef.current);
        if (refreshAgoRef.current) clearInterval(refreshAgoRef.current);
      };
    }
    return () => {
      if (controlRefreshRef.current) clearInterval(controlRefreshRef.current);
      if (refreshAgoRef.current) clearInterval(refreshAgoRef.current);
    };
  }, [activeTab, selectedAgentId, loadAgentDetail, lastRefreshedAt]);

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
      setInvocationResult({ success: true, data: res, timestamp: new Date(), capabilityName: invocationCapability.name, capabilityId: invocationCapability.capabilityId, params: invocationParams });
      toast.success(t('acrp.invocationSuccess'));
    } catch (error: any) {
      setInvocationResult({ success: false, error: error.message, timestamp: new Date(), capabilityName: invocationCapability.name, capabilityId: invocationCapability.capabilityId, params: invocationParams });
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
    setShowRevokeDialog(false);
    setRevokeAgent(null);
    setRevokeConfirmName('');
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

  // Test connection (Setup Guide)
  const handleTestConnection = async () => {
    if (!tokenAgentId) return;
    setTestingConnection(true);
    setTestConnectionResult(null);
    try {
      const res = await api.getAcrpAgent(tokenAgentId);
      if (res && res.agent) {
        setTestConnectionResult({ success: true, message: t('acrp.testConnectionSuccess') });
        toast.success(t('acrp.testConnectionSuccess'));
      } else {
        setTestConnectionResult({ success: false, message: t('acrp.testConnectionFailed') });
        toast.error(t('acrp.testConnectionFailed'));
      }
    } catch {
      setTestConnectionResult({ success: false, message: t('acrp.testConnectionFailed') });
      toast.error(t('acrp.testConnectionFailed'));
    } finally {
      setTestingConnection(false);
    }
  };

  // Format time ago with i18n
  const formatTimeAgo = (dateStr: string | null | undefined) => {
    if (!dateStr) return t('common.noData');
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diff < 0) return t('common.noData');
      if (diff < 60) return t('acrp.timeAgoSeconds', { count: diff });
      if (diff < 3600) return t('acrp.timeAgoMinutes', { count: Math.floor(diff / 60) });
      if (diff < 86400) return t('acrp.timeAgoHours', { count: Math.floor(diff / 3600) });
      return t('acrp.timeAgoDays', { count: Math.floor(diff / 86400) });
    } catch {
      return t('common.noData');
    }
  };

  // Format refresh ago
  const formatRefreshAgo = (seconds: number) => {
    if (seconds < 5) return t('acrp.justNow');
    if (seconds < 60) return t('acrp.timeAgoSeconds', { count: seconds });
    return t('acrp.timeAgoMinutes', { count: Math.floor(seconds / 60) });
  };

  // ─── Tab 1: Connected Agents ───────────────────────────────

  const renderConnectedAgents = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t('acrp.connectedAgents')}</h2>
          <p className="text-sm text-muted-foreground">{t('acrp.protocolDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadAcrpAgents} className="gap-1">
            <RefreshCw className={cn('w-3 h-3', loadingAgents && 'animate-spin')} /> {t('common.refresh')}
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
                      {agent.agentToken && <Badge variant="outline" className="text-[10px] px-1 py-0 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">ACRP</Badge>}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : acrpAgents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <Monitor className="w-16 h-16 text-muted-foreground/30" />
              <Unplug className="w-6 h-6 text-muted-foreground/50 absolute -bottom-1 -right-1" />
            </div>
            <h3 className="text-lg font-semibold mb-1 mt-4">{t('acrp.noAgents')}</h3>
            <p className="text-muted-foreground text-sm text-center max-w-md">{t('acrp.noAgentsDesc')}</p>
            <div className="flex items-center gap-2 mt-4">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setActiveTab('setup')}>
                <BookOpen className="w-3 h-3" /> {t('acrp.setupGuide')}
              </Button>
              {agents.length > 0 && (
                <Button size="sm" className="gap-1" onClick={() => handleGenerateToken(agents[0]?.id)}>
                  <Key className="w-3 h-3" /> {t('acrp.generateToken')}
                </Button>
              )}
            </div>
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
              <Card key={agent.id} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 group">
                {/* Gradient header */}
                <div className={cn(
                  'h-1.5 rounded-t-lg',
                  isOnline
                    ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                    : 'bg-gradient-to-r from-gray-300 to-gray-400'
                )} />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
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
                    {/* Consolidated Manage button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs h-7"
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setActiveTab('control');
                      }}
                    >
                      <Settings2 className="w-3 h-3" /> {t('acrp.manage')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs h-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        setRevokeAgent(agent);
                        setRevokeConfirmName('');
                        setShowRevokeDialog(true);
                      }}
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
                    <span className="text-[10px] text-muted-foreground">({t('common.offline')})</span>
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {selectedAgentId && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => loadAgentDetail(selectedAgentId)} className="gap-1">
              <RefreshCw className={cn('w-3 h-3', loadingDetail && 'animate-spin')} /> {t('common.refresh')}
            </Button>
            {lastRefreshedAt && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t('acrp.lastRefreshed')}: {refreshAgo || formatRefreshAgo(0)}
              </span>
            )}
          </div>
        )}
      </div>

      {!selectedAgentId ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <Monitor className="w-16 h-16 text-muted-foreground/30" />
              <Radio className="w-6 h-6 text-muted-foreground/50 absolute -bottom-1 -right-1" />
            </div>
            <h3 className="text-lg font-semibold mb-1 mt-4">{t('acrp.selectAgent')}</h3>
            <p className="text-muted-foreground text-sm">{t('acrp.selectAgentToControl')}</p>
          </CardContent>
        </Card>
      ) : loadingDetail ? (
        <SkeletonDetail />
      ) : !agentDetail ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <WifiOff className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('common.noData')}</h3>
            <p className="text-muted-foreground text-sm">{t('acrp.agentDataLoadError')}</p>
            <Button variant="outline" size="sm" className="mt-4 gap-1" onClick={() => loadAgentDetail(selectedAgentId)}>
              <RefreshCw className="w-3 h-3" /> {t('common.refresh')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Agent Info Card */}
          <Card className="overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
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
                  <Zap className="w-10 h-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">{t('acrp.noCapabilities')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('acrp.noCapabilitiesHint')}</p>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="multiple" defaultValue={Object.keys(groupedCapabilities)} className="space-y-2">
                {Object.entries(groupedCapabilities).map(([category, caps]) => (
                  <AccordionItem key={category} value={category} className="border rounded-lg overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
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
                              className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group border"
                              onClick={() => openInvocationDialog(cap)}
                            >
                              <CardContent className="p-3 space-y-2">
                                <div className="flex items-start gap-2">
                                  <div className={cn('w-8 h-8 rounded-md flex items-center justify-center shrink-0 border group-hover:scale-110 transition-transform', categoryColors[category] || categoryColors.general)}>
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
                                    <span className="text-[10px] text-muted-foreground">{t('acrp.invokedCount', { count: cap.invokeCount })}</span>
                                  )}
                                </div>
                                {cap.uiHints?.confirmRequired && (
                                  <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>{t('acrp.requiresConfirmation')}</span>
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
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{t('acrp.invocationHistory')}</CardTitle>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {agentDetail.recentInvocations.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {agentDetail.recentInvocations.map((inv: any, idx: number) => {
                      const StatusIcon = statusIcons[inv.status]?.icon || Loader2;
                      const statusColor = statusIcons[inv.status]?.color || 'text-blue-500';
                      return (
                        <div
                          key={inv.id || idx}
                          className="flex items-center gap-3 p-3 rounded-lg border text-xs hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => {
                            setResultDetailData(inv);
                            setShowResultDetail(true);
                          }}
                        >
                          <StatusIcon className={cn('w-4 h-4 shrink-0', statusColor, inv.status === 'executing' && 'animate-spin')} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{inv.capability?.name || inv.capabilityId}</span>
                              <Badge variant="outline" className={cn(
                                'text-[9px] px-1 py-0',
                                inv.status === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                inv.status === 'failed' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                inv.status === 'timeout' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
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
                      );
                    })}
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
          <p className="text-sm text-muted-foreground">{t('acrp.protocolDescription')}</p>
        </div>

        {/* Connection Flow Diagram */}
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-cyan-400 via-primary to-emerald-400" />
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t('acrp.connectionFlow')}</CardTitle>
            <CardDescription className="text-xs">{t('acrp.connectionFlowDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-2 flex-wrap py-4">
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg border bg-muted/30 min-w-[80px]">
                <Plug className="w-6 h-6 text-cyan-500" />
                <span className="text-[10px] font-medium text-center">{t('acrp.flowYourAgent')}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 hidden sm:block" />
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg border bg-muted/30 min-w-[80px]">
                <Key className="w-6 h-6 text-amber-500" />
                <span className="text-[10px] font-medium text-center">{t('acrp.flowToken')}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 hidden sm:block" />
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg border bg-muted/30 min-w-[80px]">
                <Cable className="w-6 h-6 text-primary" />
                <span className="text-[10px] font-medium text-center">WebSocket</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 hidden sm:block" />
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg border bg-primary/10 min-w-[80px]">
                <Bot className="w-6 h-6 text-primary" />
                <span className="text-[10px] font-medium text-center">{t('acrp.flowHub')}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 hidden sm:block" />
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg border bg-muted/30 min-w-[80px]">
                <Zap className="w-6 h-6 text-emerald-500" />
                <span className="text-[10px] font-medium text-center">{t('acrp.flowCapabilities')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step-by-step guide with progress indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { step: 1, title: t('acrp.step1'), desc: t('acrp.step1Desc'), icon: Bot, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', gradient: 'from-emerald-400 to-emerald-500' },
            { step: 2, title: t('acrp.step2'), desc: t('acrp.step2Desc'), icon: Key, color: 'bg-violet-500/10 text-violet-600 border-violet-200', gradient: 'from-violet-400 to-violet-500' },
            { step: 3, title: t('acrp.step3'), desc: t('acrp.step3Desc'), icon: Copy, color: 'bg-amber-500/10 text-amber-600 border-amber-200', gradient: 'from-amber-400 to-amber-500' },
            { step: 4, title: t('acrp.step4'), desc: t('acrp.step4Desc'), icon: Cable, color: 'bg-cyan-500/10 text-cyan-600 border-cyan-200', gradient: 'from-cyan-400 to-cyan-500' },
          ].map(({ step, title, desc, icon: Icon, color, gradient }) => (
            <Card key={step} className="relative overflow-hidden group hover:shadow-md transition-all">
              <div className={cn('h-1 bg-gradient-to-r', gradient)} />
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className={cn('w-8 h-8 rounded-md flex items-center justify-center border', color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">{t('acrp.stepNumber', { number: step })}</span>
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

        {/* Test Connection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              {t('acrp.testConnection')}
            </CardTitle>
            <CardDescription className="text-xs">{t('acrp.testConnectionDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={tokenAgentId} onValueChange={setTokenAgentId}>
                <SelectTrigger className="w-52 h-9 text-xs">
                  <SelectValue placeholder={t('acrp.selectAgent')} />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <span>{agent.name}</span>
                        {agent.agentToken && <Badge variant="outline" className="text-[10px] px-1 py-0 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">ACRP</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={!tokenAgentId || testingConnection}
                onClick={handleTestConnection}
              >
                {testingConnection ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Shield className="w-3.5 h-3.5" />
                )}
                {t('acrp.testConnection')}
              </Button>
              {testConnectionResult && (
                <Badge variant="outline" className={cn(
                  'text-xs px-2 py-0.5',
                  testConnectionResult.success
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                )}>
                  {testConnectionResult.success ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                  {testConnectionResult.message}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Code Examples - Collapsible by agent type */}
        <Accordion type="multiple" defaultValue={['js-example', 'python-example', 'registration']} className="space-y-2">
          <AccordionItem value="js-example" className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-amber-500/10 flex items-center justify-center">
                  <Code className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <span className="text-sm font-medium">{t('acrp.jsExample')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <CodeBlock code={jsCode} language="javascript" />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="python-example" className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center">
                  <Code className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <span className="text-sm font-medium">{t('acrp.pythonExample')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <CodeBlock code={pythonCode} language="python" />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="registration" className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center">
                  <FileJson className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <span className="text-sm font-medium">{t('acrp.registrationPayload')}</span>
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
                { type: 'hermes-agent', label: 'Hermes Agent', desc: t('acrp.typeHermesAgent') },
                { type: 'openclaw', label: 'OpenClaw', desc: t('acrp.typeOpenClaw') },
                { type: 'claude-code', label: 'Claude Code', desc: t('acrp.typeClaudeCode') },
                { type: 'codex', label: 'Codex', desc: t('acrp.typeCodex') },
                { type: 'trae', label: 'Trae', desc: t('acrp.typeTrae') },
                { type: 'custom', label: t('acrp.typeCustom'), desc: t('acrp.typeCustomDesc') },
              ].map(({ type, label, desc }) => (
                <div key={type} className="flex flex-col items-center gap-2 p-3 rounded-lg border text-center hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
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
      {/* Header with gradient */}
      <div className="border-b bg-card px-6 py-4 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t('acrp.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('acrp.headerSubtitle')}</p>
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
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-4 h-4 text-primary" />
              {t('acrp.connectionToken')}
            </DialogTitle>
            <DialogDescription>{t('acrp.tokenDialogDesc')}</DialogDescription>
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
                  label={t('acrp.directWsUrl')}
                  value={generatedToken.wsDirectUrl}
                  copyLabel={t('skillProtocol.copyUrl')}
                />
              )}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">{t('acrp.quickConnectLink')}</Label>
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
                    <Copy className="w-3 h-3" /> {t('common.copied')}
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
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-4 h-4 text-primary" />
              {t('acrp.invoke')}: {invocationCapability?.name}
            </DialogTitle>
            <DialogDescription>
              {invocationCapability?.description || t('acrp.invokeCapabilityDesc')}
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
                <Label className="text-xs font-semibold">{t('acrp.parameters')}</Label>
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
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        {t('acrp.invocationSuccess')}
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-500" />
                        {t('acrp.invocationFailed')}
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48 font-mono">
                    {JSON.stringify(invocationResult.success ? invocationResult.data : { error: invocationResult.error }, null, 2)}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => {
                      setResultDetailData(invocationResult);
                      setShowResultDetail(true);
                    }}
                  >
                    <Eye className="w-3 h-3" /> {t('acrp.viewDetails')}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Invocation Result Detail Dialog */}
      <Dialog open={showResultDetail} onOpenChange={setShowResultDetail}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-primary" />
              {t('acrp.invocationResultDetail')}
            </DialogTitle>
            <DialogDescription>{t('acrp.invocationResultDetailDesc')}</DialogDescription>
          </DialogHeader>
          {resultDetailData && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24">{t('common.status')}</span>
                  {(() => {
                    const status = resultDetailData.status || (resultDetailData.success ? 'success' : 'failed');
                    const StatusIcon = statusIcons[status]?.icon || Loader2;
                    const statusColor = statusIcons[status]?.color || 'text-blue-500';
                    return (
                      <Badge variant="outline" className={cn(
                        'text-xs px-2 py-0.5 gap-1',
                        status === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        status === 'failed' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        status === 'timeout' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      )}>
                        <StatusIcon className={cn('w-3 h-3', statusColor)} />
                        {status}
                      </Badge>
                    );
                  })()}
                </div>

                {/* Invocation ID */}
                {resultDetailData.id && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24">{t('acrp.invocationId')}</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{resultDetailData.id}</code>
                  </div>
                )}

                {/* Capability Name */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24">{t('acrp.capabilityName')}</span>
                  <span className="text-sm font-medium">{resultDetailData.capabilityName || resultDetailData.capability?.name || resultDetailData.capabilityId || '-'}</span>
                </div>

                {/* Capability ID */}
                {(resultDetailData.capabilityId || resultDetailData.capability?.capabilityId) && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24">{t('acrp.capabilityId')}</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{resultDetailData.capabilityId || resultDetailData.capability?.capabilityId}</code>
                  </div>
                )}

                {/* Parameters */}
                {resultDetailData.params && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t('acrp.parametersSent')}</span>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-32 font-mono">
                      {typeof resultDetailData.params === 'string' ? resultDetailData.params : JSON.stringify(resultDetailData.params, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Result Data */}
                {(resultDetailData.result || resultDetailData.data || resultDetailData.error) && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t('acrp.resultData')}</span>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48 font-mono">
                      {JSON.stringify(resultDetailData.result || resultDetailData.data || { error: resultDetailData.error }, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Duration */}
                {resultDetailData.duration && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24">{t('acrp.duration')}</span>
                    <span className="text-sm font-medium flex items-center gap-1">
                      <Timer className="w-3 h-3" /> {resultDetailData.duration}ms
                    </span>
                  </div>
                )}

                {/* Timestamp */}
                {(resultDetailData.timestamp || resultDetailData.createdAt || resultDetailData.invokedAt || resultDetailData.completedAt) && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24">{t('acrp.timestamp')}</span>
                    <span className="text-sm">
                      {resultDetailData.timestamp
                        ? new Date(resultDetailData.timestamp).toLocaleString()
                        : new Date(resultDetailData.createdAt || resultDetailData.invokedAt || resultDetailData.completedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowResultDetail(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Token Confirmation Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={(open) => {
        if (!open) {
          setShowRevokeDialog(false);
          setRevokeAgent(null);
          setRevokeConfirmName('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              {t('acrp.revokeToken')}
            </DialogTitle>
            <DialogDescription>{t('acrp.revokeTokenWarning')}</DialogDescription>
          </DialogHeader>
          {revokeAgent && (
            <div className="space-y-4">
              {/* What will happen */}
              <Card className="border-destructive/20 bg-destructive/5">
                <CardContent className="p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-destructive">{t('acrp.whatWillHappen')}</h4>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li className="flex items-start gap-2">
                      <Unplug className="w-3 h-3 mt-0.5 text-destructive shrink-0" />
                      {t('acrp.revokeEffect1', { agentName: revokeAgent.name })}
                    </li>
                    <li className="flex items-start gap-2">
                      <Zap className="w-3 h-3 mt-0.5 text-destructive shrink-0" />
                      {t('acrp.revokeEffect2', { count: revokeAgent.capabilities?.length || revokeAgent._count?.capabilities || 0 })}
                    </li>
                    <li className="flex items-start gap-2">
                      <Key className="w-3 h-3 mt-0.5 text-destructive shrink-0" />
                      {t('acrp.revokeEffect3')}
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Confirm by typing agent name */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  {t('acrp.typeToConfirm', { agentName: revokeAgent.name })}
                </Label>
                <Input
                  value={revokeConfirmName}
                  onChange={(e) => setRevokeConfirmName(e.target.value)}
                  placeholder={revokeAgent.name}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => {
              setShowRevokeDialog(false);
              setRevokeAgent(null);
              setRevokeConfirmName('');
            }}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!revokeAgent || revokeConfirmName !== revokeAgent.name}
              onClick={() => revokeAgent && handleRevokeToken(revokeAgent.id)}
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              {t('acrp.revokeToken')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog (for invoke with confirmRequired) */}
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
