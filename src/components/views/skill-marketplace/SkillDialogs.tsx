'use client';

import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Wifi, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { MonospaceField } from './shared-components';

// ─── Endpoint Dialog ───────────────────────────────────────────

interface EndpointDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  generatedEndpoint: {
    url: string; token: string; callbackSecret: string;
    wsConnectUrl: string; wsDirectUrl: string; connectionMode: string;
  } | null;
  setGeneratedEndpoint: (v: {
    url: string; token: string; callbackSecret: string;
    wsConnectUrl: string; wsDirectUrl: string; connectionMode: string;
  } | null) => void;
}

export function EndpointDialog({ open, onOpenChange, generatedEndpoint, setGeneratedEndpoint }: EndpointDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onOpenChange(false); setGeneratedEndpoint(null); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-emerald-500" />
            {t('skillProtocol.endpointGenerated')}
          </DialogTitle>
          <DialogDescription>{t('skillProtocol.endpointGeneratedDesc')}</DialogDescription>
        </DialogHeader>
        {generatedEndpoint && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">WebSocket</span>
              </div>
              <MonospaceField label={t('skillProtocol.wsConnectUrl')} value={generatedEndpoint.wsConnectUrl} copyLabel={t('skillProtocol.copyUrl')} />
              <MonospaceField label={t('skillProtocol.wsDirectUrl')} value={generatedEndpoint.wsDirectUrl} copyLabel={t('skillProtocol.copyUrl')} />
            </div>
            <MonospaceField label={t('skillProtocol.endpointToken')} value={generatedEndpoint.token} masked copyLabel={t('skillProtocol.copyToken')} />
            <MonospaceField label={t('skillProtocol.callbackSecret')} value={generatedEndpoint.callbackSecret} masked copyLabel={t('skillProtocol.copySecret')} />
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs font-medium">{t('skillProtocol.quickConnectLink')}</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md font-mono break-all select-all">
                  {generatedEndpoint.wsConnectUrl}#token={generatedEndpoint.token}
                </code>
                <Button variant="default" size="sm" className="gap-1 text-xs shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(`${generatedEndpoint.wsConnectUrl}#token=${generatedEndpoint.token}`);
                    toast.success(t('skillProtocol.connectLinkCopied'));
                  }}>
                  <Link2 className="w-3 h-3" /> {t('skillProtocol.copyConnectLink')}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">{t('skillProtocol.codeSnippet')}</Label>
              <pre className="text-xs bg-muted p-3 rounded-md font-mono overflow-x-auto whitespace-pre-wrap">
{`import { io } from 'socket.io-client';

const socket = io('${generatedEndpoint.wsConnectUrl}', {
  auth: { endpointToken: '${generatedEndpoint.token}' }
});

socket.on('connect', () => {
  socket.emit('skill:register', {
    name: 'my-agent',
    capabilities: ['search']
  });
});`}
              </pre>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Skill Config Dialog ───────────────────────────────────────

interface SkillConfigDialogProps {
  showConfigDialog: string | null;
  setShowConfigDialog: (v: string | null) => void;
  configJson: string;
  setConfigJson: (v: string) => void;
  onSaveConfig: (agentId: string, skillId: string) => void;
}

export function SkillConfigDialog({ showConfigDialog, setShowConfigDialog, configJson, setConfigJson, onSaveConfig }: SkillConfigDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={!!showConfigDialog} onOpenChange={(v) => { if (!v) setShowConfigDialog(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('skillProtocol.skillConfig')}</DialogTitle>
          <DialogDescription>{t('skillProtocol.configureSkill')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea value={configJson} onChange={(e) => setConfigJson(e.target.value)} className="font-mono text-xs min-h-[200px]" placeholder="{}" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowConfigDialog(null)}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={() => {
              const bindingKey = showConfigDialog!;
              const parts = bindingKey.split('-');
              const aId = parts[0];
              const sId = parts.slice(1).join('-');
              onSaveConfig(aId, sId);
            }}>{t('common.save')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
