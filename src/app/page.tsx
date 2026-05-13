'use client';

import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useAppStore, ViewMode } from '@/lib/store';

import { api } from '@/lib/api-client';
import { I18nProvider } from '@/i18n';
import { Sidebar } from '@/components/layout/Sidebar';
import { Toaster, toast } from 'sonner';
import { AuthPage } from '@/components/auth/AuthPage';

// Lazy-load all view components to reduce initial bundle size and memory usage
const Dashboard = lazy(() => import('@/components/views/Dashboard').then(m => ({ default: m.Dashboard })));
const AgentManager = lazy(() => import('@/components/views/AgentManager').then(m => ({ default: m.AgentManager })));
const AgentDetail = lazy(() => import('@/components/views/AgentDetail').then(m => ({ default: m.AgentDetail })));
const ProviderManager = lazy(() => import('@/components/views/ProviderManager').then(m => ({ default: m.ProviderManager })));
const SkillMarketplace = lazy(() => import('@/components/views/SkillMarketplace').then(m => ({ default: m.SkillMarketplace })));
const ChatView = lazy(() => import('@/components/views/ChatView').then(m => ({ default: m.ChatView })));
const ChatRoomManager = lazy(() => import('@/components/views/ChatRoomManager').then(m => ({ default: m.ChatRoomManager })));
const Settings = lazy(() => import('@/components/views/Settings').then(m => ({ default: m.Settings })));
const ChannelsView = lazy(() => import('@/components/views/ChannelsView').then(m => ({ default: m.ChannelsView })));
const JobsView = lazy(() => import('@/components/views/JobsView').then(m => ({ default: m.JobsView })));
const UsageView = lazy(() => import('@/components/views/UsageView').then(m => ({ default: m.UsageView })));
const ProfilesView = lazy(() => import('@/components/views/ProfilesView').then(m => ({ default: m.ProfilesView })));
const MemoryView = lazy(() => import('@/components/views/MemoryView').then(m => ({ default: m.MemoryView })));
const LogsView = lazy(() => import('@/components/views/LogsView').then(m => ({ default: m.LogsView })));
const FilesView = lazy(() => import('@/components/views/FilesView').then(m => ({ default: m.FilesView })));
const TerminalView = lazy(() => import('@/components/views/TerminalView').then(m => ({ default: m.TerminalView })));
const AgentControlCenter = lazy(() => import('@/components/views/AgentControlCenter').then(m => ({ default: m.AgentControlCenter })));
const WorkflowEditor = lazy(() => import('@/components/views/WorkflowEditor').then(m => ({ default: m.WorkflowEditor })));
const SessionSearch = lazy(() => import('@/components/views/SessionSearch').then(m => ({ default: m.SessionSearch })));
const CommandPalette = lazy(() => import('@/components/shared/CommandPalette').then(m => ({ default: m.CommandPalette })));
const KeyboardShortcutsHelp = lazy(() => import('@/components/shared/KeyboardShortcutsHelp').then(m => ({ default: m.KeyboardShortcutsHelp })));
const WelcomeOnboarding = lazy(() => import('@/components/shared/WelcomeOnboarding').then(m => ({ default: m.WelcomeOnboarding })));
const NotificationBell = lazy(() => import('@/components/shared/NotificationBell').then(m => ({ default: m.NotificationBell })));
const NotificationPanel = lazy(() => import('@/components/shared/NotificationPanel').then(m => ({ default: m.NotificationPanel })));
const QuickStart = lazy(() => import('@/components/shared/QuickStart').then(m => ({ default: m.QuickStart })));

import React from 'react';

// Loading spinner for lazy-loaded components
function ViewLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
}

