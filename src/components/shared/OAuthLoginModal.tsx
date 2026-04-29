'use client';

import { useState, useCallback, useRef } from 'react';
import { useI18n } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, ExternalLink, Copy, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface OAuthLoginModalProps {
  open: boolean;
  onClose: () => void;
  provider: 'codex' | 'nous' | 'copilot';
  title: string;
  description: string;
  onStart: () => Promise<{ deviceCode: string; userCode: string; verificationUri: string; expiresIn: number }>;
  onPoll: (deviceCode: string) => Promise<{ status: string }>;
  onSuccess: () => void;
}

type ModalStep = 'idle' | 'starting' | 'verifying' | 'success' | 'failed';

export function OAuthLoginModal({
  open,
  onClose,
  provider,
  title,
  description,
  onStart,
  onPoll,
  onSuccess,
}: OAuthLoginModalProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<ModalStep>('idle');
  const [deviceCode, setDeviceCode] = useState('');
  const [userCode, setUserCode] = useState('');
  const [verificationUri, setVerificationUri] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    setStep('idle');
    setDeviceCode('');
    setUserCode('');
    setVerificationUri('');
    setErrorMessage('');
    setCopied(false);
    cleanup();
  }, [cleanup]);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const startPolling = useCallback(
    (code: string) => {
      cleanup();
      pollIntervalRef.current = setInterval(async () => {
        if (!mountedRef.current) return;
        try {
          const result = await onPoll(code);
          if (!mountedRef.current) return;

          if (result.status === 'active') {
            setStep('success');
            cleanup();
            onSuccess();
          } else if (result.status === 'expired') {
            setStep('failed');
            setErrorMessage(t('oauth.failed'));
            cleanup();
          } else if (result.status === 'revoked') {
            setStep('failed');
            setErrorMessage(t('oauth.failed'));
            cleanup();
          }
          // status === 'pending' -> keep polling
        } catch (err: any) {
          // Don't fail on individual poll errors
          console.error('OAuth poll error:', err);
        }
      }, 5000);
    },
    [cleanup, onPoll, onSuccess, t]
  );

  const handleStart = async () => {
    setStep('starting');
    setErrorMessage('');

    try {
      const result = await onStart();

      if (!mountedRef.current) return;

      setDeviceCode(result.deviceCode);
      setUserCode(result.userCode);
      setVerificationUri(result.verificationUri);
      setStep('verifying');

      // Start auto-polling
      startPolling(result.deviceCode);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setStep('failed');
      setErrorMessage(err.message || t('oauth.failed'));
    }
  };

  const handleRetry = () => {
    resetState();
    handleStart();
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(userCode);
      setCopied(true);
      toast.success(t('common.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = userCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      toast.success(t('common.copied'));
    }
  };

  const handleOpenUrl = () => {
    window.open(verificationUri, '_blank', 'noopener,noreferrer');
  };

  const getProviderIcon = () => {
    switch (provider) {
      case 'codex':
        return '🤖';
      case 'nous':
        return '🧪';
      case 'copilot':
        return '🐙';
      default:
        return '🔐';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">{getProviderIcon()}</span>
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {/* Step: Idle - Show start button */}
          {step === 'idle' && (
            <div className="flex flex-col items-center py-6">
              <ShieldCheck className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground text-center mb-6">
                {t('oauth.deviceCodeHint')}
              </p>
              <Button onClick={handleStart} className="gap-2">
                <ExternalLink className="w-4 h-4" />
                {t('oauth.connect')}
              </Button>
            </div>
          )}

          {/* Step: Starting - Show loading */}
          {step === 'starting' && (
            <div className="flex flex-col items-center py-6">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                {t('oauth.connect')}...
              </p>
            </div>
          )}

          {/* Step: Verifying - Show user code and verification URL */}
          {step === 'verifying' && (
            <div className="flex flex-col items-center py-4">
              <p className="text-sm text-muted-foreground text-center mb-4">
                {t('oauth.enterCodeAt')}
              </p>

              {/* User Code Display */}
              <div className="relative bg-muted rounded-lg p-4 mb-4 w-full text-center">
                <code className="text-2xl font-mono font-bold tracking-widest">
                  {userCode}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 w-8 h-8"
                  onClick={handleCopyCode}
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {/* Verification URL */}
              <div className="w-full mb-4">
                <p className="text-xs text-muted-foreground mb-1">
                  {t('oauth.openUrl')}:
                </p>
                <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
                  <code className="text-sm font-mono flex-1 truncate">
                    {verificationUri}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 shrink-0"
                    onClick={handleOpenUrl}
                  >
                    <ExternalLink className="w-3 h-3" />
                    {t('oauth.openUrl')}
                  </Button>
                </div>
              </div>

              {/* Polling indicator */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('oauth.polling')}
              </div>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center py-6">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
              <p className="text-lg font-semibold text-emerald-600 mb-2">
                {t('oauth.success')}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {t('oauth.connected')}
              </p>
              <Button variant="outline" onClick={handleClose}>
                {t('common.close')}
              </Button>
            </div>
          )}

          {/* Step: Failed */}
          {step === 'failed' && (
            <div className="flex flex-col items-center py-6">
              <XCircle className="w-16 h-16 text-red-400 mb-4" />
              <p className="text-lg font-semibold text-red-500 mb-2">
                {t('oauth.failed')}
              </p>
              {errorMessage && (
                <p className="text-sm text-muted-foreground mb-4 text-center">
                  {errorMessage}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  {t('oauth.cancel')}
                </Button>
                <Button onClick={handleRetry}>
                  {t('oauth.connect')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
