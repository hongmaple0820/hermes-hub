'use client';

import { useI18n } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Keyboard, ArrowRight, Command, Search, Settings, X, Navigation, Zap } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  group: 'navigation' | 'actions';
}

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  const { t } = useI18n();

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone/.test(navigator.userAgent);
  const mod = isMac ? '⌘' : 'Ctrl+';

  const shortcuts: ShortcutItem[] = [
    // Navigation
    { keys: [`${mod}1`], description: t('keyboard.nav1'), group: 'navigation' },
    { keys: [`${mod}2`], description: t('keyboard.nav2'), group: 'navigation' },
    { keys: [`${mod}3`], description: t('keyboard.nav3'), group: 'navigation' },
    { keys: [`${mod}4`], description: t('keyboard.nav4'), group: 'navigation' },
    { keys: [`${mod}5`], description: t('keyboard.nav5'), group: 'navigation' },
    { keys: [`${mod}6`], description: t('keyboard.nav6'), group: 'navigation' },
    { keys: [`${mod}7`], description: t('keyboard.nav7'), group: 'navigation' },
    { keys: [`${mod}8`], description: t('keyboard.nav8'), group: 'navigation' },
    // Actions
    { keys: [`${mod}K`], description: t('keyboard.openCommandPalette'), group: 'actions' },
    { keys: [`${mod},`], description: t('keyboard.openSettings'), group: 'actions' },
    { keys: [`${mod}/`], description: t('keyboard.openHelp'), group: 'actions' },
    { keys: ['Esc'], description: t('keyboard.closeDialog'), group: 'actions' },
  ];

  const navShortcuts = shortcuts.filter(s => s.group === 'navigation');
  const actionShortcuts = shortcuts.filter(s => s.group === 'actions');

  const renderKey = (key: string) => (
    <kbd
      className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md
        border border-border bg-muted text-[11px] font-mono text-muted-foreground
        shadow-[0_1px_0_1px] shadow-border/50"
    >
      {key}
    </kbd>
  );

  const renderShortcutRow = (shortcut: ShortcutItem, index: number) => (
    <div
      key={index}
      className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors"
    >
      <span className="text-sm text-foreground">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, ki) => (
          <span key={ki} className="flex items-center gap-1">
            {renderKey(key)}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Keyboard className="w-4 h-4 text-primary" />
            </div>
            {t('keyboard.title')}
          </DialogTitle>
          <DialogDescription>{t('keyboard.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Navigation shortcuts */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Navigation className="w-3.5 h-3.5 text-primary" />
              <h4 className="text-sm font-semibold">{t('keyboard.navigation')}</h4>
            </div>
            <div className="space-y-0.5">
              {navShortcuts.map((shortcut, index) => renderShortcutRow(shortcut, index))}
            </div>
          </div>

          <Separator />

          {/* Action shortcuts */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <h4 className="text-sm font-semibold">{t('keyboard.actions')}</h4>
            </div>
            <div className="space-y-0.5">
              {actionShortcuts.map((shortcut, index) => renderShortcutRow(shortcut, index))}
            </div>
          </div>

          <Separator />

          {/* Footer hint */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground py-1">
            <Command className="w-3 h-3" />
            <span>{isMac ? 'Command' : 'Ctrl'} + key to activate shortcuts</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
