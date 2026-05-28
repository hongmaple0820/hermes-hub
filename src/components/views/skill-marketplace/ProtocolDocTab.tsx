'use client';

import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Zap, Shield, Heart, Wifi, Cable, Code, Terminal, Globe, Server, GitBranch, ExternalLink, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CodeBlock } from './shared-components';
import { jsCode, pythonCode, curlCode, eventTypes, skillMdFormat, directoryStructure, authCode, heartbeatCode, frontmatterSchema } from './protocol-code';

interface ProtocolDocTabProps {
  onShowImportDialog: () => void;
}

export function ProtocolDocTab({ onShowImportDialog }: ProtocolDocTabProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* AgentSkills Specification Section */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> {t('skills.agentSkillsSpec')}
          </CardTitle>
          <CardDescription>{t('skills.specDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-2">{t('skills.specFormat')}</h4>
            <CodeBlock language="markdown" filename="SKILL.md" code={skillMdFormat} />
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">{t('skills.specDirectory')}</h4>
            <CodeBlock language="text" code={directoryStructure} />
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">Frontmatter Schema</h4>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2 font-medium">Field</th>
                    <th className="text-left p-2 font-medium">Type</th>
                    <th className="text-left p-2 font-medium">Required</th>
                    <th className="text-left p-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {frontmatterSchema.map((row) => (
                    <tr key={row.field} className="border-t">
                      <td className="p-2 font-mono font-medium text-primary/80">{row.field}</td>
                      <td className="p-2 text-muted-foreground">{row.type}</td>
                      <td className="p-2 text-center">
                        {row.required === 'Yes' ? <span className="text-red-500 font-bold">*</span> : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="p-2 text-muted-foreground">{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/50 dark:bg-cyan-950/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">Import from AgentSkills Registry</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{t('skills.specDescription')}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1 text-xs border-cyan-300 dark:border-cyan-700" onClick={onShowImportDialog}>
                <GitBranch className="w-3 h-3" /> {t('skills.importFromGit')}
              </Button>
              <a href="https://agentskills.io" target="_blank" rel="noopener noreferrer"
                className="text-xs text-cyan-600 hover:underline dark:text-cyan-400 flex items-center gap-1">
                agentskills.io <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> {t('skillProtocol.quickStart')}</CardTitle>
          <CardDescription>{t('skillProtocol.quickStartDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="absolute left-[18px] top-7 bottom-7 w-0.5 bg-border" />
            <div className="space-y-4">
              {['1', '2', '3', '4'].map((step, idx) => (
                <div key={step} className="flex items-start gap-4 relative">
                  <span className={cn('flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold shrink-0 z-10 border-2 border-background shadow-sm',
                    idx === 3 ? 'bg-primary text-primary-foreground animate-pulse' : 'bg-primary/10 text-primary')}>
                    {step}
                  </span>
                  <div className="flex-1 p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">{t(`skillProtocol.quickStartStep${step}`)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t(`skillProtocol.step${step}${step === '1' ? 'Install' : step === '2' ? 'Generate' : step === '3' ? 'Connect' : 'Register'}Desc` as any) || ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Protocol Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><Shield className="w-6 h-6 mx-auto mb-2 text-primary" /><p className="text-xs text-muted-foreground">{t('skillProtocol.protocolVersion')}</p><p className="text-lg font-bold">2.0.0</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><Heart className="w-6 h-6 mx-auto mb-2 text-red-500" /><p className="text-xs text-muted-foreground">{t('skillProtocol.heartbeatInterval')}</p><p className="text-lg font-bold">30s</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><Wifi className="w-6 h-6 mx-auto mb-2 text-emerald-500" /><p className="text-xs text-muted-foreground">{t('skillProtocol.transport')}</p><p className="text-lg font-bold">WebSocket</p></CardContent></Card>
      </div>

      {/* WebSocket Connection Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Cable className="w-4 h-4" /> {t('skillProtocol.wsConnectionGuide')}</CardTitle>
          <CardDescription>{t('skillProtocol.wsConnectionGuideDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible defaultValue="javascript">
            <AccordionItem value="javascript">
              <AccordionTrigger className="text-sm flex items-center gap-2"><Code className="w-4 h-4" /> JavaScript / TypeScript (socket.io-client)</AccordionTrigger>
              <AccordionContent><CodeBlock language="javascript" filename="agent.js" code={jsCode} /></AccordionContent>
            </AccordionItem>
            <AccordionItem value="python">
              <AccordionTrigger className="text-sm flex items-center gap-2"><Terminal className="w-4 h-4" /> Python (python-socketio)</AccordionTrigger>
              <AccordionContent><CodeBlock language="python" filename="agent.py" code={pythonCode} /></AccordionContent>
            </AccordionItem>
            <AccordionItem value="curl">
              <AccordionTrigger className="text-sm flex items-center gap-2"><Globe className="w-4 h-4" /> HTTP API (fallback)</AccordionTrigger>
              <AccordionContent><CodeBlock language="bash" filename="requests.sh" code={curlCode} /></AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Event Types Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4" /> {t('skillProtocol.eventTypes')}</CardTitle>
          <CardDescription>{t('skillProtocol.eventTypesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="min-w-[500px]">
              <div className="grid grid-cols-[1fr_140px_2fr] gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                <span>Event</span><span>Direction</span><span>Description</span>
              </div>
              {eventTypes.map(({ event, dir, desc }) => (
                <div key={event} className="grid grid-cols-[1fr_140px_2fr] gap-2 text-xs py-2.5 border-b border-border/50 items-center">
                  <code className="font-mono font-medium text-primary/80">{event}</code>
                  <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5 w-fit font-medium',
                    dir === 'agent-to-hub' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800')}>
                    {dir === 'agent-to-hub' ? 'Agent → Hub' : 'Hub → Agent'}
                  </Badge>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Supported Platforms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Server className="w-4 h-4" /> {t('skillProtocol.supportedPlatforms')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: 'hermes-agent', desc: 'Python-based AI agent framework with built-in Socket.IO client', icon: Terminal, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
              { name: 'openclaw', desc: 'Open source agent framework supporting WebSocket connections', icon: Code, color: 'bg-violet-500/10 text-violet-600 border-violet-200' },
              { name: 'Custom', desc: 'Any WebSocket/Socket.IO client can connect using the protocol', icon: Cable, color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
            ].map(({ name, desc, icon: PlatformIcon, color }) => (
              <div key={name} className="flex items-start gap-3 p-4 rounded-lg border border-border">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border', color)}><PlatformIcon className="w-5 h-5" /></div>
                <div><p className="text-sm font-semibold">{name}</p><p className="text-xs text-muted-foreground mt-0.5">{desc}</p></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" /> {t('skillProtocol.authentication')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('skillProtocol.authDesc')}</p>
          <CodeBlock language="javascript" code={authCode} />
        </CardContent>
      </Card>

      {/* Heartbeat Protocol */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Heart className="w-4 h-4" /> {t('skillProtocol.heartbeatProtocol')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('skillProtocol.heartbeatDesc')}</p>
          <CodeBlock language="javascript" code={heartbeatCode} />
        </CardContent>
      </Card>

      {/* Message Format */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> {t('skillProtocol.messageFormat')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible defaultValue="invoke">
            <AccordionItem value="invoke">
              <AccordionTrigger className="text-sm">skill:invoke (Hub → Agent)</AccordionTrigger>
              <AccordionContent><CodeBlock language="json" code={`{\n  "requestId": "req_abc123",\n  "skillName": "web_search",\n  "params": {\n    "query": "latest news about AI"\n  },\n  "conversationId": "conv_xxx",\n  "timestamp": "2024-01-15T10:30:00Z"\n}`} /></AccordionContent>
            </AccordionItem>
            <AccordionItem value="invoke-response">
              <AccordionTrigger className="text-sm">skill:invoke-response (Agent → Hub)</AccordionTrigger>
              <AccordionContent><CodeBlock language="json" code={`{\n  "requestId": "req_abc123",\n  "result": {\n    "response": "Search results for AI news...",\n    "sources": ["https://..."]\n  }\n}`} /></AccordionContent>
            </AccordionItem>
            <AccordionItem value="event">
              <AccordionTrigger className="text-sm">skill:event (Agent → Hub)</AccordionTrigger>
              <AccordionContent><CodeBlock language="json" code={`{\n  "type": "message",\n  "data": {\n    "conversationId": "conv_xxx",\n    "content": "Hello from my agent!"\n  }\n}`} /></AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
