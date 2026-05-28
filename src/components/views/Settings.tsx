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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  Loader2, ChevronLeft, ChevronRight, FileText, FileSpreadsheet,
  ScrollText, CheckSquare, Square, Keyboard
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
    <div className="flex items-center justify-between py-3 transition-colors duration-200 hover:bg-accent/30 -mx-2 px-2 rounded-md">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description, gradient }: { icon: React.ElementType; title: string; description?: string; gradient?: string }) {
  const gradientClass = gradient || 'from-primary/20 to-primary/5';
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className={`mt-0.5 p-2 rounded-lg bg-gradient-to-br ${gradientClass} dark:from-primary/25 dark:to-primary/10 transition-all duration-300`}>
        <Icon className="w-4 h-4 text-primary/70 dark:text-primary/80" />
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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

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
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Refs for scrolling
  const usernameSectionRef = useRef<HTMLDivElement>(null);
  const passwordSectionRef = useRef<HTMLDivElement>(null);

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // About / service status state
  const [serviceStatuses, setServiceStatuses] = useState<Record<string, 'checking' | 'online' | 'offline'>>({});

  // Audit Log state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [auditAction, setAuditAction] = useState<string>('');
  const [auditLoading, setAuditLoading] = useState(false);

  // Data Export state
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [exportType, setExportType] = useState<string>('all');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [selectedExportTypes, setSelectedExportTypes] = useState<string[]>(['agents', 'skills', 'providers', 'conversations']);

  // Notification preferences (API-backed)
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  const [notifPrefsLoading, setNotifPrefsLoading] = useState(false);
  const notifPrefTypes = [
    { key: 'agent_status', label: 'settingsPage.notifAgentStatus', desc: 'settingsPage.notifAgentStatusDesc' },
    { key: 'run_complete', label: 'settingsPage.notifRunComplete', desc: 'settingsPage.notifRunCompleteDesc' },
    { key: 'skill_update', label: 'settingsPage.notifSkillUpdate', desc: 'settingsPage.notifSkillUpdateDesc' },
    { key: 'acrp_event', label: 'settingsPage.notifAcrpEvent', desc: 'settingsPage.notifAcrpEventDesc' },
  ];

  const loadNotifPrefs = useCallback(async () => {
    setNotifPrefsLoading(true);
    try {
      const result = await api.getNotificationPreferences();
      const prefsMap: Record<string, boolean> = {};
      for (const pref of result.preferences) {
        prefsMap[pref.type] = pref.enabled;
      }
      // Set defaults for missing types
      for (const t of notifPrefTypes) {
        if (!(t.key in prefsMap)) prefsMap[t.key] = true;
      }
      setNotifPrefs(prefsMap);
    } catch {
      // Default all to enabled
      const defaults: Record<string, boolean> = {};
      for (const t of notifPrefTypes) {
        defaults[t.key] = true;
      }
      setNotifPrefs(defaults);
    } finally {
      setNotifPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifPrefs();
  }, [loadNotifPrefs]);

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
    if (username.trim().length < 2 || username.trim().length > 30) {
      toast.error(t('settingsPage.usernameChangeFailed'));
      return;
    }
    setSavingUsername(true);
    try {
      const result = await api.changeUsername(username.trim());
      // Update the user in the store
      useAppStore.setState((state) => ({
        user: state.user ? { ...state.user, name: result.user.name } : state.user,
      }));
      toast.success(t('settingsPage.usernameChanged'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('settingsPage.usernameChangeFailed');
      toast.error(msg);
    } finally {
      setSavingUsername(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t('common.required'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('auth.passwordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('settingsPage.passwordMismatch'));
      return;
    }
    setSavingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(t('settingsPage.passwordChanged'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('incorrect') || msg.includes('Incorrect')) {
        toast.error(t('settingsPage.wrongPassword'));
      } else {
        toast.error(t('settingsPage.passwordChangeFailed'));
      }
    } finally {
      setSavingPassword(false);
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

  // Notification preference toggle (API-backed)
  const handleNotifPrefToggle = async (type: string, enabled: boolean) => {
    setNotifPrefs(prev => ({ ...prev, [type]: enabled }));
    try {
      await api.updateNotificationPreference(type, enabled);
      toast.success(t('settingsPage.saved'));
    } catch {
      // Revert on error
      setNotifPrefs(prev => ({ ...prev, [type]: !enabled }));
      toast.error(t('common.error'));
    }
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

  // Load Audit Logs
  const loadAuditLogs = useCallback(async (page?: number) => {
    setAuditLoading(true);
    try {
      const result = await api.getAuditLogs({
        page: page || auditPagination.page,
        limit: auditPagination.limit,
        action: auditAction || undefined,
      });
      setAuditLogs(result.logs || []);
      setAuditPagination(result.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }, [auditPagination.page, auditPagination.limit, auditAction]);

  useEffect(() => {
    loadAuditLogs();
  }, [auditAction, loadAuditLogs]);

  // Relative timestamp helper
  const getRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return t('audit.justNow');
    if (diffMin < 60) return t('audit.timeAgo').replace('{time}', `${diffMin}m`);
    if (diffHour < 24) return t('audit.timeAgo').replace('{time}', `${diffHour}h`);
    if (diffDay < 30) return t('audit.timeAgo').replace('{time}', `${diffDay}d`);
    return date.toLocaleDateString();
  };

  // Data Export handler with progress
  const handleDataExport = async () => {
    setExporting(true);
    setExportProgress(10);
    try {
      const typeParam = selectedExportTypes.length === 4 ? 'all' : selectedExportTypes.join(',');
      setExportProgress(30);
      const { blob, filename } = await api.exportData(exportFormat, typeParam);
      setExportProgress(70);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportProgress(100);
      toast.success(t('dataExport.success'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('dataExport.failed');
      toast.error(msg);
    } finally {
      setTimeout(() => {
        setExporting(false);
        setExportProgress(0);
      }, 500);
    }
  };

  const toggleExportType = (type: string) => {
    setSelectedExportTypes(prev => {
      if (prev.includes(type)) {
        if (prev.length <= 1) return prev; // Keep at least one selected
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  const conversationCount = conversations?.length || 0;
  const agentCount = agents?.length || 0;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('settingsPage.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('settingsPage.subtitle')}</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 overflow-x-auto">
          <TabsTrigger value="general" className="gap-1.5 text-xs shrink-0">
            <Palette className="w-3.5 h-3.5" /> {t('settingsPage.generalTab')}
          </TabsTrigger>
          <TabsTrigger value="acrp" className="gap-1.5 text-xs shrink-0">
            <Hexagon className="w-3.5 h-3.5" /> {t('settingsPage.acrpTab')}
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-1.5 text-xs shrink-0">
            <Database className="w-3.5 h-3.5" /> {t('settingsPage.dataManagementTab')}
          </TabsTrigger>
          <TabsTrigger value="about" className="gap-1.5 text-xs shrink-0">
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
                  gradient="from-violet-500/20 to-pink-500/10"
                />
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingRow
                  label={t('settingsPage.streaming')}
                  description={t('settingsPage.streamingDesc')}
                >
                  <div className="transition-transform duration-150 hover:scale-110">
                    <Switch
                      checked={getSetting('streaming', true) as boolean}
                      onCheckedChange={(v) => updateSetting('streaming', v)}
                    />
                  </div>
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.compactMode')}
                  description={t('settingsPage.compactModeDesc')}
                >
                  <div className="transition-transform duration-150 hover:scale-110">
                    <Switch
                      checked={getSetting('compactMode', false) as boolean}
                      onCheckedChange={(v) => updateSetting('compactMode', v)}
                    />
                  </div>
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.reasoningDisplay')}
                  description={t('settingsPage.reasoningDisplayDesc')}
                >
                  <div className="transition-transform duration-150 hover:scale-110">
                    <Switch
                      checked={getSetting('reasoningDisplay', true) as boolean}
                      onCheckedChange={(v) => updateSetting('reasoningDisplay', v)}
                    />
                  </div>
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.costDisplay')}
                  description={t('settingsPage.costDisplayDesc')}
                >
                  <div className="transition-transform duration-150 hover:scale-110">
                    <Switch
                      checked={getSetting('costDisplay', false) as boolean}
                      onCheckedChange={(v) => updateSetting('costDisplay', v)}
                    />
                  </div>
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
                    <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
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
                  <div className="transition-transform duration-150 hover:scale-110">
                    <Switch
                      checked={getSetting('bellOnComplete', false) as boolean}
                      onCheckedChange={(v) => updateSetting('bellOnComplete', v)}
                    />
                  </div>
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
                  gradient="from-amber-500/20 to-orange-500/10"
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Theme Selector */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">{t('settingsPage.theme')}</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { value: 'light', icon: Sun, label: t('settingsPage.themeLight'),
                        previewBg: 'bg-white',
                        previewContent: (
                          <div className="w-full h-full p-1.5 flex flex-col gap-1">
                            <div className="w-3/4 h-1 rounded-full bg-zinc-200" />
                            <div className="flex gap-0.5">
                              <div className="w-2 h-2 rounded-sm bg-zinc-100" />
                              <div className="w-2 h-2 rounded-sm bg-zinc-100" />
                            </div>
                            <div className="w-1/2 h-1 rounded-full bg-zinc-200" />
                          </div>
                        ),
                        border: 'border border-zinc-200 dark:border-zinc-500'
                      },
                      { value: 'dark', icon: Moon, label: t('settingsPage.themeDark'),
                        previewBg: 'bg-zinc-900',
                        previewContent: (
                          <div className="w-full h-full p-1.5 flex flex-col gap-1">
                            <div className="w-3/4 h-1 rounded-full bg-zinc-700" />
                            <div className="flex gap-0.5">
                              <div className="w-2 h-2 rounded-sm bg-zinc-800" />
                              <div className="w-2 h-2 rounded-sm bg-zinc-800" />
                            </div>
                            <div className="w-1/2 h-1 rounded-full bg-zinc-700" />
                          </div>
                        ),
                        border: 'border border-zinc-700 dark:border-zinc-500'
                      },
                      { value: 'system', icon: MonitorSmartphone, label: t('settingsPage.themeSystem'),
                        previewBg: 'bg-gradient-to-r from-white to-zinc-900',
                        previewContent: (
                          <div className="w-full h-full p-1.5 flex flex-col gap-1">
                            <div className="w-3/4 h-1 rounded-full bg-gradient-to-r from-zinc-200 to-zinc-700" />
                            <div className="flex gap-0.5">
                              <div className="w-2 h-2 rounded-sm bg-gradient-to-r from-zinc-100 to-zinc-800" />
                              <div className="w-2 h-2 rounded-sm bg-gradient-to-r from-zinc-100 to-zinc-800" />
                            </div>
                            <div className="w-1/2 h-1 rounded-full bg-gradient-to-r from-zinc-200 to-zinc-700" />
                          </div>
                        ),
                        border: 'border border-zinc-200 dark:border-zinc-500'
                      },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setTheme(opt.value)}
                        className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 ${
                          mounted && theme === opt.value
                            ? 'border-primary bg-primary/5 shadow-sm scale-[1.02]'
                            : 'border-border hover:border-primary/50 hover:shadow-sm'
                        }`}
                      >
                        <div className={`w-14 h-10 rounded-md overflow-hidden ${opt.previewBg} ${opt.border} shadow-sm`}>
                          {opt.previewContent}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <opt.icon className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs font-medium">{opt.label}</span>
                        </div>
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
                  <div className="flex flex-wrap gap-3">
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
                          className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-600 shadow-md"
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
                  gradient="from-emerald-500/20 to-teal-500/10"
                />
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingRow
                  label={t('settingsPage.maxTurns')}
                  description={t('settingsPage.maxTurnsDesc')}
                >
                  <Input
                    type="number"
                    className="w-full sm:w-24"
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
                      className="w-full sm:w-24"
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
                      className="w-full sm:w-24"
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
                  gradient="from-purple-500/20 to-indigo-500/10"
                />
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingRow
                  label={t('settingsPage.enableMemory')}
                  description={t('settingsPage.enableMemoryDesc')}
                >
                  <div className="transition-transform duration-150 hover:scale-110">
                    <Switch
                      checked={getSetting('enableMemory', true) as boolean}
                      onCheckedChange={(v) => updateSetting('enableMemory', v)}
                    />
                  </div>
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.userProfileLimit')}
                  description={t('settingsPage.userProfileLimitDesc')}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-full sm:w-28"
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
                      className="w-full sm:w-28"
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
                  gradient="from-cyan-500/20 to-sky-500/10"
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
                    <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
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
                        className="w-full sm:w-28"
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
                        className="w-full sm:w-28"
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
                  gradient="from-red-500/20 to-rose-500/10"
                />
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingRow
                  label={t('settingsPage.piiRedaction')}
                  description={t('settingsPage.piiRedactionDesc')}
                >
                  <div className="transition-transform duration-150 hover:scale-110">
                    <Switch
                      checked={getSetting('piiRedaction', false) as boolean}
                      onCheckedChange={(v) => updateSetting('piiRedaction', v)}
                    />
                  </div>
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
                  gradient="from-blue-500/20 to-cyan-500/10"
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
                    <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder={t('settingsPage.selectProvider')} /></SelectTrigger>
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
                    className="w-full sm:w-48"
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
                  gradient="from-teal-500/20 to-emerald-500/10"
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

            {/* Account Information */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={User}
                  title={t('settings.accountInfo')}
                />
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Profile */}
                <div className="flex items-center gap-5">
                  <Avatar className="w-20 h-20">
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                      {user?.name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-lg font-semibold">{user?.name || 'User'}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">{user?.role || 'user'}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => usernameSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                      <User className="w-3.5 h-3.5" /> {t('settings.editProfile')}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => passwordSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                      <Lock className="w-3.5 h-3.5" /> {t('settings.changePassword')}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3" ref={usernameSectionRef}>
                  <div className="space-y-2">
                    <Label>{t('settingsPage.username')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t('auth.namePlaceholder')}
                      />
                      <Button onClick={handleUsernameSave} size="sm" className="shrink-0" disabled={savingUsername}>
                        {savingUsername ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('common.save')}
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
                <div ref={passwordSectionRef}>
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
                    <div className="space-y-2">
                      <Label className="text-xs">{t('settingsPage.confirmPassword')}</Label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <Button onClick={handlePasswordChange} className="w-full" disabled={savingPassword}>
                      {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : t('settingsPage.changePassword')}
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
                  title={t('settingsPage.notificationPrefs')}
                  description={t('settingsPage.notificationPrefsDesc')}
                  gradient="from-amber-500/20 to-yellow-500/10"
                />
              </CardHeader>
              <CardContent className="space-y-1">
                {notifPrefsLoading && Object.keys(notifPrefs).length === 0 ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  notifPrefTypes.map((pref, i) => (
                    <div key={pref.key}>
                      {i > 0 && <Separator />}
                      <SettingRow
                        label={t(pref.label)}
                        description={t(pref.desc)}
                      >
                        <div className="transition-transform duration-150 hover:scale-110">
                          <Switch
                            checked={notifPrefs[pref.key] ?? true}
                            onCheckedChange={(v) => handleNotifPrefToggle(pref.key, v)}
                          />
                        </div>
                      </SettingRow>
                    </div>
                  ))
                )}
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
                  <div className="transition-transform duration-150 hover:scale-110">
                    <Switch
                      checked={privacyMode}
                      onCheckedChange={(v) => handleNotificationToggle('privacyMode', v, setPrivacyMode)}
                    />
                  </div>
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
                    onClick={() => toast.info(t('auth.comingSoon'))}
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
                      className="w-full sm:w-24"
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
                      className="w-full sm:w-24"
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
                    <SelectTrigger className="w-full sm:w-28"><SelectValue /></SelectTrigger>
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
                  <div className="transition-transform duration-150 hover:scale-110">
                    <Switch
                      checked={getSetting('acrpShowOfflineAgents', true) as boolean}
                      onCheckedChange={(v) => updateSetting('acrpShowOfflineAgents', v)}
                    />
                  </div>
                </SettingRow>
                <Separator />
                <SettingRow
                  label={t('settingsPage.acrpMaxInvocations')}
                  description={t('settingsPage.acrpMaxInvocationsDesc')}
                >
                  <Input
                    type="number"
                    className="w-full sm:w-24"
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

            {/* Data Export */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={Download}
                  title={t('dataExport.title')}
                  description={t('dataExport.subtitle')}
                  gradient="from-emerald-500/20 to-teal-500/10"
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Format selector */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('dataExport.format')}</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={exportFormat === 'json' ? 'default' : 'outline'}
                      size="sm"
                      className="gap-1.5 flex-1"
                      onClick={() => setExportFormat('json')}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {t('dataExport.formatJson')}
                    </Button>
                    <Button
                      variant={exportFormat === 'csv' ? 'default' : 'outline'}
                      size="sm"
                      className="gap-1.5 flex-1"
                      onClick={() => setExportFormat('csv')}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      {t('dataExport.formatCsv')}
                    </Button>
                  </div>
                </div>

                {/* Selective export checkboxes */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('dataExport.selectData')}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'agents', label: t('dataExport.agents'), desc: t('dataExport.includeAgents') },
                      { key: 'skills', label: t('dataExport.skills'), desc: t('dataExport.includeSkills') },
                      { key: 'providers', label: t('dataExport.providers'), desc: t('dataExport.includeProviders') },
                      { key: 'conversations', label: t('dataExport.conversations'), desc: t('dataExport.includeConversations') },
                    ].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => toggleExportType(item.key)}
                        className={`flex items-start gap-2.5 p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                          selectedExportTypes.includes(item.key)
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        {selectedExportTypes.includes(item.key) ? (
                          <CheckSquare className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Progress indicator */}
                {exporting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t('dataExport.exporting')}</span>
                      <span>{exportProgress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${exportProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <Button
                  className="w-full gap-2"
                  onClick={handleDataExport}
                  disabled={exporting || selectedExportTypes.length === 0}
                >
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('dataExport.exporting')}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      {t('dataExport.export')}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Audit Log */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <SectionHeader
                    icon={ScrollText}
                    title={t('audit.title')}
                    description={t('audit.subtitle')}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => loadAuditLogs()}
                    disabled={auditLoading}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin' : ''}`} />
                    {t('audit.refresh')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filter controls */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-1 block">{t('audit.filterAction')}</Label>
                    <Select value={auditAction} onValueChange={(v) => { setAuditAction(v === '__all__' ? '' : v); }}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('audit.allActions')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{t('audit.allActions')}</SelectItem>
                        <SelectItem value="agent.create">agent.create</SelectItem>
                        <SelectItem value="agent.delete">agent.delete</SelectItem>
                        <SelectItem value="skill.create">skill.create</SelectItem>
                        <SelectItem value="skill.delete">skill.delete</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Audit log table */}
                {auditLoading && auditLogs.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <ScrollText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">{t('audit.noLogs')}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">{t('audit.time')}</TableHead>
                          <TableHead className="w-[140px]">{t('audit.action')}</TableHead>
                          <TableHead className="w-[100px]">{t('audit.resource')}</TableHead>
                          <TableHead>{t('audit.details')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map((log, i) => (
                          <TableRow key={log.id} className={i % 2 === 0 ? 'bg-muted/30' : ''}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              <span title={new Date(log.createdAt).toLocaleString()}>
                                {getRelativeTime(log.createdAt)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {log.resource}
                              {log.resourceId && (
                                <span className="text-muted-foreground ml-1 font-mono text-[10px]">
                                  {log.resourceId.slice(0, 8)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {log.details
                                ? (typeof log.details === 'string'
                                  ? log.details.slice(0, 80)
                                  : JSON.stringify(log.details).slice(0, 80))
                                : t('audit.noDetails')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Pagination */}
                {auditPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {t('audit.page').replace('{page}', `${auditPagination.page}`)} · {auditPagination.total} {t('audit.details').toLowerCase()}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        disabled={auditPagination.page <= 1 || auditLoading}
                        onClick={() => loadAuditLogs(auditPagination.page - 1)}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        {t('audit.previous')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        disabled={auditPagination.page >= auditPagination.totalPages || auditLoading}
                        onClick={() => loadAuditLogs(auditPagination.page + 1)}
                      >
                        {t('audit.next')}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-2 border-destructive/40 dark:border-destructive/30 overflow-hidden relative">
              <div className="absolute inset-0 bg-destructive/[0.03] dark:bg-destructive/[0.06] pointer-events-none" />
              <CardHeader className="pb-3 relative">
                <SectionHeader
                  icon={AlertTriangle}
                  title={t('settingsPage.dangerZone')}
                  description={t('settingsPage.dangerZoneDesc')}
                  gradient="from-red-500/25 to-orange-500/15"
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
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{t('settingsPage.deleteAccountConfirm')}</p>
              <Input
                placeholder="DELETE"
                value={deleteAccountConfirmText}
                onChange={(e) => setDeleteAccountConfirmText(e.target.value)}
                className="text-sm"
              />
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteAccountConfirmText !== 'DELETE' || deletingAccount}
                onClick={async () => {
                  if (deleteAccountConfirmText !== 'DELETE') return;
                  setDeletingAccount(true);
                  try {
                    await api.deleteAccount();
                    setDeleteAccountDialogOpen(false);
                    toast.success(t('settingsPage.saved'));
                    onLogout();
                  } catch (error: unknown) {
                    const msg = error instanceof Error ? error.message : 'Failed to delete account';
                    toast.error(msg);
                  } finally {
                    setDeletingAccount(false);
                  }
                }}
              >
                {deletingAccount ? t('jobs.saving') : t('settings.deleteAccount')}
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
