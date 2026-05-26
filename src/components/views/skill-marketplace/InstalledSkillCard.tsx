'use client';

import { useI18n } from '@/i18n';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Puzzle, MoreVertical, Settings2, Play, RefreshCw, Trash2,
  Wifi, WifiOff, Radio, Cable, Globe as GlobeIcon, Heart, Server,
  Link2, Zap, ExternalLink, Package, ChevronRight, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  iconMap, categoryColors, handlerTypeColors,
  EVENT_OPTIONS, ConnectionInfo,
  getLicenseBadgeColor, getSourceTypeBadgeColor,
} from './shared';
import { StatusDot, MonospaceField } from './shared-components';

interface InstalledSkillCardProps {
  agentId: string;
  agentSkill: any;
  skillDef: any;
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
  onGenerateEndpoint: (agentId: string, skillId: string) => void;
  onRegenerateEndpoint: (agentId: string, skillId: string) => void;
  onTestConnection: (agentId: string, skillId: string, endpointToken: string) => void;
  onToggleSkill: (agentId: string, skillId: string, enabled: boolean) => void;
  onUpdatePriority: (agentId: string, skillId: string, priority: number) => void;
  onSaveCallback: (agentId: string, skillId: string) => void;
  onRefreshSkills: () => void;
  onLoadConnectionInfo: (agentId: string, skillId: string) => void;
  setShowConfigDialog: (v: string | null) => void;
  setConfigJson: (v: string) => void;
}

