'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Wrench, Search, Plus, Globe, Code, Database, Mail,
  Image, Calculator, FileText, Zap, ArrowUpDown, Filter,
  Trash2, Pencil, Eye, Loader2, AlertCircle, Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---- Types ----
interface ToolData {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  parameters: string;
  handlerType: string;
  handlerConfig: string;
  icon: string | null;
  isPublic: boolean;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AgentToolBinding {
  id: string;
  agentId: string;
  toolId: string;
  isEnabled: boolean;
  config: string;
  priority: number;
  tool?: ToolData;
}

// ---- Icon mapping ----
const iconMap: Record<string, typeof Wrench> = {
  Globe,
  Code,
  Database,
  Mail,
  Image,
  Calculator,
  FileText,
  Zap,
  Wrench,
};

function getToolIcon(iconName: string | null, category: string): typeof Wrench {
  if (iconName && iconMap[iconName]) return iconMap[iconName];
  const catMap: Record<string, typeof Wrench> = {
    web: Globe,
    development: Code,
    data: Database,
    communication: Mail,
    media: Image,
    utility: Calculator,
    productivity: FileText,
    general: Wrench,
  };
  return catMap[category] || Wrench;
}

// ---- Categories ----
const categories = [
  { id: 'all', labelKey: 'allCategories', icon: Filter },
  { id: 'utility', label: 'Utility', icon: Calculator },
  { id: 'development', label: 'Dev', icon: Code },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'communication', label: 'Comms', icon: Mail },
  { id: 'media', label: 'Media', icon: Image },
  { id: 'productivity', label: 'Productivity', icon: FileText },
  { id: 'general', label: 'General', icon: Wrench },
];

const handlerTypes = [
  { id: 'builtin', label: 'Built-in' },
  { id: 'http', label: 'HTTP' },
  { id: 'websocket', label: 'WebSocket' },
];

// ---- Create/Edit form state ----
interface ToolFormData {
  name: string;
  displayName: string;
  description: string;
  category: string;
  handlerType: string;
  parameters: string;
  handlerConfig: string;
  icon: string;
  isPublic: boolean;
}

const emptyForm: ToolFormData = {
  name: '',
  displayName: '',
  description: '',
  category: 'utility',
  handlerType: 'builtin',
  parameters: '{\n  "type": "object",\n  "properties": {},\n  "required": []\n}',
  handlerConfig: '{}',
  icon: 'Wrench',
  isPublic: false,
};

