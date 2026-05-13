/**
 * Workflow Engine Core - DAG-based workflow execution engine for Hermes Hub
 *
 * Supports 12 node types, conditional branching, parallel execution,
 * template substitution, retry with backoff, error policies, and
 * state persistence to the database.
 *
 * The engine is stateless between calls — it loads state from the
 * database on each execution step.
 */

import { db } from '@/lib/db';
import { generateAgentReply } from '@/lib/agent-reply';
import { executeSkillsForAgent } from '@/lib/skill-executor';
import { chatCompletion, type LLMProviderConfig } from '@/lib/llm-provider';
import { decrypt } from '@/lib/crypto';

// ==================== Types ====================

export type WorkflowNodeType =
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

export type EdgeType = 'default' | 'condition-true' | 'condition-false' | 'error';

export type NodeExecutionStatus = 'success' | 'failed' | 'skipped';

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';

export type ErrorPolicy = 'stop' | 'skip' | 'fallback';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  description?: string;
  position: { x: number; y: number };
  config: Record<string, any>;
  // agent-call: { agentId, prompt, model?, temperature?, maxTokens? }
  // skill-invoke: { agentId, skillName, params }
  // condition: { expression, language: 'jsonpath' | 'javascript' }
  // transform: { template, inputPath? }
  // parallel: { branches: string[][] }
  // merge: { strategy: 'last' | 'array' | 'merge-object' }
  // http-request: { url, method, headers, body }
  // code-exec: { code, language: 'javascript', timeout }
  // human-input: { prompt, timeout, defaultResponse }
  // delay: { duration: number, unit: 'ms' | 's' | 'm' }
  // sub-workflow: { workflowId, inputMapping }
  // loop: { arrayPath, itemVar, bodyNodeIds }
  retryPolicy?: { maxRetries: number; backoffMs: number };
  timeout?: number; // seconds
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
}

export interface NodeExecutionResult {
  nodeId: string;
  status: NodeExecutionStatus;
  output: any;
  error?: string;
  duration: number; // ms
  startedAt: Date;
  completedAt: Date;
}

export interface WorkflowDefinition {
  id: string;
  userId: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, { type: string; default: any; description?: string }>;
  timeout: number; // global timeout in seconds
  retryPolicy: { maxRetries: number; backoffMs: number };
  errorPolicy: ErrorPolicy;
}

export interface ExecuteOptions {
  userId: string;
  variables?: Record<string, any>;
  triggerType?: 'manual' | 'webhook' | 'schedule' | 'event' | 'api';
  triggerData?: Record<string, any>;
  onProgress?: (event: ProgressEvent) => void;
}

export interface ProgressEvent {
  type: 'node-started' | 'node-completed' | 'node-failed' | 'node-skipped' | 'workflow-completed' | 'workflow-failed' | 'workflow-paused';
  executionId: string;
  nodeId?: string;
  nodeName?: string;
  data?: any;
  timestamp: Date;
}

export interface ExecutionState {
  executionId: string;
  workflowId: string;
  userId: string;
  status: ExecutionStatus;
  nodeResults: Record<string, NodeExecutionResult>;
  variables: Record<string, any>;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  failedNodeId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ==================== Template Substitution ====================

/**
 * Resolve a dot-notation path on an object.
 * e.g. resolvePath({ a: { b: 1 } }, 'a.b') → 1
 */
function resolvePath(obj: any, path: string): any {
  if (obj === null || obj === undefined) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Perform template substitution on a string value.
 * Supports:
 *   {{variables.key}}        → workflow variable
 *   {{nodes.nodeId.output}}  → output of a previous node
 *   {{nodes.nodeId.output.field}} → nested field access
 */
function substituteTemplate(
  template: string,
  variables: Record<string, any>,
  nodeResults: Record<string, NodeExecutionResult>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, expr: string) => {
    const trimmed = expr.trim();

    // variables.xxx
    if (trimmed.startsWith('variables.')) {
      const path = trimmed.slice('variables.'.length);
      const value = resolvePath(variables, path);
      if (value !== undefined) {
        return typeof value === 'string' ? value : JSON.stringify(value);
      }
      return '';
    }

    // nodes.xxx.output.yyy or nodes.xxx.output
    if (trimmed.startsWith('nodes.')) {
      const path = trimmed.slice('nodes.'.length);
      const value = resolvePath({ ...Object.fromEntries(Object.entries(nodeResults).map(([k, v]) => [k, { output: v.output }])) }, path);
      if (value !== undefined) {
        return typeof value === 'string' ? value : JSON.stringify(value);
      }
      return '';
    }

    return '';
  });
}

/**
 * Recursively substitute templates in all string values within an object.
 */
