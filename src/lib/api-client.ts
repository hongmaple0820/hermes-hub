/**
 * Frontend API Client for Hermes Hub
 * Uses JWT-based authentication with httpOnly cookie fallback
 */

const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;
  private userId: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  private persistAuth(token: string, userId: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hermes_auth_token', token);
      localStorage.setItem('hermes_auth_user_id', userId);
    }
  }

  private restoreAuth(): { token: string | null; userId: string | null } {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('hermes_auth_token');
      const userId = localStorage.getItem('hermes_auth_user_id');
      // Also check legacy keys for backward compatibility
      if (!token) {
        const legacyToken = localStorage.getItem('hermes-auth-user-id') || localStorage.getItem('hermes_token');
        if (legacyToken) {
          // Legacy: the token was actually a userId
          return { token: null, userId: legacyToken };
        }
      }
      return { token, userId };
    }
    return { token: null, userId: null };
  }

  private clearPersistedAuth() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hermes_auth_token');
      localStorage.removeItem('hermes_auth_user_id');
      // Also clean legacy keys
      localStorage.removeItem('hermes-auth-user-id');
      localStorage.removeItem('hermes_token');
      localStorage.removeItem('hermes_user');
    }
  }

  setAuth(token: string, userId: string) {
    this.token = token;
    this.userId = userId;
    this.persistAuth(token, userId);
  }

  setUserId(id: string) {
    this.userId = id;
    this.persistAuth(this.token || id, id);
  }

  getUserId(): string | null {
    return this.userId;
  }

  getToken(): string | null {
    return this.token;
  }

  logout() {
    this.token = null;
    this.userId = null;
    this.clearPersistedAuth();
    // Call logout API to clear httpOnly cookies
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  }

  tryRestoreAuth(): boolean {
    const { token, userId } = this.restoreAuth();
    if (token && userId) {
      this.token = token;
      this.userId = userId;
      return true;
    }
    // Legacy: if only userId, we can try using it as x-user-id for backward compat
    if (userId) {
      this.userId = userId;
      return true;
    }
    return false;
  }

  async refreshToken(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data.token && data.user) {
            this.token = data.token;
            this.userId = data.user.id;
            this.persistAuth(data.token, data.user.id);
            return true;
          }
        }
        return false;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async request(path: string, options: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Send JWT token as Authorization header
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Also send x-user-id for backward compat with legacy auth
    if (this.userId) {
      headers['x-user-id'] = this.userId;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    // On 401, try to refresh the token once
    if (res.status === 401 && this.token) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // Retry the request with new token
        headers['Authorization'] = `Bearer ${this.token}`;
        if (this.userId) headers['x-user-id'] = this.userId;
        const retryRes = await fetch(`${API_BASE}${path}`, {
          ...options,
          headers,
        });
        if (retryRes.ok) return retryRes;
      }
      // Refresh failed — logout
      this.logout();
    }

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

  // Auth
  async register(email: string, name: string, password: string) {
    return this.post<{ user: any; token: string }>('/auth/register', { email, name, password });
  }

  async login(email: string, password: string) {
    return this.post<{ user: any; token: string }>('/auth/login', { email, password });
  }

  async getMe() {
    return this.get<{ user: any }>('/auth/me');
  }

  async getAuthMe() {
    return this.get<{ user: any }>('/auth/me');
  }

  // Profile management
  async updateProfile(data: { name?: string; email?: string; avatar?: string }) {
    return this.patch<{ user: any }>('/auth/profile', data);
  }

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    return this.post<{ success: boolean }>('/auth/change-password', data);
  }

  // Providers
  async getProviders() {
    return this.get<{ providers: any[] }>('/providers');
  }

  async createProvider(data: any) {
    return this.post<{ provider: any }>('/providers', data);
  }

  async updateProvider(id: string, data: any) {
    return this.patch<{ provider: any }>(`/providers/${id}`, data);
  }

  async deleteProvider(id: string) {
    return this.del(`/providers/${id}`);
  }

  async testProvider(id: string) {
    return this.post<{ success: boolean; message: string; models?: string[] }>(`/providers/${id}/test`);
  }

  // Provider encryption status
  async getProviderEncryptionStatus(id: string) {
    return this.get<{ encrypted: boolean; maskedKey: string }>(`/providers/${id}/encryption-status`);
  }

  // Agents
  async getAgents() {
    return this.get<{ agents: any[] }>('/agents');
  }

  async createAgent(data: any) {
    return this.post<{ agent: any }>('/agents', data);
  }

  async updateAgent(id: string, data: any) {
    return this.patch<{ agent: any }>(`/agents/${id}`, data);
  }

  async deleteAgent(id: string) {
    return this.del(`/agents/${id}`);
  }

  async discoverAgents() {
    return this.get<{ agents: any[] }>('/agents/discover');
  }

  // Agent Skills
  async getAgentSkills(agentId: string) {
    return this.get<{ skills: any[] }>(`/agents/${agentId}/skills`);
  }

  async updateAgentSkill(agentId: string, skillId: string, data: any) {
    return this.patch(`/agents/${agentId}/skills/${skillId}`, data);
  }

  async removeAgentSkill(agentId: string, skillId: string) {
    return this.del(`/agents/${agentId}/skills/${skillId}`);
  }

  // Agent Plugins
  async getAgentPlugins(agentId: string) {
    return this.get<{ plugins: any[] }>(`/agents/${agentId}/plugins`);
  }

  async createAgentPlugin(agentId: string, data: any) {
    return this.post<{ plugin: any }>(`/agents/${agentId}/plugins`, data);
  }

  async updateAgentPlugin(agentId: string, pluginId: string, data: any) {
    return this.patch(`/agents/${agentId}/plugins/${pluginId}`, data);
  }

  async deleteAgentPlugin(agentId: string, pluginId: string) {
    return this.del(`/agents/${agentId}/plugins/${pluginId}`);
  }

  // Agent Connections
  async getAgentConnections(agentId: string) {
    return this.get<{ connections: any[] }>(`/agents/${agentId}/connections`);
  }

  async createAgentConnection(agentId: string, data: any) {
    return this.post<{ connection: any }>(`/agents/${agentId}/connections`, data);
  }

  async updateAgentConnection(agentId: string, connectionId: string, data: any) {
    return this.patch(`/agents/${agentId}/connections/${connectionId}`, data);
  }

  async deleteAgentConnection(agentId: string, connectionId: string) {
    return this.del(`/agents/${agentId}/connections/${connectionId}`);
  }

  // Skills
  async getSkills(category?: string) {
    const query = category ? `?category=${category}` : '';
    return this.get<{ skills: any[] }>(`/skills${query}`);
  }

  async createSkill(data: any) {
    return this.post<{ skill: any }>('/skills', data);
  }

  async installSkill(skillId: string, data: { agentId: string; config?: any }) {
    return this.post<{ agentSkill: any }>(`/skills/${skillId}/install`, data);
  }

  async uninstallSkill(skillId: string, agentId: string) {
    return this.del<{ success: boolean }>(`/skills/${skillId}/uninstall?agentId=${encodeURIComponent(agentId)}`);
  }

  async importSkill(sourceUrl: string, skillPath?: string) {
    return this.post<{ imported: number; skills: any[] }>('/skills/import-skill', { sourceUrl, skillPath });
  }

  // Conversations
  async getConversations() {
    return this.get<{ conversations: any[] }>('/conversations');
  }

  async createConversation(data: { agentId: string; type?: string; name?: string }) {
    return this.post<{ conversation: any }>('/conversations', data);
  }

  async getConversation(id: string) {
    return this.get<{ conversation: any }>(`/conversations/${id}`);
  }

  async getMessages(conversationId: string) {
    return this.get<{ messages: any[] }>(`/conversations/${conversationId}/messages`);
  }

  async sendMessage(conversationId: string, content: string, type?: string) {
    return this.post<{ message: any; agentReply?: { content: string } | null }>(
      `/conversations/${conversationId}/messages`,
      { content, type }
    );
  }

  // Chat Rooms
  async getChatRooms() {
    return this.get<{ rooms: any[] }>('/chat-rooms');
  }

  async createChatRoom(data: any) {
    return this.post<{ room: any }>('/chat-rooms', data);
  }

  // Chat Rooms
  async deleteChatRoom(id: string) {
    return this.del(`/chat-rooms/${id}`);
  }

  async getChatRoomMessages(roomId: string) {
    return this.get<{ messages: any[] }>(`/chat-rooms/${roomId}/messages`);
  }

  async sendChatRoomMessage(roomId: string, content: string) {
    return this.post<{ message: any }>(`/chat-rooms/${roomId}/messages`, { content });
  }

  async joinChatRoom(joinCode: string) {
    return this.post<{ room: any; joined?: boolean; alreadyMember?: boolean }>('/chat-rooms/join', { joinCode });
  }

  // Channels
  async getChannels() {
    return this.get<{ channels: any[] }>('/channels');
  }

  async updateChannel(platform: string, data: any) {
    return this.patch<{ channel: any }>(`/channels/${platform}`, data);
  }

  // Jobs
  async getJobs() {
    return this.get<{ jobs: any[] }>('/jobs');
  }

  async createJob(data: any) {
    return this.post<{ job: any }>('/jobs', data);
  }

  async updateJob(id: string, data: any) {
    return this.patch<{ job: any }>(`/jobs/${id}`, data);
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
    return this.get<{ profiles: any[] }>('/profiles');
  }

  async createProfile(data: any) {
    return this.post<{ profile: any }>('/profiles', data);
  }

  async updateProfile(id: string, data: any) {
    return this.patch<{ profile: any }>(`/profiles/${id}`, data);
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

  async importProfile(data: any) {
    return this.post('/profiles/import', data);
  }

  // Memory
  async getMemory(agentId?: string) {
    const query = agentId ? `?agentId=${agentId}` : '';
    return this.get<{ memory: any }>(`/memory${query}`);
  }

  async updateMemory(section: string, content: string, agentId?: string) {
    return this.post('/memory', { section, content, agentId });
  }

  // Usage
  async getUsage(period?: string) {
    const query = period ? `?period=${period}` : '';
    return this.get<{ usage: any }>(`/usage${query}`);
  }

  async getSessionUsage(sessionId: string) {
    return this.get<{ usage: any }>(`/usage/${sessionId}`);
  }

  // Logs
  async getLogs(type?: string, limit?: number) {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (limit) params.set('limit', String(limit));
    return this.get<{ logs: any[] }>(`/logs?${params.toString()}`);
  }

  async getLogFile(name: string) {
    return this.get<{ entries: any[] }>(`/logs/${name}`);
  }

  // Files
  async listFiles(path?: string) {
    const query = path ? `?path=${encodeURIComponent(path)}` : '';
    return this.get<{ files: any[] }>(`/files/list${query}`);
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
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (this.userId) headers['x-user-id'] = this.userId;
    const res = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const res = await this.request(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return res.json();
  }

  // Search
  async searchSessions(keyword: string) {
    return this.get<{ results: any[] }>(`/search/sessions?keyword=${encodeURIComponent(keyword)}`);
  }

  // Settings
  async getSettings() {
    return this.get<{ settings: any }>('/settings');
  }

  async updateSettings(data: any) {
    return this.patch<{ settings: any }>('/settings', data);
  }

  // Seed
  async seedSkills() {
    return this.post('/seed/skills');
  }

  // OAuth - Codex
  async startCodexOAuth() {
    return this.post<{ deviceCode: string; userCode: string; verificationUri: string; expiresIn: number }>('/auth/codex');
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
    return this.post<{ deviceCode: string; userCode: string; verificationUri: string; expiresIn: number }>('/auth/nous');
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
    return this.post<{ deviceCode: string; userCode: string; verificationUri: string; expiresIn: number }>('/auth/copilot');
  }
  async pollCopilotOAuth(deviceCode: string) {
    return this.get<{ status: string }>(`/auth/copilot/poll?deviceCode=${encodeURIComponent(deviceCode)}`);
  }
  async getCopilotStatus() {
    return this.get<{ valid: boolean; source: string; status?: string }>('/auth/copilot/check-token');
  }
  async enableCopilot() {
    return this.post('/auth/copilot', { action: 'enable' });
  }
  async disableCopilot() {
    return this.post('/auth/copilot', { action: 'disable' });
  }
  async revokeCopilotOAuth() {
    return this.del('/auth/copilot');
  }

  // Skill Plugin Protocol
  async generateSkillEndpoint(agentId: string, skillId: string) {
    return this.post<{
      endpointUrl: string;
      endpointToken: string;
      callbackSecret: string;
      wsConnectUrl: string;
      wsDirectUrl: string;
      connectionMode: string;
    }>(
      `/agents/${agentId}/generate-skill-endpoint`, { skillId }
    );
  }

  async generatePluginEndpoint(agentId: string, pluginId: string) {
    return this.post<{ endpointUrl: string; endpointToken: string; callbackSecret: string }>(
      `/agents/${agentId}/generate-skill-endpoint`, { pluginId }
    );
  }

  async testSkillConnection(agentId: string, skillId: string) {
    return this.post<{ success: boolean; latency?: number; error?: string }>(
      `/agents/${agentId}/skills/${skillId}/test`
    );
  }

  async testPluginConnection(agentId: string, pluginId: string) {
    return this.post<{ success: boolean; latency?: number; error?: string }>(
      `/agents/${agentId}/plugins/${pluginId}/test`
    );
  }

  async testConnection(agentId: string, connectionId: string) {
    return this.post<{ success: boolean; latency?: number; error?: string }>(
      `/agents/${agentId}/connections/${connectionId}/test`
    );
  }

  async registerSkillProtocol(data: { endpointToken: string; agentInfo: { name: string; callbackUrl: string; version?: string; capabilities?: string[] } }) {
    return this.post<{ success: boolean; protocol: string; events: string[] }>('/skill-protocol/register', data);
  }

  async sendSkillHeartbeat(data: { endpointToken: string; status: string; metrics?: any }) {
    return this.post<{ success: boolean; nextHeartbeat: number }>('/skill-protocol/heartbeat', data);
  }

  async sendSkillEvent(data: { endpointToken: string; event: { type: string; data: any; timestamp?: string } }) {
    return this.post<{ success: boolean; eventId: string }>('/skill-protocol/events', data);
  }

  // Skill WebSocket Connection
  async getSkillConnectionInfo(agentId: string, skillId: string) {
    return this.get<{
      endpointToken: string | null;
      callbackUrl: string | null;
      callbackSecret: string | null;
      wsStatus: { connected: boolean; lastHeartbeat: string | null; socketId: string | null };
      wsConnectUrl: string | null;
      connectionMode: string;
    }>(`/skill-protocol/connection-info?agentId=${agentId}&skillId=${skillId}`);
  }

  async regenerateSkillEndpoint(agentId: string, skillId: string) {
    return this.post<{
      endpointUrl: string;
      endpointToken: string;
      callbackSecret: string;
      wsConnectUrl: string;
      wsDirectUrl: string;
      connectionMode: string;
    }>(`/agents/${agentId}/generate-skill-endpoint`, { skillId, regenerate: true });
  }

  // Notifications
  async getNotifications(limit?: number, unreadOnly?: boolean) {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (unreadOnly) params.set('unread', 'true');
    return this.get<{ notifications: any[]; unreadCount: number; total: number }>(`/notifications?${params.toString()}`);
  }

  async createNotification(data: { userId?: string; type: string; title: string; message: string; actionUrl?: string; metadata?: any }) {
    return this.post<{ notification: any }>('/notifications', data);
  }

  async markNotificationRead(notificationId: string) {
    return this.patch<{ success: boolean; notificationId }>('/notifications', { notificationId });
  }

  async markAllNotificationsRead() {
    return this.patch<{ success: boolean; action: string }>('/notifications', { markAllRead: true });
  }

  async deleteNotification(id: string) {
    return this.del(`/notifications?id=${encodeURIComponent(id)}`);
  }

  async clearAllNotifications() {
    return this.del('/notifications?clearAll=true');
  }

  // ACRP - Agent Capability Registration Protocol
  async generateAcrpToken(agentId: string) {
    return this.post<{ agentToken: string; wsConnectUrl: string; wsDirectUrl: string; agentId: string }>('/acrp/generate-token', { agentId });
  }

  async getAcrpAgents() {
    return this.get<{ agents: any[] }>('/acrp/agents');
  }

  async getAcrpAgent(id: string) {
    return this.get<{ agent: any; capabilities: any[]; recentInvocations: any[]; liveStatus: any }>(`/acrp/agents/${id}`);
  }

  async invokeCapability(agentId: string, capabilityId: string, params?: any) {
    return this.post<{ invocationId: string; status: string }>(`/acrp/agents/${agentId}/invoke`, { capabilityId, params });
  }

  async sendAgentCommand(agentId: string, command: string, params?: any) {
    return this.post<{ success: boolean }>(`/acrp/agents/${agentId}/command`, { command, params });
  }

  async getAcrpInvocations(agentId?: string, capabilityId?: string, status?: string, limit?: number) {
    const params = new URLSearchParams();
    if (agentId) params.set('agentId', agentId);
    if (capabilityId) params.set('capabilityId', capabilityId);
    if (status) params.set('status', status);
    if (limit) params.set('limit', String(limit));
    return this.get<{ invocations: any[] }>(`/acrp/invocations?${params.toString()}`);
  }

  async revokeAcrpToken(agentId: string) {
    return this.del(`/acrp/agents/${agentId}/token`);
  }

  // Analytics
  async getSkillAnalytics() {
    return this.get<{
      totalInvocations: number;
      invocationsBySkill: { capabilityId: string; name: string; count: number }[];
      invocationsByStatus: Record<string, number>;
      recentInvocations: { id: string; capabilityId: string; capabilityName: string; status: string; duration: number | null; error: string | null; createdAt: string; completedAt: string | null }[];
      topSkills: { capabilityId: string; name: string; total: number; successCount: number; successRate: number }[];
    }>('/analytics/skills');
  }

  async getOverviewAnalytics() {
    return this.get<{
      totalAgents: number;
      onlineAgents: number;
      totalConversations: number;
      totalSkills: number;
      activeSkills: number;
      totalProviders: number;
      activeProviders: number;
      recentActivityCount: number;
    }>('/analytics/overview');
  }

  async getDashboardAnalytics() {
    return this.get<{
      agents: {
        total: number;
        online: number;
        builtin: number;
        acrp: number;
        acrpConnected: number;
      };
      conversations: {
        total: number;
        convsPerDay: { date: string; count: number }[];
      };
      messages: {
        total: number;
        messagesPerDay: { date: string; count: number }[];
      };
      providers: {
        total: number;
        active: number;
      };
      skills: {
        total: number;
        totalInvocations: number;
      };
      chatRooms: {
        total: number;
      };
    }>('/analytics/dashboard');
  }

  // Usage Analytics
  async getUsageAnalytics() {
    return this.get<{
      totalInputTokens: number;
      totalOutputTokens: number;
      totalTokens: number;
      estimatedCost: number;
      dailyUsage: { date: string; inputTokens: number; outputTokens: number; cost: number }[];
      byAgent: { agentId: string; agentName: string; tokens: number; cost: number }[];
      byModel: { model: string; tokens: number; cost: number }[];
    }>('/analytics/usage');
  }

  // Context Engine
  async getContext(type: 'conversation' | 'room', id: string) {
    return this.get<{ context: string; wasCompressed: boolean; snapshotId?: string; tokenCount: number; stats: any }>(`/context?type=${type}&id=${id}`);
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
    return this.get<{ current: any; ancestors: any[]; totalMessages: number }>(`/conversations/${conversationId}/lineage`);
  }

  async continueConversation(conversationId: string, agentId?: string) {
    return this.post<{ conversationId: string; carriedContext: string }>(`/conversations/${conversationId}/continue`, { agentId });
  }

  // Quickstart
  async getQuickstartStatus() {
    return this.get<{ hasProvider: boolean; hasAgent: boolean; hasConversation: boolean; isReady: boolean; defaultAgentId: string | null }>('/quickstart');
  }

  async quickstartSetup() {
    return this.post<{ provider: any; agent: any; skills: any[]; message: string }>('/quickstart/setup', {});
  }
}

export const api = new ApiClient();
