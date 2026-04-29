import { create } from 'zustand';

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
  | 'terminal'
  | 'agent-control';

interface AppState {
  // Auth
  user: any | null;
  isAuthenticated: boolean;
  setUser: (user: any | null) => void;

  // Navigation
  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;

  // Agent detail
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;

  // Chat
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;

  // Providers
  providers: any[];
  setProviders: (providers: any[]) => void;

  // Agents
  agents: any[];
  setAgents: (agents: any[]) => void;

  // Skills
  skills: any[];
  setSkills: (skills: any[]) => void;

  // Gateways
  gateways: any[];
  setGateways: (gateways: any[]) => void;

  // Conversations
  conversations: any[];
  setConversations: (conversations: any[]) => void;

  // Chat Rooms
  chatRooms: any[];
  setChatRooms: (rooms: any[]) => void;

  // Channels
  channels: any[];
  setChannels: (channels: any[]) => void;

  // Jobs
  jobs: any[];
  setJobs: (jobs: any[]) => void;

  // Profiles
  profiles: any[];
  setProfiles: (profiles: any[]) => void;
  activeProfileId: string | null;
  setActiveProfileId: (id: string | null) => void;

  // UI State
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  showCreateDialog: string | null; // 'agent', 'provider', 'skill', 'gateway', 'room'
  setShowCreateDialog: (dialog: string | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  // Navigation
  currentView: 'dashboard',
  setCurrentView: (currentView) => set({ currentView }),

  // Agent detail
  selectedAgentId: null,
  setSelectedAgentId: (selectedAgentId) => set({ selectedAgentId }),

  // Chat
  selectedConversationId: null,
  setSelectedConversationId: (selectedConversationId) => set({ selectedConversationId }),

  // Providers
  providers: [],
  setProviders: (providers) => set({ providers }),

  // Agents
  agents: [],
  setAgents: (agents) => set({ agents }),

  // Skills
  skills: [],
  setSkills: (skills) => set({ skills }),

  // Gateways
  gateways: [],
  setGateways: (gateways) => set({ gateways }),

  // Conversations
  conversations: [],
  setConversations: (conversations) => set({ conversations }),

  // Chat Rooms
  chatRooms: [],
  setChatRooms: (chatRooms) => set({ chatRooms }),

  // Channels
  channels: [],
  setChannels: (channels) => set({ channels }),

  // Jobs
  jobs: [],
  setJobs: (jobs) => set({ jobs }),

  // Profiles
  profiles: [],
  setProfiles: (profiles) => set({ profiles }),
  activeProfileId: null,
  setActiveProfileId: (activeProfileId) => set({ activeProfileId }),

  // UI
  sidebarCollapsed: false,
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  showCreateDialog: null,
  setShowCreateDialog: (showCreateDialog) => set({ showCreateDialog }),
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
}));
