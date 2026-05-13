'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  RefreshCw, EyeIcon, Sun, Moon, MonitorSmartphone, Zap, Hexagon,
  FileText, Scale, Code, Sparkles, Type, Move, Keyboard, Terminal
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

const FONT_SIZE_OPTIONS = [
  { value: 'small', labelKey: 'settingsPage.fontSizeSmall' },
  { value: 'medium', labelKey: 'settingsPage.fontSizeMedium' },
  { value: 'large', labelKey: 'settingsPage.fontSizeLarge' },
];

const AUTO_REFRESH_OPTIONS = [
  { value: '15', label: '15s' },
  { value: '30', label: '30s' },
  { value: '60', label: '60s' },
];

export function Settings({ onLogout }: SettingsProps) {
  const { user, providers, channels, agents, conversations } = useAppStore();
  const { t } = useI18n();
  const { theme: rawTheme, setTheme } = useTheme();
  // During SSR/hydration, theme may be undefined; default to 'system'
  const theme = rawTheme ?? 'system';
  // Track mount to avoid hydration mismatch for theme-dependent UI
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileAvatar, setProfileAvatar] = useState(user?.avatar || '');

  // Notification preferences (localStorage)
  const [emailNotifications, setEmailNotifications] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('hermes-emailNotifications') !== 'false';
    return true;
  });
  const [pushNotifications, setPushNotifications] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('hermes-pushNotifications') !== 'false';
    return true;
  });
  const [soundAlerts, setSoundAlerts] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('hermes-soundAlerts') === 'true';
    return false;
  });
  const [privacyMode, setPrivacyMode] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('hermes-privacyMode') === 'true';
    return false;
  });

  // Danger zone state
  const [deleteConfirmType, setDeleteConfirmType] = useState<'conversations' | 'agents' | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);

  // Delete account dialog
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // About / service health state
  const [serviceStatuses, setServiceStatuses] = useState<Record<string, 'checking' | 'online' | 'offline'>>({});
  const [serviceHealth, setServiceHealth] = useState<Record<string, { uptime?: string; responseTime?: number }>>({});
  const [healthRefreshing, setHealthRefreshing] = useState(false);
  const healthRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Check service health with uptime and response time
  const checkServiceHealth = useCallback(async () => {
    setHealthRefreshing(true);
    const statuses: Record<string, 'checking' | 'online' | 'offline'> = {
      nextjs: 'checking',
      'skill-ws': 'checking',
      'chat-service': 'checking',
      terminal: 'checking',
    };
    const health: Record<string, { uptime?: string; responseTime?: number }> = {};
    setServiceStatuses(statuses);

    // Next.js is always online if we're loading this page
    statuses.nextjs = 'online';
    health.nextjs = { uptime: '-', responseTime: 0 };
    setServiceStatuses({ ...statuses });
    setServiceHealth({ ...health });

    // Check skill-ws
    try {
      const start = Date.now();
      const res = await fetch('/api/health?XTransformPort=3004', {
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);
      const elapsed = Date.now() - start;
      if (res?.ok) {
        statuses['skill-ws'] = 'online';
        try {
          const data = await res.json();
          health['skill-ws'] = {
            uptime: data.uptime ? formatUptime(data.uptime) : '-',
            responseTime: elapsed,
          };
        } catch {
          health['skill-ws'] = { uptime: '-', responseTime: elapsed };
        }
      } else {
        statuses['skill-ws'] = 'offline';
        health['skill-ws'] = { uptime: '-', responseTime: elapsed };
      }
    } catch {
      statuses['skill-ws'] = 'offline';
      health['skill-ws'] = { uptime: '-', responseTime: -1 };
    }
    setServiceStatuses({ ...statuses });
    setServiceHealth({ ...health });

    // Check chat-service
    try {
      const start = Date.now();
      const res = await fetch('/api/health?XTransformPort=3003', {
        signal: AbortSignal.timeout(5000),
      });
      const elapsed = Date.now() - start;
      statuses['chat-service'] = res.ok ? 'online' : 'offline';
      if (res.ok) {
        try {
          const data = await res.json();
          health['chat-service'] = {
            uptime: data.uptime ? formatUptime(data.uptime) : '-',
            responseTime: elapsed,
          };
        } catch {
          health['chat-service'] = { uptime: '-', responseTime: elapsed };
        }
      } else {
        health['chat-service'] = { uptime: '-', responseTime: elapsed };
      }
    } catch {
      statuses['chat-service'] = 'offline';
      health['chat-service'] = { uptime: '-', responseTime: -1 };
    }
    setServiceStatuses({ ...statuses });
    setServiceHealth({ ...health });

    // Check terminal service (3005)
    try {
      const start = Date.now();
      const res = await fetch('/api/health?XTransformPort=3005', {
        signal: AbortSignal.timeout(5000),
      });
      const elapsed = Date.now() - start;
      statuses.terminal = res.ok ? 'online' : 'offline';
      if (res.ok) {
        try {
          const data = await res.json();
          health.terminal = {
            uptime: data.uptime ? formatUptime(data.uptime) : '-',
            responseTime: elapsed,
          };
        } catch {
          health.terminal = { uptime: '-', responseTime: elapsed };
        }
      } else {
        health.terminal = { uptime: '-', responseTime: elapsed };
      }
    } catch {
      statuses.terminal = 'offline';
      health.terminal = { uptime: '-', responseTime: -1 };
    }
    setServiceStatuses({ ...statuses });
    setServiceHealth({ ...health });
    setHealthRefreshing(false);
  }, []);

  // Format uptime from seconds to human readable
  const formatUptime = (seconds: number): string => {
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
  };

  useEffect(() => {
    checkServiceHealth();
    // Auto-refresh every 60 seconds
    healthRefreshRef.current = setInterval(checkServiceHealth, 60000);
    return () => {
      if (healthRefreshRef.current) clearInterval(healthRefreshRef.current);
    };
  }, [checkServiceHealth]);

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
    setProfileSaving(true);
    try {
      const result = await api.updateProfile({ name: username.trim(), email: profileEmail.trim() || undefined, avatar: profileAvatar || undefined });
      // Update the store user
      useAppStore.setState({ user: result.user });
      toast.success(t('settings.profileSaved'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to save';
      toast.error(msg);
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t('common.required'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('settings.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('settings.passwordMismatch'));
      return;
    }
    setPasswordSaving(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(t('settings.passwordChanged'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to change password';
      if (msg.toLowerCase().includes('wrong') || msg.toLowerCase().includes('incorrect')) {
        toast.error(t('settings.wrongPassword'));
      } else {
        toast.error(msg);
      }
    } finally {
      setPasswordSaving(false);
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

  // Export ALL data (conversations included)
  const handleExportAllData = async () => {
    try {
      const [agentsData, providersData, skillsData, convsData] = await Promise.all([
        api.getAgents().catch(() => ({ agents: [] })),
        api.getProviders().catch(() => ({ providers: [] })),
        api.getSkills().catch(() => ({ skills: [] })),
        api.getConversations().catch(() => ({ conversations: [] })),
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
        conversations: (convsData.conversations || []).map((c: Record<string, unknown>) => ({
          id: c.id,
          title: c.title,
          messages: c.messages,
        })),
        settings: settings,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hermes-hub-all-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('settingsPage.exportAllSuccess'));
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
  const handleNotificationToggle = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    localStorage.setItem(`hermes-${key}`, String(value));
    toast.success(t('settingsPage.saved'));
  };

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

  // Font size handler
  const handleFontSizeChange = (fontSize: string) => {
    updateSetting('fontSize', fontSize);
    const root = document.documentElement;
    const sizeMap: Record<string, string> = {
      small: '14px',
      medium: '16px',
      large: '18px',
    };
    root.style.fontSize = sizeMap[fontSize] || '16px';
  };

  // Animation toggle handler
  const handleAnimationToggle = (enabled: boolean) => {
    updateSetting('animationsEnabled', enabled);
    const root = document.documentElement;
    if (!enabled) {
      root.style.setProperty('--animation-duration', '0s');
      root.classList.add('reduce-motion');
    } else {
      root.style.removeProperty('--animation-duration');
      root.classList.remove('reduce-motion');
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
          <TabsTrigger value="appearance" className="gap-1.5 text-xs">
            <Sun className="w-3.5 h-3.5" /> {t('settingsPage.appearanceTab')}
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

            {/* Profile Management */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={User}
                  title={t('settings.profile')}
                  description={t('settings.profileDesc')}
                />
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Section */}
                <div className="flex items-center gap-5">
                  <div className="relative group">
                    <Avatar className="w-20 h-20">
                      {profileAvatar ? (
                        <img src={profileAvatar} alt={username} className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                          {username?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                      onClick={() => {
                        const url = prompt(t('settings.avatarUrl'), profileAvatar);
                        if (url !== null) setProfileAvatar(url);
                      }}
                    >
                      <User className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-semibold">{user?.name || 'User'}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">{user?.role || 'user'}</Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Profile Fields */}
                <div className="space-y-4">
                  {/* Display Name */}
                  <div className="space-y-2">
                    <Label>{t('settings.displayName')}</Label>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t('auth.namePlaceholder')}
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label>{t('settings.emailAddress')}</Label>
                    <Input
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      placeholder="user@example.com"
                    />
                    <p className="text-xs text-muted-foreground">{t('settings.emailVerificationNote')}</p>
                  </div>

                  {/* Avatar URL */}
                  <div className="space-y-2">
                    <Label>{t('settings.avatarUrl')}</Label>
                    <Input
                      value={profileAvatar}
                      onChange={(e) => setProfileAvatar(e.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </div>

                  {/* Role (read-only) */}
                  <div className="space-y-2">
                    <Label>{t('settingsPage.role')}</Label>
                    <Input defaultValue={user?.role || 'user'} disabled />
                  </div>

                  {/* Save Profile Button */}
                  <Button onClick={handleUsernameSave} className="w-full" disabled={profileSaving}>
                    {profileSaving ? (
                      <><span className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" /> {t('common.saving') || 'Saving...'}</>
                    ) : t('common.save')}
                  </Button>
                </div>

                <Separator />

                {/* Change Password Section */}
                <div>
                  <Label className="text-sm font-semibold mb-3 block flex items-center gap-2">
                    <Lock className="w-4 h-4" /> {t('settings.changePassword')}
                  </Label>
                  <div className="space-y-3 mt-2">
                    {/* Current Password */}
                    <div className="space-y-2">
                      <Label className="text-xs">{t('settings.currentPassword')}</Label>
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
                    {/* New Password */}
                    <div className="space-y-2">
                      <Label className="text-xs">{t('settings.newPassword')}</Label>
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
                    {/* Confirm New Password */}
                    <div className="space-y-2">
                      <Label className="text-xs">{t('settings.confirmPassword')}</Label>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                      {confirmPassword && newPassword && confirmPassword !== newPassword && (
                        <p className="text-xs text-red-500">{t('settings.passwordMismatch')}</p>
                      )}
                    </div>
                    <Button onClick={handlePasswordChange} className="w-full" disabled={passwordSaving}>
                      {passwordSaving ? (
                        <><span className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" /> {t('settings.changePassword')}</>
                      ) : t('settings.changePassword')}
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

            {/* Notification Preferences */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Bell}
                  title={t('settings.notifications')}
                  description={t('settings.notifications')}
                />
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingRow
                  label={t('settings.emailNotifications')}
                  description={t('settings.emailNotifications')}
                >
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={(v) => handleNotificationToggle('emailNotifications', v, setEmailNotifications)}
                  />
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settings.pushNotifications')}
                  description={t('settings.pushNotifications')}
                >
                  <Switch
                    checked={pushNotifications}
                    onCheckedChange={(v) => handleNotificationToggle('pushNotifications', v, setPushNotifications)}
                  />
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settings.soundAlerts')}
                  description={t('settings.soundAlerts')}
                >
                  <Switch
                    checked={soundAlerts}
                    onCheckedChange={(v) => handleNotificationToggle('soundAlerts', v, setSoundAlerts)}
                  />
                </SettingRow>
              </CardContent>
            </Card>

            {/* Data & Privacy */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Shield}
                  title={t('settings.dataPrivacy')}
                  description={t('settings.dataPrivacy')}
                />
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingRow
                  label={t('settings.privacyMode')}
                  description={t('settings.privacyMode')}
                >
                  <Switch
                    checked={privacyMode}
                    onCheckedChange={(v) => handleNotificationToggle('privacyMode', v, setPrivacyMode)}
                  />
                </SettingRow>
                <Separator />
                <div className="flex items-center justify-between py-3">
                  <div className="flex-1 mr-4">
                    <p className="text-sm font-medium">{t('settings.exportData')}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleExportAllData}
                  >
                    <Download className="w-3.5 h-3.5" /> {t('settings.exportData')}
                  </Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-3">
                  <div className="flex-1 mr-4">
                    <p className="text-sm font-medium text-destructive">{t('settings.deleteAccount')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('settings.deleteAccountConfirm')}</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setDeleteAccountDialogOpen(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {t('settings.deleteAccount')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== APPEARANCE TAB ==================== */}
        <TabsContent value="appearance">
          <div className="space-y-6">

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
                          mounted && theme === opt.value
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-md ${opt.preview}`} />
                        <span className="text-xs font-medium">{opt.label}</span>
                        {mounted && theme === opt.value && (
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

            {/* Font Size */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Type}
                  title={t('settingsPage.fontSize')}
                  description={t('settingsPage.fontSizeDesc')}
                />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {FONT_SIZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleFontSizeChange(opt.value)}
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        getSetting('fontSize', 'medium') === opt.value
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <span className={`${opt.value === 'small' ? 'text-xs' : opt.value === 'large' ? 'text-lg' : 'text-sm'} font-medium`}>
                        Aa
                      </span>
                      <span className="text-xs font-medium">{t(opt.labelKey)}</span>
                      {getSetting('fontSize', 'medium') === opt.value && (
                        <CheckCircle2 className="absolute top-1.5 right-1.5 w-4 h-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Compact Mode & Animation Toggles */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Move}
                  title={t('settingsPage.interfaceTab')}
                  description={t('settingsPage.interfaceDesc')}
                />
              </CardHeader>
              <CardContent className="space-y-1">
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
                  label={t('settingsPage.animationsEnabled')}
                  description={t('settingsPage.animationsEnabledDesc')}
                >
                  <Switch
                    checked={getSetting('animationsEnabled', true) as boolean}
                    onCheckedChange={(v) => handleAnimationToggle(v)}
                  />
                </SettingRow>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Export All Data */}
                  <Button
                    variant="outline"
                    className="h-auto py-4 flex flex-col items-center gap-2"
                    onClick={handleExportAllData}
                  >
                    <Download className="w-5 h-5" />
                    <span className="text-sm font-medium">{t('settingsPage.exportAllData')}</span>
                    <span className="text-[10px] text-muted-foreground">{t('settingsPage.exportAllDataDesc')}</span>
                  </Button>
                  {/* Import Data */}
                  <Button
                    variant="outline"
                    className="h-auto py-4 flex flex-col items-center gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-5 h-5" />
                    <span className="text-sm font-medium">{t('settingsPage.importData')}</span>
                    <span className="text-[10px] text-muted-foreground">{t('settingsPage.importDataDesc')}</span>
                  </Button>
                </div>
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
                <Separator />
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={handleExportConfig}
                  >
                    <FileText className="w-4 h-4" /> {t('settingsPage.exportConfig')}
                  </Button>
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

                <Separator />

                {/* License Info */}
                <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
                  <div className="p-2 rounded-lg bg-muted">
                    <Scale className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t('settingsPage.license')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('settingsPage.licenseDesc')}</p>
                  </div>
                  <Badge variant="secondary" className="ml-auto text-xs">MIT</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Service Health Dashboard */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <SectionHeader
                    icon={Heart}
                    title={t('settings.serviceHealth')}
                    description={t('settings.serviceHealthDesc')}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={checkServiceHealth}
                    disabled={healthRefreshing}
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', healthRefreshing && 'animate-spin')} />
                    {t('settings.checkAllServices')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { key: 'nextjs', name: 'Next.js App', icon: Globe, port: 3000 },
                    { key: 'chat-service', name: 'Chat Service', icon: MessageSquare, port: 3003 },
                    { key: 'skill-ws', name: 'Skill WebSocket', icon: Wifi, port: 3004 },
                    { key: 'terminal', name: 'Terminal Service', icon: Terminal, port: 3005 },
                  ].map((service) => {
                    const status = serviceStatuses[service.key] || 'checking';
                    const healthInfo = serviceHealth[service.key];
                    const Icon = service.icon;
                    return (
                      <div key={service.key} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          {/* Status dot with pulse animation */}
                          <span className="relative flex h-3 w-3 shrink-0">
                            {status === 'online' && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            )}
                            <span className={cn(
                              'relative inline-flex rounded-full h-3 w-3 shrink-0',
                              status === 'online' ? 'bg-green-500' : status === 'offline' ? 'bg-red-500' : 'bg-amber-400'
                            )} />
                          </span>
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{service.name}</p>
                            <p className="text-xs text-muted-foreground">:{service.port}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {/* Uptime */}
                          {healthInfo?.uptime && healthInfo.uptime !== '-' && (
                            <div className="text-right hidden sm:block">
                              <p className="text-[10px] text-muted-foreground">{t('dashboard.uptime')}</p>
                              <p className="text-xs font-medium">{healthInfo.uptime}</p>
                            </div>
                          )}
                          {/* Response time */}
                          {healthInfo?.responseTime !== undefined && healthInfo.responseTime >= 0 && (
                            <div className="text-right">
                              <p className="text-[10px] text-muted-foreground">{t('settings.responseTime')}</p>
                              <p className={cn(
                                'text-xs font-medium',
                                healthInfo.responseTime < 200 ? 'text-green-600' :
                                healthInfo.responseTime < 1000 ? 'text-amber-600' : 'text-red-600'
                              )}>
                                {healthInfo.responseTime}ms
                              </p>
                            </div>
                          )}
                          {/* Status badge */}
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
                      </div>
                    );
                  })}
                </div>
                {/* Overall health summary */}
                <div className="mt-4 pt-3 border-t flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'w-2.5 h-2.5 rounded-full',
                      Object.values(serviceStatuses).filter(s => s === 'online').length === Object.keys(serviceStatuses).length
                        ? 'bg-green-500' : Object.values(serviceStatuses).some(s => s === 'offline')
                          ? 'bg-red-500' : 'bg-amber-400'
                    )} />
                    <span className="text-xs text-muted-foreground">
                      {Object.values(serviceStatuses).filter(s => s === 'online').length}/{Object.keys(serviceStatuses).length} {t('common.online').toLowerCase()}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {t('dashboard.lastChecked')}: {new Date().toLocaleTimeString()}
                  </span>
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

                <Separator className="my-4" />

                {/* Keyboard Shortcuts Link */}
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="p-2 rounded-lg bg-muted">
                    <Keyboard className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t('keyboard.title')}</p>
                    <p className="text-xs text-muted-foreground">{t('keyboard.description')}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">⌘/</Badge>
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
                    { label: 'GitHub', href: 'https://github.com/hongmaple0820/hermes-hub', icon: Code },
                    { label: t('settingsPage.documentation'), href: 'https://github.com/hongmaple0820/hermes-hub#readme', icon: Info },
                    { label: t('settingsPage.support'), href: 'https://github.com/hongmaple0820/hermes-hub/issues', icon: MessageSquare },
                    { label: t('settingsPage.license'), href: 'https://github.com/hongmaple0820/hermes-hub/blob/main/LICENSE', icon: Scale },
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

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {t('settings.deleteAccount')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.deleteAccountConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setDeleteAccountDialogOpen(false);
                toast.info(t('auth.comingSoon'));
              }}
            >
              {t('settings.deleteAccount')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
