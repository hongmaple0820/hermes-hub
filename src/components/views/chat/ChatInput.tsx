'use client';

import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  isRunInProgress?: boolean;
}

export function ChatInput({ value, onChange, onSend, disabled, isRunInProgress }: ChatInputProps) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      const maxHeight = 4 * 24; // ~4 lines
      ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px';
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSend();
      }
    }
  };

  const isDisabled = disabled || isRunInProgress;

  return (
    <div className="border-t border-border bg-card/50 px-3 py-2.5">
      {/* Run in progress indicator */}
      {isRunInProgress && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
          <span className="text-[11px] text-amber-600 dark:text-amber-400">
            {t('chat2.runInProgress')}
          </span>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Attach button */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 shrink-0 text-muted-foreground hover:text-foreground"
          disabled={isDisabled}
          title={t('chat2.attachFile')}
        >
          <Paperclip className="w-4 h-4" />
        </Button>

        {/* Textarea */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            placeholder={isDisabled ? t('chat2.runInProgress') : t('chat2.typeMessage')}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            rows={1}
            className="resize-none min-h-[36px] max-h-[96px] py-2 text-sm pr-2"
          />
        </div>

        {/* Send button */}
        <Button
          size="icon"
          className={cn(
            'w-8 h-8 shrink-0',
            value.trim() && !isDisabled
              ? 'bg-primary hover:bg-primary/90'
              : 'bg-muted text-muted-foreground'
          )}
          onClick={onSend}
          disabled={isDisabled || !value.trim()}
        >
          {disabled ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
