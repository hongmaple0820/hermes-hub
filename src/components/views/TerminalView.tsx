'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Terminal as TerminalIcon, Play, Square, Trash2, Loader2, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TerminalLine {
  id: number;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  timestamp: string;
}

// Simulated command responses for demo
const SIMULATED_COMMANDS: Record<string, string> = {
  help: `Available commands:
  help          - Show this help message
  ls            - List files in current directory
  pwd           - Print working directory
  date          - Show current date and time
  whoami        - Show current user
  echo <text>   - Echo text back
  clear         - Clear terminal
  env           - Show environment variables
  ps            - Show running processes
  uptime        - Show system uptime`,
  ls: `drwxr-xr-x  5 user  staff   160 Mar  4 10:00 .
drwxr-xr-x  3 user  staff    96 Mar  4 09:00 ..
drwxr-xr-x  4 user  staff   128 Mar  4 10:00 .hermes
-rw-r--r--  1 user  staff  1024 Mar  4 10:00 config.yaml
-rw-r--r--  1 user  staff   256 Mar  4 10:00 .env
-rw-r--r--  1 user  staff  2048 Mar  4 10:00 soul.md
drwxr-xr-x  2 user  staff    64 Mar  4 10:00 skills
drwxr-xr-x  3 user  staff    96 Mar  4 10:00 data`,
  pwd: '/home/hermes',
  date: new Date().toString(),
  whoami: 'hermes',
  env: `HERMES_HOME=/home/hermes
HERMES_PROFILE=default
HERMES_GATEWAY_URL=http://127.0.0.1:8642
NODE_ENV=production
LANG=en_US.UTF-8`,
  ps: `PID   TTY     TIME    CMD
  1    ?       00:00:02 hermes-agent
  42   ?       00:00:01 hermes-gateway
  87   ?       00:00:00 hermes-scheduler`,
  uptime: 'up 3 days, 14:23, 1 user, load averages: 0.12 0.08 0.05',
  clear: '__CLEAR__',
};

export function TerminalView() {
  const { t } = useI18n();
  const [connected, setConnected] = useState(false);
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lineIdRef = useRef(0);

  const addLine = useCallback((type: TerminalLine['type'], content: string) => {
    const id = ++lineIdRef.current;
    setLines((prev) => [...prev, {
      id,
      type,
      content,
      timestamp: new Date().toLocaleTimeString(),
    }]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const handleConnect = () => {
    setConnected(true);
    addLine('system', t('terminal.connected'));
    addLine('output', `Hermes Hub Terminal v1.0.0`);
    addLine('output', `Type 'help' for available commands.`);
  };

  const handleDisconnect = () => {
    setConnected(false);
    addLine('system', t('terminal.disconnected'));
  };

  const handleClear = () => {
    setLines([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !connected) return;

    const cmd = input.trim();
    addLine('input', cmd);
    setCommandHistory((prev) => [cmd, ...prev]);
    setHistoryIndex(-1);
    setInput('');

    // Simulate command execution
    setTimeout(() => {
      const cmdBase = cmd.split(' ')[0].toLowerCase();
      const args = cmd.slice(cmdBase.length).trim();

      if (cmdBase === 'echo') {
        addLine('output', args || '');
      } else if (SIMULATED_COMMANDS[cmdBase]) {
        const response = SIMULATED_COMMANDS[cmdBase];
        if (response === '__CLEAR__') {
          setLines([]);
        } else {
          addLine('output', response);
        }
      } else {
        addLine('error', `command not found: ${cmdBase}. Type 'help' for available commands.`);
      }
    }, 100 + Math.random() * 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
      if (newIndex !== historyIndex) {
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIndex);
      setInput(newIndex === -1 ? '' : commandHistory[newIndex] || '');
    }
  };

  const lineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input': return 'text-emerald-400';
      case 'output': return 'text-gray-300';
      case 'error': return 'text-red-400';
      case 'system': return 'text-sky-400';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('terminal.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('terminal.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn(
            'text-xs gap-1',
            connected ? 'text-emerald-600 border-emerald-200' : 'text-gray-500 border-gray-200'
          )}>
            <span className={cn(
              'w-1.5 h-1.5 rounded-full',
              connected ? 'bg-emerald-500' : 'bg-gray-400'
            )} />
            {connected ? t('terminal.connected') : t('terminal.disconnected')}
          </Badge>
          {connected ? (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleDisconnect}>
              <Square className="w-4 h-4" /> {t('terminal.disconnect')}
            </Button>
          ) : (
            <Button size="sm" className="gap-2" onClick={handleConnect}>
              <Play className="w-4 h-4" /> {t('terminal.connect')}
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={handleClear}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Terminal */}
      <Card className="bg-gray-950 border-gray-800">
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]" ref={scrollRef}>
            <div className="p-4 font-mono text-sm">
              {lines.length === 0 && (
                <div className="text-gray-500">
                  {t('terminal.emptyMessage')}
                </div>
              )}
              {lines.map((line) => (
                <div key={line.id} className={cn('whitespace-pre-wrap break-all', lineColor(line.type))}>
                  {line.type === 'input' && (
                    <span className="text-emerald-500 mr-2">$</span>
                  )}
                  {line.type === 'system' && (
                    <span className="text-sky-500 mr-2">***</span>
                  )}
                  {line.content}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center border-t border-gray-800 px-4 py-2">
            <span className="text-emerald-500 font-mono text-sm mr-2">$</span>
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!connected}
              placeholder={connected ? t('terminal.inputPlaceholder') : t('terminal.connectFirst')}
              className="border-0 bg-transparent focus-visible:ring-0 text-emerald-400 font-mono text-sm placeholder:text-gray-600 px-0"
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              disabled={!connected || !input.trim()}
              className="w-8 h-8 text-emerald-500 hover:text-emerald-400 shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-3">
        {t('terminal.note')}
      </p>
    </div>
  );
}
