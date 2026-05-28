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
  ArrowRight,
  Cpu,
  Network as NetworkIcon,
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
  { icon: Bot, key: 'featureAgents', color: 'from-emerald-400 to-teal-500' },
  { icon: Puzzle, key: 'featureSkills', color: 'from-violet-400 to-purple-500' },
  { icon: MessageSquare, key: 'featureChat', color: 'from-cyan-400 to-blue-500' },
  { icon: Monitor, key: 'featureProtocol', color: 'from-amber-400 to-orange-500' },
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

// Animated grid lines for left panel
function GridPattern() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Horizontal lines */}
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={`h-${i}`}
          className="absolute left-0 right-0 h-px bg-white/[0.04]"
          style={{ top: `${(i + 1) * 8}%` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{
            duration: 1.5,
            delay: i * 0.08,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        />
      ))}
      {/* Vertical lines */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={`v-${i}`}
          className="absolute top-0 bottom-0 w-px bg-white/[0.04]"
          style={{ left: `${(i + 1) * 12}%` }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{
            duration: 1.5,
            delay: i * 0.08 + 0.3,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        />
      ))}
      {/* Intersection dots */}
      {Array.from({ length: 12 }).map((_, row) =>
        Array.from({ length: 8 }).map((_, col) => (
          <motion.div
            key={`dot-${row}-${col}`}
            className="absolute w-1 h-1 rounded-full bg-white/[0.08]"
            style={{
              top: `${(row + 1) * 8}%`,
              left: `${(col + 1) * 12}%`,
              transform: 'translate(-50%, -50%)',
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.4,
              delay: (row + col) * 0.03 + 0.8,
              ease: 'easeOut',
            }}
          />
        ))
      )}
    </div>
  );
}

// Floating label input component with animated labels
function FloatingLabelInput({
  id,
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  required,
  minLength,
  icon: Icon,
  rightElement,
  className = '',
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
  minLength?: number;
  icon?: React.ElementType;
  rightElement?: React.ReactNode;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const isActive = focused || value.length > 0;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        {/* Floating label */}
        <motion.label
          htmlFor={id}
          className="absolute left-3.5 z-10 pointer-events-none origin-left text-sm"
          animate={{
            y: isActive ? -22 : 0,
            scale: isActive ? 0.78 : 1,
            color: focused
              ? 'rgb(16, 185, 129)'
              : error
                ? 'rgb(239, 68, 68)'
                : 'rgb(107, 114, 128)',
          }}
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{
            top: '50%',
            transformOrigin: 'left center',
          }}
        >
          {label}
        </motion.label>

        {/* Input with animated border */}
        <div className="relative">
          <Input
            id={id}
            type={type}
            placeholder={isActive ? placeholder : ''}
            value={value}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            required={required}
            minLength={minLength}
            className={`h-12 px-3.5 pt-5 pb-1 text-sm transition-all duration-300 bg-background/60 backdrop-blur-sm border-border/50 focus:bg-background/80 focus:border-emerald-500/50 focus-visible:ring-emerald-500/20 rounded-lg ${
              error ? 'border-destructive focus:border-destructive focus-visible:ring-destructive/30' : ''
            } ${rightElement ? 'pr-11' : ''} ${className}`}
          />
          {/* Focus indicator line */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-b-lg"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: focused ? 1 : 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ originX: 0 }}
          />
        </div>

        {/* Right element (e.g. password toggle) */}
        {rightElement && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20">
            {rightElement}
          </div>
        )}
      </div>

      {/* Error message with animation */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2 }}
            className="text-xs text-destructive pl-1 overflow-hidden"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// Animated stat counter for left panel
