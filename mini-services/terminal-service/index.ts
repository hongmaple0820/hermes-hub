import { WebSocketServer, WebSocket } from 'ws';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TerminalSession {
  id: string;
  cwd: string;
  history: string[];
  historyIndex: number;
  env: Record<string, string>;
  shell: string;
  pid: number;
  createdAt: Date;
  lineBuffer: string;
  cursorPos: number;
  cols: number;
  rows: number;
}

interface AuthenticatedClient {
  ws: WebSocket;
  userId: string;
  sessions: Map<string, TerminalSession>;
  activeSessionId: string | null;
}

// ---------------------------------------------------------------------------
// ANSI Escape Codes
// ---------------------------------------------------------------------------

const ANSI = {
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  UNDERSCORE: '\x1b[4m',

  FG: {
    BLACK: '\x1b[30m',
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m',
    WHITE: '\x1b[37m',
    BRIGHT_BLACK: '\x1b[90m',
    BRIGHT_RED: '\x1b[91m',
    BRIGHT_GREEN: '\x1b[92m',
    BRIGHT_YELLOW: '\x1b[93m',
    BRIGHT_BLUE: '\x1b[94m',
    BRIGHT_MAGENTA: '\x1b[95m',
    BRIGHT_CYAN: '\x1b[96m',
    BRIGHT_WHITE: '\x1b[97m',
  },

  CLEAR_SCREEN: '\x1b[2J\x1b[H',
  CLEAR_LINE_RIGHT: '\x1b[K',
  CURSOR_LEFT: (n: number) => `\x1b[${n}D`,
  CURSOR_RIGHT: (n: number) => `\x1b[${n}C`,
};

// ---------------------------------------------------------------------------
// Virtual Filesystem
// ---------------------------------------------------------------------------

interface VFSNode {
  type: 'file' | 'directory';
  content?: string;
  children?: Map<string, VFSNode>;
  permissions: string;
  owner: string;
  group: string;
  size: number;
  modified: Date;
}

function createFile(content: string = '', owner: string = 'hermes'): VFSNode {
  return {
    type: 'file',
    content,
    permissions: '-rw-r--r--',
    owner,
    group: 'staff',
    size: content.length || 0,
    modified: new Date(),
  };
}

function createDir(owner: string = 'hermes'): VFSNode {
  return {
    type: 'directory',
    children: new Map(),
    permissions: 'drwxr-xr-x',
    owner,
    group: 'staff',
    size: 64,
    modified: new Date(),
  };
}

function buildInitialFilesystem(): VFSNode {
  const root = createDir();
  root.permissions = 'drwxr-xr-x';
  root.owner = 'root';
  root.group = 'wheel';

  // /home
  const home = createDir();
  home.owner = 'root';
  root.children!.set('home', home);

  // /home/hermes
  const hermes = createDir();
  home.children!.set('hermes', hermes);

  // /home/hermes/.hermes
  const dotHermes = createDir();
  hermes.children!.set('.hermes', dotHermes);
  dotHermes.children!.set('config.json', createFile(JSON.stringify({
    version: '1.0.0',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4',
    gatewayUrl: 'http://127.0.0.1:8642',
  }, null, 2)));
  dotHermes.children!.set('agents.json', createFile(JSON.stringify({
    agents: [
      { id: 'agent-1', name: 'Hermes Assistant', status: 'active', mode: 'builtin' },
      { id: 'agent-2', name: 'Code Reviewer', status: 'idle', mode: 'custom_api' },
      { id: 'agent-3', name: 'Data Analyst', status: 'offline', mode: 'hermes' },
    ],
  }, null, 2)));
  dotHermes.children!.set('sessions', createDir());

  hermes.children!.set('config.yaml', createFile(`# Hermes Hub Configuration
version: "1.0.0"
server:
  host: "0.0.0.0"
  port: 8642
agents:
  max_concurrent: 10
  default_timeout: 300
llm:
  default_provider: "openai"
  default_model: "gpt-4"
  temperature: 0.7
  max_tokens: 4096
`));

  hermes.children!.set('.env', createFile(`HERMES_HOME=/home/hermes
HERMES_PROFILE=default
HERMES_GATEWAY_URL=http://127.0.0.1:8642
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxx
NODE_ENV=production
LANG=en_US.UTF-8
`));

  hermes.children!.set('soul.md', createFile(`# Hermes Soul

I am Hermes, a multi-agent collaboration assistant.
My purpose is to facilitate communication and task execution
across multiple AI agents and platforms.

## Core Values
- Clarity in communication
- Reliability in task execution
- Adaptability to new challenges
- Collaboration over competition
`));

  const skills = createDir();
  hermes.children!.set('skills', skills);
  skills.children!.set('web_search.py', createFile(`#!/usr/bin/env python3
"""Web Search Skill for Hermes"""
def search(query: str) -> list:
    """Search the web for information"""
    pass
`));
  skills.children!.set('code_review.py', createFile(`#!/usr/bin/env python3
"""Code Review Skill for Hermes"""
def review(code: str, language: str) -> dict:
    """Review code and provide feedback"""
    pass
`));
  skills.children!.set('data_analysis.py', createFile(`#!/usr/bin/env python3
"""Data Analysis Skill for Hermes"""
def analyze(data: str, format: str = "csv") -> dict:
    """Analyze data and generate insights"""
    pass
`));

  const data = createDir();
  hermes.children!.set('data', data);
  data.children!.set('conversations.json', createFile('[]'));
  data.children!.set('usage_stats.json', createFile('{}'));

  const etc = createDir();
  etc.owner = 'root';
  root.children!.set('etc', etc);
  etc.children!.set('hostname', createFile('hermes-hub'));
  etc.children!.set('os-release', createFile(`NAME="HermesOS"
VERSION="1.0.0"
ID=hermes
PRETTY_NAME="HermesOS 1.0.0"
HOME_URL="https://hermes-hub.dev"
`));
  etc.children!.set('passwd', createFile('root:x:0:0:root:/root:/bin/bash\nhermes:x:1000:1000:Hermes User:/home/hermes:/bin/hermes-sh'));

  const tmp = createDir();
  tmp.permissions = 'drwxrwxrwt';
  tmp.owner = 'root';
  root.children!.set('tmp', tmp);

  const varDir = createDir();
  varDir.owner = 'root';
  root.children!.set('var', varDir);
  const varLog = createDir();
  varLog.owner = 'root';
  varDir.children!.set('log', varLog);
  varLog.children!.set('hermes.log', createFile(`[2024-03-04 10:00:01] INFO  - Hermes Hub started
[2024-03-04 10:00:02] INFO  - Gateway listening on port 8642
[2024-03-04 10:00:03] INFO  - Agent "Hermes Assistant" registered
[2024-03-04 10:00:04] INFO  - Agent "Code Reviewer" registered
[2024-03-04 10:00:05] INFO  - Agent "Data Analyst" registered
[2024-03-04 10:05:12] INFO  - WebSocket terminal service started
`));

  return root;
}

