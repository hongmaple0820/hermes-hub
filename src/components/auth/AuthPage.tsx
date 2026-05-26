'use client';

import { useState, useCallback, useMemo } from 'react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Zap,
  Languages,
  Eye,
  EyeOff,
  Bot,
  Puzzle,
  MessageSquare,
  Monitor,
  Loader2,
  Github,
  Sparkles,
  Shield,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface AuthPageProps {
  onAuth: (email: string, password: string, isRegister: boolean, name?: string) => Promise<void>;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
}

const featureHighlights = [
  { icon: Bot, key: 'featureAgents', color: 'from-blue-400 to-blue-600' },
  { icon: Puzzle, key: 'featureSkills', color: 'from-purple-400 to-purple-600' },
  { icon: MessageSquare, key: 'featureChat', color: 'from-emerald-400 to-emerald-600' },
  { icon: Monitor, key: 'featureProtocol', color: 'from-amber-400 to-amber-600' },
] as const;

// Password strength calculator
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' };

  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'weak', color: 'bg-red-500' };
  if (score <= 2) return { score, label: 'fair', color: 'bg-yellow-500' };
  return { score, label: 'strong', color: 'bg-emerald-500' };
}

// Floating decorative orb component
function FloatingOrb({
  className,
  size,
  delay = 0,
  duration = 20,
}: {
  className?: string;
  size: number;
  delay?: number;
  duration?: number;
}) {
  return (
    <motion.div
      className={`absolute rounded-full ${className ?? ''}`}
      style={{ width: size, height: size }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: [0.3, 0.6, 0.3],
        scale: [0.9, 1.1, 0.9],
        y: [0, -20, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      }}
    />
  );
}

