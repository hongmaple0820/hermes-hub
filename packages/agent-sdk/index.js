/**
 * @hermes-hub/agent-sdk — Main Entry Point
 *
 * Official SDK for building agents that connect to Hermes Hub
 * via the ACRP (Agent Capability Registration Protocol).
 *
 * @example
 * const { HermesAgent } = require('@hermes-hub/agent-sdk');
 *
 * const agent = new HermesAgent({
 *   token: 'acrp_xxxxx',
 *   name: 'My Agent',
 *   capabilities: [{
 *     capabilityId: 'greet',
 *     name: 'Greeting',
 *     description: 'Send a greeting',
 *     category: 'chat',
 *     parameters: { type: 'object', properties: { name: { type: 'string' } } },
 *     handler: async (params) => ({ message: `Hello, ${params.name}!` })
 *   }]
 * });
 *
 * agent.on('connected', () => console.log('Connected!'));
 * await agent.start();
 */

'use strict'

const HermesAgent = require('./hermes-agent')
const { Events, SocketEvents, CAPABILITY_CATEGORIES, DEFAULTS } = require('./types')

module.exports = {
  HermesAgent,
  Events,
  SocketEvents,
  CAPABILITY_CATEGORIES,
  DEFAULTS,
}

// Also export as HermesAgent default for ESM-like convenience
module.exports.HermesAgent = HermesAgent
module.exports.default = HermesAgent
