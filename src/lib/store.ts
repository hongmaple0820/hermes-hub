import { create } from 'zustand';

export type ViewMode =
  | 'dashboard'
  | 'agents'
  | 'agent-detail'
  | 'providers'
  | 'skills'
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
  | 'agent-control'
  | 'notifications';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'agent_connected' | 'agent_disconnected' | 'skill_invoked' | 'capability_result' | 'new_message';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  metadata?: Record<string, any>;
  live?: boolean; // true if received via Socket.IO (real-time)
  persisted?: boolean; // true if loaded from DB
}

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

  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  addPersistedNotifications: (notifications: Notification[]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  removeNotification: (id: string) => void;

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

  // Notifications
  notifications: [],
  addNotification: (notification) => set((state) => {
    const newNotification: Notification = {
      ...notification,
      id: notification.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: notification.timestamp || new Date().toISOString(),
      read: false,
    };
    // Avoid duplicates by ID
    const exists = state.notifications.some((n) => n.id === newNotification.id);
    if (exists) return state;
    return { notifications: [newNotification, ...state.notifications] };
  }),
  addPersistedNotifications: (persistedNotifications) => set((state) => {
    // Merge persisted notifications with existing live ones, avoiding duplicates
    const existingIds = new Set(state.notifications.map((n) => n.id));
    const newPersisted = persistedNotifications
      .filter((n) => !existingIds.has(n.id))
      .map((n) => ({ ...n, persisted: true as const }));
    // Merge: persisted ones + live ones, sorted by timestamp desc
    const merged = [...newPersisted, ...state.notifications]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { notifications: merged };
  }),
  markAsRead: (id) => set((state) => ({
    notifications: state.notifications.map((n) => n.id === id ? { ...n, read: true } : n),
  })),
  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, read: true })),
  })),
  clearNotifications: () => set({ notifications: [] }),
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id),
  })),

  // UI
  sidebarCollapsed: false,
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  showCreateDialog: null,
  setShowCreateDialog: (showCreateDialog) => set({ showCreateDialog }),
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
}));
