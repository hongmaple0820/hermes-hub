import axios from 'axios';
import { getServerUrl, getToken } from './config-store.js';

class HermesAPI {
  constructor() {
    this.baseUrl = getServerUrl();
  }

  _getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  _getBaseUrl() {
    this.baseUrl = getServerUrl();
    return this.baseUrl;
  }

  async _request(method, path, data = null, params = null) {
    const url = `${this._getBaseUrl()}${path}`;
    const config = {
      method,
      url,
      headers: this._getHeaders(),
      params,
    };
    if (data) {
      config.data = data;
    }
    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        const err = new Error(error.response.data?.error || error.response.data?.message || `API Error: ${error.response.status}`);
        err.status = error.response.status;
        err.data = error.response.data;
        throw err;
      }
      throw new Error(`Network error: ${error.message}`);
    }
  }

  // Auth endpoints
  async login(email, password) {
    return this._request('POST', '/api/auth/login', { email, password });
  }

  async register(email, password, name) {
    return this._request('POST', '/api/auth/register', { email, password, name });
  }

  async getMe() {
    return this._request('GET', '/api/auth/me');
  }

  // Agent endpoints
  async listAgents() {
    return this._request('GET', '/api/agents');
  }

  async createAgent(data) {
    return this._request('POST', '/api/agents', data);
  }

  async getAgent(id) {
    return this._request('GET', `/api/agents/${id}`);
  }

  async updateAgent(id, data) {
    return this._request('PATCH', `/api/agents/${id}`, data);
  }

  async deleteAgent(id) {
    return this._request('DELETE', `/api/agents/${id}`);
  }

  // ACRP endpoints
  async generateAcrpToken(agentId) {
    return this._request('POST', '/api/acrp/generate-token', { agentId });
  }

  async listAcrpAgents() {
    return this._request('GET', '/api/acrp/agents');
  }

  async getAcrpAgent(id) {
    return this._request('GET', `/api/acrp/agents/${id}`);
  }

  async sendAcrpCommand(agentId, command, params = {}) {
    return this._request('POST', `/api/acrp/agents/${agentId}/command`, { command, ...params });
  }

  async invokeAcrpCapability(agentId, capability, params = {}) {
    return this._request('POST', `/api/acrp/agents/${agentId}/invoke`, { capability, params });
  }

  async listAcrpInvocations(params = {}) {
    return this._request('GET', '/api/acrp/invocations', null, params);
  }

  // Skill endpoints
  async listSkills() {
    return this._request('GET', '/api/skills');
  }

  async createSkill(data) {
    return this._request('POST', '/api/skills', data);
  }

  async getSkill(id) {
    return this._request('GET', `/api/skills/${id}`);
  }

  async installSkill(agentId, skillId) {
    return this._request('POST', `/api/agents/${agentId}/skills`, { skillId });
  }

  async uninstallSkill(agentId, skillId) {
    return this._request('DELETE', `/api/agents/${agentId}/skills/${skillId}`);
  }

  // Conversation endpoints
  async listConversations() {
    return this._request('GET', '/api/conversations');
  }

  async createConversation(data) {
    return this._request('POST', '/api/conversations', data);
  }

  async getConversation(id) {
    return this._request('GET', `/api/conversations/${id}`);
  }

  async getConversationMessages(id) {
    return this._request('GET', `/api/conversations/${id}/messages`);
  }

  async sendConversationMessage(id, message) {
    return this._request('POST', `/api/conversations/${id}/messages`, { content: message });
  }

  // Provider endpoints
  async listProviders() {
    return this._request('GET', '/api/providers');
  }

  async createProvider(data) {
    return this._request('POST', '/api/providers', data);
  }

  // Health check
  async healthCheck() {
    try {
      const response = await axios.get(`${this._getBaseUrl()}/api/auth/me`, {
        headers: this._getHeaders(),
        timeout: 5000,
        validateStatus: () => true,
      });
      return { reachable: true, status: response.status };
    } catch {
      return { reachable: false, status: null };
    }
  }
}

const api = new HermesAPI();
export default api;
