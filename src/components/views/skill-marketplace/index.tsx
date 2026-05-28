'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Puzzle, Settings2, BookOpen } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useSkillMarketplace } from './useSkillMarketplace';
import { SkillStoreTab } from './SkillStoreTab';
import { MySkillsTab } from './MySkillsTab';
import { ProtocolDocTab } from './ProtocolDocTab';
import { SkillDetailDialog } from './SkillDetailDialog';

export function SkillMarketplace() {
  const { t } = useI18n();
  const state = useSkillMarketplace();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('skillProtocol.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('skillProtocol.subtitle')}</p>
      </div>

      <Tabs value={state.activeTab} onValueChange={state.setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="store" className="gap-1.5">
            <Puzzle className="w-3.5 h-3.5" /> {t('skillProtocol.store')}
          </TabsTrigger>
          <TabsTrigger value="mySkills" className="gap-1.5">
            <Settings2 className="w-3.5 h-3.5" /> {t('skillProtocol.mySkills')}
          </TabsTrigger>
          <TabsTrigger value="protocolDocs" className="gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> {t('skillProtocol.protocolDocs')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="store" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <SkillStoreTab
            search={state.search} setSearch={state.setSearch}
            categories={state.categories} selectedCategory={state.selectedCategory}
            setSelectedCategory={state.setSelectedCategory} selectedHandlerType={state.selectedHandlerType}
            setSelectedHandlerType={state.setSelectedHandlerType} filteredSkills={state.filteredSkills}
            allSkills={state.skills} agentSkills={state.agentSkills} agents={state.agents}
            installing={state.installing} showInstall={state.showInstall}
            setShowInstall={state.setShowInstall} setShowDetail={state.setShowDetail}
            onInstall={state.handleInstall}
            showImportDialog={state.showImportDialog} setShowImportDialog={state.setShowImportDialog}
            importGitUrl={state.importGitUrl} setImportGitUrl={state.setImportGitUrl}
            importSkillPath={state.importSkillPath} setImportSkillPath={state.setImportSkillPath}
            importing={state.importing} onImportSkill={state.handleImportSkill}
          />
        </TabsContent>

        <TabsContent value="mySkills" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <MySkillsTab
            agents={state.agents} agentSkills={state.agentSkills} loadingSkills={state.loadingSkills}
            selectedAgentFilter={state.selectedAgentFilter} setSelectedAgentFilter={state.setSelectedAgentFilter}
            collapsedAgents={state.collapsedAgents} setCollapsedAgents={state.setCollapsedAgents}
            connectionInfos={state.connectionInfos} loadingConnectionInfo={state.loadingConnectionInfo}
            httpCallbackExpanded={state.httpCallbackExpanded} setHttpCallbackExpanded={state.setHttpCallbackExpanded}
            editingCallback={state.editingCallback} setEditingCallback={state.setEditingCallback}
            callbackUrlValue={state.callbackUrlValue} setCallbackUrlValue={state.setCallbackUrlValue}
            selectedEvents={state.selectedEvents} setSelectedEvents={state.setSelectedEvents}
            generatingEndpoint={state.generatingEndpoint} showConfigDialog={state.showConfigDialog}
            setShowConfigDialog={state.setShowConfigDialog} configJson={state.configJson}
            setConfigJson={state.setConfigJson} showEndpointDialog={state.showEndpointDialog}
            setShowEndpointDialog={state.setShowEndpointDialog} generatedEndpoint={state.generatedEndpoint}
            setGeneratedEndpoint={state.setGeneratedEndpoint} groupedAgentSkills={state.groupedAgentSkills}
            allSkills={state.skills} onGenerateEndpoint={state.handleGenerateEndpoint}
            onRegenerateEndpoint={state.handleRegenerateEndpoint} onTestConnection={state.handleTestConnection}
            onToggleSkill={state.handleToggleSkill} onUpdatePriority={state.handleUpdatePriority}
            onSaveConfig={state.handleSaveConfig} onSaveCallback={state.handleSaveCallback}
            onRefreshSkills={state.loadInstalledSkills} onLoadConnectionInfo={state.loadConnectionInfo}
            setActiveTab={state.setActiveTab}
          />
        </TabsContent>

        <TabsContent value="protocolDocs" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <ProtocolDocTab onShowImportDialog={() => state.setShowImportDialog(true)} />
        </TabsContent>
      </Tabs>

      {/* Skill Detail Dialog */}
      <SkillDetailDialog
        showDetail={state.showDetail} setShowDetail={state.setShowDetail}
        skill={state.getSkillById(state.showDetail || '')}
        agentSkills={state.agentSkills} agents={state.agents} installing={state.installing}
        detailInstallAgent={state.detailInstallAgent} setDetailInstallAgent={state.setDetailInstallAgent}
        onInstall={state.handleInstall}
      />
    </div>
  );
}
