'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

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
          {value.name.trim().length > 0 && (
            <span className="text-emerald-500 ml-1.5">✓
              <svg className="w-3 h-3 inline ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
        </Label>
        <Input
          placeholder={t('agentBuilder.identity.namePlaceholder')}
          value={value.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className={cn('rounded-lg', value.name.trim().length > 0 ? 'border-emerald-300 dark:border-emerald-700 focus-visible:ring-emerald-500/20' : '')}
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

      {/* Preview */}
      <div className="rounded-xl border border-dashed border-border p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Preview</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
            {value.avatar || '\uD83E\uDD16'}
          </div>
          <div>
            <p className="text-sm font-semibold">{value.name || 'Agent Name'}</p>
            <p className="text-xs text-muted-foreground">{value.description || 'No description'}</p>
          </div>
          {value.isPublic && (
            <Badge variant="secondary" className="text-[10px] ml-auto">Public</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