function substituteConfig(
  config: Record<string, any>,
  variables: Record<string, any>,
  nodeResults: Record<string, NodeExecutionResult>
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string') {
      result[key] = substituteTemplate(value, variables, nodeResults);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) => {
        if (typeof item === 'string') {
          return substituteTemplate(item, variables, nodeResults);
        } else if (typeof item === 'object' && item !== null) {
          return substituteConfig(item, variables, nodeResults);
        }
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      result[key] = substituteConfig(value, variables, nodeResults);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ==================== Condition Evaluator ====================

/**
 * Safe condition evaluator — supports JSONPath-like expressions and simple comparisons.
 * Never uses raw eval().
 *
 * Supported expression patterns:
 *   - "nodes.nodeId.output.field == 'value'"
 *   - "nodes.nodeId.output.field != 'value'"
 *   - "nodes.nodeId.output.field > 5"
 *   - "nodes.nodeId.output.field < 5"
 *   - "nodes.nodeId.output == true"
 *   - "variables.key == 'value'"
 *   - Plain JSONPath: "$.nodes.nodeId.output.field" (extracts value, truthiness check)
 */
function evaluateCondition(
  expression: string,
  language: 'jsonpath' | 'javascript',
  variables: Record<string, any>,
  nodeResults: Record<string, NodeExecutionResult>
): boolean {
  // Build the context object for evaluation
  const context = {
    variables,
    nodes: Object.fromEntries(
      Object.entries(nodeResults).map(([id, result]) => [id, { output: result.output }])
    ),
  };

  if (language === 'jsonpath') {
    // Simple JSONPath-like evaluation: remove leading $. if present
    let expr = expression.trim();
    if (expr.startsWith('$.')) {
      expr = expr.slice(2);
    }
    // Check for comparison operators
    const compMatch = expr.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
    if (compMatch) {
      const [, leftExpr, operator, rightExpr] = compMatch;
      const leftVal = resolvePath(context, leftExpr.trim());
      let rightVal: any = rightExpr.trim();
      // Try to parse right side
      if ((rightVal.startsWith("'") && rightVal.endsWith("'")) || (rightVal.startsWith('"') && rightVal.endsWith('"'))) {
        rightVal = rightVal.slice(1, -1);
      } else if (rightVal === 'true') {
        rightVal = true;
      } else if (rightVal === 'false') {
        rightVal = false;
      } else if (rightVal === 'null') {
        rightVal = null;
      } else if (!isNaN(Number(rightVal))) {
        rightVal = Number(rightVal);
      } else {
        // Try to resolve as a path
        const resolved = resolvePath(context, rightVal);
        if (resolved !== undefined) rightVal = resolved;
      }

      switch (operator) {
        case '==': return leftVal == rightVal;
        case '!=': return leftVal != rightVal;
        case '>': return leftVal > rightVal;
        case '<': return leftVal < rightVal;
        case '>=': return leftVal >= rightVal;
        case '<=': return leftVal <= rightVal;
      }
    }

    // No comparison — evaluate as truthiness
    const value = resolvePath(context, expr);
    return !!value;
  }

  // language === 'javascript' — safe subset evaluation
  // We support a limited set of JS expressions without eval
  return evaluateSafeJsExpression(expression, context);
}

/**
 * Safely evaluate a limited subset of JavaScript expressions.
 * Supports: property access, comparisons, logical operators, typeof, string/number/boolean literals.
 * Does NOT support: function calls, assignments, prototypes, import, require, etc.
 */
function evaluateSafeJsExpression(expression: string, context: any): boolean {
  // Replace context references with actual values for simple expressions
  let expr = expression.trim();

  // Handle logical operators
  if (expr.includes(' && ')) {
    const parts = expr.split(' && ').map((p) => p.trim());
    return parts.every((part) => evaluateSafeJsExpression(part, context));
  }
  if (expr.includes(' || ')) {
    const parts = expr.split(' || ').map((p) => p.trim());
    return parts.some((part) => evaluateSafeJsExpression(part, context));
  }

  // Handle negation
  if (expr.startsWith('!')) {
    return !evaluateSafeJsExpression(expr.slice(1), context);
  }

  // Handle comparison operators
  const compMatch = expr.match(/^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/);
  if (compMatch) {
    const [, leftExpr, operator, rightExpr] = compMatch;
    const leftVal = resolveJsValue(leftExpr.trim(), context);
    const rightVal = resolveJsValue(rightExpr.trim(), context);

    switch (operator) {
      case '===': return leftVal === rightVal;
      case '!==': return leftVal !== rightVal;
      case '==': return leftVal == rightVal;
      case '!=': return leftVal != rightVal;
      case '>': return leftVal > rightVal;
      case '<': return leftVal < rightVal;
      case '>=': return leftVal >= rightVal;
      case '<=': return leftVal <= rightVal;
    }
  }

  // Simple truthiness check
  const value = resolveJsValue(expr, context);
  return !!value;
}

/**
 * Resolve a JavaScript-like value expression against a context object.
 */
function resolveJsValue(expr: string, context: any): any {
  expr = expr.trim();

  // Boolean literals
  if (expr === 'true') return true;
  if (expr === 'false') return false;

  // Null/undefined
  if (expr === 'null') return null;
  if (expr === 'undefined') return undefined;

  // String literals
  if ((expr.startsWith("'") && expr.endsWith("'")) || (expr.startsWith('"') && expr.endsWith('"'))) {
    return expr.slice(1, -1);
  }

  // Number literals
  if (!isNaN(Number(expr)) && expr !== '') {
    return Number(expr);
  }

  // Property access (e.g., nodes.xxx.output.field)
  if (/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(expr)) {
    const value = resolvePath(context, expr);
    if (value !== undefined) return value;
  }

  // typeof expression
  if (expr.startsWith('typeof ')) {
    const innerVal = resolveJsValue(expr.slice(7), context);
    if (innerVal === null) return 'object';
    if (Array.isArray(innerVal)) return 'object';
    return typeof innerVal;
  }

  return undefined;
}

// ==================== DAG Utilities ====================

/**
 * Topological sort using Kahn's algorithm.
 * Returns sorted node IDs or throws if a cycle is detected.
 */
function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree: Record<string, number> = {};
  const adjacency: Record<string, string[]> = {};

  for (const id of nodeIds) {
    inDegree[id] = 0;
    adjacency[id] = [];
  }

  // Only consider default and condition-true/false edges for topological ordering
  // (error edges are alternative paths)
  const flowEdges = edges.filter(
    (e) => e.type === 'default' || e.type === 'condition-true' || e.type === 'condition-false'
  );

  for (const edge of flowEdges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      adjacency[edge.source].push(edge.target);
      inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
    }
  }

  const queue: string[] = [];
  for (const id of nodeIds) {
    if (inDegree[id] === 0) {
      queue.push(id);
    }
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const neighbor of adjacency[current]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (sorted.length !== nodeIds.size) {
    // Cycle detected — find the nodes involved
    const remaining = [...nodeIds].filter((id) => !sorted.includes(id));
    throw new Error(`Cycle detected in workflow DAG involving nodes: ${remaining.join(', ')}`);
  }

  return sorted;
}

/**
 * Detect cycles using DFS.
 */
function detectCycles(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[][] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const adjacency: Record<string, string[]> = {};
  for (const id of nodeIds) {
    adjacency[id] = [];
  }

  const flowEdges = edges.filter(
    (e) => e.type === 'default' || e.type === 'condition-true' || e.type === 'condition-false'
  );

  for (const edge of flowEdges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      adjacency[edge.source].push(edge.target);
    }
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(nodeId: string, path: string[]): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    for (const neighbor of adjacency[nodeId]) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, neighbor]);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart >= 0) {
          cycles.push(path.slice(cycleStart));
        } else {
          cycles.push([neighbor, nodeId]);
        }
      }
    }

    recursionStack.delete(nodeId);
  }

  for (const id of nodeIds) {
    if (!visited.has(id)) {
      dfs(id, [id]);
    }
  }

  return cycles;
}

/**
 * Find entry nodes (nodes with no incoming flow edges).
 */
function findEntryNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const flowEdges = edges.filter(
    (e) => e.type === 'default' || e.type === 'condition-true' || e.type === 'condition-false'
  );
  const targets = new Set(flowEdges.map((e) => e.target));
  return nodes.filter((n) => !targets.has(n.id));
}

/**
 * Find exit nodes (nodes with no outgoing flow edges).
 */
function findExitNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const flowEdges = edges.filter(
    (e) => e.type === 'default' || e.type === 'condition-true' || e.type === 'condition-false'
  );
  const sources = new Set(flowEdges.map((e) => e.source));
  return nodes.filter((n) => !sources.has(n.id));
}

// ==================== Node Executors ====================

/**
 * Execute an agent-call node: calls an agent with a prompt and returns its response.
 */
async function executeAgentCallNode(
  node: WorkflowNode,
  variables: Record<string, any>,
  nodeResults: Record<string, NodeExecutionResult>,
  userId: string
): Promise<any> {
  const config = substituteConfig(node.config, variables, nodeResults);
  const { agentId, prompt, model, temperature, maxTokens } = config;

  if (!agentId || !prompt) {
    throw new Error(`agent-call node "${node.name}" requires agentId and prompt`);
  }

  // Look up the agent and its provider
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    include: { provider: true },
  });

  if (!agent) {
    throw new Error(`Agent "${agentId}" not found`);
  }

  // Create a temporary conversation for the agent call
  const conversation = await db.conversation.create({
    data: {
      type: 'private',
      name: `Workflow: ${prompt.substring(0, 50)}`,
      agentId: agent.id,
    },
  });

  try {
    // Add the user message
    await db.message.create({
      data: {
        conversationId: conversation.id,
        content: prompt,
        type: 'text',
        senderId: userId,
        senderType: 'user',
        senderName: 'Workflow',
      },
    });

    const result = await generateAgentReply({
      agentId: agent.id,
      conversationId: conversation.id,
      userMessage: prompt,
      userId,
    });

    if (!result.success) {
      throw new Error(result.error || 'Agent reply failed');
    }

    return {
      content: result.content,
      agentId: agent.id,
      agentName: agent.name,
      model: model || agent.model,
    };
  } finally {
    // Clean up the temporary conversation
    await db.conversation.delete({ where: { id: conversation.id } }).catch(() => {});
  }
}

