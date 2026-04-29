'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  LogOut, User, Shield, Palette, Bot, Brain, Clock, Lock, Cpu,
  Radio, Bell, Eye, EyeOff, MessageSquare, RotateCcw, Download,
  Upload, AlertTriangle, Trash2, Info, ExternalLink, CheckCircle2,
  XCircle, Wifi, WifiOff, Server, Database, Globe, Monitor, Heart,
  RefreshCw, EyeIcon, Sun, Moon, MonitorSmartphone, Zap, Hexagon
} from 'lucide-react';
import { toast } from 'sonner';

interface SettingsProps {
  onLogout: () => void;
}

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="mt-0.5 p-2 rounded-lg bg-muted">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

const ACCENT_COLORS = [
  { id: 'default', label: 'settingsPage.accentDefault', color: 'hsl(222 47% 51%)', bg: 'bg-primary' },
  { id: 'emerald', label: 'settingsPage.accentEmerald', color: 'hsl(160 84% 39%)', bg: 'bg-emerald-500' },
  { id: 'rose', label: 'settingsPage.accentRose', color: 'hsl(347 77% 50%)', bg: 'bg-rose-500' },
  { id: 'amber', label: 'settingsPage.accentAmber', color: 'hsl(38 92% 50%)', bg: 'bg-amber-500' },
  { id: 'cyan', label: 'settingsPage.accentCyan', color: 'hsl(188 94% 43%)', bg: 'bg-cyan-500' },
];

const AUTO_REFRESH_OPTIONS = [
  { value: '15', label: '15s' },
  { value: '30', label: '30s' },
  { value: '60', label: '60s' },
];

