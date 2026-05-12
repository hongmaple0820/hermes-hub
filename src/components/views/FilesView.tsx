'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Folder, File, FileText, Upload, Plus, RefreshCw, Loader2, Trash2,
  Pencil, ChevronRight, Download, FolderPlus,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  extension?: string;
}

const BACKEND_OPTIONS = [
  { key: 'local', labelKey: 'files.backendLocal' },
  { key: 'docker', labelKey: 'files.backendDocker' },
  { key: 'ssh', labelKey: 'files.backendSsh' },
  { key: 'singularity', labelKey: 'files.backendSingularity' },
];

function formatSize(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['md', 'txt', 'json', 'yaml', 'yml', 'toml', 'env', 'cfg', 'ini'].includes(ext || '')) {
    return FileText;
  }
  return File;
}

export function FilesView() {
  const { t } = useI18n();
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [backend, setBackend] = useState('local');
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState<{ oldPath: string; newName: string } | null>(null);

  useEffect(() => {
    loadFiles();
  }, [currentPath, backend]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const result = await api.listFiles(currentPath !== '/' ? currentPath : undefined);
      setFiles(result.files || []);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    setEditingFile(null);
  };

  const pathSegments = currentPath.split('/').filter(Boolean);

  const handleOpenFile = async (file: FileEntry) => {
    if (file.type === 'directory') {
      handleNavigate(file.path);
      return;
    }
    try {
      const result = await api.readFile(file.path);
      setEditingFile({ path: file.path, content: result.content || '' });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    setSaving(true);
    try {
      await api.writeFile(editingFile.path, editingFile.content);
      toast.success(t('files.saved'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFile = async () => {
    if (!newItemName.trim()) {
      toast.error(t('common.required'));
      return;
    }
    const fullPath = currentPath === '/' ? `/${newItemName}` : `${currentPath}/${newItemName}`;
    try {
      if (showNewFolder) {
        await api.mkdir(fullPath);
      } else {
        await api.writeFile(fullPath, '');
      }
      toast.success(t('files.created'));
      setShowNewFile(false);
      setShowNewFolder(false);
      setNewItemName('');
      await loadFiles();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (file: FileEntry) => {
    try {
      await api.deleteFile(file.path, file.type === 'directory');
      toast.success(t('files.deleted'));
      await loadFiles();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleRename = async () => {
    if (!renaming || !renaming.newName.trim()) {
      toast.error(t('common.required'));
      return;
    }
    const dir = renaming.oldPath.substring(0, renaming.oldPath.lastIndexOf('/'));
    const newPath = dir ? `${dir}/${renaming.newName}` : `/${renaming.newName}`;
    try {
      await api.renameFile(renaming.oldPath, newPath);
      toast.success(t('files.renamed'));
      setRenaming(null);
      await loadFiles();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', currentPath);
      await api.uploadFile(formData);
      toast.success(t('files.uploaded'));
      setShowUpload(false);
      await loadFiles();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('files.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('files.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={backend} onValueChange={setBackend}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BACKEND_OPTIONS.map((opt) => (
                <SelectItem key={opt.key} value={opt.key}>{t(opt.labelKey)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadFiles} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="mb-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                className="cursor-pointer"
                onClick={() => handleNavigate('/')}
              >
                /
              </BreadcrumbLink>
            </BreadcrumbItem>
            {pathSegments.map((segment, i) => {
              const path = '/' + pathSegments.slice(0, i + 1).join('/');
              const isLast = i === pathSegments.length - 1;
              return (
                <span key={path} className="flex items-center gap-1.5">
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <span className="font-medium">{segment}</span>
                    ) : (
                      <BreadcrumbLink className="cursor-pointer" onClick={() => handleNavigate(path)}>
                        {segment}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => { setShowUpload(true); }}>
          <Upload className="w-4 h-4" /> {t('files.upload')}
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => { setShowNewFile(true); setNewItemName(''); }}>
          <Plus className="w-4 h-4" /> {t('files.newFile')}
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => { setShowNewFolder(true); setNewItemName(''); }}>
          <FolderPlus className="w-4 h-4" /> {t('files.newFolder')}
        </Button>
      </div>

      {/* File Editor Modal */}
      <Dialog open={!!editingFile} onOpenChange={(v) => { if (!v) setEditingFile(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" /> {editingFile?.path}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={editingFile?.content || ''}
            onChange={(e) => setEditingFile(editingFile ? { ...editingFile, content: e.target.value } : null)}
            rows={20}
            className="font-mono text-sm resize-y"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingFile(null)}>
              {t('common.close')}
            </Button>
            <Button onClick={handleSaveFile} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New File/Folder Dialog */}
      <Dialog open={showNewFile || showNewFolder} onOpenChange={(v) => { if (!v) { setShowNewFile(false); setShowNewFolder(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{showNewFolder ? t('files.newFolder') : t('files.newFile')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{showNewFolder ? t('files.folderName') : t('files.fileName')}</Label>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={showNewFolder ? t('files.folderNamePlaceholder') : t('files.fileNamePlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
              />
            </div>
            <Button onClick={handleCreateFile} className="w-full">
              {t('common.create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('files.upload')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input type="file" onChange={handleUpload} />
            <p className="text-xs text-muted-foreground">{t('files.uploadHint')}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renaming} onOpenChange={(v) => { if (!v) setRenaming(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('files.rename')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t('files.newName')}</Label>
              <Input
                value={renaming?.newName || ''}
                onChange={(e) => renaming && setRenaming({ ...renaming, newName: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              />
            </div>
            <Button onClick={handleRename} className="w-full">{t('common.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* File List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Folder className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('files.emptyFolder')}</h3>
            <p className="text-muted-foreground text-sm">{t('files.emptyFolderDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('files.name')}</TableHead>
                <TableHead className="w-[100px]">{t('files.size')}</TableHead>
                <TableHead className="w-[100px]">{t('files.type')}</TableHead>
                <TableHead className="w-[180px]">{t('files.modified')}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => {
                const Icon = file.type === 'directory' ? Folder : getFileIcon(file.name);
                return (
                  <TableRow
                    key={file.path}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => handleOpenFile(file)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className={cn(
                          'w-4 h-4 shrink-0',
                          file.type === 'directory' ? 'text-amber-500' : 'text-muted-foreground'
                        )} />
                        <span className={cn('truncate', file.type === 'directory' && 'font-medium')}>
                          {file.name}
                        </span>
                        {file.type === 'directory' && (
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {file.type === 'file' ? formatSize(file.size) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {file.type === 'directory' ? t('files.folder') : (file.extension || t('files.file'))}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {file.modified ? new Date(file.modified).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs">⋯</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          {file.type === 'file' && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenFile(file); }}>
                              <Pencil className="w-4 h-4 mr-2" /> {t('common.edit')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenaming({ oldPath: file.path, newName: file.name }); }}>
                            <Pencil className="w-4 h-4 mr-2" /> {t('files.rename')}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(file); }}>
                            <Trash2 className="w-4 h-4 mr-2" /> {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
