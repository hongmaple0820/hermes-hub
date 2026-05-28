'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import { toast } from 'sonner';
import { ConnectionInfo } from './shared';

export interface GeneratedEndpoint {
  url: string; token: string; callbackSecret: string;
  wsConnectUrl: string; wsDirectUrl: string; connectionMode: string;
}

export function useSkillMarketplace() {
  const { skills, agents } = useAppStore();
  const { t } = useI18n();

  // ─── Store Tab State ────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedHandlerType, setSelectedHandlerType] = useState('all');
  const [installing, setInstalling] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('store');

  // ─── My Skills Tab State ────────────────────────────────────
  const [selectedAgentFilter, setSelectedAgentFilter] = useState('all');
  const [agentSkills, setAgentSkills] = useState<any[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [generatingEndpoint, setGeneratingEndpoint] = useState<string | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState<string | null>(null);
  const [configJson, setConfigJson] = useState('{}');

  const [collapsedAgents, setCollapsedAgents] = useState<Record<string, boolean>>({});
  const [connectionInfos, setConnectionInfos] = useState<Record<string, ConnectionInfo>>({});
  const [loadingConnectionInfo, setLoadingConnectionInfo] = useState<Record<string, boolean>>({});
  const [httpCallbackExpanded, setHttpCallbackExpanded] = useState<Record<string, boolean>>({});

  const [generatedEndpoint, setGeneratedEndpoint] = useState<GeneratedEndpoint | null>(null);
  const [showEndpointDialog, setShowEndpointDialog] = useState(false);

  const [editingCallback, setEditingCallback] = useState<string | null>(null);
  const [callbackUrlValue, setCallbackUrlValue] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [detailInstallAgent, setDetailInstallAgent] = useState<string>('');

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importGitUrl, setImportGitUrl] = useState('');
  const [importSkillPath, setImportSkillPath] = useState('');
  const [importing, setImporting] = useState(false);

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Data Loading ───────────────────────────────────────────

  const loadInstalledSkills = useCallback(async () => {
    if (selectedAgentFilter === 'all') {
      setLoadingSkills(true);
      try {
        const allSkills: any[] = [];
        for (const agent of agents) {
          try {
            const res = await api.getAgentSkills(agent.id);
            const mapped = (res.skills || []).map((s: any) => ({ ...s, agentId: agent.id, agentName: agent.name }));
            allSkills.push(...mapped);
          } catch { /* skip */ }
        }
        setAgentSkills(allSkills);
      } finally { setLoadingSkills(false); }
    } else {
      setLoadingSkills(true);
      try {
        const res = await api.getAgentSkills(selectedAgentFilter);
        const agent = agents.find((a: any) => a.id === selectedAgentFilter);
        const mapped = (res.skills || []).map((s: any) => ({ ...s, agentId: selectedAgentFilter, agentName: agent?.name || '' }));
        setAgentSkills(mapped);
      } catch { setAgentSkills([]); }
      finally { setLoadingSkills(false); }
    }
  }, [selectedAgentFilter, agents]);

  const loadConnectionInfo = useCallback(async (agentId: string, skillId: string) => {
    const key = `${agentId}-${skillId}`;
    setLoadingConnectionInfo((prev) => ({ ...prev, [key]: true }));
    try {
      const info = await api.getSkillConnectionInfo(agentId, skillId);
      setConnectionInfos((prev) => ({ ...prev, [key]: info }));
    } catch { /* ignore */ }
    finally { setLoadingConnectionInfo((prev) => ({ ...prev, [key]: false })); }
  }, []);

  const loadAllConnectionInfos = useCallback(async () => {
    for (const as of agentSkills) { await loadConnectionInfo(as.agentId, as.skillId); }
  }, [agentSkills, loadConnectionInfo]);

  useEffect(() => { loadInstalledSkills(); }, []);
  useEffect(() => { if (activeTab === 'mySkills') { loadInstalledSkills(); } }, [activeTab, loadInstalledSkills]);
  useEffect(() => {
    if (activeTab === 'mySkills' && agentSkills.length > 0) {
      loadAllConnectionInfos();
      refreshIntervalRef.current = setInterval(loadAllConnectionInfos, 15000);
      return () => { if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current); };
    }
  }, [activeTab, agentSkills.length, loadAllConnectionInfos]);

  // ─── Computed Values ────────────────────────────────────────

  const categories = useMemo(() => {
    const cats = new Set(skills.map((s: any) => s.category));
    return ['all', ...Array.from(cats)];
  }, [skills]);

  const filteredSkills = useMemo(() => {
    return skills.filter((s: any) => {
      const matchesSearch = !search || s.displayName.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
      const matchesHandlerType = selectedHandlerType === 'all' || s.handlerType === selectedHandlerType;
      return matchesSearch && matchesCategory && matchesHandlerType;
    });
  }, [skills, search, selectedCategory, selectedHandlerType]);

  const groupedAgentSkills = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const sk of agentSkills) { const key = sk.agentId; if (!groups[key]) groups[key] = []; groups[key].push(sk); }
    return groups;
  }, [agentSkills]);

  const getSkillById = (id: string) => skills.find((s: any) => s.id === id);

  // ─── Handlers ──────────────────────────────────────────────

  const handleInstall = async (skillId: string, agentId: string) => {
    setInstalling(skillId);
    try { await api.installSkill(skillId, { agentId }); toast.success(t('skills.installed')); setShowInstall(null); }
    catch (error: any) { toast.error(error.message); }
    finally { setInstalling(null); }
  };

  const handleGenerateEndpoint = async (agentId: string, skillId: string) => {
    setGeneratingEndpoint(`${agentId}-${skillId}`);
    try {
      const res = await api.generateSkillEndpoint(agentId, skillId);
      setGeneratedEndpoint({ url: res.endpointUrl, token: res.endpointToken, callbackSecret: res.callbackSecret, wsConnectUrl: res.wsConnectUrl || '/?XTransformPort=3004', wsDirectUrl: res.wsDirectUrl || 'ws://localhost:3004/', connectionMode: res.connectionMode || 'websocket' });
      setShowEndpointDialog(true); toast.success(t('skillProtocol.endpointGenerated')); loadInstalledSkills();
    } catch (error: any) { toast.error(error.message); }
    finally { setGeneratingEndpoint(null); }
  };

  const handleRegenerateEndpoint = async (agentId: string, skillId: string) => {
    setGeneratingEndpoint(`${agentId}-${skillId}`);
    try {
      const res = await api.regenerateSkillEndpoint(agentId, skillId);
      setGeneratedEndpoint({ url: res.endpointUrl, token: res.endpointToken, callbackSecret: res.callbackSecret, wsConnectUrl: res.wsConnectUrl || '/?XTransformPort=3004', wsDirectUrl: res.wsDirectUrl || 'ws://localhost:3004/', connectionMode: res.connectionMode || 'websocket' });
      setShowEndpointDialog(true); toast.success(t('skillProtocol.endpointRegenerated')); loadInstalledSkills(); loadConnectionInfo(agentId, skillId);
    } catch (error: any) { toast.error(error.message); }
    finally { setGeneratingEndpoint(null); }
  };

  const handleTestConnection = async (agentId: string, skillId: string, endpointToken: string) => {
    try {
      const connInfo = connectionInfos[`${agentId}-${skillId}`];
      if (connInfo?.wsStatus.connected) { toast.info(t('skillProtocol.testingWs')); }
      await api.testSkillConnection(agentId, skillId); toast.success(t('skillProtocol.testSent'));
    } catch (error: any) { toast.error(t('skillProtocol.testFailed') + ': ' + error.message); }
  };

  const handleSaveCallback = async (agentId: string, skillId: string) => {
    try { await api.updateAgentSkill(agentId, skillId, { callbackUrl: callbackUrlValue, subscribedEvents: selectedEvents }); toast.success(t('skillProtocol.callbackSaved')); setEditingCallback(null); loadInstalledSkills(); }
    catch (error: any) { toast.error(error.message); }
  };

  const handleToggleSkill = async (agentId: string, skillId: string, enabled: boolean) => {
    try { await api.updateAgentSkill(agentId, skillId, { enabled }); toast.success(enabled ? t('skillProtocol.skillEnabled') : t('skillProtocol.skillDisabled')); loadInstalledSkills(); }
    catch (error: any) { toast.error(error.message); }
  };

  const handleUpdatePriority = async (agentId: string, skillId: string, priority: number) => {
    try { await api.updateAgentSkill(agentId, skillId, { priority }); loadInstalledSkills(); }
    catch (error: any) { toast.error(error.message); }
  };

  const handleSaveConfig = async (agentId: string, skillId: string) => {
    try {
      const parsed = JSON.parse(configJson);
      await api.updateAgentSkill(agentId, skillId, { config: parsed });
      toast.success(t('skillProtocol.configSaved')); setShowConfigDialog(null); loadInstalledSkills();
    } catch (error: any) {
      if (error instanceof SyntaxError) { toast.error(t('skillProtocol.invalidJson')); } else { toast.error(error.message); }
    }
  };

  const handleImportSkill = async () => {
    if (!importGitUrl.trim()) return;
    setImporting(true);
    try {
      const res = await api.importSkill(importGitUrl.trim(), importSkillPath.trim() || undefined);
      toast.success(t('skills.importSuccess')); setShowImportDialog(false); setImportGitUrl(''); setImportSkillPath('');
      if (res.imported > 0) { window.location.reload(); }
    } catch (error: any) { toast.error(t('skills.importError') + ': ' + error.message); }
    finally { setImporting(false); }
  };

  return {
    // Store state
    skills, agents, search, setSearch, categories, selectedCategory, setSelectedCategory,
    selectedHandlerType, setSelectedHandlerType, filteredSkills, installing, showInstall,
    setShowInstall, showDetail, setShowDetail, activeTab, setActiveTab,
    // My Skills state
    selectedAgentFilter, setSelectedAgentFilter, agentSkills, loadingSkills,
    generatingEndpoint, showConfigDialog, setShowConfigDialog, configJson, setConfigJson,
    collapsedAgents, setCollapsedAgents, connectionInfos, loadingConnectionInfo,
    httpCallbackExpanded, setHttpCallbackExpanded, generatedEndpoint, setGeneratedEndpoint,
    showEndpointDialog, setShowEndpointDialog, editingCallback, setEditingCallback,
    callbackUrlValue, setCallbackUrlValue, selectedEvents, setSelectedEvents,
    detailInstallAgent, setDetailInstallAgent, groupedAgentSkills,
    // Import state
    showImportDialog, setShowImportDialog, importGitUrl, setImportGitUrl,
    importSkillPath, setImportSkillPath, importing,
    // Handlers
    handleInstall, handleGenerateEndpoint, handleRegenerateEndpoint,
    handleTestConnection, handleSaveCallback, handleToggleSkill,
    handleUpdatePriority, handleSaveConfig, handleImportSkill,
    loadInstalledSkills, loadConnectionInfo,
    // Utilities
    getSkillById,
  };
}