class ViewErrorBoundary extends React.Component<{
  children: React.ReactNode;
  viewName: string;
}, { hasError: boolean; errorMessage: string }> {
  constructor(props: { children: React.ReactNode; viewName: string }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidUpdate(prevProps: { viewName: string }) {
    if (prevProps.viewName !== this.props.viewName && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
            <p className="text-muted-foreground text-sm mb-1">Failed to render the {this.props.viewName} view.</p>
            {this.state.errorMessage && (
              <p className="text-muted-foreground text-xs mb-4 font-mono bg-muted px-2 py-1 rounded max-w-md truncate">
                {this.state.errorMessage}
              </p>
            )}
            <button
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="px-4 py-2 rounded-md border border-border text-sm hover:bg-accent transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const {
    user, isAuthenticated, setUser,
    currentView, setCurrentView,
    setProviders, setAgents, setSkills, setConversations, setChatRooms,
    isLoading, setIsLoading,
    needsQuickStart, setNeedsQuickStart,
  } = useAppStore();

  const [initialized, setInitialized] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const restoreSession = async () => {
      if (api.tryRestoreAuth()) {
        try {
          const { user: restoredUser } = await api.getAuthMe();
          setUser(restoredUser);
          localStorage.setItem('hermes_user', JSON.stringify(restoredUser));
          if (!isOnboardingCompleted()) {
            setShowOnboarding(true);
          }
        } catch {
          try {
            const refreshed = await api.refreshToken();
            if (refreshed) {
              const { user: restoredUser } = await api.getAuthMe();
              setUser(restoredUser);
              localStorage.setItem('hermes_user', JSON.stringify(restoredUser));
              if (!isOnboardingCompleted()) {
                setShowOnboarding(true);
              }
            } else {
              throw new Error('Refresh failed');
            }
          } catch {
            api.logout();
            localStorage.removeItem('hermes_user');
            localStorage.removeItem('hermes_token');
          }
        }
      } else {
        const legacyToken = localStorage.getItem('hermes_token');
        const legacyUser = localStorage.getItem('hermes_user');
        if (legacyToken && legacyUser) {
          try {
            api.setUserId(legacyToken);
            const { user: restoredUser } = await api.getAuthMe();
            setUser(restoredUser);
            localStorage.setItem('hermes_user', JSON.stringify(restoredUser));
            if (!isOnboardingCompleted()) {
              setShowOnboarding(true);
            }
          } catch {
            api.logout();
            localStorage.removeItem('hermes_user');
            localStorage.removeItem('hermes_token');
          }
        }
      }
      setInitialized(true);
    };
    restoreSession();
  }, [setUser]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const [providers, agents, skills, conversations, chatRooms] = await Promise.all([
        api.getProviders().catch(() => ({ providers: [] })),
        api.getAgents().catch(() => ({ agents: [] })),
        api.getSkills().catch(() => ({ skills: [] })),
        api.getConversations().catch(() => ({ conversations: [] })),
        api.getChatRooms().catch(() => ({ rooms: [] })),
      ]);

      setProviders(providers.providers || []);
      setAgents(agents.agents || []);

      if (!skills.skills || skills.skills.length === 0) {
        await api.seedSkills().catch(() => {});
        const seeded = await api.getSkills().catch(() => ({ skills: [] }));
        setSkills(seeded.skills || []);
      } else {
        setSkills(skills.skills);
      }

      setConversations(conversations.conversations || []);
      setChatRooms(chatRooms.rooms || []);

      // Check quickstart status
      try {
        const qsStatus = await api.getQuickstartStatus();
        if (!qsStatus.isReady) {
          setNeedsQuickStart(true);
        } else {
          setNeedsQuickStart(false);
        }
      } catch {
        const hasProvider = (providers.providers || []).length > 0;
        const hasAgent = (agents.agents || []).length > 0;
        setNeedsQuickStart(!hasProvider || !hasAgent);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, setProviders, setAgents, setSkills, setConversations, setChatRooms, setIsLoading, setNeedsQuickStart]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        setKeyboardHelpOpen((prev) => !prev);
        return;
      }

      const viewMap: Record<string, ViewMode> = {
        '1': 'chat',
        '2': 'agents',
        '3': 'workflows',
        '4': 'analytics',
        '5': 'settings',
      };

      if (e.key === ',') {
        e.preventDefault();
        setCurrentView('settings');
        return;
      }

      if (viewMap[e.key]) {
        e.preventDefault();
        setCurrentView(viewMap[e.key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, setCurrentView]);

  const handleLogin = async (email: string, password: string, isRegister: boolean, name?: string) => {
    try {
      const result = isRegister
        ? await api.register(email, name || email.split('@')[0], password)
        : await api.login(email, password);

      const { user: userData, token } = result;
      api.setAuth(token, userData.id);
      setUser(userData);
      localStorage.setItem('hermes_user', JSON.stringify(userData));
      toast.success(isRegister ? 'Account created!' : 'Welcome back!');
      if (isRegister && !isOnboardingCompleted()) {
        setShowOnboarding(true);
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
      throw error;
    }
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    localStorage.removeItem('hermes_token');
    localStorage.removeItem('hermes_user');
    toast.success('Logged out');
  };

  if (!initialized) {
    return (
      <div className="min-h-screen flex bg-background">
        <aside className="w-64 h-screen flex flex-col border-r border-border bg-card shrink-0">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-muted animate-pulse" />
            <div className="flex flex-col gap-1.5">
              <div className="w-24 h-3.5 rounded bg-muted animate-pulse" />
              <div className="w-16 h-2.5 rounded bg-muted animate-pulse" />
            </div>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
                <div className="w-[18px] h-[18px] rounded bg-muted animate-pulse" />
                <div className="w-20 h-3 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          <div className="h-24 rounded-xl bg-muted animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <AuthPage onAuth={handleLogin} />
        <Toaster />
      </>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'agents':
        return <AgentManager />;
      case 'agent-detail':
        return <AgentDetail />;
      case 'providers':
        return <ProviderManager />;
      case 'skills':
        return <SkillMarketplace />;
      case 'chat':
        return <ChatView />;
      case 'chat-rooms':
        return <ChatRoomManager />;
      case 'channels':
        return <ChannelsView />;
      case 'jobs':
        return <JobsView />;
      case 'usage':
        return <UsageView />;
      case 'profiles':
        return <ProfilesView />;
      case 'memory':
        return <MemoryView />;
      case 'logs':
        return <LogsView />;
      case 'files':
        return <FilesView />;
      case 'terminal':
        return <TerminalView />;
      case 'agent-control':
        return <AgentControlCenter />;
      case 'analytics':
        return <Dashboard />;
      case 'workflows':
        return <WorkflowEditor />;
      case 'notifications':
        return <NotificationPanel />;
      case 'settings':
        return <Settings onLogout={handleLogout} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar onLogout={handleLogout} onOpenKeyboardHelp={() => setKeyboardHelpOpen(true)} />
      <main className="flex-1 overflow-auto relative">
        <div className="fixed top-4 right-4 z-40">
          <Suspense fallback={null}>
            <NotificationBell />
          </Suspense>
        </div>
        {isLoading ? (
          <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="h-24 rounded-xl bg-muted animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <ViewErrorBoundary viewName={currentView}>
            <Suspense fallback={<ViewLoader />}>
              <div key={currentView} className="animate-in fade-in">{renderView()}</div>
            </Suspense>
          </ViewErrorBoundary>
        )}
      </main>
      <Suspense fallback={null}>
        <SessionSearch />
        <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
        <KeyboardShortcutsHelp open={keyboardHelpOpen} onOpenChange={setKeyboardHelpOpen} />
        <WelcomeOnboarding open={showOnboarding} onComplete={() => setShowOnboarding(false)} />
      </Suspense>
      {needsQuickStart && (
        <Suspense fallback={null}>
          <QuickStart
            onStarted={() => {
              setNeedsQuickStart(false);
              loadData();
            }}
          />
        </Suspense>
      )}
      <Toaster />
    </div>
  );
}

// Helper for onboarding check (outside component)
function isOnboardingCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('hermes_onboarding_completed') === 'true';
  } catch {
    return false;
  }
}

export default function Home() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}
