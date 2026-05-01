export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  role: string;
  status: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Provider {
  id: string;
  userId: string;
  name: string;
  provider: string;
  apiKey: string | null;
  baseUrl: string | null;
  models: string[];
  defaultModel: string | null;
  isActive: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  avatar: string | null;
  systemPrompt: string | null;
  mode: string;
  isPublic: boolean;
  status: string;
  providerId: string | null;
  model: string | null;
  temperature: number | null;
  maxTokens: number | null;
  callbackUrl: string | null;
  createdAt: string;
  updatedAt: string;
  skills?: AgentSkill[];
  connections?: AgentConnection[];
  plugins?: AgentPlugin[];
}

export interface Skill {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  version: string;
  author: string | null;
  icon: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSkill {
  id: string;
  agentId: string;
  skillId: string;
  config: Record<string, unknown>;
  isEnabled: boolean;
  priority: number;
}

export interface AgentPlugin {
  id: string;
  agentId: string;
  name: string;
  description: string | null;
  type: string;
  endpoint: string | null;
  config: Record<string, unknown>;
  authType: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentConnection {
  id: string;
  agentId: string;
  type: string;
  name: string | null;
  config: Record<string, unknown>;
  status: string;
  lastPing: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Gateway {
  id: string;
  userId: string;
  name: string;
  host: string;
  port: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  agentId: string;
  agent?: Agent;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  content: string;
  type: string;
  senderType: string;
  senderName: string;
  createdAt: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  agents?: Agent[];
  createdAt: string;
}

export interface Job {
  id: string;
  userId: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  userId: string;
  name: string;
  providerId: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  id: string;
  userId: string;
  key: string;
  value: string;
  updatedAt: string;
}

export interface UsageRecord {
  id: string;
  userId: string;
  agentId: string;
  tokens: number;
  cost: number;
  createdAt: string;
}

export interface LogEntry {
  id: string;
  level: string;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface FileEntry {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  createdAt: string;
  updatedAt: string;
}