export function ToolRegistry() {
  const { t } = useI18n();
  const { tools, setTools, agents } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt'>('createdAt');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBindDialog, setShowBindDialog] = useState(false);

  const [selectedTool, setSelectedTool] = useState<ToolData | null>(null);
  const [formData, setFormData] = useState<ToolFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Agent binding state
  const [toolBindings, setToolBindings] = useState<Record<string, string[]>>({});
  const [bindAgentId, setBindAgentId] = useState('');
  const [isBinding, setIsBinding] = useState(false);

  // ---- Fetch tools ----
  const fetchTools = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.getTools();
      const toolList = (res as any).data || (res as any).tools || [];
      if (Array.isArray(toolList) && toolList.length === 0) {
        // Seed default tools if empty
        try {
          await api.seedTools();
          const res2 = await api.getTools();
          const seeded = (res2 as any).data || (res2 as any).tools || [];
          setTools(seeded);
        } catch {
          setTools([]);
        }
      } else {
        setTools(toolList);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tools');
    } finally {
      setIsLoading(false);
    }
  }, [setTools]);

  // ---- Fetch agent-tool bindings for all agents ----
  const fetchBindings = useCallback(async () => {
    if (!agents || agents.length === 0) return;
    const bindingsMap: Record<string, string[]> = {};
    await Promise.all(
      agents.map(async (agent: any) => {
        try {
          const res = await api.getAgentTools(agent.id);
          const agentTools = (res as any).data || (res as any).agentTools || [];
          bindingsMap[agent.id] = agentTools.map((at: any) => at.toolId);
        } catch {
          bindingsMap[agent.id] = [];
        }
      })
    );
    setToolBindings(bindingsMap);
  }, [agents]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  useEffect(() => {
    if (tools.length > 0 && agents.length > 0) {
      fetchBindings();
    }
  }, [tools.length, agents.length, fetchBindings]);

  // ---- Computed ----
  const toolList: ToolData[] = Array.isArray(tools) ? tools : [];

  // Count how many agents have each tool bound
  const toolAgentCount = useCallback((toolId: string): number => {
    let count = 0;
    for (const agentIds of Object.values(toolBindings)) {
      if (agentIds.includes(toolId)) count++;
    }
    return count;
  }, [toolBindings]);

  // Get agents that have a specific tool bound
  const getToolAgents = useCallback((toolId: string): string[] => {
    const result: string[] = [];
    for (const [agentId, toolIds] of Object.entries(toolBindings)) {
      if (toolIds.includes(toolId)) {
        const agent = agents.find((a: any) => a.id === agentId);
        result.push(agent?.name || agentId);
      }
    }
    return result;
  }, [toolBindings, agents]);

  const filteredTools = toolList
    .filter((tool) => {
      const matchesSearch =
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'all' || tool.category === activeCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const boundCount = toolList.filter((tool) => toolAgentCount(tool.id) > 0).length;

  // ---- Form validation ----
  const validateForm = (data: ToolFormData): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!data.name.trim()) {
      errors.name = t('toolRegistry.nameRequired');
    } else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data.name)) {
      errors.name = t('toolRegistry.nameKebab');
    } else if (!showEditDialog && toolList.some((t) => t.name === data.name)) {
      errors.name = t('toolRegistry.nameExists');
    }
    if (!data.displayName.trim()) {
      errors.displayName = t('toolRegistry.displayNameRequired');
    }
    if (!data.description.trim()) {
      errors.description = t('toolRegistry.descriptionRequired');
    }
    try {
      JSON.parse(data.parameters);
    } catch {
      errors.parameters = t('toolRegistry.invalidJson');
    }
    try {
      JSON.parse(data.handlerConfig);
    } catch {
      errors.handlerConfig = t('toolRegistry.invalidJson');
    }
    return errors;
  };

  // ---- Handlers ----
  const handleCreateTool = async () => {
    const errors = validateForm(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const parsedParams = JSON.parse(formData.parameters);
      const parsedConfig = JSON.parse(formData.handlerConfig);
      await api.createTool({
        name: formData.name,
        displayName: formData.displayName,
        description: formData.description,
        category: formData.category,
        handlerType: formData.handlerType,
        parameters: parsedParams,
        handlerConfig: parsedConfig,
        icon: formData.icon || undefined,
        isPublic: formData.isPublic,
      });
      toast.success(t('toolRegistry.created'));
      setShowCreateDialog(false);
      setFormData(emptyForm);
      setFormErrors({});
      fetchTools();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create tool');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTool = async () => {
    if (!selectedTool) return;
    const errors = validateForm(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const parsedParams = JSON.parse(formData.parameters);
      const parsedConfig = JSON.parse(formData.handlerConfig);
      await api.updateTool(selectedTool.id, {
        displayName: formData.displayName,
        description: formData.description,
        category: formData.category,
        handlerType: formData.handlerType,
        parameters: parsedParams,
        handlerConfig: parsedConfig,
        icon: formData.icon || undefined,
        isPublic: formData.isPublic,
      });
      toast.success(t('toolRegistry.updated'));
      setShowEditDialog(false);
      setSelectedTool(null);
      setFormData(emptyForm);
      setFormErrors({});
      fetchTools();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update tool');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTool = async () => {
    if (!selectedTool) return;
    setIsSubmitting(true);
    try {
      await api.deleteTool(selectedTool.id);
      toast.success(t('toolRegistry.deleted'));
      setShowDeleteDialog(false);
      setSelectedTool(null);
      fetchTools();
      fetchBindings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete tool');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBindTool = async () => {
    if (!selectedTool || !bindAgentId) return;
    setIsBinding(true);
    try {
      await api.bindToolToAgent(bindAgentId, selectedTool.id);
      toast.success(t('toolRegistry.bindSuccess'));
      setShowBindDialog(false);
      setBindAgentId('');
      fetchBindings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to bind tool');
    } finally {
      setIsBinding(false);
    }
  };

  const handleUnbindTool = async (agentId: string, toolId: string) => {
    try {
      await api.unbindToolFromAgent(agentId, toolId);
      toast.success(t('toolRegistry.unbindSuccess'));
      fetchBindings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unbind tool');
    }
  };

  const openEditDialog = (tool: ToolData) => {
    setSelectedTool(tool);
    let parsedParams = '{}';
    try {
      parsedParams = typeof tool.parameters === 'string'
        ? JSON.stringify(JSON.parse(tool.parameters), null, 2)
        : JSON.stringify(tool.parameters, null, 2);
    } catch { /* keep default */ }
    let parsedConfig = '{}';
    try {
      parsedConfig = typeof tool.handlerConfig === 'string'
        ? JSON.stringify(JSON.parse(tool.handlerConfig), null, 2)
        : JSON.stringify(tool.handlerConfig, null, 2);
    } catch { /* keep default */ }
    setFormData({
      name: tool.name,
      displayName: tool.displayName,
      description: tool.description,
      category: tool.category,
      handlerType: tool.handlerType,
      parameters: parsedParams,
      handlerConfig: parsedConfig,
      icon: tool.icon || 'Wrench',
      isPublic: tool.isPublic,
    });
    setFormErrors({});
    setShowEditDialog(true);
  };

  const openDetailDialog = (tool: ToolData) => {
    setSelectedTool(tool);
    setShowDetailDialog(true);
  };

  // ---- Render: Loading skeletons ----
  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-9 flex-1" />
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-8 w-16 rounded-full" />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- Render: Error state ----
  if (error) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mb-4 text-destructive" />
            <p className="text-lg font-medium text-foreground">{t('common.error')}</p>
            <p className="text-sm mt-1">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={fetchTools}
            >
              {t('common.refresh')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl p-5 border border-border/50" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(6,182,212,0.04) 50%, rgba(16,185,129,0.04) 100%)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Wrench className="w-6 h-6 text-primary" />
                {t('toolRegistry.title')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('toolRegistry.subtitle')}
              </p>
            </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {boundCount}/{toolList.length} {t('toolRegistry.bound').toLowerCase()}
            </Badge>
            <Button
              size="sm"
              className="gap-1.5 rounded-lg"
              onClick={() => {
                setFormData(emptyForm);
                setFormErrors({});
                setShowCreateDialog(true);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              {t('toolRegistry.createTool')}
            </Button>
          </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('toolRegistry.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-lg"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              const label = cat.id === 'all'
                ? t('toolRegistry.allCategories')
                : cat.label;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                    isActive
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                      : 'bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent'
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setSortBy(sortBy === 'name' ? 'createdAt' : 'name')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent transition-colors border border-border"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortBy === 'name' ? 'A-Z' : t('toolRegistry.newest')}
          </button>
        </div>

        {/* Tool grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTools.map((tool, idx) => {
            const Icon = getToolIcon(tool.icon, tool.category);
            const agentCount = toolAgentCount(tool.id);
            const isBound = agentCount > 0;
            const isSystem = tool.userId === null;
            return (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Card className="rounded-xl hover:shadow-md hover:scale-[1.01] transition-all duration-200 hover:border-primary/20 group">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0 group-hover:from-primary/15 group-hover:to-primary/10 transition-colors cursor-pointer"
                        onClick={() => openDetailDialog(tool)}
                      >
                        <Icon className="w-5 h-5 text-primary/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className="text-sm font-medium truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => openDetailDialog(tool)}
                          >
                            {tool.displayName}
                          </p>
                          {isBound && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                              {t('toolRegistry.bound')}
                            </Badge>
                          )}
                          {isSystem && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                              {t('toolRegistry.systemTools')}
                            </Badge>
                          )}
                          {tool.isPublic && !isSystem && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                              {t('toolRegistry.public')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tool.description}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-[10px] text-muted-foreground/70">{tool.category}</span>
                          <span className="text-[10px] text-muted-foreground/70">{tool.handlerType}</span>
                          {agentCount > 0 && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                              {t('toolRegistry.usedByAgents', { count: agentCount })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          variant={isBound ? 'outline' : 'default'}
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            if (isBound) {
                              openEditDialog(tool);
                            } else {
                              setSelectedTool(tool);
                              setBindAgentId('');
                              setShowBindDialog(true);
                            }
                          }}
                        >
                          {isBound ? t('common.configure') : t('common.install')}
                        </Button>
                        {!isSystem && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => openEditDialog(tool)}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                setSelectedTool(tool);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {filteredTools.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Wrench className="w-8 h-8 text-primary/50" />
            </div>
            <h3 className="text-base font-semibold mb-1">{t('toolRegistry.noCustomTools')}</h3>
            <p className="text-sm text-muted-foreground max-w-xs">{t('toolRegistry.noCustomToolsDesc')}</p>
            <Button
              size="sm"
              className="mt-4 rounded-lg gap-1.5"
              onClick={() => {
                setFormData(emptyForm);
                setFormErrors({});
                setShowCreateDialog(true);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              {t('toolRegistry.createFirstTool')}
            </Button>
          </motion.div>
        )}
      </div>

      {/* ===== Create Tool Dialog ===== */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('toolRegistry.createTitle')}</DialogTitle>
            <DialogDescription>{t('toolRegistry.createTitleDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="tool-name" className="text-xs font-medium">{t('toolRegistry.nameLabel')}</Label>
              <Input
                id="tool-name"
                placeholder="my-tool-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={cn(formErrors.name && 'border-destructive')}
              />
              {formErrors.name && <p className="text-[11px] text-destructive">{formErrors.name}</p>}
            </div>
            {/* Display Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="tool-displayName" className="text-xs font-medium">{t('toolRegistry.displayNameLabel')}</Label>
              <Input
                id="tool-displayName"
                placeholder="My Tool Name"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className={cn(formErrors.displayName && 'border-destructive')}
              />
              {formErrors.displayName && <p className="text-[11px] text-destructive">{formErrors.displayName}</p>}
            </div>
            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="tool-description" className="text-xs font-medium">{t('toolRegistry.descriptionLabel')}</Label>
              <Textarea
                id="tool-description"
                placeholder="What does this tool do?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={cn('min-h-[60px]', formErrors.description && 'border-destructive')}
              />
              {formErrors.description && <p className="text-[11px] text-destructive">{formErrors.description}</p>}
            </div>
            {/* Category + Handler Type row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">{t('toolRegistry.category')}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter((c) => c.id !== 'all').map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">{t('toolRegistry.handlerType')}</Label>
                <Select
                  value={formData.handlerType}
                  onValueChange={(val) => setFormData({ ...formData, handlerType: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {handlerTypes.map((ht) => (
                      <SelectItem key={ht.id} value={ht.id}>{ht.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Parameters (JSON) */}
            <div className="grid gap-1.5">
              <Label htmlFor="tool-parameters" className="text-xs font-medium">{t('toolRegistry.parametersSchema')}</Label>
              <Textarea
                id="tool-parameters"
                placeholder='{"type": "object", "properties": {}}'
                value={formData.parameters}
                onChange={(e) => setFormData({ ...formData, parameters: e.target.value })}
                className={cn('min-h-[100px] font-mono text-xs', formErrors.parameters && 'border-destructive')}
              />
              {formErrors.parameters && <p className="text-[11px] text-destructive">{formErrors.parameters}</p>}
            </div>
            {/* Handler Config (JSON) */}
            <div className="grid gap-1.5">
              <Label htmlFor="tool-handlerConfig" className="text-xs font-medium">{t('toolRegistry.handlerConfig')}</Label>
              <Textarea
                id="tool-handlerConfig"
                placeholder="{}"
                value={formData.handlerConfig}
                onChange={(e) => setFormData({ ...formData, handlerConfig: e.target.value })}
                className={cn('min-h-[60px] font-mono text-xs', formErrors.handlerConfig && 'border-destructive')}
              />
              {formErrors.handlerConfig && <p className="text-[11px] text-destructive">{formErrors.handlerConfig}</p>}
            </div>
            {/* Is Public */}
            <div className="flex items-center gap-3">
              <Switch
                id="tool-isPublic"
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
              />
              <Label htmlFor="tool-isPublic" className="text-xs font-medium">{t('toolRegistry.public')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateTool} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {isSubmitting ? t('toolRegistry.creating') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Edit Tool Dialog ===== */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('toolRegistry.editTitle')}</DialogTitle>
            <DialogDescription>{t('toolRegistry.editTitleDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Name (read-only) */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium">{t('toolRegistry.nameLabel')}</Label>
              <Input value={formData.name} disabled className="bg-muted/50" />
            </div>
            {/* Display Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="edit-displayName" className="text-xs font-medium">{t('toolRegistry.displayNameLabel')}</Label>
              <Input
                id="edit-displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className={cn(formErrors.displayName && 'border-destructive')}
              />
              {formErrors.displayName && <p className="text-[11px] text-destructive">{formErrors.displayName}</p>}
            </div>
            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="edit-description" className="text-xs font-medium">{t('toolRegistry.descriptionLabel')}</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={cn('min-h-[60px]', formErrors.description && 'border-destructive')}
              />
              {formErrors.description && <p className="text-[11px] text-destructive">{formErrors.description}</p>}
            </div>
            {/* Category + Handler Type row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">{t('toolRegistry.category')}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter((c) => c.id !== 'all').map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">{t('toolRegistry.handlerType')}</Label>
                <Select
                  value={formData.handlerType}
                  onValueChange={(val) => setFormData({ ...formData, handlerType: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {handlerTypes.map((ht) => (
                      <SelectItem key={ht.id} value={ht.id}>{ht.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Parameters (JSON) */}
            <div className="grid gap-1.5">
              <Label htmlFor="edit-parameters" className="text-xs font-medium">{t('toolRegistry.parametersSchema')}</Label>
              <Textarea
                id="edit-parameters"
                value={formData.parameters}
                onChange={(e) => setFormData({ ...formData, parameters: e.target.value })}
                className={cn('min-h-[100px] font-mono text-xs', formErrors.parameters && 'border-destructive')}
              />
              {formErrors.parameters && <p className="text-[11px] text-destructive">{formErrors.parameters}</p>}
            </div>
            {/* Handler Config (JSON) */}
            <div className="grid gap-1.5">
              <Label htmlFor="edit-handlerConfig" className="text-xs font-medium">{t('toolRegistry.handlerConfig')}</Label>
              <Textarea
                id="edit-handlerConfig"
                value={formData.handlerConfig}
                onChange={(e) => setFormData({ ...formData, handlerConfig: e.target.value })}
                className={cn('min-h-[60px] font-mono text-xs', formErrors.handlerConfig && 'border-destructive')}
              />
              {formErrors.handlerConfig && <p className="text-[11px] text-destructive">{formErrors.handlerConfig}</p>}
            </div>
            {/* Is Public */}
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
              />
              <Label className="text-xs font-medium">{t('toolRegistry.public')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUpdateTool} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {isSubmitting ? t('toolRegistry.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Tool Detail Dialog ===== */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedTool && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => {
                    const Icon = getToolIcon(selectedTool.icon, selectedTool.category);
                    return <Icon className="w-5 h-5 text-primary" />;
                  })()}
                  {selectedTool.displayName}
                </DialogTitle>
                <DialogDescription>{selectedTool.description}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">{t('toolRegistry.nameLabel')}</span>
                    <p className="font-mono mt-0.5">{selectedTool.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('toolRegistry.category')}</span>
                    <p className="mt-0.5 capitalize">{selectedTool.category}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('toolRegistry.handlerType')}</span>
                    <p className="mt-0.5 capitalize">{selectedTool.handlerType}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('toolRegistry.public')}</span>
                    <p className="mt-0.5">{selectedTool.isPublic ? '✓' : '✗'}</p>
                  </div>
                </div>
                {/* Agent bindings */}
                <div className="mt-2">
                  <span className="text-xs text-muted-foreground font-medium">
                    {t('toolRegistry.boundAgents')}
                  </span>
                  {(() => {
                    const toolAgents = getToolAgents(selectedTool.id);
                    if (toolAgents.length === 0) {
                      return (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('toolRegistry.noBoundAgents')}
                        </p>
                      );
                    }
                    return (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {toolAgents.map((name) => (
                          <Badge key={name} variant="secondary" className="text-[10px]">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                {/* Parameters */}
                <div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {t('toolRegistry.parametersSchema')}
                  </span>
                  <pre className="mt-1 p-2 bg-muted/50 rounded-md text-[10px] font-mono overflow-x-auto max-h-40 overflow-y-auto">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedTool.parameters), null, 2);
                      } catch {
                        return selectedTool.parameters;
                      }
                    })()}
                  </pre>
                </div>
                {/* Handler Config */}
                <div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {t('toolRegistry.handlerConfig')}
                  </span>
                  <pre className="mt-1 p-2 bg-muted/50 rounded-md text-[10px] font-mono overflow-x-auto max-h-32 overflow-y-auto">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedTool.handlerConfig), null, 2);
                      } catch {
                        return selectedTool.handlerConfig;
                      }
                    })()}
                  </pre>
                </div>
              </div>
              <DialogFooter>
                {selectedTool.userId !== null && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowDetailDialog(false);
                      openEditDialog(selectedTool);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    {t('common.edit')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDetailDialog(false);
                    setSelectedTool(selectedTool);
                    setBindAgentId('');
                    setShowBindDialog(true);
                  }}
                >
                  <Link2 className="w-3.5 h-3.5 mr-1.5" />
                  {t('toolRegistry.bindToAgent')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Bind Tool to Agent Dialog ===== */}
      <Dialog open={showBindDialog} onOpenChange={setShowBindDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('toolRegistry.bindToAgent')}</DialogTitle>
            <DialogDescription>
              {t('toolRegistry.bindToAgentDesc', { name: selectedTool?.displayName || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {agents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('toolRegistry.noAgentsAvailable')}</p>
            ) : (
              <div className="grid gap-3">
                <Select value={bindAgentId} onValueChange={setBindAgentId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('toolRegistry.selectAgent')} />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                        {toolBindings[agent.id]?.includes(selectedTool?.id) && (
                          <span className="ml-2 text-emerald-500 text-[10px]">({t('toolRegistry.alreadyBound')})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Show currently bound agents */}
                {selectedTool && (() => {
                  const boundAgents = Object.entries(toolBindings)
                    .filter(([, toolIds]) => toolIds.includes(selectedTool.id))
                    .map(([agentId]) => agents.find((a: any) => a.id === agentId))
                    .filter(Boolean);
                  if (boundAgents.length === 0) return null;
                  return (
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">{t('toolRegistry.currentlyBound')}</span>
                      {boundAgents.map((agent: any) => (
                        <div key={agent.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-1.5">
                          <span className="text-xs">{agent.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-destructive hover:text-destructive"
                            onClick={() => handleUnbindTool(agent.id, selectedTool.id)}
                          >
                            {t('common.remove')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBindDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleBindTool}
              disabled={!bindAgentId || isBinding}
            >
              {isBinding && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {t('common.install')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Tool Confirm Dialog ===== */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('toolRegistry.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('toolRegistry.deleteDesc', { name: selectedTool?.displayName || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTool}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
