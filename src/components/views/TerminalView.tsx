'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  TerminalSquare, Plus, X, Loader2, Wifi, WifiOff,
  Search, Copy, Trash2, Zap, ChevronUp, ArrowUp, ArrowDown,
  Circle, CheckCircle2, XCircle, AlertCircle,
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

// Quick commands with categories
const QUICK_COMMAND_CATEGORIES = [
  {
    labelKey: 'terminal.cmdNavigation',
    commands: [
      { label: 'ls', command: 'ls\n' },
      { label: 'pwd', command: 'pwd\n' },
      { label: 'cd ..', command: 'cd ..\n' },
    ],
  },
  {
    labelKey: 'terminal.cmdDev',
    commands: [
      { label: 'npm run dev', command: 'npm run dev\n' },
      { label: 'npm test', command: 'npm test\n' },
      { label: 'bun dev', command: 'bun dev\n' },
    ],
  },
  {
    labelKey: 'terminal.cmdGit',
    commands: [
      { label: 'git status', command: 'git status\n' },
      { label: 'git log', command: 'git log --oneline -5\n' },
      { label: 'git diff', command: 'git diff\n' },
    ],
  },
  {
    labelKey: 'terminal.cmdSystem',
    commands: [
      { label: 'clear', command: 'clear\n' },
      { label: 'whoami', command: 'whoami\n' },
      { label: 'df -h', command: 'df -h\n' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TerminalView() {
  const { t } = useI18n();
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Command history
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentInput, setCurrentInput] = useState('');

  // Search in output
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Output buffer for copy/search
  const [outputBuffer, setOutputBuffer] = useState<string[]>([]);

  // Quick commands panel
  const [showQuickPanel, setShowQuickPanel] = useState(true);

  const termContainerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionsRef = useRef<TerminalSession[]>([]);
  const activeSessionRef = useRef<string | null>(null);
  const commandHistoryRef = useRef<string[]>([]);
  const currentLineRef = useRef<string>('');
  const outputBufferRef = useRef<string[]>([]);

  // Keep refs in sync with state
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  useEffect(() => { activeSessionRef.current = activeSessionId; }, [activeSessionId]);
  useEffect(() => { commandHistoryRef.current = commandHistory; }, [commandHistory]);
  useEffect(() => { outputBufferRef.current = outputBuffer; }, [outputBuffer]);

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
          name: `${t('terminal.session')} ${sessionsRef.current.length + 1}`,
          pid: msg.pid!,
          shell: msg.shell!,
        };
        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(msg.id!);
        break;
      }

      case 'output': {
        if (!msg.id || msg.id === activeSessionRef.current) {
          if (msg.data) {
            term.write(msg.data);
            setOutputBuffer(prev => {
              const updated = [...prev, msg.data!];
              if (updated.length > 5000) updated.splice(0, updated.length - 5000);
              return updated;
            });
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
        toast.error(msg.message || t('terminal.terminalError'));
        break;
      }
    }
  }, [t]);

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
      toast.error(t('terminal.connectionFailed'));
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
        background: '#0a0e14',
        foreground: '#3fb950',
        cursor: '#3fb950',
        cursorAccent: '#0a0e14',
        selectionBackground: '#1a3a1a',
        selectionForeground: '#3fb950',
        black: '#0a0e14',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39d353',
        white: '#b1bac4',
        brightBlack: '#484f58',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d364',
        brightWhite: '#f0f6fc',
      },
      scrollback: 5000,
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

    // Show initial message with green-on-black terminal style
    term.writeln('\x1b[32m\x1b[1m╔══════════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[32m\x1b[1m║     Hermes Hub Terminal v2.0              ║\x1b[0m');
    term.writeln('\x1b[32m\x1b[1m╚══════════════════════════════════════════╝\x1b[0m');
    term.writeln('');
    term.writeln('\x1b[32m>\x1b[0m \x1b[33mWelcome!\x1b[0m Type \x1b[32mhelp\x1b[0m for available commands.');
    term.writeln(`\x1b[90m  ${t('terminal.connectFirst')}\x1b[0m`);
    term.writeln('');

    // Handle terminal input
    term.onData((data) => {
      const ws = wsRef.current;

      // Handle command history navigation
      if (data === '\x1b[A') { // Up arrow
        const hist = commandHistoryRef.current;
        if (hist.length === 0) return;
        const newIndex = Math.min(historyIndex + 1, hist.length - 1);
        setHistoryIndex(newIndex);
        if (termRef.current) {
          const clearLen = currentLineRef.current.length;
          if (clearLen > 0) {
            termRef.current.write('\b \b'.repeat(clearLen));
          }
          currentLineRef.current = hist[hist.length - 1 - newIndex];
          termRef.current.write(currentLineRef.current);
        }
        return;
      }

      if (data === '\x1b[B') { // Down arrow
        const hist = commandHistoryRef.current;
        if (historyIndex <= 0) {
          setHistoryIndex(-1);
          if (termRef.current) {
            const clearLen = currentLineRef.current.length;
            if (clearLen > 0) {
              termRef.current.write('\b \b'.repeat(clearLen));
            }
            currentLineRef.current = '';
          }
          return;
        }
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        if (termRef.current) {
          const clearLen = currentLineRef.current.length;
          if (clearLen > 0) {
            termRef.current.write('\b \b'.repeat(clearLen));
          }
          currentLineRef.current = hist[hist.length - 1 - newIndex];
          termRef.current.write(currentLineRef.current);
        }
        return;
      }

      // Track current line for command history
      if (data === '\r') { // Enter
        const cmd = currentLineRef.current.trim();
        if (cmd) {
          setCommandHistory(prev => [...prev, cmd]);
          setHistoryIndex(-1);
        }
        currentLineRef.current = '';
      } else if (data === '\x7f') { // Backspace
        if (currentLineRef.current.length > 0) {
          currentLineRef.current = currentLineRef.current.slice(0, -1);
        }
      } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
        currentLineRef.current += data;
      }

      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      // Send input to the terminal service
      ws.send(JSON.stringify({
        type: 'input',
        data,
      }));
    });

    // Handle Ctrl+F for search
    term.attachCustomKeyEventHandler((event) => {
      if (event.ctrlKey && event.key === 'f') {
        event.preventDefault();
        setShowSearch(prev => !prev);
        return false;
      }
      return true;
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && termRef.current) {
        try {
          fitAddonRef.current.fit();
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
      toast.error(t('terminal.connectFirst'));
      return;
    }
    ws.send(JSON.stringify({ type: 'create' }));
  }, [t]);

  const switchSession = useCallback((sessionId: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

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
  // Output actions
  // -------------------------------------------------------------------------

  const handleCopyOutput = () => {
    const text = outputBuffer.join('');
    if (!text) {
      toast.info(t('terminal.noOutput'));
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      toast.success(t('terminal.outputCopied'));
    });
  };

  const handleClearTerminal = () => {
    if (termRef.current) {
      termRef.current.clear();
      setOutputBuffer([]);
    }
  };

  const handleQuickCommand = (command: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error(t('terminal.connectFirst'));
      return;
    }
    ws.send(JSON.stringify({ type: 'input', data: command }));
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TerminalSquare className="w-6 h-6" />
            {t('terminal.title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('terminal.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection Status Indicator */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
                  connected
                    ? 'bg-emerald-500/10 border-emerald-200 text-emerald-600'
                    : connecting
                      ? 'bg-amber-500/10 border-amber-200 text-amber-600'
                      : 'bg-gray-100 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700'
                )}>
                  {connected ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : connecting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  <span className={cn(
                    'w-2 h-2 rounded-full',
                    connected ? 'bg-emerald-500 animate-pulse' : connecting ? 'bg-amber-500' : 'bg-gray-400'
                  )} />
                  {connected ? t('terminal.connected') : connecting ? t('terminal.connecting') : t('terminal.disconnected')}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {connected ? t('terminal.statusConnectedDesc') : t('terminal.statusDisconnectedDesc')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {connected ? (
            <Button variant="outline" size="sm" className="gap-2" onClick={disconnectWebSocket}>
              <WifiOff className="w-4 h-4" /> {t('terminal.disconnect')}
            </Button>
          ) : (
            <Button size="sm" className="gap-2" onClick={connectWebSocket} disabled={connecting}>
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              {connecting ? t('terminal.connecting') : t('terminal.connect')}
            </Button>
          )}
          {connected && (
            <Button variant="outline" size="sm" className="gap-2" onClick={createNewSession}>
              <Plus className="w-4 h-4" /> {t('terminal.newSession')}
            </Button>
          )}
        </div>
      </div>

      {/* Quick Commands Panel */}
      {showQuickPanel && (
        <div className="mb-3 p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> {t('terminal.quickCommands')}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="w-5 h-5"
              onClick={() => setShowQuickPanel(false)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          <div className="space-y-2">
            {QUICK_COMMAND_CATEGORIES.map((category) => (
              <div key={category.labelKey} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-16 shrink-0">{t(category.labelKey)}</span>
                <div className="flex items-center gap-1 overflow-x-auto">
                  {category.commands.map((cmd) => (
                    <Button
                      key={cmd.label}
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] gap-1 shrink-0 font-mono hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-200 px-2"
                      onClick={() => handleQuickCommand(cmd.command)}
                      disabled={!connected}
                    >
                      {cmd.label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!showQuickPanel && (
        <div className="mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1 text-muted-foreground"
            onClick={() => setShowQuickPanel(true)}
          >
            <Zap className="w-3 h-3" /> {t('terminal.showQuickCmds')}
          </Button>
        </div>
      )}

      {/* Session Tabs */}
      {sessions.length > 0 && (
        <div className="flex items-center gap-1 mb-0 overflow-x-auto pb-0">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-t-md text-xs font-mono cursor-pointer transition-colors shrink-0',
                activeSessionId === session.id
                  ? 'bg-[#0a0e14] text-[#3fb950] border border-[#1a3a1a] border-b-[#0a0e14]'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 dark:bg-[#161b22] dark:text-gray-400 dark:border-[#1a3a1a] dark:hover:bg-[#21262d]'
              )}
              onClick={() => switchSession(session.id)}
            >
              <TerminalSquare className="w-3 h-3" />
              <span>{session.name}</span>
              <span className="text-gray-500 ml-1">(pid:{session.pid})</span>
              <button
                className="ml-1 p-0.5 rounded hover:bg-gray-600 dark:hover:bg-gray-600 transition-colors"
                onClick={(e) => { e.stopPropagation(); closeSession(session.id); }}
                title={t('terminal.closeSession')}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Terminal Container */}
      <div className="flex-1 min-h-0 relative">
        <div
          className={cn(
            'h-full overflow-hidden border',
            sessions.length > 0 ? 'rounded-b-lg rounded-tr-lg' : 'rounded-lg',
            'border-[#1a3a1a] bg-[#0a0e14]'
          )}
        >
          {/* Search Bar */}
          {showSearch && (
            <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-[#0d1117] border border-[#1a3a1a] rounded-md px-3 py-1.5 shadow-lg">
              <Search className="w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('terminal.searchPlaceholder')}
                className="h-6 w-48 bg-transparent border-0 text-xs text-gray-300 placeholder-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
                autoFocus
              />
              <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => { setShowSearch(false); setSearchQuery(''); }}>
                <X className="w-3 h-3 text-gray-400" />
              </Button>
            </div>
          )}

          {/* Action Buttons Overlay */}
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 bg-[#0d1117]/80 hover:bg-[#1a3a1a] text-emerald-500/70 hover:text-emerald-400"
                    onClick={handleCopyOutput}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('terminal.copyOutput')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 bg-[#0d1117]/80 hover:bg-[#1a3a1a] text-emerald-500/70 hover:text-emerald-400"
                    onClick={handleClearTerminal}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('terminal.clearTerminal')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 bg-[#0d1117]/80 hover:bg-[#1a3a1a] text-emerald-500/70 hover:text-emerald-400"
                    onClick={() => setShowSearch(prev => !prev)}
                  >
                    <Search className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{`${t('terminal.search')} (Ctrl+F)`}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div
            ref={termContainerRef}
            className="w-full h-full p-1"
            style={{ minHeight: '450px' }}
          />
        </div>
      </div>

      {/* Command History */}
      {commandHistory.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <ChevronUp className="w-3 h-3" /> {t('terminal.history')}
          </span>
          <div className="flex items-center gap-1 overflow-x-auto max-w-md">
            {commandHistory.slice(-10).reverse().map((cmd, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="h-6 text-[10px] font-mono shrink-0 py-0 px-2"
                onClick={() => handleQuickCommand(cmd + '\n')}
                disabled={!connected}
              >
                {cmd.length > 20 ? cmd.slice(0, 20) + '…' : cmd}
              </Button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-2">
        {t('terminal.note')} • <span className="text-emerald-600">Ctrl+F</span> {t('terminal.searchHint')}
      </p>
    </div>
  );
}
