'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
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
  LogOut, User, Shield, Palette, Bot, Brain, Clock, Lock, Cpu,
  Radio, Bell, Eye, EyeOff, MessageSquare, RotateCcw
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

export function Settings({ onLogout }: SettingsProps) {
  const { user, providers, channels } = useAppStore();
  const { t } = useI18n();
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getSettings();
      setSettings(result.settings || {});
    } catch (error) {
      // Settings might not exist yet, use defaults
      setSettings({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSetting = async (key: string, value: any) => {
    try {
      const result = await api.updateSettings({ [key]: value });
      setSettings((prev: any) => ({ ...prev, [key]: value }));
      toast.success(t('settingsPage.saved'));
    } catch (error: any) {
      toast.error(error.message);
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
    } catch (error: any) {
      toast.error(error.message);
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
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getSetting = (key: string, defaultValue: any = false) => {
    return settings[key] !== undefined ? settings[key] : defaultValue;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('settingsPage.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('settingsPage.subtitle')}</p>
      </div>

      <Tabs defaultValue="display" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="display" className="gap-1.5 text-xs"><Palette className="w-3.5 h-3.5" /> {t('settingsPage.displayTab')}</TabsTrigger>
          <TabsTrigger value="agent" className="gap-1.5 text-xs"><Bot className="w-3.5 h-3.5" /> {t('settingsPage.agentTab')}</TabsTrigger>
          <TabsTrigger value="memory" className="gap-1.5 text-xs"><Brain className="w-3.5 h-3.5" /> {t('settingsPage.memoryTab')}</TabsTrigger>
          <TabsTrigger value="session" className="gap-1.5 text-xs"><Clock className="w-3.5 h-3.5" /> {t('settingsPage.sessionTab')}</TabsTrigger>
          <TabsTrigger value="privacy" className="gap-1.5 text-xs"><Lock className="w-3.5 h-3.5" /> {t('settingsPage.privacyTab')}</TabsTrigger>
          <TabsTrigger value="model" className="gap-1.5 text-xs"><Cpu className="w-3.5 h-3.5" /> {t('settingsPage.modelTab')}</TabsTrigger>
          <TabsTrigger value="platform" className="gap-1.5 text-xs"><Radio className="w-3.5 h-3.5" /> {t('settingsPage.platformTab')}</TabsTrigger>
          <TabsTrigger value="account" className="gap-1.5 text-xs"><User className="w-3.5 h-3.5" /> {t('settingsPage.accountTab')}</TabsTrigger>
        </TabsList>

        {/* Display Tab */}
        <TabsContent value="display">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="w-4 h-4" /> {t('settingsPage.displayTab')}
              </CardTitle>
              <CardDescription>{t('settingsPage.displayDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <SettingRow
                label={t('settingsPage.streaming')}
                description={t('settingsPage.streamingDesc')}
              >
                <Switch
                  checked={getSetting('streaming', true)}
                  onCheckedChange={(v) => updateSetting('streaming', v)}
                />
              </SettingRow>
              <Separator />
              <SettingRow
                label={t('settingsPage.compactMode')}
                description={t('settingsPage.compactModeDesc')}
              >
                <Switch
                  checked={getSetting('compactMode', false)}
                  onCheckedChange={(v) => updateSetting('compactMode', v)}
                />
              </SettingRow>
              <Separator />
              <SettingRow
                label={t('settingsPage.reasoningDisplay')}
                description={t('settingsPage.reasoningDisplayDesc')}
              >
                <Switch
                  checked={getSetting('reasoningDisplay', true)}
                  onCheckedChange={(v) => updateSetting('reasoningDisplay', v)}
                />
              </SettingRow>
              <Separator />
              <SettingRow
                label={t('settingsPage.costDisplay')}
                description={t('settingsPage.costDisplayDesc')}
              >
                <Switch
                  checked={getSetting('costDisplay', false)}
                  onCheckedChange={(v) => updateSetting('costDisplay', v)}
                />
              </SettingRow>
              <Separator />
              <SettingRow
                label={t('settingsPage.busyInputMode')}
                description={t('settingsPage.busyInputModeDesc')}
              >
                <Select
                  value={getSetting('busyInputMode', 'queue')}
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
                  checked={getSetting('bellOnComplete', false)}
                  onCheckedChange={(v) => updateSetting('bellOnComplete', v)}
                />
              </SettingRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agent Tab */}
        <TabsContent value="agent">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="w-4 h-4" /> {t('settingsPage.agentTab')}
              </CardTitle>
              <CardDescription>{t('settingsPage.agentDesc')}</CardDescription>
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
                  value={getSetting('maxTurns', 10)}
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
                    value={getSetting('gatewayTimeout', 120)}
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
                    value={getSetting('restartDrainTimeout', 30)}
                    onChange={(e) => updateSetting('restartDrainTimeout', parseInt(e.target.value) || 30)}
                  />
                  <span className="text-xs text-muted-foreground">{t('settingsPage.seconds')}</span>
                </div>
              </SettingRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Memory Tab */}
        <TabsContent value="memory">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="w-4 h-4" /> {t('settingsPage.memoryTab')}
              </CardTitle>
              <CardDescription>{t('settingsPage.memoryDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <SettingRow
                label={t('settingsPage.enableMemory')}
                description={t('settingsPage.enableMemoryDesc')}
              >
                <Switch
                  checked={getSetting('enableMemory', true)}
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
                    value={getSetting('userProfileCharLimit', 2000)}
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
                    value={getSetting('memoryCharLimit', 5000)}
                    onChange={(e) => updateSetting('memoryCharLimit', parseInt(e.target.value) || 5000)}
                  />
                  <span className="text-xs text-muted-foreground">{t('settingsPage.characters')}</span>
                </div>
              </SettingRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Session Reset Tab */}
        <TabsContent value="session">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" /> {t('settingsPage.sessionTab')}
              </CardTitle>
              <CardDescription>{t('settingsPage.sessionDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <SettingRow
                label={t('settingsPage.resetMode')}
                description={t('settingsPage.resetModeDesc')}
              >
                <Select
                  value={getSetting('sessionResetMode', 'idle')}
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
                      value={getSetting('idleResetMinutes', 30)}
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
                      value={getSetting('scheduledResetHour', 0)}
                      onChange={(e) => updateSetting('scheduledResetHour', parseInt(e.target.value) || 0)}
                    />
                    <span className="text-xs text-muted-foreground">{t('settingsPage.hour')}</span>
                  </div>
                </SettingRow>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="w-4 h-4" /> {t('settingsPage.privacyTab')}
              </CardTitle>
              <CardDescription>{t('settingsPage.privacyDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <SettingRow
                label={t('settingsPage.piiRedaction')}
                description={t('settingsPage.piiRedactionDesc')}
              >
                <Switch
                  checked={getSetting('piiRedaction', false)}
                  onCheckedChange={(v) => updateSetting('piiRedaction', v)}
                />
              </SettingRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Model Tab */}
        <TabsContent value="model">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="w-4 h-4" /> {t('settingsPage.modelTab')}
              </CardTitle>
              <CardDescription>{t('settingsPage.modelDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <SettingRow
                label={t('settingsPage.defaultProvider')}
                description={t('settingsPage.defaultProviderDesc')}
              >
                <Select
                  value={getSetting('defaultProviderId', '')}
                  onValueChange={(v) => updateSetting('defaultProviderId', v)}
                >
                  <SelectTrigger className="w-48"><SelectValue placeholder={t('settingsPage.selectProvider')} /></SelectTrigger>
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
              </SettingRow>
              <Separator />
              <SettingRow
                label={t('settingsPage.defaultModel')}
                description={t('settingsPage.defaultModelDesc')}
              >
                <Input
                  className="w-48"
                  placeholder="e.g., gpt-4o"
                  value={getSetting('defaultModel', '')}
                  onChange={(e) => updateSetting('defaultModel', e.target.value)}
                />
              </SettingRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platform Tab */}
        <TabsContent value="platform">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className="w-4 h-4" /> {t('settingsPage.platformTab')}
              </CardTitle>
              <CardDescription>{t('settingsPage.platformChannelDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {channels && channels.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {channels.map((channel: any) => (
                    <div
                      key={channel.platform}
                      className="flex items-center justify-between p-3 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium capitalize">{channel.platform}</p>
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
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account">
          <div className="space-y-6">
            {/* Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4" /> {t('settingsPage.profile')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>

            {/* Password Change */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="w-4 h-4" /> {t('settingsPage.changePassword')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>{t('settingsPage.currentPassword')}</Label>
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
                  <Label>{t('settingsPage.newPassword')}</Label>
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
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/20">
              <CardHeader>
                <CardTitle className="text-base text-destructive flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> {t('settingsPage.dangerZone')}
                </CardTitle>
                <CardDescription>{t('settingsPage.dangerZoneDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={onLogout} className="gap-2">
                  <LogOut className="w-4 h-4" /> {t('settingsPage.signOut')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
