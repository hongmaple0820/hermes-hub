'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Check, Copy, Eye, EyeOff, Star } from 'lucide-react';
import { toast } from 'sonner';

// ─── Status Dot ────────────────────────────────────────────────

export function StatusDot({ status, pulse }: { status: 'connected' | 'registering' | 'disconnected' | 'error'; pulse?: boolean }) {
  const colorMap: Record<string, string> = {
    connected: 'bg-green-500',
    registering: 'bg-yellow-500',
    disconnected: 'bg-gray-400',
    error: 'bg-red-500',
  };
  const labelMap: Record<string, string> = {
    connected: 'skillProtocol.wsConnected',
    registering: 'skillProtocol.wsRegistering',
    disconnected: 'skillProtocol.wsDisconnected',
    error: 'skillProtocol.wsError',
  };
  const { t } = useI18n();
  const color = colorMap[status] || 'bg-gray-400';
  const label = t(labelMap[status] || 'skillProtocol.wsDisconnected');

  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2.5 w-2.5">
        {pulse && status === 'connected' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 shrink-0 ${color}`} />
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Copy Button ───────────────────────────────────────────────

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t('common.copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={handleCopy}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {label && <span>{label}</span>}
    </Button>
  );
}

// ─── Monospace Field ───────────────────────────────────────────

export function MonospaceField({ value, masked, label, copyLabel }: { value: string; masked?: boolean; label: string; copyLabel?: string }) {
  const [show, setShow] = useState(false);
  const display = masked && !show ? value.slice(0, 8) + '••••••••' : value;

  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md font-mono break-all select-all">
          {display}
        </code>
        {masked && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => setShow(!show)}>
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </Button>
        )}
        <CopyButton text={value} label={copyLabel} />
      </div>
    </div>
  );
}

// ─── Code Block with Copy ──────────────────────────────────────

export function CodeBlock({ code, language, filename }: { code: string; language: string; filename?: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success(t('skills.copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg overflow-hidden border border-gray-700 dark:border-gray-600">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-gray-700 text-gray-300 border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
            {language}
          </Badge>
          {filename && (
            <span className="text-xs text-gray-400 font-mono">{filename}</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-gray-400 hover:text-gray-200 gap-1"
          onClick={handleCopy}
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? t('skills.copied') : t('skills.copyCode')}
        </Button>
      </div>
      <pre className="text-xs bg-gray-900 dark:bg-gray-950 p-4 overflow-x-auto font-mono whitespace-pre-wrap text-gray-300">
        {code}
      </pre>
    </div>
  );
}

// ─── Skill Rating ──────────────────────────────────────────────

export function SkillRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star key={`full-${i}`} className="w-3 h-3 fill-amber-400 text-amber-400" />
      ))}
      {hasHalf && (
        <div className="relative w-3 h-3">
          <Star className="w-3 h-3 text-amber-400" />
          <div className="absolute inset-0 overflow-hidden w-1.5">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          </div>
        </div>
      )}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star key={`empty-${i}`} className="w-3 h-3 text-muted-foreground/30" />
      ))}
      <span className="text-[10px] text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

// ─── Skill Card Skeleton ───────────────────────────────────────

export function SkillCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="h-1 w-full bg-muted animate-pulse" />
      <div className="flex flex-col space-y-1.5 p-6 pb-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
            <div className="flex gap-2">
              <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              <div className="h-4 w-12 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
      <div className="p-6 pt-0 flex-1 flex flex-col">
        <div className="space-y-2 mb-4 flex-1">
          <div className="h-3 bg-muted rounded animate-pulse w-full" />
          <div className="h-3 bg-muted rounded animate-pulse w-4/5" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-3 w-10 bg-muted rounded animate-pulse" />
          <div className="h-7 w-16 bg-muted rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
