'use client';

import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Loader2, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancelRun?: () => void;
  disabled?: boolean;
  isRunInProgress?: boolean;
}

export function ChatInput({ value, onChange, onSend, onCancelRun, disabled, isRunInProgress }: ChatInputProps) {
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
      if (!disabled && !isRunInProgress && value.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="border-t border-border bg-card/50 px-3 py-2.5 sticky bottom-0">
      {/* Run in progress indicator with cancel button */}
      {isRunInProgress && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
          <span className="text-[11px] text-amber-600 dark:text-amber-400">
            {t('chat2.runInProgress')}
          </span>
          {onCancelRun && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-destructive"
              onClick={onCancelRun}
            >
              <Square className="w-3 h-3 fill-current" />
              {t('chat2.stopRun')}
            </Button>
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Attach button */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 shrink-0 text-muted-foreground hover:text-foreground"
          disabled={isRunInProgress || disabled}
          title={t('chat2.attachFile')}
        >
          <Paperclip className="w-4 h-4" />
        </Button>

        {/* Textarea */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            placeholder={isRunInProgress ? t('chat2.runInProgress') : t('chat2.typeMessage')}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRunInProgress || disabled}
            rows={1}
            className="resize-none min-h-[36px] max-h-[96px] py-2 text-sm pr-2"
          />
        </div>

        {/* Send / Stop button */}
        {isRunInProgress ? (
          <Button
            size="icon"
            variant="outline"
            className="w-8 h-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onCancelRun}
            title={t('chat2.cancelRun')}
          >
            <Square className="w-4 h-4 fill-current" />
          </Button>
        ) : (
          <Button
            size="icon"
            className={cn(
              'w-8 h-8 shrink-0',
              value.trim() && !disabled
                ? 'bg-primary hover:bg-primary/90'
                : 'bg-muted text-muted-foreground'
            )}
            onClick={onSend}
            disabled={disabled || !value.trim()}
          >
            {disabled ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
