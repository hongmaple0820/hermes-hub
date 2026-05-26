'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Brain, User, Heart, Save, Loader2, RefreshCw, Info,
  Plus, Search, Pin, PinOff, Download, Upload, Trash2,
  X, FileJson, Tag, BarChart3, Edit3, Check, ChevronUp,
  Sparkles, Database, Hash, Star,
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

interface MemoryEntry {
  id: string;
  key: string;
  content: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
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

const CATEGORY_COLORS: Record<string, string> = {
  fact: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  preference: 'bg-amber-500/10 text-amber-600 border-amber-200',
  instruction: 'bg-rose-500/10 text-rose-600 border-rose-200',
  context: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
  note: 'bg-violet-500/10 text-violet-600 border-violet-200',
};

const CATEGORY_DOT_COLORS: Record<string, string> = {
  fact: 'bg-emerald-500',
  preference: 'bg-amber-500',
  instruction: 'bg-rose-500',
  context: 'bg-cyan-500',
  note: 'bg-violet-500',
};

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

  // Memory entries (structured key-value pairs)
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MemoryEntry | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);

  // Create/edit form
  const [formKey, setFormKey] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('fact');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high'>('medium');

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
      parseEntries(mem.memory || '');
    } catch {
      setMemory({});
      setEditedContent({ memory: '', userProfile: '', soul: '' });
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const parseEntries = (content: string) => {
    try {
      const lines = content.split('\n').filter(l => l.trim());
      const parsed: MemoryEntry[] = [];
      for (const line of lines) {
        const match = line.match(/^\[([^\]]+)\]\s*(.+)/);
        if (match) {
          parsed.push({
            id: `entry-${parsed.length}-${Date.now()}`,
            key: match[1],
            content: match[2],
            category: 'fact',
            priority: 'medium',
            pinned: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
      if (parsed.length === 0 && content.trim()) {
        parsed.push({
          id: `entry-main-${Date.now()}`,
          key: 'main',
          content: content.trim(),
          category: 'context',
          priority: 'medium',
          pinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      setEntries(parsed);
    } catch {
      setEntries([]);
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

  // Entry management
  const handleCreateEntry = () => {
    if (!formKey.trim() || !formContent.trim()) {
      toast.error(t('common.required'));
      return;
    }
    const newEntry: MemoryEntry = {
      id: `entry-${Date.now()}`,
      key: formKey.trim(),
      content: formContent.trim(),
      category: formCategory,
      priority: formPriority,
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...entries, newEntry];
    setEntries(updated);
    syncEntriesToMemory(updated);
    setShowCreateDialog(false);
    resetForm();
    toast.success(t('memory.entryCreated'));
  };

  const handleUpdateEntry = () => {
    if (!editingEntry || !formKey.trim() || !formContent.trim()) return;
    const updated = entries.map(e =>
      e.id === editingEntry.id
        ? { ...e, key: formKey.trim(), content: formContent.trim(), category: formCategory, priority: formPriority, updatedAt: new Date().toISOString() }
        : e
    );
    setEntries(updated);
    syncEntriesToMemory(updated);
    setEditingEntry(null);
    resetForm();
    toast.success(t('memory.entryUpdated'));
  };

  const handleDeleteEntry = () => {
    if (!deleteEntryId) return;
    const updated = entries.filter(e => e.id !== deleteEntryId);
    setEntries(updated);
    syncEntriesToMemory(updated);
    setDeleteEntryId(null);
    toast.success(t('memory.entryDeleted'));
  };

  const handleTogglePin = (id: string) => {
    const entry = entries.find(e => e.id === id);
    const updated = entries.map(e =>
      e.id === id ? { ...e, pinned: !e.pinned } : e
    );
    setEntries(updated);
    syncEntriesToMemory(updated);
    toast.success(entry?.pinned ? t('memory.unpinned') : t('memory.pinned'));
  };

  const syncEntriesToMemory = (updatedEntries: MemoryEntry[]) => {
    const content = updatedEntries
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .map(e => `[${e.key}] ${e.content}`)
      .join('\n');
    setEditedContent(prev => ({ ...prev, memory: content }));
  };

  const resetForm = () => {
    setFormKey('');
    setFormContent('');
    setFormCategory('fact');
    setFormPriority('medium');
  };

  // Filter and search
  const filteredEntries = useMemo(() => {
    let result = [...entries];
    if (filterCategory !== 'all') {
      result = result.filter(e => e.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.key.toLowerCase().includes(q) || e.content.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [entries, filterCategory, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const byCategory: Record<string, number> = {};
    entries.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + 1;
    });
    const totalSize = entries.reduce((sum, e) => sum + e.key.length + e.content.length, 0);
    return {
      total: entries.length,
      byCategory,
      totalSize,
      pinned: entries.filter(e => e.pinned).length,
      highPriority: entries.filter(e => e.priority === 'high').length,
    };
  }, [entries]);

  // Export/Import
  const handleExport = () => {
    const data = {
      entries,
      rawMemory: editedContent.memory,
      userProfile: editedContent.userProfile,
      soul: editedContent.soul,
      exportedAt: new Date().toISOString(),
      agentId: selectedAgentId,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memory-${selectedAgentId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('memory.exported'));
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.entries && Array.isArray(data.entries)) {
          setEntries(data.entries);
          syncEntriesToMemory(data.entries);
        }
        if (data.rawMemory) setEditedContent(prev => ({ ...prev, memory: data.rawMemory }));
        if (data.userProfile) setEditedContent(prev => ({ ...prev, userProfile: data.userProfile }));
        if (data.soul) setEditedContent(prev => ({ ...prev, soul: data.soul }));
        toast.success(t('memory.imported'));
      } catch {
        toast.error(t('memory.importFailed'));
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const categories = useMemo(() => {
    const cats = new Set(entries.map(e => e.category));
    return ['all', ...Array.from(cats)];
  }, [entries]);

  const priorityColors: Record<string, string> = {
    high: 'text-rose-600 bg-rose-500/10',
    medium: 'text-amber-600 bg-amber-500/10',
    low: 'text-gray-500 bg-gray-500/10',
  };

  // Helper for category label with i18n
  const getCategoryLabel = (cat: string) => {
    const key = `memory.cat${cat.charAt(0).toUpperCase()}${cat.slice(1)}`;
    const translated = t(key);
    // If the key is returned as-is (no translation found), fallback to the raw category name
    return translated === key ? cat : translated;
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
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" /> {t('memory.export')}
          </Button>
          <div className="relative">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => document.getElementById('memory-import')?.click()}>
              <Upload className="w-4 h-4" /> {t('memory.import')}
            </Button>
            <input id="memory-import" type="file" accept=".json" className="hidden" onChange={handleImport} />
          </div>
        </div>
      </div>

      {!selectedAgentId ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500/20 to-rose-500/20 flex items-center justify-center">
                <Brain className="w-12 h-12 text-amber-500" />
              </div>
              <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center">
                <Heart className="w-4 h-4 text-rose-500" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('memory.selectAgentFirst')}</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm text-center">{t('memory.selectAgentFirstDesc')}</p>
            <div className="flex gap-3">
              {[Brain, User, Heart].map((Icon, i) => (
                <div key={i} className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Icon className="w-5 h-5 text-muted-foreground animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                </div>
              ))}
            </div>
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
              {section.key === 'memory' ? (
                <div className="space-y-4">
                  {/* Statistics Header */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <Card className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <BarChart3 className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t('memory.totalEntries')}</p>
                          <p className="text-lg font-bold">{stats.total}</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Pin className="w-4 h-4 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t('memory.pinnedEntries')}</p>
                          <p className="text-lg font-bold">{stats.pinned}</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                          <Star className="w-4 h-4 text-rose-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t('memory.highPriority')}</p>
                          <p className="text-lg font-bold">{stats.highPriority}</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                          <Tag className="w-4 h-4 text-cyan-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t('memory.categories')}</p>
                          <p className="text-lg font-bold">{Object.keys(stats.byCategory).length}</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                          <FileJson className="w-4 h-4 text-violet-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t('memory.totalSize')}</p>
                          <p className="text-lg font-bold">{stats.totalSize} <span className="text-xs font-normal">{t('memory.characters')}</span></p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Category Breakdown */}
                  {Object.keys(stats.byCategory).length > 0 && (
                    <Card className="p-4">
                      <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5" /> {t('memory.categoryBreakdown')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(stats.byCategory).map(([cat, count]) => (
                          <div
                            key={cat}
                            className={cn(
                              'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-all hover:shadow-sm',
                              filterCategory === cat
                                ? CATEGORY_COLORS[cat] || 'bg-gray-500/10 text-gray-600 border-gray-200 ring-2 ring-offset-1 ring-current/20'
                                : 'bg-muted/50 border-transparent hover:bg-muted'
                            )}
                            onClick={() => setFilterCategory(filterCategory === cat ? 'all' : cat)}
                          >
                            <span className={cn('w-2 h-2 rounded-full', CATEGORY_DOT_COLORS[cat] || 'bg-gray-400')} />
                            <span className="font-medium">{getCategoryLabel(cat)}</span>
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Search and Filter Bar */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder={t('memory.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {cat === 'all' ? t('memory.allCategories') : getCategoryLabel(cat)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="gap-2" onClick={() => { resetForm(); setShowCreateDialog(true); }}>
                      <Plus className="w-4 h-4" /> {t('memory.createEntry')}
                    </Button>
                  </div>

                  {/* Entries List */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Brain className="w-5 h-5" /> {t(section.labelKey)}
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
                            {filteredEntries.length} {t('memory.entries')}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center py-12 text-muted-foreground">
                          <div className="relative mb-4">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/10 to-cyan-500/10 flex items-center justify-center">
                              <Database className="w-10 h-10 text-amber-400/60" />
                            </div>
                            <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center">
                              <Plus className="w-3.5 h-3.5 text-emerald-500" />
                            </div>
                          </div>
                          <p className="text-sm font-medium mb-1">{t('memory.noEntriesTitle')}</p>
                          <p className="text-xs text-muted-foreground/70 mb-4 max-w-xs text-center">{t('memory.noEntriesDesc')}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => { resetForm(); setShowCreateDialog(true); }}
                          >
                            <Plus className="w-4 h-4" /> {t('memory.createEntry')}
                          </Button>
                        </div>
                      ) : (
                        <ScrollArea className="max-h-96">
                          <div className="space-y-2 pr-3">
                            {filteredEntries.map((entry) => (
                              <div
                                key={entry.id}
                                className={cn(
                                  'group flex items-start gap-3 p-3 rounded-lg border transition-all hover:bg-muted/50',
                                  entry.pinned && 'border-amber-200 bg-amber-500/5 shadow-sm',
                                  entry.priority === 'high' && !entry.pinned && 'border-rose-100'
                                )}
                              >
                                <div className="flex flex-col gap-1 shrink-0">
                                  <button
                                    onClick={() => handleTogglePin(entry.id)}
                                    className="p-1 rounded hover:bg-muted transition-colors"
                                    title={entry.pinned ? t('memory.unpin') : t('memory.pin')}
                                  >
                                    {entry.pinned ? (
                                      <Pin className="w-4 h-4 text-amber-500 fill-amber-500" />
                                    ) : (
                                      <Pin className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                  </button>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="font-mono text-sm font-medium">{entry.key}</span>
                                    <Badge variant="outline" className={cn('text-[10px] gap-1', CATEGORY_COLORS[entry.category] || 'bg-gray-500/10 text-gray-500 border-gray-200')}>
                                      <span className={cn('w-1.5 h-1.5 rounded-full', CATEGORY_DOT_COLORS[entry.category] || 'bg-gray-400')} />
                                      {getCategoryLabel(entry.category)}
                                    </Badge>
                                    <Badge variant="outline" className={cn('text-[10px]', priorityColors[entry.priority])}>
                                      {t(`memory.priority${entry.priority.charAt(0).toUpperCase()}${entry.priority.slice(1)}`)}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground line-clamp-2">{entry.content}</p>
                                </div>
                                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-7 h-7"
                                    onClick={() => {
                                      setEditingEntry(entry);
                                      setFormKey(entry.key);
                                      setFormContent(entry.content);
                                      setFormCategory(entry.category);
                                      setFormPriority(entry.priority);
                                    }}
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-7 h-7 text-destructive"
                                    onClick={() => setDeleteEntryId(entry.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}

                      {/* Raw Editor */}
                      <div className="mt-4 pt-4 border-t">
                        <Label className="text-sm font-medium mb-2 block">{t('memory.rawEditor')}</Label>
                        <Textarea
                          value={editedContent[section.key]}
                          onChange={(e) => setEditedContent({ ...editedContent, [section.key]: e.target.value })}
                          rows={8}
                          className="font-mono text-sm resize-y"
                          placeholder={t(section.infoKey)}
                        />
                        <div className="flex items-center justify-between mt-2">
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
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
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
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Create Entry Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" /> {t('memory.createEntry')}
            </DialogTitle>
            <DialogDescription>{t('memory.createEntryDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>{t('memory.entryKey')} *</Label>
              <Input
                placeholder={t('memory.entryKeyPlaceholder')}
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('memory.entryContent')} *</Label>
              <Textarea
                placeholder={t('memory.entryContentPlaceholder')}
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('memory.entryCategory')}</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fact">{getCategoryLabel('fact')}</SelectItem>
                    <SelectItem value="preference">{getCategoryLabel('preference')}</SelectItem>
                    <SelectItem value="instruction">{getCategoryLabel('instruction')}</SelectItem>
                    <SelectItem value="context">{getCategoryLabel('context')}</SelectItem>
                    <SelectItem value="note">{getCategoryLabel('note')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('memory.entryPriority')}</Label>
                <Select value={formPriority} onValueChange={(v: any) => setFormPriority(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">{t('memory.priorityHigh')}</SelectItem>
                    <SelectItem value="medium">{t('memory.priorityMedium')}</SelectItem>
                    <SelectItem value="low">{t('memory.priorityLow')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreateEntry} className="gap-2">
              <Plus className="w-4 h-4" /> {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => { if (!open) setEditingEntry(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5" /> {t('memory.editEntry')}
            </DialogTitle>
            <DialogDescription>{t('memory.editEntryDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>{t('memory.entryKey')}</Label>
              <Input
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('memory.entryContent')}</Label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('memory.entryCategory')}</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fact">{getCategoryLabel('fact')}</SelectItem>
                    <SelectItem value="preference">{getCategoryLabel('preference')}</SelectItem>
                    <SelectItem value="instruction">{getCategoryLabel('instruction')}</SelectItem>
                    <SelectItem value="context">{getCategoryLabel('context')}</SelectItem>
                    <SelectItem value="note">{getCategoryLabel('note')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('memory.entryPriority')}</Label>
                <Select value={formPriority} onValueChange={(v: any) => setFormPriority(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">{t('memory.priorityHigh')}</SelectItem>
                    <SelectItem value="medium">{t('memory.priorityMedium')}</SelectItem>
                    <SelectItem value="low">{t('memory.priorityLow')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEntry(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleUpdateEntry} className="gap-2">
              <Check className="w-4 h-4" /> {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEntryId} onOpenChange={(open) => { if (!open) setDeleteEntryId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('memory.deleteEntryTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('memory.deleteEntryDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
