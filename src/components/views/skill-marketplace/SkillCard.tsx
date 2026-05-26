'use client';

import { useI18n } from '@/i18n';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Check, Download, Flame, Info, Plus, Zap, Puzzle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  iconMap, categoryColors, categoryBadgeColors, handlerTypeColors,
  handlerTypeGradients, CATEGORY_KEYS, POPULAR_SKILLS,
  getLicenseBadgeColor, getSourceTypeBadgeColor,
} from './shared';
import { SkillRating } from './shared-components';

interface SkillCardProps {
  skill: any;
  installedCount: number;
  installing: string | null;
  showInstall: string | null;
  setShowInstall: (id: string | null) => void;
  setShowDetail: (id: string | null) => void;
  agents: any[];
  agentSkills: any[];
  onInstall: (skillId: string, agentId: string) => void;
}

export function SkillCard({
  skill,
  installedCount,
  installing,
  showInstall,
  setShowInstall,
  setShowDetail,
  agents,
  agentSkills,
  onInstall,
}: SkillCardProps) {
  const { t } = useI18n();
  const Icon = iconMap[skill.icon] || Puzzle;
  const isPopular = POPULAR_SKILLS.has(skill.id) || (skill.invokeCount ?? 0) > 50;
  const gradientClass = handlerTypeGradients[skill.handlerType] || handlerTypeGradients.builtin;

  return (
    <>
      <Card
        className={cn(
          'flex flex-col cursor-pointer group relative overflow-hidden rounded-xl',
          'hover:-translate-y-1 hover:shadow-lg transition-all duration-200',
          'hover:border-primary/20'
        )}
        onClick={() => setShowDetail(skill.id)}
      >
        {/* Gradient top border */}
        <div className={cn('h-1 w-full', gradientClass)} />

        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border', categoryColors[skill.category] || 'bg-accent')}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors truncate">
                  {skill.displayName}
                </CardTitle>
                {isPopular && (
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] px-1.5 py-0 shrink-0 gap-0.5">
                    <Flame className="w-2.5 h-2.5" /> {t('skills.popular')}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', categoryBadgeColors[skill.category] || '')}>
                  {CATEGORY_KEYS[skill.category] ? t(CATEGORY_KEYS[skill.category]) : skill.category}
                </Badge>
                {skill.handlerType && (
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', handlerTypeColors[skill.handlerType] || '')}>
                    {skill.handlerType}
                  </Badge>
                )}
                {skill.license && (
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getLicenseBadgeColor(skill.license))}>
                    {skill.license}
                  </Badge>
                )}
                {skill.compatibility && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                    <Info className="w-2.5 h-2.5 mr-0.5" />{skill.compatibility}
                  </Badge>
                )}
                {skill.sourceType && skill.sourceType !== 'built-in' && (
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getSourceTypeBadgeColor(skill.sourceType))}>
                    {skill.sourceType}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <p className="text-xs text-muted-foreground line-clamp-2 mb-4 flex-1">
            {skill.description}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">v{skill.metadata?.version || '1.0'}</span>
              {skill.metadata?.rating != null && (
                <SkillRating rating={skill.metadata.rating} />
              )}
            </div>
            {installedCount > 0 ? (
              <Badge
                className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs gap-1 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setShowDetail(skill.id); }}
                title={t('skills.alreadyInstalled')}
              >
                <Check className="w-3 h-3" /> {t('skills.installed')} {installedCount > 1 ? `(${installedCount})` : ''}
              </Badge>
            ) : (
              <>
                <Dialog open={showInstall === skill.id} onOpenChange={(v) => { setShowInstall(v ? skill.id : null); }}>
                  <DialogContent onClick={(e) => e.stopPropagation()}>
                    <DialogHeader>
                      <DialogTitle>{t('common.install')} {skill.displayName}</DialogTitle>
                      <DialogDescription>{t('skills.installTo', { skill: skill.displayName })}</DialogDescription>
                    </DialogHeader>
                    {agents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{t('skills.noAgents')}</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {agents.map((agent: any) => {
                          const isAlreadyInstalled = agentSkills.some((as: any) => as.skillId === skill.id && as.agentId === agent.id);
                          return (
                            <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent">
                              <div>
                                <p className="text-sm font-medium">{agent.name}</p>
                                <p className="text-xs text-muted-foreground">{agent.mode}</p>
                              </div>
                              {isAlreadyInstalled ? (
                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs gap-1">
                                  <Check className="w-3 h-3" /> {t('skills.installed')}
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => onInstall(skill.id, agent.id)}
                                  disabled={installing === skill.id}
                                  className="gap-1"
                                >
                                  {installing === skill.id ? <Zap className="w-3 h-3 animate-pulse" /> : <Plus className="w-3 h-3" />}
                                  {t('common.install')}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={(e) => { e.stopPropagation(); setShowInstall(skill.id); }}
                >
                  <Download className="w-3 h-3" /> {t('common.install')}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
