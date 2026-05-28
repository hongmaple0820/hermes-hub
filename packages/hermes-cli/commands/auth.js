import inquirer from 'inquirer';
import chalk from 'chalk';
import api from '../lib/api.js';
import { isAuthenticated, setAuthInfo, getAuthInfo, clearToken } from '../lib/config-store.js';
import { withSpinner, createSpinner } from '../lib/spinner.js';

export function registerAuthCommand(program) {
  const auth = program
    .command('auth')
    .description('Authentication commands');

  auth
    .command('login')
    .description('Login to Hermes Hub')
    .option('-e, --email <email>', 'Email address')
    .option('-p, --password <password>', 'Password')
    .action(async (options) => {
      if (isAuthenticated()) {
        const { email } = getAuthInfo();
        console.log(chalk.yellow(`⚠ Already logged in as ${chalk.bold(email)}`));
        const { proceed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: 'Login with a different account?',
            default: false,
          },
        ]);
        if (!proceed) return;
      }

      let { email, password } = options;

      if (!email || !password) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'email',
            message: 'Email:',
            default: email,
            validate: (v) => v.length > 0 || 'Email is required',
          },
          {
            type: 'password',
            name: 'password',
            message: 'Password:',
            mask: '*',
            validate: (v) => v.length > 0 || 'Password is required',
          },
        ]);
        email = answers.email;
        password = answers.password;
      }

      const spinner = createSpinner('🔐 Logging in...');
      spinner.start();

      try {
        const result = await api.login(email, password);
        spinner.succeed();

        setAuthInfo({
          token: result.token,
          userId: result.user?.id,
          email: result.user?.email || email,
        });

        console.log(chalk.green.bold('\n✅ Login successful!'));
        console.log(chalk.gray(`   User: ${result.user?.name || result.user?.email || email}`));
        if (result.user?.email) {
          console.log(chalk.gray(`   Email: ${result.user.email}`));
        }
        console.log();
      } catch (error) {
        spinner.fail();
        console.log(chalk.red.bold(`\n❌ Login failed: ${error.message}`));
        if (error.status === 401) {
          console.log(chalk.gray('   Check your email and password'));
        }
        process.exit(1);
      }
    });

  auth
    .command('register')
    .description('Register a new account')
    .option('-e, --email <email>', 'Email address')
    .option('-p, --password <password>', 'Password')
    .option('-n, --name <name>', 'Display name')
    .action(async (options) => {
      let { email, password, name } = options;

      if (!email || !password || !name) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Display name:',
            default: name,
            validate: (v) => v.length > 0 || 'Name is required',
          },
          {
            type: 'input',
            name: 'email',
            message: 'Email:',
            default: email,
            validate: (v) => /\S+@\S+\.\S+/.test(v) || 'Enter a valid email',
          },
          {
            type: 'password',
            name: 'password',
            message: 'Password (min 6 characters):',
            mask: '*',
            validate: (v) => v.length >= 6 || 'Password must be at least 6 characters',
          },
          {
            type: 'password',
            name: 'confirmPassword',
            message: 'Confirm password:',
            mask: '*',
          },
        ]);

        if (answers.password !== answers.confirmPassword) {
          console.log(chalk.red('\n❌ Passwords do not match'));
          process.exit(1);
        }

        email = answers.email;
        password = answers.password;
        name = answers.name;
      }

      const spinner = createSpinner('📝 Registering...');
      spinner.start();

      try {
        const result = await api.register(email, password, name);
        spinner.succeed();

        // Auto-login after registration
        if (result.token) {
          setAuthInfo({
            token: result.token,
            userId: result.user?.id,
            email: result.user?.email || email,
          });
          console.log(chalk.green.bold('\n✅ Registration successful! You are now logged in.'));
        } else {
          console.log(chalk.green.bold('\n✅ Registration successful! Please login:'));
          console.log(chalk.cyan('   hermes auth login'));
        }
        console.log();
      } catch (error) {
        spinner.fail();
        console.log(chalk.red.bold(`\n❌ Registration failed: ${error.message}`));
        process.exit(1);
      }
    });

  auth
    .command('status')
    .description('Show current authentication status')
    .action(async () => {
      console.log(chalk.cyan.bold('\n🔑 Authentication Status\n'));

      if (!isAuthenticated()) {
        console.log(chalk.red('  ❌ Not authenticated'));
        console.log(chalk.gray('  Login with: hermes auth login'));
        console.log();
        return;
      }

      const { token, userId, email } = getAuthInfo();
      console.log(chalk.green('  ✅ Authenticated'));
      console.log(chalk.white(`  Email: ${chalk.cyan(email || 'N/A')}`));
      console.log(chalk.white(`  User ID: ${chalk.gray(userId || 'N/A')}`));
      console.log(chalk.white(`  Token: ${chalk.gray(token ? token.substring(0, 20) + '...' : 'N/A')}`));

      // Verify token is still valid
      const spinner = createSpinner('Verifying token...');
      spinner.start();
      try {
        const me = await api.getMe();
        spinner.succeed();
        if (me.name) {
          console.log(chalk.white(`  Name: ${chalk.cyan(me.name)}`));
        }
      } catch {
        spinner.warn('Token may be expired');
        console.log(chalk.yellow('  ⚠ Token verification failed. You may need to re-login.'));
      }
      console.log();
    });

  auth
    .command('logout')
    .description('Logout and clear stored credentials')
    .action(() => {
      if (!isAuthenticated()) {
        console.log(chalk.yellow('⚠ Not currently logged in'));
        return;
      }

      const { email } = getAuthInfo();
      clearToken();
      console.log(chalk.green(`✅ Logged out${email ? ` (${email})` : ''}`));
      console.log(chalk.gray('   Credentials cleared'));
    });

  // Default action
  auth
    .action(() => {
      console.log(chalk.cyan('Available auth commands:'));
      console.log(chalk.white('  hermes auth login      ') + chalk.gray('Login to Hermes Hub'));
      console.log(chalk.white('  hermes auth register   ') + chalk.gray('Register a new account'));
      console.log(chalk.white('  hermes auth status     ') + chalk.gray('Show auth status'));
      console.log(chalk.white('  hermes auth logout     ') + chalk.gray('Clear credentials'));
      console.log();
    });
}
