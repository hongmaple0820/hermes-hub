import inquirer from 'inquirer';
import chalk from 'chalk';
import api from '../lib/api.js';
import { isAuthenticated } from '../lib/config-store.js';
import { createSpinner } from '../lib/spinner.js';

export function registerSkillCommand(program) {
  const skill = program
    .command('skill')
    .description('Manage skills');

  skill
    .command('list')
    .description('List available skills')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      if (!isAuthenticated()) {
        console.log(chalk.red('❌ Not authenticated. Run: hermes auth login'));
        process.exit(1);
      }

      const spinner = createSpinner('🔧 Loading skills...');
      spinner.start();

      try {
        const result = await api.listSkills();
        spinner.succeed();

        const skills = Array.isArray(result) ? result : (result.skills || []);

        if (skills.length === 0) {
          console.log(chalk.yellow('\n📭 No skills found'));
          console.log(chalk.gray('  Create one with: hermes skill add'));
          console.log();
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(skills, null, 2));
          return;
        }

        console.log(chalk.cyan.bold(`\n🔧 Skills (${skills.length})\n`));
        for (const s of skills) {
          const installed = s.installed ? chalk.green('✓') : chalk.gray('○');
          const category = s.category ? chalk.gray(`[${s.category}]`) : '';
          console.log(`  ${installed} ${chalk.bold(s.name)} ${category} ${chalk.gray(`(${s.id})`)}`);
          if (s.description) {
            console.log(chalk.gray(`    ${s.description.substring(0, 80)}`));
          }
        }
        console.log();
      } catch (error) {
        spinner.fail();
        console.log(chalk.red.bold(`\n❌ Failed to list skills: ${error.message}`));
        process.exit(1);
      }
    });

  skill
    .command('add')
    .description('Add a skill to an agent')
    .argument('[skillId]', 'Skill ID')
    .option('-a, --agent <agentId>', 'Agent ID')
    .action(async (skillId, options) => {
      if (!isAuthenticated()) {
        console.log(chalk.red('❌ Not authenticated. Run: hermes auth login'));
        process.exit(1);
      }

      let agentId = options.agent;
      let targetSkillId = skillId;

      // Interactive selection if not provided
      if (!targetSkillId || !agentId) {
        const spinner = createSpinner('Loading...');
        spinner.start();

        let skills = [];
        let agents = [];

        try {
          const [skillResult, agentResult] = await Promise.all([
            api.listSkills(),
            api.listAgents(),
          ]);
          skills = Array.isArray(skillResult) ? skillResult : (skillResult.skills || []);
          agents = Array.isArray(agentResult) ? agentResult : (agentResult.agents || []);
        } catch (error) {
          spinner.fail();
          console.log(chalk.red(`❌ Failed to load data: ${error.message}`));
          process.exit(1);
        }
        spinner.stop();

        const answers = await inquirer.prompt([
          {
            type: 'list',
            name: 'agentId',
            message: 'Select agent:',
            choices: agents.map(a => ({ name: `${a.name} (${a.id})`, value: a.id })),
            when: !agentId,
          },
          {
            type: 'list',
            name: 'skillId',
            message: 'Select skill to add:',
            choices: skills.map(s => ({ name: `${s.name} - ${s.description?.substring(0, 50) || s.id}`, value: s.id })),
            when: !targetSkillId,
          },
        ]);

        agentId = agentId || answers.agentId;
        targetSkillId = targetSkillId || answers.skillId;
      }

      const spinner = createSpinner('🔧 Adding skill to agent...');
      spinner.start();

      try {
        await api.installSkill(agentId, targetSkillId);
        spinner.succeed();
        console.log(chalk.green(`✅ Skill ${chalk.bold(targetSkillId)} added to agent ${chalk.bold(agentId)}`));
      } catch (error) {
        spinner.fail();
        console.log(chalk.red.bold(`\n❌ Failed to add skill: ${error.message}`));
        process.exit(1);
      }
    });

  skill
    .command('remove')
    .description('Remove a skill from an agent')
    .argument('<skillId>', 'Skill ID')
    .option('-a, --agent <agentId>', 'Agent ID')
    .action(async (skillId, options) => {
      if (!isAuthenticated()) {
        console.log(chalk.red('❌ Not authenticated. Run: hermes auth login'));
        process.exit(1);
      }

      if (!options.agent) {
        console.log(chalk.red('❌ Agent ID is required. Use -a, --agent <agentId>'));
        process.exit(1);
      }

      const spinner = createSpinner('🔧 Removing skill...');
      spinner.start();

      try {
        await api.uninstallSkill(options.agent, skillId);
        spinner.succeed();
        console.log(chalk.green(`✅ Skill ${chalk.bold(skillId)} removed from agent ${chalk.bold(options.agent)}`));
      } catch (error) {
        spinner.fail();
        console.log(chalk.red.bold(`\n❌ Failed to remove skill: ${error.message}`));
        process.exit(1);
      }
    });

  // Default action
  skill
    .action(() => {
      console.log(chalk.cyan('Available skill commands:'));
      console.log(chalk.white('  hermes skill list             ') + chalk.gray('List available skills'));
      console.log(chalk.white('  hermes skill add [skillId]    ') + chalk.gray('Add a skill to an agent'));
      console.log(chalk.white('  hermes skill remove <skillId> ') + chalk.gray('Remove a skill from an agent'));
      console.log();
    });
}
