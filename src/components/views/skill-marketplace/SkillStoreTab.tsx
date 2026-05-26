'use client';

import { useI18n } from '@/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, GitBranch, Puzzle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_KEYS } from './shared';
import { SkillCard } from './SkillCard';
import { GitImportDialog } from './GitImportDialog';

interface SkillStoreTabProps {
  search: string;
  setSearch: (v: string) => void;
  categories: string[];
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  selectedHandlerType: string;
  setSelectedHandlerType: (v: string) => void;
  filteredSkills: any[];
  allSkills: any[];
  agentSkills: any[];
  agents: any[];
  installing: string | null;
  showInstall: string | null;
  setShowInstall: (id: string | null) => void;
  setShowDetail: (id: string | null) => void;
  onInstall: (skillId: string, agentId: string) => void;
  // Git import
  showImportDialog: boolean;
  setShowImportDialog: (v: boolean) => void;
  importGitUrl: string;
  setImportGitUrl: (v: string) => void;
  importSkillPath: string;
  setImportSkillPath: (v: string) => void;
  importing: boolean;
  onImportSkill: () => void;
}

export function SkillStoreTab({
  search,
  setSearch,
  categories,
  selectedCategory,
  setSelectedCategory,
  selectedHandlerType,
  setSelectedHandlerType,
  filteredSkills,
  allSkills,
  agentSkills,
  agents,
  installing,
  showInstall,
  setShowInstall,
  setShowDetail,
  onInstall,
  showImportDialog,
  setShowImportDialog,
  importGitUrl,
  setImportGitUrl,
  importSkillPath,
  setImportSkillPath,
  importing,
  onImportSkill,
}: SkillStoreTabProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="space-y-4">
        {/* Search + Handler Type Filter Row */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-md min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('skills.searchPlaceholder')}
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={selectedHandlerType} onValueChange={setSelectedHandlerType}>
            <SelectTrigger className="w-44 h-9 text-xs">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('skills.filterAll')} ({t('skills.handlerTypes')})</SelectItem>
              <SelectItem value="builtin">Builtin</SelectItem>
              <SelectItem value="webhook">Webhook</SelectItem>
              <SelectItem value="websocket">WebSocket</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category Filter Chips - horizontally scrollable on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thin">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'text-xs shrink-0 rounded-full transition-all duration-200',
                selectedCategory === cat && 'shadow-sm'
              )}
              onClick={() => setSelectedCategory(cat)}
            >
              {CATEGORY_KEYS[cat] ? t(CATEGORY_KEYS[cat]) : cat}
            </Button>
          ))}
        </div>

        {/* Filtered Count */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t('skills.showing', { shown: filteredSkills.length, total: allSkills.length })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => setShowImportDialog(true)}
            >
              <GitBranch className="w-3 h-3" /> {t('skills.importFromGit')}
            </Button>
          </div>
        </div>
      </div>

      {/* Skills Grid or No Results */}
      {filteredSkills.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Search className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('skills.noResults')}</h3>
            <p className="text-muted-foreground text-sm">{t('skills.tryDifferentSearch')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSkills.map((skill: any) => {
            const installedCount = agentSkills.filter((as: any) => as.skillId === skill.id).length;
            return (
              <SkillCard
                key={skill.id}
                skill={skill}
                installedCount={installedCount}
                installing={installing}
                showInstall={showInstall}
                setShowInstall={setShowInstall}
                setShowDetail={setShowDetail}
                agents={agents}
                agentSkills={agentSkills}
                onInstall={onInstall}
              />
            );
          })}
        </div>
      )}

      {/* Import from Git Dialog */}
      <GitImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        gitUrl={importGitUrl}
        setGitUrl={setImportGitUrl}
        skillPath={importSkillPath}
        setSkillPath={setImportSkillPath}
        importing={importing}
        onImport={onImportSkill}
      />
    </div>
  );
}
