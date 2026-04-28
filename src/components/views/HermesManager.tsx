'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Cable, Plus, Trash2, Play, Square, Activity, RefreshCw,
  CheckCircle2, XCircle, AlertCircle, Loader2, Server,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function HermesManager() {
  const { gateways, setGateways } = useAppStore();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    host: '127.0.0.1',
    port: 8642,
  });

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Gateway name is required');
      return;
    }
    setCreating(true);
    try {
      const result = await api.createGateway(form);
      setGateways([result.gateway, ...gateways]);
      setShowCreate(false);
      setForm({ name: '', host: '127.0.0.1', port: 8642 });
      toast.success('Gateway created!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleStart = async (id: string) => {
    setActionLoading(id);
    try {
      await api.startGateway(id);
      const result = await api.getGateways();
      setGateways(result.gateways);
      toast.success('Gateway started');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (id: string) => {
    setActionLoading(id);
    try {
      await api.stopGateway(id);
      const result = await api.getGateways();
      setGateways(result.gateways);
      toast.success('Gateway stopped');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleHealthCheck = async (id: string) => {
    setActionLoading(id);
    try {
      await api.checkGatewayHealth(id);
      toast.success('Health check passed');
    } catch (error: any) {
      toast.error('Health check failed: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteGateway(id);
      setGateways(gateways.filter((g: any) => g.id !== id));
      toast.success('Gateway deleted');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const statusConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
    running: { icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-500/10', label: 'Running' },
    stopped: { icon: Square, color: 'text-gray-500', bgColor: 'bg-gray-500/10', label: 'Stopped' },
    error: { icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-500/10', label: 'Error' },
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Hermes Agent Management</h1>
          <p className="text-muted-foreground text-sm">
            Connect and manage Hermes Agent instances — direct gateway control, health monitoring, and configuration
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Add Gateway</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Hermes Gateway</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Gateway Name *</Label>
                <Input placeholder="e.g., Production Gateway" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Host</Label>
                  <Input placeholder="127.0.0.1" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input type="number" placeholder="8642" value={form.port} onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 8642 })} />
                </div>
              </div>
              <div className="bg-accent rounded-lg p-3 text-xs text-muted-foreground">
                <p className="font-medium mb-1">Hermes Agent Connection</p>
                <p>This will create a gateway connection to your Hermes Agent instance. The gateway enables direct management of sessions, profiles, skills, and more — similar to hermes-web-ui.</p>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={creating}>
                {creating ? 'Creating...' : 'Add Gateway'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Banner */}
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-4">
          <Cable className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Direct Hermes Agent Connection</p>
            <p className="text-xs text-muted-foreground mt-1">
              This platform supports direct connection to Hermes Agent instances. You can manage sessions, profiles, skills, memory, and gateway lifecycle —
              just like the hermes-web-ui project. Connect your local or remote Hermes Agent to get started.
            </p>
          </div>
        </CardContent>
      </Card>

      {gateways.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Cable className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No Hermes Gateways</h3>
            <p className="text-muted-foreground text-sm mb-4">Add a gateway to connect to your Hermes Agent</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Add Gateway
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {gateways.map((gateway: any) => {
            const status = statusConfig[gateway.status] || statusConfig.stopped;
            const StatusIcon = status.icon;

            return (
              <Card key={gateway.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', status.bgColor)}>
                        <Server className={cn('w-6 h-6', status.color)} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{gateway.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex items-center gap-1.5">
                            <StatusIcon className={cn('w-4 h-4', status.color)} />
                            <span className={cn('text-sm font-medium', status.color)}>{status.label}</span>
                          </div>
                          <span className="text-sm text-muted-foreground font-mono">{gateway.host}:{gateway.port}</span>
                          {gateway.pid && <Badge variant="outline" className="text-[10px]">PID: {gateway.pid}</Badge>}
                        </div>
                        {gateway.profilePath && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono">{gateway.profilePath}</p>
                        )}
                        {gateway.lastHealth && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Last health check: {new Date(gateway.lastHealth).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {gateway.status === 'running' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleStop(gateway.id)}
                          disabled={actionLoading === gateway.id}
                        >
                          {actionLoading === gateway.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
                          Stop
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleStart(gateway.id)}
                          disabled={actionLoading === gateway.id}
                        >
                          {actionLoading === gateway.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          Start
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleHealthCheck(gateway.id)}
                        disabled={actionLoading === gateway.id}
                      >
                        <Activity className="w-3 h-3" /> Health
                      </Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => handleDelete(gateway.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
