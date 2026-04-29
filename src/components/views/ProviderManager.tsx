'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Server, Plus, Trash2, CheckCircle2, XCircle, Loader2, Eye, EyeOff, TestTube, Pencil, Link2, Unlink } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { OAuthLoginModal } from '@/components/shared/OAuthLoginModal';

const PROVIDER_TYPES = [
  { value: 'openai', labelKey: 'providers.typeOpenai', icon: '🤖', defaultUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  { value: 'anthropic', labelKey: 'providers.typeAnthropic', icon: '🧠', defaultUrl: '', defaultModel: 'claude-3-sonnet-20240229' },
  { value: 'google', labelKey: 'providers.typeGoogle', icon: '💎', defaultUrl: '', defaultModel: 'gemini-pro' },
  { value: 'ollama', labelKey: 'providers.typeOllama', icon: '🦙', defaultUrl: 'http://localhost:11434', defaultModel: 'llama2' },
  { value: 'z-ai', labelKey: 'providers.typeZai', icon: '⚡', defaultUrl: '', defaultModel: 'default' },
  { value: 'custom', labelKey: 'providers.typeCustom', icon: '🔧', defaultUrl: 'http://localhost:8080/v1', defaultModel: '' },
];

const OAUTH_PROVIDERS = [
  { value: 'codex', labelKey: 'oauth.codex', icon: '🤖', description: 'OpenAI Codex — Connect via device code to enable Codex-powered coding agent' },
  { value: 'nous', labelKey: 'oauth.nous', icon: '🧪', description: 'Nous Research — Connect via device code to access Nous Research models' },
  { value: 'copilot', labelKey: 'oauth.copilot', icon: '🐙', description: 'GitHub Copilot — Connect via GitHub device code to enable Copilot integration' },
] as const;

type OAuthProvider = 'codex' | 'nous' | 'copilot';

interface ProviderForm {
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  isActive: boolean;
}

const defaultForm: ProviderForm = {
  name: '',
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  defaultModel: '',
  isActive: true,
};

export function ProviderManager() {
  const { providers, setProviders } = useAppStore();
  const { t } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingProvider, setEditingProvider] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProviderForm>({ ...defaultForm });
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});

  // OAuth state
  const [oauthStatuses, setOauthStatuses] = useState<Record<OAuthProvider, { status: string; hasToken: boolean; verifiedAt?: string }>>({
    codex: { status: 'disconnected', hasToken: false },
    nous: { status: 'disconnected', hasToken: false },
    copilot: { status: 'disconnected', hasToken: false },
  });
  const [oauthModal, setOauthModal] = useState<{ open: boolean; provider: OAuthProvider }>({ open: false, provider: 'codex' });
  const [oauthLoading, setOauthLoading] = useState<Record<OAuthProvider, boolean>>({
    codex: false,
    nous: false,
    copilot: false,
  });

  const fetchOAuthStatuses = useCallback(async () => {
    try {
      const [codexStatus, nousStatus, copilotStatus] = await Promise.allSettled([
        api.getCodexOAuthStatus(),
        api.getNousOAuthStatus(),
        api.getCopilotStatus(),
      ]);

      setOauthStatuses({
        codex: codexStatus.status === 'fulfilled' ? { status: codexStatus.value.status, hasToken: codexStatus.value.hasToken, verifiedAt: codexStatus.value.verifiedAt } : { status: 'disconnected', hasToken: false },
        nous: nousStatus.status === 'fulfilled' ? { status: nousStatus.value.status, hasToken: nousStatus.value.hasToken, verifiedAt: nousStatus.value.verifiedAt } : { status: 'disconnected', hasToken: false },
        copilot: copilotStatus.status === 'fulfilled' ? { status: copilotStatus.value.valid ? 'active' : (copilotStatus.value.status || 'disconnected'), hasToken: copilotStatus.value.valid } : { status: 'disconnected', hasToken: false },
      });
    } catch (err) {
      console.error('Failed to fetch OAuth statuses:', err);
    }
  }, []);

  useEffect(() => {
    fetchOAuthStatuses();
  }, [fetchOAuthStatuses]);

  const handleProviderTypeChange = (type: string) => {
    const pt = PROVIDER_TYPES.find((p) => p.value === type);
    setForm({
      ...form,
      provider: type,
      baseUrl: pt?.defaultUrl || '',
      defaultModel: pt?.defaultModel || '',
    });
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error(t('common.required'));
      return;
    }
    setCreating(true);
    try {
      const result = await api.createProvider({
        ...form,
        models: JSON.stringify([]),
        config: JSON.stringify({}),
      });
      setProviders([result.provider, ...providers]);
      setShowCreate(false);
      setForm({ ...defaultForm });
      toast.success(t('providers.created'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (provider: any) => {
    setEditingProvider(provider);
    setForm({
      name: provider.name || '',
      provider: provider.provider || 'openai',
      apiKey: provider.apiKey || '',
      baseUrl: provider.baseUrl || '',
      defaultModel: provider.defaultModel || '',
      isActive: provider.isActive !== false,
    });
    setShowEdit(true);
  };

  const handleUpdate = async () => {
    if (!editingProvider || !form.name.trim()) {
      toast.error(t('common.required'));
      return;
    }
    setSaving(true);
    try {
      const result = await api.updateProvider(editingProvider.id, {
        ...form,
        models: JSON.stringify([]),
        config: JSON.stringify({}),
      });
      setProviders(providers.map((p: any) => p.id === editingProvider.id ? result.provider : p));
      setShowEdit(false);
      setEditingProvider(null);
      setForm({ ...defaultForm });
      toast.success(t('providers.updated'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const result = await api.testProvider(id);
      setTestResults({ ...testResults, [id]: result });
      if (result.success) {
        toast.success(t('providers.connectionSuccess'));
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      setTestResults({ ...testResults, [id]: { success: false, message: error.message } });
      toast.error(error.message);
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteProvider(id);
      setProviders(providers.filter((p: any) => p.id !== id));
      toast.success(t('providers.deleted'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // OAuth handlers
  const handleOAuthStart = async (provider: OAuthProvider) => {
    switch (provider) {
      case 'codex':
        return api.startCodexOAuth();
      case 'nous':
        return api.startNousOAuth();
      case 'copilot':
        return api.startCopilotOAuth();
    }
  };

  const handleOAuthPoll = async (provider: OAuthProvider, deviceCode: string) => {
    switch (provider) {
      case 'codex':
        return api.pollCodexOAuth(deviceCode);
      case 'nous':
        return api.pollNousOAuth(deviceCode);
      case 'copilot':
        return api.pollCopilotOAuth(deviceCode);
    }
  };

  const handleOAuthSuccess = () => {
    fetchOAuthStatuses();
  };

  const handleOAuthConnect = (provider: OAuthProvider) => {
    setOauthModal({ open: true, provider });
  };

  const handleOAuthDisconnect = async (provider: OAuthProvider) => {
    setOauthLoading((prev) => ({ ...prev, [provider]: true }));
    try {
      switch (provider) {
        case 'codex':
          await api.revokeCodexOAuth();
          break;
        case 'nous':
          await api.revokeNousOAuth();
          break;
        case 'copilot':
          await api.revokeCopilotOAuth();
          break;
      }
      toast.success(t('oauth.disconnected'));
      fetchOAuthStatuses();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setOauthLoading((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const getProviderType = (type: string) => PROVIDER_TYPES.find((p) => p.value === type);

  const getOAuthProviderInfo = (type: string) => OAUTH_PROVIDERS.find((p) => p.value === type);

  const renderFormFields = (isEdit: boolean) => (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>{t('providers.providerName')} *</Label>
        <Input placeholder={t('providers.providerNamePlaceholder')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>{t('providers.providerType')}</Label>
        <Select value={form.provider} onValueChange={handleProviderTypeChange} disabled={isEdit}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROVIDER_TYPES.map((pt) => (
              <SelectItem key={pt.value} value={pt.value}>
                {pt.icon} {t(pt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {form.provider !== 'z-ai' && (
        <>
          <div className="space-y-2">
            <Label>{t('providers.apiKey')}</Label>
            <Input type="password" placeholder="sk-..." value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
          </div>
          {['openai', 'ollama', 'custom'].includes(form.provider) && (
            <div className="space-y-2">
              <Label>{t('providers.baseUrl')}</Label>
              <Input placeholder={getProviderType(form.provider)?.defaultUrl} value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
            </div>
          )}
          <div className="space-y-2">
            <Label>{t('providers.defaultModel')}</Label>
            <Input placeholder="e.g., gpt-4o" value={form.defaultModel} onChange={(e) => setForm({ ...form, defaultModel: e.target.value })} />
          </div>
        </>
      )}
      {isEdit && (
        <div className="flex items-center gap-2">
          <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
          <Label>{t('providers.isActive')}</Label>
        </div>
      )}
      {isEdit ? (
        <Button onClick={handleUpdate} className="w-full" disabled={saving}>
          {saving ? t('providers.saving') : t('providers.save')}
        </Button>
      ) : (
        <Button onClick={handleCreate} className="w-full" disabled={creating}>
          {creating ? `${t('providers.add')}...` : t('providers.add')}
        </Button>
      )}
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('providers.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('providers.subtitle')}</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> {t('providers.add')}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t('providers.addTitle')}</DialogTitle></DialogHeader>
            {renderFormFields(false)}
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={(open) => { setShowEdit(open); if (!open) { setEditingProvider(null); setForm({ ...defaultForm }); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('providers.editTitle')}</DialogTitle></DialogHeader>
          {renderFormFields(true)}
        </DialogContent>
      </Dialog>

      {/* OAuth Login Modal */}
      <OAuthLoginModal
        open={oauthModal.open}
        onClose={() => setOauthModal({ ...oauthModal, open: false })}
        provider={oauthModal.provider}
        title={t(`oauth.${oauthModal.provider}`)}
        description={getOAuthProviderInfo(oauthModal.provider)?.description || ''}
        onStart={() => handleOAuthStart(oauthModal.provider)}
        onPoll={(deviceCode) => handleOAuthPoll(oauthModal.provider, deviceCode)}
        onSuccess={handleOAuthSuccess}
      />

      {/* Provider Type Legend */}
      <div className="flex flex-wrap gap-2 mb-6">
        {PROVIDER_TYPES.map((pt) => (
          <Badge key={pt.value} variant="outline" className="text-xs gap-1">
            {pt.icon} {t(pt.labelKey)}
          </Badge>
        ))}
      </div>

      {/* Provider Cards */}
      {providers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Server className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('providers.noProvidersTitle')}</h3>
            <p className="text-muted-foreground text-sm mb-4">{t('providers.noProvidersDesc')}</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> {t('providers.add')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((provider: any) => {
            const pt = getProviderType(provider.provider);
            const testResult = testResults[provider.id];

            return (
              <Card key={provider.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg">
                        {pt?.icon || '🔧'}
                      </div>
                      <div>
                        <CardTitle className="text-base">{provider.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">{pt ? t(pt.labelKey) : provider.provider}</Badge>
                          {provider.isActive === false && (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">{t('common.inactive')}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(provider)}>
                          <Pencil className="w-4 h-4 mr-2" /> {t('common.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(provider.id)}>
                          <Trash2 className="w-4 h-4 mr-2" /> {t('common.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {provider.defaultModel && (
                    <div>
                      <span className="text-xs text-muted-foreground">{t('providers.defaultModel')}</span>
                      <p className="text-sm font-mono">{provider.defaultModel}</p>
                    </div>
                  )}
                  {provider.baseUrl && (
                    <div>
                      <span className="text-xs text-muted-foreground">{t('providers.baseUrl')}</span>
                      <p className="text-xs font-mono text-muted-foreground truncate">{provider.baseUrl}</p>
                    </div>
                  )}
                  {provider.apiKey && (
                    <div>
                      <span className="text-xs text-muted-foreground">{t('providers.apiKey')}</span>
                      <div className="flex items-center gap-1">
                        <code className="text-xs font-mono bg-accent px-1.5 py-0.5 rounded">
                          {showApiKeys[provider.id] ? provider.apiKey : '•••••••••••'}
                        </code>
                        <Button variant="ghost" size="icon" className="w-5 h-5" onClick={() => setShowApiKeys({ ...showApiKeys, [provider.id]: !showApiKeys[provider.id] })}>
                          {showApiKeys[provider.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Test Connection */}
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => handleTest(provider.id)}
                        disabled={testing === provider.id}
                      >
                        {testing === provider.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <TestTube className="w-3 h-3" />
                        )}
                        {testing === provider.id ? t('providers.testing') : t('providers.testConnection')}
                      </Button>
                      <div className="flex items-center gap-2">
                        {testResult && (
                          <div className="flex items-center gap-1">
                            {testResult.success ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7"
                          onClick={() => handleEdit(provider)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {testResult && !testResult.success && (
                      <p className="text-xs text-red-500 mt-1 line-clamp-2">{testResult.message}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* OAuth Integration Section */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('oauth.title')}</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t('oauth.deviceCodeHint')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {OAUTH_PROVIDERS.map((oauthProvider) => {
            const status = oauthStatuses[oauthProvider.value as OAuthProvider];
            const isLoading = oauthLoading[oauthProvider.value as OAuthProvider];
            const isConnected = status.status === 'active';
            const isPending = status.status === 'pending';

            return (
              <Card key={oauthProvider.value} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg shrink-0">
                      {oauthProvider.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold">{t(oauthProvider.labelKey)}</h3>
                        {isConnected && (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                            <CheckCircle2 className="w-3 h-3 mr-0.5" />
                            {t('oauth.connected')}
                          </Badge>
                        )}
                        {isPending && (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">
                            <Loader2 className="w-3 h-3 mr-0.5 animate-spin" />
                            {t('oauth.polling')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {oauthProvider.description}
                      </p>
                      <div className="flex items-center gap-2">
                        {isConnected ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleOAuthDisconnect(oauthProvider.value as OAuthProvider)}
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Unlink className="w-3 h-3" />
                            )}
                            {t('oauth.revoke')}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() => handleOAuthConnect(oauthProvider.value as OAuthProvider)}
                            disabled={isPending}
                          >
                            {isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Link2 className="w-3 h-3" />
                            )}
                            {isPending ? t('oauth.polling') : t('oauth.connect')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
