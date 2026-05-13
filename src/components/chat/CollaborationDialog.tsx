'use client';

import { useState, useMemo } from 'react';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowRight,
  Radio,
  GitBranch,
  RefreshCw,
  ThumbsUp,
  Bot,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CollabType = 'delegate' | 'broadcast' | 'pipeline' | 'round-robin' | 'consensus';

interface CollabTypeInfo {
  key: CollabType;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  minAgents: number;
  descriptionKey: string;
  nameKey: string;
}

const COLLAB_TYPES: CollabTypeInfo[] = [
  {
    key: 'delegate',
    icon: <ArrowRight className="w-5 h-5" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    minAgents: 1,
    nameKey: 'collaboration.typeDelegate',
    descriptionKey: 'collaboration.descDelegate',
  },
  {
    key: 'broadcast',
    icon: <Radio className="w-5 h-5" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    minAgents: 1,
    nameKey: 'collaboration.typeBroadcast',
    descriptionKey: 'collaboration.descBroadcast',
  },
  {
    key: 'pipeline',
    icon: <GitBranch className="w-5 h-5" />,
    color: 'text-violet-600',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
    minAgents: 2,
    nameKey: 'collaboration.typePipeline',
    descriptionKey: 'collaboration.descPipeline',
  },
  {
    key: 'round-robin',
    icon: <RefreshCw className="w-5 h-5" />,
    color: 'text-sky-600',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/30',
    minAgents: 2,
    nameKey: 'collaboration.typeRoundRobin',
    descriptionKey: 'collaboration.descRoundRobin',
  },
  {
    key: 'consensus',
    icon: <ThumbsUp className="w-5 h-5" />,
    color: 'text-rose-600',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    minAgents: 2,
    nameKey: 'collaboration.typeConsensus',
    descriptionKey: 'collaboration.descConsensus',
  },
];

