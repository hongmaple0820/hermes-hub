'use client';

import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Server, Puzzle, Cable, MessageSquare, Users, Activity, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Dashboard() {
  const { agents, providers, skills, gateways, conversations, chatRooms, setCurrentView } = useAppStore();

  const stats = [
    {
      title: 'Agents',
      value: agents.length,
      subtitle: `${agents.filter((a: any) => a.status === 'online').length} online`,
      icon: Bot,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
      view: 'agents' as const,
    },
    {
      title: 'LLM Providers',
      value: providers.length,
      subtitle: `${providers.filter((p: any) => p.isActive).length} active`,
      icon: Server,
      color: 'text-violet-600',
      bgColor: 'bg-violet-500/10',
      view: 'providers' as const,
    },
    {
      title: 'Skills',
      value: skills.length,
      subtitle: `${skills.filter((s: any) => s.isEnabled).length} enabled`,
      icon: Puzzle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
      view: 'skills' as const,
    },
    {
      title: 'Hermes Gateways',
      value: gateways.length,
      subtitle: `${gateways.filter((g: any) => g.status === 'running').length} running`,
      icon: Cable,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-500/10',
      view: 'hermes' as const,
    },
    {
      title: 'Conversations',
      value: conversations.length,
      subtitle: 'Active chats',
      icon: MessageSquare,
      color: 'text-rose-600',
      bgColor: 'bg-rose-500/10',
      view: 'chat' as const,
    },
    {
      title: 'Chat Rooms',
      value: chatRooms.length,
      subtitle: 'Multi-agent rooms',
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
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome to Hermes Hub — your multi-agent collaboration platform</p>
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
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Get started with common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setCurrentView('providers')}>
              <Server className="w-4 h-4" /> Configure LLM Provider
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setCurrentView('agents')}>
              <Bot className="w-4 h-4" /> Create New Agent
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setCurrentView('skills')}>
              <Puzzle className="w-4 h-4" /> Browse Skills Marketplace
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setCurrentView('hermes')}>
              <Cable className="w-4 h-4" /> Connect Hermes Agent
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Agents</CardTitle>
            <CardDescription>Your recently active agents</CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No agents yet. Create your first agent!</p>
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
                      <p className="text-xs text-muted-foreground">{agent.mode} · {agent.status}</p>
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
