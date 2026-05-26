'use client';

import { useI18n } from '@/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Puzzle, ChevronRight, ChevronDown, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectionInfo } from './shared';
import { SkillCardSkeleton } from './shared-components';
import { InstalledSkillCard } from './InstalledSkillCard';
import { EndpointDialog, SkillConfigDialog } from './SkillDialogs';

interface MySkillsTabProps {
  agents: any[];
  agentSkills: any[];
  loadingSkills: boolean;
  selectedAgentFilter: string;
  setSelectedAgentFilter: (v: string) => void;
  collapsedAgents: Record<string, boolean>;
  setCollapsedAgents: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  connectionInfos: Record<string, ConnectionInfo>;
  loadingConnectionInfo: Record<string, boolean>;
  httpCallbackExpanded: Record<string, boolean>;
  setHttpCallbackExpanded: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  editingCallback: string | null;
  setEditingCallback: (v: string | null) => void;
  callbackUrlValue: string;
  setCallbackUrlValue: (v: string) => void;
  selectedEvents: string[];
  setSelectedEvents: (v: string[]) => void;
  generatingEndpoint: string | null;
  showConfigDialog: string | null;
  setShowConfigDialog: (v: string | null) => void;
  configJson: string;
  setConfigJson: (v: string) => void;
  showEndpointDialog: boolean;
  setShowEndpointDialog: (v: boolean) => void;
  generatedEndpoint: {
    url: string; token: string; callbackSecret: string;
    wsConnectUrl: string; wsDirectUrl: string; connectionMode: string;
  } | null;
  setGeneratedEndpoint: (v: {
    url: string; token: string; callbackSecret: string;
    wsConnectUrl: string; wsDirectUrl: string; connectionMode: string;
  } | null) => void;
  groupedAgentSkills: Record<string, any[]>;
  allSkills: any[];
  onGenerateEndpoint: (agentId: string, skillId: string) => void;
  onRegenerateEndpoint: (agentId: string, skillId: string) => void;
  onTestConnection: (agentId: string, skillId: string, endpointToken: string) => void;
  onToggleSkill: (agentId: string, skillId: string, enabled: boolean) => void;
  onUpdatePriority: (agentId: string, skillId: string, priority: number) => void;
  onSaveConfig: (agentId: string, skillId: string) => void;
  onSaveCallback: (agentId: string, skillId: string) => void;
  onRefreshSkills: () => void;
  onLoadConnectionInfo: (agentId: string, skillId: string) => void;
  setActiveTab: (v: string) => void;
}

export function MySkillsTab({
  agents, agentSkills, loadingSkills, selectedAgentFilter, setSelectedAgentFilter,
  collapsedAgents, setCollapsedAgents, connectionInfos, loadingConnectionInfo,
  httpCallbackExpanded, setHttpCallbackExpanded, editingCallback, setEditingCallback,
  callbackUrlValue, setCallbackUrlValue, selectedEvents, setSelectedEvents,
  generatingEndpoint, showConfigDialog, setShowConfigDialog, configJson, setConfigJson,
  showEndpointDialog, setShowEndpointDialog, generatedEndpoint, setGeneratedEndpoint,
  groupedAgentSkills, allSkills, onGenerateEndpoint, onRegenerateEndpoint, onTestConnection,
  onToggleSkill, onUpdatePriority, onSaveConfig, onSaveCallback, onRefreshSkills,
  onLoadConnectionInfo, setActiveTab,
}: MySkillsTabProps) {
  const { t } = useI18n();
  const getSkillById = (id: string) => allSkills.find((s: any) => s.id === id);

  return (
    <div className="space-y-6">
      {/* Agent selector */}
      <div className="flex items-center gap-4">
        <Label className="text-sm font-medium shrink-0">{t('skills.selectAgent')}</Label>
        <Select value={selectedAgentFilter} onValueChange={setSelectedAgentFilter}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('skillProtocol.allAgents')}</SelectItem>
            {agents.map((agent: any) => (
              <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={onRefreshSkills} className="gap-1">
          <Activity className="w-3 h-3" /> {t('common.refresh')}
        </Button>
      </div>

      {loadingSkills ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (<SkillCardSkeleton key={i} />))}
        </div>
      ) : agentSkills.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Puzzle className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('skillProtocol.noInstalledSkills')}</h3>
            <p className="text-muted-foreground text-sm">{t('skillProtocol.noInstalledSkillsDesc')}</p>
            <Button variant="outline" size="sm" className="mt-4 gap-1" onClick={() => setActiveTab('store')}>
              <ChevronRight className="w-3 h-3" /> {t('skillProtocol.store')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedAgentSkills).map(([agentId, skillsList]) => {
            const agent = agents.find((a: any) => a.id === agentId);
            const isCollapsed = collapsedAgents[agentId] || false;
            const anyWsConnected = skillsList.some((as: any) => {
              const connInfo = connectionInfos[`${agentId}-${as.skillId}`];
              return connInfo?.wsStatus?.connected;
            });

            return (
              <div key={agentId} className="space-y-3">
                <button className="flex items-center gap-2 w-full text-left group/header"
                  onClick={() => setCollapsedAgents((prev) => ({ ...prev, [agentId]: !prev[agentId] }))}>
                  {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />}
                  <h3 className="text-sm font-semibold">{agent?.name || agentId}</h3>
                  <Badge variant="outline" className="text-xs">{skillsList.length} {t('skills.title').toLowerCase()}</Badge>
                  <span className="relative flex h-2.5 w-2.5">
                    {anyWsConnected && (<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />)}
                    <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5 shrink-0', anyWsConnected ? 'bg-green-500' : 'bg-gray-400')} />
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-4 pl-6">
                    {skillsList.map((agentSkill: any) => (
                      <InstalledSkillCard key={`${agentId}-${agentSkill.skillId}`}
                        agentId={agentId} agentSkill={agentSkill}
                        skillDef={getSkillById(agentSkill.skillId) || agentSkill}
                        connectionInfos={connectionInfos} loadingConnectionInfo={loadingConnectionInfo}
                        httpCallbackExpanded={httpCallbackExpanded} setHttpCallbackExpanded={setHttpCallbackExpanded}
                        editingCallback={editingCallback} setEditingCallback={setEditingCallback}
                        callbackUrlValue={callbackUrlValue} setCallbackUrlValue={setCallbackUrlValue}
                        selectedEvents={selectedEvents} setSelectedEvents={setSelectedEvents}
                        generatingEndpoint={generatingEndpoint} onGenerateEndpoint={onGenerateEndpoint}
                        onRegenerateEndpoint={onRegenerateEndpoint} onTestConnection={onTestConnection}
                        onToggleSkill={onToggleSkill} onUpdatePriority={onUpdatePriority}
                        onSaveCallback={onSaveCallback} onRefreshSkills={onRefreshSkills}
                        onLoadConnectionInfo={onLoadConnectionInfo}
                        setShowConfigDialog={setShowConfigDialog} setConfigJson={setConfigJson}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Generate/Regenerate Endpoint Dialog */}
      <EndpointDialog open={showEndpointDialog} onOpenChange={setShowEndpointDialog}
        generatedEndpoint={generatedEndpoint} setGeneratedEndpoint={setGeneratedEndpoint} />

      {/* Skill Config Dialog */}
      <SkillConfigDialog showConfigDialog={showConfigDialog} setShowConfigDialog={setShowConfigDialog}
        configJson={configJson} setConfigJson={setConfigJson} onSaveConfig={onSaveConfig} />
    </div>
  );
}
