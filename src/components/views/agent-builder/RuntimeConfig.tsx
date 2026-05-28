'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/i18n';
import { GitBranch, ArrowRight } from 'lucide-react';
import type { RuntimeType } from './RuntimeSelector';

// Mock providers data
const MOCK_PROVIDERS = [
  {
    id: 'provider-openai',
    name: 'OpenAI',
    provider: 'openai',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview', 'o1-mini'],
  },
  {
    id: 'provider-anthropic',
    name: 'Anthropic',
    provider: 'anthropic',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  },
  {
    id: 'provider-gemini',
    name: 'Google Gemini',
    provider: 'google',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  },
];

export interface BuiltinConfig {
  providerId: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface RemoteConfig {
  endpointType: 'http' | 'websocket';
  endpointUrl: string;
  authToken: string;
}

export interface RuntimeConfigData {
  builtin: BuiltinConfig;
  remote: RemoteConfig;
}

interface RuntimeConfigProps {
  runtimeType: RuntimeType | null;
  value: RuntimeConfigData;
  onChange: (data: RuntimeConfigData) => void;
  /** Real providers from the store (if available, overrides mock) */
  providers?: any[];
}

export function RuntimeConfig({ runtimeType, value, onChange, providers }: RuntimeConfigProps) {
  const { t } = useI18n();

  const activeProviders = providers && providers.length > 0 ? providers : MOCK_PROVIDERS;

  // Find the selected provider to get its models
  const selectedProvider = activeProviders.find((p: any) => p.id === value.builtin.providerId);
  const availableModels = selectedProvider?.models
    ? (typeof selectedProvider.models === 'string'
        ? JSON.parse(selectedProvider.models || '[]')
        : selectedProvider.models)
    : [];

  const updateBuiltin = (field: keyof BuiltinConfig, val: string | number) => {
    onChange({
      ...value,
      builtin: { ...value.builtin, [field]: val },
    });
  };

  const updateRemote = (field: keyof RemoteConfig, val: string) => {
    onChange({
      ...value,
      remote: { ...value.remote, [field]: val },
    });
  };

  return (
    <AnimatePresence mode="wait">
      {!runtimeType && (
        <motion.div
          key="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center justify-center py-8 text-muted-foreground text-sm"
        >
          {t('agentBuilder.validation.runtimeRequired')}
        </motion.div>
      )}

      {runtimeType === 'builtin' && (
        <motion.div
          key="builtin"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 12 }}
          transition={{ duration: 0.2 }}
          className="space-y-5"
        >
          {/* Provider */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t('agentBuilder.config.provider')} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={value.builtin.providerId}
              onValueChange={(v) => {
                updateBuiltin('providerId', v);
                // Reset model when provider changes
                onChange({
                  ...value,
                  builtin: { ...value.builtin, providerId: v, model: '' },
                });
              }}
            >
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder={t('agentBuilder.config.providerPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {activeProviders.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.provider})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeProviders.length === 0 && (
              <p className="text-xs text-amber-600">{t('agentBuilder.config.addProviderFirst')}</p>
            )}
          </div>

          {/* Model */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('agentBuilder.config.model')}</Label>
            <Select
              value={value.builtin.model}
              onValueChange={(v) => updateBuiltin('model', v)}
              disabled={!value.builtin.providerId}
            >
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder={t('agentBuilder.config.modelPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((m: string) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Temperature */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('agentBuilder.config.temperature')}</Label>
              <span className="text-sm font-mono text-muted-foreground tabular-nums">
                {value.builtin.temperature.toFixed(1)}
              </span>
            </div>
            <Slider
              value={[value.builtin.temperature]}
              onValueChange={([v]) => updateBuiltin('temperature', v)}
              min={0}
              max={2}
              step={0.1}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('agentBuilder.config.maxTokens')}</Label>
            <Input
              type="number"
              value={value.builtin.maxTokens}
              onChange={(e) => updateBuiltin('maxTokens', parseInt(e.target.value) || 2048)}
              min={1}
              max={128000}
              className="rounded-lg"
            />
          </div>
        </motion.div>
      )}

      {runtimeType === 'remote' && (
        <motion.div
          key="remote"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 12 }}
          transition={{ duration: 0.2 }}
          className="space-y-5"
        >
          {/* Endpoint Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('agentBuilder.config.endpointType')}</Label>
            <Select
              value={value.remote.endpointType}
              onValueChange={(v) => updateRemote('endpointType', v)}
            >
              <SelectTrigger className="rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="http">{t('agentBuilder.config.http')}</SelectItem>
                <SelectItem value="websocket">{t('agentBuilder.config.websocket')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Endpoint URL */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t('agentBuilder.config.endpointUrl')} <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder={t('agentBuilder.config.endpointUrlPlaceholder')}
              value={value.remote.endpointUrl}
              onChange={(e) => updateRemote('endpointUrl', e.target.value)}
              className="rounded-lg"
            />
          </div>

          {/* Auth Token */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('agentBuilder.config.authToken')}</Label>
            <Input
              type="password"
              placeholder={t('agentBuilder.config.authTokenPlaceholder')}
              value={value.remote.authToken}
              onChange={(e) => updateRemote('authToken', e.target.value)}
              className="rounded-lg"
            />
          </div>
        </motion.div>
      )}

      {runtimeType === 'workflow' && (
        <motion.div
          key="workflow"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 12 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="border-dashed rounded-xl">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
                <GitBranch className="w-6 h-6 text-violet-500" />
              </div>
              <h3 className="text-base font-semibold mb-1">{t('agentBuilder.config.comingSoonTitle')}</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {t('agentBuilder.config.comingSoonDesc')}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
