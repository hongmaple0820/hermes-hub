'use client';

import { useEffect, useCallback, useState } from 'react';
import { useI18n } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Keyboard, Navigation, Zap, MessageSquare, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface ShortcutGroup {
  title: string;
  icon: React.ElementType;
  shortcuts: { keys: string; description: string }[];
}

export function KeyboardShortcutsHelp() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  // Listen for ? key press
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing in an input/textarea
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }
    // Ignore if any modifier key is pressed
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === '?' || e.key === '/') {
      // Only trigger on ? (shift + /), not bare /
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        // Check if it's actually a ? by checking shift
        if (e.shiftKey || e.key === '?') {
          e.preventDefault();
          setOpen(prev => !prev);
        }
      }
    }
    if (e.key === 'Escape' && open) {
      setOpen(false);
    }
  }, [open]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Expose open method for external trigger
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__openShortcutsHelp = () => setOpen(true);
    return () => {
      delete (window as unknown as Record<string, unknown>).__openShortcutsHelp;
    };
  }, []);

  const shortcutGroups: ShortcutGroup[] = [
    {
      title: t('shortcuts.navigation'),
      icon: Navigation,
      shortcuts: [
        { keys: '⌘1', description: t('shortcuts.navDashboard') },
        { keys: '⌘2', description: t('shortcuts.navChat') },
        { keys: '⌘3', description: t('shortcuts.navAgentBuilder') },
        { keys: '⌘4', description: t('shortcuts.navToolRegistry') },
        { keys: '⌘5', description: t('shortcuts.navDiscovery') },
        { keys: '⌘6', description: t('shortcuts.navActivity') },
        { keys: '⌘7', description: t('shortcuts.navAgents') },
        { keys: '⌘8', description: t('shortcuts.navSkills') },
        { keys: '⌘9', description: t('shortcuts.navAcrp') },
        { keys: '⌘,', description: t('shortcuts.navSettings') },
      ],
    },
    {
      title: t('shortcuts.actions'),
      icon: Zap,
      shortcuts: [
        { keys: '⌘K', description: t('shortcuts.commandPalette') },
        { keys: '?', description: t('shortcuts.showHelp') },
        { keys: 'Esc', description: t('shortcuts.closeDialog') },
      ],
    },
    {
      title: t('shortcuts.chat'),
      icon: MessageSquare,
      shortcuts: [
        { keys: 'Enter', description: t('shortcuts.sendMessage') },
        { keys: '⇧ + Enter', description: t('shortcuts.newLine') },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            {t('shortcuts.title')}
          </DialogTitle>
          <DialogDescription>{t('shortcuts.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2 max-h-96 overflow-y-auto">
          {shortcutGroups.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <Separator className="mb-4" />}
              <div className="flex items-center gap-2 mb-3">
                <group.icon className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{group.title}</h3>
              </div>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, si) => (
                  <div
                    key={si}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <span className="text-sm text-muted-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.split(' + ').map((key, ki, arr) => (
                        <span key={ki} className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className="px-2 py-0.5 text-xs font-mono bg-muted/50 border-border/80 min-w-[28px] justify-center"
                          >
                            {key}
                          </Badge>
                          {ki < arr.length - 1 && (
                            <span className="text-xs text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center pt-2">
          <p className="text-xs text-muted-foreground">
            {t('shortcuts.pressHint')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
