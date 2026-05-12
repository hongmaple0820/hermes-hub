'use client';

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Bot,
  Server,
  Puzzle,
  ArrowRight,
  ArrowLeft,
  SkipForward,
  CheckCircle2,
  Wifi,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ONBOARDING_KEY = 'hermes_onboarding_completed';

interface WelcomeOnboardingProps {
  open: boolean;
  onComplete: () => void;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

export function WelcomeOnboarding({ open, onComplete }: WelcomeOnboardingProps) {
  const { t } = useI18n();
  const { setCurrentView, setShowCreateDialog } = useAppStore();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const totalSteps = 4;

  const handleFinish = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    onComplete();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (step < totalSteps - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    } else {
      handleFinish();
    }
  }, [step, handleFinish]);

  const handleBack = useCallback(() => {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  }, [step]);

  const handleSkip = useCallback(() => {
    handleFinish();
  }, [handleFinish]);

  const handleCtaAction = useCallback(
    (action: string) => {
      handleFinish();
      // Navigate after a tick so state updates first
      setTimeout(() => {
        switch (action) {
          case 'create-agent':
            setCurrentView('agents');
            setShowCreateDialog('agent');
            break;
          case 'add-provider':
            setCurrentView('providers');
            setShowCreateDialog('provider');
            break;
          case 'browse-skills':
            setCurrentView('skills');
            break;
        }
      }, 100);
    },
    [handleFinish, setCurrentView, setShowCreateDialog]
  );

  const steps = [
    {
      icon: Sparkles,
      title: t('onboarding.step1Title'),
      description: t('onboarding.step1Desc'),
      gradient: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-500/10',
      iconColor: 'text-amber-600 dark:text-amber-400',
      ctaLabel: t('onboarding.getStarted'),
      ctaAction: null, // Just goes to next step
    },
    {
      icon: Bot,
      title: t('onboarding.step2Title'),
      description: t('onboarding.step2Desc'),
      gradient: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      ctaLabel: t('onboarding.createAgent'),
      ctaAction: 'create-agent',
      extra: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium">{t('onboarding.builtinMode')}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t('onboarding.builtinModeDesc')}</p>
            </CardContent>
          </Card>
          <Card className="border-cyan-200 dark:border-cyan-800 bg-cyan-50/50 dark:bg-cyan-950/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Wifi className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span className="text-sm font-medium">{t('onboarding.acrpMode')}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t('onboarding.acrpModeDesc')}</p>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      icon: Server,
      title: t('onboarding.step3Title'),
      description: t('onboarding.step3Desc'),
      gradient: 'from-violet-500 to-purple-500',
      bgColor: 'bg-violet-500/10',
      iconColor: 'text-violet-600 dark:text-violet-400',
      ctaLabel: t('onboarding.addProvider'),
      ctaAction: 'add-provider',
      extra: (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {['OpenAI', 'Anthropic', 'Google', 'Ollama', 'Z-AI', 'Custom'].map((provider) => (
            <span
              key={provider}
              className="text-xs px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10 text-muted-foreground"
            >
              {provider}
            </span>
          ))}
        </div>
      ),
    },
    {
      icon: Puzzle,
      title: t('onboarding.step4Title'),
      description: t('onboarding.step4Desc'),
      gradient: 'from-rose-500 to-pink-500',
      bgColor: 'bg-rose-500/10',
      iconColor: 'text-rose-600 dark:text-rose-400',
      ctaLabel: t('onboarding.browseSkills'),
      ctaAction: 'browse-skills',
      extra: (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {[
            { name: 'Web Search', icon: '🔍' },
            { name: 'Code Runner', icon: '💻' },
            { name: 'Email Sender', icon: '📧' },
            { name: 'Data Analysis', icon: '📊' },
            { name: 'Image Gen', icon: '🎨' },
            { name: 'File Manager', icon: '📁' },
          ].map((skill) => (
            <span
              key={skill.name}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/10 flex items-center gap-1"
            >
              <span>{skill.icon}</span>
              {skill.name}
            </span>
          ))}
        </div>
      ),
    },
  ];

  const currentStep = steps[step];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleSkip()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 pt-6 pb-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className="flex items-center"
            >
              <button
                onClick={() => {
                  if (i < step) {
                    setDirection(-1);
                    setStep(i);
                  } else if (i > step) {
                    setDirection(1);
                    setStep(i);
                  }
                }}
                className="focus:outline-none"
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300',
                    i < step
                      ? 'bg-primary text-primary-foreground'
                      : i === step
                        ? `bg-gradient-to-r ${currentStep.gradient} text-white ring-2 ring-primary/20 ring-offset-2 ring-offset-background`
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {i < step ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    i + 1
                  )}
                </div>
              </button>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'w-6 h-0.5 mx-1 transition-all duration-300',
                    i < step ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content with slide animation */}
        <div className="relative min-h-[320px] overflow-hidden px-6">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="flex flex-col items-center text-center py-4"
            >
              {/* Icon */}
              <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center mb-4', currentStep.bgColor)}>
                <currentStep.icon className={cn('w-8 h-8', currentStep.iconColor)} />
              </div>

              {/* Title */}
              <DialogHeader className="mb-2">
                <DialogTitle className="text-xl">{currentStep.title}</DialogTitle>
                {step === 0 && (
                  <DialogDescription className="text-base font-medium text-primary/80 mt-1">
                    {t('onboarding.welcome')}
                  </DialogDescription>
                )}
              </DialogHeader>

              {/* Description */}
              <p className="text-sm text-muted-foreground max-w-sm">
                {step === 0 ? t('onboarding.welcomeDesc') : currentStep.description}
              </p>

              {/* Extra content per step */}
              {currentStep.extra}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer with navigation */}
        <div className="flex items-center justify-between px-6 pb-6 pt-2 border-t border-border/50">
          {/* Skip button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-muted-foreground gap-1"
          >
            <SkipForward className="w-3.5 h-3.5" />
            {t('onboarding.skip')}
          </Button>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBack}
                className="gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t('onboarding.back')}
              </Button>
            )}
            {step === totalSteps - 1 ? (
              <Button
                size="sm"
                onClick={handleFinish}
                className={cn('gap-1 bg-gradient-to-r', currentStep.gradient)}
              >
                {t('onboarding.finish')}
              </Button>
            ) : step === 0 ? (
              <Button
                size="sm"
                onClick={handleNext}
                className={cn('gap-1 bg-gradient-to-r', currentStep.gradient)}
              >
                {t('onboarding.getStarted')}
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleNext}
                  className="gap-1"
                >
                  {t('onboarding.next')}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
                {currentStep.ctaAction && (
                  <Button
                    size="sm"
                    onClick={() => handleCtaAction(currentStep.ctaAction!)}
                    className={cn('gap-1 bg-gradient-to-r', currentStep.gradient)}
                  >
                    {currentStep.ctaLabel}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Check if onboarding has been completed
 */
export function isOnboardingCompleted(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}
