'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  UserCircle, Plus, Trash2, RefreshCw, Loader2, Download, Upload,
  ArrowRightLeft, Pencil, Check, FileText, FileCode, MoreHorizontal,
  Copy, Eye, GitCompare, Sparkles, Users, UserCheck, UserX, FolderOpen,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  name: string;
  description?: string;
  model?: string;
  gatewayUrl?: string;
  skillCount?: number;
  envStatus?: 'ok' | 'missing' | 'partial';
  soulMdStatus?: 'ok' | 'missing' | 'partial';
  path?: string;
  provider?: string;
  isActive?: boolean;
  createdAt: string;
  systemPromptOverride?: string;
  agentAssignments?: string[];
}

export function ProfilesView() {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewProfile, setPreviewProfile] = useState<Profile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Profile comparison
  const [showCompare, setShowCompare] = useState(false);
  const [compareId1, setCompareId1] = useState('');
  const [compareId2, setCompareId2] = useState('');

  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    cloneFrom: '',
    systemPromptOverride: '',
    agentAssignments: '',
  });

  const [importText, setImportText] = useState('');

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const result = await api.getProfiles();
      const profileList = result.profiles || [];
      setProfiles(profileList);
      const active = profileList.find((p: Profile) => p.isActive);
      if (active) setActiveProfileId(active.id);
    } catch {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error(t('common.required'));
      return;
    }
    setCreating(true);
    try {
      const result = await api.createProfile({
        name: createForm.name,
        description: createForm.description,
        cloneFrom: createForm.cloneFrom || undefined,
      });
      setProfiles([result.profile, ...profiles]);
      setShowCreate(false);
      setCreateForm({ name: '', description: '', cloneFrom: '', systemPromptOverride: '', agentAssignments: '' });
      toast.success(t('profiles.created'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSwitch = async (id: string) => {
    try {
      await api.switchProfile(id);
      setProfiles(profiles.map((p) => ({ ...p, isActive: p.id === id })));
      setActiveProfileId(id);
      toast.success(t('profiles.switched'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      // Switch to a different profile first if this one is active
      const otherProfile = profiles.find(p => p.id !== id);
      if (otherProfile) {
        await api.switchProfile(otherProfile.id);
        setProfiles(profiles.map((p) => ({
          ...p,
          isActive: p.id === otherProfile.id,
        })));
        setActiveProfileId(otherProfile.id);
      }
      toast.success(t('profiles.deactivated'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleExport = async (id: string) => {
    try {
      const result = await api.exportProfile(id);
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `profile-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('profiles.exported'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDuplicate = async (profile: Profile) => {
    try {
      const result = await api.createProfile({
        name: `${profile.name} (${t('profiles.copy')})`,
        description: profile.description,
        cloneFrom: profile.id,
      });
      setProfiles([result.profile, ...profiles]);
      toast.success(t('profiles.duplicated'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      toast.error(t('common.required'));
      return;
    }
    setImporting(true);
    try {
      const data = JSON.parse(importText);
      await api.importProfile(data);
      toast.success(t('profiles.imported'));
      setShowImport(false);
      setImportText('');
      await loadProfiles();
    } catch (error: any) {
      toast.error(error.message || t('profiles.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.deleteProfile(deleteId);
      setProfiles(profiles.filter((p) => p.id !== deleteId));
      setDeleteId(null);
      toast.success(t('profiles.deleted'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const statusBadge = (status?: 'ok' | 'missing' | 'partial') => {
    if (!status) return null;
    const config: Record<string, { color: string; label: string }> = {
      ok: { color: 'text-emerald-600 bg-emerald-500/10', label: '✓' },
      missing: { color: 'text-red-500 bg-red-500/10', label: '✗' },
      partial: { color: 'text-amber-500 bg-amber-500/10', label: '∼' },
    };
    const c = config[status] || config.missing;
    return (
      <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold', c.color)}>
        {c.label}
      </span>
    );
  };

  // Comparison logic
  const comparisonData = useMemo(() => {
    if (!compareId1 || !compareId2) return null;
    const p1 = profiles.find(p => p.id === compareId1);
    const p2 = profiles.find(p => p.id === compareId2);
    if (!p1 || !p2) return null;
    return { p1, p2 };
  }, [compareId1, compareId2, profiles]);

  // Filter profiles
  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return profiles;
    const q = searchQuery.toLowerCase();
    return profiles.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.model && p.model.toLowerCase().includes(q))
    );
  }, [profiles, searchQuery]);

  // Profile stats
  const profileStats = useMemo(() => ({
    total: profiles.length,
    active: profiles.filter(p => p.isActive).length,
    withModel: profiles.filter(p => p.model).length,
    withEnv: profiles.filter(p => p.envStatus === 'ok').length,
  }), [profiles]);

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
          <h1 className="text-2xl font-bold">{t('profiles.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('profiles.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              placeholder={t('profiles.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 h-9 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={loadProfiles}>
            <RefreshCw className="w-4 h-4" /> {t('common.refresh')}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowCompare(true)} disabled={profiles.length < 2}>
            <GitCompare className="w-4 h-4" /> {t('profiles.compare')}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4" /> {t('profiles.importProfile')}
          </Button>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> {t('profiles.create')}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" /> {t('profiles.createTitle')}
                </DialogTitle>
                <DialogDescription>{t('profiles.createDesc')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>{t('profiles.nameLabel')} *</Label>
                  <Input
                    placeholder={t('profiles.namePlaceholder')}
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('profiles.descriptionLabel')}</Label>
                  <Textarea
                    placeholder={t('profiles.descriptionPlaceholder')}
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('profiles.systemPromptOverride')}</Label>
                  <Textarea
                    placeholder={t('profiles.systemPromptOverridePlaceholder')}
                    value={createForm.systemPromptOverride}
                    onChange={(e) => setCreateForm({ ...createForm, systemPromptOverride: e.target.value })}
                    rows={3}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('profiles.agentAssignments')}</Label>
                  <Input
                    placeholder={t('profiles.agentAssignmentsPlaceholder')}
                    value={createForm.agentAssignments}
                    onChange={(e) => setCreateForm({ ...createForm, agentAssignments: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">{t('profiles.agentAssignmentsHint')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('profiles.cloneFrom')}</Label>
                  <Select value={createForm.cloneFrom} onValueChange={(v) => setCreateForm({ ...createForm, cloneFrom: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('profiles.cloneFromPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('profiles.noClone')}</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreate} className="w-full" disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {creating ? t('profiles.creating') : t('profiles.create')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Header */}
      {profiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-cyan-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('profiles.totalProfiles')}</p>
                <p className="text-lg font-bold">{profileStats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <UserCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('profiles.activeProfile')}</p>
                <p className="text-lg font-bold">{profileStats.active}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <FolderOpen className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('profiles.withModel')}</p>
                <p className="text-lg font-bold">{profileStats.withModel}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-rose-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('profiles.envConfigured')}</p>
                <p className="text-lg font-bold">{profileStats.withEnv}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profiles.importProfile')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t('profiles.importPaste')}</Label>
              <Textarea
                placeholder={t('profiles.importPastePlaceholder')}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('profiles.importFile')}</Label>
              <Input
                type="file"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setImportText(ev.target?.result as string || '');
                    };
                    reader.readAsText(file);
                  }
                }}
              />
            </div>
            <Button onClick={handleImport} className="w-full" disabled={importing}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              {importing ? t('profiles.importing') : t('profiles.importProfile')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compare Dialog */}
      <Dialog open={showCompare} onOpenChange={setShowCompare}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('profiles.compareProfiles')}</DialogTitle>
            <DialogDescription>{t('profiles.compareDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('profiles.profileA')}</Label>
                <Select value={compareId1} onValueChange={setCompareId1}>
                  <SelectTrigger><SelectValue placeholder={t('profiles.selectProfile')} /></SelectTrigger>
                  <SelectContent>
                    {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('profiles.profileB')}</Label>
                <Select value={compareId2} onValueChange={setCompareId2}>
                  <SelectTrigger><SelectValue placeholder={t('profiles.selectProfile')} /></SelectTrigger>
                  <SelectContent>
                    {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {comparisonData && (
              <ScrollArea className="max-h-80">
                <div className="space-y-3">
                  {([
                    ['name', t('common.name')],
                    ['description', t('common.description')],
                    ['model', t('profiles.model')],
                    ['provider', t('providers.title')],
                    ['gatewayUrl', t('profiles.gatewayUrl')],
                    ['skillCount', t('profiles.skillCount')],
                    ['isActive', t('profiles.active')],
                  ] as const).map(([key, label]) => {
                    const v1 = (comparisonData.p1 as any)[key];
                    const v2 = (comparisonData.p2 as any)[key];
                    const diff = v1 !== v2;
                    return (
                      <div key={key} className={cn('grid grid-cols-3 gap-2 p-2 rounded text-sm', diff && 'bg-amber-500/5')}>
                        <span className="font-medium text-muted-foreground">{label}</span>
                        <span className={cn('truncate', diff && 'text-amber-600 font-medium')}>
                          {v1?.toString() || '—'}
                        </span>
                        <span className={cn('truncate', diff && 'text-amber-600 font-medium')}>
                          {v2?.toString() || '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewProfile} onOpenChange={(open) => { if (!open) setPreviewProfile(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5" />
              {previewProfile?.name}
              {previewProfile?.isActive && <Badge className="text-[10px] bg-primary text-primary-foreground">{t('profiles.active')}</Badge>}
            </DialogTitle>
            <DialogDescription>{previewProfile?.description || t('profiles.noDescription')}</DialogDescription>
          </DialogHeader>
          {previewProfile && (
            <div className="space-y-3 mt-2">
              {previewProfile.model && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('profiles.model')}</span>
                  <span className="font-mono text-xs">{previewProfile.model}</span>
                </div>
              )}
              {previewProfile.provider && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('providers.title')}</span>
                  <Badge variant="outline" className="text-[10px]">{previewProfile.provider}</Badge>
                </div>
              )}
              {previewProfile.gatewayUrl && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('profiles.gatewayUrl')}</span>
                  <span className="font-mono text-xs truncate max-w-[200px]">{previewProfile.gatewayUrl}</span>
                </div>
              )}
              {previewProfile.skillCount !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('profiles.skillCount')}</span>
                  <Badge variant="outline" className="text-[10px]">{previewProfile.skillCount}</Badge>
                </div>
              )}
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">{t('profiles.status')}</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> .env {statusBadge(previewProfile.envStatus)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileCode className="w-3 h-3" /> soul.md {statusBadge(previewProfile.soulMdStatus)}
                  </div>
                </div>
              </div>
              {previewProfile.systemPromptOverride && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">{t('profiles.systemPromptOverride')}</p>
                  <p className="text-xs font-mono bg-muted p-2 rounded max-h-24 overflow-y-auto">{previewProfile.systemPromptOverride}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('profiles.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('profiles.deleteConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {profiles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-rose-500/20 to-amber-500/20 flex items-center justify-center">
                <UserCircle className="w-12 h-12 text-rose-400" />
              </div>
              <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center animate-pulse">
                <Sparkles className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Plus className="w-4 h-4 text-amber-500" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('profiles.noProfilesTitle')}</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm text-center">{t('profiles.noProfilesDesc')}</p>
            <div className="flex gap-3">
              <Button onClick={() => setShowCreate(true)} className="gap-2">
                <Plus className="w-4 h-4" /> {t('profiles.create')}
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setShowImport(true)}>
                <Upload className="w-4 h-4" /> {t('profiles.importProfile')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProfiles.map((profile) => (
            <Card
              key={profile.id}
              className={cn(
                'hover:shadow-md transition-all group',
                profile.isActive && 'border-primary shadow-sm'
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                      profile.isActive ? 'bg-primary/10' : 'bg-muted'
                    )}>
                      <UserCircle className={cn('w-5 h-5', profile.isActive ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {profile.name}
                        {profile.isActive && (
                          <Badge className="text-[10px] bg-primary text-primary-foreground">
                            {t('profiles.active')}
                          </Badge>
                        )}
                      </CardTitle>
                      {profile.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{profile.description}</p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setPreviewProfile(profile)}>
                        <Eye className="w-4 h-4 mr-2" /> {t('profiles.preview')}
                      </DropdownMenuItem>
                      {!profile.isActive && (
                        <DropdownMenuItem onClick={() => handleSwitch(profile.id)}>
                          <ArrowRightLeft className="w-4 h-4 mr-2" /> {t('profiles.switchTo')}
                        </DropdownMenuItem>
                      )}
                      {profile.isActive && (
                        <DropdownMenuItem onClick={() => handleDeactivate(profile.id)}>
                          <UserX className="w-4 h-4 mr-2" /> {t('profiles.deactivate')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDuplicate(profile)}>
                        <Copy className="w-4 h-4 mr-2" /> {t('profiles.duplicate')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport(profile.id)}>
                        <Download className="w-4 h-4 mr-2" /> {t('profiles.exportJson')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(profile.id)}>
                        <Trash2 className="w-4 h-4 mr-2" /> {t('common.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Toggle active/inactive */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('profiles.activeStatus')}</span>
                  <Switch
                    checked={profile.isActive}
                    onCheckedChange={(checked) => {
                      if (checked) handleSwitch(profile.id);
                      else handleDeactivate(profile.id);
                    }}
                  />
                </div>

                <div className="space-y-2 text-sm">
                  {profile.model && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('profiles.model')}</span>
                      <span className="font-mono text-xs">{profile.model}</span>
                    </div>
                  )}
                  {profile.gatewayUrl && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('profiles.gatewayUrl')}</span>
                      <span className="font-mono text-xs truncate max-w-[150px]">{profile.gatewayUrl}</span>
                    </div>
                  )}
                  {profile.skillCount !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('profiles.skillCount')}</span>
                      <Badge variant="outline" className="text-[10px]">{profile.skillCount}</Badge>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <FileText className="w-3 h-3" /> .env
                    </span>
                    {statusBadge(profile.envStatus)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <FileCode className="w-3 h-3" /> soul.md
                    </span>
                    {statusBadge(profile.soulMdStatus)}
                  </div>
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  {!profile.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => handleSwitch(profile.id)}
                    >
                      <ArrowRightLeft className="w-4 h-4" /> {t('profiles.switchTo')}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleDuplicate(profile)}
                  >
                    <Copy className="w-4 h-4" /> {t('profiles.duplicate')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleExport(profile.id)}
                  >
                    <Download className="w-4 h-4" /> JSON
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
