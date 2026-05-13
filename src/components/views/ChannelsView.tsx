'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  MessageCircle, Hash, HashIcon, Phone, Grid3x3, Bird,
  QrCode, Building2, Loader2, Save, RefreshCw, Settings2,
  ArrowUpDown, ArrowDown, ArrowUp, Activity, Wifi, WifiOff,
  RotateCw, Zap, BarChart3, TrendingUp, Radio,
  Circle, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ChannelConfig {
  [key: string]: string | boolean | string[];
}

interface Channel {
  platform: string;
  status: 'connected' | 'disconnected' | 'configuring' | 'error';
  enabled: boolean;
  config: ChannelConfig;
}

interface ChannelMetrics {
  messagesSent: number;
  messagesReceived: number;
  latency: number;
  lastMessageAt: string | null;
  uptime: number;
}

const PLATFORMS = [
  {
    id: 'telegram',
    icon: MessageCircle,
    color: 'text-sky-500',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-200',
    pulseColor: 'bg-sky-500',
    typeLabel: 'channels.typeMessaging',
    fields: [
      { key: 'botToken', labelKey: 'channels.botToken', type: 'password' },
      { key: 'mentionControl', labelKey: 'channels.mentionControl', type: 'switch' },
      { key: 'reactions', labelKey: 'channels.reactions', type: 'switch' },
    ],
  },
  {
    id: 'discord',
    icon: Hash,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-200',
    pulseColor: 'bg-violet-500',
    typeLabel: 'channels.typeMessaging',
    fields: [
      { key: 'botToken', labelKey: 'channels.botToken', type: 'password' },
      { key: 'mentionControl', labelKey: 'channels.mentionControl', type: 'switch' },
      { key: 'autoThread', labelKey: 'channels.autoThread', type: 'switch' },
      { key: 'channelAllowList', labelKey: 'channels.channelAllowList', type: 'text' },
      { key: 'channelIgnoreList', labelKey: 'channels.channelIgnoreList', type: 'text' },
    ],
  },
  {
    id: 'slack',
    icon: HashIcon,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-200',
    pulseColor: 'bg-purple-500',
    typeLabel: 'channels.typeMessaging',
    fields: [
      { key: 'botToken', labelKey: 'channels.botToken', type: 'password' },
      { key: 'mentionControl', labelKey: 'channels.mentionControl', type: 'switch' },
    ],
  },
  {
    id: 'whatsapp',
    icon: Phone,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-200',
    pulseColor: 'bg-emerald-500',
    typeLabel: 'channels.typeMessaging',
    fields: [
      { key: 'enabled', labelKey: 'common.enabled', type: 'switch' },
      { key: 'mentionPatterns', labelKey: 'channels.mentionPatterns', type: 'text' },
    ],
  },
  {
    id: 'matrix',
    icon: Grid3x3,
    color: 'text-teal-500',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-200',
    pulseColor: 'bg-teal-500',
    typeLabel: 'channels.typeProtocol',
    fields: [
      { key: 'accessToken', labelKey: 'channels.accessToken', type: 'password' },
      { key: 'homeserverUrl', labelKey: 'channels.homeserverUrl', type: 'text' },
      { key: 'autoThread', labelKey: 'channels.autoThread', type: 'switch' },
    ],
  },
  {
    id: 'feishu',
    icon: Bird,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-200',
    pulseColor: 'bg-rose-500',
    typeLabel: 'channels.typeEnterprise',
    fields: [
      { key: 'appId', labelKey: 'channels.appId', type: 'text' },
      { key: 'appSecret', labelKey: 'channels.appSecret', type: 'password' },
      { key: 'mentionControl', labelKey: 'channels.mentionControl', type: 'switch' },
    ],
  },
  {
    id: 'wechat',
    icon: QrCode,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-200',
    pulseColor: 'bg-green-500',
    typeLabel: 'channels.typeMessaging',
    fields: [
      { key: 'qrLogin', labelKey: 'channels.qrLogin', type: 'qr' },
    ],
  },
  {
    id: 'wecom',
    icon: Building2,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-200',
    pulseColor: 'bg-orange-500',
    typeLabel: 'channels.typeEnterprise',
    fields: [
      { key: 'botId', labelKey: 'channels.botId', type: 'text' },
      { key: 'secret', labelKey: 'channels.secret', type: 'password' },
    ],
  },
];

