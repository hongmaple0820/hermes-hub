'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TerminalSquare, Plus, X, Loader2, Wifi, WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// xterm.js imports
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TerminalSession {
  id: string;
  name: string;
  pid: number;
  shell: string;
}

interface WsMessage {
  type: string;
  id?: string;
  pid?: number;
  shell?: string;
  data?: string;
  exitCode?: number;
  message?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TerminalView() {
  const { t } = useI18n();
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const termContainerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionsRef = useRef<TerminalSession[]>([]);
  const activeSessionRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  useEffect(() => { activeSessionRef.current = activeSessionId; }, [activeSessionId]);

  // -------------------------------------------------------------------------
  // WebSocket message handler
  // -------------------------------------------------------------------------

  const handleWsMessage = useCallback((msg: WsMessage) => {
    const term = termRef.current;
    if (!term) return;

    switch (msg.type) {
      case 'created': {
        const newSession: TerminalSession = {
          id: msg.id!,
          name: `Terminal ${sessionsRef.current.length + 1}`,
          pid: msg.pid!,
          shell: msg.shell!,
        };
        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(msg.id!);
        break;
      }

      case 'output': {
        // Only write output if it's for the active session or session-agnostic
        if (!msg.id || msg.id === activeSessionRef.current) {
          if (msg.data) {
            term.write(msg.data);
          }
        }
        break;
      }

      case 'exited': {
        setSessions(prev => prev.filter(s => s.id !== msg.id));
        if (activeSessionRef.current === msg.id) {
          setActiveSessionId(prev => {
            const remaining = sessionsRef.current.filter(s => s.id !== msg.id);
            return remaining.length > 0 ? remaining[0].id : null;
          });
        }
        break;
      }

      case 'error': {
        toast.error(msg.message || 'Terminal error');
        break;
      }
    }
  }, []);

  // -------------------------------------------------------------------------
  // WebSocket connection
  // -------------------------------------------------------------------------

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    setConnecting(true);

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/?XTransformPort=3004&token=hermes-user`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        wsRef.current = ws;
        toast.success(t('terminal.connected'));

        // Send auth message
        ws.send(JSON.stringify({ type: 'auth', userId: 'hermes-user' }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WsMessage;
          handleWsMessage(msg);
        } catch {
          // Ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
      };

      ws.onerror = () => {
        setConnecting(false);
        toast.error(t('terminal.disconnected'));
      };
    } catch {
      setConnecting(false);
      toast.error('Failed to connect to terminal service');
    }
  }, [handleWsMessage, t]);

  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setSessions([]);
    setActiveSessionId(null);
    toast.info(t('terminal.disconnected'));
  }, [t]);

  // -------------------------------------------------------------------------
  // Terminal initialization
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!termContainerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Source Code Pro", Menlo, Monaco, monospace',
      theme: {
        background: '#0a0a0a',
        foreground: '#e4e4e4',
        cursor: '#e4e4e4',
        cursorAccent: '#0a0a0a',
        selectionBackground: '#333333',
        selectionForeground: '#ffffff',
        black: '#0a0a0a',
        red: '#ff5f5f',
        green: '#5fff5f',
        yellow: '#ffff5f',
        blue: '#5f5fff',
        magenta: '#ff5fff',
        cyan: '#5fffff',
        white: '#e4e4e4',
        brightBlack: '#666666',
        brightRed: '#ff8787',
        brightGreen: '#87ff87',
        brightYellow: '#ffff87',
        brightBlue: '#8787ff',
        brightMagenta: '#ff87ff',
        brightCyan: '#87ffff',
        brightWhite: '#ffffff',
      },
      scrollback: 1000,
      allowProposedApi: true,
      allowTransparency: false,
      convertEol: false,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(termContainerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Show initial message
    term.writeln('\x1b[36m\x1b[1mHermes Hub Terminal\x1b[0m');
    term.writeln(`Type 'help' for available commands. Click Connect to start a session.`);
    term.writeln('');

    // Handle terminal input
    term.onData((data) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      // Send input to the terminal service
      ws.send(JSON.stringify({
        type: 'input',
        data,
      }));
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && termRef.current) {
        try {
          fitAddonRef.current.fit();
          // Send resize to backend
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN && termRef.current) {
            ws.send(JSON.stringify({
              type: 'resize',
              cols: termRef.current.cols,
              rows: termRef.current.rows,
            }));
          }
        } catch {
          // Ignore resize errors
        }
      }
    });

    resizeObserver.observe(termContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Session management
  // -------------------------------------------------------------------------

  const createNewSession = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error('Not connected to terminal service');
      return;
    }
    ws.send(JSON.stringify({ type: 'create' }));
  }, []);

  const switchSession = useCallback((sessionId: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Clear terminal before switching
    if (termRef.current) {
      termRef.current.clear();
    }

    setActiveSessionId(sessionId);
    ws.send(JSON.stringify({ type: 'switch', sessionId }));
  }, []);

  const closeSession = useCallback((sessionId: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({ type: 'close', sessionId }));
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
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
              connected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
            )} />
            {connected ? t('terminal.connected') : t('terminal.disconnected')}
          </Badge>
          {connected ? (
            <Button variant="outline" size="sm" className="gap-2" onClick={disconnectWebSocket}>
              <WifiOff className="w-4 h-4" /> {t('terminal.disconnect')}
            </Button>
          ) : (
            <Button size="sm" className="gap-2" onClick={connectWebSocket} disabled={connecting}>
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              {connecting ? 'Connecting...' : t('terminal.connect')}
            </Button>
          )}
          {connected && (
            <Button variant="outline" size="sm" className="gap-2" onClick={createNewSession}>
              <Plus className="w-4 h-4" /> New Session
            </Button>
          )}
        </div>
      </div>

      {/* Session Tabs */}
      {sessions.length > 0 && (
        <div className="flex items-center gap-1 mb-2 overflow-x-auto pb-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-t-md text-xs font-mono cursor-pointer transition-colors shrink-0',
                activeSessionId === session.id
                  ? 'bg-gray-900 text-white border border-gray-700 border-b-gray-900'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-700'
              )}
              onClick={() => switchSession(session.id)}
            >
              <TerminalSquare className="w-3 h-3" />
              <span>{session.name}</span>
              <span className="text-gray-500 ml-1">(pid:{session.pid})</span>
              <button
                className="ml-1 p-0.5 rounded hover:bg-gray-600 dark:hover:bg-gray-600 transition-colors"
                onClick={(e) => { e.stopPropagation(); closeSession(session.id); }}
                title="Close session"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Terminal Container */}
      <div className="flex-1 min-h-0">
        <div
          className={cn(
            'h-full rounded-b-lg overflow-hidden border',
            sessions.length > 0 ? 'rounded-t-none' : 'rounded-t-lg',
            'border-gray-700 bg-[#0a0a0a]'
          )}
        >
          <div
            ref={termContainerRef}
            className="w-full h-full p-1"
            style={{ minHeight: '500px' }}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        {t('terminal.note')}
      </p>
    </div>
  );
}
