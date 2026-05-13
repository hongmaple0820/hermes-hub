'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Sparkles, MessageSquare, Globe, Languages, ArrowRight, Settings, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface QuickStartProps {
  onStarted: () => void;
}

export function QuickStart({ onStarted }: QuickStartProps) {
  const { agents, setCurrentView } = useAppStore();
  const { t } = useI18n();
  const [starting, setStarting] = useState(false);

  // Find the default agent (Hermes Assistant) from the store
  const defaultAgent = agents.find((a: any) => a.name === 'Hermes Assistant') || agents[0];

  const handleStart = async () => {
    if (!defaultAgent) {
      // No agent found - try quickstart setup first
      try {
        setStarting(true);
        await api.quickstartSetup();
        onStarted();
      } catch (error: any) {
        toast.error(error.message || 'Setup failed');
      } finally {
        setStarting(false);
      }
      return;
    }

    try {
      setStarting(true);
      // Create a conversation with the default agent
      const result = await api.createConversation({ agentId: defaultAgent.id });
      const convs = await api.getConversations();
      const { setConversations, setSelectedConversationId } = useAppStore.getState();
      setConversations(convs.conversations || []);
      setSelectedConversationId(result.conversation.id);
      onStarted();
    } catch (error: any) {
      toast.error(error.message || 'Failed to start conversation');
    } finally {
      setStarting(false);
    }
  };

  const handleCustomize = () => {
    setCurrentView('agents');
    onStarted();
  };

  const capabilities = [
    { icon: <MessageSquare className="w-4 h-4" />, label: t('quickstart.capChat') },
    { icon: <Globe className="w-4 h-4" />, label: t('quickstart.capSearch') },
    { icon: <Languages className="w-4 h-4" />, label: t('quickstart.capTranslate') },
  ];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="w-full max-w-lg mx-4"
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <Card className="border-2 border-primary/20 shadow-2xl shadow-primary/10 overflow-hidden">
            {/* Gradient top accent */}
            <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-primary to-cyan-500" />

            <CardContent className="p-8">
              {/* Hero icon */}
              <motion.div
                className="flex justify-center mb-6"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 flex items-center justify-center shadow-lg shadow-primary/10">
                    <Bot className="w-10 h-10 text-primary" />
                  </div>
                  <motion.div
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: 'spring', stiffness: 300 }}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </motion.div>
                </div>
              </motion.div>

              {/* Welcome message */}
              <motion.div
                className="text-center mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <h2 className="text-2xl font-bold mb-2">
                  {t('quickstart.welcomeTitle')}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {t('quickstart.welcomeSubtitle')}
                </p>
              </motion.div>

              {/* Default Agent Card */}
              {defaultAgent && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="mb-6"
                >
                  <Card className="border border-border bg-muted/30">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{defaultAgent.name}</p>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">
                            {defaultAgent.mode === 'acrp' ? 'ACRP' : 'Builtin'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {defaultAgent.description || t('quickstart.defaultAgentDesc')}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[10px] text-emerald-600">{t('common.online')}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Capabilities */}
              <motion.div
                className="flex items-center justify-center gap-3 mb-8"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
              >
                {capabilities.map((cap, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background"
                  >
                    <span className="text-primary">{cap.icon}</span>
                    <span className="text-xs text-muted-foreground">{cap.label}</span>
                  </div>
                ))}
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                className="space-y-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
              >
                <Button
                  className="w-full h-12 text-base gap-2 shadow-md hover:shadow-lg transition-shadow"
                  onClick={handleStart}
                  disabled={starting}
                  size="lg"
                >
                  {starting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('quickstart.starting')}
                    </>
                  ) : (
                    <>
                      {t('quickstart.startChat')}
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-10 gap-2"
                  onClick={handleCustomize}
                  disabled={starting}
                >
                  <Settings className="w-4 h-4" />
                  {t('quickstart.customSetup')}
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
