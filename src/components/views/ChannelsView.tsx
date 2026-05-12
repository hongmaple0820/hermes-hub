'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageCircle, Hash, HashIcon, Phone, Grid3x3, Bird,
  QrCode, Building2, Loader2, Save, RefreshCw,
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

const PLATFORMS = [
  {
    id: 'telegram',
    icon: MessageCircle,
    color: 'text-sky-500',
    bgColor: 'bg-sky-500/10',
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
    fields: [
      { key: 'accessToken', labelKey: 'channels.accessToken', type: 'password' },
      { key: 'homeserverUrl', labelKey: 'channels.homeserverUrl', type: 'text' },
      { key: 'autoThread', labelKey: 'channels.autoThread', type: 'switch' },
    ],
  },
  {
    id: 'feishu',
    icon: Bird,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
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
    fields: [
      { key: 'qrLogin', labelKey: 'channels.qrLogin', type: 'qr' },
    ],
  },
  {
    id: 'wecom',
    icon: Building2,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    fields: [
      { key: 'botId', labelKey: 'channels.botId', type: 'text' },
      { key: 'secret', labelKey: 'channels.secret', type: 'password' },
    ],
  },
];

const statusConfig: Record<string, { color: string; labelKey: string }> = {
  connected: { color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', labelKey: 'channels.connected' },
  disconnected: { color: 'bg-gray-500/10 text-gray-500 border-gray-200', labelKey: 'channels.disconnected' },
  configuring: { color: 'bg-amber-500/10 text-amber-600 border-amber-200', labelKey: 'channels.configuring' },
  error: { color: 'bg-red-500/10 text-red-600 border-red-200', labelKey: 'channels.error' },
};

export function ChannelsView() {
  const { t } = useI18n();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedConfigs, setEditedConfigs] = useState<Record<string, ChannelConfig>>({});

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const result = await api.getChannels();
      const channelList = result.channels || [];
      setChannels(channelList.length > 0 ? channelList : PLATFORMS.map((p) => ({
        platform: p.id,
        status: 'disconnected' as const,
        enabled: false,
        config: {},
      })));
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
        <Button variant="outline" className="gap-2" onClick={loadChannels}>
          <RefreshCw className="w-4 h-4" /> {t('common.refresh')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLATFORMS.map((platform) => {
          const channel = getChannel(platform.id);
          const config = getConfig(platform.id);
          const status = statusConfig[channel.status] || statusConfig.disconnected;
          const Icon = platform.icon;
          const hasEdits = !!editedConfigs[platform.id];

          return (
            <Card key={platform.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', platform.bgColor)}>
                      <Icon className={cn('w-5 h-5', platform.color)} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{t(`channels.${platform.id}`)}</CardTitle>
                      <Badge variant="outline" className={cn('text-[10px] mt-1', status.color)}>
                        {t(status.labelKey)}
                      </Badge>
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
                <Button
                  className="w-full gap-2 mt-2"
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
