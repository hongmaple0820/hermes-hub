'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore, type ViewMode } from '@/lib/store';
import { useI18n } from '@/i18n';
import {
  LayoutDashboard, Bot, Server, Puzzle, MessageSquare, Users, Settings,
  LogOut, ChevronLeft, ChevronRight, Zap, Languages,
  Radio, Clock, BarChart3, UserCircle, Brain, ScrollText, Folder, Terminal,
  Monitor, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SidebarProps {
  onLogout: () => void;
}

const sectionLabelKeys: Record<string, string> = {
  main: 'sidebar.sectionMain',
  communication: 'sidebar.sectionCommunication',
  management: 'sidebar.sectionManagement',
  system: 'sidebar.sectionSystem',
};

const navSections = [
  {
    label: 'main',
    items: [
      { id: 'dashboard' as ViewMode, labelKey: 'nav.dashboard', icon: LayoutDashboard, shortcut: '⌘1' },
      { id: 'agents' as ViewMode, labelKey: 'nav.agents', icon: Bot, shortcut: '⌘2' },
      { id: 'providers' as ViewMode, labelKey: 'nav.providers', icon: Server, shortcut: '⌘3' },
      { id: 'skills' as ViewMode, labelKey: 'nav.skills', icon: Puzzle, shortcut: '⌘4' },
      { id: 'agent-control' as ViewMode, labelKey: 'nav.agentControl', icon: Monitor, shortcut: '⌘5', isNew: true },
      { id: 'channels' as ViewMode, labelKey: 'nav.channels', icon: Radio, shortcut: '⌘6' },
    ],
  },
  {
    label: 'communication',
    items: [
      { id: 'chat' as ViewMode, labelKey: 'nav.chat', icon: MessageSquare, shortcut: '⌘7' },
      { id: 'chat-rooms' as ViewMode, labelKey: 'nav.chatRooms', icon: Users, shortcut: '⌘8' },
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
      { id: 'settings' as ViewMode, labelKey: 'nav.settings', icon: Settings, shortcut: '⌘,' },
    ],
  },
];

// Collapsed sections persistence
function getCollapsedSections(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem('sidebar-collapsed-sections');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveCollapsedSections(sections: Record<string, boolean>) {
  try {
    localStorage.setItem('sidebar-collapsed-sections', JSON.stringify(sections));
  } catch {
    // Ignore storage errors
  }
}

export function Sidebar({ onLogout }: SidebarProps) {
  const { currentView, setCurrentView, sidebarCollapsed, setSidebarCollapsed, user, agents, conversations } = useAppStore();
  const { locale, setLocale, t, locales } = useI18n();
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => getCollapsedSections());
  const [isMobile, setIsMobile] = useState(false);

  const onlineAgents = agents.filter((a: any) => a.status === 'online').length;
  const connectedAcrp = agents.filter((a: any) => a.mode === 'acrp' && a.wsConnected).length;
  const unreadConvs = conversations.length;

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSection = useCallback((sectionLabel: string) => {
    setCollapsedSections(prev => {
      const next = { ...prev, [sectionLabel]: !prev[sectionLabel] };
      saveCollapsedSections(next);
      return next;
    });
  }, []);

  // Effective collapsed state: on mobile, always show icons only
  const effectivelyCollapsed = isMobile || sidebarCollapsed;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'h-screen flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out relative',
          effectivelyCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center gap-3 p-4 border-b border-border',
          effectivelyCollapsed && 'justify-center p-3'
        )}>
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          {!effectivelyCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm truncate">Hermes Hub</span>
              <span className="text-[10px] text-muted-foreground">{t('auth.subtitle')}</span>
            </div>
          )}
        </div>

        {/* Toggle Button - hidden on mobile */}
        {!isMobile && (
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-14 z-10 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center hover:bg-accent transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 scrollbar-thin">
          <div className="space-y-1">
            {navSections.map((section) => {
              const isSectionCollapsed = collapsedSections[section.label] === true;
              const sectionLabelKey = sectionLabelKeys[section.label];

              return (
                <div key={section.label}>
                  {/* Section Header */}
                  {navSections.length > 1 && !effectivelyCollapsed && (
                    <button
                      onClick={() => toggleSection(section.label)}
                      className="w-full flex items-center gap-1.5 px-3 pt-3 pb-1 group cursor-pointer"
                    >
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex-1 text-left">
                        {t(sectionLabelKey)}
                      </span>
                      <ChevronDown
                        className={cn(
                          'w-3 h-3 text-muted-foreground transition-transform duration-200',
                          isSectionCollapsed && '-rotate-90'
                        )}
                      />
                    </button>
                  )}

                  {/* Section Items */}
                  <div className={cn(
                    'overflow-hidden transition-all duration-300 ease-in-out',
                    isSectionCollapsed && !effectivelyCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'
                  )}>
                    {section.items.map((item) => {
                      const isActive = currentView === item.id;
                      const Icon = item.icon;

                      const button = (
                        <button
                          key={item.id}
                          onClick={() => setCurrentView(item.id)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 relative',
                            'hover:bg-accent hover:text-accent-foreground',
                            isActive
                              ? 'bg-primary/10 text-primary font-medium border-l-[3px] border-primary'
                              : 'border-l-[3px] border-transparent text-muted-foreground',
                            effectivelyCollapsed && 'justify-center px-0 border-l-0',
                            isActive && effectivelyCollapsed && 'border-l-0 bg-primary/10',
                          )}
                        >
                          <Icon className={cn('w-[18px] h-[18px] shrink-0', isActive && 'text-primary')} />
                          {!effectivelyCollapsed && (
                            <>
                              <span className="truncate flex-1 text-left">{t(item.labelKey)}</span>
                              {/* New Badge */}
                              {item.isNew && (
                                <Badge className="h-4 px-1.5 text-[9px] font-bold bg-emerald-500 text-white hover:bg-emerald-500 border-0 leading-none">
                                  {t('sidebar.newBadge')}
                                </Badge>
                              )}
                              {/* Agent count badges */}
                              {item.id === 'agents' && onlineAgents > 0 && (
                                <span className="ml-auto text-[10px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">
                                  {onlineAgents}
                                </span>
                              )}
                              {item.id === 'agent-control' && connectedAcrp > 0 && (
                                <span className="flex items-center gap-1 text-[10px] bg-cyan-500/10 text-cyan-600 px-1.5 py-0.5 rounded-full font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                                  {connectedAcrp}
                                </span>
                              )}
                              {item.id === 'chat' && unreadConvs > 0 && (
                                <span className="text-[10px] bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">
                                  {unreadConvs}
                                </span>
                              )}
                              {/* Keyboard Shortcut */}
                              {item.shortcut && (
                                <span className="text-[9px] text-muted-foreground/60 font-mono ml-1 hidden lg:inline">
                                  {item.shortcut}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      );

                      if (effectivelyCollapsed) {
                        return (
                          <Tooltip key={item.id}>
                            <TooltipTrigger asChild>{button}</TooltipTrigger>
                            <TooltipContent side="right" className="font-medium">
                              {t(item.labelKey)}
                              {item.isNew && (
                                <Badge className="ml-1.5 h-4 px-1 text-[8px] font-bold bg-emerald-500 text-white border-0">
                                  {t('sidebar.newBadge')}
                                </Badge>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        );
                      }

                      return button;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        <Separator />

        {/* Language Switcher */}
        <div className={cn('px-3 py-2', effectivelyCollapsed && 'flex justify-center')}>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg px-2 py-1.5 hover:bg-accent w-full',
                  effectivelyCollapsed && 'justify-center px-0'
                )}
              >
                <Languages className="w-4 h-4 shrink-0" />
                {!effectivelyCollapsed && (
                  <span className="truncate">{locales.find((l) => l.code === locale)?.label}</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align={effectivelyCollapsed ? 'right' : 'center'} className="w-40 p-1">
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
        <div className={cn('p-3', effectivelyCollapsed && 'flex justify-center')}>
          {effectivelyCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Avatar className="w-8 h-8 cursor-pointer">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {user?.name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-card rounded-full" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <div className="text-center">
                  <p className="font-medium">{user?.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="w-9 h-9">
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {user?.name?.slice(0, 2)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-card rounded-full" />
              </div>
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