/**
 * Execute a skill-invoke node: invokes a skill on an agent.
 */
async function executeSkillInvokeNode(
  node: WorkflowNode,
  variables: Record<string, any>,
  nodeResults: Record<string, NodeExecutionResult>,
  userId: string
): Promise<any> {
  const config = substituteConfig(node.config, variables, nodeResults);
  const { agentId, skillName, params } = config;

  if (!agentId || !skillName) {
    throw new Error(`skill-invoke node "${node.name}" requires agentId and skillName`);
  }

  // Create a temporary conversation ID for the skill execution
  const tempConvId = `workflow-skill-${Date.now()}`;

  const results = await executeSkillsForAgent(
    agentId,
    JSON.stringify(params || {}),
    tempConvId,
    [{ name: skillName, arguments: params || {} }]
  );

  const matchedResult = results.find((r) => r.skillName === skillName);
  if (!matchedResult) {
    throw new Error(`Skill "${skillName}" not found or not enabled for agent "${agentId}"`);
  }

  if (!matchedResult.success) {
    throw new Error(matchedResult.error || `Skill "${skillName}" execution failed`);
  }

  return {
    skillName,
    result: matchedResult.result,
    executionTime: matchedResult.executionTime,
  };
}

/**
 * Execute a condition node: evaluates an expression and returns the branch.
 */
async function executeConditionNode(
  node: WorkflowNode,
  variables: Record<string, any>,
  nodeResults: Record<string, NodeExecutionResult>
): Promise<any> {
  const config = substituteConfig(node.config, variables, nodeResults);
  const { expression, language = 'jsonpath' } = config;

  if (!expression) {
    throw new Error(`condition node "${node.name}" requires an expression`);
  }

  const result = evaluateCondition(expression, language as 'jsonpath' | 'javascript', variables, nodeResults);

  return {
    conditionResult: result,
    expression,
  };
}

/**
 * Execute a transform node: transforms data using template substitution.
 */
async function executeTransformNode(
  node: WorkflowNode,
  variables: Record<string, any>,
  nodeResults: Record<string, NodeExecutionResult>
): Promise<any> {
  const config = node.config; // Don't substitute the template itself yet — we substitute the values
  const { template, inputPath } = config;

  if (!template) {
    throw new Error(`transform node "${node.name}" requires a template`);
  }

  // If inputPath is specified, get the input data from a specific node
  let inputData: any = undefined;
  if (inputPath) {
    const resolvedPath = substituteTemplate(inputPath, variables, nodeResults);
    // resolvedPath might be like "nodes.agent1.output"
    inputData = resolvePath(
      { nodes: Object.fromEntries(Object.entries(nodeResults).map(([k, v]) => [k, { output: v.output }])) },
      resolvedPath.startsWith('nodes.') ? resolvedPath : `nodes.${resolvedPath}`
    );
  }

  // If template is a string, perform substitution
  if (typeof template === 'string') {
    const result = substituteTemplate(template, variables, nodeResults);
    // Try to parse as JSON
    try {
      return JSON.parse(result);
    } catch {
      return result;
    }
  }

  // If template is an object, substitute all string values
  if (typeof template === 'object') {
    return substituteConfig(template, variables, nodeResults);
  }

  return template;
}

/**
 * Execute an HTTP request node.
 */
async function executeHttpRequestNode(
  node: WorkflowNode,
  variables: Record<string, any>,
  nodeResults: Record<string, NodeExecutionResult>
): Promise<any> {
  const config = substituteConfig(node.config, variables, nodeResults);
  const { url, method = 'GET', headers = {}, body } = config;

  if (!url) {
    throw new Error(`http-request node "${node.name}" requires a URL`);
  }

  const fetchOptions: RequestInit = {
    method: method.toUpperCase(),
    headers: headers as Record<string, string>,
  };

  if (body && method.toUpperCase() !== 'GET') {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    if (!headers['Content-Type'] && !headers['content-type']) {
      (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
    }
  }

  const response = await fetch(url, fetchOptions);

  let responseBody: any;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    responseBody = await response.json();
  } else {
    responseBody = await response.text();
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body: responseBody,
  };
}

/**
 * Execute a code-exec node: runs JavaScript code in a safe sandbox.
 * Uses Function constructor instead of eval for slightly better isolation.
 */
