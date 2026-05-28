import inquirer from 'inquirer';
import chalk from 'chalk';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { setConfig, getServerUrl } from '../lib/config-store.js';

const HERMES_CONFIG_TEMPLATE = `// Hermes Agent Configuration
// See docs: https://hermes-hub.dev/docs/cli

export default {
  // Agent identity
  name: '{{name}}',
  description: '{{description}}',

  // Agent mode: 'builtin' | 'acrp'
  mode: '{{mode}}',

  // Agent type: 'assistant' | 'tool' | 'workflow'
  agentType: '{{agentType}}',

  // System prompt
  systemPrompt: 'You are a helpful AI assistant.',

  // LLM configuration
  model: 'gpt-4',
  providerId: null, // Set to a provider ID from Hermes Hub

  // Capabilities (for ACRP mode)
  capabilities: [
    // {
    //   name: 'example_capability',
    //   description: 'An example capability',
    //   handler: './capabilities/example.js',
    // }
  ],
};
`;

const AGENT_ENTRY_TEMPLATE = `/**
 * Hermes Agent Entry Point
 *
 * This file is loaded when you run: hermes agent run <agentId>
 * It registers capabilities and handles invocations.
 */

import { createAgent } from '@hermes-hub/agent-sdk';

const agent = createAgent({
  name: '{{name}}',
  capabilities: {
    // Example: echo capability
    echo: {
      description: 'Echo back the input message',
      handler: async (params) => {
        return { message: params.message || 'Hello from {{name}}!' };
      },
    },

    // Example: compute capability
    compute: {
      description: 'Perform a computation',
      handler: async (params) => {
        const { expression } = params;
        try {
          // Simple safe evaluation (replace with your own logic)
          const result = new Function('return ' + expression)();
          return { result, expression };
        } catch (error) {
          return { error: error.message, expression };
        }
      },
    },

    // Add your own capabilities here:
    // my_capability: {
    //   description: 'Description of what it does',
    //   handler: async (params) => {
    //     return { /* your result */ };
    //   },
    // },
  },
});

// Start the agent
agent.start();

console.log('🤖 {{name}} agent is ready!');
console.log('   Run: hermes agent run <agentId>');
`;

const ENV_TEMPLATE = `# Hermes Hub Configuration
HERMES_SERVER_URL=http://localhost:3000
HERMES_WS_URL=http://localhost:3004

# Agent credentials (auto-filled by 'hermes agent token')
HERMES_AGENT_ID=
HERMES_ACRP_TOKEN=
`;

const PACKAGE_TEMPLATE = `{
  "name": "{{packageName}}",
  "version": "1.0.0",
  "type": "module",
  "description": "{{description}}",
  "main": "agent.js",
  "scripts": {
    "start": "hermes agent run",
    "dev": "hermes agent run --watch"
  },
  "dependencies": {
    "@hermes-hub/agent-sdk": "^0.1.0"
  }
}
`;

const CAPABILITY_TEMPLATE = `/**
 * Example Capability: {{name}}
 *
 * Capabilities are functions that other agents can invoke via ACRP.
 */

export default async function handler(params) {
  // Your capability logic here
  console.log('Capability invoked with params:', params);

  return {
    success: true,
    message: 'Hello from the {{name}} capability!',
    params,
  };
}
`;

