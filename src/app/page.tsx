'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { Sidebar } from '@/components/layout/Sidebar';
import { Dashboard } from '@/components/views/Dashboard';
import { AgentManager } from '@/components/views/AgentManager';
import { AgentDetail } from '@/components/views/AgentDetail';
import { ProviderManager } from '@/components/views/ProviderManager';
import { SkillMarketplace } from '@/components/views/SkillMarketplace';
import { HermesManager } from '@/components/views/HermesManager';
import { ChatView } from '@/components/views/ChatView';
import { ChatRoomManager } from '@/components/views/ChatRoomManager';
import { Settings } from '@/components/views/Settings';
import { AuthPage } from '@/components/auth/AuthPage';
import { Toaster, toast } from 'sonner';

export default function Home() {
  const {
    user, isAuthenticated, setUser,
    currentView,
    setProviders, setAgents, setSkills, setGateways, setConversations, setChatRooms,
    isLoading, setIsLoading,
  } = useAppStore();

  const [initialized, setInitialized] = useState(false);

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
      const [providers, agents, skills, gateways, conversations, chatRooms] = await Promise.all([
        api.getProviders().catch(() => ({ providers: [] })),
        api.getAgents().catch(() => ({ agents: [] })),
        api.getSkills().catch(() => ({ skills: [] })),
        api.getGateways().catch(() => ({ gateways: [] })),
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

      setGateways(gateways.gateways || []);
      setConversations(conversations.conversations || []);
      setChatRooms(chatRooms.rooms || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, setProviders, setAgents, setSkills, setGateways, setConversations, setChatRooms, setIsLoading]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  const handleLogin = async (email: string, password: string, isRegister: boolean) => {
    try {
      const result = isRegister
        ? await api.register(email, email.split('@')[0], password)
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading Hermes Hub...</p>
        </div>
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
      case 'hermes':
        return <HermesManager />;
      case 'chat':
        return <ChatView />;
      case 'chat-rooms':
        return <ChatRoomManager />;
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
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground text-sm">Loading...</p>
            </div>
          </div>
        ) : (
          renderView()
        )}
      </main>
      <Toaster />
    </div>
  );
}
