'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { ArrowLeft, Check, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

import { RuntimeSelector, type RuntimeType } from './agent-builder/RuntimeSelector';
import { IdentityForm, type IdentityData } from './agent-builder/IdentityForm';
import { RuntimeConfig, type RuntimeConfigData } from './agent-builder/RuntimeConfig';
import { ToolBinder, type BoundTool } from './agent-builder/ToolBinder';

const STEPS = ['runtime', 'identity', 'config', 'tools'] as const;
type StepKey = (typeof STEPS)[number];

interface AgentBuilderProps {
  /** Agent ID to edit (null = create mode) */
  editAgentId?: string | null;
  /** Callback when the builder is cancelled/closed */
  onCancel?: () => void;
  /** Callback after successful create/update */
  onSuccess?: () => void;
}

export default function AgentBuilder({ editAgentId, onCancel, onSuccess }: AgentBuilderProps) {
  const { t } = useI18n();
  const { agents, setAgents, providers, setCurrentView } = useAppStore();

  const isEditing = !!editAgentId;
  const editingAgent = isEditing ? agents.find((a: any) => a.id === editAgentId) : null;

  // Current step
  const [currentStep, setCurrentStep] = useState<StepKey>('runtime');

  // Step 1: Runtime type
  const [runtimeType, setRuntimeType] = useState<RuntimeType | null>(
    editingAgent?.runtime === 'remote' ? 'remote' : editingAgent?.runtime === 'workflow' ? 'workflow' : editingAgent ? 'builtin' : null
  );

  // Step 2: Identity
  const [identity, setIdentity] = useState<IdentityData>({
    name: editingAgent?.name || '',
    description: editingAgent?.description || '',
    avatar: editingAgent?.avatar || '🤖',
    systemPrompt: editingAgent?.systemPrompt || '',
    isPublic: editingAgent?.isPublic || false,
  });

  // Step 3: Runtime config
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfigData>({
    builtin: {
      providerId: editingAgent?.providerId || '',
      model: editingAgent?.model || '',
      temperature: editingAgent?.temperature ?? 0.7,
      maxTokens: editingAgent?.maxTokens ?? 2048,
    },
    remote: {
      endpointType: 'http',
      endpointUrl: editingAgent?.callbackUrl || '',
      authToken: editingAgent?.apiKey || '',
    },
  });

  // Step 4: Bound tools
  const [boundTools, setBoundTools] = useState<BoundTool[]>(
    editingAgent?.agentTools?.map((at: any, index: number) => ({
      toolId: at.toolId || at.tool?.id,
      isEnabled: at.isEnabled ?? true,
      priority: at.priority ?? index,
    })) || []
  );

  // Submission state
  const [submitting, setSubmitting] = useState(false);

  // Determine which steps are completed
  const isStepCompleted = useCallback(
    (step: StepKey): boolean => {
      switch (step) {
        case 'runtime':
          return runtimeType !== null;
        case 'identity':
          return identity.name.trim().length > 0;
        case 'config':
          if (runtimeType === 'builtin') return !!runtimeConfig.builtin.providerId;
          if (runtimeType === 'remote') return !!runtimeConfig.remote.endpointUrl;
          if (runtimeType === 'workflow') return false;
          return false;
        case 'tools':
          return true; // Tools are optional
        default:
          return false;
      }
    },
    [runtimeType, identity.name, runtimeConfig]
  );

  const currentStepIndex = STEPS.indexOf(currentStep);

  const canProceed = (): boolean => {
    return isStepCompleted(currentStep);
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const handleStepClick = (step: StepKey) => {
    // Can only go to completed steps or the current step + 1
    const stepIndex = STEPS.indexOf(step);
    const maxAllowed = currentStepIndex + 1;

    // Allow clicking on any completed step or the next step
    if (stepIndex <= maxAllowed || isStepCompleted(step)) {
      setCurrentStep(step);
    }
  };

  const handleSubmit = async () => {
    // Validate
    if (!identity.name.trim()) {
      toast.error(t('agentBuilder.validation.nameRequired'));
      setCurrentStep('identity');
      return;
    }
    if (!runtimeType) {
      toast.error(t('agentBuilder.validation.runtimeRequired'));
      setCurrentStep('runtime');
      return;
    }
    if (runtimeType === 'builtin' && !runtimeConfig.builtin.providerId) {
      toast.error(t('agentBuilder.validation.providerRequired'));
      setCurrentStep('config');
      return;
    }
    if (runtimeType === 'remote' && !runtimeConfig.remote.endpointUrl) {
      toast.error(t('agentBuilder.validation.endpointRequired'));
      setCurrentStep('config');
      return;
    }

    setSubmitting(true);
    try {
      const agentData: any = {
        name: identity.name.trim(),
        description: identity.description,
        avatar: identity.avatar,
        systemPrompt: identity.systemPrompt,
        isPublic: identity.isPublic,
        runtime: runtimeType,
        mode: runtimeType === 'builtin' ? 'builtin' : runtimeType === 'remote' ? 'acrp' : 'builtin',
        // Builtin config
        ...(runtimeType === 'builtin' && {
          providerId: runtimeConfig.builtin.providerId,
          model: runtimeConfig.builtin.model || undefined,
          temperature: runtimeConfig.builtin.temperature,
          maxTokens: runtimeConfig.builtin.maxTokens,
        }),
        // Remote config
        ...(runtimeType === 'remote' && {
          callbackUrl: runtimeConfig.remote.endpointUrl,
          apiKey: runtimeConfig.remote.authToken || undefined,
        }),
        // Tool bindings
        toolIds: boundTools.map((bt) => bt.toolId),
      };

      if (isEditing && editingAgent) {
        const result = await api.updateAgent(editingAgent.id, agentData);
        setAgents(agents.map((a: any) => (a.id === editingAgent.id ? result.agent : a)));
        toast.success(t('agents.updated'));
      } else {
        const result = await api.createAgent(agentData);
        setAgents([result.agent, ...agents]);
        toast.success(t('agents.created'));
      }

      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save agent');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      setCurrentView('agents');
    }
  };

  const stepLabels: Record<StepKey, string> = {
    runtime: t('agentBuilder.steps.runtime'),
    identity: t('agentBuilder.steps.identity'),
    config: t('agentBuilder.steps.config'),
    tools: t('agentBuilder.steps.tools'),
  };

  const stepNumbers: Record<StepKey, number> = {
    runtime: 1,
    identity: 2,
    config: 3,
    tools: 4,
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={handleCancel}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">
            {isEditing ? t('agentBuilder.editTitle') : t('agentBuilder.createTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('agentBuilder.title')}</p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {STEPS.map((step, index) => {
          const completed = isStepCompleted(step);
          const isActive = currentStep === step;
          const isClickable = index <= currentStepIndex + 1 || completed;

          return (
            <div key={step} className="flex items-center">
              <button
                onClick={() => isClickable && handleStepClick(step)}
                disabled={!isClickable}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : completed
                      ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                      : isClickable
                        ? 'bg-muted text-muted-foreground hover:bg-accent'
                        : 'bg-muted/50 text-muted-foreground/40 cursor-not-allowed'
                )}
              >
                <span
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : completed
                        ? 'bg-emerald-500/20'
                        : 'bg-muted-foreground/10'
                  )}
                >
                  {completed && !isActive ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    stepNumbers[step]
                  )}
                </span>
                {stepLabels[step]}
              </button>
              {index < STEPS.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 mx-1 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="rounded-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                  {stepNumbers[currentStep]}
                </span>
                {stepLabels[currentStep]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentStep === 'runtime' && (
                <RuntimeSelector value={runtimeType} onChange={setRuntimeType} />
              )}
              {currentStep === 'identity' && (
                <IdentityForm value={identity} onChange={setIdentity} />
              )}
              {currentStep === 'config' && (
                <RuntimeConfig
                  runtimeType={runtimeType}
                  value={runtimeConfig}
                  onChange={setRuntimeConfig}
                  providers={providers}
                />
              )}
              {currentStep === 'tools' && (
                <ToolBinder boundTools={boundTools} onChange={setBoundTools} />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-6 gap-3">
        <Button variant="outline" onClick={handleCancel} className="rounded-lg">
          {t('agentBuilder.buttons.cancel')}
        </Button>

        <div className="flex items-center gap-3">
          {currentStepIndex > 0 && (
            <Button
              variant="outline"
              onClick={() => setCurrentStep(STEPS[currentStepIndex - 1])}
              className="rounded-lg"
            >
              {t('common.previous')}
            </Button>
          )}

          {currentStepIndex < STEPS.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="rounded-lg gap-1"
            >
              {t('common.next')}
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isEditing ? t('agentBuilder.buttons.saving') : t('agentBuilder.buttons.creating')}
                </>
              ) : (
                isEditing ? t('agentBuilder.buttons.save') : t('agentBuilder.buttons.create')
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
