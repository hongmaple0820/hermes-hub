'use client';

import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { GitBranch, Loader2 } from 'lucide-react';

interface GitImportDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  gitUrl: string;
  setGitUrl: (v: string) => void;
  skillPath: string;
  setSkillPath: (v: string) => void;
  importing: boolean;
  onImport: () => void;
}

export function GitImportDialog({
  open,
  onOpenChange,
  gitUrl,
  setGitUrl,
  skillPath,
  setSkillPath,
  importing,
  onImport,
}: GitImportDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            {t('skills.importSkill')}
          </DialogTitle>
          <DialogDescription>
            {t('skills.importFromGit')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="git-url">{t('skills.gitRepoUrl')}</Label>
            <Input
              id="git-url"
              placeholder="https://github.com/user/skill-repo"
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="skill-path">{t('skills.skillPath')}</Label>
            <Input
              id="skill-path"
              placeholder=".agents/skills/my-skill"
              value={skillPath}
              onChange={(e) => setSkillPath(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              className="gap-1"
              disabled={!gitUrl.trim() || importing}
              onClick={onImport}
            >
              {importing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <GitBranch className="w-3 h-3" />
              )}
              {importing ? t('skills.importing') : t('skills.importSkill')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
