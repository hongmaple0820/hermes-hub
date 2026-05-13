'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import {
  ArrowLeft, Plus, Play, Save, Trash2, GripVertical, X, Settings, Clock,
  Bot, Zap, GitBranch, Shuffle, GitMerge, Globe, Code, UserCheck, Timer,
  Workflow, Repeat, ChevronDown, ChevronRight, Search, Loader2,
  CheckCircle2, XCircle, MinusCircle, AlertCircle, Copy, Edit3,
  MoreHorizontal, Download, Upload, Pause, RotateCcw, Eye,
  Network, FileJson, Terminal, Variable, Sparkles, Layers,
} from 'lucide-react';

// ===================== TYPES =====================

type NodeCategory = 'execution' | 'control' | 'data' | 'integration' | 'utility';

interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  position: { x: number; y: number };
  config: Record<string, any>;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourcePort?: string;
  targetPort?: string;
  label?: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: 'draft' | 'active' | 'archived';
  lastRunAt: string | null;
  executionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt: string | null;
  nodeStates: Record<string, 'pending' | 'running' | 'success' | 'failed' | 'skipped'>;
  logs: ExecutionLog[];
  variables: Record<string, any>;
  output: any;
}

interface ExecutionLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  nodeId?: string;
  message: string;
}

type NodeType =
  | 'agent-call'
  | 'skill-invoke'
  | 'condition'
  | 'transform'
  | 'parallel'
  | 'merge'
  | 'http-request'
  | 'code-exec'
  | 'human-input'
  | 'delay'
  | 'sub-workflow'
  | 'loop';

// ===================== NODE TYPE CONFIG =====================

interface NodeTypeConfig {
  label: string;
  icon: React.ElementType;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  category: NodeCategory;
  description: string;
  defaultConfig: Record<string, any>;
}

const NODE_TYPE_CONFIGS: Record<NodeType, NodeTypeConfig> = {
  'agent-call': {
    label: 'Agent Call',
    icon: Bot,
    color: 'emerald',
    bgClass: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    borderClass: 'border-emerald-500/40',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    category: 'execution',
    description: 'Invoke an agent with a prompt',
    defaultConfig: { agentId: '', promptTemplate: '', modelOverride: '', temperature: 0.7, maxTokens: 2048 },
  },
  'skill-invoke': {
    label: 'Skill Invoke',
    icon: Zap,
    color: 'amber',
    bgClass: 'bg-amber-500/10 dark:bg-amber-500/20',
    borderClass: 'border-amber-500/40',
    textClass: 'text-amber-600 dark:text-amber-400',
    category: 'execution',
    description: 'Invoke a specific agent skill',
    defaultConfig: { agentId: '', skillId: '', parameters: {} },
  },
  condition: {
    label: 'Condition',
    icon: GitBranch,
    color: 'violet',
    bgClass: 'bg-violet-500/10 dark:bg-violet-500/20',
    borderClass: 'border-violet-500/40',
    textClass: 'text-violet-600 dark:text-violet-400',
    category: 'control',
    description: 'Branch based on a condition',
    defaultConfig: { expression: '', trueLabel: 'Yes', falseLabel: 'No' },
  },
  transform: {
    label: 'Transform',
    icon: Shuffle,
    color: 'sky',
    bgClass: 'bg-sky-500/10 dark:bg-sky-500/20',
    borderClass: 'border-sky-500/40',
    textClass: 'text-sky-600 dark:text-sky-400',
    category: 'data',
    description: 'Transform data with templates',
    defaultConfig: { template: '', inputPath: '' },
  },
  parallel: {
    label: 'Parallel',
    icon: Layers,
    color: 'orange',
    bgClass: 'bg-orange-500/10 dark:bg-orange-500/20',
    borderClass: 'border-orange-500/40',
    textClass: 'text-orange-600 dark:text-orange-400',
    category: 'control',
    description: 'Execute branches in parallel',
    defaultConfig: {},
  },
  merge: {
    label: 'Merge',
    icon: GitMerge,
    color: 'orange',
    bgClass: 'bg-orange-500/10 dark:bg-orange-500/20',
    borderClass: 'border-orange-500/40',
    textClass: 'text-orange-600 dark:text-orange-400',
    category: 'control',
    description: 'Merge parallel branches',
    defaultConfig: { strategy: 'last' },
  },
  'http-request': {
    label: 'HTTP Request',
    icon: Globe,
    color: 'blue',
    bgClass: 'bg-blue-500/10 dark:bg-blue-500/20',
    borderClass: 'border-blue-500/40',
    textClass: 'text-blue-600 dark:text-blue-400',
    category: 'integration',
    description: 'Make an HTTP request',
    defaultConfig: { method: 'GET', url: '', headers: {}, body: '' },
  },
  'code-exec': {
    label: 'Code Exec',
    icon: Code,
    color: 'pink',
    bgClass: 'bg-pink-500/10 dark:bg-pink-500/20',
    borderClass: 'border-pink-500/40',
    textClass: 'text-pink-600 dark:text-pink-400',
    category: 'execution',
    description: 'Execute code',
    defaultConfig: { code: '', language: 'javascript', timeout: 30000 },
  },
  'human-input': {
    label: 'Human Input',
    icon: UserCheck,
    color: 'slate',
    bgClass: 'bg-slate-500/10 dark:bg-slate-500/20',
    borderClass: 'border-slate-500/40',
    textClass: 'text-slate-600 dark:text-slate-400',
    category: 'utility',
    description: 'Request human input',
    defaultConfig: { prompt: '', timeout: 300, defaultResponse: '' },
  },
  delay: {
    label: 'Delay',
    icon: Timer,
    color: 'stone',
    bgClass: 'bg-stone-500/10 dark:bg-stone-500/20',
    borderClass: 'border-stone-500/40',
    textClass: 'text-stone-600 dark:text-stone-400',
    category: 'utility',
    description: 'Wait for a duration',
    defaultConfig: { duration: 1, unit: 's' },
  },
  'sub-workflow': {
    label: 'Sub Workflow',
    icon: Workflow,
    color: 'teal',
    bgClass: 'bg-teal-500/10 dark:bg-teal-500/20',
    borderClass: 'border-teal-500/40',
    textClass: 'text-teal-600 dark:text-teal-400',
    category: 'execution',
    description: 'Execute another workflow',
    defaultConfig: { workflowId: '' },
  },
  loop: {
    label: 'Loop',
    icon: Repeat,
    color: 'indigo',
    bgClass: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    borderClass: 'border-indigo-500/40',
    textClass: 'text-indigo-600 dark:text-indigo-400',
    category: 'control',
    description: 'Loop over array items',
    defaultConfig: { arrayPath: '', itemVariable: 'item' },
  },
};

const NODE_CATEGORIES: { id: NodeCategory; label: string; icon: React.ElementType }[] = [
  { id: 'execution', label: 'Execution', icon: Play },
  { id: 'control', label: 'Control Flow', icon: GitBranch },
  { id: 'data', label: 'Data', icon: Shuffle },
  { id: 'integration', label: 'Integration', icon: Globe },
  { id: 'utility', label: 'Utility', icon: Settings },
];

