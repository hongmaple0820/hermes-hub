'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore, ViewMode } from '@/lib/store';

import { api } from '@/lib/api-client';
import { I18nProvider } from '@/i18n';
import { Sidebar } from '@/components/layout/Sidebar';
import { Dashboard } from '@/components/views/Dashboard';
import { AgentManager } from '@/components/views/AgentManager';
import { AgentDetail } from '@/components/views/AgentDetail';
import { ProviderManager } from '@/components/views/ProviderManager';
import { SkillMarketplace } from '@/components/views/SkillMarketplace';
import { ChatView } from '@/components/views/ChatView';
import { ChatRoomManager } from '@/components/views/ChatRoomManager';
import { Settings } from '@/components/views/Settings';
import { ChannelsView } from '@/components/views/ChannelsView';
import { JobsView } from '@/components/views/JobsView';
import { UsageView } from '@/components/views/UsageView';
import { ProfilesView } from '@/components/views/ProfilesView';
import { MemoryView } from '@/components/views/MemoryView';
import { LogsView } from '@/components/views/LogsView';
import { FilesView } from '@/components/views/FilesView';
import { TerminalView } from '@/components/views/TerminalView';
import { AgentControlCenter } from '@/components/views/AgentControlCenter';
import { SessionSearch } from '@/components/views/SessionSearch';
import { AuthPage } from '@/components/auth/AuthPage';
import { Toaster, toast } from 'sonner';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { KeyboardShortcutsHelp } from '@/components/shared/KeyboardShortcutsHelp';
import { WelcomeOnboarding, isOnboardingCompleted } from '@/components/shared/WelcomeOnboarding';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { NotificationPanel } from '@/components/shared/NotificationPanel';

// Error boundary - must be a class component to catch render errors
// Using React.Component pattern to avoid naming conflicts with named imports
import React from 'react';

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
  } = useAppStore();

  const [initialized, setInitialized] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check for existing session on mount — try to restore from localStorage, then validate via API
  useEffect(() => {
    const restoreSession = async () => {
      if (api.tryRestoreAuth()) {
        try {
          // Validate the stored JWT token against the server
          const { user: restoredUser } = await api.getAuthMe();
          setUser(restoredUser);
          // Also store user data for faster future loads
          localStorage.setItem('hermes_user', JSON.stringify(restoredUser));
          // Check if onboarding is needed for existing users
          if (!isOnboardingCompleted()) {
            setShowOnboarding(true);
          }
        } catch {
          // Access token might be expired — try refreshing
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
            // Server validation failed — clear invalid auth
            api.logout();
            localStorage.removeItem('hermes_user');
            localStorage.removeItem('hermes_token');
          }
        }
      } else {
        // No persisted auth — try legacy keys for backward compatibility
        const legacyToken = localStorage.getItem('hermes_token');
        const legacyUser = localStorage.getItem('hermes_user');
        if (legacyToken && legacyUser) {
          try {
            api.setUserId(legacyToken); // This will persist to new key
            // Validate via server
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

  // Load data when authenticated
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

      // If no skills, seed them
      if (!skills.skills || skills.skills.length === 0) {
        await api.seedSkills().catch(() => {});
        const seeded = await api.getSkills().catch(() => ({ skills: [] }));
        setSkills(seeded.skills || []);
      } else {
        setSkills(skills.skills);
      }

      setConversations(conversations.conversations || []);
      setChatRooms(chatRooms.rooms || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, setProviders, setAgents, setSkills, setConversations, setChatRooms, setIsLoading]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  // Global keyboard shortcuts
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Cmd+K → Command Palette
      if (e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Cmd+/ → Keyboard Shortcuts Help
      if (e.key === '/') {
        e.preventDefault();
        setKeyboardHelpOpen((prev) => !prev);
        return;
      }

      // Number shortcuts for navigation
      const viewMap: Record<string, ViewMode> = {
        '1': 'dashboard',
        '2': 'agents',
        '3': 'providers',
        '4': 'skills',
        '5': 'agent-control',
        '6': 'channels',
        '7': 'chat',
        '8': 'chat-rooms',
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
      api.setAuth(token, userData.id); // Store JWT token + userId, persists to localStorage
      setUser(userData);
      localStorage.setItem('hermes_user', JSON.stringify(userData));
      toast.success(isRegister ? 'Account created!' : 'Welcome back!');
      // Show onboarding for new users after registration
      if (isRegister && !isOnboardingCompleted()) {
        setShowOnboarding(true);
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
      throw error;
    }
  };

  const handleLogout = () => {
    api.logout(); // Clears JWT token, userId, persisted auth, and calls /api/auth/logout to clear cookies
    setUser(null);
    localStorage.removeItem('hermes_token');
    localStorage.removeItem('hermes_user');
    toast.success('Logged out');
  };

  if (!initialized) {
    return (
      <div className="min-h-screen flex bg-background">
        {/* Sidebar skeleton */}
        <aside className="w-64 h-screen flex flex-col border-r border-border bg-card shrink-0">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-muted animate-pulse" />
            <div className="flex flex-col gap-1.5">
              <div className="w-24 h-3.5 rounded bg-muted animate-pulse" />
              <div className="w-16 h-2.5 rounded bg-muted animate-pulse" />
            </div>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
                <div className="w-[18px] h-[18px] rounded bg-muted animate-pulse" />
                <div className="w-20 h-3 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </nav>
          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="w-16 h-3 rounded bg-muted animate-pulse" />
                <div className="w-24 h-2.5 rounded bg-muted animate-pulse" />
              </div>
            </div>
          </div>
        </aside>
        {/* Main content skeleton */}
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          <div className="h-24 rounded-xl bg-muted animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-64 rounded-xl bg-muted animate-pulse" />
            <div className="h-64 rounded-xl bg-muted animate-pulse" />
            <div className="h-64 rounded-xl bg-muted animate-pulse" />
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
        {/* Notification Bell - Fixed top right */}
        <div className="fixed top-4 right-4 z-40">
          <NotificationBell />
        </div>
        {isLoading ? (
          <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="h-24 rounded-xl bg-muted animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="h-64 rounded-xl bg-muted animate-pulse" />
              <div className="h-64 rounded-xl bg-muted animate-pulse" />
              <div className="h-64 rounded-xl bg-muted animate-pulse" />
            </div>
          </div>
        ) : (
          <ViewErrorBoundary viewName={currentView}>
            <div key={currentView} className="animate-in fade-in">{renderView()}</div>
          </ViewErrorBoundary>
        )}
      </main>
      <SessionSearch />
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      <KeyboardShortcutsHelp open={keyboardHelpOpen} onOpenChange={setKeyboardHelpOpen} />
      <WelcomeOnboarding open={showOnboarding} onComplete={() => setShowOnboarding(false)} />
      <Toaster />
    </div>
  );
}

export default function Home() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}
