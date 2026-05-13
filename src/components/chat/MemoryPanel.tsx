'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Brain, BookOpen, Heart, Sparkles, Save, Trash2, X, Loader2,
  ChevronRight, FileText, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// Memory section configuration
const MEMORY_SECTIONS = [
  {
    key: 'memory' as const,
    icon: BookOpen,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
  {
    key: 'user' as const,
    icon: Heart,
    color: 'text-rose-600',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
  },
  {
    key: 'soul' as const,
    icon: Sparkles,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
] as const;

type MemorySectionKey = 'memory' | 'user' | 'soul';

interface MemoryPanelProps {
  agentId: string;
  agentName: string;
  open: boolean;
  onClose: () => void;
}

export function MemoryPanel({ agentId, agentName, open, onClose }: MemoryPanelProps) {
  const { t } = useI18n();
  const [memoryData, setMemoryData] = useState<Record<string, string>>({});
  const [totalEntries, setTotalEntries] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<MemorySectionKey | null>(null);
  const [clearing, setClearing] = useState<MemorySectionKey | null>(null);
  const [editedSections, setEditedSections] = useState<Record<MemorySectionKey, string>>({
    memory: '',
    user: '',
    soul: '',
  });
  const [hasChanges, setHasChanges] = useState<Record<MemorySectionKey, boolean>>({
    memory: false,
    user: false,
    soul: false,
  });
  const [activeTab, setActiveTab] = useState<MemorySectionKey>('memory');

  // Load memory data
  const loadMemory = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const result = await api.getMemory(agentId);
      const mem = result.memory || {};
      setMemoryData(mem);
      setTotalEntries(result.totalEntries || 0);
      setEditedSections({
        memory: mem.memory || '',
        user: mem.user || '',
        soul: mem.soul || '',
      });
      setHasChanges({ memory: false, user: false, soul: false });
    } catch (error: any) {
      console.error('Failed to load memory:', error);
      toast.error(t('memoryPanel.loadError'));
    } finally {
      setLoading(false);
    }
  }, [agentId, t]);

  useEffect(() => {
    if (open && agentId) {
      loadMemory();
    }
  }, [open, agentId, loadMemory]);

  // Handle text change
  const handleEdit = (section: MemorySectionKey, value: string) => {
    setEditedSections((prev) => ({ ...prev, [section]: value }));
    setHasChanges((prev) => ({
      ...prev,
      [section]: value !== (memoryData[section] || ''),
    }));
  };

  // Save a section
  const handleSave = async (section: MemorySectionKey) => {
    setSaving(section);
    try {
      await api.updateMemory(section, editedSections[section], agentId);
      setMemoryData((prev) => ({ ...prev, [section]: editedSections[section] }));
      setHasChanges((prev) => ({ ...prev, [section]: false }));
      toast.success(t('memoryPanel.saveSuccess'));
      // Reload to get updated totalEntries
      await loadMemory();
    } catch (error: any) {
      toast.error(error.message || t('memoryPanel.saveError'));
    } finally {
      setSaving(null);
    }
  };

  // Clear a section
  const handleClear = async (section: MemorySectionKey) => {
    setClearing(section);
    try {
      await api.clearMemory(agentId, section);
      setEditedSections((prev) => ({ ...prev, [section]: '' }));
      setMemoryData((prev) => ({ ...prev, [section]: '' }));
      setHasChanges((prev) => ({ ...prev, [section]: false }));
      toast.success(t('memoryPanel.clearSuccess'));
      await loadMemory();
    } catch (error: any) {
      toast.error(error.message || t('memoryPanel.clearError'));
    } finally {
      setClearing(null);
    }
  };

  // Count lines in a section
  const countLines = (text: string) => {
    if (!text.trim()) return 0;
    return text.split('\n').filter((l) => l.trim()).length;
  };

  const anyChanges = Object.values(hasChanges).some(Boolean);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/20 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-background border-l border-border shadow-xl z-50 flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{t('memoryPanel.title')}</h3>
                  <p className="text-[10px] text-muted-foreground">{agentName}</p>
                </div>
                {totalEntries > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 ml-1">
                    {totalEntries} {t('memoryPanel.entries')}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7"
                  onClick={loadMemory}
                  disabled={loading}
                  aria-label={t('common.refresh')}
                >
                  <RotateCcw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7"
                  onClick={onClose}
                  aria-label={t('common.close')}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                  </div>
                </div>
              ) : (
                <Tabs
                  value={activeTab}
                  onValueChange={(v) => setActiveTab(v as MemorySectionKey)}
                  className="h-full flex flex-col"
                >
                  <div className="px-4 pt-3 shrink-0">
                    <TabsList className="w-full grid grid-cols-3 h-9">
                      {MEMORY_SECTIONS.map((section) => {
                        const Icon = section.icon;
                        const lineCount = countLines(editedSections[section.key]);
                        return (
                          <TabsTrigger
                            key={section.key}
                            value={section.key}
                            className="gap-1.5 text-xs"
                          >
                            <Icon className={cn('w-3.5 h-3.5', section.color)} />
                            <span className="hidden sm:inline">
                              {t(`memoryPanel.${section.key}Tab`)}
                            </span>
                            <span className="sm:hidden">
                              {t(`memoryPanel.${section.key}TabShort`)}
                            </span>
                            {lineCount > 0 && (
                              <span className="text-[9px] text-muted-foreground">
                                ({lineCount})
                              </span>
                            )}
                            {hasChanges[section.key] && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            )}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </div>

                  {MEMORY_SECTIONS.map((section) => {
                    const Icon = section.icon;
                    const isSaving = saving === section.key;
                    const isClearing = clearing === section.key;
                    const content = editedSections[section.key];
                    const lineCount = countLines(content);
                    const charCount = content.length;

                    return (
                      <TabsContent
                        key={section.key}
                        value={section.key}
                        className="flex-1 flex flex-col px-4 pb-4 mt-0 overflow-hidden"
                      >
                        {/* Section description */}
                        <div className={cn('rounded-lg p-3 mt-3 mb-3', section.bgColor, `border ${section.borderColor}`)}>
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={cn('w-4 h-4', section.color)} />
                            <span className="text-sm font-medium">
                              {t(`memoryPanel.${section.key}Title`)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t(`memoryPanel.${section.key}Desc`)}
                          </p>
                        </div>

                        {/* Editor */}
                        <div className="flex-1 min-h-0">
                          <Textarea
                            className="h-full min-h-[200px] resize-none text-sm font-mono"
                            value={content}
                            onChange={(e) => handleEdit(section.key, e.target.value)}
                            placeholder={t(`memoryPanel.${section.key}Placeholder`)}
                            disabled={isSaving || isClearing}
                          />
                        </div>

                        {/* Stats bar */}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                          <span>{lineCount} {t('memoryPanel.lines')}</span>
                          <span>·</span>
                          <span>{charCount} {t('memoryPanel.characters')}</span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            size="sm"
                            className="gap-1.5 flex-1"
                            onClick={() => handleSave(section.key)}
                            disabled={!hasChanges[section.key] || isSaving || isClearing}
                          >
                            {isSaving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            {t('common.save')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => handleClear(section.key)}
                            disabled={isSaving || isClearing || !content.trim()}
                          >
                            {isClearing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            {t('memoryPanel.clear')}
                          </Button>
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-border shrink-0">
              <p className="text-[10px] text-muted-foreground text-center">
                {t('memoryPanel.footerHint')}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Memory badge button to be used in chat headers.
 * Shows count of memory entries and toggles the memory panel.
 */
export function MemoryBadge({
  agentId,
  count,
  onClick,
}: {
  agentId: string;
  count: number;
  onClick: () => void;
}) {
  const { t } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 h-7 text-xs"
      onClick={onClick}
      aria-label={t('memoryPanel.title')}
    >
      <Brain className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{t('memoryPanel.title')}</span>
      {count > 0 && (
        <Badge variant="secondary" className="text-[9px] h-4 min-w-[16px] px-1">
          {count}
        </Badge>
      )}
    </Button>
  );
}

/**
 * Memory used indicator shown below agent messages when memory context was used.
 */
export function MemoryUsedIndicator() {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1 mt-1">
      <Brain className="w-3 h-3 text-primary/60" />
      <span className="text-[10px] text-muted-foreground/70">
        {t('memoryPanel.memoryUsed')}
      </span>
    </div>
  );
}
