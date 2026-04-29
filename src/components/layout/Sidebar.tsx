'use client';

import { useAppStore, type ViewMode } from '@/lib/store';
import { useI18n } from '@/i18n';
import {
  LayoutDashboard, Bot, Server, Puzzle, Cable, MessageSquare, Users, Settings,
  LogOut, ChevronLeft, ChevronRight, Zap, Languages,
  Radio, Clock, BarChart3, UserCircle, Brain, ScrollText, Folder, Terminal,
  Monitor,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface SidebarProps {
  onLogout: () => void;
}

const navSections = [
  {
    label: 'main',
    items: [
      { id: 'dashboard' as ViewMode, labelKey: 'nav.dashboard', icon: LayoutDashboard },
      { id: 'agents' as ViewMode, labelKey: 'nav.agents', icon: Bot },
      { id: 'providers' as ViewMode, labelKey: 'nav.providers', icon: Server },
      { id: 'skills' as ViewMode, labelKey: 'nav.skills', icon: Puzzle },
      { id: 'hermes' as ViewMode, labelKey: 'nav.hermes', icon: Cable },
      { id: 'agent-control' as ViewMode, labelKey: 'nav.agentControl', icon: Monitor },
      { id: 'channels' as ViewMode, labelKey: 'nav.channels', icon: Radio },
    ],
  },
  {
    label: 'communication',
    items: [
      { id: 'chat' as ViewMode, labelKey: 'nav.chat', icon: MessageSquare },
      { id: 'chat-rooms' as ViewMode, labelKey: 'nav.chatRooms', icon: Users },
    ],
  },
  {
    label: 'management',
    items: [
      { id: 'jobs' as ViewMode, labelKey: 'nav.jobs', icon: Clock },
      { id: 'usage' as ViewMode, labelKey: 'nav.usage', icon: BarChart3 },
      { id: 'profiles' as ViewMode, labelKey: 'nav.profiles', icon: UserCircle },
      { id: 'memory' as ViewMode, labelKey: 'nav.memory', icon: Brain },
    ],
  },
  {
    label: 'system',
    items: [
      { id: 'logs' as ViewMode, labelKey: 'nav.logs', icon: ScrollText },
      { id: 'files' as ViewMode, labelKey: 'nav.files', icon: Folder },
      { id: 'terminal' as ViewMode, labelKey: 'nav.terminal', icon: Terminal },
      { id: 'settings' as ViewMode, labelKey: 'nav.settings', icon: Settings },
    ],
  },
];

export function Sidebar({ onLogout }: SidebarProps) {
  const { currentView, setCurrentView, sidebarCollapsed, setSidebarCollapsed, user, agents, conversations } = useAppStore();
  const { locale, setLocale, t, locales } = useI18n();

  const onlineAgents = agents.filter((a: any) => a.status === 'online').length;
  const unreadConvs = conversations.length;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'h-screen flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out relative',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center gap-3 p-4 border-b border-border',
          sidebarCollapsed && 'justify-center p-3'
        )}>
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm truncate">Hermes Hub</span>
              <span className="text-[10px] text-muted-foreground">{t('auth.subtitle')}</span>
            </div>
          )}
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-14 z-10 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center hover:bg-accent transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          <div className="space-y-1">
            {navSections.map((section) => (
              <div key={section.label}>
                {navSections.length > 1 && !sidebarCollapsed && section.label !== 'main' && (
                  <div className="px-3 pt-3 pb-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {section.label}
                    </span>
                  </div>
                )}
                {section.items.map((item) => {
                  const isActive = currentView === item.id;
                  const Icon = item.icon;

                  const button = (
                    <button
                      key={item.id}
                      onClick={() => setCurrentView(item.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                        'hover:bg-accent hover:text-accent-foreground',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground',
                        sidebarCollapsed && 'justify-center px-0'
                      )}
                    >
                      <Icon className={cn('w-[18px] h-[18px] shrink-0', isActive && 'text-primary')} />
                      {!sidebarCollapsed && <span className="truncate">{t(item.labelKey)}</span>}
                      {!sidebarCollapsed && item.id === 'agents' && onlineAgents > 0 && (
                        <span className="ml-auto text-[10px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">
                          {onlineAgents}
                        </span>
                      )}
                      {!sidebarCollapsed && item.id === 'chat' && unreadConvs > 0 && (
                        <span className="ml-auto text-[10px] bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">
                          {unreadConvs}
                        </span>
                      )}
                    </button>
                  );

                  if (sidebarCollapsed) {
                    return (
                      <Tooltip key={item.id}>
                        <TooltipTrigger asChild>{button}</TooltipTrigger>
                        <TooltipContent side="right" className="font-medium">{t(item.labelKey)}</TooltipContent>
                      </Tooltip>
                    );
                  }

                  return button;
                })}
              </div>
            ))}
          </div>
        </nav>

        <Separator />

        {/* Language Switcher */}
        <div className={cn('px-3 py-2', sidebarCollapsed && 'flex justify-center')}>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg px-2 py-1.5 hover:bg-accent w-full',
                  sidebarCollapsed && 'justify-center px-0'
                )}
              >
                <Languages className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="truncate">{locales.find((l) => l.code === locale)?.label}</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align={sidebarCollapsed ? 'right' : 'center'} className="w-40 p-1">
              {locales.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLocale(l.code)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                    locale === l.code
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <span>{l.label}</span>
                  {locale === l.code && (
                    <span className="ml-auto text-xs">✓</span>
                  )}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>

        <Separator />

        {/* User section */}
        <div className={cn('p-3', sidebarCollapsed && 'flex justify-center')}>
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="w-8 h-8 cursor-pointer">
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="right">{user?.name || 'User'}</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0" onClick={onLogout}>
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
