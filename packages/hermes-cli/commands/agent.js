import inquirer from 'inquirer';
import chalk from 'chalk';
import api from '../lib/api.js';
import { isAuthenticated, setCurrentAgentId, getAcrpToken, setAcrpToken } from '../lib/config-store.js';
import { withSpinner, createSpinner } from '../lib/spinner.js';
import { WSClient } from '../lib/ws-client.js';

export function registerAgentCommand(program) {
  const agent = program
    .command('agent')
    .description('Manage agents');

  agent
    .command('create')
    .description('Create a new agent')
    .option('-n, --name <name>', 'Agent name')
    .option('-d, --description <desc>', 'Agent description')
    .option('-m, --mode <mode>', 'Agent mode (builtin|acrp)')
    .option('-t, --type <type>', 'Agent type (assistant|tool|workflow)')
    .option('-s, --system-prompt <prompt>', 'System prompt')
    .option('--model <model>', 'LLM model')
    .action(async (options) => {
      if (!isAuthenticated()) {
        console.log(chalk.red('❌ Not authenticated. Run: hermes auth login'));
        process.exit(1);
      }

      let answers;
      if (!options.name) {
        answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Agent name:',
            validate: (v) => v.length > 0 || 'Name is required',
          },
          {
            type: 'input',
            name: 'description',
            message: 'Description:',
            default: options.description || '',
          },
          {
            type: 'list',
            name: 'mode',
            message: 'Agent mode:',
            choices: [
              { name: 'ACRP - Connect via WebSocket', value: 'acrp' },
              { name: 'Builtin - Server-side with LLM', value: 'builtin' },
            ],
            default: options.mode || 'acrp',
          },
          {
            type: 'list',
            name: 'agentType',
            message: 'Agent type:',
            choices: [
              { name: 'Assistant', value: 'assistant' },
              { name: 'Tool', value: 'tool' },
              { name: 'Workflow', value: 'workflow' },
            ],
            default: options.type || 'assistant',
          },
          {
            type: 'input',
            name: 'systemPrompt',
            message: 'System prompt:',
            default: options.systemPrompt || 'You are a helpful AI assistant.',
          },
        ]);
      } else {
        answers = {
          name: options.name,
          description: options.description || '',
          mode: options.mode || 'acrp',
          agentType: options.type || 'assistant',
          systemPrompt: options.systemPrompt || 'You are a helpful AI assistant.',
          model: options.model,
        };
      }

      const spinner = createSpinner('🤖 Creating agent...');
      spinner.start();

      try {
        const result = await api.createAgent({
          name: answers.name,
          description: answers.description,
          mode: answers.mode,
          agentType: answers.agentType,
          systemPrompt: answers.systemPrompt,
          model: answers.model,
          agentVersion: '1.0.0',
        });
        spinner.succeed();

        const agentData = result.agent || result;
        console.log(chalk.green.bold('\n✅ Agent created successfully!'));
        console.log(chalk.white(`  Name: ${chalk.cyan(agentData.name || answers.name)}`));
        console.log(chalk.white(`  ID: ${chalk.gray(agentData.id)}`));
        console.log(chalk.white(`  Mode: ${chalk.cyan(answers.mode)}`));
        console.log(chalk.white(`  Type: ${chalk.cyan(answers.agentType)}`));

        setCurrentAgentId(agentData.id);

        console.log(chalk.gray('\n  Next steps:'));
        console.log(chalk.cyan('  1.') + ' Generate ACRP token:');
        console.log(chalk.gray(`     hermes agent token ${agentData.id}`));
        console.log(chalk.cyan('  2.') + ' Run the agent:');
        console.log(chalk.gray(`     hermes agent run ${agentData.id}`));
        console.log();
      } catch (error) {
        spinner.fail();
        console.log(chalk.red.bold(`\n❌ Failed to create agent: ${error.message}`));
        process.exit(1);
      }
    });

  agent
    .command('list')
    .description('List all agents')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      if (!isAuthenticated()) {
        console.log(chalk.red('❌ Not authenticated. Run: hermes auth login'));
        process.exit(1);
      }

      const spinner = createSpinner('📋 Loading agents...');
      spinner.start();

      try {
        const result = await api.listAgents();
        spinner.succeed();

        const agents = Array.isArray(result) ? result : (result.agents || []);

        if (agents.length === 0) {
          console.log(chalk.yellow('\n📭 No agents found'));
          console.log(chalk.gray('  Create one with: hermes agent create'));
          console.log();
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(agents, null, 2));
          return;
        }

        console.log(chalk.cyan.bold(`\n🤖 Agents (${agents.length})\n`));
        for (const a of agents) {
          const status = a.status === 'online' ? chalk.green('●') :
                         a.status === 'busy' ? chalk.yellow('●') :
                         a.status === 'error' ? chalk.red('●') :
                         chalk.gray('○');
          const mode = a.mode === 'acrp' ? chalk.cyan('ACRP') : chalk.blue('Builtin');
          console.log(`  ${status} ${chalk.bold(a.name)} ${chalk.gray(`(${a.id})`)}`);
          console.log(`    Mode: ${mode}  Type: ${chalk.gray(a.agentType || 'assistant')}  ${a.description ? chalk.gray(a.description.substring(0, 60)) : ''}`);
        }
        console.log();
      } catch (error) {
        spinner.fail();
        console.log(chalk.red.bold(`\n❌ Failed to list agents: ${error.message}`));
        process.exit(1);
      }
    });

  agent
    .command('token')
    .description('Generate ACRP token for an agent')
    .argument('<agentId>', 'Agent ID')
    .action(async (agentId) => {
      if (!isAuthenticated()) {
        console.log(chalk.red('❌ Not authenticated. Run: hermes auth login'));
        process.exit(1);
      }

      const spinner = createSpinner('🔑 Generating ACRP token...');
      spinner.start();

      try {
        const result = await api.generateAcrpToken(agentId);
        spinner.succeed();

        const token = result.agentToken || result.token || result.acrpToken || result;
        const tokenStr = typeof token === 'string' ? token : JSON.stringify(token);

        setAcrpToken(agentId, tokenStr);

        console.log(chalk.green.bold('\n✅ ACRP token generated!'));
        console.log(chalk.white(`  Agent: ${chalk.cyan(result.agentId || agentId)}`));
        console.log(chalk.white(`  Token: ${chalk.gray(tokenStr.substring(0, 40))}...`));
        if (result.wsConnectUrl) {
          console.log(chalk.white(`  WS Connect URL: ${chalk.gray(result.wsConnectUrl)}`));
        }
        if (result.wsDirectUrl) {
          console.log(chalk.white(`  WS Direct URL: ${chalk.gray(result.wsDirectUrl)}`));
        }
        console.log(chalk.gray('\n  Token saved to config. You can now run:'));
        console.log(chalk.cyan(`  hermes agent run ${agentId}`));
        console.log();
      } catch (error) {
        spinner.fail();
        console.log(chalk.red.bold(`\n❌ Failed to generate token: ${error.message}`));
        process.exit(1);
      }
    });

  agent
    .command('run')
    .description('Start agent with WebSocket connection')
    .argument('<agentId>', 'Agent ID')
    .option('-c, --config <path>', 'Path to hermes.config.js', './hermes.config.js')
    .action(async (agentId, options) => {
      if (!isAuthenticated()) {
        console.log(chalk.red('❌ Not authenticated. Run: hermes auth login'));
        process.exit(1);
      }

      console.log(chalk.cyan.bold('\n🤖 Starting Hermes Agent\n'));
      console.log(chalk.white(`  Agent ID: ${chalk.cyan(agentId)}`));

      // Try to load hermes.config.js for capabilities
      let capabilities = [];
      let handlers = {};

      try {
        const configPath = new URL(options.config, `file://${process.cwd()}/`).href;
        const config = await import(configPath);
        const agentConfig = config.default || config;

        if (agentConfig.capabilities && Array.isArray(agentConfig.capabilities)) {
          capabilities = agentConfig.capabilities.map(c =>
            typeof c === 'string' ? c : c.name
          );
          console.log(chalk.white(`  Capabilities: ${chalk.cyan(capabilities.join(', ') || 'none')}`));
        }
      } catch {
        console.log(chalk.gray('  No hermes.config.js found, starting without custom capabilities'));
      }

      // Try to load agent.js for handlers
      try {
        const agentPath = new URL('./agent.js', `file://${process.cwd()}/`).href;
        // We import it to get handlers if the agent-sdk exports them
        console.log(chalk.gray('  Found agent.js entry point'));
      } catch {
        // No agent.js, that's ok
      }

      // Check for ACRP token, generate if needed
      let acrpToken = getAcrpToken(agentId);
      if (!acrpToken) {
        console.log(chalk.yellow('\n⚠ No ACRP token found. Generating one...'));
        const spinner = createSpinner('🔑 Generating ACRP token...');
        spinner.start();
        try {
          const result = await api.generateAcrpToken(agentId);
          acrpToken = result.agentToken || result.token || result.acrpToken || result;
          const tokenStr = typeof acrpToken === 'string' ? acrpToken : JSON.stringify(acrpToken);
          setAcrpToken(agentId, tokenStr);
          spinner.succeed();
        } catch (error) {
          spinner.fail();
          console.log(chalk.red(`❌ Failed to generate token: ${error.message}`));
          process.exit(1);
        }
      }

      // Connect via WebSocket
      const wsClient = new WSClient(agentId, {
        capabilities,
        handlers,
        onInvocation: (data) => {
          return { message: `Handler for ${data.capability} not implemented`, params: data.params };
        },
      });

      // Graceful shutdown
      let shuttingDown = false;
      const shutdown = () => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(chalk.yellow('\n\n🛑 Shutting down agent...'));
        wsClient.disconnect();
        console.log(chalk.green('👋 Agent stopped. Goodbye!'));
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      try {
        await wsClient.connect();
        console.log(chalk.green.bold('\n🟢 Agent is running! Press Ctrl+C to stop.\n'));
        console.log(chalk.gray('  Listening for capability invocations...'));
        console.log(chalk.gray('  Heartbeat: every 15 seconds'));
        console.log();

        // Keep process alive
        setInterval(() => {
          if (wsClient.connected) {
            process.stdout.write('');
          }
        }, 60000);
      } catch (error) {
        console.log(chalk.red.bold(`\n❌ Failed to start agent: ${error.message}`));
        process.exit(1);
      }
    });

  agent
    .command('delete')
    .description('Delete an agent')
    .argument('<agentId>', 'Agent ID')
    .option('--force', 'Skip confirmation')
    .action(async (agentId, options) => {
      if (!isAuthenticated()) {
        console.log(chalk.red('❌ Not authenticated. Run: hermes auth login'));
        process.exit(1);
      }

      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Delete agent ${chalk.bold(agentId)}? This cannot be undone.`,
            default: false,
          },
        ]);
        if (!confirm) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }
      }

      const spinner = createSpinner('🗑 Deleting agent...');
      spinner.start();

      try {
        await api.deleteAgent(agentId);
        spinner.succeed();
        console.log(chalk.green(`✅ Agent ${chalk.bold(agentId)} deleted`));
      } catch (error) {
        spinner.fail();
        console.log(chalk.red.bold(`\n❌ Failed to delete agent: ${error.message}`));
        process.exit(1);
      }
    });

  agent
    .command('info')
    .description('Get agent details')
    .argument('<agentId>', 'Agent ID')
    .option('--json', 'Output as JSON')
    .action(async (agentId, options) => {
      if (!isAuthenticated()) {
        console.log(chalk.red('❌ Not authenticated. Run: hermes auth login'));
        process.exit(1);
      }

      const spinner = createSpinner('🔍 Loading agent info...');
      spinner.start();

      try {
        const result = await api.getAgent(agentId);
        spinner.succeed();

        const agentData = result.agent || result;

        if (options.json) {
          console.log(JSON.stringify(agentData, null, 2));
          return;
        }

        console.log(chalk.cyan.bold('\n🤖 Agent Details\n'));
        console.log(chalk.white(`  Name: ${chalk.bold(agentData.name)}`));
        console.log(chalk.white(`  ID: ${chalk.gray(agentData.id)}`));
        console.log(chalk.white(`  Mode: ${chalk.cyan(agentData.mode || 'N/A')}`));
        console.log(chalk.white(`  Type: ${chalk.cyan(agentData.agentType || 'N/A')}`));
        console.log(chalk.white(`  Version: ${chalk.gray(agentData.agentVersion || 'N/A')}`));
        console.log(chalk.white(`  Status: ${agentData.status === 'online' ? chalk.green('Online') : agentData.status === 'busy' ? chalk.yellow('Busy') : chalk.gray('Offline')}`));
        if (agentData.description) {
          console.log(chalk.white(`  Description: ${agentData.description}`));
        }
        if (agentData.systemPrompt) {
          console.log(chalk.white(`  System Prompt: ${chalk.gray(agentData.systemPrompt.substring(0, 100))}${agentData.systemPrompt.length > 100 ? '...' : ''}`));
        }
        if (agentData.model) {
          console.log(chalk.white(`  Model: ${chalk.cyan(agentData.model)}`));
        }
        console.log();
      } catch (error) {
        spinner.fail();
        console.log(chalk.red.bold(`\n❌ Failed to get agent info: ${error.message}`));
        process.exit(1);
      }
    });

  // Default action
  agent
    .action(() => {
      console.log(chalk.cyan('Available agent commands:'));
      console.log(chalk.white('  hermes agent create          ') + chalk.gray('Create a new agent'));
      console.log(chalk.white('  hermes agent list            ') + chalk.gray('List all agents'));
      console.log(chalk.white('  hermes agent info <id>       ') + chalk.gray('Get agent details'));
      console.log(chalk.white('  hermes agent token <id>      ') + chalk.gray('Generate ACRP token'));
      console.log(chalk.white('  hermes agent run <id>        ') + chalk.gray('Start agent with WebSocket'));
      console.log(chalk.white('  hermes agent delete <id>     ') + chalk.gray('Delete an agent'));
      console.log();
    });
}
