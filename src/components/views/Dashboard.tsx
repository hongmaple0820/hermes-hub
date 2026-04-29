'use client';

import { useAppStore } from '@/lib/store';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Server, Puzzle, Monitor, MessageSquare, Users, Activity, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Dashboard() {
  const { agents, providers, skills, gateways, conversations, chatRooms, setCurrentView } = useAppStore();
  const { t } = useI18n();

  const stats = [
    {
      title: t('dashboard.agents'),
      value: agents.length,
      subtitle: t('dashboard.agentsOnline', { count: agents.filter((a: any) => a.status === 'online').length }),
      icon: Bot,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
      view: 'agents' as const,
    },
    {
      title: t('dashboard.providers'),
      value: providers.length,
      subtitle: t('dashboard.providersActive', { count: providers.filter((p: any) => p.isActive).length }),
      icon: Server,
      color: 'text-violet-600',
      bgColor: 'bg-violet-500/10',
      view: 'providers' as const,
    },
    {
      title: t('dashboard.skills'),
      value: skills.length,
      subtitle: t('dashboard.skillsEnabled', { count: skills.filter((s: any) => s.isEnabled).length }),
      icon: Puzzle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
      view: 'skills' as const,
    },
    {
      title: t('dashboard.gateways'),
      value: gateways.length,
      subtitle: t('dashboard.gatewaysRunning', { count: gateways.filter((g: any) => g.status === 'running').length }),
      icon: Monitor,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-500/10',
      view: 'agent-control' as const,
    },
    {
      title: t('dashboard.conversations'),
      value: conversations.length,
      subtitle: t('dashboard.conversationsActive'),
      icon: MessageSquare,
      color: 'text-rose-600',
      bgColor: 'bg-rose-500/10',
      view: 'chat' as const,
    },
    {
      title: t('dashboard.chatRooms'),
      value: chatRooms.length,
      subtitle: t('dashboard.chatRoomsMulti'),
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-500/10',
      view: 'chat-rooms' as const,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => setCurrentView(stat.view)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={`w-8 h-8 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.quickActions')}</CardTitle>
            <CardDescription>{t('dashboard.quickActionsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setCurrentView('providers')}>
              <Server className="w-4 h-4" /> {t('dashboard.configureProvider')}
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setCurrentView('agents')}>
              <Bot className="w-4 h-4" /> {t('dashboard.createAgent')}
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setCurrentView('skills')}>
              <Puzzle className="w-4 h-4" /> {t('dashboard.browseSkills')}
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setCurrentView('agent-control')}>
              <Monitor className="w-4 h-4" /> {t('dashboard.connectHermes')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.recentAgents')}</CardTitle>
            <CardDescription>{t('dashboard.recentAgentsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('dashboard.noAgents')}</p>
            ) : (
              <div className="space-y-2">
                {agents.slice(0, 5).map((agent: any) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => {
                      useAppStore.getState().setSelectedAgentId(agent.id);
                      setCurrentView('agent-detail');
                    }}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{t(`agents.mode${agent.mode === 'builtin' ? 'BuiltinShort' : agent.mode === 'custom_api' ? 'CustomApiShort' : agent.mode === 'acrp' ? 'AcrpShort' : 'BuiltinShort'}`)} · {agent.status === 'online' ? t('common.online') : t('common.offline')}</p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${agent.status === 'online' ? 'bg-emerald-500' : agent.status === 'error' ? 'bg-red-500' : 'bg-gray-300'}`} />
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