const filesystem = buildInitialFilesystem();

// ---------------------------------------------------------------------------
// Filesystem Operations
// ---------------------------------------------------------------------------

function resolvePath(cwd: string, path: string): string {
  if (path.startsWith('/')) return normalizePath(path);
  if (path.startsWith('~/')) return normalizePath('/home/hermes' + path.slice(1));
  return normalizePath(cwd + '/' + path);
}

function normalizePath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '..') resolved.pop();
    else if (part !== '.') resolved.push(part);
  }
  return '/' + resolved.join('/');
}

function getNode(path: string): VFSNode | null {
  if (path === '/') return filesystem;
  const parts = path.split('/').filter(Boolean);
  let current = filesystem;
  for (const part of parts) {
    if (current.type !== 'directory' || !current.children?.has(part)) return null;
    current = current.children.get(part)!;
  }
  return current;
}

function getParentAndName(path: string): { parent: VFSNode | null; name: string } {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { parent: null, name: '' };
  const name = parts.pop()!;
  const parentPath = '/' + parts.join('/');
  return { parent: getNode(parentPath || '/'), name };
}

function formatDisplayPath(cwd: string): string {
  if (cwd === '/home/hermes') return '~';
  if (cwd.startsWith('/home/hermes/')) return '~' + cwd.slice('/home/hermes'.length);
  return cwd;
}

function formatLongListing(node: VFSNode, name: string): string {
  const dateStr = node.modified.toLocaleDateString('en-US', {
    month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).replace(',', '');
  const size = node.type === 'file' ? String(node.content?.length || 0).padStart(5) : '   64';
  return `${node.permissions}  1 ${node.owner.padEnd(6)} ${node.group.padEnd(6)} ${size} ${dateStr} ${name}`;
}

// ---------------------------------------------------------------------------
// Command Execution
// ---------------------------------------------------------------------------

function executeCommand(session: TerminalSession, input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  session.history.push(trimmed);
  session.historyIndex = session.history.length;

  const parts = parseCommand(trimmed);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  try {
    switch (cmd) {
      case 'ls': return cmdLs(session, args);
      case 'cd': return cmdCd(session, args);
      case 'pwd': return cmdPwd(session);
      case 'cat': return cmdCat(session, args);
      case 'echo': return cmdEcho(args);
      case 'mkdir': return cmdMkdir(session, args);
      case 'touch': return cmdTouch(session, args);
      case 'rm': return cmdRm(session, args);
      case 'cp': return cmdCp(session, args);
      case 'mv': return cmdMv(session, args);
      case 'env': return cmdEnv(session);
      case 'ps': return cmdPs();
      case 'whoami': return cmdWhoami();
      case 'date': return cmdDate();
      case 'uptime': return cmdUptime();
      case 'clear': return '__CLEAR__';
      case 'help': return cmdHelp();
      case 'hermes': return cmdHermes(args);
      case 'grep': return cmdGrep(session, args);
      case 'head': return cmdHead(session, args);
      case 'tail': return cmdTail(session, args);
      case 'wc': return cmdWc(session, args);
      case 'find': return cmdFind(session, args);
      case 'tree': return cmdTree(session, args);
      case 'history': return cmdHistory(session);
      case 'export': return cmdExport(session, args);
      case 'uname': return cmdUname(args);
      case 'hostname': return cmdHostname();
      case 'id': return cmdId();
      case 'which': return cmdWhich(args);
      case 'man': return cmdMan(args);
      case 'exit': return `${ANSI.FG.YELLOW}Use the close button to exit the terminal session.${ANSI.RESET}`;
      default:
        return `${ANSI.FG.RED}command not found: ${cmd}${ANSI.RESET}\nType ${ANSI.FG.GREEN}'help'${ANSI.RESET} for available commands.`;
    }
  } catch (err: any) {
    return `${ANSI.FG.RED}${cmd}: ${err.message || 'Unknown error'}${ANSI.RESET}`;
  }
}

function parseCommand(input: string): string[] {
  const result: string[] = [];
  let current = '';
  let inSingle = false, inDouble = false;
  for (const ch of input) {
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === ' ' && !inSingle && !inDouble) {
      if (current) { result.push(current); current = ''; }
    } else current += ch;
  }
  if (current) result.push(current);
  return result;
}

// ---- Individual Command Implementations ----

function cmdLs(session: TerminalSession, args: string[]): string {
  let showHidden = false, longFormat = false, targetPath = session.cwd;
  for (const arg of args) {
    if (arg.includes('a')) showHidden = true;
    if (arg.includes('l')) longFormat = true;
    if (!arg.startsWith('-')) targetPath = resolvePath(session.cwd, arg);
  }
  const node = getNode(targetPath);
  if (!node) return `${ANSI.FG.RED}ls: cannot access '${args.find(a => !a.startsWith('-')) || targetPath}': No such file or directory${ANSI.RESET}`;
  if (node.type === 'file') {
    const name = targetPath.split('/').pop() || targetPath;
    return longFormat ? formatLongListing(node, name) : name;
  }
  const entries: string[] = [];
  for (const [name, child] of Array.from(node.children!.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!showHidden && name.startsWith('.')) continue;
    if (longFormat) entries.push(formatLongListing(child, name));
    else if (child.type === 'directory') entries.push(`${ANSI.FG.BLUE}${ANSI.BOLD}${name}/${ANSI.RESET}`);
    else entries.push(name);
  }
  return entries.join('\n') || '(empty directory)';
}

