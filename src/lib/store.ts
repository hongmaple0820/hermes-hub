import { create } from 'zustand';
import type { User, Provider, Agent, Skill, Gateway, Conversation, ChatRoom, Job, Profile } from '@/lib/types';

export type ViewMode =
  | 'dashboard'
  | 'agents'
  | 'agent-detail'
  | 'providers'
  | 'skills'
  | 'hermes'
  | 'chat'
  | 'chat-rooms'
  | 'settings'
  | 'channels'
  | 'jobs'
  | 'usage'
  | 'profiles'
  | 'memory'
  | 'logs'
  | 'files'
  | 'terminal';

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;

  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;

  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;

  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;

  providers: Provider[];
  setProviders: (providers: Provider[]) => void;

  agents: Agent[];
  setAgents: (agents: Agent[]) => void;

  skills: Skill[];
  setSkills: (skills: Skill[]) => void;

  gateways: Gateway[];
  setGateways: (gateways: Gateway[]) => void;

  conversations: Conversation[];
  setConversations: (conversations: Conversation[]) => void;

  chatRooms: ChatRoom[];
  setChatRooms: (rooms: ChatRoom[]) => void;

  channels: unknown[];
  setChannels: (channels: unknown[]) => void;

  jobs: Job[];
  setJobs: (jobs: Job[]) => void;

  profiles: Profile[];
  setProfiles: (profiles: Profile[]) => void;
  activeProfileId: string | null;
  setActiveProfileId: (id: string | null) => void;

  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  showCreateDialog: string | null;
  setShowCreateDialog: (dialog: string | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  currentView: 'dashboard',
  setCurrentView: (currentView) => set({ currentView }),

  selectedAgentId: null,
  setSelectedAgentId: (selectedAgentId) => set({ selectedAgentId }),

  selectedConversationId: null,
  setSelectedConversationId: (selectedConversationId) => set({ selectedConversationId }),

  providers: [],
  setProviders: (providers) => set({ providers }),

  agents: [],
  setAgents: (agents) => set({ agents }),

  skills: [],
  setSkills: (skills) => set({ skills }),

  gateways: [],
  setGateways: (gateways) => set({ gateways }),

  conversations: [],
  setConversations: (conversations) => set({ conversations }),

  chatRooms: [],
  setChatRooms: (chatRooms) => set({ chatRooms }),

  channels: [],
  setChannels: (channels) => set({ channels }),

  jobs: [],
  setJobs: (jobs) => set({ jobs }),

  profiles: [],
  setProfiles: (profiles) => set({ profiles }),
  activeProfileId: null,
  setActiveProfileId: (activeProfileId) => set({ activeProfileId }),

  sidebarCollapsed: false,
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  showCreateDialog: null,
  setShowCreateDialog: (showCreateDialog) => set({ showCreateDialog }),
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
}));
