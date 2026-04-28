'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Puzzle, Search, Plus, Download, Check, Code, CloudSun, FileText, Globe,
  BarChart3, Mail, Bell, Volume2, Database, Image, Languages, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  Search, Code, Image, FileText, Languages, Bell, Globe, BarChart3, Mail, Volume2, Database, CloudSun, Zap, Puzzle,
};

const categoryColors: Record<string, string> = {
  communication: 'bg-blue-500/10 text-blue-600',
  productivity: 'bg-emerald-500/10 text-emerald-600',
  development: 'bg-violet-500/10 text-violet-600',
  data: 'bg-amber-500/10 text-amber-600',
  media: 'bg-rose-500/10 text-rose-600',
  utility: 'bg-cyan-500/10 text-cyan-600',
};

const CATEGORY_KEYS: Record<string, string> = {
  all: 'skills.categoryAll',
  communication: 'skills.categoryCommunication',
  productivity: 'skills.categoryProductivity',
  development: 'skills.categoryDevelopment',
  data: 'skills.categoryData',
  media: 'skills.categoryMedia',
  utility: 'skills.categoryUtility',
};

export function SkillMarketplace() {
  const { skills, setSkills, agents } = useAppStore();
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [installing, setInstalling] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(skills.map((s: any) => s.category));
    return ['all', ...Array.from(cats)];
  }, [skills]);

  const filteredSkills = useMemo(() => {
    return skills.filter((s: any) => {
      const matchesSearch = !search ||
        s.displayName.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [skills, search, selectedCategory]);

  const handleInstall = async (skillId: string, agentId: string) => {
    setInstalling(skillId);
    try {
      await api.installSkill(skillId, { agentId });
      toast.success(t('skills.installed'));
      setShowInstall(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('skills.title')}</h1>
        <p className="text-muted-foreground text-sm">
          {t('skills.subtitle')}
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('skills.searchPlaceholder')}
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setSelectedCategory(cat)}
            >
              {CATEGORY_KEYS[cat] ? t(CATEGORY_KEYS[cat]) : cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Skills Grid */}
      {filteredSkills.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Puzzle className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('skills.noSkillsTitle')}</h3>
            <p className="text-muted-foreground text-sm">{t('skills.noSkillsDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSkills.map((skill: any) => {
            const Icon = iconMap[skill.icon] || Puzzle;

            return (
              <Card key={skill.id} className="hover:shadow-md transition-shadow flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', categoryColors[skill.category] || 'bg-accent')}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm">{skill.displayName}</CardTitle>
                      <Badge variant="outline" className="text-[10px] mt-1">
                        {CATEGORY_KEYS[skill.category] ? t(CATEGORY_KEYS[skill.category]) : skill.category}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-xs text-muted-foreground line-clamp-3 mb-4 flex-1">
                    {skill.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">v{skill.version}</span>
                    <Dialog open={showInstall === skill.id} onOpenChange={(v) => setShowInstall(v ? skill.id : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-1 text-xs">
                          <Download className="w-3 h-3" /> {t('common.install')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t('common.install')} {skill.displayName}</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground mb-4">{t('skills.installTo', { skill: skill.displayName })}</p>
                        {agents.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">{t('skills.noAgents')}</p>
                        ) : (
                          <div className="space-y-2">
                            {agents.map((agent: any) => (
                              <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent">
                                <div>
                                  <p className="text-sm font-medium">{agent.name}</p>
                                  <p className="text-xs text-muted-foreground">{agent.mode}</p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleInstall(skill.id, agent.id)}
                                  disabled={installing === skill.id}
                                  className="gap-1"
                                >
                                  {installing === skill.id ? <Zap className="w-3 h-3 animate-pulse" /> : <Plus className="w-3 h-3" />}
                                  {t('common.install')}
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
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