// ===================== HELPERS =====================

function generateId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateEdgeId(): string {
  return `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ===================== MOCK DATA =====================

function createMockWorkflows(): Workflow[] {
  return [
    {
      id: 'wf-1',
      name: 'Customer Support Pipeline',
      description: 'Automated customer support with agent triage and escalation',
      nodes: [
        { id: 'n1', type: 'agent-call', name: 'Triage Agent', position: { x: 200, y: 100 }, config: { agentId: 'agent-1', promptTemplate: 'Classify this customer query: {{input}}', temperature: 0.3, maxTokens: 256 } },
        { id: 'n2', type: 'condition', name: 'Check Priority', position: { x: 200, y: 250 }, config: { expression: "{{nodes.n1.output}} === 'high'", trueLabel: 'Escalate', falseLabel: 'Auto-resolve' } },
        { id: 'n3', type: 'agent-call', name: 'Support Agent', position: { x: 80, y: 400 }, config: { agentId: 'agent-2', promptTemplate: 'Resolve this issue: {{input}}' } },
        { id: 'n4', type: 'human-input', name: 'Escalation Review', position: { x: 320, y: 400 }, config: { prompt: 'Review escalated issue', timeout: 600 } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3', sourcePort: 'false', label: 'Auto-resolve' },
        { id: 'e3', source: 'n2', target: 'n4', sourcePort: 'true', label: 'Escalate' },
      ],
      status: 'active',
      lastRunAt: new Date(Date.now() - 3600000).toISOString(),
      executionCount: 42,
      createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'wf-2',
      name: 'Data Processing ETL',
      description: 'Extract, transform, and load data from multiple sources',
      nodes: [
        { id: 'n1', type: 'http-request', name: 'Fetch Data', position: { x: 200, y: 100 }, config: { method: 'GET', url: 'https://api.example.com/data' } },
        { id: 'n2', type: 'transform', name: 'Transform', position: { x: 200, y: 250 }, config: { template: '{ "result": {{nodes.n1.output.data | json}} }', inputPath: '$.data' } },
        { id: 'n3', type: 'http-request', name: 'Load Data', position: { x: 200, y: 400 }, config: { method: 'POST', url: 'https://warehouse.example.com/load' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ],
      status: 'draft',
      lastRunAt: null,
      executionCount: 0,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'wf-3',
      name: 'Code Review Bot',
      description: 'Automated code review with multi-agent analysis',
      nodes: [
        { id: 'n1', type: 'code-exec', name: 'Parse Diff', position: { x: 200, y: 80 }, config: { code: 'return input.diff;', language: 'javascript' } },
        { id: 'n2', type: 'parallel', name: 'Parallel Analysis', position: { x: 200, y: 200 }, config: {} },
        { id: 'n3', type: 'agent-call', name: 'Security Review', position: { x: 80, y: 320 }, config: { agentId: 'agent-sec', promptTemplate: 'Review for security issues: {{nodes.n1.output}}' } },
        { id: 'n4', type: 'agent-call', name: 'Style Review', position: { x: 320, y: 320 }, config: { agentId: 'agent-style', promptTemplate: 'Review code style: {{nodes.n1.output}}' } },
        { id: 'n5', type: 'merge', name: 'Merge Reviews', position: { x: 200, y: 440 }, config: { strategy: 'merge-object' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n2', target: 'n4' },
        { id: 'e4', source: 'n3', target: 'n5' },
        { id: 'e5', source: 'n4', target: 'n5' },
      ],
      status: 'active',
      lastRunAt: new Date(Date.now() - 7200000).toISOString(),
      executionCount: 15,
      createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
    },
  ];
}

function createMockExecution(workflowId: string): WorkflowExecution {
  return {
    id: `exec-${Date.now()}`,
    workflowId,
    status: 'running',
    startedAt: new Date().toISOString(),
    completedAt: null,
    nodeStates: {
      n1: 'success',
      n2: 'running',
      n3: 'pending',
      n4: 'pending',
    },
    logs: [
      { timestamp: new Date(Date.now() - 5000).toISOString(), level: 'info', nodeId: 'n1', message: 'Node started' },
      { timestamp: new Date(Date.now() - 3000).toISOString(), level: 'info', nodeId: 'n1', message: 'Agent responded successfully' },
      { timestamp: new Date(Date.now() - 2000).toISOString(), level: 'info', nodeId: 'n2', message: 'Evaluating condition...' },
    ],
    variables: { input: 'Test query', nodes: { n1: { output: { result: 'success' } } } },
    output: null,
  };
}

// ===================== SVG CANVAS =====================

interface CanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  connectingFrom: string | null;
  nodeStates?: Record<string, 'pending' | 'running' | 'success' | 'failed' | 'skipped'>;
  onNodeClick: (id: string) => void;
  onNodeDragStart: (id: string, e: React.MouseEvent) => void;
  onCanvasClick: () => void;
  onEdgeClick: (id: string) => void;
  onConnectTarget: (targetId: string) => void;
  mousePos?: { x: number; y: number };
  zoom: number;
  pan: { x: number; y: number };
  onZoomChange: (z: number) => void;
  onPanChange: (p: { x: number; y: number }) => void;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

function SvgCanvas({
  nodes, edges, selectedNodeId, connectingFrom, nodeStates,
  onNodeClick, onNodeDragStart, onCanvasClick, onEdgeClick,
  onConnectTarget, mousePos, zoom, pan, onZoomChange, onPanChange,
}: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    onZoomChange(Math.min(Math.max(zoom + delta, 0.3), 2));
  }, [zoom, onZoomChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      e.preventDefault();
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      onPanChange({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
    }
  }, [onPanChange]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleSvgClick = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as Element).tagName === 'rect' && (e.target as Element).classList.contains('canvas-bg')) {
      onCanvasClick();
    }
  }, [onCanvasClick]);

  const getNodeCenter = (node: WorkflowNode) => ({
    x: node.position.x + NODE_WIDTH / 2,
    y: node.position.y + NODE_HEIGHT / 2,
  });

  const getPortPosition = (node: WorkflowNode, port: 'top' | 'bottom' | 'left' | 'right') => {
    const cx = node.position.x + NODE_WIDTH / 2;
    const cy = node.position.y + NODE_HEIGHT / 2;
    switch (port) {
      case 'top': return { x: cx, y: node.position.y };
      case 'bottom': return { x: cx, y: node.position.y + NODE_HEIGHT };
      case 'left': return { x: node.position.x, y: cy };
      case 'right': return { x: node.position.x + NODE_WIDTH, y: cy };
    }
  };

  const buildEdgePath = (edge: WorkflowEdge) => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return '';

    const start = getPortPosition(sourceNode, 'bottom');
    const end = getPortPosition(targetNode, 'top');

    // If this is the "true" branch from a condition, curve left; if "false", curve right
    const isTrueBranch = edge.sourcePort === 'true';
    const isFalseBranch = edge.sourcePort === 'false';
    const horizontalOffset = isTrueBranch ? -60 : isFalseBranch ? 60 : 0;

    const midY = (start.y + end.y) / 2;
    const controlY1 = start.y + Math.max(40, Math.abs(end.y - start.y) * 0.3);
    const controlY2 = end.y - Math.max(40, Math.abs(end.y - start.y) * 0.3);

    return `M ${start.x + horizontalOffset} ${start.y} C ${start.x + horizontalOffset} ${controlY1}, ${end.x} ${controlY2}, ${end.x} ${end.y}`;
  };

  const stateIndicator = (state?: 'pending' | 'running' | 'success' | 'failed' | 'skipped') => {
    if (!state) return null;
    switch (state) {
      case 'pending': return <circle r="6" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />;
      case 'running': return (
        <g className="animate-spin origin-center" style={{ animationDuration: '1s' }}>
          <circle r="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="12 8" className="text-blue-500" />
        </g>
      );
      case 'success': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'failed': return <XCircle className="w-3.5 h-3.5 text-red-500" />;
      case 'skipped': return <MinusCircle className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  // Build connection line when connecting
  const connectingLine = connectingFrom && mousePos ? (() => {
    const sourceNode = nodes.find(n => n.id === connectingFrom);
    if (!sourceNode) return null;
    const start = getPortPosition(sourceNode, 'bottom');
    return (
      <path
        d={`M ${start.x} ${start.y} C ${start.x} ${start.y + 40}, ${mousePos.x} ${mousePos.y - 40}, ${mousePos.x} ${mousePos.y}`}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeDasharray="6 3"
        className="pointer-events-none"
      />
    );
  })() : null;

  return (
    <svg
      ref={svgRef}
      className="w-full h-full cursor-default"
      style={{ background: 'transparent' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleSvgClick}
    >
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth">
          <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--muted-foreground))" />
        </marker>
        <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth">
          <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" />
        </marker>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.5" />
        </pattern>
      </defs>

      <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
        {/* Grid background */}
        <rect className="canvas-bg" x="-5000" y="-5000" width="10000" height="10000" fill="url(#grid)" />

        {/* Edges */}
        {edges.map(edge => {
          const path = buildEdgePath(edge);
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          const isRelated = sourceNode?.id === selectedNodeId || targetNode?.id === selectedNodeId;

          return (
            <g key={edge.id} onClick={(e) => { e.stopPropagation(); onEdgeClick(edge.id); }} className="cursor-pointer">
              <path
                d={path}
                fill="none"
                stroke={isRelated ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                strokeWidth={isRelated ? 2.5 : 1.5}
                markerEnd={isRelated ? 'url(#arrowhead-selected)' : 'url(#arrowhead)'}
                className="transition-all duration-200"
                opacity={isRelated ? 1 : 0.6}
              />
              {/* Wider invisible path for easier clicking */}
              <path d={path} fill="none" stroke="transparent" strokeWidth={12} />
              {edge.label && (
                <text
                  x={(sourceNode!.position.x + targetNode!.position.x + NODE_WIDTH) / 2}
                  y={(sourceNode!.position.y + NODE_HEIGHT + targetNode!.position.y) / 2}
                  textAnchor="middle"
                  className="text-[10px] fill-muted-foreground select-none"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Connecting line */}
        {connectingLine}

        {/* Nodes */}
        {nodes.map(node => {
          const config = NODE_TYPE_CONFIGS[node.type];
          const isSelected = selectedNodeId === node.id;
          const Icon = config.icon;
          const state = nodeStates?.[node.id];

          return (
            <g
              key={node.id}
              transform={`translate(${node.position.x}, ${node.position.y})`}
              onClick={(e) => {
                e.stopPropagation();
                if (connectingFrom && connectingFrom !== node.id) {
                  onConnectTarget(node.id);
                } else {
                  onNodeClick(node.id);
                }
              }}
              onMouseDown={(e) => {
                if (e.button === 0 && !e.altKey) {
                  onNodeDragStart(node.id, e);
                }
              }}
              className="cursor-pointer"
            >
              {/* Shadow */}
              <rect
                x="2" y="2"
                width={NODE_WIDTH} height={NODE_HEIGHT}
                rx="10" ry="10"
                fill="black" opacity="0.06"
              />
              {/* Node body */}
              <rect
                width={NODE_WIDTH} height={NODE_HEIGHT}
                rx="10" ry="10"
                fill="hsl(var(--card))"
                stroke={isSelected ? 'hsl(var(--primary))' : `hsl(var(--border))`}
                strokeWidth={isSelected ? 2 : 1}
                className="transition-all duration-150"
              />
              {/* Type indicator strip */}
              <rect
                x="1" y="1"
                width="4" height={NODE_HEIGHT - 2}
                rx="2" ry="2"
                className={config.bgClass}
                style={{ fill: 'currentColor' }}
              />
              {/* Icon */}
              <g transform={`translate(16, ${NODE_HEIGHT / 2 - 10})`}>
                <g className={config.textClass}>
                  <Icon className="w-5 h-5" />
                </g>
              </g>
              {/* Name */}
              <text
                x="36" y={NODE_HEIGHT / 2 - 4}
                className="text-xs font-medium fill-foreground select-none"
              >
                {node.name.length > 18 ? node.name.slice(0, 17) + '…' : node.name}
              </text>
              <text
                x="36" y={NODE_HEIGHT / 2 + 10}
                className="text-[9px] fill-muted-foreground select-none"
              >
                {config.label}
              </text>
              {/* State indicator */}
              {state && (
                <g transform={`translate(${NODE_WIDTH - 18}, ${NODE_HEIGHT / 2})`}>
                  {stateIndicator(state)}
                </g>
              )}
              {/* Selection glow */}
              {isSelected && (
                <rect
                  width={NODE_WIDTH} height={NODE_HEIGHT}
                  rx="10" ry="10"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="3"
                  opacity="0.2"
                />
              )}
              {/* Ports */}
              <circle cx={NODE_WIDTH / 2} cy={0} r="4" fill="hsl(var(--muted-foreground))" opacity="0.4" className="hover:opacity-100 transition-opacity" />
              <circle cx={NODE_WIDTH / 2} cy={NODE_HEIGHT} r="4" fill="hsl(var(--muted-foreground))" opacity="0.4" className="hover:opacity-100 transition-opacity" />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// ===================== NODE CONFIG PANEL =====================

interface NodeConfigPanelProps {
  node: WorkflowNode;
  agents: any[];
  skills: any[];
  workflows: Workflow[];
  onUpdateConfig: (config: Record<string, any>) => void;
  onUpdateName: (name: string) => void;
  onDelete: () => void;
}

function NodeConfigPanel({ node, agents, skills, workflows, onUpdateConfig, onUpdateName, onDelete }: NodeConfigPanelProps) {
  const { t } = useI18n();
  const config = NODE_TYPE_CONFIGS[node.type];
  const Icon = config.icon;

  const [paramKey, setParamKey] = useState('');
  const [paramValue, setParamValue] = useState('');
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');

  const renderFields = () => {
    switch (node.type) {
      case 'agent-call':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('workflows.agentSelector')}</Label>
              <Select value={node.config.agentId || ''} onValueChange={(v) => onUpdateConfig({ ...node.config, agentId: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t('workflows.selectAgent')} /></SelectTrigger>
                <SelectContent>
                  {agents.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('workflows.promptTemplate')}</Label>
              <Textarea
                className="mt-1 font-mono text-xs min-h-[80px]"
                value={node.config.promptTemplate || ''}
                onChange={(e) => onUpdateConfig({ ...node.config, promptTemplate: e.target.value })}
                placeholder="Enter {{variable}} references..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{t('workflows.modelOverride')}</Label>
                <Input
                  className="mt-1 text-xs"
                  value={node.config.modelOverride || ''}
                  onChange={(e) => onUpdateConfig({ ...node.config, modelOverride: e.target.value })}
                  placeholder={t('workflows.optional')}
                />
              </div>
              <div>
                <Label className="text-xs">{t('workflows.temperature')}</Label>
                <Input
                  className="mt-1 text-xs"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={node.config.temperature ?? 0.7}
                  onChange={(e) => onUpdateConfig({ ...node.config, temperature: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t('workflows.maxTokens')}</Label>
              <Input
                className="mt-1 text-xs"
                type="number"
                value={node.config.maxTokens ?? 2048}
                onChange={(e) => onUpdateConfig({ ...node.config, maxTokens: parseInt(e.target.value) || 2048 })}
              />
            </div>
          </div>
        );

      case 'skill-invoke':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('workflows.agentSelector')}</Label>
              <Select value={node.config.agentId || ''} onValueChange={(v) => onUpdateConfig({ ...node.config, agentId: v, skillId: '' })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t('workflows.selectAgent')} /></SelectTrigger>
                <SelectContent>
                  {agents.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('workflows.skillSelector')}</Label>
              <Select value={node.config.skillId || ''} onValueChange={(v) => onUpdateConfig({ ...node.config, skillId: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t('workflows.selectSkill')} /></SelectTrigger>
                <SelectContent>
                  {skills
                    .filter((s: any) => !node.config.agentId || s.agentId === node.config.agentId)
                    .map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('workflows.parameterMapping')}</Label>
              <div className="mt-1 space-y-1.5">
                {Object.entries(node.config.parameters || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <Input className="text-xs h-7" value={key} readOnly />
                    <Input className="text-xs h-7 flex-1" value={String(value)} onChange={(e) => {
                      const params = { ...node.config.parameters, [key]: e.target.value };
                      onUpdateConfig({ ...node.config, parameters: params });
                    }} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => {
                      const params = { ...node.config.parameters };
                      delete params[key];
                      onUpdateConfig({ ...node.config, parameters: params });
                    }}><X className="w-3 h-3" /></Button>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <Input className="text-xs h-7" placeholder="Key" value={paramKey} onChange={(e) => setParamKey(e.target.value)} />
                  <Input className="text-xs h-7 flex-1" placeholder="Value" value={paramValue} onChange={(e) => setParamValue(e.target.value)} />
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={!paramKey} onClick={() => {
                    onUpdateConfig({ ...node.config, parameters: { ...node.config.parameters, [paramKey]: paramValue } });
                    setParamKey(''); setParamValue('');
                  }}><Plus className="w-3 h-3" /></Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'condition':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('workflows.expression')}</Label>
              <Textarea
                className="mt-1 font-mono text-xs min-h-[60px]"
                value={node.config.expression || ''}
                onChange={(e) => onUpdateConfig({ ...node.config, expression: e.target.value })}
                placeholder="{{nodes.step1.output.status}} === 'success'"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{t('workflows.trueLabel')}</Label>
                <Input className="mt-1 text-xs" value={node.config.trueLabel || ''} onChange={(e) => onUpdateConfig({ ...node.config, trueLabel: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">{t('workflows.falseLabel')}</Label>
                <Input className="mt-1 text-xs" value={node.config.falseLabel || ''} onChange={(e) => onUpdateConfig({ ...node.config, falseLabel: e.target.value })} />
              </div>
            </div>
          </div>
        );

      case 'transform':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('workflows.template')}</Label>
              <Textarea
                className="mt-1 font-mono text-xs min-h-[80px]"
                value={node.config.template || ''}
                onChange={(e) => onUpdateConfig({ ...node.config, template: e.target.value })}
                placeholder={'{ "result": {{variable}} }'}
              />
            </div>
            <div>
              <Label className="text-xs">{t('workflows.inputPath')}</Label>
              <Input
                className="mt-1 text-xs font-mono"
                value={node.config.inputPath || ''}
                onChange={(e) => onUpdateConfig({ ...node.config, inputPath: e.target.value })}
                placeholder="$.data"
              />
            </div>
          </div>
        );

      case 'parallel':
        return (
          <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
            {t('workflows.parallelAutoDesc')}
          </div>
        );

      case 'merge':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('workflows.mergeStrategy')}</Label>
              <Select value={node.config.strategy || 'last'} onValueChange={(v) => onUpdateConfig({ ...node.config, strategy: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="last">Last</SelectItem>
                  <SelectItem value="array">Array</SelectItem>
                  <SelectItem value="merge-object">Merge Object</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'http-request':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">{t('workflows.method')}</Label>
                <Select value={node.config.method || 'GET'} onValueChange={(v) => onUpdateConfig({ ...node.config, method: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">URL</Label>
                <Input
                  className="mt-1 text-xs font-mono"
                  value={node.config.url || ''}
                  onChange={(e) => onUpdateConfig({ ...node.config, url: e.target.value })}
                  placeholder="https://api.example.com/..."
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t('workflows.headers')}</Label>
              <div className="mt-1 space-y-1.5">
                {Object.entries(node.config.headers || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <Input className="text-xs h-7" value={key} readOnly />
                    <Input className="text-xs h-7 flex-1" value={String(value)} onChange={(e) => {
                      const headers = { ...node.config.headers, [key]: e.target.value };
                      onUpdateConfig({ ...node.config, headers });
                    }} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => {
                      const headers = { ...node.config.headers };
                      delete headers[key];
                      onUpdateConfig({ ...node.config, headers });
                    }}><X className="w-3 h-3" /></Button>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <Input className="text-xs h-7" placeholder="Key" value={headerKey} onChange={(e) => setHeaderKey(e.target.value)} />
                  <Input className="text-xs h-7 flex-1" placeholder="Value" value={headerValue} onChange={(e) => setHeaderValue(e.target.value)} />
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={!headerKey} onClick={() => {
                    onUpdateConfig({ ...node.config, headers: { ...node.config.headers, [headerKey]: headerValue } });
                    setHeaderKey(''); setHeaderValue('');
                  }}><Plus className="w-3 h-3" /></Button>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs">Body</Label>
              <Textarea
                className="mt-1 font-mono text-xs min-h-[60px]"
                value={node.config.body || ''}
                onChange={(e) => onUpdateConfig({ ...node.config, body: e.target.value })}
                placeholder='{"key": "value"}'
              />
            </div>
          </div>
        );

      case 'code-exec':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('workflows.language')}</Label>
              <Select value={node.config.language || 'javascript'} onValueChange={(v) => onUpdateConfig({ ...node.config, language: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="typescript">TypeScript</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('workflows.code')}</Label>
              <Textarea
                className="mt-1 font-mono text-xs min-h-[120px]"
                value={node.config.code || ''}
                onChange={(e) => onUpdateConfig({ ...node.config, code: e.target.value })}
                placeholder="// Your code here\nreturn input;"
              />
            </div>
            <div>
              <Label className="text-xs">{t('workflows.timeout')} (ms)</Label>
              <Input
                className="mt-1 text-xs"
                type="number"
                value={node.config.timeout ?? 30000}
                onChange={(e) => onUpdateConfig({ ...node.config, timeout: parseInt(e.target.value) || 30000 })}
              />
            </div>
          </div>
        );

      case 'human-input':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('workflows.promptMessage')}</Label>
              <Textarea
                className="mt-1 text-xs min-h-[60px]"
                value={node.config.prompt || ''}
                onChange={(e) => onUpdateConfig({ ...node.config, prompt: e.target.value })}
                placeholder="Please review and respond..."
              />
            </div>
            <div>
              <Label className="text-xs">{t('workflows.timeout')} (s)</Label>
              <Input
                className="mt-1 text-xs"
                type="number"
                value={node.config.timeout ?? 300}
                onChange={(e) => onUpdateConfig({ ...node.config, timeout: parseInt(e.target.value) || 300 })}
              />
            </div>
            <div>
              <Label className="text-xs">{t('workflows.defaultResponse')}</Label>
              <Input
                className="mt-1 text-xs"
                value={node.config.defaultResponse || ''}
                onChange={(e) => onUpdateConfig({ ...node.config, defaultResponse: e.target.value })}
              />
            </div>
          </div>
        );

      case 'delay':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label className="text-xs">{t('workflows.duration')}</Label>
                <Input
                  className="mt-1 text-xs"
                  type="number"
                  value={node.config.duration ?? 1}
                  onChange={(e) => onUpdateConfig({ ...node.config, duration: parseFloat(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label className="text-xs">{t('workflows.unit')}</Label>
                <Select value={node.config.unit || 's'} onValueChange={(v) => onUpdateConfig({ ...node.config, unit: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ms">ms</SelectItem>
                    <SelectItem value="s">s</SelectItem>
                    <SelectItem value="m">m</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 'sub-workflow':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('workflows.workflowSelector')}</Label>
              <Select value={node.config.workflowId || ''} onValueChange={(v) => onUpdateConfig({ ...node.config, workflowId: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t('workflows.selectWorkflow')} /></SelectTrigger>
                <SelectContent>
                  {workflows.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'loop':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('workflows.arrayPath')}</Label>
              <Input
                className="mt-1 text-xs font-mono"
                value={node.config.arrayPath || ''}
                onChange={(e) => onUpdateConfig({ ...node.config, arrayPath: e.target.value })}
                placeholder="$.items"
              />
            </div>
            <div>
              <Label className="text-xs">{t('workflows.itemVariable')}</Label>
              <Input
                className="mt-1 text-xs font-mono"
                value={node.config.itemVariable || ''}
                onChange={(e) => onUpdateConfig({ ...node.config, itemVariable: e.target.value })}
                placeholder="item"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Node header */}
      <div className="flex items-center gap-2">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', config.bgClass)}>
          <Icon className={cn('w-4 h-4', config.textClass)} />
        </div>
        <div className="flex-1 min-w-0">
          <Input
            className="h-7 text-sm font-medium border-0 px-1 focus-visible:ring-1"
            value={node.name}
            onChange={(e) => onUpdateName(e.target.value)}
          />
          <p className={cn('text-[10px] ml-1', config.textClass)}>{config.label}</p>
        </div>
      </div>

      <Separator />

      {/* Config fields */}
      {renderFields()}

      <Separator />

      {/* Delete button */}
      <Button variant="destructive" size="sm" className="w-full" onClick={onDelete}>
        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
        {t('workflows.deleteNode')}
      </Button>
    </div>
  );
}

// ===================== NODE PALETTE =====================

interface NodePaletteProps {
  onAddNode: (type: NodeType) => void;
  collapsed: boolean;
}

function NodePalette({ onAddNode, collapsed }: NodePaletteProps) {
  const { t } = useI18n();
  const [expandedCategories, setExpandedCategories] = useState<Set<NodeCategory>>(new Set(['execution', 'control']));

  const toggleCategory = (cat: NodeCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  if (collapsed) {
    return (
      <div className="w-12 border-r border-border bg-card flex flex-col items-center py-2 gap-1">
        {NODE_CATEGORIES.map(cat => {
          const CatIcon = cat.icon;
          return (
            <Tooltip key={cat.id}>
              <TooltipTrigger asChild>
                <button className="w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  <CatIcon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{cat.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-56 border-r border-border bg-card flex flex-col">
      <div className="p-3 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('workflows.nodePalette')}</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {NODE_CATEGORIES.map(cat => {
            const isExpanded = expandedCategories.has(cat.id);
            const catNodes = Object.entries(NODE_TYPE_CONFIGS).filter(([, c]) => c.category === cat.id);
            const CatIcon = cat.icon;

            return (
              <div key={cat.id}>
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <CatIcon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                  <Badge variant="secondary" className="ml-auto text-[9px] h-4 px-1">{catNodes.length}</Badge>
                </button>
                {isExpanded && (
                  <div className="ml-2 mt-0.5 space-y-0.5">
                    {catNodes.map(([type, cfg]) => {
                      const ItemIcon = cfg.icon;
                      return (
                        <button
                          key={type}
                          onClick={() => onAddNode(type as NodeType)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-accent/50 transition-colors group"
                        >
                          <div className={cn('w-6 h-6 rounded flex items-center justify-center shrink-0', cfg.bgClass)}>
                            <ItemIcon className={cn('w-3.5 h-3.5', cfg.textClass)} />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-foreground group-hover:text-foreground truncate">{cfg.label}</p>
                          </div>
                          <Plus className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// ===================== LIST VIEW =====================

interface WorkflowListViewProps {
  workflows: Workflow[];
  onCreate: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

function WorkflowListView({ workflows, onCreate, onEdit, onDelete, onDuplicate }: WorkflowListViewProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = workflows.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'draft': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'archived': return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
      default: return '';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('workflows.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('workflows.subtitle')}</p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="w-4 h-4 mr-1.5" />
          {t('workflows.createWorkflow')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t('workflows.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Network className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">{t('workflows.noWorkflows')}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t('workflows.noWorkflowsDesc')}</p>
          <Button onClick={onCreate} variant="outline">
            <Plus className="w-4 h-4 mr-1.5" />
            {t('workflows.createWorkflow')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(wf => (
            <Card
              key={wf.id}
              className="hover:shadow-md transition-all duration-200 cursor-pointer group"
              onClick={() => onEdit(wf.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate group-hover:text-primary transition-colors">{wf.name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5 line-clamp-2">{wf.description}</CardDescription>
                  </div>
                  <Badge variant="outline" className={cn('ml-2 shrink-0 text-[10px]', statusColor(wf.status))}>
                    {wf.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Network className="w-3 h-3" />
                    {wf.nodes.length} {t('workflows.nodes')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Play className="w-3 h-3" />
                    {wf.executionCount} {t('workflows.runs')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(wf.lastRunAt)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-border/50">
                  <Button
                    variant="ghost" size="sm" className="h-7 text-xs"
                    onClick={(e) => { e.stopPropagation(); onEdit(wf.id); }}
                  >
                    <Edit3 className="w-3 h-3 mr-1" />
                    {t('common.edit')}
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-7 text-xs"
                    onClick={(e) => { e.stopPropagation(); onDuplicate(wf.id); }}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    {t('workflows.duplicate')}
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setDeleteId(wf.id); }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    {t('common.delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('workflows.deleteWorkflow')}</AlertDialogTitle>
            <AlertDialogDescription>{t('workflows.deleteWorkflowDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) onDelete(deleteId); setDeleteId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===================== EDITOR VIEW =====================

interface EditorViewProps {
  workflow: Workflow;
  onBack: () => void;
  onSave: (workflow: Workflow) => void;
  onRun: (id: string) => void;
  agents: any[];
  skills: any[];
  workflows: Workflow[];
}

function EditorView({ workflow, onBack, onSave, onRun, agents, skills, workflows }: EditorViewProps) {
  const { t } = useI18n();
  const [nodes, setNodes] = useState<WorkflowNode[]>(workflow.nodes);
  const [edges, setEdges] = useState<WorkflowEdge[]>(workflow.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState(workflow.name);
  const [workflowDescription, setWorkflowDescription] = useState(workflow.description);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | undefined>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(true);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

  // Drag state
  const dragRef = useRef<{ nodeId: string; startX: number; startY: number; nodeStartX: number; nodeStartY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);

  // Auto-save with debounce
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasChanges = useRef(false);

  const triggerAutoSave = useCallback(() => {
    hasChanges.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const updated: Workflow = {
        ...workflow,
        name: workflowName,
        description: workflowDescription,
        nodes,
        edges,
        updatedAt: new Date().toISOString(),
      };
      onSave(updated);
      hasChanges.current = false;
    }, 2000);
  }, [workflow, workflowName, workflowDescription, nodes, edges, onSave]);

  // Sync changes
  useEffect(() => { triggerAutoSave(); }, [nodes, edges, workflowName, workflowDescription, triggerAutoSave]);

  const handleAddNode = useCallback((type: NodeType) => {
    const config = NODE_TYPE_CONFIGS[type];
    const newNode: WorkflowNode = {
      id: generateId(),
      type,
      name: config.label,
      position: {
        x: 200 + Math.random() * 200 - pan.x / zoom,
        y: 100 + nodes.length * 80 - pan.y / zoom,
      },
      config: { ...config.defaultConfig },
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
    setMobilePaletteOpen(false);
  }, [nodes.length, pan, zoom]);

  const handleNodeClick = useCallback((id: string) => {
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    setConfigPanelOpen(true);
  }, []);

  const handleEdgeClick = useCallback((id: string) => {
    setSelectedEdgeId(id);
    setSelectedNodeId(null);
  }, []);

  const handleCanvasClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectingFrom(null);
  }, []);

  const handleNodeDragStart = useCallback((id: string, e: React.MouseEvent) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    dragRef.current = {
      nodeId: id,
      startX: e.clientX,
      startY: e.clientY,
      nodeStartX: node.position.x,
      nodeStartY: node.position.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = (moveEvent.clientX - dragRef.current.startX) / zoom;
      const dy = (moveEvent.clientY - dragRef.current.startY) / zoom;
      setNodes(prev => prev.map(n =>
        n.id === dragRef.current!.nodeId
          ? { ...n, position: { x: dragRef.current!.nodeStartX + dx, y: dragRef.current!.nodeStartY + dy } }
          : n
      ));
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [nodes, zoom]);

  const handleConnectTarget = useCallback((targetId: string) => {
    if (!connectingFrom || connectingFrom === targetId) {
      setConnectingFrom(null);
      return;
    }
    // Check if edge already exists
    const exists = edges.some(e => e.source === connectingFrom && e.target === targetId);
    if (!exists) {
      const newEdge: WorkflowEdge = {
        id: generateEdgeId(),
        source: connectingFrom,
        target: targetId,
      };
      setEdges(prev => [...prev, newEdge]);
    }
    setConnectingFrom(null);
  }, [connectingFrom, edges]);

  const handleUpdateNodeConfig = useCallback((config: Record<string, any>) => {
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, config } : n));
  }, [selectedNodeId]);

  const handleUpdateNodeName = useCallback((name: string) => {
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, name } : n));
  }, [selectedNodeId]);

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
    setEdges(prev => prev.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  }, [selectedNodeId]);

  const handleDeleteEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    setEdges(prev => prev.filter(e => e.id !== selectedEdgeId));
    setSelectedEdgeId(null);
  }, [selectedEdgeId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const updated: Workflow = {
        ...workflow,
        name: workflowName,
        description: workflowDescription,
        nodes,
        edges,
        updatedAt: new Date().toISOString(),
      };
      onSave(updated);
      toast.success(t('workflows.saved'));
    } finally {
      setSaving(false);
    }
  }, [workflow, workflowName, workflowDescription, nodes, edges, onSave, t]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete if focused on an input
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        if (selectedNodeId) {
          handleDeleteNode();
        } else if (selectedEdgeId) {
          handleDeleteEdge();
        }
      }
      if (e.key === 'Escape') {
        setConnectingFrom(null);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, selectedEdgeId, handleDeleteNode, handleDeleteEdge]);

  // Mouse position tracking for connecting lines
  const handleContainerMouseMove = useCallback((e: React.MouseEvent) => {
    if (!connectingFrom || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    });
  }, [connectingFrom, pan, zoom]);

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="h-12 border-b border-border bg-card flex items-center gap-2 px-3 shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-4 h-4 mr-1" />
          <span className="hidden sm:inline">{t('common.back')}</span>
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Input
            className="h-8 text-sm font-medium border-0 bg-transparent focus-visible:ring-1 max-w-[200px]"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
          />
          <Badge variant="outline" className="text-[10px] shrink-0">
            {nodes.length} {t('workflows.nodes')} · {edges.length} {t('workflows.edges')}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(z + 0.2, 2))}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('workflows.zoomIn')}</TooltipContent>
            </Tooltip>
            <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(z - 0.2, 0.3))}>
                  <MinusCircle className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('workflows.zoomOut')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('workflows.resetView')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Button
            variant="outline" size="sm" className="h-8"
            onClick={() => {
              if (selectedNodeId) {
                setConnectingFrom(selectedNodeId);
              } else {
                toast.info(t('workflows.selectNodeFirst'));
              }
            }}
            disabled={!selectedNodeId}
          >
            <GitBranch className="w-3.5 h-3.5 mr-1" />
            {t('workflows.connect')}
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={handleSave} disabled={saving}>
            <Save className="w-3.5 h-3.5 mr-1" />
            {saving ? t('common.loading') : t('common.save')}
          </Button>
          <Button size="sm" className="h-8" onClick={() => onRun(workflow.id)}>
            <Play className="w-3.5 h-3.5 mr-1" />
            {t('workflows.run')}
          </Button>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Node palette - hidden on mobile */}
        <div className="hidden md:block">
          <NodePalette onAddNode={handleAddNode} collapsed={sidebarCollapsed} />
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden bg-background" onMouseMove={handleContainerMouseMove}>
          <SvgCanvas
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            connectingFrom={connectingFrom}
            onNodeClick={handleNodeClick}
            onNodeDragStart={handleNodeDragStart}
            onCanvasClick={handleCanvasClick}
            onEdgeClick={handleEdgeClick}
            onConnectTarget={handleConnectTarget}
            mousePos={mousePos}
            zoom={zoom}
            pan={pan}
            onZoomChange={setZoom}
            onPanChange={setPan}
          />

          {/* Mobile palette toggle */}
          <div className="md:hidden absolute bottom-4 left-4">
            <Button
              variant="outline" size="sm"
              onClick={() => setMobilePaletteOpen(!mobilePaletteOpen)}
              className="shadow-lg"
            >
              <Plus className="w-4 h-4 mr-1" />
              {t('workflows.addNode')}
            </Button>
          </div>

          {/* Mobile palette dropdown */}
          {mobilePaletteOpen && (
            <div className="md:hidden absolute bottom-14 left-4 w-56 max-h-72 overflow-y-auto bg-card border border-border rounded-lg shadow-xl z-20">
              <div className="p-2 space-y-0.5">
                {Object.entries(NODE_TYPE_CONFIGS).map(([type, cfg]) => {
                  const ItemIcon = cfg.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => handleAddNode(type as NodeType)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-accent/50 transition-colors"
                    >
                      <div className={cn('w-5 h-5 rounded flex items-center justify-center', cfg.bgClass)}>
                        <ItemIcon className={cn('w-3 h-3', cfg.textClass)} />
                      </div>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Connecting indicator */}
          {connectingFrom && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-medium shadow-lg animate-pulse">
              {t('workflows.clickTarget')}
            </div>
          )}

          {/* Selected edge info */}
          {selectedEdgeId && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg shadow-lg px-4 py-2 flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{t('workflows.edgeSelected')}</span>
              <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={handleDeleteEdge}>
                <Trash2 className="w-3 h-3 mr-1" />
                {t('common.delete')}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedEdgeId(null)}>
                {t('common.cancel')}
              </Button>
            </div>
          )}
        </div>

        {/* Config panel */}
        {selectedNode && configPanelOpen && (
          <div className="w-72 border-l border-border bg-card flex flex-col shrink-0 hidden sm:flex">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('workflows.nodeConfig')}</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setConfigPanelOpen(false); setSelectedNodeId(null); }}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <NodeConfigPanel
                node={selectedNode}
                agents={agents}
                skills={skills}
                workflows={workflows}
                onUpdateConfig={handleUpdateNodeConfig}
                onUpdateName={handleUpdateNodeName}
                onDelete={handleDeleteNode}
              />
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== EXECUTION VIEW =====================

interface ExecutionViewProps {
  workflow: Workflow;
  execution: WorkflowExecution;
  onBack: () => void;
  onCancel: (id: string) => void;
}

function ExecutionView({ workflow, execution, onBack, onCancel }: ExecutionViewProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('canvas');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'running': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled': return <MinusCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-muted-foreground';
      case 'running': return 'text-blue-500';
      case 'completed': return 'text-emerald-500';
      case 'failed': return 'text-red-500';
      case 'cancelled': return 'text-muted-foreground';
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="h-12 border-b border-border bg-card flex items-center gap-2 px-3 shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('common.back')}
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium truncate">{workflow.name}</span>
          <Badge className={cn(
            'text-[10px]',
            execution.status === 'running' && 'bg-blue-500/10 text-blue-600 border-blue-500/20',
            execution.status === 'completed' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
            execution.status === 'failed' && 'bg-red-500/10 text-red-600 border-red-500/20',
          )} variant="outline">
            {statusIcon(execution.status)}
            <span className="ml-1 capitalize">{execution.status}</span>
          </Badge>
        </div>
        {execution.status === 'running' && (
          <Button variant="outline" size="sm" className="h-8 text-destructive" onClick={() => onCancel(execution.id)}>
            <Pause className="w-3.5 h-3.5 mr-1" />
            {t('workflows.cancelExecution')}
          </Button>
        )}
      </div>

      {/* Canvas with execution overlay */}
      <div className="flex-1 overflow-hidden bg-background">
        <SvgCanvas
          nodes={workflow.nodes}
          edges={workflow.edges}
          selectedNodeId={null}
          connectingFrom={null}
          nodeStates={execution.nodeStates}
          onNodeClick={() => {}}
          onNodeDragStart={() => {}}
          onCanvasClick={() => {}}
          onEdgeClick={() => {}}
          onConnectTarget={() => {}}
          zoom={zoom}
          pan={pan}
          onZoomChange={setZoom}
          onPanChange={setPan}
        />
      </div>

      {/* Bottom panel */}
      <div className="h-64 border-t border-border bg-card shrink-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-3 h-9">
            <TabsTrigger value="canvas" className="text-xs">{t('workflows.executionLog')}</TabsTrigger>
            <TabsTrigger value="variables" className="text-xs">{t('workflows.variables')}</TabsTrigger>
            <TabsTrigger value="output" className="text-xs">{t('workflows.output')}</TabsTrigger>
          </TabsList>
          <TabsContent value="canvas" className="flex-1 overflow-auto m-0">
            <ScrollArea className="h-full">
              <div className="p-3 space-y-1">
                {execution.logs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">{t('workflows.noLogs')}</p>
                ) : (
                  execution.logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs font-mono">
                      <span className="text-muted-foreground shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <Badge variant="outline" className={cn(
                        'text-[9px] h-4 px-1 shrink-0',
                        log.level === 'info' && 'border-blue-500/30 text-blue-500',
                        log.level === 'warn' && 'border-amber-500/30 text-amber-500',
                        log.level === 'error' && 'border-red-500/30 text-red-500',
                      )}>
                        {log.level.toUpperCase()}
                      </Badge>
                      {log.nodeId && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0">{log.nodeId}</Badge>
                      )}
                      <span className="text-foreground">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="variables" className="flex-1 overflow-auto m-0">
            <ScrollArea className="h-full">
              <div className="p-3">
                <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
                  {JSON.stringify(execution.variables, null, 2)}
                </pre>
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="output" className="flex-1 overflow-auto m-0">
            <ScrollArea className="h-full">
              <div className="p-3">
                {execution.output ? (
                  <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
                    {JSON.stringify(execution.output, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">{t('workflows.noOutput')}</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ===================== MAIN COMPONENT =====================

export function WorkflowEditor() {
  const { t } = useI18n();
  const { agents, skills } = useAppStore();

  const [mode, setMode] = useState<'list' | 'editor' | 'execution'>('list');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow | null>(null);
  const [currentExecution, setCurrentExecution] = useState<WorkflowExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Load workflows
  useEffect(() => {
    const loadWorkflows = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/workflows', {
          headers: {
            'Authorization': `Bearer ${api.getToken()}`,
            'x-user-id': api.getUserId() || '',
          },
        });
        if (res.ok) {
          const data = await res.json();
          setWorkflows(data.workflows || []);
        } else {
          // Fallback to mock data if API doesn't exist yet
          setWorkflows(createMockWorkflows());
        }
      } catch {
        setWorkflows(createMockWorkflows());
      } finally {
        setLoading(false);
      }
    };
    loadWorkflows();
  }, []);

  const handleCreate = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleCreateSubmit = useCallback(() => {
    if (!newName.trim()) return;
    const newWf: Workflow = {
      id: `wf-${Date.now()}`,
      name: newName.trim(),
      description: newDescription.trim(),
      nodes: [],
      edges: [],
      status: 'draft',
      lastRunAt: null,
      executionCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setWorkflows(prev => [...prev, newWf]);
    setCurrentWorkflow(newWf);
    setMode('editor');
    setNewName('');
    setNewDescription('');
    setCreateDialogOpen(false);
    toast.success(t('workflows.created'));
  }, [newName, newDescription, t]);

  const handleEdit = useCallback((id: string) => {
    const wf = workflows.find(w => w.id === id);
    if (wf) {
      setCurrentWorkflow({ ...wf });
      setMode('editor');
    }
  }, [workflows]);

  const handleDelete = useCallback((id: string) => {
    setWorkflows(prev => prev.filter(w => w.id !== id));
    toast.success(t('workflows.deleted'));
  }, [t]);

  const handleDuplicate = useCallback((id: string) => {
    const wf = workflows.find(w => w.id === id);
    if (!wf) return;
    const dup: Workflow = {
      ...wf,
      id: `wf-${Date.now()}`,
      name: `${wf.name} (Copy)`,
      status: 'draft',
      lastRunAt: null,
      executionCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setWorkflows(prev => [...prev, dup]);
    toast.success(t('workflows.duplicated'));
  }, [workflows, t]);

  const handleSave = useCallback((updated: Workflow) => {
    setWorkflows(prev => prev.map(w => w.id === updated.id ? updated : w));
    setCurrentWorkflow(updated);
    // Try to save to API
    fetch(`/api/workflows/${updated.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api.getToken()}`,
        'x-user-id': api.getUserId() || '',
      },
      body: JSON.stringify(updated),
    }).catch(() => {
      // Silently fail - data is still in local state
    });
  }, []);

  const handleRun = useCallback(async (id: string) => {
    const wf = workflows.find(w => w.id === id) || currentWorkflow;
    if (!wf) return;

    try {
      const res = await fetch(`/api/workflows/${id}/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${api.getToken()}`,
          'x-user-id': api.getUserId() || '',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentExecution(data.execution || createMockExecution(id));
      } else {
        setCurrentExecution(createMockExecution(id));
      }
    } catch {
      setCurrentExecution(createMockExecution(id));
    }

    setCurrentWorkflow(wf);
    setMode('execution');

    // Simulate execution progress
    const exec = currentExecution || createMockExecution(id);
    const nodeIds = wf.nodes.map(n => n.id);
    let currentNodeIdx = 0;

    const interval = setInterval(() => {
      setCurrentExecution(prev => {
        if (!prev) return prev;
        const newNodeStates = { ...prev.nodeStates };

        // Complete current running node
        const runningNode = Object.entries(newNodeStates).find(([, s]) => s === 'running');
        if (runningNode) {
          newNodeStates[runningNode[0]] = 'success';
        }

        // Start next node
        if (currentNodeIdx < nodeIds.length) {
          newNodeStates[nodeIds[currentNodeIdx]] = 'running';
          currentNodeIdx++;
        }

        const allDone = Object.values(newNodeStates).every(s => s !== 'running' && s !== 'pending');

        return {
          ...prev,
          nodeStates: newNodeStates,
          status: allDone ? 'completed' : 'running',
          completedAt: allDone ? new Date().toISOString() : null,
          output: allDone ? { result: 'Workflow completed successfully' } : null,
        };
      });

      if (currentNodeIdx >= nodeIds.length) {
        clearInterval(interval);
      }
    }, 1500);
  }, [workflows, currentWorkflow, currentExecution]);

  const handleCancelExecution = useCallback((id: string) => {
    setCurrentExecution(prev => prev ? { ...prev, status: 'cancelled', completedAt: new Date().toISOString() } : null);
    fetch(`/api/workflow-executions/${id}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${api.getToken()}`,
        'x-user-id': api.getUserId() || '',
      },
    }).catch(() => {});
    toast.info(t('workflows.executionCancelled'));
  }, [t]);

  const handleBack = useCallback(() => {
    if (mode === 'execution') {
      setMode('editor');
      setCurrentExecution(null);
    } else if (mode === 'editor') {
      setMode('list');
      setCurrentWorkflow(null);
    }
  }, [mode]);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 rounded bg-muted animate-pulse" />
            <div className="h-4 w-64 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-9 w-32 rounded-md bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      {mode === 'list' && (
        <WorkflowListView
          workflows={workflows}
          onCreate={handleCreate}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
        />
      )}

      {mode === 'editor' && currentWorkflow && (
        <EditorView
          workflow={currentWorkflow}
          onBack={handleBack}
          onSave={handleSave}
          onRun={handleRun}
          agents={agents}
          skills={skills}
          workflows={workflows}
        />
      )}

      {mode === 'execution' && currentWorkflow && currentExecution && (
        <ExecutionView
          workflow={currentWorkflow}
          execution={currentExecution}
          onBack={handleBack}
          onCancel={handleCancelExecution}
        />
      )}

      {/* Create Workflow Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('workflows.createWorkflow')}</DialogTitle>
            <DialogDescription>{t('workflows.createWorkflowDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('common.name')}</Label>
              <Input
                className="mt-1"
                placeholder={t('workflows.namePlaceholder')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label>{t('common.description')}</Label>
              <Textarea
                className="mt-1"
                placeholder={t('workflows.descriptionPlaceholder')}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreateSubmit} disabled={!newName.trim()}>
              <Plus className="w-4 h-4 mr-1" />
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
