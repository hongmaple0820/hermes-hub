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
  Pencil, ChevronRight, Download, FolderPlus, FileCode, FileImage,
  FileVideo, FileAudio, FileArchive, FileSpreadsheet, FilePieChart,
  Search,
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

// Extended file icon mapping based on extension
function getFileIcon(name: string): React.ElementType {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  // Code files
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'swift', 'kt', 'scala', 'r', 'm', 'sh', 'bash', 'zsh', 'fish', 'ps1'].includes(ext)) {
    return FileCode;
  }
  // Data/config files
  if (['json', 'yaml', 'yml', 'toml', 'xml', 'csv', 'tsv', 'env', 'cfg', 'ini', 'conf', 'properties'].includes(ext)) {
    return FileSpreadsheet;
  }
  // Markdown / text
  if (['md', 'mdx', 'txt', 'rtf', 'log', 'doc', 'docx'].includes(ext)) {
    return FileText;
  }
  // Images
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'avif'].includes(ext)) {
    return FileImage;
  }
  // Video
  if (['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv', 'wmv'].includes(ext)) {
    return FileVideo;
  }
  // Audio
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext)) {
    return FileAudio;
  }
  // Archives
  if (['zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar', 'tgz', 'zst'].includes(ext)) {
    return FileArchive;
  }
  // PDF / docs
  if (['pdf'].includes(ext)) {
    return FilePieChart;
  }
  return File;
}

// Get icon color based on file type
function getFileIconColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java'].includes(ext)) return 'text-emerald-500';
  if (['json', 'yaml', 'yml', 'toml', 'xml', 'csv'].includes(ext)) return 'text-amber-500';
  if (['md', 'mdx', 'txt', 'log'].includes(ext)) return 'text-sky-500';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'text-pink-500';
  if (['mp4', 'webm', 'avi', 'mov'].includes(ext)) return 'text-purple-500';
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return 'text-rose-500';
  if (['zip', 'tar', 'gz', '7z', 'rar'].includes(ext)) return 'text-orange-500';
  if (['pdf'].includes(ext)) return 'text-red-500';
  return 'text-muted-foreground';
}

// Check if a file is previewable as text
function isTextFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return [
    'txt', 'md', 'mdx', 'json', 'yaml', 'yml', 'toml', 'xml', 'csv', 'tsv',
    'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp',
    'h', 'hpp', 'cs', 'php', 'swift', 'kt', 'sh', 'bash', 'zsh', 'fish',
    'env', 'cfg', 'ini', 'conf', 'properties', 'log', 'sql', 'graphql',
    'html', 'htm', 'css', 'scss', 'less', 'sass', 'vue', 'svelte',
  ].includes(ext);
}

export function FilesView() {
  const { t } = useI18n();
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [backend, setBackend] = useState('local');
  const [editingFile, setEditingFile] = useState<{ path: string; content: string; originalContent: string } | null>(null);
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState<{ oldPath: string; newName: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
      setEditingFile({ path: file.path, content: result.content || '', originalContent: result.content || '' });
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
      setEditingFile({ ...editingFile, originalContent: editingFile.content });
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

  const handleDownload = async (file: FileEntry) => {
    if (file.type === 'directory') {
      toast.error(t('files.cannotDownloadFolder'));
      return;
    }
    try {
      const result = await api.readFile(file.path);
      const content = result.content || '';
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('files.downloadStarted'));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Filter files by search
  const filteredFiles = files.filter((file) =>
    !searchQuery || file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasUnsavedChanges = editingFile && editingFile.content !== editingFile.originalContent;

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
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-xs min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('files.searchPlaceholder')}
            className="pl-10 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* File Editor Modal */}
      <Dialog open={!!editingFile} onOpenChange={(v) => { if (!v) setEditingFile(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" /> {editingFile?.path}
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">{t('files.unsaved')}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={editingFile?.content || ''}
            onChange={(e) => setEditingFile(editingFile ? { ...editingFile, content: e.target.value } : null)}
            rows={20}
            className="font-mono text-sm resize-y"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {editingFile?.content?.length || 0} {t('files.charactersCount')}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingFile(null)}>
                {t('common.close')}
              </Button>
              <Button onClick={handleSaveFile} disabled={saving} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.save')}
              </Button>
            </div>
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
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Folder className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">{t('files.emptyFolder')}</h3>
            <p className="text-muted-foreground text-sm mb-4">{t('files.emptyFolderDesc')}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => { setShowUpload(true); }}>
                <Upload className="w-4 h-4" /> {t('files.upload')}
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => { setShowNewFile(true); setNewItemName(''); }}>
                <Plus className="w-4 h-4" /> {t('files.newFile')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : filteredFiles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Search className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('common.noResults')}</h3>
            <p className="text-muted-foreground text-sm">{t('files.noMatchingFiles')}</p>
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
              {filteredFiles.map((file) => {
                const Icon = file.type === 'directory' ? Folder : getFileIcon(file.name);
                const iconColor = file.type === 'directory' ? 'text-amber-500' : getFileIconColor(file.name);
                const canPreview = file.type === 'file' && isTextFile(file.name);

                return (
                  <TableRow
                    key={file.path}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => handleOpenFile(file)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className={cn('w-4 h-4 shrink-0', iconColor)} />
                        <span className={cn('truncate', file.type === 'directory' && 'font-medium')}>
                          {file.name}
                        </span>
                        {file.type === 'directory' && (
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">
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
                          {canPreview && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenFile(file); }}>
                              <Pencil className="w-4 h-4 mr-2" /> {t('common.edit')}
                            </DropdownMenuItem>
                          )}
                          {file.type === 'file' && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload(file); }}>
                              <Download className="w-4 h-4 mr-2" /> {t('files.download')}
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

      {/* Footer stats */}
      {files.length > 0 && (
        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <span>{t('files.itemCount', { count: filteredFiles.length })}</span>
          <span>{t('files.totalSize', { size: formatSize(files.reduce((sum, f) => sum + (f.size || 0), 0)) })}</span>
        </div>
      )}
    </div>
  );
}
