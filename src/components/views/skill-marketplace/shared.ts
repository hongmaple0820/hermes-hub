import {
  Search, Code, Image, FileText, Languages, Bell, Globe, BarChart3, Mail, Volume2, Database, CloudSun, Zap, Puzzle,
} from 'lucide-react';

// ─── Icon Map ──────────────────────────────────────────────────

export const iconMap: Record<string, React.ElementType> = {
  Search, Code, Image, FileText, Languages, Bell, Globe, BarChart3, Mail, Volume2, Database, CloudSun, Zap, Puzzle,
};

// ─── Color Maps ────────────────────────────────────────────────

export const categoryColors: Record<string, string> = {
  communication: 'bg-blue-500/10 text-blue-600 border-blue-200',
  productivity: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  development: 'bg-violet-500/10 text-violet-600 border-violet-200',
  data: 'bg-amber-500/10 text-amber-600 border-amber-200',
  media: 'bg-rose-500/10 text-rose-600 border-rose-200',
  utility: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
};

export const categoryBadgeColors: Record<string, string> = {
  communication: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  productivity: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  development: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  data: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  media: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  utility: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

export const handlerTypeColors: Record<string, string> = {
  builtin: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  webhook: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  websocket: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  streaming: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
};

export const licenseBadgeColors: Record<string, string> = {
  MIT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Apache-2.0': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Proprietary: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export const sourceTypeColors: Record<string, string> = {
  'built-in': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'agentskills-registry': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  custom: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  git: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export const handlerTypeGradients: Record<string, string> = {
  builtin: 'bg-gradient-to-r from-emerald-500 to-emerald-600',
  webhook: 'bg-gradient-to-r from-amber-500 to-amber-600',
  websocket: 'bg-gradient-to-r from-cyan-500 to-cyan-600',
  streaming: 'bg-gradient-to-r from-teal-500 to-teal-600',
};

// ─── Category Keys ─────────────────────────────────────────────

export const CATEGORY_KEYS: Record<string, string> = {
  all: 'skills.categoryAll',
  communication: 'skills.categoryCommunication',
  productivity: 'skills.categoryProductivity',
  development: 'skills.categoryDevelopment',
  data: 'skills.categoryData',
  media: 'skills.categoryMedia',
  utility: 'skills.categoryUtility',
};

// ─── Popular Skills ────────────────────────────────────────────

export const POPULAR_SKILLS = new Set([
  'web-search', 'code-generator', 'email-sender', 'data-analyzer', 'language-translator',
]);

// ─── Connection Mode Type ──────────────────────────────────────

export type ConnectionMode = 'websocket' | 'http_callback' | 'hybrid';

export interface ConnectionInfo {
  endpointToken: string | null;
  callbackUrl: string | null;
  callbackSecret: string | null;
  wsStatus: { connected: boolean; lastHeartbeat: string | null; socketId: string | null };
  wsConnectUrl: string | null;
  connectionMode: string;
}

// ─── Event Options ─────────────────────────────────────────────

export const EVENT_OPTIONS = ['message', 'command', 'status', 'heartbeat', 'tool_call', 'tool_result'];

// ─── Utility Functions ─────────────────────────────────────────

export function getLicenseBadgeColor(license: string | undefined | null): string {
  if (!license) return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  if (license.includes('MIT')) return licenseBadgeColors.MIT;
  if (license.includes('Apache')) return licenseBadgeColors['Apache-2.0'];
  if (license === 'Proprietary' || license === 'proprietary') return licenseBadgeColors.Proprietary;
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
}

export function getSourceTypeBadgeColor(sourceType: string | undefined | null): string {
  if (!sourceType) return sourceTypeColors['built-in'];
  return sourceTypeColors[sourceType] || sourceTypeColors['built-in'];
}
