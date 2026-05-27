import inquirer from 'inquirer';
import chalk from 'chalk';
import api from '../lib/api.js';
import { isAuthenticated } from '../lib/config-store.js';
import { createSpinner } from '../lib/spinner.js';
import { io } from 'socket.io-client';
import { getWsUrl } from '../lib/config-store.js';

export function registerChatCommand(program) {
  const chat = program
    .command('chat')
    .description('Chat commands');

  chat
    .command('list')
    .description('List conversations')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      if (!isAuthenticated()) {
        console.log(chalk.red('❌ Not authenticated. Run: hermes auth login'));
        process.exit(1);
      }

      const spinner = createSpinner('💬 Loading conversations...');
      spinner.start();

      try {
        const result = await api.listConversations();
        spinner.succeed();

        const conversations = Array.isArray(result) ? result : (result.conversations || []);

        if (conversations.length === 0) {
          console.log(chalk.yellow('\n📭 No conversations found'));
          console.log(chalk.gray('  Create one with: hermes chat send <conversationId> --message "Hello"'));
          console.log();
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(conversations, null, 2));
          return;
        }

        console.log(chalk.cyan.bold(`\n💬 Conversations (${conversations.length})\n`));
        for (const c of conversations) {
          const date = c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '';
          console.log(`  📝 ${chalk.bold(c.title || 'Untitled')} ${chalk.gray(`(${c.id})`)}`);
          if (date) {
            console.log(chalk.gray(`    Updated: ${date}`));
          }
          if (c.agentId) {
            console.log(chalk.gray(`    Agent: ${c.agentId}`));
          }
        }
        console.log();
      } catch (error) {
        spinner.fail();
        console.log(chalk.red.bold(`\n❌ Failed to list conversations: ${error.message}`));
        process.exit(1);
      }
    });

  chat
    .command('send')
    .description('Send a message in a conversation')
    .argument('<conversationId>', 'Conversation ID')
    .option('-m, --message <message>', 'Message text')
    .action(async (conversationId, options) => {
      if (!isAuthenticated()) {
        console.log(chalk.red('❌ Not authenticated. Run: hermes auth login'));
        process.exit(1);
      }

      let message = options.message;

      if (!message) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'message',
            message: 'Message:',
            validate: (v) => v.length > 0 || 'Message is required',
          },
        ]);
        message = answers.message;
      }

      const spinner = createSpinner('💬 Sending message...');
      spinner.start();

      try {
        await api.sendConversationMessage(conversationId, message);
        spinner.succeed();
        console.log(chalk.green('✅ Message sent'));
      } catch (error) {
        spinner.fail();
        console.log(chalk.red.bold(`\n❌ Failed to send message: ${error.message}`));
        process.exit(1);
      }
    });

  chat
    .command('listen')
    .description('Listen for messages in a conversation')
    .argument('<conversationId>', 'Conversation ID')
    .action(async (conversationId) => {
      if (!isAuthenticated()) {
        console.log(chalk.red('❌ Not authenticated. Run: hermes auth login'));
        process.exit(1);
      }

      console.log(chalk.cyan.bold('\n💬 Listening for messages\n'));
      console.log(chalk.white(`  Conversation: ${chalk.gray(conversationId)}`));
      console.log(chalk.gray('  Press Ctrl+C to stop\n'));

      const wsUrl = getWsUrl();
      const socket = io(wsUrl, {
        transports: ['websocket'],
        query: { conversationId },
      });

      socket.on('connect', () => {
        console.log(chalk.green('✅ Connected to chat service'));
        socket.emit('chat:join', { conversationId });
      });

      socket.on('chat:message', (data) => {
        const sender = data.senderName || data.senderId || 'Unknown';
        const time = new Date().toLocaleTimeString();
        const prefix = data.role === 'assistant' ? '🤖' : '👤';
        console.log(chalk.white(`  ${prefix} ${chalk.bold(sender)} ${chalk.gray(`[${time}]`)}`));
        console.log(chalk.white(`    ${data.content || data.message || JSON.stringify(data)}`));
        console.log();
      });

      socket.on('chat:typing', (data) => {
        process.stdout.write(chalk.gray(`  ${data.senderName || 'Someone'} is typing...\r`));
      });

      socket.on('disconnect', () => {
        console.log(chalk.yellow('\n🔌 Disconnected'));
      });

      socket.on('connect_error', (error) => {
        console.log(chalk.red(`\n❌ Connection error: ${error.message}`));
      });

      // Graceful shutdown
      const shutdown = () => {
        console.log(chalk.yellow('\n🛑 Stopping listener...'));
        socket.disconnect();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    });

  // Default action
  chat
    .action(() => {
      console.log(chalk.cyan('Available chat commands:'));
      console.log(chalk.white('  hermes chat list <conversationId>    ') + chalk.gray('List conversations'));
      console.log(chalk.white('  hermes chat send <id> -m "message"   ') + chalk.gray('Send a message'));
      console.log(chalk.white('  hermes chat listen <id>              ') + chalk.gray('Listen for messages'));
      console.log();
    });
}