const statusConfig: Record<string, { color: string; labelKey: string; icon: any; dotColor: string }> = {
  connected: { color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', labelKey: 'channels.connected', icon: CheckCircle2, dotColor: 'bg-emerald-500 animate-pulse' },
  disconnected: { color: 'bg-gray-500/10 text-gray-500 border-gray-200', labelKey: 'channels.disconnected', icon: XCircle, dotColor: 'bg-gray-400' },
  configuring: { color: 'bg-amber-500/10 text-amber-600 border-amber-200', labelKey: 'channels.configuring', icon: AlertCircle, dotColor: 'bg-amber-500 animate-pulse' },
  error: { color: 'bg-red-500/10 text-red-600 border-red-200', labelKey: 'channels.error', icon: XCircle, dotColor: 'bg-red-500 animate-pulse' },
};

export function ChannelsView() {
  const { t } = useI18n();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedConfigs, setEditedConfigs] = useState<Record<string, ChannelConfig>>({});

  // Config dialog
  const [configPlatform, setConfigPlatform] = useState<string | null>(null);

  // Simulated metrics per channel
  const [metrics, setMetrics] = useState<Record<string, ChannelMetrics>>({});

  useEffect(() => {
    loadChannels();
  }, []);

  // Simulate metrics updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => {
        const updated = { ...prev };
        for (const ch of channels) {
          if (ch.status === 'connected') {
            const m = updated[ch.platform] || { messagesSent: 0, messagesReceived: 0, latency: 0, lastMessageAt: null, uptime: 0 };
            updated[ch.platform] = {
              messagesSent: m.messagesSent + Math.floor(Math.random() * 3),
              messagesReceived: m.messagesReceived + Math.floor(Math.random() * 5),
              latency: Math.floor(20 + Math.random() * 80),
              lastMessageAt: new Date().toISOString(),
              uptime: m.uptime + 5,
            };
          }
        }
        return updated;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [channels]);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const result = await api.getChannels();
      const channelList = result.channels || [];
      const loaded = channelList.length > 0 ? channelList : PLATFORMS.map((p) => ({
        platform: p.id,
        status: 'disconnected' as const,
        enabled: false,
        config: {},
      }));
      setChannels(loaded);
      // Initialize metrics
      const initMetrics: Record<string, ChannelMetrics> = {};
      for (const ch of loaded) {
        initMetrics[ch.platform] = {
          messagesSent: 0,
          messagesReceived: 0,
          latency: 0,
          lastMessageAt: null,
          uptime: 0,
        };
      }
      setMetrics(initMetrics);
    } catch {
      setChannels(PLATFORMS.map((p) => ({
        platform: p.id,
        status: 'disconnected' as const,
        enabled: false,
        config: {},
      })));
    } finally {
      setLoading(false);
    }
  };

  const getChannel = (platformId: string): Channel => {
    return channels.find((c) => c.platform === platformId) || {
      platform: platformId,
      status: 'disconnected' as const,
      enabled: false,
      config: {},
    };
  };

  const getConfig = (platformId: string): ChannelConfig => {
    if (editedConfigs[platformId]) return editedConfigs[platformId];
    return getChannel(platformId).config || {};
  };

  const updateConfig = (platformId: string, key: string, value: string | boolean) => {
    const current = getConfig(platformId);
    setEditedConfigs((prev) => ({
      ...prev,
      [platformId]: { ...current, [key]: value },
    }));
  };

  const handleSave = async (platformId: string) => {
    setSaving(platformId);
    try {
      const config = getConfig(platformId);
      const channel = getChannel(platformId);
      await api.updateChannel(platformId, { ...config, enabled: channel.enabled });
      setEditedConfigs((prev) => {
        const next = { ...prev };
        delete next[platformId];
        return next;
      });
      toast.success(t('channels.saved'));
      await loadChannels();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(null);
    }
  };

  const handleToggle = async (platformId: string, enabled: boolean) => {
    try {
      await api.updateChannel(platformId, { enabled });
      setChannels((prev) =>
        prev.map((c) => c.platform === platformId ? { ...c, enabled } : c)
      );
      toast.success(enabled ? t('channels.channelEnabled') : t('channels.channelDisabled'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleReconnect = async (platformId: string) => {
    try {
      const channel = getChannel(platformId);
      await api.updateChannel(platformId, { enabled: false });
      await new Promise(r => setTimeout(r, 500));
      await api.updateChannel(platformId, { enabled: true });
      setChannels((prev) =>
        prev.map((c) => c.platform === platformId ? { ...c, status: 'configuring' } : c)
      );
      toast.success(t('channels.reconnecting'));
      setTimeout(async () => {
        await loadChannels();
      }, 2000);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDisconnect = async (platformId: string) => {
    try {
      await api.updateChannel(platformId, { enabled: false });
      setChannels((prev) =>
        prev.map((c) => c.platform === platformId ? { ...c, enabled: false, status: 'disconnected' } : c)
      );
      toast.success(t('channels.channelDisconnected'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Summary metrics
  const totalMetrics = useMemo(() => {
    const result = { sent: 0, received: 0, connected: 0, avgLatency: 0, latencyCount: 0 };
    for (const key of Object.keys(metrics)) {
      const m = metrics[key];
      result.sent += m.messagesSent;
      result.received += m.messagesReceived;
      const ch = getChannel(key);
      if (ch.status === 'connected') {
        result.connected++;
        result.avgLatency += m.latency;
        result.latencyCount++;
      }
    }
    return { ...result, avgLatency: result.latencyCount > 0 ? Math.round(result.avgLatency / result.latencyCount) : 0 };
  }, [metrics, channels]);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('channels.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('channels.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={loadChannels}>
            <RefreshCw className="w-4 h-4" /> {t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Wifi className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('channels.connectedChannels')}</p>
              <p className="text-lg font-bold">{totalMetrics.connected}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <ArrowUp className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('channels.messagesSent')}</p>
              <p className="text-lg font-bold">{totalMetrics.sent}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <ArrowDown className="w-4 h-4 text-cyan-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('channels.messagesReceived')}</p>
              <p className="text-lg font-bold">{totalMetrics.received}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-rose-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('channels.avgLatency')}</p>
              <p className="text-lg font-bold">{totalMetrics.avgLatency}<span className="text-xs font-normal">ms</span></p>
            </div>
          </div>
        </Card>
      </div>

      {/* Channel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLATFORMS.map((platform) => {
          const channel = getChannel(platform.id);
          const config = getConfig(platform.id);
          const status = statusConfig[channel.status] || statusConfig.disconnected;
          const StatusIcon = status.icon;
          const Icon = platform.icon;
          const hasEdits = !!editedConfigs[platform.id];
          const m = metrics[platform.id] || { messagesSent: 0, messagesReceived: 0, latency: 0, lastMessageAt: null, uptime: 0 };

          return (
            <Card key={platform.id} className={cn(
              'hover:shadow-md transition-shadow',
              channel.status === 'connected' && `border-l-4 ${platform.borderColor}`
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center relative', platform.bgColor)}>
                      <Icon className={cn('w-5 h-5', platform.color)} />
                      {/* Live status dot on icon */}
                      {channel.status === 'connected' && (
                        <span className={cn(
                          'absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background',
                          platform.pulseColor,
                          'animate-pulse'
                        )} />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {t(`channels.${platform.id}`)}
                        {/* Channel type badge */}
                        <Badge variant="outline" className="text-[9px] gap-1 text-muted-foreground">
                          {t(platform.typeLabel)}
                        </Badge>
                        {/* Status badge with dot */}
                        <Badge variant="outline" className={cn('text-[10px] gap-1.5', status.color)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', status.dotColor)} />
                          <StatusIcon className="w-3 h-3" />
                          {t(status.labelKey)}
                        </Badge>
                      </CardTitle>
                      {channel.status === 'connected' && (
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><ArrowUp className="w-2.5 h-2.5 text-emerald-500" />{m.messagesSent}</span>
                          <span className="flex items-center gap-1"><ArrowDown className="w-2.5 h-2.5 text-cyan-500" />{m.messagesReceived}</span>
                          <span className="flex items-center gap-1"><Activity className="w-2.5 h-2.5 text-amber-500" />{m.latency}ms</span>
                          {m.uptime > 0 && (
                            <span className="flex items-center gap-1"><TrendingUp className="w-2.5 h-2.5" />{m.uptime}s</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={channel.enabled}
                    onCheckedChange={(checked) => handleToggle(platform.id, checked)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {platform.fields.map((field) => {
                  if (field.type === 'switch') {
                    return (
                      <div key={field.key} className="flex items-center justify-between">
                        <Label className="text-sm">{t(field.labelKey)}</Label>
                        <Switch
                          checked={!!(config[field.key] as boolean)}
                          onCheckedChange={(v) => updateConfig(platform.id, field.key, v)}
                        />
                      </div>
                    );
                  }

                  if (field.type === 'qr') {
                    return (
                      <div key={field.key} className="flex items-center gap-3">
                        <Button variant="outline" className="gap-2 text-sm">
                          <QrCode className="w-4 h-4" /> {t('channels.qrLogin')}
                        </Button>
                        <span className="text-xs text-muted-foreground">{t('channels.qrLoginHint')}</span>
                      </div>
                    );
                  }

                  return (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-sm">{t(field.labelKey)}</Label>
                      <Input
                        type={field.type === 'password' ? 'password' : 'text'}
                        value={(config[field.key] as string) || ''}
                        onChange={(e) => updateConfig(platform.id, field.key, e.target.value)}
                        placeholder={t(field.labelKey)}
                        className="text-sm"
                      />
                    </div>
                  );
                })}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    className="flex-1 gap-2"
                    size="sm"
                    onClick={() => handleSave(platform.id)}
                    disabled={saving === platform.id}
                  >
                    {saving === platform.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {t('common.save')}
                    {hasEdits && <span className="w-2 h-2 rounded-full bg-amber-500" />}
                  </Button>
                  {channel.status === 'connected' && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => handleReconnect(platform.id)}>
                            <RotateCw className="w-4 h-4" /> {t('channels.reconnect')}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('channels.reconnectHint')}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {(channel.status === 'connected' || channel.status === 'error') && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2 text-destructive" onClick={() => handleDisconnect(platform.id)}>
                            <WifiOff className="w-4 h-4" /> {t('channels.disconnect')}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('channels.disconnectHint')}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setConfigPlatform(platform.id)}>
                    <Settings2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Message Flow Visualization */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="w-5 h-5" /> {t('channels.messageFlow')}
          </CardTitle>
          <CardDescription>{t('channels.messageFlowDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-48">
            <div className="space-y-2">
              {channels.filter(c => c.status === 'connected').length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <WifiOff className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">{t('channels.noActiveChannels')}</p>
                  <p className="text-xs mt-1">{t('channels.noActiveChannelsDesc')}</p>
                </div>
              ) : (
                channels.filter(c => c.status === 'connected').map(ch => {
                  const m = metrics[ch.platform] || { messagesSent: 0, messagesReceived: 0, latency: 0, uptime: 0 };
                  const platInfo = PLATFORMS.find(p => p.id === ch.platform);
                  const PlatIcon = platInfo?.icon || MessageCircle;
                  const maxMessages = Math.max(m.messagesSent + m.messagesReceived, 1);
                  const sentPct = Math.round((m.messagesSent / maxMessages) * 100);
                  return (
                    <div key={ch.platform} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                      <div className="relative">
                        <PlatIcon className={cn('w-4 h-4 shrink-0', platInfo?.color)} />
                        <span className={cn('absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-background', platInfo?.pulseColor, 'animate-pulse')} />
                      </div>
                      <span className="text-sm font-medium w-20 shrink-0">{t(`channels.${ch.platform}`)}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden flex">
                          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${sentPct}%` }} />
                          <div className="h-full bg-cyan-500 transition-all" style={{ width: `${100 - sentPct}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
                        <span className="flex items-center gap-0.5"><ArrowUp className="w-2.5 h-2.5 text-emerald-500" />{m.messagesSent}</span>
                        <span className="flex items-center gap-0.5"><ArrowDown className="w-2.5 h-2.5 text-cyan-500" />{m.messagesReceived}</span>
                        <span>{m.latency}ms</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Config Dialog */}
      <Dialog open={!!configPlatform} onOpenChange={(open) => { if (!open) setConfigPlatform(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('channels.channelConfig')}</DialogTitle>
            <DialogDescription>
              {configPlatform ? t(`channels.${configPlatform}`) : ''}
            </DialogDescription>
          </DialogHeader>
          {configPlatform && (
            <div className="space-y-4 mt-2">
              {PLATFORMS.find(p => p.id === configPlatform)?.fields.map(field => (
                <div key={field.key} className="space-y-1.5">
                  <Label>{t(field.labelKey)}</Label>
                  {field.type === 'switch' ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{t(field.labelKey)}</span>
                      <Switch
                        checked={!!(getConfig(configPlatform)[field.key] as boolean)}
                        onCheckedChange={(v) => updateConfig(configPlatform, field.key, v)}
                      />
                    </div>
                  ) : (
                    <Input
                      type={field.type === 'password' ? 'password' : 'text'}
                      value={(getConfig(configPlatform)[field.key] as string) || ''}
                      onChange={(e) => updateConfig(configPlatform, field.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfigPlatform(null)}>{t('common.cancel')}</Button>
                <Button onClick={() => { handleSave(configPlatform); setConfigPlatform(null); }} className="gap-2">
                  <Save className="w-4 h-4" /> {t('common.save')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
