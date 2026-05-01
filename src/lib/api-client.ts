import type {
  User, AuthResponse, Provider, Agent, Skill, AgentSkill,
  AgentPlugin, AgentConnection, Gateway, Conversation, Message,
  ChatRoom, Job, Profile, AppSettings, UsageRecord, LogEntry, FileEntry,
} from '@/lib/types';

const API_BASE = '/api';

class ApiClient {
  private userId: string | null = null;

  setUserId(id: string) {
    this.userId = id;
  }

  getUserId(): string | null {
    return this.userId;
  }

  private async request(path: string, options: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.userId) {
      headers['x-user-id'] = this.userId;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(data.error || data.details || `Request failed: ${res.status}`);
    }

    return res;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.request(path);
    return res.json();
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await this.request(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  private async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await this.request(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return res.json();
  }

  private async del<T>(path: string): Promise<T> {
    const res = await this.request(path, { method: 'DELETE' });
    return res.json();
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const res = await this.request(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return res.json();
  }

  // Auth
  async register(email: string, name: string, password: string) {
    return this.post<AuthResponse>('/auth/register', { email, name, password });
  }

  async login(email: string, password: string) {
    return this.post<AuthResponse>('/auth/login', { email, password });
  }

  async getMe() {
    return this.get<{ user: User }>('/auth/me');
  }

  // Providers
  async getProviders() {
    return this.get<{ providers: Provider[] }>('/providers');
  }

  async createProvider(data: Partial<Provider>) {
    return this.post<{ provider: Provider }>('/providers', data);
  }

  async updateProvider(id: string, data: Partial<Provider>) {
    return this.patch<{ provider: Provider }>(`/providers/${id}`, data);
  }

  async deleteProvider(id: string) {
    return this.del(`/providers/${id}`);
  }

  async testProvider(id: string) {
    return this.post<{ success: boolean; message: string; models?: string[] }>(`/providers/${id}/test`);
  }

  // Agents
  async getAgents() {
    return this.get<{ agents: Agent[] }>('/agents');
  }

  async createAgent(data: Partial<Agent>) {
    return this.post<{ agent: Agent }>('/agents', data);
  }

  async updateAgent(id: string, data: Partial<Agent>) {
    return this.patch<{ agent: Agent }>(`/agents/${id}`, data);
  }

  async deleteAgent(id: string) {
    return this.del(`/agents/${id}`);
  }

  async discoverAgents() {
    return this.get<{ agents: Agent[] }>('/agents/discover');
  }

  // Agent Skills
  async getAgentSkills(agentId: string) {
    return this.get<{ skills: AgentSkill[] }>(`/agents/${agentId}/skills`);
  }

  async updateAgentSkill(agentId: string, skillId: string, data: Partial<AgentSkill>) {
    return this.patch(`/agents/${agentId}/skills/${skillId}`, data);
  }

  async removeAgentSkill(agentId: string, skillId: string) {
    return this.del(`/agents/${agentId}/skills/${skillId}`);
  }

  // Agent Plugins
  async getAgentPlugins(agentId: string) {
    return this.get<{ plugins: AgentPlugin[] }>(`/agents/${agentId}/plugins`);
  }

  async createAgentPlugin(agentId: string, data: Partial<AgentPlugin>) {
    return this.post<{ plugin: AgentPlugin }>(`/agents/${agentId}/plugins`, data);
  }

  async updateAgentPlugin(agentId: string, pluginId: string, data: Partial<AgentPlugin>) {
    return this.patch(`/agents/${agentId}/plugins/${pluginId}`, data);
  }

  async deleteAgentPlugin(agentId: string, pluginId: string) {
    return this.del(`/agents/${agentId}/plugins/${pluginId}`);
  }

  // Agent Connections
  async getAgentConnections(agentId: string) {
    return this.get<{ connections: AgentConnection[] }>(`/agents/${agentId}/connections`);
  }

  async createAgentConnection(agentId: string, data: Partial<AgentConnection>) {
    return this.post<{ connection: AgentConnection }>(`/agents/${agentId}/connections`, data);
  }

  async updateAgentConnection(agentId: string, connectionId: string, data: Partial<AgentConnection>) {
    return this.patch(`/agents/${agentId}/connections/${connectionId}`, data);
  }

  async deleteAgentConnection(agentId: string, connectionId: string) {
    return this.del(`/agents/${agentId}/connections/${connectionId}`);
  }

  // Skills
  async getSkills(category?: string) {
    const query = category ? `?category=${category}` : '';
    return this.get<{ skills: Skill[] }>(`/skills${query}`);
  }

  async createSkill(data: Partial<Skill>) {
    return this.post<{ skill: Skill }>('/skills', data);
  }

  async installSkill(skillId: string, data: { agentId: string; config?: Record<string, unknown> }) {
    return this.post<{ agentSkill: AgentSkill }>(`/skills/${skillId}/install`, data);
  }

  async uninstallSkill(skillId: string, agentId: string) {
    return this.post<{ success: boolean }>(`/skills/${skillId}/uninstall`, { agentId });
  }

  // Hermes Gateways
  async getGateways() {
    return this.get<{ gateways: Gateway[] }>('/hermes/gateways');
  }

  async createGateway(data: Partial<Gateway>) {
    return this.post<{ gateway: Gateway }>('/hermes/gateways', data);
  }

  async updateGateway(id: string, data: Partial<Gateway>) {
    return this.patch(`/hermes/gateways/${id}`, data);
  }

  async deleteGateway(id: string) {
    return this.del(`/hermes/gateways/${id}`);
  }

  async startGateway(id: string) {
    return this.post(`/hermes/gateways/${id}/start`);
  }

  async stopGateway(id: string) {
    return this.post(`/hermes/gateways/${id}/stop`);
  }

  async checkGatewayHealth(id: string) {
    return this.get(`/hermes/gateways/${id}/health`);
  }

  // Conversations
  async getConversations() {
    return this.get<{ conversations: Conversation[] }>('/conversations');
  }

  async createConversation(data: { agentId: string; type?: string; name?: string }) {
    return this.post<{ conversation: Conversation }>('/conversations', data);
  }

  async getConversation(id: string) {
    return this.get<{ conversation: Conversation }>(`/conversations/${id}`);
  }

  async getMessages(conversationId: string) {
    return this.get<{ messages: Message[] }>(`/conversations/${conversationId}/messages`);
  }

  async sendMessage(conversationId: string, content: string, type?: string) {
    return this.post<{ message: Message; agentReply?: { content: string } | null }>(
      `/conversations/${conversationId}/messages`,
      { content, type }
    );
  }

  // Chat Rooms
  async getChatRooms() {
    return this.get<{ rooms: ChatRoom[] }>('/chat-rooms');
  }

  async createChatRoom(data: Partial<ChatRoom> & { agentIds?: string[] }) {
    return this.post<{ room: ChatRoom }>('/chat-rooms', data);
  }

  async deleteChatRoom(id: string) {
    return this.del(`/chat-rooms/${id}`);
  }

  async getChatRoomMessages(roomId: string) {
    return this.get<{ messages: Message[] }>(`/chat-rooms/${roomId}/messages`);
  }

  async sendChatRoomMessage(roomId: string, content: string) {
    return this.post<{ message: Message }>(`/chat-rooms/${roomId}/messages`, { content });
  }

  // Channels
  async getChannels() {
    return this.get<{ channels: unknown[] }>('/channels');
  }

  async updateChannel(platform: string, data: Record<string, unknown>) {
    return this.patch<{ channel: unknown }>(`/channels/${platform}`, data);
  }

  // Jobs
  async getJobs() {
    return this.get<{ jobs: Job[] }>('/jobs');
  }

  async createJob(data: Partial<Job>) {
    return this.post<{ job: Job }>('/jobs', data);
  }

  async updateJob(id: string, data: Partial<Job>) {
    return this.patch<{ job: Job }>(`/jobs/${id}`, data);
  }

  async deleteJob(id: string) {
    return this.del(`/jobs/${id}`);
  }

  async pauseJob(id: string) {
    return this.post(`/jobs/${id}/pause`);
  }

  async resumeJob(id: string) {
    return this.post(`/jobs/${id}/resume`);
  }

  async runJob(id: string) {
    return this.post(`/jobs/${id}/run`);
  }

  // Profiles
  async getProfiles() {
    return this.get<{ profiles: Profile[] }>('/profiles');
  }

  async createProfile(data: Partial<Profile>) {
    return this.post<{ profile: Profile }>('/profiles', data);
  }

  async updateProfile(id: string, data: Partial<Profile>) {
    return this.patch<{ profile: Profile }>(`/profiles/${id}`, data);
  }

  async deleteProfile(id: string) {
    return this.del(`/profiles/${id}`);
  }

  async switchProfile(id: string) {
    return this.post('/profiles/switch', { profileId: id });
  }

  async exportProfile(id: string) {
    return this.post(`/profiles/${id}/export`);
  }

  async importProfile(data: Record<string, unknown>) {
    return this.post('/profiles/import', data);
  }

  // Memory
  async getMemory(agentId?: string) {
    const query = agentId ? `?agentId=${agentId}` : '';
    return this.get<{ memory: unknown }>(`/memory${query}`);
  }

  async updateMemory(section: string, content: string, agentId?: string) {
    return this.post('/memory', { section, content, agentId });
  }

  // Usage
  async getUsage(period?: string) {
    const query = period ? `?period=${period}` : '';
    return this.get<{ usage: UsageRecord[] }>(`/usage${query}`);
  }

  async getSessionUsage(sessionId: string) {
    return this.get<{ usage: UsageRecord }>(`/usage/${sessionId}`);
  }

  // Logs
  async getLogs(type?: string, limit?: number) {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (limit) params.set('limit', String(limit));
    return this.get<{ logs: LogEntry[] }>(`/logs?${params.toString()}`);
  }

  async getLogFile(name: string) {
    return this.get<{ entries: LogEntry[] }>(`/logs/${name}`);
  }

  // Files
  async listFiles(path?: string) {
    const query = path ? `?path=${encodeURIComponent(path)}` : '';
    return this.get<{ files: FileEntry[] }>(`/files/list${query}`);
  }

  async readFile(path: string) {
    return this.get<{ content: string }>(`/files/read?path=${encodeURIComponent(path)}`);
  }

  async writeFile(path: string, content: string) {
    return this.put('/files/write', { path, content });
  }

  async deleteFile(path: string, recursive?: boolean) {
    return this.del(`/files/delete?path=${encodeURIComponent(path)}${recursive ? '&recursive=true' : ''}`);
  }

  async renameFile(oldPath: string, newPath: string) {
    return this.post('/files/rename', { oldPath, newPath });
  }

  async mkdir(path: string) {
    return this.post('/files/mkdir', { path });
  }

  async uploadFile(formData: FormData) {
    const headers: Record<string, string> = {};
    if (this.userId) headers['x-user-id'] = this.userId;
    const res = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  }

  // Search
  async searchSessions(keyword: string) {
    return this.get<{ results: unknown[] }>(`/search/sessions?keyword=${encodeURIComponent(keyword)}`);
  }

  // Settings
  async getSettings() {
    return this.get<{ settings: AppSettings[] }>('/settings');
  }

  async updateSettings(data: Record<string, unknown>) {
    return this.patch<{ settings: AppSettings[] }>('/settings', data);
  }

  // Seed
  async seedSkills() {
    return this.post('/seed/skills');
  }

  // OAuth - Codex
  async startCodexOAuth() {
    return this.post<{ deviceCode: string; userCode: string; verificationUri: string; expiresIn: number }>('/auth/codex/start');
  }
  async pollCodexOAuth(deviceCode: string) {
    return this.get<{ status: string }>(`/auth/codex/poll?deviceCode=${encodeURIComponent(deviceCode)}`);
  }
  async getCodexOAuthStatus() {
    return this.get<{ status: string; hasToken: boolean; verifiedAt?: string }>('/auth/codex/status');
  }
  async revokeCodexOAuth() {
    return this.del('/auth/codex');
  }

  // OAuth - Nous
  async startNousOAuth() {
    return this.post<{ deviceCode: string; userCode: string; verificationUri: string; expiresIn: number }>('/auth/nous/start');
  }
  async pollNousOAuth(deviceCode: string) {
    return this.get<{ status: string }>(`/auth/nous/poll?deviceCode=${encodeURIComponent(deviceCode)}`);
  }
  async getNousOAuthStatus() {
    return this.get<{ status: string; hasToken: boolean; verifiedAt?: string }>('/auth/nous/status');
  }
  async revokeNousOAuth() {
    return this.del('/auth/nous');
  }

  // OAuth - Copilot
  async startCopilotOAuth() {
    return this.post<{ deviceCode: string; userCode: string; verificationUri: string; expiresIn: number }>('/auth/copilot/start');
  }
  async pollCopilotOAuth(deviceCode: string) {
    return this.get<{ status: string }>(`/auth/copilot/poll?deviceCode=${encodeURIComponent(deviceCode)}`);
  }
  async getCopilotStatus() {
    return this.get<{ valid: boolean; source: string; status?: string }>('/auth/copilot/check-token');
  }
  async enableCopilot() {
    return this.post('/auth/copilot/start', { action: 'enable' });
  }
  async disableCopilot() {
    return this.post('/auth/copilot/start', { action: 'disable' });
  }
  async revokeCopilotOAuth() {
    return this.del('/auth/copilot');
  }

  // Context Engine
  async getContext(type: 'conversation' | 'room', id: string) {
    return this.get<{ context: string; wasCompressed: boolean; snapshotId?: string; tokenCount: number; stats: unknown }>(`/context?type=${type}&id=${id}`);
  }

  async forceCompress(type: 'conversation' | 'room', id: string) {
    return this.post<{ snapshotId: string; summaryTokenCount: number }>('/context/compress', { type, id });
  }

  async compressRoom(roomId: string) {
    return this.post(`/chat-rooms/${roomId}/compress`);
  }

  async getContextDetails(type: 'conversation' | 'room', id: string) {
    return this.get(`/context/${type}/${id}`);
  }

  // Conversation Lineage
  async getConversationLineage(conversationId: string) {
    return this.get<{ current: unknown; ancestors: unknown[]; totalMessages: number }>(`/conversations/${conversationId}/lineage`);
  }

  async continueConversation(conversationId: string, agentId?: string) {
    return this.post<{ conversationId: string; carriedContext: string }>(`/conversations/${conversationId}/continue`, { agentId });
  }
}

export const api = new ApiClient();
