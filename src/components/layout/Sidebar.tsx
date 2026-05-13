'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore, type ViewMode } from '@/lib/store';
import { useI18n } from '@/i18n';
import {
  LayoutDashboard, Bot, Server, Puzzle, MessageSquare, Users, Settings,
  LogOut, ChevronLeft, ChevronRight, Zap, Languages,
  Radio, Clock, BarChart3, UserCircle, Brain, ScrollText, Folder, Terminal,
  Monitor, ChevronDown, Pin, PinOff, Maximize2, Minimize2, GripVertical,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
  onLogout: () => void;
  onOpenKeyboardHelp?: () => void;
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

// All nav items flattened for favorites reference
const allNavItems = navSections.flatMap(s => s.items);

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

// Favorites persistence
function getFavorites(): ViewMode[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem('sidebar-favorites');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveFavorites(favorites: ViewMode[]) {
  try {
    localStorage.setItem('sidebar-favorites', JSON.stringify(favorites));
  } catch {
    // Ignore storage errors
  }
}

// Sidebar width persistence
function getSidebarWidth(): number {
  if (typeof window === 'undefined') return 256;
  try {
    const stored = localStorage.getItem('sidebar-width');
    return stored ? parseInt(stored, 10) : 256;
  } catch {
    return 256;
  }
}

function saveSidebarWidth(width: number) {
  try {
    localStorage.setItem('sidebar-width', String(width));
  } catch {
    // Ignore storage errors
  }
}

export function Sidebar({ onLogout, onOpenKeyboardHelp }: SidebarProps) {
  const { currentView, setCurrentView, sidebarCollapsed, setSidebarCollapsed, user, agents, conversations } = useAppStore();
  const { locale, setLocale, t, locales } = useI18n();
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => getCollapsedSections());
  const [favorites, setFavorites] = useState<ViewMode[]>(() => getFavorites());
  const [isMobile, setIsMobile] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => getSidebarWidth());
  const [isResizing, setIsResizing] = useState(false);
  const [allSectionsCollapsed, setAllSectionsCollapsed] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

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

  const toggleFavorite = useCallback((viewId: ViewMode) => {
    setFavorites(prev => {
      const next = prev.includes(viewId)
        ? prev.filter(id => id !== viewId)
        : [...prev, viewId];
      saveFavorites(next);
      return next;
    });
  }, []);

  const toggleAllSections = useCallback(() => {
    if (allSectionsCollapsed) {
      // Expand all
      setCollapsedSections({});
      saveCollapsedSections({});
      setAllSectionsCollapsed(false);
    } else {
      // Collapse all
      const allCollapsed: Record<string, boolean> = {};
      navSections.forEach(s => { allCollapsed[s.label] = true; });
      setCollapsedSections(allCollapsed);
      saveCollapsedSections(allCollapsed);
      setAllSectionsCollapsed(true);
    }
  }, [allSectionsCollapsed]);

  // Resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = { startX: e.clientX, startWidth: sidebarWidth };

    const handleResizeMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = moveEvent.clientX - resizeRef.current.startX;
      const newWidth = Math.min(Math.max(resizeRef.current.startWidth + delta, 200), 400);
      setSidebarWidth(newWidth);
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      resizeRef.current = null;
      saveSidebarWidth(sidebarWidth);
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [sidebarWidth]);

  // Save width on change when not actively resizing
  useEffect(() => {
    if (!isResizing) {
      saveSidebarWidth(sidebarWidth);
    }
  }, [sidebarWidth, isResizing]);

  // Effective collapsed state: on mobile, always show icons only
  const effectivelyCollapsed = isMobile || sidebarCollapsed;

  // Compute current width
  const currentWidth = effectivelyCollapsed ? 64 : sidebarWidth;

  // Get favorite items data
  const favoriteItems = favorites
    .map(viewId => allNavItems.find(item => item.id === viewId))
    .filter(Boolean) as typeof allNavItems;

  return (
    <TooltipProvider delayDuration={effectivelyCollapsed ? 0 : 600}>
      <aside
        className={cn(
          'h-screen flex flex-col border-r border-border bg-card transition-[width] duration-300 ease-in-out relative',
          isResizing && 'transition-none'
        )}
        style={{ width: currentWidth }}
      >
        {/* Header with gradient background */}
        <div className={cn(
          'relative flex items-center gap-3 p-4 border-b border-border overflow-hidden',
          effectivelyCollapsed && 'justify-center p-3'
        )}>
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-primary/[0.02] dark:from-primary/[0.08] dark:via-transparent dark:to-primary/[0.04]" />
          <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shrink-0 shadow-sm shadow-primary/20">
            <Zap className="w-5 h-5" />
          </div>
          {!effectivelyCollapsed && (
            <div className="relative flex flex-col min-w-0 flex-1">
              <span className="font-bold text-sm truncate">Hermes Hub</span>
              <span className="text-[10px] text-muted-foreground">{t('auth.subtitle')}</span>
            </div>
          )}
          {/* Collapse all sections toggle */}
          {!effectivelyCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative w-7 h-7 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent"
                  onClick={toggleAllSections}
                  aria-label={allSectionsCollapsed ? t('sidebar.expandAll') : t('sidebar.collapseAll')}
                  title={allSectionsCollapsed ? t('sidebar.expandAll') : t('sidebar.collapseAll')}
                >
                  {allSectionsCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {allSectionsCollapsed ? t('sidebar.expandAll') : t('sidebar.collapseAll')}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Toggle Button - hidden on mobile */}
        {!isMobile && (
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? t('sidebar.expandSidebar') : t('sidebar.collapseSidebar')}
            title={sidebarCollapsed ? t('sidebar.expandSidebar') : t('sidebar.collapseSidebar')}
            className="absolute -right-3 top-14 z-10 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center hover:bg-accent hover:scale-110 transition-all duration-200 shadow-sm"
          >
            {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </button>
        )}

        {/* Resize Handle - only when expanded and not mobile */}
        {!effectivelyCollapsed && !isMobile && (
          <div
            className={cn(
              'absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 group/resize',
              'hover:bg-primary/20 active:bg-primary/30 transition-colors duration-150',
              isResizing && 'bg-primary/30'
            )}
            onMouseDown={handleResizeStart}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover/resize:opacity-100 transition-opacity">
              <GripVertical className="w-3 h-6 text-muted-foreground" />
            </div>
          </div>
        )}

        {/* Navigation with scroll shadows */}
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
              {/* ==================== FAVORITES SECTION ==================== */}
              {favoriteItems.length > 0 && (
                <div>
                  {/* Favorites Header */}
                  {!effectivelyCollapsed && (
                    <div className="flex items-center gap-1.5 px-3 pt-2 pb-1.5">
                      <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em] flex-1">
                        {t('sidebar.favorites')}
                      </span>
                      <Pin className="w-3 h-3 text-muted-foreground/40" />
                    </div>
                  )}
                  {effectivelyCollapsed && (
                    <div className="px-2 py-1.5">
                      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                    </div>
                  )}
                  {/* Favorite Items */}
                  <div className="space-y-0.5">
                    {favoriteItems.map((item) => {
                      const isActive = currentView === item.id;
                      const Icon = item.icon;
                      const isFav = favorites.includes(item.id);

                      const button = (
                        <button
                          key={`fav-${item.id}`}
                          onClick={() => setCurrentView(item.id)}
                          aria-label={t(item.labelKey)}
                          title={t(item.labelKey)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            toggleFavorite(item.id);
                          }}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm relative group/item',
                            'transition-all duration-300 ease-out',
                            'hover:scale-[1.02] hover:bg-accent/80 hover:text-accent-foreground',
                            isActive
                              ? 'text-primary font-medium'
                              : 'text-muted-foreground',
                            effectivelyCollapsed && 'justify-center px-0',
                          )}
                        >
                          {/* Active indicator with animated gradient pulse */}
                          {isActive && (
                            <motion.div
                              layoutId="sidebar-active-bg"
                              className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/[0.08] via-primary/[0.12] to-primary/[0.08] dark:from-primary/[0.12] dark:via-primary/[0.18] dark:to-primary/[0.12] animate-[gradient-pulse_3s_ease-in-out_infinite]"
                              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                            />
                          )}

                          {/* Active left border with gradient */}
                          {isActive && !effectivelyCollapsed && (
                            <motion.div
                              layoutId="sidebar-active-border"
                              className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-gradient-to-b from-primary via-primary/80 to-primary/50"
                              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                            />
                          )}

                          {/* Active indicator for collapsed state */}
                          {isActive && effectivelyCollapsed && (
                            <motion.div
                              layoutId="sidebar-active-bg-collapsed"
                              className="absolute inset-0 rounded-lg bg-primary/[0.08] dark:bg-primary/[0.12] border border-primary/20"
                              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                            />
                          )}

                          {/* Subtle glow effect on active */}
                          {isActive && (
                            <div className="absolute inset-0 rounded-lg shadow-[0_0_12px_-2px] shadow-primary/10 dark:shadow-primary/15 pointer-events-none" />
                          )}

                          <Icon className={cn(
                            'w-[18px] h-[18px] shrink-0 relative z-10 transition-all duration-300',
                            isActive
                              ? 'text-primary drop-shadow-[0_0_4px] drop-shadow-primary/20'
                              : 'group-hover/item:text-foreground'
                          )} />

                          {!effectivelyCollapsed && (
                            <>
                              <span className="truncate flex-1 text-left relative z-10">{t(item.labelKey)}</span>
                              {/* Unpin button on hover */}
                              <button
                                className="opacity-0 group-hover/item:opacity-100 transition-opacity relative z-10 p-0.5 rounded hover:bg-accent"
                                aria-label={t('sidebar.unpin')}
                                title={t('sidebar.unpin')}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(item.id);
                                }}
                              >
                                <PinOff className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                              </button>
                              {/* Keyboard Shortcut - show on hover */}
                              {item.shortcut && (
                                <span className="text-[9px] text-transparent font-mono ml-1 hidden lg:inline relative z-10 group-hover/item:text-muted-foreground/70 transition-colors duration-200">
                                  {item.shortcut}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      );

                      if (effectivelyCollapsed) {
                        return (
                          <Tooltip key={`fav-${item.id}`}>
                            <TooltipTrigger asChild>{button}</TooltipTrigger>
                            <TooltipContent side="right" className="font-medium">
                              {t(item.labelKey)}
                              {item.shortcut && (
                                <span className="ml-2 text-[10px] text-muted-foreground font-mono">{item.shortcut}</span>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        );
                      }

                      return button;
                    })}
                  </div>

                  {/* Divider between favorites and sections */}
                  <div className="px-3 py-2">
                    <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                  </div>
                </div>
              )}

              {/* ==================== NAV SECTIONS ==================== */}
              {navSections.map((section, sectionIndex) => {
                const isSectionCollapsed = collapsedSections[section.label] === true;
                const sectionLabelKey = sectionLabelKeys[section.label];

                return (
                  <div key={section.label}>
                    {/* Gradient divider between sections */}
                    {sectionIndex > 0 && (
                      <div className="px-3 py-2">
                        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                      </div>
                    )}

                    {/* Section Header */}
                    {navSections.length > 1 && !effectivelyCollapsed && (
                      <button
                        onClick={() => toggleSection(section.label)}
                        aria-label={isSectionCollapsed ? t('sidebar.expandSection', { section: t(sectionLabelKey) }) : t('sidebar.collapseSection', { section: t(sectionLabelKey) })}
                        title={isSectionCollapsed ? t('sidebar.expandSection', { section: t(sectionLabelKey) }) : t('sidebar.collapseSection', { section: t(sectionLabelKey) })}
                        className="w-full flex items-center gap-1.5 px-3 pt-2 pb-1.5 group cursor-pointer"
                      >
                        <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em] flex-1 text-left group-hover:text-muted-foreground transition-colors duration-200">
                          {t(sectionLabelKey)}
                        </span>
                        <ChevronDown
                          className={cn(
                            'w-3 h-3 text-muted-foreground/50 transition-transform duration-300 ease-in-out',
                            isSectionCollapsed && '-rotate-90'
                          )}
                        />
                      </button>
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
                        const isFav = favorites.includes(item.id);

                        const button = (
                          <button
                            key={item.id}
                            onClick={() => setCurrentView(item.id)}
                            aria-label={t(item.labelKey)}
                            title={t(item.labelKey)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              toggleFavorite(item.id);
                            }}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm relative group/item',
                              'transition-all duration-300 ease-out',
                              // Hover effects
                              'hover:scale-[1.02] hover:bg-accent/80 hover:text-accent-foreground',
                              // Active vs inactive styling
                              isActive
                                ? 'text-primary font-medium'
                                : 'text-muted-foreground',
                              effectivelyCollapsed && 'justify-center px-0',
                            )}
                          >
                            {/* Active indicator background with animated gradient pulse */}
                            {isActive && (
                              <motion.div
                                layoutId="sidebar-active-bg"
                                className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/[0.08] via-primary/[0.12] to-primary/[0.08] dark:from-primary/[0.12] dark:via-primary/[0.18] dark:to-primary/[0.12] animate-[gradient-pulse_3s_ease-in-out_infinite]"
                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                              />
                            )}

                            {/* Active left border with gradient */}
                            {isActive && !effectivelyCollapsed && (
                              <motion.div
                                layoutId="sidebar-active-border"
                                className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-gradient-to-b from-primary via-primary/80 to-primary/50"
                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                              />
                            )}

                            {/* Active indicator for collapsed state */}
                            {isActive && effectivelyCollapsed && (
                              <motion.div
                                layoutId="sidebar-active-bg-collapsed"
                                className="absolute inset-0 rounded-lg bg-primary/[0.08] dark:bg-primary/[0.12] border border-primary/20"
                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                              />
                            )}

                            {/* Subtle glow effect on active */}
                            {isActive && (
                              <div className="absolute inset-0 rounded-lg shadow-[0_0_12px_-2px] shadow-primary/10 dark:shadow-primary/15 pointer-events-none" />
                            )}

                            <Icon className={cn(
                              'w-[18px] h-[18px] shrink-0 relative z-10 transition-all duration-300',
                              isActive
                                ? 'text-primary drop-shadow-[0_0_4px] drop-shadow-primary/20'
                                : 'group-hover/item:text-foreground'
                            )} />

                            {!effectivelyCollapsed && (
                              <>
                                <span className="truncate flex-1 text-left relative z-10">{t(item.labelKey)}</span>
                                {/* Favorite pin indicator */}
                                {isFav && (
                                  <Pin className="w-3 h-3 text-primary/50 relative z-10" />
                                )}
                                {/* New Badge with pulse */}
                                {item.isNew && (
                                  <Badge className="h-4 px-1.5 text-[9px] font-bold bg-emerald-500 text-white hover:bg-emerald-500 border-0 leading-none relative z-10 animate-[badge-pulse_2s_ease-in-out_infinite]">
                                    {t('sidebar.newBadge')}
                                  </Badge>
                                )}
                                {/* Agent count badges */}
                                {item.id === 'agents' && onlineAgents > 0 && (
                                  <span className="ml-auto text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-medium relative z-10">
                                    {onlineAgents}
                                  </span>
                                )}
                                {/* ACRP connection count badge with gradient */}
                                {item.id === 'agent-control' && connectedAcrp > 0 && (
                                  <span className="flex items-center gap-1 text-[10px] bg-gradient-to-r from-cyan-500/15 to-blue-500/15 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 rounded-full font-medium relative z-10 border border-cyan-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                                    {connectedAcrp}
                                  </span>
                                )}
                                {item.id === 'chat' && unreadConvs > 0 && (
                                  <span className="text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-full font-medium relative z-10">
                                    {unreadConvs}
                                  </span>
                                )}
                                {/* Keyboard Shortcut - show on hover */}
                                {item.shortcut && (
                                  <span className="text-[9px] text-transparent font-mono ml-1 hidden lg:inline relative z-10 group-hover/item:text-muted-foreground/70 transition-colors duration-200">
                                    {item.shortcut}
                                  </span>
                                )}
                              </>
                            )}
                          </button>
                        );

                        // Always show tooltips when collapsed; when expanded, show tooltips with keyboard shortcut
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
                                {/* Show badge counts in tooltip for collapsed state */}
                                {item.id === 'agents' && onlineAgents > 0 && (
                                  <span className="ml-1.5 text-[10px] text-emerald-500">{onlineAgents} online</span>
                                )}
                                {item.id === 'agent-control' && connectedAcrp > 0 && (
                                  <span className="ml-1.5 text-[10px] text-cyan-500">{connectedAcrp} connected</span>
                                )}
                                {item.shortcut && (
                                  <span className="ml-2 text-[10px] text-muted-foreground font-mono">{item.shortcut}</span>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          );
                        }

                        // When expanded, also add tooltip with keyboard shortcut
                        return (
                          <Tooltip key={item.id}>
                            <TooltipTrigger asChild>{button}</TooltipTrigger>
                            <TooltipContent side="right" className="text-xs">
                              {item.shortcut ? (
                                <span className="font-mono">{item.shortcut}</span>
                              ) : (
                                <span>{t(item.labelKey)}</span>
                              )}
                              {isFav && (
                                <span className="ml-1.5 text-muted-foreground">{t('sidebar.rightClickToRemove')}</span>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </nav>
        </div>

        <Separator />

        {/* Language Switcher */}
        <div className={cn('px-3 py-2', effectivelyCollapsed && 'flex justify-center')}>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-all duration-200 rounded-lg px-2 py-1.5 hover:bg-accent hover:scale-[1.02] w-full',
                  effectivelyCollapsed && 'justify-center px-0'
                )}
                aria-label={t('sidebar.language')}
                title={t('sidebar.language')}
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
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all duration-200 hover:scale-[1.01]',
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

        {/* Keyboard Shortcuts Help button */}
        <div className={cn('px-3 py-1', effectivelyCollapsed && 'flex justify-center')}>
          {effectivelyCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenKeyboardHelp}
                  aria-label={t('keyboard.title')}
                  title={t('keyboard.title')}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 hover:scale-105"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <span>{t('keyboard.title')}</span>
                <span className="ml-2 text-[10px] text-muted-foreground font-mono">⌘/</span>
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={onOpenKeyboardHelp}
              aria-label={t('keyboard.title')}
              title={t('keyboard.title')}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-all duration-200 rounded-lg px-2 py-1.5 hover:bg-accent hover:scale-[1.02] w-full"
            >
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{t('keyboard.title')}</span>
              <span className="ml-auto text-[9px] text-muted-foreground/40 font-mono">⌘/</span>
            </button>
          )}
        </div>

        <Separator />

        {/* User section */}
        <div className={cn('p-3', effectivelyCollapsed && 'flex justify-center')}>
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
            <div className="flex items-center gap-3">
              <div className="relative group/avatar">
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
                <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:scale-110 transition-all duration-200"
                onClick={onLogout}
                aria-label={t('sidebar.logout')}
                title={t('sidebar.logout')}
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