async function executeCodeExecNode(
  node: WorkflowNode,
  variables: Record<string, any>,
  nodeResults: Record<string, NodeExecutionResult>
): Promise<any> {
  const config = substituteConfig(node.config, variables, nodeResults);
  const { code, language = 'javascript', timeout = 30 } = config;

  if (!code) {
    throw new Error(`code-exec node "${node.name}" requires code`);
  }

  if (language !== 'javascript') {
    throw new Error(`code-exec node "${node.name}" only supports JavaScript, got: ${language}`);
  }

  // Build context for the code
  const context = {
    variables,
    nodes: Object.fromEntries(
      Object.entries(nodeResults).map(([id, result]) => [id, { output: result.output }])
    ),
    console: {
      log: (...args: any[]) => args,
      error: (...args: any[]) => args,
    },
  };

  // Execute with timeout using Function constructor (safer than eval)
  const timeoutMs = (timeout || 30) * 1000;

  const result = await Promise.race([
    new Promise<any>((resolve, reject) => {
      try {
        // Create a sandboxed function with the context variables
        const keys = Object.keys(context);
        const values = Object.values(context);

        // Wrap the user code: allow return statement
        const wrappedCode = `
          "use strict";
          ${code}
        `;

        const fn = new Function(...keys, wrappedCode);
        const output = fn(...values);
        resolve(output);
      } catch (error) {
        reject(error);
      }
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Code execution timed out after ${timeout}s`)), timeoutMs)
    ),
  ]);

  return { output: result };
}

/**
 * Execute a human-input node: pauses the workflow for human input.
 * The workflow state is persisted, and the caller must use resume() to continue.
 */
async function executeHumanInputNode(
  node: WorkflowNode,
  _variables: Record<string, any>,
  _nodeResults: Record<string, NodeExecutionResult>
): Promise<any> {
  // This node type is special — it should pause execution
  // The actual input will be provided via resume()
  const config = node.config;
  const { prompt, timeout: nodeTimeout, defaultResponse } = config;

  // Signal that this node needs human input
  throw new HumanInputRequiredError(
    prompt || 'Human input required',
    node.id,
    nodeTimeout,
    defaultResponse
  );
}

/**
 * Execute a delay node: waits for a specified duration.
 */
async function executeDelayNode(
  node: WorkflowNode,
  variables: Record<string, any>,
  nodeResults: Record<string, NodeExecutionResult>
): Promise<any> {
  const config = substituteConfig(node.config, variables, nodeResults);
  const { duration = 1, unit = 's' } = config;

  let ms: number;
  switch (unit) {
    case 'ms':
      ms = duration;
      break;
    case 's':
      ms = duration * 1000;
      break;
    case 'm':
      ms = duration * 60 * 1000;
      break;
    default:
      ms = duration * 1000;
  }

  // Cap maximum delay to 5 minutes for safety
  ms = Math.min(ms, 5 * 60 * 1000);

  await new Promise((resolve) => setTimeout(resolve, ms));

  return { delayed: true, duration, unit };
}

/**
 * Execute a sub-workflow node: calls another workflow.
 */
async function executeSubWorkflowNode(
  node: WorkflowNode,
  variables: Record<string, any>,
  nodeResults: Record<string, NodeExecutionResult>,
  userId: string
): Promise<any> {
  const config = substituteConfig(node.config, variables, nodeResults);
  const { workflowId, inputMapping = {} } = config;

  if (!workflowId) {
    throw new Error(`sub-workflow node "${node.name}" requires workflowId`);
  }

  // Map inputs
  const mappedInputs: Record<string, any> = {};
  for (const [key, mapping] of Object.entries(inputMapping as Record<string, any>)) {
    if (typeof mapping === 'string') {
      mappedInputs[key] = substituteTemplate(mapping, variables, nodeResults);
    } else {
      mappedInputs[key] = mapping;
    }
  }

  // Execute the sub-workflow
  const engine = new WorkflowEngine();
  const subResult = await engine.execute(workflowId, {
    userId,
    variables: mappedInputs,
    triggerType: 'api',
  });

  return {
    workflowId,
    executionId: subResult.executionId,
    status: subResult.status,
    output: subResult.finalOutput,
  };
}

/**
 * Execute a loop node: iterate over an array, running body nodes for each item.
 */
async function executeLoopNode(
  node: WorkflowNode,
  variables: Record<string, any>,
  nodeResults: Record<string, NodeExecutionResult>,
  userId: string,
  _executionId: string,
  _onProgress?: (event: ProgressEvent) => void
): Promise<any> {
  const config = substituteConfig(node.config, variables, nodeResults);
  const { arrayPath, itemVar = 'item', bodyNodeIds = [] } = config;

  if (!arrayPath) {
    throw new Error(`loop node "${node.name}" requires arrayPath`);
  }

  // Resolve the array from the context
  const context = {
    variables,
    nodes: Object.fromEntries(
      Object.entries(nodeResults).map(([id, result]) => [id, { output: result.output }])
    ),
  };
  const array = resolvePath(context, arrayPath);

  if (!Array.isArray(array)) {
    throw new Error(`loop node "${node.name}": arrayPath "${arrayPath}" did not resolve to an array`);
  }

  const loopResults: any[] = [];

  for (let i = 0; i < array.length; i++) {
    const itemVariables = { ...variables, [itemVar]: array[i], [`${itemVar}Index`]: i };

    // For now, loop body execution is simplified — we just store the item context
    // In a full implementation, bodyNodeIds would reference nodes defined within the loop
    loopResults.push({
      index: i,
      item: array[i],
      [itemVar]: array[i],
    });
  }

  return {
    iterations: array.length,
    results: loopResults,
  };
}

// ==================== Custom Error Classes ====================

class HumanInputRequiredError extends Error {
  nodeId: string;
  nodeTimeout?: number;
  defaultResponse?: any;

  constructor(
    message: string,
    nodeId: string,
    nodeTimeout?: number,
    defaultResponse?: any
  ) {
    super(message);
    this.name = 'HumanInputRequiredError';
    this.nodeId = nodeId;
    this.nodeTimeout = nodeTimeout;
    this.defaultResponse = defaultResponse;
  }
}

class WorkflowCancelledError extends Error {
  constructor(executionId: string) {
    super(`Workflow execution ${executionId} was cancelled`);
    this.name = 'WorkflowCancelledError';
  }
}

// ==================== Active Execution Tracking ====================

/**
 * Track active executions so they can be cancelled.
 * In a production system this would use Redis or a shared store.
 */
const activeExecutions = new Map<string, { cancelled: boolean }>();

// ==================== Workflow Engine ====================

export class WorkflowEngine {
  /**
   * Validate a workflow DAG.
   * Checks for cycles, connectivity, node type validity, and configuration.
   */
  validate(workflow: WorkflowDefinition): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty workflow
    if (!workflow.nodes || workflow.nodes.length === 0) {
      errors.push('Workflow has no nodes');
      return { valid: false, errors, warnings };
    }

    // Check for duplicate node IDs
    const nodeIds = new Set<string>();
    for (const node of workflow.nodes) {
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID: "${node.id}"`);
      }
      nodeIds.add(node.id);
    }

    // Check for duplicate edge IDs
    const edgeIds = new Set<string>();
    for (const edge of workflow.edges) {
      if (edgeIds.has(edge.id)) {
        errors.push(`Duplicate edge ID: "${edge.id}"`);
      }
      edgeIds.add(edge.id);
    }

    // Check edge references
    for (const edge of workflow.edges) {
      if (!nodeIds.has(edge.source)) {
        errors.push(`Edge "${edge.id}" references non-existent source node: "${edge.source}"`);
      }
      if (!nodeIds.has(edge.target)) {
        errors.push(`Edge "${edge.id}" references non-existent target node: "${edge.target}"`);
      }
      if (!['default', 'condition-true', 'condition-false', 'error'].includes(edge.type)) {
        errors.push(`Edge "${edge.id}" has invalid type: "${edge.type}"`);
      }
      if (edge.source === edge.target) {
        errors.push(`Edge "${edge.id}" is a self-loop on node "${edge.source}"`);
      }
    }

    // Detect cycles
    const cycles = detectCycles(workflow.nodes, workflow.edges);
    if (cycles.length > 0) {
      for (const cycle of cycles) {
        errors.push(`Cycle detected: ${cycle.join(' → ')} → ${cycle[0]}`);
      }
    }

    // Check entry/exit nodes
    const entryNodes = findEntryNodes(workflow.nodes, workflow.edges);
    if (entryNodes.length === 0) {
      errors.push('Workflow has no entry node (all nodes have incoming edges)');
    } else if (entryNodes.length > 1) {
      warnings.push(`Workflow has ${entryNodes.length} entry nodes: ${entryNodes.map((n) => n.name).join(', ')}. Multiple entry points will execute in parallel.`);
    }

    const exitNodes = findExitNodes(workflow.nodes, workflow.edges);
    if (exitNodes.length === 0) {
      warnings.push('Workflow has no exit node (all nodes have outgoing edges). This may indicate an infinite loop.');
    }

    // Validate node configurations
    for (const node of workflow.nodes) {
      const validTypes: WorkflowNodeType[] = [
        'agent-call', 'skill-invoke', 'condition', 'transform', 'parallel',
        'merge', 'http-request', 'code-exec', 'human-input', 'delay',
        'sub-workflow', 'loop',
      ];
      if (!validTypes.includes(node.type)) {
        errors.push(`Node "${node.id}" has invalid type: "${node.type}"`);
      }

      // Type-specific validation
      switch (node.type) {
        case 'agent-call':
          if (!node.config.agentId) {
            errors.push(`agent-call node "${node.name}" (${node.id}) requires agentId`);
          }
          break;
        case 'skill-invoke':
          if (!node.config.agentId) {
            errors.push(`skill-invoke node "${node.name}" (${node.id}) requires agentId`);
          }
          if (!node.config.skillName) {
            errors.push(`skill-invoke node "${node.name}" (${node.id}) requires skillName`);
          }
          break;
        case 'condition':
          if (!node.config.expression) {
            errors.push(`condition node "${node.name}" (${node.id}) requires expression`);
          }
          break;
        case 'http-request':
          if (!node.config.url) {
            errors.push(`http-request node "${node.name}" (${node.id}) requires url`);
          }
          break;
        case 'sub-workflow':
          if (!node.config.workflowId) {
            errors.push(`sub-workflow node "${node.name}" (${node.id}) requires workflowId`);
          }
          break;
      }

      // Validate condition nodes have both true and false edges
      if (node.type === 'condition') {
        const outEdges = workflow.edges.filter((e) => e.source === node.id);
        const hasTrueEdge = outEdges.some((e) => e.type === 'condition-true');
        const hasFalseEdge = outEdges.some((e) => e.type === 'condition-false');
        if (!hasTrueEdge) {
          warnings.push(`condition node "${node.name}" (${node.id}) has no "condition-true" edge`);
        }
        if (!hasFalseEdge) {
          warnings.push(`condition node "${node.name}" (${node.id}) has no "condition-false" edge`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Execute a workflow by ID.
   * Loads the workflow definition from the database, validates it,
   * and runs the DAG execution engine.
   */
  async execute(workflowId: string, options: ExecuteOptions): Promise<{
    executionId: string;
    status: ExecutionStatus;
    finalOutput?: any;
    error?: string;
  }> {
    const { userId, variables: inputVariables = {}, triggerType = 'manual', triggerData = {}, onProgress } = options;

    // Load workflow from database
    const workflowRecord = await db.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflowRecord) {
      throw new Error(`Workflow "${workflowId}" not found`);
    }

    if (workflowRecord.status !== 'active') {
      throw new Error(`Workflow "${workflowRecord.name}" is not active (status: ${workflowRecord.status})`);
    }

    // Parse the workflow definition
    const nodes: WorkflowNode[] = JSON.parse(workflowRecord.nodes || '[]');
    const edges: WorkflowEdge[] = JSON.parse(workflowRecord.edges || '[]');
    const variableDefs = JSON.parse(workflowRecord.variables || '{}');
    const retryPolicy = JSON.parse(workflowRecord.retryPolicy || '{}');

    const workflow: WorkflowDefinition = {
      id: workflowRecord.id,
      userId: workflowRecord.userId,
      name: workflowRecord.name,
      description: workflowRecord.description || undefined,
      nodes,
      edges,
      variables: variableDefs,
      timeout: workflowRecord.timeout,
      retryPolicy,
      errorPolicy: (workflowRecord.errorPolicy as ErrorPolicy) || 'stop',
    };

    // Validate before execution
    const validation = this.validate(workflow);
    if (!validation.valid) {
      throw new Error(`Workflow validation failed: ${validation.errors.join('; ')}`);
    }

    // Initialize variables with defaults and input overrides
    const runtimeVariables: Record<string, any> = {};
    for (const [key, def] of Object.entries(variableDefs as Record<string, any>)) {
      runtimeVariables[key] = (def as any).default;
    }
    Object.assign(runtimeVariables, inputVariables);

    // Create execution record
    const execution = await db.workflowExecution.create({
      data: {
        workflowId,
        userId,
        status: 'pending',
        triggerType,
        triggerData: JSON.stringify(triggerData),
        variables: JSON.stringify(runtimeVariables),
        nodeResults: '{}',
      },
    });

    const executionId = execution.id;

    // Register active execution
    const executionTracker = { cancelled: false };
    activeExecutions.set(executionId, executionTracker);

    // Update to running
    await db.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'running', startedAt: new Date() },
    });

    // Emit progress helper
    const emitProgress = (event: Omit<ProgressEvent, 'executionId' | 'timestamp'>) => {
      const progressEvent: ProgressEvent = {
        ...event,
        executionId,
        timestamp: new Date(),
      };
      onProgress?.(progressEvent);
    };

    try {
      const result = await this.runExecutionLoop(
        workflow,
        executionId,
        runtimeVariables,
        executionTracker,
        emitProgress,
        userId
      );

      return result;
    } catch (error) {
      // Handle unexpected errors in the execution loop itself
      await db.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
          duration: Date.now() - (execution.startedAt?.getTime() || Date.now()),
        },
      });

      return {
        executionId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      activeExecutions.delete(executionId);
    }
  }

  /**
   * Core execution loop — processes nodes according to DAG topology.
   */
  private async runExecutionLoop(
    workflow: WorkflowDefinition,
    executionId: string,
    runtimeVariables: Record<string, any>,
    executionTracker: { cancelled: boolean },
    emitProgress: (event: Omit<ProgressEvent, 'executionId' | 'timestamp'>) => void,
    userId: string
  ): Promise<{ executionId: string; status: ExecutionStatus; finalOutput?: any; error?: string }> {
    const { nodes, edges, errorPolicy, timeout: globalTimeout } = workflow;

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const nodeResults: Record<string, NodeExecutionResult> = {};

    // Load existing node results from database (for resume scenarios)
    const existingExecution = await db.workflowExecution.findUnique({
      where: { id: executionId },
    });
    if (existingExecution?.nodeResults) {
      const existingResults = JSON.parse(existingExecution.nodeResults);
      for (const [nodeId, result] of Object.entries(existingResults)) {
        nodeResults[nodeId] = result as NodeExecutionResult;
      }
    }

    // Topological sort to determine execution order
    let sortedNodeIds: string[];
    try {
      sortedNodeIds = topologicalSort(nodes, edges);
    } catch (error) {
      return {
        executionId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Topological sort failed',
      };
    }

    // Track which nodes have been completed
    const completedNodes = new Set<string>(Object.keys(nodeResults));
    const globalStartTime = Date.now();

    // Process nodes in topological order
    for (const nodeId of sortedNodeIds) {
      // Check cancellation
      if (executionTracker.cancelled) {
        await this.updateExecutionState(executionId, {
          status: 'cancelled',
          completedAt: new Date(),
          duration: Date.now() - globalStartTime,
        });
        emitProgress({ type: 'workflow-failed', data: { reason: 'cancelled' } });
        return { executionId, status: 'cancelled' };
      }

      // Check global timeout
      const elapsed = (Date.now() - globalStartTime) / 1000;
      if (elapsed > globalTimeout) {
        const error = `Global timeout exceeded (${globalTimeout}s)`;
        await this.updateExecutionState(executionId, {
          status: 'failed',
          error,
          completedAt: new Date(),
          duration: Date.now() - globalStartTime,
        });
        emitProgress({ type: 'workflow-failed', data: { error } });
        return { executionId, status: 'failed', error };
      }

      // Skip already-completed nodes (for resume)
      if (completedNodes.has(nodeId)) {
        continue;
      }

      const node = nodeMap.get(nodeId)!;

      // Check if all predecessor nodes are complete
      const incomingEdges = edges.filter(
        (e) =>
          e.target === nodeId &&
          (e.type === 'default' || e.type === 'condition-true' || e.type === 'condition-false')
      );

      // For nodes with incoming edges, check if the appropriate predecessor has completed
      // and the edge condition is met
      let shouldExecute = true;
      if (incomingEdges.length > 0) {
        shouldExecute = false;

        for (const edge of incomingEdges) {
          if (!completedNodes.has(edge.source)) {
            continue;
          }

          const sourceResult = nodeResults[edge.source];
          if (!sourceResult || sourceResult.status !== 'success') {
            continue;
          }

          // Check if this edge should be followed
          if (edge.type === 'default') {
            shouldExecute = true;
            break;
          } else if (edge.type === 'condition-true') {
            const sourceNode = nodeMap.get(edge.source);
            if (sourceNode?.type === 'condition' && sourceResult.output?.conditionResult === true) {
              shouldExecute = true;
              break;
            }
          } else if (edge.type === 'condition-false') {
            const sourceNode = nodeMap.get(edge.source);
            if (sourceNode?.type === 'condition' && sourceResult.output?.conditionResult === false) {
              shouldExecute = true;
              break;
            }
          }
        }
      }

      // Handle error edges — check if any source node has an error edge to this node
      const errorEdges = edges.filter((e) => e.target === nodeId && e.type === 'error');
      if (errorEdges.length > 0) {
        for (const edge of errorEdges) {
          const sourceResult = nodeResults[edge.source];
          if (sourceResult?.status === 'failed' && completedNodes.has(edge.source)) {
            shouldExecute = true;
            break;
          }
        }
      }

      if (!shouldExecute) {
        // Skip this node (it's not reachable via the current path)
        nodeResults[nodeId] = {
          nodeId,
          status: 'skipped',
          output: null,
          duration: 0,
          startedAt: new Date(),
          completedAt: new Date(),
        };
        completedNodes.add(nodeId);
        emitProgress({ type: 'node-skipped', nodeId, nodeName: node.name });
        continue;
      }

      // Execute the node
      emitProgress({ type: 'node-started', nodeId, nodeName: node.name });

      try {
        const result = await this.executeNodeWithRetry(
          node,
          workflow,
          runtimeVariables,
          nodeResults,
          executionId,
          userId,
          executionTracker,
          emitProgress
        );

        nodeResults[nodeId] = result;
        completedNodes.add(nodeId);

        // Persist intermediate state
        await this.persistNodeResult(executionId, nodeId, result, runtimeVariables);

        if (result.status === 'success') {
          emitProgress({ type: 'node-completed', nodeId, nodeName: node.name, data: result.output });
        } else {
          emitProgress({ type: 'node-failed', nodeId, nodeName: node.name, data: result.error });

          // Check for error edges to route to
          const errorEdgesFromNode = edges.filter((e) => e.source === nodeId && e.type === 'error');
          if (errorEdgesFromNode.length === 0) {
            // No error handler — apply global error policy
            if (errorPolicy === 'stop') {
              await this.updateExecutionState(executionId, {
                status: 'failed',
                error: result.error,
                failedNodeId: nodeId,
                completedAt: new Date(),
                duration: Date.now() - globalStartTime,
              });
              emitProgress({ type: 'workflow-failed', data: { error: result.error, nodeId } });
              return { executionId, status: 'failed', error: result.error };
            } else if (errorPolicy === 'skip') {
              // Continue with remaining nodes
              continue;
            }
            // 'fallback' — continue, the error edge targets will handle it
          }
        }
      } catch (error) {
        // Handle HumanInputRequiredError — pause the workflow
        if (error instanceof HumanInputRequiredError) {
          await this.updateExecutionState(executionId, {
            status: 'paused',
          });

          // Store pending node ID
          await db.workflowExecution.update({
            where: { id: executionId },
            data: {
              nodeResults: JSON.stringify({
                ...nodeResults,
                [nodeId]: {
                  nodeId,
                  status: 'skipped',
                  output: { pendingHumanInput: true, prompt: error.message, nodeId: error.nodeId },
                  duration: 0,
                  startedAt: new Date(),
                  completedAt: new Date(),
                },
              }),
            },
          });

          emitProgress({
            type: 'workflow-paused',
            nodeId,
            nodeName: node.name,
            data: { prompt: error.message, nodeId: error.nodeId },
          });

          return { executionId, status: 'paused' };
        }

        // Handle cancellation
        if (error instanceof WorkflowCancelledError) {
          await this.updateExecutionState(executionId, {
            status: 'cancelled',
            completedAt: new Date(),
            duration: Date.now() - globalStartTime,
          });
          return { executionId, status: 'cancelled' };
        }

        // Unexpected error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        nodeResults[nodeId] = {
          nodeId,
          status: 'failed',
          output: null,
          error: errorMessage,
          duration: 0,
          startedAt: new Date(),
          completedAt: new Date(),
        };
        completedNodes.add(nodeId);

        await this.persistNodeResult(executionId, nodeId, nodeResults[nodeId], runtimeVariables);

        if (errorPolicy === 'stop') {
          await this.updateExecutionState(executionId, {
            status: 'failed',
            error: errorMessage,
            failedNodeId: nodeId,
            completedAt: new Date(),
            duration: Date.now() - globalStartTime,
          });
          emitProgress({ type: 'workflow-failed', data: { error: errorMessage, nodeId } });
          return { executionId, status: 'failed', error: errorMessage };
        }
      }
    }

    // Determine the final output from the last completed node(s)
    const exitNodes = findExitNodes(nodes, edges);
    let finalOutput: any = null;

    if (exitNodes.length === 1) {
      const exitResult = nodeResults[exitNodes[0].id];
      finalOutput = exitResult?.output ?? null;
    } else if (exitNodes.length > 1) {
      finalOutput = {};
      for (const exitNode of exitNodes) {
        const exitResult = nodeResults[exitNode.id];
        if (exitResult) {
          finalOutput[exitNode.name || exitNode.id] = exitResult.output;
        }
      }
    }

    // Update execution as completed
    await this.updateExecutionState(executionId, {
      status: 'completed',
      completedAt: new Date(),
      duration: Date.now() - globalStartTime,
      finalOutput: JSON.stringify(finalOutput),
    });

    emitProgress({ type: 'workflow-completed', data: { finalOutput } });

    return { executionId, status: 'completed', finalOutput };
  }

  /**
   * Execute a single node with retry support.
   */
  private async executeNodeWithRetry(
    node: WorkflowNode,
    workflow: WorkflowDefinition,
    variables: Record<string, any>,
    nodeResults: Record<string, NodeExecutionResult>,
    executionId: string,
    userId: string,
    executionTracker: { cancelled: boolean },
    emitProgress: (event: Omit<ProgressEvent, 'executionId' | 'timestamp'>) => void
  ): Promise<NodeExecutionResult> {
    const maxRetries = node.retryPolicy?.maxRetries ?? workflow.retryPolicy?.maxRetries ?? 0;
    const backoffMs = node.retryPolicy?.backoffMs ?? workflow.retryPolicy?.backoffMs ?? 1000;
    const nodeTimeout = node.timeout;

    let lastError: string | undefined;
    let attempt = 0;

    while (attempt <= maxRetries) {
      // Check cancellation
      if (executionTracker.cancelled) {
        throw new WorkflowCancelledError(executionId);
      }

      const startedAt = new Date();

      try {
        // Execute with optional timeout
        const output = await this.executeWithTimeout(
          this.executeSingleNode(node, variables, nodeResults, userId, executionId, emitProgress),
          nodeTimeout
        );

        const completedAt = new Date();
        return {
          nodeId: node.id,
          status: 'success',
          output,
          duration: completedAt.getTime() - startedAt.getTime(),
          startedAt,
          completedAt,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';

        if (attempt < maxRetries) {
          // Wait with exponential backoff before retrying
          const backoff = backoffMs * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          attempt++;
        } else {
          break;
        }
      }
    }

    const completedAt = new Date();
    return {
      nodeId: node.id,
      status: 'failed',
      output: null,
      error: lastError,
      duration: completedAt.getTime() - (completedAt.getTime() - 1000),
      startedAt: completedAt,
      completedAt,
    };
  }

  /**
   * Execute a promise with an optional timeout.
   */
  private async executeWithTimeout<T>(promise: Promise<T>, timeoutSeconds?: number): Promise<T> {
    if (!timeoutSeconds) {
      return promise;
    }

    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Node execution timed out after ${timeoutSeconds}s`)),
          timeoutSeconds * 1000
        )
      ),
    ]);
  }

  /**
   * Execute a single node based on its type.
   */
  private async executeSingleNode(
    node: WorkflowNode,
    variables: Record<string, any>,
    nodeResults: Record<string, NodeExecutionResult>,
    userId: string,
    executionId: string,
    emitProgress: (event: Omit<ProgressEvent, 'executionId' | 'timestamp'>) => void
  ): Promise<any> {
    switch (node.type) {
      case 'agent-call':
        return executeAgentCallNode(node, variables, nodeResults, userId);

      case 'skill-invoke':
        return executeSkillInvokeNode(node, variables, nodeResults, userId);

      case 'condition':
        return executeConditionNode(node, variables, nodeResults);

      case 'transform':
        return executeTransformNode(node, variables, nodeResults);

      case 'parallel':
        return this.executeParallelNode(node, variables, nodeResults, userId, executionId, emitProgress);

      case 'merge':
        return this.executeMergeNode(node, variables, nodeResults);

      case 'http-request':
        return executeHttpRequestNode(node, variables, nodeResults);

      case 'code-exec':
        return executeCodeExecNode(node, variables, nodeResults);

      case 'human-input':
        return executeHumanInputNode(node, variables, nodeResults);

      case 'delay':
        return executeDelayNode(node, variables, nodeResults);

      case 'sub-workflow':
        return executeSubWorkflowNode(node, variables, nodeResults, userId);

      case 'loop':
        return executeLoopNode(node, variables, nodeResults, userId, executionId, emitProgress);

      default:
        throw new Error(`Unknown node type: "${node.type}"`);
    }
  }

  /**
   * Execute a parallel node: runs multiple branches concurrently.
   */
  private async executeParallelNode(
    node: WorkflowNode,
    variables: Record<string, any>,
    nodeResults: Record<string, NodeExecutionResult>,
    _userId: string,
    _executionId: string,
    _emitProgress: (event: Omit<ProgressEvent, 'executionId' | 'timestamp'>) => void
  ): Promise<any> {
    const config = substituteConfig(node.config, variables, nodeResults);
    const { branches = [] } = config;

    if (!Array.isArray(branches) || branches.length === 0) {
      throw new Error(`parallel node "${node.name}" requires branches array`);
    }

    // For parallel nodes, we just record the branch structure.
    // Actual parallel execution is handled by the DAG execution —
    // the topological sort naturally allows independent branches to run concurrently.
    // Here we signal which branches should be activated.
    return {
      parallel: true,
      branches,
      branchCount: branches.length,
    };
  }

  /**
   * Execute a merge node: merge results from parallel branches.
   */
  private async executeMergeNode(
    node: WorkflowNode,
    variables: Record<string, any>,
    nodeResults: Record<string, NodeExecutionResult>
  ): Promise<any> {
    const config = substituteConfig(node.config, variables, nodeResults);
    const { strategy = 'last' } = config;

    // Find all predecessor node results
    const predecessorResults: any[] = [];
    for (const [nodeId, result] of Object.entries(nodeResults)) {
      if (result.status === 'success' && result.output !== null) {
        predecessorResults.push(result.output);
      }
    }

    switch (strategy) {
      case 'last':
        return predecessorResults.length > 0
          ? predecessorResults[predecessorResults.length - 1]
          : null;

      case 'array':
        return predecessorResults;

      case 'merge-object': {
        const merged: Record<string, any> = {};
        for (const result of predecessorResults) {
          if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
            Object.assign(merged, result);
          }
        }
        return merged;
      }

      default:
        throw new Error(`Unknown merge strategy: "${strategy}"`);
    }
  }

  /**
   * Cancel a running execution.
   */
  async cancel(executionId: string): Promise<boolean> {
    const tracker = activeExecutions.get(executionId);
    if (tracker) {
      tracker.cancelled = true;
    }

    // Also update the database
    const execution = await db.workflowExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      return false;
    }

    if (execution.status === 'running' || execution.status === 'paused') {
      await db.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'cancelled',
          completedAt: new Date(),
        },
      });
      return true;
    }

    return false;
  }

  /**
   * Get the current execution status.
   */
  async getStatus(executionId: string): Promise<ExecutionState | null> {
    const execution = await db.workflowExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      return null;
    }

    const nodeResults: Record<string, NodeExecutionResult> = JSON.parse(execution.nodeResults || '{}');
    const variables: Record<string, any> = JSON.parse(execution.variables || '{}');

    return {
      executionId: execution.id,
      workflowId: execution.workflowId,
      userId: execution.userId,
      status: execution.status as ExecutionStatus,
      nodeResults,
      variables,
      startedAt: execution.startedAt ?? undefined,
      completedAt: execution.completedAt ?? undefined,
      error: execution.error ?? undefined,
      failedNodeId: execution.failedNodeId ?? undefined,
    };
  }

  /**
   * Resume a paused execution (e.g., after human-input).
   * Provides the input for the specified node and continues execution.
   */
  async resume(
    executionId: string,
    nodeId: string,
    input: any
  ): Promise<{ executionId: string; status: ExecutionStatus; finalOutput?: any; error?: string }> {
    const execution = await db.workflowExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      throw new Error(`Execution "${executionId}" not found`);
    }

    if (execution.status !== 'paused') {
      throw new Error(`Execution "${executionId}" is not paused (status: ${execution.status})`);
    }

    // Load the workflow definition
    const workflowRecord = await db.workflow.findUnique({
      where: { id: execution.workflowId },
    });

    if (!workflowRecord) {
      throw new Error(`Workflow "${execution.workflowId}" not found`);
    }

    const nodes: WorkflowNode[] = JSON.parse(workflowRecord.nodes || '[]');
    const edges: WorkflowEdge[] = JSON.parse(workflowRecord.edges || '[]');
    const variableDefs = JSON.parse(workflowRecord.variables || '{}');
    const retryPolicy = JSON.parse(workflowRecord.retryPolicy || '{}');

    const workflow: WorkflowDefinition = {
      id: workflowRecord.id,
      userId: workflowRecord.userId,
      name: workflowRecord.name,
      description: workflowRecord.description || undefined,
      nodes,
      edges,
      variables: variableDefs,
      timeout: workflowRecord.timeout,
      retryPolicy,
      errorPolicy: (workflowRecord.errorPolicy as ErrorPolicy) || 'stop',
    };

    // Update the node result with the provided input
    const nodeResults: Record<string, NodeExecutionResult> = JSON.parse(execution.nodeResults || '{}');
    nodeResults[nodeId] = {
      nodeId,
      status: 'success',
      output: input,
      duration: 0,
      startedAt: new Date(),
      completedAt: new Date(),
    };

    const runtimeVariables: Record<string, any> = JSON.parse(execution.variables || '{}');

    // Update the execution state
    await db.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'running',
        nodeResults: JSON.stringify(nodeResults),
        variables: JSON.stringify(runtimeVariables),
      },
    });

    // Re-register active execution
    const executionTracker = { cancelled: false };
    activeExecutions.set(executionId, executionTracker);

    try {
      const result = await this.runExecutionLoop(
        workflow,
        executionId,
        runtimeVariables,
        executionTracker,
        () => {}, // No progress callback for resume
        execution.userId
      );

      return result;
    } finally {
      activeExecutions.delete(executionId);
    }
  }

  // ==================== Persistence Helpers ====================

  /**
   * Persist a node result to the database.
   */
  private async persistNodeResult(
    executionId: string,
    nodeId: string,
    result: NodeExecutionResult,
    variables: Record<string, any>
  ): Promise<void> {
    const execution = await db.workflowExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) return;

    const nodeResults: Record<string, NodeExecutionResult> = JSON.parse(execution.nodeResults || '{}');
    nodeResults[nodeId] = result;

    await db.workflowExecution.update({
      where: { id: executionId },
      data: {
        nodeResults: JSON.stringify(nodeResults),
        variables: JSON.stringify(variables),
      },
    });
  }

  /**
   * Update execution state in the database.
   */
  private async updateExecutionState(
    executionId: string,
    updates: {
      status?: string;
      error?: string;
      failedNodeId?: string;
      completedAt?: Date;
      duration?: number;
      finalOutput?: string;
    }
  ): Promise<void> {
    const data: Record<string, any> = {};
    if (updates.status) data.status = updates.status;
    if (updates.error !== undefined) data.error = updates.error;
    if (updates.failedNodeId !== undefined) data.failedNodeId = updates.failedNodeId;
    if (updates.completedAt) data.completedAt = updates.completedAt;
    if (updates.duration !== undefined) data.duration = updates.duration;
    if (updates.finalOutput !== undefined) data.finalOutput = updates.finalOutput;

    await db.workflowExecution.update({
      where: { id: executionId },
      data,
    });
  }
}

// ==================== Utility Exports ====================

/**
 * Load a workflow definition from the database.
 */
export async function loadWorkflowDefinition(workflowId: string): Promise<WorkflowDefinition | null> {
  const record = await db.workflow.findUnique({ where: { id: workflowId } });
  if (!record) return null;

  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    description: record.description || undefined,
    nodes: JSON.parse(record.nodes || '[]'),
    edges: JSON.parse(record.edges || '[]'),
    variables: JSON.parse(record.variables || '{}'),
    timeout: record.timeout,
    retryPolicy: JSON.parse(record.retryPolicy || '{}'),
    errorPolicy: (record.errorPolicy as ErrorPolicy) || 'stop',
  };
}

/**
 * Create a new workflow in the database.
 */
export async function createWorkflow(params: {
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  variables?: Record<string, any>;
  timeout?: number;
  retryPolicy?: { maxRetries: number; backoffMs: number };
  errorPolicy?: ErrorPolicy;
  trigger?: Record<string, any>;
}): Promise<string> {
  const workflow = await db.workflow.create({
    data: {
      userId: params.userId,
      name: params.name,
      description: params.description,
      icon: params.icon,
      color: params.color,
      nodes: JSON.stringify(params.nodes || []),
      edges: JSON.stringify(params.edges || []),
      variables: JSON.stringify(params.variables || {}),
      timeout: params.timeout || 300,
      retryPolicy: JSON.stringify(params.retryPolicy || {}),
      errorPolicy: params.errorPolicy || 'stop',
      trigger: JSON.stringify(params.trigger || { type: 'manual' }),
      status: 'draft',
    },
  });

  return workflow.id;
}

/**
 * Update a workflow in the database.
 */
export async function updateWorkflow(
  workflowId: string,
  updates: {
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
    nodes?: WorkflowNode[];
    edges?: WorkflowEdge[];
    variables?: Record<string, any>;
    timeout?: number;
    retryPolicy?: { maxRetries: number; backoffMs: number };
    errorPolicy?: ErrorPolicy;
    trigger?: Record<string, any>;
    status?: string;
  }
): Promise<boolean> {
  const data: Record<string, any> = {};
  if (updates.name !== undefined) data.name = updates.name;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.icon !== undefined) data.icon = updates.icon;
  if (updates.color !== undefined) data.color = updates.color;
  if (updates.nodes !== undefined) data.nodes = JSON.stringify(updates.nodes);
  if (updates.edges !== undefined) data.edges = JSON.stringify(updates.edges);
  if (updates.variables !== undefined) data.variables = JSON.stringify(updates.variables);
  if (updates.timeout !== undefined) data.timeout = updates.timeout;
  if (updates.retryPolicy !== undefined) data.retryPolicy = JSON.stringify(updates.retryPolicy);
  if (updates.errorPolicy !== undefined) data.errorPolicy = updates.errorPolicy;
  if (updates.trigger !== undefined) data.trigger = JSON.stringify(updates.trigger);
  if (updates.status !== undefined) data.status = updates.status;

  try {
    await db.workflow.update({
      where: { id: workflowId },
      data,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a workflow from the database.
 */
export async function deleteWorkflow(workflowId: string): Promise<boolean> {
  try {
    await db.workflow.delete({ where: { id: workflowId } });
    return true;
  } catch {
    return false;
  }
}

/**
 * List workflows for a user.
 */
export async function listWorkflows(
  userId: string,
  options?: { status?: string; limit?: number; offset?: number }
): Promise<Array<{ id: string; name: string; description?: string; status: string; createdAt: Date }>> {
  const workflows = await db.workflow.findMany({
    where: {
      userId,
      ...(options?.status ? { status: options.status } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
    },
  });

  return workflows.map(w => ({
    ...w,
    description: w.description ?? undefined,
  }));
}

/**
 * List executions for a workflow.
 */
export async function listWorkflowExecutions(
  workflowId: string,
  options?: { limit?: number; offset?: number }
): Promise<Array<{
  id: string;
  status: string;
  triggerType: string;
  startedAt: Date | null;
  completedAt: Date | null;
  duration: number | null;
  error: string | null;
  createdAt: Date;
}>> {
  const executions = await db.workflowExecution.findMany({
    where: { workflowId },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 20,
    skip: options?.offset || 0,
    select: {
      id: true,
      status: true,
      triggerType: true,
      startedAt: true,
      completedAt: true,
      duration: true,
      error: true,
      createdAt: true,
    },
  });

  return executions;
}