function cmdCd(session: TerminalSession, args: string[]): string {
  const target = args[0] || '~';
  const newPath = resolvePath(session.cwd, target);
  const node = getNode(newPath);
  if (!node) return `${ANSI.FG.RED}cd: no such file or directory: ${target}${ANSI.RESET}`;
  if (node.type !== 'directory') return `${ANSI.FG.RED}cd: not a directory: ${target}${ANSI.RESET}`;
  session.cwd = newPath;
  return '';
}

function cmdPwd(session: TerminalSession): string { return session.cwd; }

function cmdCat(session: TerminalSession, args: string[]): string {
  if (args.length === 0) return `${ANSI.FG.RED}cat: missing file operand${ANSI.RESET}`;
  const results: string[] = [];
  for (const arg of args) {
    const path = resolvePath(session.cwd, arg);
    const node = getNode(path);
    if (!node) { results.push(`${ANSI.FG.RED}cat: ${arg}: No such file or directory${ANSI.RESET}`); continue; }
    if (node.type === 'directory') { results.push(`${ANSI.FG.RED}cat: ${arg}: Is a directory${ANSI.RESET}`); continue; }
    results.push(node.content || '');
  }
  return results.join('\n');
}

function cmdEcho(args: string[]): string { return args.join(' '); }

function cmdMkdir(session: TerminalSession, args: string[]): string {
  if (args.length === 0) return `${ANSI.FG.RED}mkdir: missing operand${ANSI.RESET}`;
  let recursive = false;
  const paths: string[] = [];
  for (const arg of args) { if (arg === '-p') recursive = true; else paths.push(arg); }
  for (const p of paths) {
    const fullPath = resolvePath(session.cwd, p);
    if (recursive) {
      const parts = fullPath.split('/').filter(Boolean);
      let current = filesystem;
      for (const part of parts) {
        if (!current.children!.has(part)) current.children!.set(part, createDir());
        current = current.children!.get(part)!;
        if (current.type !== 'directory') return `${ANSI.FG.RED}mkdir: cannot create directory '${p}': Not a directory${ANSI.RESET}`;
      }
    } else {
      const { parent, name } = getParentAndName(fullPath);
      if (!parent || parent.type !== 'directory') return `${ANSI.FG.RED}mkdir: cannot create directory '${p}': No such file or directory${ANSI.RESET}`;
      if (parent.children!.has(name)) return `${ANSI.FG.RED}mkdir: cannot create directory '${p}': File exists${ANSI.RESET}`;
      parent.children!.set(name, createDir());
    }
  }
  return '';
}

function cmdTouch(session: TerminalSession, args: string[]): string {
  if (args.length === 0) return `${ANSI.FG.RED}touch: missing file operand${ANSI.RESET}`;
  for (const arg of args) {
    if (arg.startsWith('-')) continue;
    const fullPath = resolvePath(session.cwd, arg);
    const node = getNode(fullPath);
    if (node) { node.modified = new Date(); }
    else {
      const { parent, name } = getParentAndName(fullPath);
      if (!parent || parent.type !== 'directory') return `${ANSI.FG.RED}touch: cannot touch '${arg}': No such file or directory${ANSI.RESET}`;
      parent.children!.set(name, createFile());
    }
  }
  return '';
}

function cmdRm(session: TerminalSession, args: string[]): string {
  let recursive = false, force = false;
  const paths: string[] = [];
  for (const arg of args) {
    if (arg === '-r' || arg === '-R') recursive = true;
    else if (arg === '-f') force = true;
    else if (arg === '-rf' || arg === '-fr') { recursive = true; force = true; }
    else paths.push(arg);
  }
  if (paths.length === 0) return `${ANSI.FG.RED}rm: missing operand${ANSI.RESET}`;
  for (const p of paths) {
    const fullPath = resolvePath(session.cwd, p);
    const node = getNode(fullPath);
    if (!node) { if (!force) return `${ANSI.FG.RED}rm: cannot remove '${p}': No such file or directory${ANSI.RESET}`; continue; }
    if (node.type === 'directory' && !recursive) return `${ANSI.FG.RED}rm: cannot remove '${p}': Is a directory${ANSI.RESET}`;
    const { parent, name } = getParentAndName(fullPath);
    if (parent && parent.type === 'directory') parent.children!.delete(name);
  }
  return '';
}

function cmdCp(session: TerminalSession, args: string[]): string {
  if (args.length < 2) return `${ANSI.FG.RED}cp: missing file operand${ANSI.RESET}`;
  const srcPath = resolvePath(session.cwd, args[0]);
  const srcNode = getNode(srcPath);
  if (!srcNode) return `${ANSI.FG.RED}cp: cannot stat '${args[0]}': No such file or directory${ANSI.RESET}`;
  if (srcNode.type === 'directory') return `${ANSI.FG.RED}cp: -r not specified; omitting directory '${args[0]}'${ANSI.RESET}`;
  const dstPath = resolvePath(session.cwd, args[1]);
  const dstNode = getNode(dstPath);
  let targetParent: VFSNode | null, targetName: string;
  if (dstNode && dstNode.type === 'directory') { targetName = srcPath.split('/').pop()!; targetParent = dstNode; }
  else { const r = getParentAndName(dstPath); targetParent = r.parent; targetName = r.name; }
  if (!targetParent || targetParent.type !== 'directory') return `${ANSI.FG.RED}cp: cannot create regular file '${args[1]}'${ANSI.RESET}`;
  targetParent.children!.set(targetName, createFile(srcNode.content || ''));
  return '';
}

