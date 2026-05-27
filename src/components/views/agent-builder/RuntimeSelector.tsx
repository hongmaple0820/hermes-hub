'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Globe, GitBranch, Lock } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

export type RuntimeType = 'builtin' | 'remote' | 'workflow';

interface RuntimeSelectorProps {
  value: RuntimeType | null;
  onChange: (runtime: RuntimeType) => void;
}

const runtimeOptions: { type: RuntimeType; icon: typeof Bot; emoji: string; color: string; disabled: boolean }[] = [
  { type: 'builtin', icon: Bot, emoji: '🤖', color: 'emerald', disabled: false },
  { type: 'remote', icon: Globe, emoji: '🌐', color: 'amber', disabled: false },
  { type: 'workflow', icon: GitBranch, emoji: '🔄', color: 'violet', disabled: true },
];

const colorClasses: Record<string, { border: string; bg: string; text: string; ring: string }> = {
  emerald: {
    border: 'border-emerald-500',
    bg: 'bg-gradient-to-br from-emerald-50 to-emerald-500/5 dark:from-emerald-950/30 dark:to-emerald-500/5',
    text: 'text-emerald-600',
    ring: 'ring-emerald-500/20',
  },
  amber: {
    border: 'border-amber-500',
    bg: 'bg-gradient-to-br from-amber-50 to-amber-500/5 dark:from-amber-950/30 dark:to-amber-500/5',
    text: 'text-amber-600',
    ring: 'ring-amber-500/20',
  },
  violet: {
    border: 'border-violet-400',
    bg: 'bg-gradient-to-br from-violet-50 to-violet-500/5 dark:from-violet-950/30 dark:to-violet-500/5',
    text: 'text-violet-500',
    ring: 'ring-violet-500/20',
  },
};

export function RuntimeSelector({ value, onChange }: RuntimeSelectorProps) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {runtimeOptions.map((option, index) => {
        const isSelected = value === option.type;
        const colors = colorClasses[option.color];
        const Icon = option.icon;

        return (
          <motion.div
            key={option.type}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
          >
            <Card
              className={cn(
                'relative cursor-pointer transition-all duration-200 rounded-xl overflow-hidden group',
                option.disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:shadow-lg hover:-translate-y-1',
                isSelected && !option.disabled
                  ? `ring-2 ${colors.ring} ${colors.border} ${colors.bg}`
                  : 'border-border hover:border-primary/30'
              )}
              onClick={() => !option.disabled && onChange(option.type)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-lg transition-colors',
                    isSelected ? 'bg-gradient-to-br from-primary/15 to-primary/5' : 'bg-muted',
                    isSelected ? colors.text : 'text-muted-foreground'
                  )}>
                    <span>{option.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={cn(
                        'font-semibold text-sm',
                        isSelected ? colors.text : 'text-foreground'
                      )}>
                        {t(`agentBuilder.runtimeTypes.${option.type}`)}
                      </h3>
                      {option.disabled && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {t('agentBuilder.runtimeTypes.comingSoon')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {t(`agentBuilder.runtimeTypes.${option.type}Desc`)}
                    </p>
                  </div>
                </div>

                {/* Selected indicator */}
                {isSelected && !option.disabled && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={cn(
                      'absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center',
                      colors.bg, colors.text
                    )}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                )}

                {/* Disabled overlay */}
                {option.disabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                    <Lock className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
