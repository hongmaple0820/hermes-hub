/**
 * Frontend API Client for Hermes Hub
 */

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
    return this.post<{ success: boolean }>(`/skills/${skillId}/uninstall`, { agentId });
  }

  // Hermes Gateways
  async getGateways() {
    return this.get<{ gateways: any[] }>('/hermes/gateways');
  }

  async createGateway(data: any) {
    return this.post<{ gateway: any }>('/hermes/gateways', data);
  }

  async updateGateway(id: string, data: any) {
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

  // Seed
  async seedSkills() {
    return this.post('/seed/skills');
  }
}

export const api = new ApiClient();
