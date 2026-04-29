'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Brain, User, Heart, Save, Loader2, RefreshCw, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MemoryData {
  memory?: string;
  userProfile?: string;
  soul?: string;
  memoryModified?: string;
  userProfileModified?: string;
  soulModified?: string;
}

const SECTIONS = [
  {
    key: 'memory',
    labelKey: 'memory.tabMemory',
    icon: Brain,
    infoKey: 'memory.memoryInfo',
  },
  {
    key: 'userProfile',
    labelKey: 'memory.tabUser',
    icon: User,
    infoKey: 'memory.userInfo',
  },
  {
    key: 'soul',
    labelKey: 'memory.tabSoul',
    icon: Heart,
    infoKey: 'memory.soulInfo',
  },
] as const;

type SectionKey = typeof SECTIONS[number]['key'];

export function MemoryView() {
  const { agents } = useAppStore();
  const { t } = useI18n();
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [memory, setMemory] = useState<MemoryData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('memory');
  const [editedContent, setEditedContent] = useState<Record<SectionKey, string>>({
    memory: '',
    userProfile: '',
    soul: '',
  });

  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  useEffect(() => {
    if (selectedAgentId) {
      loadMemory();
    }
  }, [selectedAgentId]);

  const loadMemory = async () => {
    setLoading(true);
    try {
      const result = await api.getMemory(selectedAgentId || undefined);
      const mem = result.memory || {};
      setMemory(mem);
      setEditedContent({
        memory: mem.memory || '',
        userProfile: mem.userProfile || '',
        soul: mem.soul || '',
      });
    } catch {
      setMemory({});
      setEditedContent({ memory: '', userProfile: '', soul: '' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (section: SectionKey) => {
    setSaving(section);
    try {
      await api.updateMemory(section, editedContent[section], selectedAgentId || undefined);
      setMemory((prev) => ({
        ...prev,
        [section]: editedContent[section],
        [`${section}Modified`]: new Date().toISOString(),
      }));
      toast.success(t('memory.saved'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(null);
    }
  };

  const hasChanges = (section: SectionKey): boolean => {
    const original = memory[section] || '';
    return editedContent[section] !== original;
  };

  const getModifiedTime = (section: SectionKey): string | undefined => {
    const key = `${section}Modified` as keyof MemoryData;
    return memory[key] as string | undefined;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('memory.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('memory.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t('memory.selectAgent')} />
            </SelectTrigger>
            <SelectContent>
              {agents.length === 0 ? (
                <SelectItem value="none" disabled>{t('memory.noAgents')}</SelectItem>
              ) : (
                agents.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadMemory} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {!selectedAgentId ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Brain className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('memory.selectAgentFirst')}</h3>
            <p className="text-muted-foreground text-sm">{t('memory.selectAgentFirstDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <TabsTrigger key={section.key} value={section.key} className="gap-2">
                  <Icon className="w-4 h-4" /> {t(section.labelKey)}
                  {hasChanges(section.key) && (
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {SECTIONS.map((section) => (
            <TabsContent key={section.key} value={section.key}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <section.icon className="w-5 h-5" /> {t(section.labelKey)}
                      </CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-1">
                        <Info className="w-3 h-3" /> {t(section.infoKey)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      {getModifiedTime(section.key) && (
                        <span className="text-xs text-muted-foreground">
                          {t('memory.lastModified')}: {new Date(getModifiedTime(section.key)!).toLocaleString()}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {editedContent[section.key].length} {t('memory.characters')}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={editedContent[section.key]}
                    onChange={(e) => setEditedContent({ ...editedContent, [section.key]: e.target.value })}
                    rows={16}
                    className="font-mono text-sm resize-y"
                    placeholder={t(section.infoKey)}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {editedContent[section.key].length} {t('memory.characters')}
                    </span>
                    <Button
                      onClick={() => handleSave(section.key)}
                      disabled={saving === section.key || !hasChanges(section.key)}
                      className="gap-2"
                      size="sm"
                    >
                      {saving === section.key ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {t('common.save')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
