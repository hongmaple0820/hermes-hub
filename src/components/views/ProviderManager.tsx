'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Server, Plus, Trash2, CheckCircle2, XCircle, Loader2, Eye, EyeOff, TestTube } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PROVIDER_TYPES = [
  { value: 'openai', label: 'OpenAI', icon: '🤖', defaultUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  { value: 'anthropic', label: 'Anthropic', icon: '🧠', defaultUrl: '', defaultModel: 'claude-3-sonnet-20240229' },
  { value: 'google', label: 'Google Gemini', icon: '💎', defaultUrl: '', defaultModel: 'gemini-pro' },
  { value: 'ollama', label: 'Ollama (Local)', icon: '🦙', defaultUrl: 'http://localhost:11434', defaultModel: 'llama2' },
  { value: 'z-ai', label: 'Z-AI SDK', icon: '⚡', defaultUrl: '', defaultModel: 'default' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)', icon: '🔧', defaultUrl: 'http://localhost:8080/v1', defaultModel: '' },
];

export function ProviderManager() {
  const { providers, setProviders } = useAppStore();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    name: '',
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    defaultModel: '',
  });

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
      toast.error('Provider name is required');
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
      setForm({ name: '', provider: 'openai', apiKey: '', baseUrl: '', defaultModel: '' });
      toast.success('Provider created!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const result = await api.testProvider(id);
      setTestResults({ ...testResults, [id]: result });
      if (result.success) {
        toast.success('Connection successful!');
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
      toast.success('Provider deleted');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getProviderType = (type: string) => PROVIDER_TYPES.find((p) => p.value === type);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">LLM Providers</h1>
          <p className="text-muted-foreground text-sm">Configure multiple AI model providers — OpenAI, Anthropic, Google, Ollama, and more</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Add Provider</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add LLM Provider</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Provider Name *</Label>
                <Input placeholder="e.g., My OpenAI Account" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Provider Type</Label>
                <Select value={form.provider} onValueChange={handleProviderTypeChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDER_TYPES.map((pt) => (
                      <SelectItem key={pt.value} value={pt.value}>
                        {pt.icon} {pt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.provider !== 'z-ai' && (
                <>
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input type="password" placeholder="sk-..." value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
                  </div>
                  {['openai', 'ollama', 'custom'].includes(form.provider) && (
                    <div className="space-y-2">
                      <Label>Base URL</Label>
                      <Input placeholder={getProviderType(form.provider)?.defaultUrl} value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Default Model</Label>
                    <Input placeholder="e.g., gpt-4o" value={form.defaultModel} onChange={(e) => setForm({ ...form, defaultModel: e.target.value })} />
                  </div>
                </>
              )}
              <Button onClick={handleCreate} className="w-full" disabled={creating}>
                {creating ? 'Adding...' : 'Add Provider'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Provider Type Legend */}
      <div className="flex flex-wrap gap-2 mb-6">
        {PROVIDER_TYPES.map((pt) => (
          <Badge key={pt.value} variant="outline" className="text-xs gap-1">
            {pt.icon} {pt.label}
          </Badge>
        ))}
      </div>

      {providers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Server className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No LLM Providers</h3>
            <p className="text-muted-foreground text-sm mb-4">Add an LLM provider to power your agents</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Add Provider
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
                        <Badge variant="outline" className="text-[10px] mt-1">{pt?.label || provider.provider}</Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => handleDelete(provider.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {provider.defaultModel && (
                    <div>
                      <span className="text-xs text-muted-foreground">Default Model</span>
                      <p className="text-sm font-mono">{provider.defaultModel}</p>
                    </div>
                  )}
                  {provider.baseUrl && (
                    <div>
                      <span className="text-xs text-muted-foreground">Base URL</span>
                      <p className="text-xs font-mono text-muted-foreground truncate">{provider.baseUrl}</p>
                    </div>
                  )}
                  {provider.apiKey && (
                    <div>
                      <span className="text-xs text-muted-foreground">API Key</span>
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
                        Test Connection
                      </Button>
                      {testResult && (
                        <div className="flex items-center gap-1">
                          {testResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      )}
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
    </div>
  );
}
