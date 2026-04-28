'use client';

import { useAppStore } from '@/lib/store';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, User, Shield, Palette } from 'lucide-react';
import { toast } from 'sonner';

interface SettingsProps {
  onLogout: () => void;
}

export function Settings({ onLogout }: SettingsProps) {
  const { user } = useAppStore();
  const { t } = useI18n();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('settingsPage.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('settingsPage.subtitle')}</p>
      </div>

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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('common.name')}</Label>
                <Input defaultValue={user?.name} disabled />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input defaultValue={user?.email} disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Platform Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4" /> {t('settingsPage.platform')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('settingsPage.platform')}</span>
              <span className="font-medium">Hermes Hub</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('settingsPage.version')}</span>
              <span className="font-medium">2.0.0</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('settingsPage.llmProviders')}</span>
              <span className="font-medium">OpenAI, Anthropic, Google, Ollama, Z-AI, Custom</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('settingsPage.skillSystem')}</span>
              <span className="font-medium">{t('settingsPage.feishuDingtalk')}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('settingsPage.hermesAgent')}</span>
              <span className="font-medium">{t('settingsPage.directConnectionSupported')}</span>
            </div>
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
    </div>
  );
}