export function AuthPage({ onAuth }: AuthPageProps) {
  const { t, locale, setLocale, locales } = useI18n();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const validate = useCallback((): FormErrors => {
    const newErrors: FormErrors = {};
    if (isRegister && !name.trim()) {
      newErrors.name = t('auth.name') + ' is required';
    }
    if (!email.trim()) {
      newErrors.email = t('auth.email') + ' is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('auth.email') + ' is invalid';
    }
    if (!password) {
      newErrors.password = t('auth.password') + ' is required';
    } else if (password.length < 6) {
      newErrors.password = t('auth.passwordMinLength');
    }
    return newErrors;
  }, [isRegister, name, email, password, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setLoading(true);
    try {
      await onAuth(email, password, isRegister, name);
    } catch {
      setErrors({ email: t('auth.authFailed') });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast.info(t('auth.comingSoon'));
  };

  const handleSocialLogin = (provider: string) => {
    toast.info(`${provider} ${t('auth.comingSoon')}`);
  };

  const handleTermsClick = (type: string) => {
    toast.info(`${type} ${t('auth.comingSoon')}`);
  };

  const handleTabChange = (value: string) => {
    setIsRegister(value === 'register');
    setErrors({});
    setShowPassword(false);
  };

  // Google SVG icon component
  const GoogleIcon = () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );

  return (
    <motion.div
      className="min-h-screen flex relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      {/* Global background with dot pattern */}
      <div className="absolute inset-0 bg-background" />
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Language Switcher - Fixed top right */}
      <div className="fixed top-4 right-4 z-50">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-background/60 backdrop-blur-md border-border/50 hover:bg-background/80 shadow-sm"
            >
              <Languages className="w-4 h-4" />
              {locales.find((l) => l.code === locale)?.label}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1 backdrop-blur-md bg-popover/90">
            {locales.map((l) => (
              <button
                key={l.code}
                onClick={() => setLocale(l.code)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  locale === l.code
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <span>{l.label}</span>
                {locale === l.code && <span className="ml-auto text-xs">&#10003;</span>}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* Left Decorative Panel - Desktop only */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden">
        {/* Animated mesh gradient background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800" />
          {/* Animated gradient overlay */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, rgba(16,185,129,0.3) 0%, rgba(6,182,212,0.2) 30%, rgba(99,102,241,0.15) 60%, rgba(16,185,129,0.25) 100%)',
            }}
            animate={{
              backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>

        {/* Floating decorative orbs */}
        <FloatingOrb
          className="bg-white/10 blur-xl"
          size={300}
          delay={0}
          duration={18}
        />
        <div className="absolute top-[8%] left-[12%]">
          <FloatingOrb
            className="bg-white/20 blur-lg"
            size={120}
            delay={2}
            duration={12}
          />
        </div>
        <div className="absolute top-[60%] right-[8%]">
          <FloatingOrb
            className="bg-white/15 blur-xl"
            size={200}
            delay={4}
            duration={16}
          />
        </div>
        <div className="absolute bottom-[15%] left-[20%]">
          <FloatingOrb
            className="bg-cyan-300/10 blur-lg"
            size={150}
            delay={1}
            duration={14}
          />
        </div>
        <div className="absolute top-[30%] right-[30%]">
          <FloatingOrb
            className="bg-emerald-300/10 blur-xl"
            size={180}
            delay={3}
            duration={20}
          />
        </div>

        {/* Geometric shapes */}
        <div className="absolute inset-0">
          {/* Circle 1 - top left */}
          <motion.div
            className="absolute top-[12%] left-[8%] w-16 h-16 rounded-full border-2 border-white/15"
            animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Hexagon 1 - top right */}
          <motion.div
            className="absolute top-[18%] right-[12%] w-12 h-12 border-2 border-white/10"
            style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
            animate={{ y: [0, -20, 0], rotate: [0, -8, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />
          {/* Circle 2 - middle left */}
          <motion.div
            className="absolute top-[50%] left-[5%] w-20 h-20 rounded-full bg-white/5"
            animate={{ y: [0, -18, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          />
          {/* Hexagon 2 - bottom center */}
          <motion.div
            className="absolute bottom-[20%] left-[40%] w-14 h-14 border-2 border-white/10 rotate-30"
            style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
            animate={{ y: [0, -15, 0], rotate: [30, 35, 30] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />
          {/* Small decorative dots */}
          <motion.div
            className="absolute top-[70%] right-[20%] w-2 h-2 rounded-full bg-white/30"
            animate={{ opacity: [0.3, 0.8, 0.3], scale: [1, 1.3, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-[35%] left-[45%] w-1.5 h-1.5 rounded-full bg-white/25"
            animate={{ opacity: [0.2, 0.6, 0.2], scale: [1, 1.5, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />
          <motion.div
            className="absolute bottom-[40%] right-[35%] w-2.5 h-2.5 rounded-full bg-white/20"
            animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.2, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Logo with glow animation */}
            <motion.div
              className="flex items-center gap-4 mb-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <motion.div
                className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25 shadow-lg shadow-white/5 relative"
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Zap className="w-8 h-8 text-white" />
                {/* Subtle glow ring */}
                <motion.div
                  className="absolute inset-0 rounded-2xl border border-white/20"
                  animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.08, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.div>
              <div>
                <h1 className="text-4xl font-bold text-white tracking-tight">
                  <span className="bg-gradient-to-r from-white via-white to-white/80 bg-clip-text">
                    Hermes
                  </span>{' '}
                  <span className="bg-gradient-to-r from-emerald-200 to-cyan-200 bg-clip-text text-transparent">
                    Hub
                  </span>
                </h1>
              </div>
            </motion.div>

            {/* Tagline */}
            <motion.p
              className="text-white/80 text-lg mb-10 leading-relaxed max-w-md font-light"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {t('auth.subtitle')}
            </motion.p>

            {/* Feature Highlights with staggered animations */}
            <div className="space-y-4">
              {featureHighlights.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.key}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.5 + index * 0.12,
                      ease: [0.25, 0.46, 0.45, 0.94],
                    }}
                    whileHover={{ x: 4 }}
                    className="flex items-center gap-4 group cursor-default"
                  >
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.color} backdrop-blur-sm flex items-center justify-center shadow-lg shrink-0 relative overflow-hidden`}
                    >
                      <Icon className="w-5 h-5 text-white relative z-10" />
                      {/* Shimmer effect on hover */}
                      <motion.div
                        className="absolute inset-0 bg-white/20"
                        initial={{ x: '-100%' }}
                        whileHover={{ x: '100%' }}
                        transition={{ duration: 0.5 }}
                      />
                      {/* Gentle pulse */}
                      <motion.div
                        className="absolute inset-0 rounded-xl"
                        animate={{ opacity: [0, 0.15, 0] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: index * 0.3 }}
                      />
                    </div>
                    <span className="text-white/90 font-medium text-[15px] group-hover:text-white transition-colors">
                      {t(`auth.${feature.key}`)}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {/* Trust indicators */}
            <motion.div
              className="mt-10 flex items-center gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.2 }}
            >
              <div className="flex items-center gap-1.5 text-white/50 text-xs">
                <Shield className="w-3.5 h-3.5" />
                <span>End-to-end encrypted</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/50 text-xs">
                <Globe className="w-3.5 h-3.5" />
                <span>Open protocol</span>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom decorative line with shimmer */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        {/* Top-right corner accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent" />
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center relative p-4 sm:p-6 lg:p-8">
        {/* Right panel ambient gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-accent/5" />
        {/* Subtle ambient orbs on right side */}
        <div className="absolute top-[10%] right-[10%]">
          <FloatingOrb className="bg-primary/5 blur-3xl" size={250} delay={1} duration={22} />
        </div>
        <div className="absolute bottom-[15%] left-[10%]">
          <FloatingOrb className="bg-emerald-500/5 blur-3xl" size={200} delay={3} duration={18} />
        </div>

        <div className="w-full max-w-md relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={isRegister ? 'register' : 'login'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {/* Mobile Header */}
              <motion.div
                className="flex flex-col items-center mb-8 lg:hidden"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <motion.div
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20 relative"
                  whileTap={{ scale: 0.95 }}
                >
                  <Zap className="w-8 h-8 text-white" />
                  <motion.div
                    className="absolute inset-0 rounded-2xl border border-white/20"
                    animate={{ opacity: [0.2, 0.5, 0.2] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </motion.div>
                <h1 className="text-2xl font-bold tracking-tight">
                  <span>Hermes </span>
                  <span className="bg-gradient-to-r from-emerald-500 to-cyan-600 bg-clip-text text-transparent">
                    Hub
                  </span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">{t('auth.subtitle')}</p>
              </motion.div>

              {/* Desktop Header inside form area */}
              <motion.div
                className="hidden lg:block mb-8"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <h2 className="text-2xl font-bold tracking-tight">
                  {isRegister ? t('auth.createAccount') : t('auth.welcomeBack')}
                </h2>
                <p className="text-muted-foreground text-sm mt-1.5">
                  {isRegister ? t('auth.signUp') : t('auth.signIn')}
                </p>
              </motion.div>

              {/* Card with frosted glass effect and subtle glow */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <Card className="shadow-2xl border-border/40 bg-card/70 backdrop-blur-xl relative overflow-hidden">
                  {/* Subtle border glow effect */}
                  <div className="absolute inset-0 rounded-xl border border-primary/10 pointer-events-none" />
                  {/* Top accent gradient */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

                  <CardContent className="pt-6 relative z-10">
                    <Tabs
                      value={isRegister ? 'register' : 'login'}
                      onValueChange={handleTabChange}
                    >
                      <TabsList className="w-full mb-6 bg-muted/50 backdrop-blur-sm">
                        <TabsTrigger
                          value="login"
                          className="flex-1 transition-all data-[state=active]:shadow-sm"
                        >
                          {t('auth.signIn')}
                        </TabsTrigger>
                        <TabsTrigger
                          value="register"
                          className="flex-1 transition-all data-[state=active]:shadow-sm"
                        >
                          {t('auth.signUp')}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    {/* Social Login Buttons */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2 w-full bg-background/50 backdrop-blur-sm border-border/50 hover:bg-background/80 transition-all duration-200"
                          onClick={() => handleSocialLogin(t('auth.github'))}
                        >
                          <Github className="w-4 h-4" />
                          {t('auth.github')}
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2 w-full bg-background/50 backdrop-blur-sm border-border/50 hover:bg-background/80 transition-all duration-200"
                          onClick={() => handleSocialLogin(t('auth.google'))}
                        >
                          <GoogleIcon />
                          {t('auth.google')}
                        </Button>
                      </motion.div>
                    </div>

                    {/* Divider */}
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/60" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card/80 backdrop-blur-sm px-3 text-muted-foreground">
                          {isRegister ? t('auth.signUp') : t('auth.signIn')} with email
                        </span>
                      </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Name field - Register only */}
                      <AnimatePresence>
                        {isRegister && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginBottom: 0 }}
                            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="space-y-2 overflow-hidden"
                          >
                            <Label htmlFor="name" className="text-sm font-medium">
                              {t('auth.name')}
                            </Label>
                            <Input
                              id="name"
                              placeholder={t('auth.namePlaceholder')}
                              value={name}
                              onChange={(e) => {
                                setName(e.target.value);
                                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                              }}
                              className={`transition-all duration-200 bg-background/50 border-border/50 focus:bg-background/80 ${
                                errors.name ? 'border-destructive focus-visible:ring-destructive/30' : ''
                              }`}
                              required
                            />
                            {errors.name && (
                              <motion.p
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-xs text-destructive"
                              >
                                {errors.name}
                              </motion.p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Email field */}
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-medium">
                          {t('auth.email')}
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder={t('auth.emailPlaceholder')}
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                          }}
                          className={`transition-all duration-200 bg-background/50 border-border/50 focus:bg-background/80 ${
                            errors.email ? 'border-destructive focus-visible:ring-destructive/30' : ''
                          }`}
                          required
                        />
                        {errors.email && (
                          <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-destructive"
                          >
                            {errors.email}
                          </motion.p>
                        )}
                      </div>

                      {/* Password field */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password" className="text-sm font-medium">
                            {t('auth.password')}
                          </Label>
                          {!isRegister && (
                            <button
                              type="button"
                              onClick={handleForgotPassword}
                              className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                            >
                              {t('auth.forgotPassword')}
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder={t('auth.passwordPlaceholder')}
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                            }}
                            className={`pr-10 transition-all duration-200 bg-background/50 border-border/50 focus:bg-background/80 ${
                              errors.password ? 'border-destructive focus-visible:ring-destructive/30' : ''
                            }`}
                            required
                            minLength={6}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {errors.password && (
                          <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-destructive"
                          >
                            {errors.password}
                          </motion.p>
                        )}

                        {/* Password Strength Indicator - Register only */}
                        <AnimatePresence>
                          {isRegister && password && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25, ease: 'easeInOut' }}
                              className="overflow-hidden"
                            >
                              <div className="space-y-1.5 pt-1">
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4].map((segment) => (
                                    <motion.div
                                      key={segment}
                                      className={`h-1.5 flex-1 rounded-full ${
                                        passwordStrength.score >= segment
                                          ? passwordStrength.color
                                          : 'bg-muted/50'
                                      }`}
                                      initial={{ scaleX: 0 }}
                                      animate={{ scaleX: 1 }}
                                      transition={{ duration: 0.3, delay: segment * 0.05 }}
                                      style={{ originX: 0 }}
                                    />
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {t('auth.passwordStrength')}:{' '}
                                  <span
                                    className={
                                      passwordStrength.label === 'weak'
                                        ? 'text-red-500 font-medium'
                                        : passwordStrength.label === 'fair'
                                          ? 'text-yellow-500 font-medium'
                                          : 'text-emerald-500 font-medium'
                                    }
                                  >
                                    {t(`auth.${passwordStrength.label}`)}
                                  </span>
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Remember me - Login only */}
                      <AnimatePresence>
                        {!isRegister && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="flex items-center gap-2 overflow-hidden"
                          >
                            <Checkbox
                              id="remember"
                              checked={rememberMe}
                              onCheckedChange={(checked) => setRememberMe(checked === true)}
                            />
                            <Label
                              htmlFor="remember"
                              className="text-sm text-muted-foreground cursor-pointer select-none"
                            >
                              {t('auth.rememberMe')}
                            </Label>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Submit button */}
                      <motion.div whileHover={{ scale: loading ? 1 : 1.01 }} whileTap={{ scale: loading ? 1 : 0.99 }}>
                        <Button
                          type="submit"
                          className="w-full relative overflow-hidden bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 transition-all duration-300 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
                          disabled={loading}
                        >
                          {/* Shimmer effect on idle */}
                          {!loading && (
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                              animate={{ x: ['-100%', '200%'] }}
                              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
                            />
                          )}
                          {loading ? (
                            <span className="flex items-center gap-2 relative z-10">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {isRegister ? t('auth.creatingAccount') : t('auth.signingIn')}
                            </span>
                          ) : (
                            <span className="flex items-center gap-2 relative z-10">
                              <Sparkles className="w-4 h-4" />
                              {isRegister ? t('auth.signUp') : t('auth.signIn')}
                            </span>
                          )}
                        </Button>
                      </motion.div>
                    </form>

                    {/* Terms of Service & Privacy Policy - Register only */}
                    <AnimatePresence>
                      {isRegister && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.25, delay: 0.1 }}
                          className="mt-4 text-center"
                        >
                          <p className="text-xs text-muted-foreground">
                            {t('auth.agreeToTerms')}{' '}
                            <button
                              type="button"
                              onClick={() => handleTermsClick(t('auth.termsOfService'))}
                              className="text-primary hover:underline font-medium transition-colors"
                            >
                              {t('auth.termsOfService')}
                            </button>
                            {' & '}
                            <button
                              type="button"
                              onClick={() => handleTermsClick(t('auth.privacyPolicy'))}
                              className="text-primary hover:underline font-medium transition-colors"
                            >
                              {t('auth.privacyPolicy')}
                            </button>
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Features footer */}
                    <div className="mt-6 pt-4 border-t border-border/40">
                      <p className="text-xs text-muted-foreground text-center">
                        {t('auth.features')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
