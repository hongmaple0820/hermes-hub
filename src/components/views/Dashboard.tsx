'use client';

import { useAppStore } from '@/lib/store';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Bot, Server, Puzzle, Monitor, MessageSquare, Users,
  Activity, ArrowUpRight, Zap, Wifi, WifiOff, TrendingUp,
  Clock, Cpu, Globe, Shield, Sparkles, BarChart3, Radio,
  CheckCircle, Eye, LogOut, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface ActivityItem {
  id: string;
  type: 'agent_created' | 'conversation_started' | 'acrp_connected' | 'acrp_disconnected' | 'agent_online' | 'agent_offline';
  name: string;
  timestamp: string;
  detail?: string;
}

export function Dashboard() {
  const { agents, providers, skills, conversations, chatRooms, setCurrentView, setSelectedAgentId } = useAppStore();
  const { t } = useI18n();

  const onlineAgents = agents.filter((a: any) => a.status === 'online');
  const acrpAgents = agents.filter((a: any) => a.mode === 'acrp');
  const connectedAcrpAgents = acrpAgents.filter((a: any) => a.wsConnected);
  const activeProviders = providers.filter((p: any) => p.isActive);
  const enabledSkills = skills.filter((s: any) => s.isEnabled);
  const builtinAgents = agents.filter((a: any) => a.mode === 'builtin');

  // Real health check: system online only if providers exist and are active
  const isSystemOnline = activeProviders.length > 0 || connectedAcrpAgents.length > 0;

  // Build activity feed
  const activityItems: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];

    agents.forEach((agent: any) => {
      if (agent.mode === 'acrp') {
        if (agent.wsConnected) {
          items.push({
            id: `acrp-connected-${agent.id}`,
            type: 'acrp_connected',
            name: agent.name,
            timestamp: agent.lastHeartbeatAt || agent.updatedAt || agent.createdAt,
            detail: agent.agentType || 'ACRP',
          });
        } else if (agent.status === 'offline') {
          items.push({
            id: `acrp-disconnected-${agent.id}`,
            type: 'acrp_disconnected',
            name: agent.name,
            timestamp: agent.updatedAt || agent.createdAt,
            detail: agent.agentType || 'ACRP',
          });
        }
      } else {
        if (agent.status === 'online') {
          items.push({
            id: `agent-online-${agent.id}`,
            type: 'agent_online',
            name: agent.name,
            timestamp: agent.updatedAt || agent.createdAt,
          });
        } else if (agent.status === 'offline' || agent.status === 'error') {
          items.push({
            id: `agent-offline-${agent.id}`,
            type: 'agent_offline',
            name: agent.name,
            timestamp: agent.updatedAt || agent.createdAt,
          });
        }
      }

      // Agent creation events
      if (agent.createdAt) {
        items.push({
          id: `agent-created-${agent.id}`,
          type: 'agent_created',
          name: agent.name,
          timestamp: agent.createdAt,
          detail: agent.mode === 'acrp' ? 'ACRP' : 'Builtin',
        });
      }
    });

    conversations.forEach((conv: any) => {
      items.push({
        id: `conv-started-${conv.id}`,
        type: 'conversation_started',
        name: conv.name || conv.title || t('dashboard.conversation'),
        timestamp: conv.updatedAt || conv.createdAt,
        detail: conv.type,
      });
    });

    // Sort by timestamp descending
    items.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

    return items.slice(0, 10);
  }, [agents, conversations, t]);

  const formatTimeAgo = (timestamp: string) => {
    if (!timestamp) return '';
    const now = new Date().getTime();
    const then = new Date(timestamp).getTime();
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('dashboard.justNow');
    if (minutes < 60) return t('dashboard.minutesAgo', { count: minutes });
    if (hours < 24) return t('dashboard.hoursAgo', { count: hours });
    return t('dashboard.daysAgo', { count: days });
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'agent_created':
        return <Plus className="w-3.5 h-3.5 text-emerald-500" />;
      case 'conversation_started':
        return <MessageSquare className="w-3.5 h-3.5 text-rose-500" />;
      case 'acrp_connected':
        return <Radio className="w-3.5 h-3.5 text-cyan-500" />;
      case 'acrp_disconnected':
        return <LogOut className="w-3.5 h-3.5 text-gray-400" />;
      case 'agent_online':
        return <Wifi className="w-3.5 h-3.5 text-emerald-500" />;
      case 'agent_offline':
        return <WifiOff className="w-3.5 h-3.5 text-red-400" />;
    }
  };

  const getActivityLabel = (type: ActivityItem['type']) => {
    switch (type) {
      case 'agent_created':
        return t('dashboard.activityAgentCreated');
      case 'conversation_started':
        return t('dashboard.activityConvStarted');
      case 'acrp_connected':
        return t('dashboard.activityAcrpConnected');
      case 'acrp_disconnected':
        return t('dashboard.activityAcrpDisconnected');
      case 'agent_online':
        return t('dashboard.activityAgentOnline');
      case 'agent_offline':
        return t('dashboard.activityAgentOffline');
    }
  };

  const stats = [
    {
      title: t('dashboard.agents'),
      value: agents.length,
      subtitle: t('dashboard.agentsOnline', { count: onlineAgents.length }),
      icon: Bot,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-l-emerald-500',
      view: 'agents' as const,
      detail: `${builtinAgents.length} builtin · ${acrpAgents.length} ACRP`,
    },
    {
      title: t('dashboard.providers'),
      value: providers.length,
      subtitle: t('dashboard.providersActive', { count: activeProviders.length }),
      icon: Server,
      color: 'text-violet-600',
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-l-violet-500',
      view: 'providers' as const,
      detail: `${activeProviders.length} ${t('dashboard.active')}`,
    },
    {
      title: t('dashboard.skills'),
      value: skills.length,
      subtitle: t('dashboard.skillsEnabled', { count: enabledSkills.length }),
      icon: Puzzle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-l-amber-500',
      view: 'skills' as const,
      detail: `${enabledSkills.length} ${t('dashboard.enabled')}`,
    },
    {
      title: t('dashboard.gateways'),
      value: acrpAgents.length,
      subtitle: t('dashboard.gatewaysRunning', { count: connectedAcrpAgents.length }),
      icon: Monitor,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-l-cyan-500',
      view: 'agent-control' as const,
      detail: `${connectedAcrpAgents.length} ${t('dashboard.connected')}`,
    },
    {
      title: t('dashboard.conversations'),
      value: conversations.length,
      subtitle: t('dashboard.conversationsActive'),
      icon: MessageSquare,
      color: 'text-rose-600',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-l-rose-500',
      view: 'chat' as const,
      detail: `${chatRooms.length} ${t('dashboard.rooms')}`,
    },
    {
      title: t('dashboard.chatRooms'),
      value: chatRooms.length,
      subtitle: t('dashboard.chatRoomsMulti'),
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-l-orange-500',
      view: 'chat-rooms' as const,
      detail: t('dashboard.multiAgent'),
    },
  ];

  // Quick stats for the stats grid
  const quickStats = [
    { label: t('dashboard.totalAgents'), value: agents.length, icon: Bot, color: 'text-emerald-600', bgColor: 'bg-emerald-500/10', borderColor: 'border-l-emerald-500' },
    { label: t('dashboard.onlineAgents'), value: onlineAgents.length, icon: Wifi, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', borderColor: 'border-l-emerald-400' },
    { label: t('dashboard.totalSkills'), value: skills.length, icon: Puzzle, color: 'text-amber-600', bgColor: 'bg-amber-500/10', borderColor: 'border-l-amber-500' },
    { label: t('dashboard.activeSkills'), value: enabledSkills.length, icon: CheckCircle, color: 'text-amber-500', bgColor: 'bg-amber-500/10', borderColor: 'border-l-amber-400' },
    { label: t('dashboard.totalConversations'), value: conversations.length, icon: MessageSquare, color: 'text-rose-600', bgColor: 'bg-rose-500/10', borderColor: 'border-l-rose-500' },
    { label: t('dashboard.acrpConnected'), value: connectedAcrpAgents.length, icon: Radio, color: 'text-cyan-600', bgColor: 'bg-cyan-500/10', borderColor: 'border-l-cyan-500' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-50 via-background to-cyan-50 dark:from-emerald-950/20 dark:via-background dark:to-cyan-950/20 p-6 border border-border/50 shadow-sm">
        <div className="absolute inset-0 bg-grid-slate-100/50 dark:bg-grid-slate-800/20 [mask-image:radial-gradient(ellipse_at_center,white,transparent)] -z-10" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'gap-1.5 px-3 py-1 transition-colors',
                isSystemOnline
                  ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/20'
                  : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20'
              )}
            >
              <div className={cn(
                'w-2 h-2 rounded-full',
                isSystemOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
              )} />
              <span className={cn('text-xs', isSystemOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
                {isSystemOnline ? t('dashboard.systemOnline') : t('dashboard.systemOffline')}
              </span>
            </Badge>
            <Badge variant="outline" className="gap-1.5 px-3 py-1 border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20">
              <Zap className="w-3 h-3 text-amber-500" />
              <span className="text-xs text-amber-700 dark:text-amber-400">ACRP v2.0</span>
            </Badge>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {quickStats.map((stat) => (
          <Card
            key={stat.label}
            className={cn(
              'border-l-4 rounded-xl shadow-sm transition-all duration-300 cursor-pointer group hover:shadow-md hover:-translate-y-0.5',
              stat.borderColor
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', stat.bgColor)}>
                  <stat.icon className={cn('w-4 h-4', stat.color)} />
                </div>
              </div>
              <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className={cn(
              'hover:shadow-lg transition-all duration-300 cursor-pointer group rounded-xl',
              'border-l-4', stat.borderColor,
              'hover:-translate-y-0.5'
            )}
            onClick={() => setCurrentView(stat.view)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110', stat.bgColor)}>
                <stat.icon className={cn('w-4 h-4', stat.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 opacity-60">{stat.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Middle Row: Quick Actions + Agent Overview + System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="hover:shadow-md transition-shadow rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              {t('dashboard.quickActions')}
            </CardTitle>
            <CardDescription>{t('dashboard.quickActionsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2 h-10 rounded-lg" onClick={() => setCurrentView('providers')}>
              <Server className="w-4 h-4 text-violet-500" /> {t('dashboard.configureProvider')}
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 h-10 rounded-lg" onClick={() => setCurrentView('agents')}>
              <Bot className="w-4 h-4 text-emerald-500" /> {t('dashboard.createAgent')}
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 h-10 rounded-lg" onClick={() => setCurrentView('skills')}>
              <Puzzle className="w-4 h-4 text-amber-500" /> {t('dashboard.browseSkills')}
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 h-10 rounded-lg" onClick={() => setCurrentView('agent-control')}>
              <Monitor className="w-4 h-4 text-cyan-500" /> {t('dashboard.connectHermes')}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Agents */}
        <Card className="hover:shadow-md transition-shadow rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-emerald-500" />
              {t('dashboard.recentAgents')}
            </CardTitle>
            <CardDescription>{t('dashboard.recentAgentsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Bot className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">{t('dashboard.noAgents')}</p>
                <Button variant="link" size="sm" className="mt-1" onClick={() => setCurrentView('agents')}>
                  {t('dashboard.createAgentToStart')}
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {agents.slice(0, 5).map((agent: any) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent cursor-pointer transition-colors group"
                    onClick={() => {
                      setSelectedAgentId(agent.id);
                      setCurrentView('agent-detail');
                    }}
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{agent.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn(
                          'text-[9px] px-1 py-0 h-4',
                          agent.mode === 'acrp'
                            ? 'bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800'
                            : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                        )}>
                          {agent.mode === 'acrp' ? 'ACRP' : t('dashboard.builtinMode')}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {agent.model || (agent.provider?.name) || '-'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {agent.mode === 'acrp' ? (
                        agent.wsConnected ? (
                          <Wifi className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <WifiOff className="w-3 h-3 text-gray-400" />
                        )
                      ) : (
                        <div className={cn(
                          'w-2 h-2 rounded-full',
                          agent.status === 'online' ? 'bg-emerald-500' :
                          agent.status === 'error' ? 'bg-red-500' :
                          agent.status === 'busy' ? 'bg-amber-500' : 'bg-gray-300'
                        )} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="hover:shadow-md transition-shadow rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              {t('dashboard.systemStatus')}
            </CardTitle>
            <CardDescription>{t('dashboard.platformHealth')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* LLM Providers */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Server className="w-3 h-3" /> {t('dashboard.llmProviders')}
                </span>
                <span className="font-medium">{activeProviders.length}/{providers.length}</span>
              </div>
              <Progress value={providers.length > 0 ? (activeProviders.length / providers.length) * 100 : 0} className="h-1.5" />
            </div>

            {/* ACRP Connections */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Monitor className="w-3 h-3" /> {t('dashboard.acrpAgents')}
                </span>
                <span className="font-medium">{connectedAcrpAgents.length}/{acrpAgents.length}</span>
              </div>
              <Progress value={acrpAgents.length > 0 ? (connectedAcrpAgents.length / acrpAgents.length) * 100 : 0} className="h-1.5" />
            </div>

            {/* Skills */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Puzzle className="w-3 h-3" /> {t('dashboard.skillsActive')}
                </span>
                <span className="font-medium">{enabledSkills.length}/{skills.length}</span>
              </div>
              <Progress value={skills.length > 0 ? (enabledSkills.length / skills.length) * 100 : 0} className="h-1.5" />
            </div>

            <Separator className="my-2" />

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 p-2 rounded-md bg-muted/50">
                <Cpu className="w-3 h-3 text-violet-500" />
                <span className="text-muted-foreground">{t('dashboard.builtin')}</span>
                <span className="ml-auto font-medium">{builtinAgents.length}</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-md bg-muted/50">
                <Globe className="w-3 h-3 text-cyan-500" />
                <span className="text-muted-foreground">ACRP</span>
                <span className="ml-auto font-medium">{acrpAgents.length}</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-md bg-muted/50">
                <MessageSquare className="w-3 h-3 text-rose-500" />
                <span className="text-muted-foreground">{t('dashboard.chats')}</span>
                <span className="ml-auto font-medium">{conversations.length}</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-md bg-muted/50">
                <Shield className="w-3 h-3 text-emerald-500" />
                <span className="text-muted-foreground">{t('dashboard.online')}</span>
                <span className="ml-auto font-medium">{onlineAgents.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Activity Feed + Architecture */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Architecture Overview */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-violet-500" />
              {t('dashboard.agentArchitecture')}
            </CardTitle>
            <CardDescription>{t('dashboard.howAgentsConnect')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Builtin Mode - Enhanced with numbered flow */}
              <div className={cn(
                'p-4 rounded-xl border-2 transition-all duration-300',
                'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10',
                'hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md',
                'bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-emerald-900/10 dark:to-transparent'
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Cpu className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t('dashboard.builtinMode')}</p>
                    <p className="text-[10px] text-muted-foreground">{t('dashboard.builtinModeDesc')}</p>
                  </div>
                  <Badge variant="outline" className="ml-auto text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400">
                    {builtinAgents.length} {t('dashboard.agentsLabel')}
                  </Badge>
                </div>
                {/* Numbered flow */}
                <div className="flex items-center gap-1.5 text-[10px]">
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] font-bold">1</span>
                    <span className="text-emerald-700 dark:text-emerald-300">{t('dashboard.stepUser')}</span>
                  </div>
                  <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] font-bold">2</span>
                    <span className="text-emerald-700 dark:text-emerald-300">{t('dashboard.stepHub')}</span>
                  </div>
                  <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] font-bold">3</span>
                    <span className="text-emerald-700 dark:text-emerald-300">{t('dashboard.stepProvider')}</span>
                  </div>
                  <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] font-bold animate-pulse">4</span>
                    <span className="text-emerald-700 dark:text-emerald-300">{t('dashboard.stepResponse')}</span>
                  </div>
                </div>
              </div>

              {/* ACRP Mode - Enhanced with numbered flow */}
              <div className={cn(
                'p-4 rounded-xl border-2 transition-all duration-300',
                'border-cyan-200 dark:border-cyan-800 bg-cyan-50/50 dark:bg-cyan-900/10',
                'hover:border-cyan-300 dark:hover:border-cyan-700 hover:shadow-md',
                'bg-gradient-to-r from-cyan-50/80 to-transparent dark:from-cyan-900/10 dark:to-transparent'
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t('dashboard.acrpMode')}</p>
                    <p className="text-[10px] text-muted-foreground">{t('dashboard.acrpModeDesc')}</p>
                  </div>
                  <Badge variant="outline" className="ml-auto text-[10px] bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400">
                    {acrpAgents.length} {t('dashboard.agentsLabel')}
                  </Badge>
                </div>
                {/* Numbered flow */}
                <div className="flex items-center gap-1.5 text-[10px]">
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30">
                    <span className="w-4 h-4 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[8px] font-bold">1</span>
                    <span className="text-cyan-700 dark:text-cyan-300">{t('dashboard.stepAgent')}</span>
                  </div>
                  <Wifi className="w-3 h-3 text-cyan-500" />
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30">
                    <span className="w-4 h-4 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[8px] font-bold">2</span>
                    <span className="text-cyan-700 dark:text-cyan-300">WS :3004</span>
                  </div>
                  <ArrowUpRight className="w-3 h-3 text-cyan-400" />
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30">
                    <span className="w-4 h-4 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[8px] font-bold">3</span>
                    <span className="text-cyan-700 dark:text-cyan-300">{t('dashboard.stepHub')}</span>
                  </div>
                  <ArrowUpRight className="w-3 h-3 text-cyan-400" />
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30">
                    <span className="w-4 h-4 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[8px] font-bold animate-pulse">4</span>
                    <span className="text-cyan-700 dark:text-cyan-300">{t('dashboard.stepCapabilityInvoke')}</span>
                  </div>
                </div>
              </div>

              {/* Supported platforms */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground">{t('dashboard.supported')}:</span>
                {['hermes-agent', 'openclaw', 'claude-code', 'codex', 'trae', 'custom'].map((type) => (
                  <Badge key={type} variant="outline" className="text-[9px] px-1.5 py-0 h-4 rounded-md">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity - Enhanced */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-rose-500" />
                  {t('dashboard.recentActivity')}
                </CardTitle>
                <CardDescription>{t('dashboard.latestActivity')}</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => setCurrentView('logs')}
              >
                <Eye className="w-3 h-3" />
                {t('dashboard.viewAll')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {activityItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <TrendingUp className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">{t('dashboard.noActivity')}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{t('dashboard.createAgentToStart')}</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {activityItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg border text-xs hover:bg-accent/50 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                      {getActivityIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{item.name}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0 rounded">
                          {getActivityLabel(item.type)}
                        </Badge>
                      </div>
                      {item.detail && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.detail}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                      {formatTimeAgo(item.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