// Agent color palette for visual assignment
const AGENT_COLORS = [
  { bg: 'bg-emerald-500/15', text: 'text-emerald-700', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-500/15', text: 'text-amber-700', border: 'border-amber-500/30', dot: 'bg-amber-500' },
  { bg: 'bg-violet-500/15', text: 'text-violet-700', border: 'border-violet-500/30', dot: 'bg-violet-500' },
  { bg: 'bg-sky-500/15', text: 'text-sky-700', border: 'border-sky-500/30', dot: 'bg-sky-500' },
  { bg: 'bg-rose-500/15', text: 'text-rose-700', border: 'border-rose-500/30', dot: 'bg-rose-500' },
  { bg: 'bg-orange-500/15', text: 'text-orange-700', border: 'border-orange-500/30', dot: 'bg-orange-500' },
];

// ---------------------------------------------------------------------------
// Component Props
// ---------------------------------------------------------------------------

interface CollaborationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomAgents: any[];
  roomId: string;
  onCollaborationComplete?: (result: any) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CollaborationDialog({
  open,
  onOpenChange,
  roomAgents,
  roomId,
  onCollaborationComplete,
}: CollaborationDialogProps) {
  const { t } = useI18n();
  const { agents } = useAppStore();
  const [selectedType, setSelectedType] = useState<CollabType>('broadcast');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [task, setTask] = useState('');
  const [executing, setExecuting] = useState(false);

  const allAgents = useMemo(() => {
    // Merge room agents with global agents, deduplicate by id
    const map = new Map<string, any>();
    for (const a of roomAgents) {
      map.set(a.id, a);
    }
    for (const a of agents) {
      map.set(a.id, a);
    }
    return Array.from(map.values());
  }, [roomAgents, agents]);

  const currentTypeInfo = COLLAB_TYPES.find((ct) => ct.key === selectedType)!;
  const selectedAgents = allAgents.filter((a) => selectedAgentIds.includes(a.id));

  const canExecute =
    task.trim().length > 0 &&
    selectedAgentIds.length >= currentTypeInfo.minAgents;

  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  };

  const handleExecute = async () => {
    if (!canExecute || selectedAgentIds.length === 0) return;

    setExecuting(true);
    try {
      const fromAgentId = selectedAgentIds[0];
      const toAgentIds = selectedAgentIds.slice(1);

      // For delegate, we only need 1 target; for others, all selected
      const result = await api.collaborateAgents({
        type: selectedType,
        fromAgentId,
        toAgentIds: selectedType === 'delegate' ? [toAgentIds[0] || selectedAgentIds[0]] : toAgentIds.length > 0 ? toAgentIds : [fromAgentId],
        task: task.trim(),
        context: { roomId },
        options: {
          parallel: selectedType === 'broadcast',
          rounds: selectedType === 'round-robin' ? 2 : undefined,
          votingStrategy: selectedType === 'consensus' ? 'majority' : undefined,
        },
      });

      toast.success(t('collaboration.started'));
      onCollaborationComplete?.(result);
      onOpenChange(false);
      setTask('');
      setSelectedAgentIds([]);
    } catch (error: any) {
      toast.error(error.message || t('collaboration.failed'));
    } finally {
      setExecuting(false);
    }
  };

  // Build visual flow preview
  const renderFlowPreview = () => {
    if (selectedAgents.length === 0) {
      return (
        <p className="text-xs text-muted-foreground text-center py-4">
          {t('collaboration.selectAgentsToPreview')}
        </p>
      );
    }

    const colors = selectedAgents.map((_, i) => AGENT_COLORS[i % AGENT_COLORS.length]);

    if (selectedType === 'delegate') {
      return (
        <div className="flex items-center justify-center gap-3 py-3">
          <div className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border', colors[0]?.bg, colors[0]?.border, colors[0]?.text)}>
            {selectedAgents[0]?.name || 'Agent 1'}
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          {selectedAgents[1] ? (
            <div className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border', colors[1]?.bg, colors[1]?.border, colors[1]?.text)}>
              {selectedAgents[1].name}
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground border border-dashed border-border">
              {t('collaboration.selectTarget')}
            </div>
          )}
        </div>
      );
    }

    if (selectedType === 'broadcast') {
      return (
        <div className="flex flex-col items-center gap-2 py-3">
          <div className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border', colors[0]?.bg, colors[0]?.border, colors[0]?.text)}>
            {selectedAgents[0]?.name || 'Source'}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Radio className="w-3 h-3" />
            <span className="text-[10px]">{t('collaboration.broadcastsTo')}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {selectedAgents.slice(1).map((a, i) => (
              <div key={a.id} className={cn('px-3 py-1 rounded-lg text-xs font-medium border', colors[(i + 1) % AGENT_COLORS.length]?.bg, colors[(i + 1) % AGENT_COLORS.length]?.border, colors[(i + 1) % AGENT_COLORS.length]?.text)}>
                {a.name}
              </div>
            ))}
            {selectedAgents.length <= 1 && (
              <div className="px-3 py-1 rounded-lg text-xs text-muted-foreground border border-dashed border-border">
                {t('collaboration.addMoreAgents')}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (selectedType === 'pipeline') {
      return (
        <div className="flex items-center justify-center gap-1 py-3 flex-wrap">
          {selectedAgents.map((a, i) => (
            <div key={a.id} className="flex items-center gap-1">
              <div className={cn('px-2 py-1 rounded-lg text-xs font-medium border', colors[i % AGENT_COLORS.length]?.bg, colors[i % AGENT_COLORS.length]?.border, colors[i % AGENT_COLORS.length]?.text)}>
                {a.name}
              </div>
              {i < selectedAgents.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </div>
          ))}
        </div>
      );
    }

    if (selectedType === 'round-robin') {
      return (
        <div className="flex items-center justify-center gap-2 py-3 flex-wrap">
          <RefreshCw className="w-4 h-4 text-muted-foreground shrink-0" />
          {selectedAgents.map((a, i) => (
            <div key={a.id} className={cn('px-2 py-1 rounded-lg text-xs font-medium border', colors[i % AGENT_COLORS.length]?.bg, colors[i % AGENT_COLORS.length]?.border, colors[i % AGENT_COLORS.length]?.text)}>
              {a.name}
            </div>
          ))}
        </div>
      );
    }

    if (selectedType === 'consensus') {
      return (
        <div className="flex flex-col items-center gap-2 py-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {selectedAgents.map((a, i) => (
              <div key={a.id} className={cn('px-2 py-1 rounded-lg text-xs font-medium border', colors[i % AGENT_COLORS.length]?.bg, colors[i % AGENT_COLORS.length]?.border, colors[i % AGENT_COLORS.length]?.text)}>
                {a.name}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <ThumbsUp className="w-3 h-3" />
            <span className="text-[10px]">{t('collaboration.voteAndDecide')}</span>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] w-[calc(100%-2rem)] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <GitBranch className="w-4 h-4 text-primary" />
            </span>
            {t('collaboration.title')}
          </DialogTitle>
          <DialogDescription>{t('collaboration.description')}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-2">
            {/* Step 1: Collaboration Type */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('collaboration.chooseType')}</p>
              <div className="grid grid-cols-1 gap-2">
                {COLLAB_TYPES.map((ct) => (
                  <button
                    key={ct.key}
                    onClick={() => setSelectedType(ct.key)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                      selectedType === ct.key
                        ? `${ct.borderColor} ${ct.bgColor} shadow-sm`
                        : 'border-border hover:bg-accent/50'
                    )}
                  >
                    <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg', ct.bgColor, ct.color)}>
                      {ct.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', selectedType === ct.key ? ct.color : '')}>
                        {t(ct.nameKey)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {t(ct.descriptionKey)}
                      </p>
                    </div>
                    {selectedType === ct.key && (
                      <div className={cn('w-2 h-2 rounded-full', ct.dot || 'bg-primary')} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Agent Selection */}
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {t('collaboration.selectAgents')}
                <span className="text-muted-foreground font-normal ml-1">
                  ({t('collaboration.minRequired', { count: currentTypeInfo.minAgents })})
                </span>
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                {allAgents.map((agent, i) => {
                  const isSelected = selectedAgentIds.includes(agent.id);
                  const color = AGENT_COLORS[selectedAgentIds.indexOf(agent.id) >= 0 ? selectedAgentIds.indexOf(agent.id) : i % AGENT_COLORS.length];
                  return (
                    <button
                      key={agent.id}
                      onClick={() => toggleAgent(agent.id)}
                      className={cn(
                        'flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left',
                        isSelected
                          ? `${color?.bg} ${color?.border} shadow-sm`
                          : 'border-border hover:bg-accent/50'
                      )}
                    >
                      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0', isSelected ? color?.bg : 'bg-primary/10')}>
                        <Bot className={cn('w-3.5 h-3.5', isSelected ? color?.text : 'text-primary')} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{agent.name}</p>
                        <div className="flex items-center gap-1.5">
                          <span className={cn('w-1.5 h-1.5 rounded-full', agent.status === 'online' ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                          <span className="text-[10px] text-muted-foreground">
                            {agent.status === 'online' ? t('common.online') : t('common.offline')}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 shrink-0', color?.text)}>
                          #{selectedAgentIds.indexOf(agent.id) + 1}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
              {allAgents.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">{t('collaboration.noAgentsAvailable')}</p>
              )}
            </div>

            {/* Step 3: Flow Preview */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('collaboration.flowPreview')}</p>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                {renderFlowPreview()}
              </div>
            </div>

            {/* Step 4: Task Input */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('collaboration.taskPrompt')}</p>
              <Textarea
                placeholder={t('collaboration.taskPlaceholder')}
                value={task}
                onChange={(e) => setTask(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleExecute}
            disabled={!canExecute || executing}
            className="gap-2"
          >
            {executing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('collaboration.executing')}
              </>
            ) : (
              <>
                <GitBranch className="w-4 h-4" />
                {t('collaboration.startCollaboration')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
