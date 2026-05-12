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
  { icon: Bot, key: 'featureAgents' },
  { icon: Puzzle, key: 'featureSkills' },
  { icon: MessageSquare, key: 'featureChat' },
  { icon: Monitor, key: 'featureProtocol' },
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
    <div className="min-h-screen flex">
      {/* Language Switcher - Fixed top right */}
      <div className="fixed top-4 right-4 z-50">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 bg-background/80 backdrop-blur-sm">
              <Languages className="w-4 h-4" />
              {locales.find((l) => l.code === locale)?.label}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1">
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
      <div className="hidden lg:flex lg:w-[40%] bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 relative overflow-hidden">
        {/* Animated floating geometric shapes */}
        <div className="absolute inset-0">
          {/* Circle 1 - top left */}
          <div
            className="absolute top-[15%] left-[10%] w-16 h-16 rounded-full border-2 border-white/15"
            style={{
              animation: 'authFloat1 8s ease-in-out infinite',
            }}
          />
          {/* Hexagon 1 - top right */}
          <div
            className="absolute top-[20%] right-[15%] w-12 h-12 border-2 border-white/10"
            style={{
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              animation: 'authFloat2 10s ease-in-out infinite',
            }}
          />
          {/* Circle 2 - middle left */}
          <div
            className="absolute top-[50%] left-[5%] w-20 h-20 rounded-full bg-white/5"
            style={{
              animation: 'authFloat3 12s ease-in-out infinite',
            }}
          />
          {/* Hexagon 2 - bottom center */}
          <div
            className="absolute bottom-[20%] left-[40%] w-14 h-14 border-2 border-white/10 rotate-30"
            style={{
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              animation: 'authFloat1 9s ease-in-out infinite reverse',
            }}
          />
          {/* Circle 3 - bottom right */}
          <div
            className="absolute bottom-[30%] right-[10%] w-10 h-10 rounded-full border border-white/15 bg-white/5"
            style={{
              animation: 'authFloat2 7s ease-in-out infinite reverse',
            }}
          />
          {/* Large blur circles (background ambience) */}
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-xl" />
          <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-2xl" />
          <div className="absolute top-2/3 left-1/2 w-48 h-48 bg-white/5 rounded-full blur-xl" />
        </div>

        {/* CSS animations */}
        <style jsx>{`
          @keyframes authFloat1 {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            25% { transform: translateY(-20px) rotate(5deg); }
            50% { transform: translateY(-10px) rotate(-3deg); }
            75% { transform: translateY(-25px) rotate(2deg); }
          }
          @keyframes authFloat2 {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            33% { transform: translateY(-15px) rotate(-8deg); }
            66% { transform: translateY(-30px) rotate(5deg); }
          }
          @keyframes authFloat3 {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-20px) scale(1.05); }
          }
        `}</style>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Logo */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  Hermes Hub
                </h1>
                <p className="text-white/70 text-sm font-medium">
                  {t('auth.subtitle')}
                </p>
              </div>
            </div>

            {/* Tagline */}
            <p className="text-white/90 text-lg mb-10 leading-relaxed max-w-md">
              {t('auth.subtitle')}
            </p>

            {/* Feature Highlights */}
            <div className="space-y-5">
              {featureHighlights.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.key}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                    className="flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/10 shrink-0">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white/90 font-medium">
                      {t(`auth.${feature.key}`)}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Bottom decorative line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-white/0 via-white/30 to-white/0" />
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/10 p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={isRegister ? 'register' : 'login'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {/* Mobile Header */}
              <div className="flex flex-col items-center mb-8 lg:hidden">
                <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg">
                  <Zap className="w-7 h-7 text-primary-foreground" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">{t('auth.title')}</h1>
                <p className="text-muted-foreground text-sm mt-1">{t('auth.subtitle')}</p>
              </div>

              {/* Desktop Header inside form area */}
              <div className="hidden lg:block mb-8">
                <h2 className="text-2xl font-bold tracking-tight">
                  {isRegister ? t('auth.createAccount') : t('auth.welcomeBack')}
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {isRegister ? t('auth.signUp') : t('auth.signIn')}
                </p>
              </div>

              <Card className="shadow-xl border-border/50">
                <CardContent className="pt-6">
                  <Tabs
                    value={isRegister ? 'register' : 'login'}
                    onValueChange={handleTabChange}
                  >
                    <TabsList className="w-full mb-6">
                      <TabsTrigger value="login" className="flex-1">
                        {t('auth.signIn')}
                      </TabsTrigger>
                      <TabsTrigger value="register" className="flex-1">
                        {t('auth.signUp')}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {/* Social Login Buttons */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleSocialLogin(t('auth.github'))}
                    >
                      <Github className="w-4 h-4" />
                      {t('auth.github')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleSocialLogin(t('auth.google'))}
                    >
                      <GoogleIcon />
                      {t('auth.google')}
                    </Button>
                  </div>

                  {/* Divider */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        {isRegister ? t('auth.signUp') : t('auth.signIn')} with email
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name field - Register only */}
                    <AnimatePresence>
                      {isRegister && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-2 overflow-hidden"
                        >
                          <Label htmlFor="name">{t('auth.name')}</Label>
                          <Input
                            id="name"
                            placeholder={t('auth.namePlaceholder')}
                            value={name}
                            onChange={(e) => {
                              setName(e.target.value);
                              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                            }}
                            className={errors.name ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                            required
                          />
                          {errors.name && (
                            <p className="text-xs text-destructive">{errors.name}</p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Email field */}
                    <div className="space-y-2">
                      <Label htmlFor="email">{t('auth.email')}</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={t('auth.emailPlaceholder')}
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                        }}
                        className={errors.email ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                        required
                      />
                      {errors.email && (
                        <p className="text-xs text-destructive">{errors.email}</p>
                      )}
                    </div>

                    {/* Password field */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">{t('auth.password')}</Label>
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
                          className={`pr-10 ${errors.password ? 'border-destructive focus-visible:ring-destructive/30' : ''}`}
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
                        <p className="text-xs text-destructive">{errors.password}</p>
                      )}

                      {/* Password Strength Indicator - Register only */}
                      <AnimatePresence>
                        {isRegister && password && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-1.5 pt-1">
                              <div className="flex gap-1">
                                {[1, 2, 3, 4].map((segment) => (
                                  <div
                                    key={segment}
                                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                                      passwordStrength.score >= segment
                                        ? passwordStrength.color
                                        : 'bg-muted'
                                    }`}
                                  />
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {t('auth.passwordStrength')}:{' '}
                                <span className={
                                  passwordStrength.label === 'weak' ? 'text-red-500 font-medium' :
                                  passwordStrength.label === 'fair' ? 'text-yellow-500 font-medium' :
                                  'text-emerald-500 font-medium'
                                }>
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
                          transition={{ duration: 0.2 }}
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
                    <Button
                      type="submit"
                      className="w-full relative"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {isRegister ? t('auth.creatingAccount') : t('auth.signingIn')}
                        </>
                      ) : (
                        isRegister ? t('auth.signUp') : t('auth.signIn')
                      )}
                    </Button>
                  </form>

                  {/* Terms of Service & Privacy Policy - Register only */}
                  <AnimatePresence>
                    {isRegister && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, delay: 0.1 }}
                        className="mt-4 text-center"
                      >
                        <p className="text-xs text-muted-foreground">
                          {t('auth.agreeToTerms')}{' '}
                          <button
                            type="button"
                            onClick={() => handleTermsClick(t('auth.termsOfService'))}
                            className="text-primary hover:underline font-medium"
                          >
                            {t('auth.termsOfService')}
                          </button>
                          {' & '}
                          <button
                            type="button"
                            onClick={() => handleTermsClick(t('auth.privacyPolicy'))}
                            className="text-primary hover:underline font-medium"
                          >
                            {t('auth.privacyPolicy')}
                          </button>
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Features footer */}
                  <div className="mt-6 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center">
                      {t('auth.features')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
