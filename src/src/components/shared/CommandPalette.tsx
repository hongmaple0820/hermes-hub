'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore, ViewMode } from '@/lib/store';
import { useI18n } from '@/i18n';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard, Bot, Server, Puzzle, Monitor, MessageSquare,
  Users, Settings, Plus, Search, Clock, ArrowRight, Download,
  Upload, Wifi,
} from 'lucide-react';

interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  shortcut?: string;
  group: 'navigation' | 'quickActions' | 'recent';
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Track recent actions in memory
const recentActions: { id: string; timestamp: number }[] = [];
const MAX_RECENT = 5;

function addRecent(id: string) {
  const existing = recentActions.findIndex((r) => r.id === id);
  if (existing >= 0) recentActions.splice(existing, 1);
  recentActions.unshift({ id, timestamp: Date.now() });
  if (recentActions.length > MAX_RECENT) recentActions.pop();
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { setCurrentView, agents, skills } = useAppStore();
  const { t } = useI18n();
  const [search, setSearch] = useState('');

  // Reset search via key mechanism - parent can pass a key change to reset

  const navigateTo = useCallback((view: ViewMode) => {
    addRecent(`nav-${view}`);
    setCurrentView(view);
    onOpenChange(false);
  }, [setCurrentView, onOpenChange]);

  const quickAction = useCallback((actionId: string, view: ViewMode) => {
    addRecent(actionId);
    setCurrentView(view);
    onOpenChange(false);
  }, [setCurrentView, onOpenChange]);

  // Build navigation commands
  const navCommands: CommandAction[] = [
    { id: 'nav-dashboard', label: t('commandPalette.dashboard'), icon: LayoutDashboard, action: () => navigateTo('dashboard'), shortcut: '⌘1', group: 'navigation' },
    { id: 'nav-agents', label: t('commandPalette.agents'), icon: Bot, action: () => navigateTo('agents'), shortcut: '⌘2', group: 'navigation' },
    { id: 'nav-providers', label: t('commandPalette.providers'), icon: Server, action: () => navigateTo('providers'), shortcut: '⌘3', group: 'navigation' },
    { id: 'nav-skills', label: t('commandPalette.skills'), icon: Puzzle, action: () => navigateTo('skills'), shortcut: '⌘4', group: 'navigation' },
    { id: 'nav-agent-control', label: t('commandPalette.agentControl'), icon: Monitor, action: () => navigateTo('agent-control'), shortcut: '⌘5', group: 'navigation' },
    { id: 'nav-channels', label: t('commandPalette.channels'), icon: Wifi, action: () => navigateTo('channels'), shortcut: '⌘6', group: 'navigation' },
    { id: 'nav-chat', label: t('commandPalette.chat'), icon: MessageSquare, action: () => navigateTo('chat'), shortcut: '⌘7', group: 'navigation' },
    { id: 'nav-chat-rooms', label: t('commandPalette.chatRooms'), icon: Users, action: () => navigateTo('chat-rooms'), shortcut: '⌘8', group: 'navigation' },
    { id: 'nav-settings', label: t('commandPalette.settings'), icon: Settings, action: () => navigateTo('settings'), shortcut: '⌘,', group: 'navigation' },
  ];

  // Build quick action commands
  const quickCommands: CommandAction[] = [
    { id: 'action-create-agent', label: t('commandPalette.createAgent'), description: t('commandPalette.createAgentDesc'), icon: Plus, action: () => quickAction('action-create-agent', 'agents'), group: 'quickActions' },
    { id: 'action-new-chat', label: t('commandPalette.newChat'), description: t('commandPalette.newChatDesc'), icon: MessageSquare, action: () => quickAction('action-new-chat', 'chat'), group: 'quickActions' },
    { id: 'action-create-room', label: t('commandPalette.createRoom'), description: t('commandPalette.createRoomDesc'), icon: Users, action: () => quickAction('action-create-room', 'chat-rooms'), group: 'quickActions' },
    { id: 'action-export-data', label: t('commandPalette.exportData'), description: t('commandPalette.exportDataDesc'), icon: Download, action: () => quickAction('action-export-data', 'settings'), group: 'quickActions' },
    { id: 'action-import-data', label: t('commandPalette.importData'), description: t('commandPalette.importDataDesc'), icon: Upload, action: () => quickAction('action-import-data', 'settings'), group: 'quickActions' },
  ];

  // Build agent commands
  const agentCommands: CommandAction[] = agents.slice(0, 8).map((agent: any) => ({
    id: `agent-${agent.id}`,
    label: agent.name,
    description: agent.mode === 'acrp' ? 'ACRP Agent' : `Builtin · ${agent.model || 'Default'}`,
    icon: Bot,
    action: () => {
      addRecent(`agent-${agent.id}`);
      useAppStore.getState().setSelectedAgentId(agent.id);
      setCurrentView('agent-detail');
      onOpenChange(false);
    },
    group: 'navigation' as const,
  }));

  // Build skill commands
  const skillCommands: CommandAction[] = skills.slice(0, 8).map((skill: any) => ({
    id: `skill-${skill.id}`,
    label: skill.name,
    description: skill.category || skill.handlerType,
    icon: Puzzle,
    action: () => {
      addRecent(`skill-${skill.id}`);
      setCurrentView('skills');
      onOpenChange(false);
    },
    group: 'navigation' as const,
  }));

  // Build recent commands
  const recentCommands: CommandAction[] = recentActions
    .map((r) => {
      const allCommands = [...navCommands, ...quickCommands, ...agentCommands, ...skillCommands];
      return allCommands.find((c) => c.id === r.id);
    })
    .filter((c): c is CommandAction => !!c);

  const formatShortcut = (shortcut?: string) => {
    if (!shortcut) return null;
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone/.test(navigator.userAgent);
    return shortcut.replace(/⌘/g, isMac ? '⌘' : 'Ctrl+');
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t('commandPalette.placeholder')} value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>{t('commandPalette.noResults')}</CommandEmpty>

        {/* Recent Actions */}
        {recentCommands.length > 0 && (
          <>
            <CommandGroup heading={t('commandPalette.recent')}>
              {recentCommands.map((cmd) => (
                <CommandItem key={cmd.id} onSelect={cmd.action}>
                  <cmd.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{cmd.label}</span>
                  {cmd.shortcut && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatShortcut(cmd.shortcut)}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Navigation */}
        <CommandGroup heading={t('commandPalette.navigation')}>
          {navCommands.map((cmd) => (
            <CommandItem key={cmd.id} onSelect={cmd.action}>
              <cmd.icon className="w-4 h-4 shrink-0" />
              <span>{cmd.label}</span>
              {cmd.shortcut && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatShortcut(cmd.shortcut)}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Agents */}
        {agentCommands.length > 0 && (
          <CommandGroup heading={t('commandPalette.agents')}>
            {agentCommands.map((cmd) => (
              <CommandItem key={cmd.id} onSelect={cmd.action}>
                <cmd.icon className="w-4 h-4 shrink-0" />
                <div className="flex flex-col">
                  <span className="truncate">{cmd.label}</span>
                  {cmd.description && (
                    <span className="text-xs text-muted-foreground truncate">{cmd.description}</span>
                  )}
                </div>
                <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Skills */}
        {skillCommands.length > 0 && (
          <CommandGroup heading={t('commandPalette.skills')}>
            {skillCommands.map((cmd) => (
              <CommandItem key={cmd.id} onSelect={cmd.action}>
                <cmd.icon className="w-4 h-4 shrink-0" />
                <div className="flex flex-col">
                  <span className="truncate">{cmd.label}</span>
                  {cmd.description && (
                    <span className="text-xs text-muted-foreground truncate">{cmd.description}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Quick Actions */}
        <CommandGroup heading={t('commandPalette.quickActions')}>
          {quickCommands.map((cmd) => (
            <CommandItem key={cmd.id} onSelect={cmd.action}>
              <cmd.icon className="w-4 h-4 shrink-0" />
              <div className="flex flex-col">
                <span>{cmd.label}</span>
                {cmd.description && (
                  <span className="text-xs text-muted-foreground">{cmd.description}</span>
                )}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
