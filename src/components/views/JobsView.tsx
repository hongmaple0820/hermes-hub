'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Clock, Plus, Play, Pause, Trash2, RefreshCw, Loader2,
  Calendar, Zap, MoreHorizontal, Pencil,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Job {
  id: string;
  name: string;
  description?: string;
  schedule: string;
  status: 'enabled' | 'paused' | 'disabled' | 'failed';
  prompt: string;
  agentId?: string;
  modelOverride?: string;
  repeatLimit?: number;
  lastRun?: string;
  nextRun?: string;
  completedCount?: number;
  createdAt: string;
}

const SCHEDULE_PRESETS = [
  { labelKey: 'jobs.everyHour', value: '0 * * * *' },
  { labelKey: 'jobs.everyDay9am', value: '0 9 * * *' },
  { labelKey: 'jobs.everyMonday', value: '0 9 * * 1' },
  { labelKey: 'jobs.everyMonth1st', value: '0 9 1 * *' },
];

const statusConfig: Record<string, { color: string; bgColor: string; dotColor: string; labelKey: string }> = {
  enabled: { color: 'text-emerald-600', bgColor: 'bg-emerald-500/10', dotColor: 'bg-emerald-500', labelKey: 'jobs.enabled' },
  paused: { color: 'text-amber-600', bgColor: 'bg-amber-500/10', dotColor: 'bg-amber-500', labelKey: 'jobs.paused' },
  disabled: { color: 'text-gray-500', bgColor: 'bg-gray-500/10', dotColor: 'bg-gray-400', labelKey: 'jobs.disabled' },
  failed: { color: 'text-red-600', bgColor: 'bg-red-500/10', dotColor: 'bg-red-500', labelKey: 'jobs.failed' },
};

export function JobsView() {
  const { agents } = useAppStore();
  const { t } = useI18n();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    prompt: '',
    schedule: '0 9 * * *',
    agentId: '',
    modelOverride: '',
    repeatLimit: 0,
  });

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const result = await api.getJobs();
      setJobs(result.jobs || []);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.schedule.trim()) {
      toast.error(t('common.required'));
      return;
    }
    setCreating(true);
    try {
      const result = await api.createJob({
        ...form,
        agentId: form.agentId || undefined,
        modelOverride: form.modelOverride || undefined,
        repeatLimit: form.repeatLimit || undefined,
      });
      setJobs([result.job, ...jobs]);
      setShowCreate(false);
      setForm({ name: '', description: '', prompt: '', schedule: '0 9 * * *', agentId: '', modelOverride: '', repeatLimit: 0 });
      toast.success(t('jobs.created'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handlePause = async (id: string) => {
    setActionLoading(id);
    try {
      await api.pauseJob(id);
      setJobs(jobs.map((j) => j.id === id ? { ...j, status: 'paused' as const } : j));
      toast.success(t('jobs.paused'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (id: string) => {
    setActionLoading(id);
    try {
      await api.resumeJob(id);
      setJobs(jobs.map((j) => j.id === id ? { ...j, status: 'enabled' as const } : j));
      toast.success(t('jobs.resumed'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunNow = async (id: string) => {
    setActionLoading(id);
    try {
      await api.runJob(id);
      toast.success(t('jobs.runStarted'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteJob(id);
      setJobs(jobs.filter((j) => j.id !== id));
      toast.success(t('jobs.deleted'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('jobs.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('jobs.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={loadJobs}>
            <RefreshCw className="w-4 h-4" /> {t('common.refresh')}
          </Button>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> {t('jobs.create')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('jobs.createTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>{t('jobs.nameLabel')} *</Label>
                  <Input
                    placeholder={t('jobs.namePlaceholder')}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('jobs.descriptionLabel')}</Label>
                  <Textarea
                    placeholder={t('jobs.descriptionPlaceholder')}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('jobs.promptLabel')} *</Label>
                  <Textarea
                    placeholder={t('jobs.promptPlaceholder')}
                    value={form.prompt}
                    onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('jobs.scheduleLabel')} *</Label>
                  <Input
                    placeholder="0 9 * * *"
                    value={form.schedule}
                    onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                    className="font-mono"
                  />
                  <div className="flex flex-wrap gap-2">
                    {SCHEDULE_PRESETS.map((preset) => (
                      <Button
                        key={preset.value}
                        variant={form.schedule === preset.value ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs"
                        onClick={() => setForm({ ...form, schedule: preset.value })}
                      >
                        {t(preset.labelKey)}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('jobs.agentLabel')}</Label>
                  <Select value={form.agentId} onValueChange={(v) => setForm({ ...form, agentId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('jobs.agentPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.length === 0 ? (
                        <SelectItem value="none" disabled>{t('jobs.noAgents')}</SelectItem>
                      ) : (
                        agents.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('jobs.modelOverride')}</Label>
                    <Input
                      placeholder={t('jobs.modelOverridePlaceholder')}
                      value={form.modelOverride}
                      onChange={(e) => setForm({ ...form, modelOverride: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('jobs.repeatLimit')}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.repeatLimit}
                      onChange={(e) => setForm({ ...form, repeatLimit: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <Button onClick={handleCreate} className="w-full" disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {creating ? t('jobs.creating') : t('jobs.create')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {jobs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Clock className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('jobs.noJobsTitle')}</h3>
            <p className="text-muted-foreground text-sm mb-4">{t('jobs.noJobsDesc')}</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> {t('jobs.create')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const status = statusConfig[job.status] || statusConfig.disabled;
            return (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', status.bgColor)}>
                        <Clock className={cn('w-5 h-5', status.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{job.name}</h3>
                          <Badge variant="outline" className={cn('text-[10px] shrink-0', status.color)}>
                            <span className={cn('w-1.5 h-1.5 rounded-full mr-1', status.dotColor)} />
                            {t(status.labelKey)}
                          </Badge>
                        </div>
                        {job.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{job.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="font-mono flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {job.schedule}
                          </span>
                          {job.lastRun && (
                            <span>{t('jobs.lastRun')}: {new Date(job.lastRun).toLocaleString()}</span>
                          )}
                          {job.nextRun && (
                            <span>{t('jobs.nextRun')}: {new Date(job.nextRun).toLocaleString()}</span>
                          )}
                          {job.completedCount !== undefined && (
                            <span>{t('jobs.completedCount', { count: job.completedCount })}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8"
                        onClick={() => handleRunNow(job.id)}
                        disabled={actionLoading === job.id}
                        title={t('jobs.runNow')}
                      >
                        {actionLoading === job.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      {job.status === 'enabled' ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8"
                          onClick={() => handlePause(job.id)}
                          title={t('jobs.pause')}
                        >
                          <Pause className="w-4 h-4" />
                        </Button>
                      ) : job.status === 'paused' ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8"
                          onClick={() => handleResume(job.id)}
                          title={t('jobs.resume')}
                        >
                          <Play className="w-4 h-4 text-emerald-500" />
                        </Button>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-8 h-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Pencil className="w-4 h-4 mr-2" /> {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(job.id)}>
                            <Trash2 className="w-4 h-4 mr-2" /> {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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