function cmdMv(session: TerminalSession, args: string[]): string {
  if (args.length < 2) return `${ANSI.FG.RED}mv: missing file operand${ANSI.RESET}`;
  const srcPath = resolvePath(session.cwd, args[0]);
  const srcNode = getNode(srcPath);
  if (!srcNode) return `${ANSI.FG.RED}mv: cannot stat '${args[0]}': No such file or directory${ANSI.RESET}`;
  const { parent: srcParent, name: srcName } = getParentAndName(srcPath);
  if (!srcParent) return `${ANSI.FG.RED}mv: cannot move '${args[0]}'${ANSI.RESET}`;
  const dstPath = resolvePath(session.cwd, args[1]);
  const dstNode = getNode(dstPath);
  let targetParent: VFSNode | null, targetName: string;
  if (dstNode && dstNode.type === 'directory') { targetName = srcName; targetParent = dstNode; }
  else { const r = getParentAndName(dstPath); targetParent = r.parent; targetName = r.name; }
  if (!targetParent || targetParent.type !== 'directory') return `${ANSI.FG.RED}mv: cannot move '${args[0]}' to '${args[1]}'${ANSI.RESET}`;
  targetParent.children!.set(targetName, srcNode);
  srcParent.children!.delete(srcName);
  return '';
}

function cmdEnv(session: TerminalSession): string {
  return Object.entries(session.env).map(([k, v]) => `${ANSI.FG.CYAN}${k}${ANSI.RESET}=${v}`).join('\n');
}

function cmdPs(): string {
  return [
    `${ANSI.FG.BOLD}PID   TTY     TIME      CMD${ANSI.RESET}`,
    `1     ?       00:00:02  ${ANSI.FG.GREEN}hermes-agent${ANSI.RESET}`,
    `42    ?       00:01:12  ${ANSI.FG.GREEN}hermes-gateway${ANSI.RESET}`,
    `87    ?       00:00:34  ${ANSI.FG.CYAN}hermes-scheduler${ANSI.RESET}`,
    `156   ?       00:00:08  ${ANSI.FG.YELLOW}hermes-ws-server${ANSI.RESET}`,
    `203   pts/0   00:00:00  ${ANSI.FG.WHITE}hermes-sh${ANSI.RESET}`,
  ].join('\n');
}

function cmdWhoami(): string { return 'hermes'; }
function cmdDate(): string { return new Date().toString(); }
function cmdUptime(): string { return 'up 3 days, 14:23, 1 user, load averages: 0.12 0.08 0.05'; }

function cmdHelp(): string {
  return [
    `${ANSI.BOLD}${ANSI.FG.GREEN}Hermes Shell - Available Commands${ANSI.RESET}`,
    '',
    `${ANSI.FG.YELLOW}File Operations:${ANSI.RESET}`,
    `  ls [-a] [-l] [path]     List directory contents`,
    `  cd [path]               Change directory`,
    `  pwd                     Print working directory`,
    `  cat <file>              Display file contents`,
    `  echo <text>             Echo text back`,
    `  mkdir [-p] <dir>        Create directory`,
    `  touch <file>            Create empty file`,
    `  rm [-rf] <path>         Remove files or directories`,
    `  cp <src> <dst>          Copy file`,
    `  mv <src> <dst>          Move/rename file`,
    '',
    `${ANSI.FG.YELLOW}Text Processing:${ANSI.RESET}`,
    `  grep <pattern> <file>   Search for pattern in file`,
    `  head [-n N] <file>      Display first N lines`,
    `  tail [-n N] <file>      Display last N lines`,
    `  wc <file>               Count lines, words, chars`,
    `  find [path] -name <pat> Find files by name`,
    `  tree [path]             Display directory tree`,
    '',
    `${ANSI.FG.YELLOW}System:${ANSI.RESET}`,
    `  env                     Show environment variables`,
    `  export KEY=VALUE        Set environment variable`,
    `  ps                      Show running processes`,
    `  whoami                  Show current user`,
    `  date                    Show current date and time`,
    `  uptime                  Show system uptime`,
    `  hostname                Show hostname`,
    `  uname [-a]              Show system information`,
    `  id                      Show user/group IDs`,
    `  which <cmd>             Show command location`,
    '',
    `${ANSI.FG.YELLOW}Hermes:${ANSI.RESET}`,
    `  hermes [status|agents|skills|version]`,
    '',
    `${ANSI.FG.YELLOW}Other:${ANSI.RESET}`,
    `  clear                   Clear terminal screen`,
    `  history                 Show command history`,
    `  man <cmd>               Show command manual`,
    `  help                    Show this help message`,
  ].join('\n');
}

