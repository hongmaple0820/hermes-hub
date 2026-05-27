import Conf from 'conf';
import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

// Ensure ~/.hermes directory exists
const hermesDir = join(homedir(), '.hermes');
if (!existsSync(hermesDir)) {
  mkdirSync(hermesDir, { recursive: true });
}

const config = new Conf({
  projectName: 'hermes',
  configName: 'config',
  projectSuffix: '',
  cwd: hermesDir,
  defaults: {
    serverUrl: 'http://localhost:3000',
    wsUrl: 'http://localhost:3004',
    token: null,
    userId: null,
    userEmail: null,
    currentAgentId: null,
    acrpTokens: {},
  },
});

export function getConfig(key) {
  return config.get(key);
}

export function setConfig(key, value) {
  config.set(key, value);
}

export function deleteConfig(key) {
  config.delete(key);
}

export function getAllConfig() {
  return config.store;
}

export function clearAllConfig() {
  config.clear();
}

export function getServerUrl() {
  return config.get('serverUrl') || 'http://localhost:3000';
}

export function getWsUrl() {
  return config.get('wsUrl') || 'http://localhost:3004';
}

export function getToken() {
  return config.get('token');
}

export function setToken(token) {
  config.set('token', token);
}

export function clearToken() {
  config.set('token', null);
  config.set('userId', null);
  config.set('userEmail', null);
}

export function isAuthenticated() {
  return !!config.get('token');
}

export function setAuthInfo({ token, userId, email }) {
  config.set('token', token);
  config.set('userId', userId);
  config.set('userEmail', email);
}

export function getAuthInfo() {
  return {
    token: config.get('token'),
    userId: config.get('userId'),
    email: config.get('userEmail'),
  };
}

export function getCurrentAgentId() {
  return config.get('currentAgentId');
}

export function setCurrentAgentId(agentId) {
  config.set('currentAgentId', agentId);
}

export function getAcrpToken(agentId) {
  const tokens = config.get('acrpTokens') || {};
  return tokens[agentId] || null;
}

export function setAcrpToken(agentId, token) {
  const tokens = config.get('acrpTokens') || {};
  tokens[agentId] = token;
  config.set('acrpTokens', tokens);
}

export default config;