function StatCounter({ value, label, delay = 0 }: { value: string; label: string; delay?: number }) {
  return (
    <motion.div
      className="text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-white/50 mt-0.5">{label}</div>
    </motion.div>
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
    } catch (error: any) {
      if (error?.status === 409) {
        // Email already exists - show specific message and suggest login
        setErrors({ email: t('auth.emailExists') });
      } else if (error?.status === 401) {
        // Invalid credentials for login
        setErrors({ password: t('auth.invalidCredentials') });
      } else {
        setErrors({ email: t('auth.authFailed') });
      }
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
      {/* Global background */}
      <div className="absolute inset-0 bg-background" />
      <div
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]"
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

      {/* ===== LEFT PANEL - Hero / Branding Side (Desktop only) ===== */}
      <div className="hidden lg:flex lg:w-[48%] relative overflow-hidden">
        {/* Multi-layer animated gradient background */}
        <div className="absolute inset-0">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-teal-800 to-cyan-900" />

          {/* Animated mesh gradient layer 1 */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 20% 30%, rgba(16,185,129,0.4) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 80% 70%, rgba(6,182,212,0.3) 0%, transparent 60%)',
            }}
            animate={{
              backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Animated mesh gradient layer 2 - slower, different hue */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 70% 50% at 70% 20%, rgba(99,102,241,0.15) 0%, transparent 50%), radial-gradient(ellipse 50% 70% at 30% 80%, rgba(16,185,129,0.2) 0%, transparent 50%)',
            }}
            animate={{
              backgroundPosition: ['100% 0%', '0% 100%', '100% 0%'],
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Animated pulse ring */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>

        {/* Grid pattern overlay */}
        <GridPattern />

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
            {/* Logo with floating animation */}
            <motion.div
              className="flex items-center gap-4 mb-8"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <motion.div
                className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25 shadow-lg shadow-white/5 relative"
                animate={{ y: [0, -6, 0] }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 0.5,
                }}
                whileHover={{ scale: 1.08 }}
              >
                <Zap className="w-8 h-8 text-white" />
                {/* Glow ring */}
                <motion.div
                  className="absolute inset-0 rounded-2xl border border-white/20"
                  animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.1, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
                {/* Outer glow ring */}
                <motion.div
                  className="absolute -inset-1 rounded-3xl border border-white/10"
                  animate={{ opacity: [0.1, 0.3, 0.1], scale: [1, 1.15, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
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
              className="text-white/80 text-lg mb-8 leading-relaxed max-w-md font-light"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {t('auth.subtitle')}
            </motion.p>

            {/* Feature Highlights with staggered animations */}
            <div className="space-y-3">
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
                    whileHover={{ x: 6 }}
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
                    <ArrowRight className="w-4 h-4 text-white/0 group-hover:text-white/50 transition-all duration-300 -ml-2 group-hover:ml-0" />
                  </motion.div>
                );
              })}
            </div>

            {/* Stat counters */}
            <motion.div
              className="mt-10 flex items-center gap-8 px-4 py-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1 }}
            >
              <StatCounter value="10+" label="LLM Providers" delay={1.1} />
              <div className="w-px h-8 bg-white/10" />
              <StatCounter value="50+" label="Skills" delay={1.2} />
              <div className="w-px h-8 bg-white/10" />
              <StatCounter value="∞" label="Agents" delay={1.3} />
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              className="mt-6 flex items-center gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.4 }}
            >
              <div className="flex items-center gap-1.5 text-white/50 text-xs">
                <Shield className="w-3.5 h-3.5" />
                <span>End-to-end encrypted</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/50 text-xs">
                <Globe className="w-3.5 h-3.5" />
                <span>Open protocol</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/50 text-xs">
                <Cpu className="w-3.5 h-3.5" />
                <span>ACRP Compatible</span>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom decorative line with shimmer */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        {/* Top-right corner accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent" />
      </div>

      {/* ===== RIGHT PANEL - Form Side ===== */}
      <div className="flex-1 flex items-center justify-center relative px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-8">
        {/* Right panel ambient gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-accent/5" />
        {/* Subtle ambient orbs on right side */}
        <div className="absolute top-[10%] right-[10%]">
          <FloatingOrb className="bg-primary/5 blur-3xl" size={250} delay={1} duration={22} />
        </div>
        <div className="absolute bottom-[15%] left-[10%]">
          <FloatingOrb className="bg-emerald-500/5 blur-3xl" size={200} delay={3} duration={18} />
        </div>

        <div className="w-full max-w-[440px] relative z-10">
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
                className="flex flex-col items-center mb-6 lg:hidden"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <motion.div
                  className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/20 relative"
                  animate={{ y: [0, -3, 0] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 0.5,
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Zap className="w-7 h-7 text-white" />
                  <motion.div
                    className="absolute inset-0 rounded-2xl border border-white/20"
                    animate={{ opacity: [0.2, 0.5, 0.2] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </motion.div>
                <h1 className="text-2xl font-bold tracking-tight">
                  <span>Hermes </span>
                  <span className="bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
                    Hub
                  </span>
                </h1>
                <p className="text-muted-foreground text-xs mt-1">{t('auth.subtitle')}</p>
              </motion.div>

              {/* Desktop Header inside form area */}
              <motion.div
                className="hidden lg:block mb-7"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <h2 className="text-[26px] font-bold tracking-tight">
                  {isRegister ? t('auth.createAccount') : t('auth.welcomeBack')}
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {isRegister ? t('auth.signUp') : t('auth.signIn')}
                </p>
              </motion.div>

              {/* Card with frosted glass effect */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <Card className="shadow-2xl border-border/40 bg-card/70 backdrop-blur-xl relative overflow-hidden rounded-2xl">
                  {/* Subtle border glow effect */}
                  <div className="absolute inset-0 rounded-2xl border border-primary/10 pointer-events-none" />
                  {/* Top accent gradient */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

                  <CardContent className="px-7 pt-7 pb-6 relative z-10">
                    <Tabs
                      value={isRegister ? 'register' : 'login'}
                      onValueChange={handleTabChange}
                    >
                      <TabsList className="w-full mb-6 bg-muted/50 backdrop-blur-sm h-10 rounded-lg p-1">
                        <TabsTrigger
                          value="login"
                          className="flex-1 text-sm font-medium transition-all data-[state=active]:shadow-sm data-[state=active]:bg-background data-[state=active]:text-foreground rounded-md"
                        >
                          {t('auth.signIn')}
                        </TabsTrigger>
                        <TabsTrigger
                          value="register"
                          className="flex-1 text-sm font-medium transition-all data-[state=active]:shadow-sm data-[state=active]:bg-background data-[state=active]:text-foreground rounded-md"
                        >
                          {t('auth.signUp')}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    {/* Social Login Buttons - Enhanced */}
                    <div className="grid grid-cols-2 gap-3 mb-5 mt-5">
                      <motion.div
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      >
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2.5 w-full h-12 bg-background/50 backdrop-blur-sm border-border/50 hover:bg-[#24292e]/5 hover:border-[#24292e]/30 dark:hover:bg-[#24292e]/20 dark:hover:border-[#24292e]/40 transition-all duration-300 hover:shadow-md group rounded-lg"
                          onClick={() => handleSocialLogin(t('auth.github'))}
                        >
                          <Github className="w-4 h-4 group-hover:text-[#24292e] dark:group-hover:text-white transition-colors" />
                          <span className="text-sm font-medium">{t('auth.github')}</span>
                        </Button>
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      >
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2.5 w-full h-12 bg-background/50 backdrop-blur-sm border-border/50 hover:bg-[#4285F4]/5 hover:border-[#4285F4]/30 dark:hover:bg-[#4285F4]/20 dark:hover:border-[#4285F4]/40 transition-all duration-300 hover:shadow-md group rounded-lg"
                          onClick={() => handleSocialLogin(t('auth.google'))}
                        >
                          <GoogleIcon />
                          <span className="text-sm font-medium">{t('auth.google')}</span>
                        </Button>
                      </motion.div>
                    </div>

                    {/* Divider */}
                    <div className="relative my-5">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/40" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card/90 backdrop-blur-sm px-3 text-muted-foreground/80 tracking-wider">
                          {isRegister ? t('auth.signUp') : t('auth.signIn')} with email
                        </span>
                      </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4 mt-1">
                      {/* Name field - Register only */}
                      <AnimatePresence>
                        {isRegister && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <FloatingLabelInput
                              id="name"
                              label={t('auth.name')}
                              placeholder={t('auth.namePlaceholder')}
                              value={name}
                              onChange={(e) => {
                                setName(e.target.value);
                                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                              }}
                              error={errors.name}
                              required
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Email field */}
                      <div>
                        <FloatingLabelInput
                          id="email"
                          label={t('auth.email')}
                          type="email"
                          placeholder={t('auth.emailPlaceholder')}
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                          }}
                          error={errors.email}
                          required
                        />
                        {/* Switch to login link when email already exists */}
                        <AnimatePresence>
                          {isRegister && errors.email && errors.email === t('auth.emailExists') && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => { setIsRegister(false); setErrors({}); }}
                                className="text-xs text-primary hover:underline mt-1 pl-1"
                              >
                                {t('auth.switchToLogin')}
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Password field */}
                      <div className="space-y-1">
                        <FloatingLabelInput
                          id="password"
                          label={t('auth.password')}
                          type={showPassword ? 'text' : 'password'}
                          placeholder={t('auth.passwordPlaceholder')}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                          }}
                          error={errors.password}
                          required
                          minLength={6}
                          rightElement={
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="text-muted-foreground/70 hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-accent/50"
                              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                            >
                              {showPassword ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          }
                        />

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
                              <div className="space-y-1.5 pt-2">
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4].map((segment) => (
                                    <motion.div
                                      key={segment}
                                      className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
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

                      {/* Forgot password + Remember me row */}
                      <div className="flex items-center justify-between pt-1">
                        <AnimatePresence>
                          {!isRegister && (
                            <motion.div
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              transition={{ duration: 0.25, ease: 'easeInOut' }}
                              className="flex items-center gap-2"
                            >
                              <Checkbox
                                id="remember"
                                checked={rememberMe}
                                onCheckedChange={(checked) => setRememberMe(checked === true)}
                                className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                              />
                              <Label
                                htmlFor="remember"
                                className="text-sm text-muted-foreground cursor-pointer select-none leading-none"
                              >
                                {t('auth.rememberMe')}
                              </Label>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        {!isRegister && (
                          <motion.button
                            type="button"
                            onClick={handleForgotPassword}
                            className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                            whileHover={{ x: 2 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {t('auth.forgotPassword')}
                          </motion.button>
                        )}
                      </div>

                      {/* Submit button */}
                      <motion.div
                        whileHover={{ scale: loading ? 1 : 1.01 }}
                        whileTap={{ scale: loading ? 1 : 0.98 }}
                      >
                        <Button
                          type="submit"
                          className="w-full h-12 relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 font-semibold text-[15px] rounded-lg"
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
                    <div className="mt-5 pt-4 border-t border-border/30">
                      <p className="text-center text-[11px] text-muted-foreground/50 font-medium">
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
