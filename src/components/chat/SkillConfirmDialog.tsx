'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, Shield, Zap, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface PendingSkill {
  name: string;
  description: string;
  reason: string;
}

interface SkillConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  pendingSkills: PendingSkill[];
  onAllow: (alwaysAllow: boolean) => void;
  onDeny: () => void;
}

// Skill icon mapping
const SKILL_ICONS: Record<string, string> = {
  'web-search': '🔍',
  'translation': '🌐',
  'image-generation': '🎨',
  'code-execution': '💻',
  'weather-query': '🌤️',
  'http-request': '🔗',
  'text-to-speech': '🔊',
  'data-analysis': '📊',
  'document-processing': '📄',
  'email-sender': '📧',
  'database-query': '🗃️',
  'reminder': '⏰',
};

export function SkillConfirmDialog({
  open,
  onOpenChange,
  agentName,
  pendingSkills,
  onAllow,
  onDeny,
}: SkillConfirmDialogProps) {
  const { t } = useI18n();
  const [alwaysAllow, setAlwaysAllow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAllow = () => {
    setLoading(true);
    // Small delay for visual feedback
    setTimeout(() => {
      onAllow(alwaysAllow);
      setLoading(false);
      setAlwaysAllow(false);
    }, 200);
  };

  const handleDeny = () => {
    onDeny();
    setAlwaysAllow(false);
  };

  const getSkillIcon = (name: string) => {
    return SKILL_ICONS[name] || '⚡';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-500" />
            {t('chat.skillWantsToUse')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('chat.skillWantsToUse')}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          <motion.div
            key="skill-confirm-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4 mt-2"
          >
            {/* Agent info */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="text-sm bg-primary/10 text-primary">
                  <Bot className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{agentName}</p>
                <p className="text-xs text-muted-foreground">{t('chat.skillReason')}</p>
              </div>
            </div>

            {/* Skill cards */}
            <div className="space-y-2">
              {pendingSkills.map((skill, index) => (
                <motion.div
                  key={skill.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                >
                  <span className="text-xl shrink-0 mt-0.5">{getSkillIcon(skill.name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{skill.name}</p>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        <Zap className="w-2.5 h-2.5 mr-0.5" />
                        Skill
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {skill.description}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                      {skill.reason}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Always allow checkbox */}
            {pendingSkills.length === 1 && (
              <label className="flex items-center gap-2 cursor-pointer group">
                <div
                  className={cn(
                    'w-4 h-4 rounded border transition-colors flex items-center justify-center',
                    alwaysAllow
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-border group-hover:border-primary/50'
                  )}
                  onClick={() => setAlwaysAllow(!alwaysAllow)}
                >
                  {alwaysAllow && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  {t('chat.alwaysAllow')} <strong>{pendingSkills[0].name}</strong>
                </span>
              </label>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleDeny}
                variant="outline"
                className="flex-1"
                disabled={loading}
              >
                {t('chat.deny')}
              </Button>
              <Button
                onClick={handleAllow}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={loading}
              >
                {loading ? (
                  <motion.div
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                  />
                ) : (
                  t('chat.allow')
                )}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
