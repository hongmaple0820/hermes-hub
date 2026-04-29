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
  Clock, Cpu, Globe, Shield, Sparkles, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Dashboard() {
  const { agents, providers, skills, conversations, chatRooms, setCurrentView, setSelectedAgentId } = useAppStore();
  const { t } = useI18n();

  const onlineAgents = agents.filter((a: any) => a.status === 'online');
  const acrpAgents = agents.filter((a: any) => a.mode === 'acrp');
  const connectedAcrpAgents = acrpAgents.filter((a: any) => a.wsConnected);
  const activeProviders = providers.filter((p: any) => p.isActive);
  const enabledSkills = skills.filter((s: any) => s.isEnabled);
  const builtinAgents = agents.filter((a: any) => a.mode === 'builtin');

  const stats = [
    {
      title: t('dashboard.agents'),
      value: agents.length,
      subtitle: t('dashboard.agentsOnline', { count: onlineAgents.length }),
      icon: Bot,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
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
      borderColor: 'border-violet-200 dark:border-violet-800',
      view: 'providers' as const,
      detail: `${activeProviders.length} active`,
    },
    {
      title: t('dashboard.skills'),
      value: skills.length,
      subtitle: t('dashboard.skillsEnabled', { count: enabledSkills.length }),
      icon: Puzzle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-200 dark:border-amber-800',
      view: 'skills' as const,
      detail: `${enabledSkills.length} enabled`,
    },
    {
      title: t('dashboard.gateways'),
      value: acrpAgents.length,
      subtitle: t('dashboard.gatewaysRunning', { count: connectedAcrpAgents.length }),
      icon: Monitor,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-200 dark:border-cyan-800',
      view: 'agent-control' as const,
      detail: `${connectedAcrpAgents.length} connected`,
    },
    {
      title: t('dashboard.conversations'),
      value: conversations.length,
      subtitle: t('dashboard.conversationsActive'),
      icon: MessageSquare,
      color: 'text-rose-600',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-200 dark:border-rose-800',
      view: 'chat' as const,
      detail: `${chatRooms.length} rooms`,
    },
    {
      title: t('dashboard.chatRooms'),
      value: chatRooms.length,
      subtitle: t('dashboard.chatRoomsMulti'),
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-200 dark:border-orange-800',
      view: 'chat-rooms' as const,
      detail: 'Multi-agent',
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 px-3 py-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs">System Online</span>
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1">
            <Zap className="w-3 h-3 text-amber-500" />
            <span className="text-xs">ACRP v2.0</span>
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className={cn(
              'hover:shadow-lg transition-all duration-300 cursor-pointer group',
              'border', stat.borderColor,
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

      {/* Middle Row: Quick Actions + Agent Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              {t('dashboard.quickActions')}
            </CardTitle>
            <CardDescription>{t('dashboard.quickActionsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2 h-10" onClick={() => setCurrentView('providers')}>
              <Server className="w-4 h-4 text-violet-500" /> {t('dashboard.configureProvider')}
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 h-10" onClick={() => setCurrentView('agents')}>
              <Bot className="w-4 h-4 text-emerald-500" /> {t('dashboard.createAgent')}
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 h-10" onClick={() => setCurrentView('skills')}>
              <Puzzle className="w-4 h-4 text-amber-500" /> {t('dashboard.browseSkills')}
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 h-10" onClick={() => setCurrentView('agent-control')}>
              <Monitor className="w-4 h-4 text-cyan-500" /> {t('dashboard.connectHermes')}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Agents */}
        <Card className="hover:shadow-md transition-shadow">
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
                  Create your first agent →
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
                          {agent.mode === 'acrp' ? 'ACRP' : 'Builtin'}
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
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              System Status
            </CardTitle>
            <CardDescription>Platform health & connectivity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* LLM Providers */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Server className="w-3 h-3" /> LLM Providers
                </span>
                <span className="font-medium">{activeProviders.length}/{providers.length}</span>
              </div>
              <Progress value={providers.length > 0 ? (activeProviders.length / providers.length) * 100 : 0} className="h-1.5" />
            </div>

            {/* ACRP Connections */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Monitor className="w-3 h-3" /> ACRP Agents
                </span>
                <span className="font-medium">{connectedAcrpAgents.length}/{acrpAgents.length}</span>
              </div>
              <Progress value={acrpAgents.length > 0 ? (connectedAcrpAgents.length / acrpAgents.length) * 100 : 0} className="h-1.5" />
            </div>

            {/* Skills */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Puzzle className="w-3 h-3" /> Skills Active
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
                <span className="text-muted-foreground">Builtin</span>
                <span className="ml-auto font-medium">{builtinAgents.length}</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-md bg-muted/50">
                <Globe className="w-3 h-3 text-cyan-500" />
                <span className="text-muted-foreground">ACRP</span>
                <span className="ml-auto font-medium">{acrpAgents.length}</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-md bg-muted/50">
                <MessageSquare className="w-3 h-3 text-rose-500" />
                <span className="text-muted-foreground">Chats</span>
                <span className="ml-auto font-medium">{conversations.length}</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-md bg-muted/50">
                <Shield className="w-3 h-3 text-emerald-500" />
                <span className="text-muted-foreground">Online</span>
                <span className="ml-auto font-medium">{onlineAgents.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Activity Feed + Architecture */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Architecture Overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-violet-500" />
              Agent Architecture
            </CardTitle>
            <CardDescription>How agents connect to Hermes Hub</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Builtin Mode */}
              <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                    <Cpu className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Builtin Mode</p>
                    <p className="text-[10px] text-muted-foreground">Hub runs LLM directly via provider</p>
                  </div>
                  <Badge variant="outline" className="ml-auto text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400">
                    {builtinAgents.length} agents
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>User</span>
                  <ArrowUpRight className="w-3 h-3" />
                  <span>Hub</span>
                  <ArrowUpRight className="w-3 h-3" />
                  <span>LLM Provider</span>
                  <ArrowUpRight className="w-3 h-3" />
                  <span>Response</span>
                </div>
              </div>

              {/* ACRP Mode */}
              <div className="p-3 rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/50 dark:bg-cyan-900/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-md bg-cyan-500/10 flex items-center justify-center">
                    <Globe className="w-3.5 h-3.5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">ACRP Mode</p>
                    <p className="text-[10px] text-muted-foreground">Agent connects via WebSocket, self-registers capabilities</p>
                  </div>
                  <Badge variant="outline" className="ml-auto text-[10px] bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400">
                    {acrpAgents.length} agents
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>Agent</span>
                  <Wifi className="w-3 h-3 text-cyan-500" />
                  <span>WS :3004</span>
                  <ArrowUpRight className="w-3 h-3" />
                  <span>Hub</span>
                  <ArrowUpRight className="w-3 h-3" />
                  <span>capability:invoke</span>
                </div>
              </div>

              {/* Supported platforms */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground">Supported:</span>
                {['hermes-agent', 'openclaw', 'claude-code', 'codex', 'trae', 'custom'].map((type) => (
                  <Badge key={type} variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-500" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest agent and conversation activity</CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length === 0 && conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <TrendingUp className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No activity yet</p>
                <p className="text-[10px] text-muted-foreground mt-1">Create an agent to get started</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {agents.slice(0, 3).map((agent: any) => (
                  <div key={agent.id} className="flex items-center gap-3 p-2 rounded-md border text-xs">
                    <div className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      agent.status === 'online' ? 'bg-emerald-500' :
                      agent.status === 'error' ? 'bg-red-500' :
                      agent.status === 'busy' ? 'bg-amber-500' : 'bg-gray-300'
                    )} />
                    <span className="font-medium truncate">{agent.name}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">
                      {agent.mode === 'acrp' ? 'ACRP' : 'Builtin'}
                    </Badge>
                    <span className="text-muted-foreground ml-auto shrink-0">
                      {agent.wsConnected ? '🟢 Connected' : agent.status}
                    </span>
                  </div>
                ))}
                {conversations.slice(0, 2).map((conv: any) => (
                  <div key={conv.id} className="flex items-center gap-3 p-2 rounded-md border text-xs">
                    <MessageSquare className="w-3 h-3 text-rose-500 shrink-0" />
                    <span className="font-medium truncate">{conv.name || 'Conversation'}</span>
                    <span className="text-muted-foreground ml-auto shrink-0">
                      {conv.type}
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
