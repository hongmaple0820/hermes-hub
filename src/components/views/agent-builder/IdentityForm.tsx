'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/i18n';

export interface IdentityData {
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  isPublic: boolean;
}

interface IdentityFormProps {
  value: IdentityData;
  onChange: (data: IdentityData) => void;
}

const MAX_SYSTEM_PROMPT_LENGTH = 4000;

export function IdentityForm({ value, onChange }: IdentityFormProps) {
  const { t } = useI18n();

  const handleChange = (field: keyof IdentityData, val: string | boolean) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <div className="space-y-5">
      {/* Name */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          {t('agentBuilder.identity.name')} <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder={t('agentBuilder.identity.namePlaceholder')}
          value={value.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className="rounded-lg"
        />
      </div>

      {/* Avatar + Description row */}
      <div className="grid grid-cols-1 sm:grid-cols-[80px_1fr] gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('agentBuilder.identity.avatar')}</Label>
          <Input
            value={value.avatar}
            onChange={(e) => handleChange('avatar', e.target.value)}
            placeholder={t('agentBuilder.identity.avatarPlaceholder')}
            className="rounded-lg text-center text-xl h-12"
            maxLength={4}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('agentBuilder.identity.description')}</Label>
          <Textarea
            placeholder={t('agentBuilder.identity.descriptionPlaceholder')}
            value={value.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={2}
            className="rounded-lg resize-none"
          />
        </div>
      </div>

      {/* System Prompt */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{t('agentBuilder.identity.systemPrompt')}</Label>
          <span className="text-xs text-muted-foreground">
            {t('agentBuilder.identity.charCount', { count: value.systemPrompt.length })}
          </span>
        </div>
        <Textarea
          placeholder={t('agentBuilder.identity.systemPromptPlaceholder')}
          value={value.systemPrompt}
          onChange={(e) => {
            if (e.target.value.length <= MAX_SYSTEM_PROMPT_LENGTH) {
              handleChange('systemPrompt', e.target.value);
            }
          }}
          rows={6}
          className="rounded-lg resize-none font-mono text-sm"
        />
      </div>

      {/* Public toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label className="text-sm font-medium cursor-pointer">{t('agentBuilder.identity.isPublic')}</Label>
          <p className="text-xs text-muted-foreground">{t('agentBuilder.identity.isPublicDesc')}</p>
        </div>
        <Switch
          checked={value.isPublic}
          onCheckedChange={(v) => handleChange('isPublic', v)}
        />
      </div>
    </div>
  );
}