function cmdHermes(args: string[]): string {
  const subcmd = (args[0] || 'status').toLowerCase();
  switch (subcmd) {
    case 'status':
      return [
        `${ANSI.BOLD}${ANSI.FG.CYAN}╔══════════════════════════════════════╗${ANSI.RESET}`,
        `${ANSI.BOLD}${ANSI.FG.CYAN}║     Hermes Hub - System Status      ║${ANSI.RESET}`,
        `${ANSI.BOLD}${ANSI.FG.CYAN}╚══════════════════════════════════════╝${ANSI.RESET}`,
        '',
        `  ${ANSI.FG.GREEN}●${ANSI.RESET} Gateway:      ${ANSI.FG.GREEN}Running${ANSI.RESET}  (port 8642)`,
        `  ${ANSI.FG.GREEN}●${ANSI.RESET} Agent Core:   ${ANSI.FG.GREEN}Active${ANSI.RESET}   (3 agents)`,
        `  ${ANSI.FG.GREEN}●${ANSI.RESET} Scheduler:    ${ANSI.FG.GREEN}Running${ANSI.RESET}`,
        `  ${ANSI.FG.GREEN}●${ANSI.RESET} WS Server:    ${ANSI.FG.GREEN}Connected${ANSI.RESET}`,
        `  ${ANSI.FG.YELLOW}●${ANSI.RESET} Skill Runner: ${ANSI.FG.YELLOW}Idle${ANSI.RESET}`,
        '',
        `  Memory:  256MB / 512MB  ${ANSI.FG.GREEN}████████████${ANSI.RESET}░░░░  50%`,
        `  CPU:     0.12 / 4.00   ${ANSI.FG.GREEN}█${ANSI.RESET}░░░░░░░░░░░░░░░  3%`,
        `  Uptime:  3 days 14:23`,
      ].join('\n');
    case 'agents':
      return [
        `${ANSI.BOLD}Hermes Agents:${ANSI.RESET}`,
        '',
        `  ${ANSI.FG.GREEN}●${ANSI.RESET} ${ANSI.BOLD}Hermes Assistant${ANSI.RESET}  (agent-1)  mode: builtin   status: ${ANSI.FG.GREEN}active${ANSI.RESET}`,
        `  ${ANSI.FG.YELLOW}●${ANSI.RESET} ${ANSI.BOLD}Code Reviewer${ANSI.RESET}     (agent-2)  mode: custom_api status: ${ANSI.FG.YELLOW}idle${ANSI.RESET}`,
        `  ${ANSI.FG.RED}●${ANSI.RESET} ${ANSI.BOLD}Data Analyst${ANSI.RESET}       (agent-3)  mode: hermes    status: ${ANSI.FG.RED}offline${ANSI.RESET}`,
      ].join('\n');
    case 'skills':
      return [
        `${ANSI.BOLD}Installed Skills:${ANSI.RESET}`,
        '',
        `  ${ANSI.FG.CYAN}▸${ANSI.RESET} web_search     Web Search Skill         ${ANSI.FG.GREEN}[enabled]${ANSI.RESET}`,
        `  ${ANSI.FG.CYAN}▸${ANSI.RESET} code_review    Code Review Skill        ${ANSI.FG.GREEN}[enabled]${ANSI.RESET}`,
        `  ${ANSI.FG.CYAN}▸${ANSI.RESET} data_analysis  Data Analysis Skill      ${ANSI.FG.GREEN}[enabled]${ANSI.RESET}`,
        '',
        `  3 skills installed, 3 enabled`,
      ].join('\n');
    case 'version':
      return `${ANSI.BOLD}Hermes Hub${ANSI.RESET} v1.0.0\n  Shell: hermes-sh 1.0.0\n  Gateway: 1.0.0\n  Agent Core: 1.0.0`;
    default:
      return `${ANSI.FG.RED}hermes: unknown command '${subcmd}'${ANSI.RESET}\nAvailable: status, agents, skills, version`;
  }
}

function cmdGrep(session: TerminalSession, args: string[]): string {
  if (args.length < 2) return `${ANSI.FG.RED}grep: missing arguments${ANSI.RESET}`;
  const [pattern, filePath] = [args[0], resolvePath(session.cwd, args[1])];
  const node = getNode(filePath);
  if (!node) return `${ANSI.FG.RED}grep: ${args[1]}: No such file or directory${ANSI.RESET}`;
  if (node.type === 'directory') return `${ANSI.FG.RED}grep: ${args[1]}: Is a directory${ANSI.RESET}`;
  const matches = (node.content || '').split('\n').filter(l => l.includes(pattern));
  if (matches.length === 0) return '';
  return matches.map(line => {
    const idx = line.indexOf(pattern);
    return line.slice(0, idx) + ANSI.FG.RED + ANSI.BOLD + line.slice(idx, idx + pattern.length) + ANSI.RESET + line.slice(idx + pattern.length);
  }).join('\n');
}

function cmdHead(session: TerminalSession, args: string[]): string {
  let n = 10;
  const paths: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-n' && args[i + 1]) { n = parseInt(args[++i], 10); }
    else if (!args[i].startsWith('-')) paths.push(args[i]);
  }
  if (!paths[0]) return `${ANSI.FG.RED}head: missing file operand${ANSI.RESET}`;
  const node = getNode(resolvePath(session.cwd, paths[0]));
  if (!node) return `${ANSI.FG.RED}head: ${paths[0]}: No such file or directory${ANSI.RESET}`;
  if (node.type === 'directory') return `${ANSI.FG.RED}head: ${paths[0]}: Is a directory${ANSI.RESET}`;
  return (node.content || '').split('\n').slice(0, n).join('\n');
}

function cmdTail(session: TerminalSession, args: string[]): string {
  let n = 10;
  const paths: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-n' && args[i + 1]) { n = parseInt(args[++i], 10); }
    else if (!args[i].startsWith('-')) paths.push(args[i]);
  }
  if (!paths[0]) return `${ANSI.FG.RED}tail: missing file operand${ANSI.RESET}`;
  const node = getNode(resolvePath(session.cwd, paths[0]));
  if (!node) return `${ANSI.FG.RED}tail: ${paths[0]}: No such file or directory${ANSI.RESET}`;
  if (node.type === 'directory') return `${ANSI.FG.RED}tail: ${paths[0]}: Is a directory${ANSI.RESET}`;
  return (node.content || '').split('\n').slice(-n).join('\n');
}

function cmdWc(session: TerminalSession, args: string[]): string {
  if (!args[0]) return `${ANSI.FG.RED}wc: missing file operand${ANSI.RESET}`;
  const node = getNode(resolvePath(session.cwd, args[0]));
  if (!node) return `${ANSI.FG.RED}wc: ${args[0]}: No such file or directory${ANSI.RESET}`;
  if (node.type === 'directory') return `${ANSI.FG.RED}wc: ${args[0]}: Is a directory${ANSI.RESET}`;
  const c = node.content || '';
  return `  ${c.split('\n').length}\t${c.split(/\s+/).filter(Boolean).length}\t${c.length}\t${args[0]}`;
}

function cmdFind(session: TerminalSession, args: string[]): string {
  let searchPath = session.cwd, namePattern = '*';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-name' && args[i + 1]) { namePattern = args[++i]; }
    else if (!args[i].startsWith('-')) searchPath = resolvePath(session.cwd, args[i]);
  }
  const regex = new RegExp('^' + namePattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  const results: string[] = [];
  function walk(path: string, node: VFSNode) {
    const name = path.split('/').pop() || path;
    if (regex.test(name)) results.push(path);
    if (node.type === 'directory' && node.children) {
      for (const [n, c] of node.children) walk(path + '/' + n, c);
    }
  }
  const rootNode = getNode(searchPath);
  if (!rootNode) return `${ANSI.FG.RED}find: '${searchPath}': No such file or directory${ANSI.RESET}`;
  walk(searchPath === '/' ? '' : searchPath, rootNode);
  return results.join('\n') || '';
}

