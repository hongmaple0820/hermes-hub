'use client';

import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Check, Download, Flame, Zap, Puzzle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { iconMap, categoryBadgeColors, handlerTypeColors, CATEGORY_KEYS, POPULAR_SKILLS } from './shared';
import { CodeBlock } from './shared-components';

interface SkillDetailDialogProps {
  showDetail: string | null;
  setShowDetail: (v: string | null) => void;
  skill: any;
  agentSkills: any[];
  agents: any[];
  installing: string | null;
  detailInstallAgent: string;
  setDetailInstallAgent: (v: string) => void;
  onInstall: (skillId: string, agentId: string) => void;
}

export function SkillDetailDialog({
  showDetail,
  setShowDetail,
  skill,
  agentSkills,
  agents,
  installing,
  detailInstallAgent,
  setDetailInstallAgent,
  onInstall,
}: SkillDetailDialogProps) {
  const { t } = useI18n();

  if (!skill) return null;

  const Icon = iconMap[skill.icon] || Puzzle;
  const installedCount = agentSkills.filter((as: any) => as.skillId === skill.id).length;
  const isInstalled = installedCount > 0;
  const isPopular = POPULAR_SKILLS.has(skill.id) || (skill.invokeCount ?? 0) > 50;

  const categoryCircularBg: Record<string, string> = {
    communication: 'bg-blue-100 dark:bg-blue-900/30',
    productivity: 'bg-emerald-100 dark:bg-emerald-900/30',
    development: 'bg-violet-100 dark:bg-violet-900/30',
    data: 'bg-amber-100 dark:bg-amber-900/30',
    media: 'bg-rose-100 dark:bg-rose-900/30',
    utility: 'bg-cyan-100 dark:bg-cyan-900/30',
  };

  return (
    <Dialog open={!!showDetail} onOpenChange={(v) => { if (!v) setShowDetail(null); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-4">
            {/* Large icon with colored circular background */}
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center shrink-0',
              categoryCircularBg[skill.category] || 'bg-accent',
            )}>
              <Icon className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{skill.displayName}</span>
                {isPopular && (
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] px-1.5 py-0 gap-0.5">
                    <Flame className="w-2.5 h-2.5" /> {t('skills.popular')}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className={cn('text-[10px]', categoryBadgeColors[skill.category] || '')}>
                  {CATEGORY_KEYS[skill.category] ? t(CATEGORY_KEYS[skill.category]) : skill.category}
                </Badge>
                <Badge variant="outline" className={cn('text-[10px]', handlerTypeColors[skill.handlerType] || '')}>
                  {skill.handlerType}
                </Badge>
                <span className="text-xs text-muted-foreground">v{skill.metadata?.version || '1.0'}</span>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Full Description */}
          <div>
            <h4 className="text-sm font-semibold mb-1">{t('common.description')}</h4>
            <p className="text-sm text-muted-foreground">{skill.description}</p>
          </div>

          {/* Installed indicator */}
          <div className="flex items-center gap-2">
            {isInstalled ? (
              <Badge variant="secondary" className="text-xs gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <Check className="w-3 h-3" />
                ✓ {t('skills.installed')} ({installedCount})
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">{t('skillProtocol.notInstalled')}</Badge>
            )}
          </div>

          <Separator />

          {/* Parameters Table */}
          {skill.parameters && (
            <div>
              <h4 className="text-sm font-semibold mb-2">{t('skills.parameters')}</h4>
              {typeof skill.parameters === 'object' && skill.parameters.properties ? (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-2 font-medium">Name</th>
                        <th className="text-left p-2 font-medium">Type</th>
                        <th className="text-center p-2 font-medium">Required</th>
                        <th className="text-left p-2 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(skill.parameters.properties).map(([key, schema]: [string, any]) => (
                        <tr key={key} className="border-t">
                          <td className="p-2 font-mono font-medium text-primary/80">{key}</td>
                          <td className="p-2 text-muted-foreground">{schema.type || 'any'}</td>
                          <td className="p-2 text-center">
                            {skill.parameters.required?.includes(key) ? (
                              <span className="text-red-500 font-bold">*</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-2 text-muted-foreground">{schema.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <pre className="text-xs bg-muted p-3 rounded-md font-mono overflow-x-auto">
                  {JSON.stringify(skill.parameters, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Config Schema */}
          {skill.configSchema && (
            <div>
              <h4 className="text-sm font-semibold mb-2">{t('skillProtocol.configSchema')}</h4>
              <CodeBlock
                language="json"
                code={typeof skill.configSchema === 'string' ? skill.configSchema : JSON.stringify(skill.configSchema, null, 2)}
              />
            </div>
          )}

          {/* Handler Type */}
          <div>
            <h4 className="text-sm font-semibold mb-1">{t('skillProtocol.handlerType')}</h4>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn('text-xs', handlerTypeColors[skill.handlerType] || '')}>
                {skill.handlerType}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t(`skillProtocol.handlerTypes.${skill.handlerType}` as any) || skill.handlerType}
              </span>
            </div>
          </div>

          <Separator />

          {/* Install to Agent section */}
          {isInstalled ? (
            <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">✓ {t('skills.installed')}</span>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">{t('skills.installToAgent')}</h4>
              {agents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t('skills.noAgents')}</p>
              ) : (
                <>
                  <Select value={detailInstallAgent} onValueChange={setDetailInstallAgent}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('skills.selectAgent')} />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((agent: any) => (
                        <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full gap-1"
                    disabled={!detailInstallAgent || installing === skill.id}
                    onClick={() => {
                      if (detailInstallAgent) {
                        onInstall(skill.id, detailInstallAgent);
                      }
                    }}
                  >
                    {installing === skill.id ? (
                      <Zap className="w-4 h-4 animate-pulse" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    {t('common.install')}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
