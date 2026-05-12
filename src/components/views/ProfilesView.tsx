'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
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
  UserCircle, Plus, Trash2, RefreshCw, Loader2, Download, Upload,
  ArrowRightLeft, Pencil, Check, FileText, FileCode, MoreHorizontal,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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

  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    cloneFrom: '',
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
      setCreateForm({ name: '', description: '', cloneFrom: '' });
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

  const handleDelete = async (id: string) => {
    try {
      await api.deleteProfile(id);
      setProfiles(profiles.filter((p) => p.id !== id));
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
          <Button variant="outline" size="sm" className="gap-2" onClick={loadProfiles}>
            <RefreshCw className="w-4 h-4" /> {t('common.refresh')}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4" /> {t('profiles.importProfile')}
          </Button>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> {t('profiles.create')}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('profiles.createTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
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

      {profiles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <UserCircle className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('profiles.noProfilesTitle')}</h3>
            <p className="text-muted-foreground text-sm mb-4">{t('profiles.noProfilesDesc')}</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> {t('profiles.create')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((profile) => (
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
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!profile.isActive && (
                        <DropdownMenuItem onClick={() => handleSwitch(profile.id)}>
                          <ArrowRightLeft className="w-4 h-4 mr-2" /> {t('profiles.switchTo')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem>
                        <Pencil className="w-4 h-4 mr-2" /> {t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport(profile.id)}>
                        <Download className="w-4 h-4 mr-2" /> {t('profiles.export')}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(profile.id)}>
                        <Trash2 className="w-4 h-4 mr-2" /> {t('common.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{profile.description}</p>
                )}
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
                {!profile.isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 mt-2"
                    onClick={() => handleSwitch(profile.id)}
                  >
                    <ArrowRightLeft className="w-4 h-4" /> {t('profiles.switchTo')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
