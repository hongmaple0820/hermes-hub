'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore, type ViewMode } from '@/lib/store';
import { useI18n } from '@/i18n';
import {
  LayoutDashboard, Bot, Puzzle, MessageSquare,
  LogOut, ChevronLeft, ChevronRight, Zap, Languages,
  Radio, Clock, Settings,
  Monitor, ChevronDown, Menu, Wrench, Activity,
  Compass,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface SidebarProps {
  onLogout: () => void;
}

const sectionLabelKeys: Record<string, string> = {
  core: 'sidebar.sectionCore',
  admin: 'sidebar.sectionAdmin',
  system: 'sidebar.sectionSystem',
};

// Sections that should be collapsed by default
const defaultCollapsedSections: string[] = [];

// Hermes Hub 2.0 Navigation Structure
// Primary (Core): 5 core pages of the new architecture
// Secondary (Admin): Management pages kept as secondary
// System: Settings and system utilities
// Hidden: chat, chat-rooms, files, terminal, memory, logs, usage, profiles, providers
//   — These routes still work but are not shown in the sidebar
const navSections = [
  {
    label: 'core',
    isPrimary: true,
    items: [
      { id: 'dashboard' as ViewMode, labelKey: 'nav.dashboard', icon: LayoutDashboard, shortcut: '⌘1' },
      { id: 'chat2' as ViewMode, labelKey: 'nav.chat2', icon: MessageSquare, shortcut: '⌘2' },
      { id: 'agentBuilder' as ViewMode, labelKey: 'nav.agentBuilder', icon: Bot, shortcut: '⌘3' },
      { id: 'toolRegistry' as ViewMode, labelKey: 'nav.toolRegistry', icon: Wrench, shortcut: '⌘4' },
      { id: 'agentDiscovery' as ViewMode, labelKey: 'nav.agentDiscovery', icon: Compass, shortcut: '⌘5' },
      { id: 'activity' as ViewMode, labelKey: 'nav.activity', icon: Activity, shortcut: '⌘6' },
    ],
  },
  {
    label: 'admin',
    items: [
      { id: 'agents' as ViewMode, labelKey: 'nav.agents', icon: Bot, shortcut: '⌘7' },
      { id: 'skills' as ViewMode, labelKey: 'nav.skills', icon: Puzzle, shortcut: '⌘8' },
      { id: 'agent-control' as ViewMode, labelKey: 'nav.agentControl', icon: Monitor, shortcut: '⌘9' },
    ],
  },
  {
    label: 'system',
    items: [
      { id: 'settings' as ViewMode, labelKey: 'nav.settings', icon: Settings, shortcut: '⌘,' },
      { id: 'channels' as ViewMode, labelKey: 'nav.channels', icon: Radio },
      { id: 'jobs' as ViewMode, labelKey: 'nav.jobs', icon: Clock },
    ],
  },
];

// Collapsed sections persistence
function getCollapsedSections(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem('sidebar-collapsed-sections');
    if (stored) {
      return JSON.parse(stored);
    }
    // Default: no sections collapsed
    const defaults: Record<string, boolean> = {};
    defaultCollapsedSections.forEach(s => { defaults[s] = true; });
    return defaults;
  } catch {
    const defaults: Record<string, boolean> = {};
    defaultCollapsedSections.forEach(s => { defaults[s] = true; });
    return defaults;
  }
}

function saveCollapsedSections(sections: Record<string, boolean>) {
  try {
    localStorage.setItem('sidebar-collapsed-sections', JSON.stringify(sections));
  } catch {
    // Ignore storage errors
  }
}

