'use client';

import { useEffect, useState, useCallback, Component, ReactNode } from 'react';
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
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommandPalette } from '@/components/shared/CommandPalette';

class ViewErrorBoundary extends Component<{
  children: ReactNode;
  viewName: string;
}, { hasError: boolean; errorView: string }> {
  constructor(props: { children: ReactNode; viewName: string }) {
    super(props);
    this.state = { hasError: false, errorView: '' };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: { viewName: string }) {
    // Reset error state when view changes
    if (prevProps.viewName !== this.props.viewName && this.state.hasError) {
      this.setState({ hasError: false, errorView: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
            <p className="text-muted-foreground text-sm mb-4">Failed to render the {this.props.viewName} view. Please try again.</p>
            <Button variant="outline" onClick={() => this.setState({ hasError: false })} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
            </Button>
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

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('hermes_token');
    const userData = localStorage.getItem('hermes_user');
    if (token && userData) {
      try {
        const parsed = JSON.parse(userData);
        api.setUserId(token);
        setUser(parsed);
      } catch {
        localStorage.removeItem('hermes_token');
        localStorage.removeItem('hermes_user');
      }
    }
    setInitialized(true);
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
      api.setUserId(token);
      setUser(userData);
      localStorage.setItem('hermes_token', token);
      localStorage.setItem('hermes_user', JSON.stringify(userData));
      toast.success(isRegister ? 'Account created!' : 'Welcome back!');
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
      throw error;
    }
  };

  const handleLogout = () => {
    api.setUserId('');
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
      case 'settings':
        return <Settings onLogout={handleLogout} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar onLogout={handleLogout} />
      <main className="flex-1 overflow-auto">
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