export function registerInitCommand(program) {
  program
    .command('init')
    .description('Initialize a new Hermes agent project')
    .option('-n, --name <name>', 'Agent name')
    .option('-d, --description <desc>', 'Agent description')
    .option('-m, --mode <mode>', 'Agent mode (builtin|acrp)')
    .option('-t, --type <type>', 'Agent type (assistant|tool|workflow)')
    .action(async (options) => {
      console.log(chalk.cyan.bold('\n🚀 Hermes Agent Project Setup\n'));

      let answers;
      if (!options.name || !options.description || !options.mode || !options.type) {
        answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Agent name:',
            default: options.name || 'my-agent',
            validate: (v) => v.length > 0 || 'Name is required',
          },
          {
            type: 'input',
            name: 'description',
            message: 'Description:',
            default: options.description || 'A Hermes agent',
          },
          {
            type: 'list',
            name: 'mode',
            message: 'Agent mode:',
            choices: [
              { name: 'ACRP - Connect via WebSocket with capabilities', value: 'acrp' },
              { name: 'Builtin - Runs on the server with LLM', value: 'builtin' },
            ],
            default: options.mode || 'acrp',
          },
          {
            type: 'list',
            name: 'agentType',
            message: 'Agent type:',
            choices: [
              { name: 'Assistant - Conversational AI', value: 'assistant' },
              { name: 'Tool - Programmatic tool agent', value: 'tool' },
              { name: 'Workflow - Multi-step automation', value: 'workflow' },
            ],
            default: options.type || 'assistant',
          },
          {
            type: 'input',
            name: 'serverUrl',
            message: 'Hermes Hub server URL:',
            default: getServerUrl(),
          },
        ]);
      } else {
        answers = {
          name: options.name,
          description: options.description,
          mode: options.mode,
          agentType: options.type,
          serverUrl: getServerUrl(),
        };
      }

      const projectDir = process.cwd();
      const capabilitiesDir = join(projectDir, 'capabilities');

      // Check if already initialized
      if (existsSync(join(projectDir, 'hermes.config.js'))) {
        console.log(chalk.yellow('\n⚠ Project already initialized (hermes.config.js exists)'));
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: 'Overwrite existing configuration?',
            default: false,
          },
        ]);
        if (!overwrite) {
          console.log(chalk.gray('Initialization cancelled.'));
          return;
        }
      }

      // Update server URL if changed
      if (answers.serverUrl !== getServerUrl()) {
        setConfig('serverUrl', answers.serverUrl);
      }

      // Create files
      console.log(chalk.gray('\n📁 Creating project files...\n'));

      // hermes.config.js
      const configContent = HERMES_CONFIG_TEMPLATE
        .replace(/\{\{name\}\}/g, answers.name)
        .replace(/\{\{description\}\}/g, answers.description)
        .replace(/\{\{mode\}\}/g, answers.mode)
        .replace(/\{\{agentType\}\}/g, answers.agentType);
      writeFileSync(join(projectDir, 'hermes.config.js'), configContent);
      console.log(chalk.green('  ✅ hermes.config.js'));

      // agent.js
      const agentContent = AGENT_ENTRY_TEMPLATE
        .replace(/\{\{name\}\}/g, answers.name);
      writeFileSync(join(projectDir, 'agent.js'), agentContent);
      console.log(chalk.green('  ✅ agent.js'));

      // .env
      writeFileSync(join(projectDir, '.env'), ENV_TEMPLATE);
      console.log(chalk.green('  ✅ .env'));

      // package.json
      const packageContent = PACKAGE_TEMPLATE
        .replace(/\{\{packageName\}\}/g, answers.name.toLowerCase().replace(/\s+/g, '-'))
        .replace(/\{\{description\}\}/g, answers.description);
      writeFileSync(join(projectDir, 'package.json'), packageContent);
      console.log(chalk.green('  ✅ package.json'));

      // capabilities directory with example
      if (!existsSync(capabilitiesDir)) {
        mkdirSync(capabilitiesDir, { recursive: true });
      }
      const exampleCapability = CAPABILITY_TEMPLATE
        .replace(/\{\{name\}\}/g, 'example');
      writeFileSync(join(capabilitiesDir, 'example.js'), exampleCapability);
      console.log(chalk.green('  ✅ capabilities/example.js'));

      console.log(chalk.green.bold('\n🎉 Project initialized successfully!\n'));
      console.log(chalk.white('Next steps:'));
      console.log(chalk.cyan('  1.') + ' Login to Hermes Hub:');
      console.log(chalk.gray('     hermes auth login'));
      console.log(chalk.cyan('  2.') + ' Create your agent on the platform:');
      console.log(chalk.gray('     hermes agent create'));
      console.log(chalk.cyan('  3.') + ' Generate an ACRP token:');
      console.log(chalk.gray('     hermes agent token <agentId>'));
      console.log(chalk.cyan('  4.') + ' Run your agent:');
      console.log(chalk.gray('     hermes agent run <agentId>'));
      console.log();
    });
}