export function Settings({ onLogout }: SettingsProps) {
  const { user, providers, channels, agents, conversations } = useAppStore();
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Danger zone state
  const [deleteConfirmType, setDeleteConfirmType] = useState<'conversations' | 'agents' | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // About / service status state
  const [serviceStatuses, setServiceStatuses] = useState<Record<string, 'checking' | 'online' | 'offline'>>({});

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getSettings();
      setSettings(result.settings || {});
    } catch {
      setSettings({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Check service statuses
  useEffect(() => {
    const checkServices = async () => {
      const statuses: Record<string, 'checking' | 'online' | 'offline'> = {
        nextjs: 'checking',
        'skill-ws': 'checking',
        'chat-service': 'checking',
      };
      setServiceStatuses(statuses);

      // Next.js is always online if we're loading this page
      statuses.nextjs = 'online';
      setServiceStatuses({ ...statuses });

      // Check skill-ws
      try {
        const res = await fetch('/api/skill-protocol/validate?XTransformPort=3004&check=health', {
          signal: AbortSignal.timeout(3000),
        }).catch(() => null);
        if (res?.ok) {
          statuses['skill-ws'] = 'online';
        } else {
          // Try alternate health check
          try {
            const healthRes = await fetch('/health?XTransformPort=3004', {
              signal: AbortSignal.timeout(3000),
            });
            statuses['skill-ws'] = healthRes.ok ? 'online' : 'offline';
          } catch {
            statuses['skill-ws'] = 'offline';
          }
        }
      } catch {
        statuses['skill-ws'] = 'offline';
      }
      setServiceStatuses({ ...statuses });

      // Check chat-service
      try {
        const res = await fetch('/health?XTransformPort=3003', {
          signal: AbortSignal.timeout(3000),
        });
        statuses['chat-service'] = res.ok ? 'online' : 'offline';
      } catch {
        statuses['chat-service'] = 'offline';
      }
      setServiceStatuses({ ...statuses });
    };

    checkServices();
  }, []);

  const updateSetting = async (key: string, value: unknown) => {
    try {
      await api.updateSettings({ [key]: value });
      setSettings((prev) => ({ ...prev, [key]: value }));
      toast.success(t('settingsPage.saved'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to save';
      toast.error(msg);
    }
  };

  const handleUsernameSave = async () => {
    if (!username.trim()) {
      toast.error(t('common.required'));
      return;
    }
    try {
      await api.updateSettings({ username });
      toast.success(t('settingsPage.usernameSaved'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to save';
      toast.error(msg);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword) {
      toast.error(t('common.required'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('auth.passwordMinLength'));
      return;
    }
    try {
      await api.updateSettings({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast.success(t('settingsPage.passwordChanged'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to change password';
      toast.error(msg);
    }
  };

  const getSetting = (key: string, defaultValue: unknown = false) => {
    return settings[key] !== undefined ? settings[key] : defaultValue;
  };

  // Export configuration
  const handleExportConfig = async () => {
    try {
      const [agentsData, providersData, skillsData] = await Promise.all([
        api.getAgents().catch(() => ({ agents: [] })),
        api.getProviders().catch(() => ({ providers: [] })),
        api.getSkills().catch(() => ({ skills: [] })),
      ]);

      const exportData = {
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        agents: (agentsData.agents || []).map((a: Record<string, unknown>) => ({
          name: a.name,
          mode: a.mode,
          systemPrompt: a.systemPrompt,
          model: a.model,
          temperature: a.temperature,
        })),
        providers: (providersData.providers || []).map((p: Record<string, unknown>) => ({
          name: p.name,
          provider: p.provider,
          baseUrl: p.baseUrl,
        })),
        skills: (skillsData.skills || []).map((s: Record<string, unknown>) => ({
          name: s.name,
          category: s.category,
          handlerType: s.handlerType,
          config: s.config,
        })),
        settings: settings,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hermes-hub-config-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('settingsPage.exportSuccess'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Export failed';
      toast.error(msg);
    }
  };

  // Import configuration
  const handleImportConfig = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.agents && !data.providers && !data.skills) {
        toast.error(t('settingsPage.importFailed'));
        return;
      }

      // Import providers first (agents depend on them)
      if (data.providers && Array.isArray(data.providers)) {
        for (const provider of data.providers) {
          await api.createProvider(provider).catch(() => {});
        }
      }

      // Import agents
      if (data.agents && Array.isArray(data.agents)) {
        for (const agent of data.agents) {
          await api.createAgent(agent).catch(() => {});
        }
      }

      // Import settings
      if (data.settings && typeof data.settings === 'object') {
        await api.updateSettings(data.settings).catch(() => {});
      }

      toast.success(t('settingsPage.importSuccess'));
      setImportDialogOpen(false);
    } catch {
      toast.error(t('settingsPage.importFailed'));
    }
  };

  // Danger zone actions
  const handleClearConversations = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setClearing(true);
    try {
      const convs = conversations || [];
      for (const conv of convs) {
        await fetch(`/api/conversations/${conv.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'x-user-id': api.getUserId() || '' },
        }).catch(() => {});
      }
      toast.success(t('settingsPage.conversationsCleared'));
      setDeleteConfirmType(null);
      setDeleteConfirmText('');
    } catch {
      toast.error('Failed to clear conversations');
    } finally {
      setClearing(false);
    }
  };

  const handleClearAgents = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setClearing(true);
    try {
      const agentList = agents || [];
      for (const agent of agentList) {
        await api.deleteAgent(agent.id).catch(() => {});
      }
      toast.success(t('settingsPage.agentsCleared'));
      setDeleteConfirmType(null);
      setDeleteConfirmText('');
    } catch {
      toast.error('Failed to clear agents');
    } finally {
      setClearing(false);
    }
  };

  // Accent color handler
  const handleAccentChange = (accentId: string) => {
    updateSetting('accentColor', accentId);
    // Apply accent color CSS variable
    const root = document.documentElement;
    const accentMap: Record<string, Record<string, string>> = {
      default: {
        '--accent-primary-h': '222',
        '--accent-primary-s': '47%',
        '--accent-primary-l': '51%',
      },
      emerald: {
        '--accent-primary-h': '160',
        '--accent-primary-s': '84%',
        '--accent-primary-l': '39%',
      },
      rose: {
        '--accent-primary-h': '347',
        '--accent-primary-s': '77%',
        '--accent-primary-l': '50%',
      },
      amber: {
        '--accent-primary-h': '38',
        '--accent-primary-s': '92%',
        '--accent-primary-l': '50%',
      },
      cyan: {
        '--accent-primary-h': '188',
        '--accent-primary-s': '94%',
        '--accent-primary-l': '43%',
      },
    };
    const vars = accentMap[accentId];
    if (vars) {
      Object.entries(vars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    }
  };

  const conversationCount = conversations?.length || 0;
  const agentCount = agents?.length || 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('settingsPage.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('settingsPage.subtitle')}</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="general" className="gap-1.5 text-xs">
            <Palette className="w-3.5 h-3.5" /> {t('settingsPage.generalTab')}
          </TabsTrigger>
          <TabsTrigger value="acrp" className="gap-1.5 text-xs">
            <Hexagon className="w-3.5 h-3.5" /> {t('settingsPage.acrpTab')}
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-1.5 text-xs">
            <Database className="w-3.5 h-3.5" /> {t('settingsPage.dataManagementTab')}
          </TabsTrigger>
          <TabsTrigger value="about" className="gap-1.5 text-xs">
            <Info className="w-3.5 h-3.5" /> {t('settingsPage.aboutTab')}
          </TabsTrigger>
        </TabsList>

        {/* ==================== GENERAL TAB ==================== */}
        <TabsContent value="general">
          <div className="space-y-6">

            {/* Display Settings */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Palette}
                  title={t('settingsPage.displayTab')}
                  description={t('settingsPage.displayDesc')}
                />
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingRow
                  label={t('settingsPage.streaming')}
                  description={t('settingsPage.streamingDesc')}
                >
                  <Switch
                    checked={getSetting('streaming', true) as boolean}
                    onCheckedChange={(v) => updateSetting('streaming', v)}
                  />
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.compactMode')}
                  description={t('settingsPage.compactModeDesc')}
                >
                  <Switch
                    checked={getSetting('compactMode', false) as boolean}
                    onCheckedChange={(v) => updateSetting('compactMode', v)}
                  />
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.reasoningDisplay')}
                  description={t('settingsPage.reasoningDisplayDesc')}
                >
                  <Switch
                    checked={getSetting('reasoningDisplay', true) as boolean}
                    onCheckedChange={(v) => updateSetting('reasoningDisplay', v)}
                  />
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.costDisplay')}
                  description={t('settingsPage.costDisplayDesc')}
                >
                  <Switch
                    checked={getSetting('costDisplay', false) as boolean}
                    onCheckedChange={(v) => updateSetting('costDisplay', v)}
                  />
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.busyInputMode')}
                  description={t('settingsPage.busyInputModeDesc')}
                >
                  <Select
                    value={getSetting('busyInputMode', 'queue') as string}
                    onValueChange={(v) => updateSetting('busyInputMode', v)}
                  >
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="queue">{t('settingsPage.busyModeQueue')}</SelectItem>
                      <SelectItem value="interrupt">{t('settingsPage.busyModeInterrupt')}</SelectItem>
                      <SelectItem value="block">{t('settingsPage.busyModeBlock')}</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.bellOnComplete')}
                  description={t('settingsPage.bellOnCompleteDesc')}
                >
                  <Switch
                    checked={getSetting('bellOnComplete', false) as boolean}
                    onCheckedChange={(v) => updateSetting('bellOnComplete', v)}
                  />
                </SettingRow>
              </CardContent>
            </Card>

            {/* Theme Settings */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Sun}
                  title={t('settingsPage.theme')}
                  description={t('settingsPage.themeDesc')}
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Theme Selector */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">{t('settingsPage.theme')}</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'light', icon: Sun, label: t('settingsPage.themeLight'), preview: 'bg-white border' },
                      { value: 'dark', icon: Moon, label: t('settingsPage.themeDark'), preview: 'bg-zinc-900 border-zinc-700' },
                      { value: 'system', icon: MonitorSmartphone, label: t('settingsPage.themeSystem'), preview: 'bg-gradient-to-r from-white to-zinc-900 border' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setTheme(opt.value)}
                        className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                          theme === opt.value
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-md ${opt.preview}`} />
                        <span className="text-xs font-medium">{opt.label}</span>
                        {theme === opt.value && (
                          <CheckCircle2 className="absolute top-1.5 right-1.5 w-4 h-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Accent Color */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">{t('settingsPage.accentColor')}</Label>
                  <p className="text-xs text-muted-foreground mb-3">{t('settingsPage.accentColorDesc')}</p>
                  <div className="flex gap-3">
                    {ACCENT_COLORS.map((accent) => (
                      <button
                        key={accent.id}
                        onClick={() => handleAccentChange(accent.id)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all ${
                          getSetting('accentColor', 'default') === accent.id
                            ? 'border-primary shadow-sm'
                            : 'border-transparent hover:border-primary/30'
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-full border-2 border-white shadow-md"
                          style={{ backgroundColor: accent.color }}
                        />
                        <span className="text-[10px] font-medium">{t(accent.label)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Agent Settings */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Bot}
                  title={t('settingsPage.agentTab')}
                  description={t('settingsPage.agentDesc')}
                />
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingRow
                  label={t('settingsPage.maxTurns')}
                  description={t('settingsPage.maxTurnsDesc')}
                >
                  <Input
                    type="number"
                    className="w-24"
                    min={1}
                    max={100}
                    value={getSetting('maxTurns', 10) as number}
                    onChange={(e) => updateSetting('maxTurns', parseInt(e.target.value) || 10)}
                  />
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.gatewayTimeout')}
                  description={t('settingsPage.gatewayTimeoutDesc')}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-24"
                      min={10}
                      max={600}
                      value={getSetting('gatewayTimeout', 120) as number}
                      onChange={(e) => updateSetting('gatewayTimeout', parseInt(e.target.value) || 120)}
                    />
                    <span className="text-xs text-muted-foreground">{t('settingsPage.seconds')}</span>
                  </div>
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.restartDrainTimeout')}
                  description={t('settingsPage.restartDrainTimeoutDesc')}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-24"
                      min={10}
                      max={600}
                      value={getSetting('restartDrainTimeout', 30) as number}
                      onChange={(e) => updateSetting('restartDrainTimeout', parseInt(e.target.value) || 30)}
                    />
                    <span className="text-xs text-muted-foreground">{t('settingsPage.seconds')}</span>
                  </div>
                </SettingRow>
              </CardContent>
            </Card>

            {/* Memory Settings */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Brain}
                  title={t('settingsPage.memoryTab')}
                  description={t('settingsPage.memoryDesc')}
                />
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingRow
                  label={t('settingsPage.enableMemory')}
                  description={t('settingsPage.enableMemoryDesc')}
                >
                  <Switch
                    checked={getSetting('enableMemory', true) as boolean}
                    onCheckedChange={(v) => updateSetting('enableMemory', v)}
                  />
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.userProfileLimit')}
                  description={t('settingsPage.userProfileLimitDesc')}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-28"
                      min={100}
                      max={50000}
                      value={getSetting('userProfileCharLimit', 2000) as number}
                      onChange={(e) => updateSetting('userProfileCharLimit', parseInt(e.target.value) || 2000)}
                    />
                    <span className="text-xs text-muted-foreground">{t('settingsPage.characters')}</span>
                  </div>
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.memoryLimit')}
                  description={t('settingsPage.memoryLimitDesc')}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-28"
                      min={100}
                      max={100000}
                      value={getSetting('memoryCharLimit', 5000) as number}
                      onChange={(e) => updateSetting('memoryCharLimit', parseInt(e.target.value) || 5000)}
                    />
                    <span className="text-xs text-muted-foreground">{t('settingsPage.characters')}</span>
                  </div>
                </SettingRow>
              </CardContent>
            </Card>

            {/* Session Settings */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Clock}
                  title={t('settingsPage.sessionTab')}
                  description={t('settingsPage.sessionDesc')}
                />
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingRow
                  label={t('settingsPage.resetMode')}
                  description={t('settingsPage.resetModeDesc')}
                >
                  <Select
                    value={getSetting('sessionResetMode', 'idle') as string}
                    onValueChange={(v) => updateSetting('sessionResetMode', v)}
                  >
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="idle">{t('settingsPage.resetModeIdle')}</SelectItem>
                      <SelectItem value="scheduled">{t('settingsPage.resetModeScheduled')}</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
                <Separator />
                {(getSetting('sessionResetMode', 'idle') === 'idle') && (
                  <SettingRow
                    label={t('settingsPage.idleMinutes')}
                    description={t('settingsPage.idleMinutesDesc')}
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-28"
                        min={5}
                        max={1440}
                        value={getSetting('idleResetMinutes', 30) as number}
                        onChange={(e) => updateSetting('idleResetMinutes', parseInt(e.target.value) || 30)}
                      />
                      <span className="text-xs text-muted-foreground">{t('settingsPage.minutes')}</span>
                    </div>
                  </SettingRow>
                )}
                {(getSetting('sessionResetMode', 'idle') === 'scheduled') && (
                  <SettingRow
                    label={t('settingsPage.resetHour')}
                    description={t('settingsPage.resetHourDesc')}
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-28"
                        min={0}
                        max={23}
                        value={getSetting('scheduledResetHour', 0) as number}
                        onChange={(e) => updateSetting('scheduledResetHour', parseInt(e.target.value) || 0)}
                      />
                      <span className="text-xs text-muted-foreground">{t('settingsPage.hour')}</span>
                    </div>
                  </SettingRow>
                )}
              </CardContent>
            </Card>

            {/* Privacy Settings */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Lock}
                  title={t('settingsPage.privacyTab')}
                  description={t('settingsPage.privacyDesc')}
                />
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingRow
                  label={t('settingsPage.piiRedaction')}
                  description={t('settingsPage.piiRedactionDesc')}
                >
                  <Switch
                    checked={getSetting('piiRedaction', false) as boolean}
                    onCheckedChange={(v) => updateSetting('piiRedaction', v)}
                  />
                </SettingRow>
              </CardContent>
            </Card>

            {/* Model Settings */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Cpu}
                  title={t('settingsPage.modelTab')}
                  description={t('settingsPage.modelDesc')}
                />
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingRow
                  label={t('settingsPage.defaultProvider')}
                  description={t('settingsPage.defaultProviderDesc')}
                >
                  <Select
                    value={getSetting('defaultProviderId', '') as string}
                    onValueChange={(v) => updateSetting('defaultProviderId', v)}
                  >
                    <SelectTrigger className="w-48"><SelectValue placeholder={t('settingsPage.selectProvider')} /></SelectTrigger>
                    <SelectContent>
                      {providers.length === 0 ? (
                        <SelectItem value="none" disabled>{t('agents.noProviders')}</SelectItem>
                      ) : (
                        providers.map((p: Record<string, unknown>) => (
                          <SelectItem key={p.id as string} value={p.id as string}>{p.name as string} ({p.provider as string})</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.defaultModel')}
                  description={t('settingsPage.defaultModelDesc')}
                >
                  <Input
                    className="w-48"
                    placeholder="e.g., gpt-4o"
                    value={getSetting('defaultModel', '') as string}
                    onChange={(e) => updateSetting('defaultModel', e.target.value)}
                  />
                </SettingRow>
              </CardContent>
            </Card>

            {/* Platform Channels */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Radio}
                  title={t('settingsPage.platformTab')}
                  description={t('settingsPage.platformChannelDesc')}
                />
              </CardHeader>
              <CardContent>
                {channels && channels.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {channels.map((channel: Record<string, unknown>) => (
                      <div
                        key={channel.platform as string}
                        className="flex items-center justify-between p-3 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-3">
                          <MessageSquare className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium capitalize">{channel.platform as string}</p>
                            <p className="text-xs text-muted-foreground">
                              {channel.isActive ? t('common.enabled') : t('common.disabled')}
                            </p>
                          </div>
                        </div>
                        <Badge variant={channel.isActive ? 'default' : 'outline'} className="text-[10px]">
                          {channel.isActive ? t('channels.connected') : t('channels.disconnected')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Radio className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">{t('settingsPage.noChannels')}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('settingsPage.noChannelsDesc')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Settings */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={User}
                  title={t('settingsPage.accountTab')}
                />
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Profile */}
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                      {user?.name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{user?.name || 'User'}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('settingsPage.role')}: {user?.role || 'user'}</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>{t('settingsPage.username')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t('auth.namePlaceholder')}
                      />
                      <Button onClick={handleUsernameSave} size="sm" className="shrink-0">
                        {t('common.save')}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input defaultValue={user?.email} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('settingsPage.role')}</Label>
                      <Input defaultValue={user?.role || 'user'} disabled />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Password Change */}
                <div>
                  <Label className="text-sm font-semibold mb-3 block flex items-center gap-2">
                    <Lock className="w-4 h-4" /> {t('settingsPage.changePassword')}
                  </Label>
                  <div className="space-y-3 mt-2">
                    <div className="space-y-2">
                      <Label className="text-xs">{t('settingsPage.currentPassword')}</Label>
                      <div className="relative">
                        <Input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        >
                          {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">{t('settingsPage.newPassword')}</Label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>
                    <Button onClick={handlePasswordChange} className="w-full">
                      {t('settingsPage.changePassword')}
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Sign Out */}
                <Button variant="destructive" onClick={onLogout} className="gap-2">
                  <LogOut className="w-4 h-4" /> {t('settingsPage.signOut')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== ACRP TAB ==================== */}
        <TabsContent value="acrp">
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Hexagon}
                  title={t('settingsPage.acrp')}
                  description={t('settingsPage.acrpDesc')}
                />
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingRow
                  label={t('settingsPage.acrpHeartbeat')}
                  description={t('settingsPage.acrpHeartbeatDesc')}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-24"
                      min={5}
                      max={300}
                      value={getSetting('acrpHeartbeatInterval', 30) as number}
                      onChange={(e) => updateSetting('acrpHeartbeatInterval', parseInt(e.target.value) || 30)}
                    />
                    <span className="text-xs text-muted-foreground">{t('settingsPage.seconds')}</span>
                  </div>
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.acrpStaleTimeout')}
                  description={t('settingsPage.acrpStaleTimeoutDesc')}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-24"
                      min={10}
                      max={600}
                      value={getSetting('acrpStaleTimeout', 90) as number}
                      onChange={(e) => updateSetting('acrpStaleTimeout', parseInt(e.target.value) || 90)}
                    />
                    <span className="text-xs text-muted-foreground">{t('settingsPage.seconds')}</span>
                  </div>
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.acrpAutoRefresh')}
                  description={t('settingsPage.acrpAutoRefreshDesc')}
                >
                  <Select
                    value={String(getSetting('acrpAutoRefreshInterval', 30))}
                    onValueChange={(v) => updateSetting('acrpAutoRefreshInterval', parseInt(v))}
                  >
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AUTO_REFRESH_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.acrpShowOffline')}
                  description={t('settingsPage.acrpShowOfflineDesc')}
                >
                  <Switch
                    checked={getSetting('acrpShowOfflineAgents', true) as boolean}
                    onCheckedChange={(v) => updateSetting('acrpShowOfflineAgents', v)}
                  />
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.acrpMaxInvocations')}
                  description={t('settingsPage.acrpMaxInvocationsDesc')}
                >
                  <Input
                    type="number"
                    className="w-24"
                    min={1}
                    max={50}
                    value={getSetting('acrpMaxInvocations', 5) as number}
                    onChange={(e) => updateSetting('acrpMaxInvocations', parseInt(e.target.value) || 5)}
                  />
                </SettingRow>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== DATA TAB ==================== */}
        <TabsContent value="data">
          <div className="space-y-6">

            {/* Export / Import */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Download}
                  title={t('settingsPage.dataManagement')}
                  description={t('settingsPage.dataManagementDesc')}
                />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={handleExportConfig}
                  >
                    <Download className="w-4 h-4" /> {t('settingsPage.exportConfig')}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" /> {t('settingsPage.importConfig')}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImportDialogOpen(true);
                        // Store file for later use in confirmation
                        (fileInputRef.current as HTMLInputElement & { _pendingFile?: File })._pendingFile = file;
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t('settingsPage.exportDesc')}</p>
                <p className="text-xs text-muted-foreground">{t('settingsPage.importDesc')}</p>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/30">
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={AlertTriangle}
                  title={t('settingsPage.dangerZone')}
                  description={t('settingsPage.dangerZoneDesc')}
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Clear Conversations */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                  <div>
                    <p className="text-sm font-medium text-destructive">{t('settingsPage.clearConversations')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('settingsPage.clearConversationsDesc')} · {conversationCount} {t('settingsPage.conversationsLabel')}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => { setDeleteConfirmType('conversations'); setDeleteConfirmText(''); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {t('settingsPage.clearConversations')}
                  </Button>
                </div>

                {/* Clear Agents */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                  <div>
                    <p className="text-sm font-medium text-destructive">{t('settingsPage.clearAgents')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('settingsPage.clearAgentsDesc')} · {agentCount} {t('settingsPage.agentsLabel')}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => { setDeleteConfirmType('agents'); setDeleteConfirmText(''); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {t('settingsPage.clearAgents')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== ABOUT TAB ==================== */}
        <TabsContent value="about">
          <div className="space-y-6">
            {/* Version Info */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Info}
                  title={t('settingsPage.about')}
                  description={t('settingsPage.aboutDesc')}
                />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground">{t('settingsPage.version')}</p>
                    <p className="text-lg font-bold mt-1">2.0.0</p>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground">{t('settingsPage.protocolVersion')}</p>
                    <p className="text-lg font-bold mt-1">2.0</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Service Status */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Server}
                  title={t('settingsPage.serviceStatus')}
                  description={t('settingsPage.serviceStatusDesc')}
                />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { key: 'nextjs', name: 'Next.js', icon: Globe, port: 3000 },
                    { key: 'skill-ws', name: 'Skill WebSocket', icon: Wifi, port: 3004 },
                    { key: 'chat-service', name: 'Chat Service', icon: MessageSquare, port: 3003 },
                  ].map((service) => {
                    const status = serviceStatuses[service.key] || 'checking';
                    const Icon = service.icon;
                    return (
                      <div key={service.key} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{service.name}</p>
                            <p className="text-xs text-muted-foreground">:{service.port}</p>
                          </div>
                        </div>
                        <Badge
                          variant={status === 'online' ? 'default' : status === 'offline' ? 'destructive' : 'outline'}
                          className="gap-1"
                        >
                          {status === 'online' && <CheckCircle2 className="w-3 h-3" />}
                          {status === 'offline' && <XCircle className="w-3 h-3" />}
                          {status === 'checking' && <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                          {status === 'online' ? t('common.online') : status === 'offline' ? t('common.offline') : '...'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* System Info */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Cpu}
                  title={t('settingsPage.systemInfo')}
                  description={t('settingsPage.systemInfoDesc')}
                />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground">{t('settingsPage.nodeVersion')}</p>
                    <p className="text-sm font-medium mt-1">{typeof process !== 'undefined' && process.versions ? process.versions.node : 'N/A'}</p>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground">{t('settingsPage.databaseType')}</p>
                    <p className="text-sm font-medium mt-1">SQLite (Prisma)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Links */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={ExternalLink}
                  title={t('settingsPage.links')}
                />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { label: 'GitHub', href: 'https://github.com/hongmaple0820/hermes-hub', icon: Globe },
                    { label: t('settingsPage.documentation'), href: 'https://github.com/hongmaple0820/hermes-hub#readme', icon: Info },
                    { label: t('settingsPage.support'), href: 'https://github.com/hongmaple0820/hermes-hub/issues', icon: MessageSquare },
                  ].map((link) => {
                    const LinkIcon = link.icon;
                    return (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <LinkIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium flex-1">{link.label}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </a>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ==================== DIALOGS ==================== */}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirmType !== null}
        onOpenChange={(open) => { if (!open) { setDeleteConfirmType(null); setDeleteConfirmText(''); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {deleteConfirmType === 'conversations'
                ? t('settingsPage.clearConversations')
                : t('settingsPage.clearAgents')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmType === 'conversations'
                ? t('settingsPage.confirmClearConversations')
                : t('settingsPage.confirmClearAgents')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-sm">{t('settingsPage.typeDelete')}</Label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteConfirmType(null); setDeleteConfirmText(''); }}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteConfirmText !== 'DELETE' || clearing}
              onClick={() => {
                if (deleteConfirmType === 'conversations') handleClearConversations();
                else if (deleteConfirmType === 'agents') handleClearAgents();
              }}
            >
              {clearing ? t('settingsPage.clearing') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Confirmation Dialog */}
      <AlertDialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settingsPage.importConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('settingsPage.importConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const input = fileInputRef.current as HTMLInputElement & { _pendingFile?: File };
                if (input?._pendingFile) {
                  handleImportConfig(input._pendingFile);
                  input._pendingFile = undefined;
                }
              }}
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
