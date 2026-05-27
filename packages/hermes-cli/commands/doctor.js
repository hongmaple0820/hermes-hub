import chalk from 'chalk';
import api from '../lib/api.js';
import { isAuthenticated, getAuthInfo, getServerUrl, getWsUrl, getAllConfig } from '../lib/config-store.js';
import { createSpinner } from '../lib/spinner.js';
import axios from 'axios';

export function registerDoctorCommand(program) {
  program
    .command('doctor')
    .description('Run health check on Hermes CLI configuration')
    .action(async () => {
      console.log(chalk.cyan.bold('\n🏥 Hermes CLI Health Check\n'));

      const results = [];
      const config = getAllConfig();

      // 1. Check config file
      console.log(chalk.white('📋 Checking configuration...'));
      const hasConfig = config.serverUrl && config.wsUrl;
      if (hasConfig) {
        console.log(chalk.green('  ✅ Configuration file exists'));
        console.log(chalk.gray(`     Server: ${config.serverUrl}`));
        console.log(chalk.gray(`     WebSocket: ${config.wsUrl}`));
        results.push({ name: 'Configuration', status: 'ok' });
      } else {
        console.log(chalk.red('  ❌ Configuration incomplete'));
        console.log(chalk.gray('     Run: hermes config init'));
        results.push({ name: 'Configuration', status: 'fail' });
      }

      // 2. Check authentication
      console.log(chalk.white('\n🔑 Checking authentication...'));
      if (isAuthenticated()) {
        const { email } = getAuthInfo();
        console.log(chalk.green(`  ✅ Authenticated${email ? ` as ${email}` : ''}`));
        results.push({ name: 'Authentication', status: 'ok' });

        // Verify token
        const spinner = createSpinner('  Verifying token...');
        spinner.start();
        try {
          await api.getMe();
          spinner.succeed('  ✅ Token is valid');
          results.push({ name: 'Token Validity', status: 'ok' });
        } catch {
          spinner.warn('  ⚠ Token may be expired');
          results.push({ name: 'Token Validity', status: 'warn' });
        }
      } else {
        console.log(chalk.red('  ❌ Not authenticated'));
        console.log(chalk.gray('     Run: hermes auth login'));
        results.push({ name: 'Authentication', status: 'fail' });
      }

      // 3. Check server connectivity
      console.log(chalk.white('\n🌐 Checking server connectivity...'));
      const serverUrl = getServerUrl();
      try {
        const response = await axios.get(`${serverUrl}/api/auth/me`, {
          timeout: 5000,
          validateStatus: () => true,
        });
        if (response.status === 401 || response.status === 200) {
          console.log(chalk.green(`  ✅ Server reachable at ${serverUrl}`));
          results.push({ name: 'Server', status: 'ok' });
        } else {
          console.log(chalk.yellow(`  ⚠ Server returned status ${response.status}`));
          results.push({ name: 'Server', status: 'warn' });
        }
      } catch (error) {
        console.log(chalk.red(`  ❌ Cannot reach server at ${serverUrl}`));
        console.log(chalk.gray(`     Error: ${error.message}`));
        results.push({ name: 'Server', status: 'fail' });
      }

      // 4. Check WebSocket service
      console.log(chalk.white('\n🔌 Checking WebSocket service...'));
      const wsUrl = getWsUrl();
      try {
        const wsHttpUrl = wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
        const response = await axios.get(wsHttpUrl, {
          timeout: 5000,
          validateStatus: () => true,
        });
        console.log(chalk.green(`  ✅ WebSocket service reachable at ${wsUrl}`));
        results.push({ name: 'WebSocket', status: 'ok' });
      } catch (error) {
        console.log(chalk.red(`  ❌ Cannot reach WebSocket service at ${wsUrl}`));
        console.log(chalk.gray(`     Error: ${error.message}`));
        results.push({ name: 'WebSocket', status: 'fail' });
      }

      // 5. Check current agent
      console.log(chalk.white('\n🤖 Checking agent configuration...'));
      if (config.currentAgentId) {
        console.log(chalk.green(`  ✅ Current agent: ${config.currentAgentId}`));
        results.push({ name: 'Agent', status: 'ok' });
      } else {
        console.log(chalk.yellow('  ⚠ No current agent selected'));
        console.log(chalk.gray('     Run: hermes agent create or hermes agent list'));
        results.push({ name: 'Agent', status: 'warn' });
      }

      // 6. Check ACRP tokens
      console.log(chalk.white('\n🔑 Checking ACRP tokens...'));
      const acrpTokens = config.acrpTokens || {};
      const tokenCount = Object.keys(acrpTokens).length;
      if (tokenCount > 0) {
        console.log(chalk.green(`  ✅ ${tokenCount} ACRP token(s) configured`));
        for (const agentId of Object.keys(acrpTokens)) {
          console.log(chalk.gray(`     Agent: ${agentId}`));
        }
        results.push({ name: 'ACRP Tokens', status: 'ok' });
      } else {
        console.log(chalk.yellow('  ⚠ No ACRP tokens configured'));
        console.log(chalk.gray('     Run: hermes agent token <agentId>'));
        results.push({ name: 'ACRP Tokens', status: 'warn' });
      }

      // Summary
      console.log(chalk.cyan.bold('\n📊 Summary\n'));
      const ok = results.filter(r => r.status === 'ok').length;
      const warn = results.filter(r => r.status === 'warn').length;
      const fail = results.filter(r => r.status === 'fail').length;

      for (const r of results) {
        const icon = r.status === 'ok' ? chalk.green('✅') :
                     r.status === 'warn' ? chalk.yellow('⚠️') :
                     chalk.red('❌');
        console.log(`  ${icon} ${r.name}`);
      }

      console.log();
      console.log(chalk.white(`  ${ok} passed, ${warn} warnings, ${fail} failed`));

      if (fail > 0) {
        console.log(chalk.yellow('\n  Run "hermes config init" to fix configuration issues'));
      }

      console.log();
    });
}