// ========================
// Inner sidebar content (shared between desktop & mobile sheet)
// ========================
function SidebarContent({
  effectivelyCollapsed,
  onToggleCollapse,
  isMobile,
  onNavClick,
  onLogout,
}: {
  effectivelyCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobile: boolean;
  onNavClick?: () => void;
  onLogout: () => void;
}) {
  const { currentView, setCurrentView, user, agents, conversations } = useAppStore();
  const { locale, setLocale, t, locales } = useI18n();
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => getCollapsedSections());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const onlineAgents = agents.filter((a: any) => a.status === 'online').length;
  const connectedAcrp = agents.filter((a: any) => a.mode === 'acrp' && a.wsConnected).length;
  const unreadConvs = conversations.length;

  // Scroll shadow detection
  const checkScrollShadows = useCallback(() => {
    if (!navRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = navRef.current;
    setShowScrollTop(scrollTop > 4);
    setShowScrollBottom(scrollTop + clientHeight < scrollHeight - 4);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    checkScrollShadows();
    el.addEventListener('scroll', checkScrollShadows, { passive: true });
    const observer = new ResizeObserver(checkScrollShadows);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScrollShadows);
      observer.disconnect();
    };
  }, [checkScrollShadows]);

  const toggleSection = useCallback((sectionLabel: string) => {
    setCollapsedSections(prev => {
      const next = { ...prev, [sectionLabel]: !prev[sectionLabel] };
      saveCollapsedSections(next);
      return next;
    });
  }, []);

  const handleNavClick = useCallback((view: ViewMode) => {
    setCurrentView(view);
    onNavClick?.();
  }, [setCurrentView, onNavClick]);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'h-screen flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out relative',
          effectivelyCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* ====== LOGO SECTION (fixed top) ====== */}
        <div className={cn(
          'relative flex items-center gap-3 px-4 py-3 border-b border-border overflow-hidden shrink-0',
          effectivelyCollapsed && 'justify-center px-3'
        )}>
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-primary/[0.02] dark:from-primary/[0.08] dark:via-transparent dark:to-primary/[0.04]" />

          <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shrink-0 shadow-sm shadow-primary/20">
            <Zap className="w-5 h-5" />
          </div>
          {!effectivelyCollapsed && (
            <div className="relative flex flex-col min-w-0">
              <span className="font-bold text-sm truncate">Hermes Hub</span>
              {/* Version badge */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">{t('auth.subtitle')}</span>
                <Badge
                  variant="outline"
                  className="h-3.5 px-1 text-[8px] font-mono leading-none border-primary/20 text-primary/60"
                >
                  v2.0
                </Badge>
              </div>
            </div>
          )}
          {/* Gradient underline accent */}
          {!effectivelyCollapsed && (
            <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          )}
        </div>

        {/* Toggle Button - hidden on mobile */}
        {!isMobile && (
          <button
            onClick={onToggleCollapse}
            className="absolute -right-3 top-14 z-10 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center hover:bg-accent hover:scale-110 transition-all duration-200 shadow-sm"
          >
            {effectivelyCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </button>
        )}

        {/* ====== NAVIGATION (scrollable middle) ====== */}
        <div className="flex-1 relative overflow-hidden">
          {/* Top scroll shadow */}
          <div className={cn(
            'absolute top-0 left-0 right-0 h-4 z-10 pointer-events-none transition-opacity duration-300',
            'bg-gradient-to-b from-card to-transparent',
            showScrollTop ? 'opacity-100' : 'opacity-0'
          )} />
          {/* Bottom scroll shadow */}
          <div className={cn(
            'absolute bottom-0 left-0 right-0 h-4 z-10 pointer-events-none transition-opacity duration-300',
            'bg-gradient-to-t from-card to-transparent',
            showScrollBottom ? 'opacity-100' : 'opacity-0'
          )} />

          <nav
            ref={navRef}
            className="h-full overflow-y-auto py-2 px-2 sidebar-scroll smooth-scroll"
          >
            <div className="space-y-1">
              {navSections.map((section, sectionIndex) => {
                const isSectionCollapsed = collapsedSections[section.label] === true;
                const sectionLabelKey = sectionLabelKeys[section.label];

                const isPrimary = (section as any).isPrimary === true;

                return (
                  <div key={section.label}>
                    {/* Separator line between groups - thicker/more prominent between primary and secondary */}
                    {sectionIndex > 0 && (
                      <div className="px-3 py-2">
                        <div className={cn(
                          'h-px',
                          sectionIndex === 1
                            ? 'bg-gradient-to-r from-transparent via-primary/25 to-transparent'
                            : 'bg-gradient-to-r from-transparent via-border to-transparent'
                        )} />
                      </div>
                    )}

                    {/* Section Header - non-clickable label */}
                    {navSections.length > 1 && !effectivelyCollapsed && (
                      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1.5 group cursor-pointer" onClick={() => toggleSection(section.label)}>
                        <span className={cn(
                          'text-[10px] font-semibold uppercase tracking-[0.12em] flex-1 select-none',
                          isPrimary ? 'text-foreground/60' : 'text-muted-foreground/60'
                        )}>
                          {t(sectionLabelKey)}
                        </span>
                        <ChevronDown
                          className={cn(
                            'w-3 h-3 text-muted-foreground/50 transition-transform duration-300 ease-in-out',
                            isSectionCollapsed && '-rotate-90'
                          )}
                        />
                      </div>
                    )}

                    {/* Collapsed section separator for icon-only mode */}
                    {sectionIndex > 0 && effectivelyCollapsed && (
                      <div className="px-2 py-1.5">
                        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                      </div>
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
                            onClick={() => handleNavClick(item.id)}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm relative group/item',
                              'transition-all duration-200 ease-out',
                              // Hover effects
                              'hover:bg-accent/80 hover:text-accent-foreground',
                              // Active vs inactive styling
                              isActive
                                ? 'text-primary font-semibold'
                                : isPrimary
                                  ? 'text-foreground/80 font-medium'
                                  : 'text-muted-foreground',
                              effectivelyCollapsed && 'justify-center px-0',
                            )}
                          >
                            {/* Active background with gradient */}
                            {isActive && (
                              <motion.div
                                layoutId="sidebar-active-bg"
                                className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/10 via-primary/[0.06] to-primary/[0.02] dark:from-primary/[0.15] dark:via-primary/[0.08] dark:to-primary/[0.03] pointer-events-none"
                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                              />
                            )}

                            {/* Active left border accent (3px) */}
                            {isActive && !effectivelyCollapsed && (
                              <motion.div
                                layoutId="sidebar-active-border"
                                className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-gradient-to-b from-primary via-primary/80 to-primary/50 pointer-events-none"
                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                              />
                            )}

                            {/* Active indicator for collapsed state */}
                            {isActive && effectivelyCollapsed && (
                              <motion.div
                                layoutId="sidebar-active-bg-collapsed"
                                className="absolute inset-0 rounded-lg bg-primary/[0.10] dark:bg-primary/[0.15] border border-primary/30 pointer-events-none"
                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                              />
                            )}

                            {/* Subtle glow effect on active */}
                            {isActive && (
                              <div className="absolute inset-0 rounded-lg shadow-[0_0_12px_-2px] shadow-primary/10 dark:shadow-primary/15 pointer-events-none" />
                            )}

                            <Icon className={cn(
                              'w-[18px] h-[18px] shrink-0 relative z-10 transition-all duration-200',
                              isActive
                                ? 'text-primary drop-shadow-[0_0_4px] drop-shadow-primary/20'
                                : 'group-hover/item:text-foreground'
                            )} />

                            {!effectivelyCollapsed && (
                              <>
                                <span className="truncate flex-1 text-left relative z-10">{t(item.labelKey)}</span>
                                {/* Agent count badges */}
                                {item.id === 'agents' && onlineAgents > 0 && (
                                  <span className="ml-auto text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-medium relative z-10">
                                    {onlineAgents}
                                  </span>
                                )}
                                {/* ACRP connection count badge with pulsing cyan dot */}
                                {item.id === 'agent-control' && (
                                  <span className={cn(
                                    'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium relative z-10',
                                    connectedAcrp > 0
                                      ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                                      : 'bg-muted/50 text-muted-foreground/40'
                                  )}>
                                    {connectedAcrp > 0 && (
                                      <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                                      </span>
                                    )}
                                    {connectedAcrp > 0 ? connectedAcrp : ''}
                                  </span>
                                )}
                                {/* Unread conversations badge for chat2 */}
                                {item.id === 'chat2' && unreadConvs > 0 && (
                                  <span className="text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-full font-medium relative z-10">
                                    {unreadConvs}
                                  </span>
                                )}
                                {/* Keyboard Shortcut - only visible on hover */}
                                {item.shortcut && (
                                  <span className="text-[9px] text-muted-foreground/50 font-mono ml-1 relative z-10 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 hidden lg:inline">
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
                                {/* Show badge counts in tooltip for collapsed state */}
                                {item.id === 'agents' && onlineAgents > 0 && (
                                  <span className="ml-1.5 text-[10px] text-emerald-500">{onlineAgents} online</span>
                                )}
                                {item.id === 'agent-control' && connectedAcrp > 0 && (
                                  <span className="ml-1.5 text-[10px] text-cyan-500">{connectedAcrp} connected</span>
                                )}
                                {item.id === 'chat2' && unreadConvs > 0 && (
                                  <span className="ml-1.5 text-[10px] text-orange-500">{unreadConvs} unread</span>
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
        </div>

        {/* ====== LANGUAGE SWITCHER ====== */}
        <Separator />
        <div className={cn('px-3 py-2 shrink-0', effectivelyCollapsed && 'flex justify-center')}>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-all duration-200 rounded-lg px-2 py-1.5 hover:bg-accent w-full',
                  effectivelyCollapsed && 'justify-center px-0'
                )}
              >
                <Languages className="w-4 h-4 shrink-0" />
                {!effectivelyCollapsed && (
                  <span className="truncate">{locales.find((l) => l.code === locale)?.label}</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align={effectivelyCollapsed ? 'end' : 'center'} className="w-40 p-1">
              {locales.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLocale(l.code)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all duration-200',
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

        {/* ====== USER PROFILE SECTION (fixed bottom) ====== */}
        <Separator />
        <div className={cn('p-3 shrink-0', effectivelyCollapsed && 'flex justify-center')}>
          {effectivelyCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative cursor-pointer group/avatar">
                  {/* Gradient ring around avatar */}
                  <div className="rounded-full p-[2px] bg-gradient-to-br from-primary via-primary/60 to-primary/30 transition-all duration-300 group-hover/avatar:from-primary group-hover/avatar:via-primary group-hover/avatar:to-primary/80">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs bg-card text-foreground">
                        {user?.name?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  {/* Online status indicator with pulse */}
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card">
                    <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
                  </span>
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
            <div className="flex items-center gap-3 group/profile rounded-lg px-1 py-1 -mx-1 hover:bg-accent/50 transition-colors duration-200 cursor-pointer">
              <div className="relative group/avatar shrink-0">
                {/* Gradient ring around avatar */}
                <div className="rounded-full p-[2px] bg-gradient-to-br from-primary via-primary/60 to-primary/30 transition-all duration-300 group-hover/avatar:from-primary group-hover/avatar:via-primary group-hover/avatar:to-primary/80">
                  <Avatar className="w-9 h-9">
                    <AvatarFallback className="text-xs bg-card text-foreground">
                      {user?.name?.slice(0, 2)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {/* Online status indicator with pulse */}
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-card">
                  <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                  <Badge variant="outline" className="h-4 px-1 text-[8px] font-medium leading-none border-primary/20 text-primary/70 shrink-0">
                    Admin
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:scale-110 transition-all duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  onLogout();
                }}
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

// ========================
// Main export with mobile sheet support
// ========================
export function Sidebar({ onLogout }: SidebarProps) {
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const effectivelyCollapsed = isMobile || sidebarCollapsed;

  // Mobile: Sheet/drawer
  if (isMobile) {
    return (
      <>
        {/* Hamburger button in main content */}
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-40 md:hidden w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-accent transition-colors shadow-sm"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-64 bg-card border-r border-border">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SidebarContent
              effectivelyCollapsed={false}
              onToggleCollapse={() => {}}
              isMobile={true}
              onNavClick={() => setMobileOpen(false)}
              onLogout={onLogout}
            />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // Desktop
  return (
    <SidebarContent
      effectivelyCollapsed={effectivelyCollapsed}
      onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      isMobile={false}
      onLogout={onLogout}
    />
  );
}
