import inquirer from 'inquirer';
import chalk from 'chalk';
import { getServerUrl, getWsUrl, setConfig, getAllConfig } from '../lib/config-store.js';
import { createSpinner } from '../lib/spinner.js';

export function registerConfigCommand(program) {
  const config = program
    .command('config')
    .description('Configure Hermes CLI settings');

  config
    .command('init')
    .description('Interactive configuration setup')
    .action(async () => {
      console.log(chalk.cyan.bold('\n⚙ Hermes CLI Configuration\n'));

      const currentConfig = getAllConfig();

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'serverUrl',
          message: 'Hermes Hub server URL:',
          default: currentConfig.serverUrl || 'http://localhost:3000',
        },
        {
          type: 'input',
          name: 'wsUrl',
          message: 'WebSocket server URL:',
          default: currentConfig.wsUrl || 'http://localhost:3004',
        },
      ]);

      setConfig('serverUrl', answers.serverUrl);
      setConfig('wsUrl', answers.wsUrl);

      console.log(chalk.green('\n✅ Configuration saved!'));
      console.log(chalk.gray(`   Server: ${answers.serverUrl}`));
      console.log(chalk.gray(`   WebSocket: ${answers.wsUrl}`));
      console.log();
    });

  config
    .command('set')
    .description('Set a configuration value')
    .argument('<key>', 'Configuration key')
    .argument('<value>', 'Configuration value')
    .action((key, value) => {
      setConfig(key, value);
      console.log(chalk.green(`✅ Set ${chalk.bold(key)} = ${chalk.bold(value)}`));
    });

  config
    .command('get')
    .description('Get a configuration value')
    .argument('<key>', 'Configuration key')
    .action((key) => {
      const value = getAllConfig()[key];
      if (value !== undefined) {
        console.log(chalk.cyan(`${key} = ${JSON.stringify(value)}`));
      } else {
        console.log(chalk.yellow(`Key "${key}" not found`));
      }
    });

  config
    .command('list')
    .description('List all configuration values')
    .action(() => {
      const allConfig = getAllConfig();
      console.log(chalk.cyan.bold('\n📋 Hermes CLI Configuration\n'));
      for (const [key, value] of Object.entries(allConfig)) {
        if (key === 'token' && value) {
          console.log(chalk.white(`  ${key}: ${chalk.gray('[hidden]')}`));
        } else if (key === 'acrpTokens' && value && Object.keys(value).length > 0) {
          console.log(chalk.white(`  ${key}:`));
          for (const [agentId, token] of Object.entries(value)) {
            console.log(chalk.white(`    ${agentId}: ${chalk.gray('[hidden]')}`));
          }
        } else {
          console.log(chalk.white(`  ${key}: ${chalk.cyan(JSON.stringify(value))}`));
        }
      }
      console.log();
    });

  // Default action: show current config
  config
    .action(() => {
      const allConfig = getAllConfig();
      console.log(chalk.cyan.bold('\n📋 Current Configuration\n'));
      console.log(chalk.white(`  Server URL: ${chalk.cyan(allConfig.serverUrl)}`));
      console.log(chalk.white(`  WebSocket URL: ${chalk.cyan(allConfig.wsUrl)}`));
      console.log(chalk.white(`  Authenticated: ${allConfig.token ? chalk.green('Yes') : chalk.red('No')}`));
      if (allConfig.userEmail) {
        console.log(chalk.white(`  User: ${chalk.cyan(allConfig.userEmail)}`));
      }
      if (allConfig.currentAgentId) {
        console.log(chalk.white(`  Current Agent: ${chalk.cyan(allConfig.currentAgentId)}`));
      }
      console.log();
      console.log(chalk.gray('  Use "hermes config init" to reconfigure'));
      console.log(chalk.gray('  Use "hermes config list" to see all values'));
      console.log();
    });
}
