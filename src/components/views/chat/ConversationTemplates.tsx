'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  LayoutTemplate,
  Play,
  Loader2,
  FileText,
  Users,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ConversationTemplateData {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  systemPrompt: string | null;
  initialMessage: string | null;
  agentIds: string[];
  isPublic: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ConversationTemplatesProps {
  onUseTemplate: (template: ConversationTemplateData) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ConversationTemplates({ onUseTemplate }: ConversationTemplatesProps) {
  const { t } = useI18n();
  const { agents } = useAppStore();
  const [templates, setTemplates] = useState<ConversationTemplateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    icon: '💬',
    systemPrompt: '',
    initialMessage: '',
    agentIds: [] as string[],
    isPublic: false,
  });

  // Fetch templates
  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getConversationTemplates();
      setTemplates(data.templates || []);
    } catch (err: any) {
      console.error('[ConversationTemplates] Failed to load templates:', err);
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!form.name.trim()) return;

    setCreating(true);
    try {
      const data = await api.createConversationTemplate({
        name: form.name.trim(),
        description: form.description.trim() || null,
        icon: form.icon || null,
        systemPrompt: form.systemPrompt.trim() || null,
        initialMessage: form.initialMessage.trim() || null,
        agentIds: form.agentIds.length > 0 ? form.agentIds : null,
        isPublic: form.isPublic,
      });
      setTemplates((prev) => [data.template, ...prev]);
      setCreateOpen(false);
      resetForm();
      toast({ title: t('templates.created') });
    } catch (err: any) {
      console.error('[ConversationTemplates] Failed to create template:', err);
      toast({ title: err.message || 'Failed to create template', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setForm({
      name: '',
      description: '',
      icon: '💬',
      systemPrompt: '',
      initialMessage: '',
      agentIds: [],
      isPublic: false,
    });
  }

  function toggleAgentId(agentId: string) {
    setForm((prev) => ({
      ...prev,
      agentIds: prev.agentIds.includes(agentId)
        ? prev.agentIds.filter((id) => id !== agentId)
        : [...prev.agentIds, agentId],
    }));
  }

  // Get agent name by ID
  function getAgentName(agentId: string): string {
    const agent = agents.find((a: any) => a.id === agentId);
    return agent?.name || agentId;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-destructive mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={loadTemplates}>
          {t('common.refresh')}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium flex items-center gap-1.5">
            <LayoutTemplate className="w-4 h-4 text-primary" />
            {t('templates.title')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t('templates.subtitle')}</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
              <Plus className="w-3.5 h-3.5" />
              {t('templates.createTemplate')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('templates.createTemplate')}</DialogTitle>
              <DialogDescription>
                Create a reusable conversation template with preset agents and prompts.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Icon + Name */}
              <div className="flex gap-3 items-end">
                <div className="w-20">
                  <Label className="text-xs">{t('templates.icon')}</Label>
                  <Input
                    value={form.icon}
                    onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
                    className="mt-1 text-center text-xl h-10"
                    maxLength={2}
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs">{t('templates.name')} *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Code Review Session"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <Label className="text-xs">{t('templates.description')}</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="What is this template for?"
                  className="mt-1"
                />
              </div>

              {/* System Prompt */}
              <div>
                <Label className="text-xs">{t('templates.systemPrompt')}</Label>
                <Textarea
                  value={form.systemPrompt}
                  onChange={(e) => setForm((p) => ({ ...p, systemPrompt: e.target.value }))}
                  placeholder="Override the agent's system prompt for this conversation..."
                  className="mt-1 min-h-[80px] text-xs"
                />
              </div>

              {/* Initial Message */}
              <div>
                <Label className="text-xs">{t('templates.initialMessage')}</Label>
                <Textarea
                  value={form.initialMessage}
                  onChange={(e) => setForm((p) => ({ ...p, initialMessage: e.target.value }))}
                  placeholder="Auto-send this message when starting the conversation..."
                  className="mt-1 min-h-[60px] text-xs"
                />
              </div>

              {/* Agent Selection */}
              <div>
                <Label className="text-xs flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  {t('templates.agents')}
                </Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {agents.map((agent: any) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => toggleAgentId(agent.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all',
                        form.agentIds.includes(agent.id)
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border hover:border-primary/30 hover:bg-accent/50'
                      )}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                      {agent.name}
                    </button>
                  ))}
                  {agents.length === 0 && (
                    <span className="text-xs text-muted-foreground">No agents available</span>
                  )}
                </div>
              </div>

              {/* Public toggle */}
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('templates.public')}</Label>
                <Switch
                  checked={form.isPublic}
                  onCheckedChange={(checked) => setForm((p) => ({ ...p, isPublic: checked }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} size="sm">
                {t('common.cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={!form.name.trim() || creating} size="sm">
                {creating && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {t('common.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Template Grid */}
      {templates.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {templates.map((template, index) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.2 }}
            >
              <Card className="hover:border-primary/30 hover:shadow-sm transition-all duration-200 rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-lg">
                      {template.icon || '💬'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{template.name}</span>
                        {template.isPublic && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">
                            Public
                          </Badge>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {template.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {template.agentIds.length > 0 && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5">
                            <Users className="w-2.5 h-2.5" />
                            {template.agentIds.length} agent{template.agentIds.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                        {template.systemPrompt && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5">
                            <FileText className="w-2.5 h-2.5" />
                            Prompt
                          </Badge>
                        )}
                        {template.initialMessage && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" />
                            Starter
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {t('templates.usageCount')}: {template.usageCount}
                        </span>
                      </div>

                      {/* Use Template Button */}
                      <Button
                        variant="default"
                        size="sm"
                        className="mt-3 w-full gap-1.5 h-7 text-xs"
                        onClick={() => onUseTemplate(template)}
                      >
                        <Play className="w-3 h-3" />
                        {t('templates.useTemplate')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <LayoutTemplate className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t('templates.noTemplates')}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">{t('templates.noTemplatesDesc')}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            {t('templates.createFirst')}
          </Button>
        </div>
      )}
    </div>
  );
}
