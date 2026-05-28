#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { registerInitCommand } from '../commands/init.js';
import { registerConfigCommand } from '../commands/config.js';
import { registerAuthCommand } from '../commands/auth.js';
import { registerAgentCommand } from '../commands/agent.js';
import { registerSkillCommand } from '../commands/skill.js';
import { registerChatCommand } from '../commands/chat.js';
import { registerDoctorCommand } from '../commands/doctor.js';

const program = new Command();

program
  .name('hermes')
  .description('The official CLI for Hermes Hub - Multi-Agent Collaboration Platform')
  .version('0.1.0')
  .addHelpText('before', chalk.cyan.bold(`
  ╔══════════════════════════════════════╗
  ║   🤖 Hermes Hub CLI v0.1.0         ║
  ║   Multi-Agent Collaboration         ║
  ╚══════════════════════════════════════╝
  `))
  .addHelpText('after', chalk.gray(`
  Quick Start:
    $ hermes init                    Initialize a new agent project
    $ hermes auth login              Login to Hermes Hub
    $ hermes agent create            Create your first agent
    $ hermes agent run <agentId>     Start an agent

  Documentation: https://hermes-hub.dev/docs/cli
  `));

// Register all commands
registerInitCommand(program);
registerConfigCommand(program);
registerAuthCommand(program);
registerAgentCommand(program);
registerSkillCommand(program);
registerChatCommand(program);
registerDoctorCommand(program);

// Global error handling
program.exitOverride();

try {
  program.parse(process.argv);
} catch (error) {
  // Commander throws on --help and -V, which is normal
  if (error.code === 'commander.help' || error.code === 'commander.version' || error.code === 'commander.helpDisplayed') {
    process.exit(0);
  }
  console.error(chalk.red(`Error: ${error.message}`));
  process.exit(1);
}