export function InstalledSkillCard({
  agentId, agentSkill, skillDef, connectionInfos, loadingConnectionInfo,
  httpCallbackExpanded, setHttpCallbackExpanded, editingCallback, setEditingCallback,
  callbackUrlValue, setCallbackUrlValue, selectedEvents, setSelectedEvents,
  generatingEndpoint, onGenerateEndpoint, onRegenerateEndpoint, onTestConnection,
  onToggleSkill, onUpdatePriority, onSaveCallback, onRefreshSkills, onLoadConnectionInfo,
  setShowConfigDialog, setConfigJson,
}: InstalledSkillCardProps) {
  const { t } = useI18n();
  const Icon = iconMap[skillDef.icon] || Puzzle;
  const bindingKey = `${agentId}-${agentSkill.skillId}`;
  const endpointToken = agentSkill.endpointToken || '';
  const callbackSecret = agentSkill.callbackSecret || '';
  const callbackUrl = agentSkill.callbackUrl || '';
  const subscribedEvents: string[] = agentSkill.subscribedEvents || [];
  const priority = agentSkill.priority ?? 0;
  const enabled = agentSkill.enabled !== false;
  const hasEndpoint = !!endpointToken;

  const connInfo = connectionInfos[bindingKey];
  const isLoadingConn = loadingConnectionInfo[bindingKey];
  const wsConnected = connInfo?.wsStatus?.connected || false;
  const wsLastHeartbeat = connInfo?.wsStatus?.lastHeartbeat;
  const wsSocketId = connInfo?.wsStatus?.socketId;
  const wsConnectUrl = connInfo?.wsConnectUrl || '/?XTransformPort=3004';
  const connectionMode = connInfo?.connectionMode || agentSkill.connectionMode || 'websocket';
  const isHttpCallbackExpanded = httpCallbackExpanded[bindingKey] || false;
  const isEditingCallback = editingCallback === bindingKey;
  const wsStatus: 'connected' | 'registering' | 'disconnected' | 'error' = wsConnected ? 'connected' : 'disconnected';

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border', categoryColors[skillDef.category] || 'bg-accent')}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{skillDef.displayName || agentSkill.skillId}</span>
              {skillDef.handlerType && (
                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', handlerTypeColors[skillDef.handlerType] || '')}>
                  {skillDef.handlerType}
                </Badge>
              )}
              <StatusDot status={wsStatus} pulse={wsConnected} />
            </div>
            {skillDef.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{skillDef.description}</p>
            )}
            {(skillDef.instructions || agentSkill.instructions) && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-3 italic">
                {skillDef.instructions || agentSkill.instructions}
              </p>
            )}
            {(skillDef.allowedTools || agentSkill.allowedTools) && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <span className="text-[10px] text-muted-foreground font-medium">{t('skills.allowedTools')}:</span>
                {(Array.isArray(skillDef.allowedTools || agentSkill.allowedTools)
                  ? (skillDef.allowedTools || agentSkill.allowedTools)
                  : (skillDef.allowedTools || agentSkill.allowedTools).split(/\s+/).filter(Boolean)
                ).map((tool: string) => (
                  <Badge key={tool} variant="outline" className="text-[9px] px-1.5 py-0 font-mono bg-muted/50">
                    {tool}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {(skillDef.license || agentSkill.license) && (
                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getLicenseBadgeColor(skillDef.license || agentSkill.license))}>
                  {t('skills.license')}: {skillDef.license || agentSkill.license}
                </Badge>
              )}
              {(skillDef.compatibility || agentSkill.compatibility) && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                  {t('skills.compatibility')}: {skillDef.compatibility || agentSkill.compatibility}
                </Badge>
              )}
            </div>
            {(skillDef.sourceType || agentSkill.sourceType) && (skillDef.sourceType || agentSkill.sourceType) !== 'built-in' && (
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getSourceTypeBadgeColor(skillDef.sourceType || agentSkill.sourceType))}>
                  <Package className="w-2.5 h-2.5 mr-0.5" />{t('skills.sourceType')}: {skillDef.sourceType || agentSkill.sourceType}
                </Badge>
                {(skillDef.sourceUrl || agentSkill.sourceUrl) && (
                  <a href={skillDef.sourceUrl || agentSkill.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-primary hover:underline flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <ExternalLink className="w-2.5 h-2.5" /> {(skillDef.sourceUrl || agentSkill.sourceUrl).replace(/^https?:\/\//, '').split('/')[0]}
                  </a>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors duration-200',
              enabled ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-gray-50 dark:bg-gray-900/30',
            )}>
              <Label className={cn('text-xs transition-colors duration-200', enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                {enabled ? t('skillProtocol.enableSkill') : t('skillProtocol.disableSkill')}
              </Label>
              <Switch checked={enabled} onCheckedChange={(checked) => onToggleSkill(agentId, agentSkill.skillId, checked)} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setShowConfigDialog(bindingKey); try { setConfigJson(JSON.stringify(agentSkill.config || {}, null, 2)); } catch { setConfigJson('{}'); } }}>
                  <Settings2 className="w-3 h-3 mr-2" /> {t('skillProtocol.configureSkill')}
                </DropdownMenuItem>
                {hasEndpoint && (
                  <DropdownMenuItem onClick={() => onTestConnection(agentId, agentSkill.skillId, endpointToken)}>
                    <Play className="w-3 h-3 mr-2" /> {t('skillProtocol.testConnection')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onRegenerateEndpoint(agentId, agentSkill.skillId)}>
                  <RefreshCw className="w-3 h-3 mr-2" /> {t('skillProtocol.regenerateEndpoint')}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive"
                  onClick={async () => { try { await api.uninstallSkill(agentSkill.skillId, agentId); toast.success(t('common.uninstall')); onRefreshSkills(); } catch (error: any) { toast.error(error.message); } }}>
                  <Trash2 className="w-3 h-3 mr-2" /> {t('common.uninstall')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Connection Mode Selector */}
        <div className="flex items-center gap-3">
          <Label className="text-xs font-medium text-muted-foreground shrink-0">{t('skillProtocol.connectionMode')}</Label>
          <Select value={connectionMode} onValueChange={async (mode) => {
            try { await api.updateAgentSkill(agentId, agentSkill.skillId, { connectionMode: mode }); toast.success(t('skillProtocol.connectionModeUpdated')); onRefreshSkills(); onLoadConnectionInfo(agentId, agentSkill.skillId); }
            catch (error: any) { toast.error(error.message); }
          }}>
            <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="websocket"><div className="flex items-center gap-2"><Wifi className="w-3 h-3" /><span>WebSocket</span></div></SelectItem>
              <SelectItem value="http_callback"><div className="flex items-center gap-2"><GlobeIcon className="w-3 h-3" /><span>HTTP Callback</span></div></SelectItem>
              <SelectItem value="hybrid"><div className="flex items-center gap-2"><Cable className="w-3 h-3" /><span>Hybrid</span></div></SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* WebSocket Section */}
        {(connectionMode === 'websocket' || connectionMode === 'hybrid') && (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{t('skillProtocol.wsConnection')}</span>
              {wsConnected && (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[10px] px-1.5 py-0">
                  <Radio className="w-2.5 h-2.5 mr-1" /> Live
                </Badge>
              )}
            </div>
            {hasEndpoint ? (
              <>
                <MonospaceField label={t('skillProtocol.wsConnectUrl')} value={wsConnectUrl} copyLabel={t('skillProtocol.copyUrl')} />
                <MonospaceField label={t('skillProtocol.wsDirectUrl')} value="ws://localhost:3004/" copyLabel={t('skillProtocol.copyUrl')} />
                <MonospaceField label={t('skillProtocol.endpointToken')} value={endpointToken} masked copyLabel={t('skillProtocol.copyToken')} />
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">{t('skillProtocol.quickConnectLink')}</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md font-mono break-all select-all border border-dashed">
                      {wsConnectUrl}#token={endpointToken}
                    </code>
                    <Button variant="default" size="sm" className="gap-1 text-xs shrink-0 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => { navigator.clipboard.writeText(`${wsConnectUrl}#token=${endpointToken}`); toast.success(t('skillProtocol.connectLinkCopied')); }}>
                      <Link2 className="w-3 h-3" /> {t('skillProtocol.copyConnectLink')}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap pt-2 border-t border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2">
                    {wsConnected ? <Wifi className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-gray-400" />}
                    <span className="text-xs font-medium">{wsConnected ? t('skillProtocol.wsConnected') : t('skillProtocol.wsDisconnected')}</span>
                  </div>
                  {wsLastHeartbeat && (<div className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-400" /><span className="text-xs text-muted-foreground">{t('skillProtocol.lastHeartbeat')}: {new Date(wsLastHeartbeat).toLocaleTimeString()}</span></div>)}
                  {wsSocketId && (<div className="flex items-center gap-1"><Server className="w-3 h-3 text-muted-foreground" /><span className="text-xs text-muted-foreground font-mono">{wsSocketId}</span></div>)}
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-6 px-2" onClick={() => onLoadConnectionInfo(agentId, agentSkill.skillId)} disabled={isLoadingConn}>
                    <Activity className="w-3 h-3" /> {t('skillProtocol.refreshStatus')}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4">
                <Cable className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t('skillProtocol.noEndpointYet')}</p>
                <Button variant="default" size="sm" className="gap-1" disabled={generatingEndpoint === bindingKey}
                  onClick={() => onGenerateEndpoint(agentId, agentSkill.skillId)}>
                  {generatingEndpoint === bindingKey ? <Zap className="w-3 h-3 animate-pulse" /> : <Link2 className="w-3 h-3" />}
                  {t('skillProtocol.generateEndpoint')}
                </Button>
              </div>
            )}
            {hasEndpoint && (
              <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800">
                <Button variant="outline" size="sm" className="gap-1 text-xs" disabled={generatingEndpoint === bindingKey}
                  onClick={() => onRegenerateEndpoint(agentId, agentSkill.skillId)}>
                  {generatingEndpoint === bindingKey ? <Zap className="w-3 h-3 animate-pulse" /> : <Link2 className="w-3 h-3" />}
                  {t('skillProtocol.regenerateEndpoint')}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* HTTP Callback Section */}
        {(connectionMode === 'http_callback' || connectionMode === 'hybrid') && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <button className="flex items-center gap-2 w-full text-left"
              onClick={() => setHttpCallbackExpanded((prev) => ({ ...prev, [bindingKey]: !prev[bindingKey] }))}>
              <GlobeIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t('skillProtocol.httpCallback')}</span>
              <ChevronRight className={cn('w-3 h-3 transition-transform', isHttpCallbackExpanded && 'rotate-90')} />
              {callbackUrl && !isHttpCallbackExpanded && (<code className="text-xs text-muted-foreground font-mono truncate ml-2">{callbackUrl}</code>)}
            </button>
            {isHttpCallbackExpanded && (
              <div className="mt-3 space-y-3">
                {isEditingCallback ? (
                  <div className="space-y-3">
                    <Input value={callbackUrlValue} onChange={(e) => setCallbackUrlValue(e.target.value)} placeholder="https://your-agent.com/callback" className="text-sm" />
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{t('skillProtocol.events')}</Label>
                      <div className="flex flex-wrap gap-2">
                        {EVENT_OPTIONS.map((evt) => (
                          <div key={evt} className="flex items-center gap-1.5">
                            <Checkbox id={`evt-${bindingKey}-${evt}`} checked={selectedEvents.includes(evt)}
                              onCheckedChange={(checked) => { if (checked) { setSelectedEvents([...selectedEvents, evt]); } else { setSelectedEvents(selectedEvents.filter((e) => e !== evt)); } }} />
                            <Label htmlFor={`evt-${bindingKey}-${evt}`} className="text-xs cursor-pointer">{evt}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => onSaveCallback(agentId, agentSkill.skillId)}>{t('skillProtocol.saveCallback')}</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingCallback(null)}>{t('common.cancel')}</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md font-mono truncate">{callbackUrl || '—'}</code>
                      <Button variant="outline" size="sm" className="gap-1 text-xs shrink-0"
                        onClick={() => { setEditingCallback(bindingKey); setCallbackUrlValue(callbackUrl); setSelectedEvents(subscribedEvents.length > 0 ? subscribedEvents : ['message']); }}>
                        <Settings2 className="w-3 h-3" /> {t('skillProtocol.configureCallback')}
                      </Button>
                    </div>
                    {callbackSecret && (<MonospaceField label={t('skillProtocol.callbackSecret')} value={callbackSecret} masked copyLabel={t('skillProtocol.copySecret')} />)}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-center gap-3 flex-wrap pt-1 border-t">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">{t('skillProtocol.priority')}</Label>
            <Input type="number" min={0} max={100} value={priority}
              onChange={(e) => onUpdatePriority(agentId, agentSkill.skillId, parseInt(e.target.value) || 0)} className="w-16 h-7 text-xs text-center" />
          </div>
          <div className="flex-1" />
          {hasEndpoint && (
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => onTestConnection(agentId, agentSkill.skillId, endpointToken)}>
              <Play className="w-3 h-3" /> {t('skillProtocol.testConnection')}
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1 text-xs"
            onClick={() => { setShowConfigDialog(bindingKey); try { setConfigJson(JSON.stringify(agentSkill.config || {}, null, 2)); } catch { setConfigJson('{}'); } }}>
            <Settings2 className="w-3 h-3" /> {t('skillProtocol.configureSkill')}
          </Button>
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive hover:text-destructive"
            onClick={async () => { try { await api.uninstallSkill(agentSkill.skillId, agentId); toast.success(t('common.uninstall')); onRefreshSkills(); } catch (error: any) { toast.error(error.message); } }}>
            {t('common.uninstall')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