function cmdTree(session: TerminalSession, args: string[]): string {
  const targetPath = args[0] ? resolvePath(session.cwd, args[0]) : session.cwd;
  const node = getNode(targetPath);
  if (!node) return `${ANSI.FG.RED}tree: '${targetPath}': No such file or directory${ANSI.RESET}`;
  if (node.type !== 'directory') return targetPath;
  const lines: string[] = [targetPath];
  let dirs = 0, files = 0;
  function walk(node: VFSNode, prefix: string) {
    const children = Array.from(node.children!.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    children.forEach(([name, child], i) => {
      const isLast = i === children.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const next = isLast ? '    ' : '│   ';
      if (child.type === 'directory') {
        dirs++;
        lines.push(prefix + connector + ANSI.FG.BLUE + ANSI.BOLD + name + '/' + ANSI.RESET);
        walk(child, prefix + next);
      } else { files++; lines.push(prefix + connector + name); }
    });
  }
  walk(node, '');
  lines.push(`\n${dirs} directories, ${files} files`);
  return lines.join('\n');
}

function cmdHistory(session: TerminalSession): string {
  return session.history.map((cmd, i) => `  ${String(i + 1).padStart(4)}  ${cmd}`).join('\n');
}

function cmdExport(session: TerminalSession, args: string[]): string {
  for (const arg of args) {
    const eq = arg.indexOf('=');
    if (eq > 0) session.env[arg.slice(0, eq)] = arg.slice(eq + 1);
  }
  return '';
}

function cmdUname(args: string[]): string {
  return args.includes('-a') ? 'HermesOS hermes-hub 1.0.0 HermesOS v1.0.0 x86_64 GNU/Linux' : 'HermesOS';
}

function cmdHostname(): string { return 'hermes-hub'; }
function cmdId(): string { return 'uid=1000(hermes) gid=1000(staff) groups=1000(staff),4(adm),27(sudo)'; }

function cmdWhich(args: string[]): string {
  if (!args[0]) return '';
  const cmds = ['ls','cd','pwd','cat','echo','mkdir','touch','rm','cp','mv','env','ps','whoami','date','uptime','clear','help','hermes','grep','head','tail','wc','find','tree','history','export','uname','hostname','id','which','man'];
  return cmds.includes(args[0]) ? `/usr/bin/${args[0]}` : `${args[0]} not found`;
}

function cmdMan(args: string[]): string {
  if (!args[0]) return `${ANSI.FG.RED}man: what manual page do you want?${ANSI.RESET}`;
  const pages: Record<string, string> = {
    ls: `LS(1)\n\nNAME\n    ls - list directory contents\n\nSYNOPSIS\n    ls [-a] [-l] [file ...]`,
    cd: `CD(1)\n\nNAME\n    cd - change working directory\n\nSYNOPSIS\n    cd [dir]`,
    hermes: `HERMES(1)\n\nNAME\n    hermes - Hermes Hub commands\n\nSYNOPSIS\n    hermes [status|agents|skills|version]`,
  };
  return pages[args[0]] || `${ANSI.FG.RED}No manual entry for ${args[0]}${ANSI.RESET}`;
}

// ---------------------------------------------------------------------------
// Tab Completion
// ---------------------------------------------------------------------------

function getCompletions(session: TerminalSession, input: string): string[] {
  const parts = input.split(/\s+/);
  if (parts.length > 1 || input.endsWith(' ')) {
    return getPathCompletions(session, parts.length > 1 ? parts[parts.length - 1] : '');
  }
  const commands = ['ls','cd','pwd','cat','echo','mkdir','touch','rm','cp','mv','env','ps','whoami','date','uptime','clear','help','hermes','grep','head','tail','wc','find','tree','history','export','uname','hostname','id','which','man'];
  return commands.filter(cmd => cmd.startsWith(parts[0].toLowerCase()));
}

function getPathCompletions(session: TerminalSession, partial: string): string[] {
  let dir: string, prefix: string;
  if (partial.includes('/')) {
    const lastSlash = partial.lastIndexOf('/');
    dir = resolvePath(session.cwd, partial.slice(0, lastSlash + 1));
    prefix = partial.slice(lastSlash + 1);
  } else { dir = session.cwd; prefix = partial; }
  const node = getNode(dir);
  if (!node || node.type !== 'directory') return [];
  return Array.from(node.children!.entries())
    .filter(([name]) => name.startsWith(prefix))
    .map(([name, child]) => child.type === 'directory' ? name + '/' : name)
    .sort();
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildPrompt(session: TerminalSession): string {
  return `${ANSI.FG.GREEN}${ANSI.BOLD}hermes${ANSI.RESET}@${ANSI.FG.GREEN}${ANSI.BOLD}hub${ANSI.RESET}:${ANSI.FG.BLUE}${ANSI.BOLD}${formatDisplayPath(session.cwd)}${ANSI.RESET}$ `;
}

// ---------------------------------------------------------------------------
// WebSocket Server & Session Management
// ---------------------------------------------------------------------------

const PORT = 3004;
const wss = new WebSocketServer({ port: PORT });
const clients = new Map<WebSocket, AuthenticatedClient>();
let pidCounter = 1000;

function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

function send(ws: WebSocket, data: any) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function createSession(ws: WebSocket, client: AuthenticatedClient, sessionId?: string): TerminalSession {
  const id = sessionId || generateId();
  const pid = ++pidCounter;
  const session: TerminalSession = {
    id, pid,
    cwd: '/home/hermes',
    history: [],
    historyIndex: 0,
    env: {
      HOME: '/home/hermes', USER: 'hermes', SHELL: '/bin/hermes-sh',
      PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'en_US.UTF-8',
      TERM: 'xterm-256color', HERMES_HOME: '/home/hermes',
      HERMES_PROFILE: 'default', HERMES_GATEWAY_URL: 'http://127.0.0.1:8642',
      NODE_ENV: 'production',
    },
    shell: '/bin/hermes-sh',
    createdAt: new Date(),
    lineBuffer: '',
    cursorPos: 0,
    cols: 80,
    rows: 24,
  };

  client.sessions.set(id, session);
  client.activeSessionId = id;

  send(ws, { type: 'created', id, pid, shell: session.shell });

  // Welcome banner
  const banner = [
    '',
    `${ANSI.FG.CYAN}${ANSI.BOLD}╔═══════════════════════════════════════════╗${ANSI.RESET}`,
    `${ANSI.FG.CYAN}${ANSI.BOLD}║       Hermes Hub Terminal v1.0.0          ║${ANSI.RESET}`,
    `${ANSI.FG.CYAN}${ANSI.BOLD}║       Multi-Agent Collaboration           ║${ANSI.RESET}`,
    `${ANSI.FG.CYAN}${ANSI.BOLD}╚═══════════════════════════════════════════╝${ANSI.RESET}`,
    '',
    `  Type ${ANSI.FG.GREEN}'help'${ANSI.RESET} for available commands.`,
    `  Type ${ANSI.FG.GREEN}'hermes status'${ANSI.RESET} to check system status.`,
    '',
  ].join('\r\n');

  send(ws, { type: 'output', id, data: banner });
  send(ws, { type: 'output', id, data: buildPrompt(session) });

  return session;
}

function handleInput(ws: WebSocket, client: AuthenticatedClient, data: string) {
  const session = client.activeSessionId ? client.sessions.get(client.activeSessionId) : null;
  if (!session) {
    send(ws, { type: 'error', message: 'No active terminal session' });
    return;
  }

  const sessionId = session.id;

  // Handle escape sequences for arrow keys
  if (data === '\x1b[A') { // Up arrow
    if (session.historyIndex > 0) {
      // Clear current line
      if (session.cursorPos > 0) {
        send(ws, { type: 'output', id: sessionId, data: `\r${buildPrompt(session)}${ANSI.CLEAR_LINE_RIGHT}` });
      } else {
        send(ws, { type: 'output', id: sessionId, data: `\r${ANSI.CLEAR_LINE_RIGHT}` });
      }
      session.historyIndex--;
      session.lineBuffer = session.history[session.historyIndex] || '';
      session.cursorPos = session.lineBuffer.length;
      send(ws, { type: 'output', id: sessionId, data: `${buildPrompt(session)}${session.lineBuffer}` });
    }
    return;
  }

  if (data === '\x1b[B') { // Down arrow
    if (session.cursorPos > 0) {
      send(ws, { type: 'output', id: sessionId, data: `\r${buildPrompt(session)}${ANSI.CLEAR_LINE_RIGHT}` });
    }
    if (session.historyIndex < session.history.length - 1) {
      session.historyIndex++;
      session.lineBuffer = session.history[session.historyIndex] || '';
    } else {
      session.historyIndex = session.history.length;
      session.lineBuffer = '';
    }
    session.cursorPos = session.lineBuffer.length;
    send(ws, { type: 'output', id: sessionId, data: `${buildPrompt(session)}${session.lineBuffer}` });
    return;
  }

  if (data === '\x1b[C') { // Right arrow
    if (session.cursorPos < session.lineBuffer.length) {
      session.cursorPos++;
      send(ws, { type: 'output', id: sessionId, data: ANSI.CURSOR_RIGHT(1) });
    }
    return;
  }

  if (data === '\x1b[D') { // Left arrow
    if (session.cursorPos > 0) {
      session.cursorPos--;
      send(ws, { type: 'output', id: sessionId, data: ANSI.CURSOR_LEFT(1) });
    }
    return;
  }

  // Tab completion
  if (data === '\t') {
    const completions = getCompletions(session, session.lineBuffer);
    if (completions.length === 1) {
      // Replace the current word with the completion
      const parts = session.lineBuffer.split(/\s+/);
      const lastPart = parts[parts.length - 1] || '';
      const completion = completions[0];

      // Find the common prefix of the completion relative to what's typed
      const suffix = completion.startsWith(lastPart) ? completion.slice(lastPart.length) : completion;

      // Clear current line and redraw
      send(ws, { type: 'output', id: sessionId, data: `\r${buildPrompt(session)}${ANSI.CLEAR_LINE_RIGHT}` });
      parts[parts.length - 1] = completion;
      session.lineBuffer = parts.join(' ');
      session.cursorPos = session.lineBuffer.length;
      send(ws, { type: 'output', id: sessionId, data: `${buildPrompt(session)}${session.lineBuffer}` });
    } else if (completions.length > 1) {
      // Show possible completions
      send(ws, { type: 'output', id: sessionId, data: '\r\n' + completions.join('  ') });
      send(ws, { type: 'output', id: sessionId, data: '\r\n' + buildPrompt(session) + session.lineBuffer });
    }
    return;
  }

  // Ctrl+C
  if (data === '\x03') {
    send(ws, { type: 'output', id: sessionId, data: '^C\r\n' + buildPrompt(session) });
    session.lineBuffer = '';
    session.cursorPos = 0;
    return;
  }

  // Ctrl+L (clear screen)
  if (data === '\x0c') {
    send(ws, { type: 'output', id: sessionId, data: ANSI.CLEAR_SCREEN + buildPrompt(session) });
    session.lineBuffer = '';
    session.cursorPos = 0;
    return;
  }

  // Ctrl+U (clear line)
  if (data === '\x15') {
    send(ws, { type: 'output', id: sessionId, data: `\r${buildPrompt(session)}${ANSI.CLEAR_LINE_RIGHT}` });
    session.lineBuffer = '';
    session.cursorPos = 0;
    return;
  }

  // Backspace / Delete
  if (data === '\x7f' || data === '\b') {
    if (session.cursorPos > 0) {
      const before = session.lineBuffer.slice(0, session.cursorPos - 1);
      const after = session.lineBuffer.slice(session.cursorPos);
      session.lineBuffer = before + after;
      session.cursorPos--;
      // Redraw line
      send(ws, { type: 'output', id: sessionId, data: `\r${buildPrompt(session)}${session.lineBuffer} ${ANSI.CURSOR_LEFT(session.lineBuffer.length - session.cursorPos + 1)}` });
    }
    return;
  }

  // Enter
  if (data === '\r' || data === '\n') {
    const cmdLine = session.lineBuffer;
    send(ws, { type: 'output', id: sessionId, data: '\r\n' });

    // Process command
    if (cmdLine.trim()) {
      const output = executeCommand(session, cmdLine);
      if (output === '__CLEAR__') {
        send(ws, { type: 'output', id: sessionId, data: ANSI.CLEAR_SCREEN });
      } else if (output) {
        send(ws, { type: 'output', id: sessionId, data: output + '\r\n' });
      }
    }

    // New prompt
    send(ws, { type: 'output', id: sessionId, data: buildPrompt(session) });
    session.lineBuffer = '';
    session.cursorPos = 0;
    return;
  }

  // Regular printable character
  if (data.length === 1 && data.charCodeAt(0) >= 32) {
    const before = session.lineBuffer.slice(0, session.cursorPos);
    const after = session.lineBuffer.slice(session.cursorPos);
    session.lineBuffer = before + data + after;
    session.cursorPos++;
    // Echo the character and redraw if in the middle
    if (after.length === 0) {
      send(ws, { type: 'output', id: sessionId, data: data });
    } else {
      send(ws, { type: 'output', id: sessionId, data: `${data}${after}${ANSI.CURSOR_LEFT(after.length)}` });
    }
    return;
  }

  // Paste (multi-character data that's not an escape sequence)
  if (data.length > 1 && !data.startsWith('\x1b')) {
    for (const ch of data) {
      if (ch.charCodeAt(0) >= 32) {
        const before = session.lineBuffer.slice(0, session.cursorPos);
        const after = session.lineBuffer.slice(session.cursorPos);
        session.lineBuffer = before + ch + after;
        session.cursorPos++;
      }
    }
    // Redraw the whole line
    send(ws, { type: 'output', id: sessionId, data: `\r${buildPrompt(session)}${session.lineBuffer}${ANSI.CLEAR_LINE_RIGHT}${ANSI.CURSOR_LEFT(session.lineBuffer.length - session.cursorPos)}` });
  }
}

wss.on('connection', (ws: WebSocket, req) => {
  console.log(`[CONNECT] New WebSocket connection from ${req.socket.remoteAddress}`);

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const token = url.searchParams.get('token');

  const client: AuthenticatedClient = {
    ws,
    userId: token || 'anonymous',
    sessions: new Map(),
    activeSessionId: null,
  };

  clients.set(ws, client);

  // If token provided, auto-create a session
  if (token) {
    createSession(ws, client);
  }

  ws.on('message', (raw: Buffer) => {
    const text = raw.toString();

    try {
      const data = JSON.parse(text);

      switch (data.type) {
        case 'auth': {
          client.userId = data.userId || 'anonymous';
          console.log(`[AUTH] User ${client.userId} authenticated`);
          if (client.sessions.size === 0) createSession(ws, client);
          break;
        }

        case 'create': {
          createSession(ws, client, data.sessionId);
          break;
        }

        case 'switch': {
          if (client.sessions.has(data.sessionId)) {
            client.activeSessionId = data.sessionId;
            const session = client.sessions.get(data.sessionId)!;
            send(ws, { type: 'output', id: data.sessionId, data: buildPrompt(session) });
          } else {
            send(ws, { type: 'error', message: `Session ${data.sessionId} not found` });
          }
          break;
        }

        case 'close': {
          if (client.sessions.has(data.sessionId)) {
            client.sessions.delete(data.sessionId);
            send(ws, { type: 'exited', id: data.sessionId, exitCode: 0 });
            if (client.activeSessionId === data.sessionId) {
              client.activeSessionId = client.sessions.size > 0
                ? client.sessions.keys().next().value! : null;
            }
          } else {
            send(ws, { type: 'error', message: `Session ${data.sessionId} not found` });
          }
          break;
        }

        case 'resize': {
          const session = client.activeSessionId ? client.sessions.get(client.activeSessionId) : null;
          if (session) {
            session.cols = data.cols || 80;
            session.rows = data.rows || 24;
          }
          break;
        }

        case 'input': {
          handleInput(ws, client, data.data);
          break;
        }

        default:
          send(ws, { type: 'error', message: `Unknown message type: ${data.type}` });
      }
    } catch {
      // Raw string input - treat as complete command line
      if (!client.activeSessionId) createSession(ws, client);
      const session = client.activeSessionId ? client.sessions.get(client.activeSessionId) : null;
      if (!session) return;

      const inputStr = text.trim();
      if (!inputStr) return;

      const output = executeCommand(session, inputStr);
      if (output === '__CLEAR__') {
        send(ws, { type: 'output', id: session.id, data: ANSI.CLEAR_SCREEN });
      } else if (output) {
        send(ws, { type: 'output', id: session.id, data: '\r\n' + output });
      }
      send(ws, { type: 'output', id: session.id, data: '\r\n' + buildPrompt(session) });
    }
  });

  ws.on('close', (code) => {
    console.log(`[DISCONNECT] Client ${client.userId} disconnected (code: ${code})`);
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error(`[ERROR] WebSocket error for ${client.userId}:`, error);
    clients.delete(ws);
  });
});

// ---------------------------------------------------------------------------
// Start & Graceful Shutdown
// ---------------------------------------------------------------------------

console.log(`[Hermes Terminal Service] WebSocket server running on port ${PORT}`);
console.log(`[Hermes Terminal Service] Ready to accept connections`);

const shutdown = () => {
  console.log('[Hermes Terminal Service] Shutting down...');
  wss.close(() => { console.log('[Hermes Terminal Service] Server closed'); process.exit(0); });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
