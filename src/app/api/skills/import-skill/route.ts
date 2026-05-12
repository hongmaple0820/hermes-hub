import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

// AgentSkills spec name validation: ^[a-z0-9]+(-[a-z0-9]+)*$
const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// AgentSkills spec discovery paths (in priority order)
const DISCOVERY_PATHS = [
  '.agents/skills',
  'skills',
  '.claude/skills',
  '.cursor/skills',
];

interface ParsedSkill {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, unknown>;
  allowedTools?: string;
  instructions: string;
  sourcePath: string;
}

/**
 * Parse SKILL.md file with YAML frontmatter and Markdown body
 */
function parseSkillMd(content: string, sourcePath: string): ParsedSkill | null {
  // Match YAML frontmatter between --- delimiters
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    console.warn(`No valid frontmatter found in ${sourcePath}`);
    return null;
  }

  const [, frontmatterStr, body] = match;

  let frontmatter: Record<string, unknown>;
  try {
    frontmatter = yaml.load(frontmatterStr) as Record<string, unknown>;
  } catch (e) {
    console.warn(`Failed to parse YAML frontmatter in ${sourcePath}:`, e);
    return null;
  }

  const name = frontmatter.name as string;
  const description = frontmatter.description as string;

  if (!name || !description) {
    console.warn(`Missing required fields (name, description) in ${sourcePath}`);
    return null;
  }

  // Validate name per AgentSkills spec
  if (!SKILL_NAME_REGEX.test(name)) {
    console.warn(`Invalid skill name "${name}" in ${sourcePath}: must match ^[a-z0-9]+(-[a-z0-9]+)*$`);
    return null;
  }

  if (name.length > 64) {
    console.warn(`Skill name too long in ${sourcePath}: max 64 characters`);
    return null;
  }

  if (description.length > 1024) {
    console.warn(`Description too long in ${sourcePath}: max 1024 characters`);
    return null;
  }

  const compatibility = frontmatter.compatibility as string | undefined;
  if (compatibility && compatibility.length > 500) {
    console.warn(`Compatibility too long in ${sourcePath}: max 500 characters`);
    return null;
  }

  return {
    name,
    description,
    license: frontmatter.license as string | undefined,
    compatibility,
    metadata: frontmatter.metadata as Record<string, unknown> | undefined,
    allowedTools: frontmatter['allowed-tools'] as string | undefined,
    instructions: body.trim(),
    sourcePath,
  };
}

/**
 * Recursively scan a directory for SKILL.md files
 */
function scanForSkillMds(dir: string, basePath: string = ''): string[] {
  const results: string[] = [];

  if (!existsSync(dir)) return results;

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      // Skip hidden directories (except .agents, .claude, .cursor)
      if (entry.startsWith('.') && !['.agents', '.claude', '.cursor'].includes(entry)) continue;
      // Skip common non-skill directories
      if (['node_modules', '.git', 'dist', 'build', '__pycache__', 'venv'].includes(entry)) continue;

      const fullPath = join(dir, entry);
      const relativePath = basePath ? `${basePath}/${entry}` : entry;

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          // Check if this directory contains SKILL.md
          const skillMdPath = join(fullPath, 'SKILL.md');
          if (existsSync(skillMdPath)) {
            results.push(relativePath);
          }
          // Recurse into subdirectories
          results.push(...scanForSkillMds(fullPath, relativePath));
        }
      } catch {
        // Skip entries we can't stat
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return results;
}

/**
 * Discover skills from a cloned repo using AgentSkills spec discovery paths
 */
function discoverSkills(repoDir: string, specificPath?: string): ParsedSkill[] {
  const discovered: ParsedSkill[] = [];

  if (specificPath) {
    // If a specific path is provided, look for SKILL.md there
    const skillMdPath = join(repoDir, specificPath, 'SKILL.md');
    if (existsSync(skillMdPath)) {
      const content = readFileSync(skillMdPath, 'utf-8');
      const parsed = parseSkillMd(content, specificPath);
      if (parsed) discovered.push(parsed);
    } else {
      // Maybe the path points directly to SKILL.md
      const directPath = join(repoDir, specificPath);
      if (existsSync(directPath) && directPath.endsWith('SKILL.md')) {
        const content = readFileSync(directPath, 'utf-8');
        const parsed = parseSkillMd(content, specificPath.replace('/SKILL.md', ''));
        if (parsed) discovered.push(parsed);
      }
    }
    return discovered;
  }

  // Scan AgentSkills spec discovery paths in priority order
  for (const discoveryPath of DISCOVERY_PATHS) {
    const fullPath = join(repoDir, discoveryPath);
    if (!existsSync(fullPath)) continue;

    const skillDirs = scanForSkillMds(fullPath);
    for (const skillDir of skillDirs) {
      const skillMdPath = join(fullPath, skillDir.replace(discoveryPath + '/', ''), 'SKILL.md');
      const actualPath = join(repoDir, discoveryPath, skillDir.replace(discoveryPath + '/', ''), 'SKILL.md');

      if (existsSync(actualPath)) {
        const content = readFileSync(actualPath, 'utf-8');
        const parsed = parseSkillMd(content, `${discoveryPath}/${skillDir}`);
        if (parsed) discovered.push(parsed);
      }
    }
  }

  // If no skills found in discovery paths, do a broader scan
  if (discovered.length === 0) {
    const allSkillDirs = scanForSkillMds(repoDir);
    for (const skillDir of allSkillDirs) {
      const skillMdPath = join(repoDir, skillDir, 'SKILL.md');
      if (existsSync(skillMdPath)) {
        const content = readFileSync(skillMdPath, 'utf-8');
        const parsed = parseSkillMd(content, skillDir);
        if (parsed) discovered.push(parsed);
      }
    }
  }

  return discovered;
}

export async function POST(request: NextRequest) {
  const tempDirs: string[] = [];

  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { sourceUrl, skillPath } = body;

    if (!sourceUrl) {
      return NextResponse.json(
        { error: 'Missing required field', details: 'sourceUrl is required' },
        { status: 400 }
      );
    }

    // Validate sourceUrl is a valid git URL
    if (!sourceUrl.match(/^https?:\/\/.+|git@.+/)) {
      return NextResponse.json(
        { error: 'Invalid source URL', details: 'sourceUrl must be a valid git repository URL' },
        { status: 400 }
      );
    }

    // Clone the repo to a temp directory
    const tempDir = join('/tmp', `agentskills-import-${Date.now()}`);
    tempDirs.push(tempDir);

    try {
      execSync(`git clone --depth 1 ${JSON.stringify(sourceUrl)} ${JSON.stringify(tempDir)} 2>&1`, {
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (cloneError) {
      return NextResponse.json(
        {
          error: 'Failed to clone repository',
          details: cloneError instanceof Error ? cloneError.message : 'Git clone failed. Check the URL and try again.',
        },
        { status: 400 }
      );
    }

    // Discover SKILL.md files
    const discovered = discoverSkills(tempDir, skillPath);

    if (discovered.length === 0) {
      return NextResponse.json(
        {
          error: 'No skills found',
          details: 'No SKILL.md files found in the repository. Checked AgentSkills discovery paths: .agents/skills/*/SKILL.md, skills/*/SKILL.md',
        },
        { status: 404 }
      );
    }

    // Import each discovered skill
    const imported: Array<{ name: string; status: 'created' | 'updated' | 'skipped' }> = [];
    const errors: Array<{ name: string; error: string }> = [];

    for (const skillData of discovered) {
      try {
        const existing = await db.skill.findUnique({
          where: { name: skillData.name },
        });

        const skillRecord = {
          name: skillData.name,
          displayName: skillData.name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          description: skillData.description,
          license: skillData.license || null,
          compatibility: skillData.compatibility || null,
          metadata: JSON.stringify(skillData.metadata || { author: user.name, version: '1.0' }),
          allowedTools: skillData.allowedTools || null,
          instructions: skillData.instructions,
          category: 'general',
          sourceType: 'git',
          sourceUrl,
          sourcePath: skillData.sourcePath,
          installedAt: new Date(),
        };

        if (existing) {
          // Update existing skill with new data from the source
          await db.skill.update({
            where: { id: existing.id },
            data: {
              description: skillRecord.description,
              license: skillRecord.license,
              compatibility: skillRecord.compatibility,
              metadata: skillRecord.metadata,
              allowedTools: skillRecord.allowedTools,
              instructions: skillRecord.instructions,
              sourceUrl: skillRecord.sourceUrl,
              sourcePath: skillRecord.sourcePath,
              installedAt: skillRecord.installedAt,
            },
          });
          imported.push({ name: skillData.name, status: 'updated' });
        } else {
          await db.skill.create({ data: skillRecord });
          imported.push({ name: skillData.name, status: 'created' });
        }
      } catch (skillError) {
        errors.push({
          name: skillData.name,
          error: skillError instanceof Error ? skillError.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: `Import complete: ${imported.length} skills processed, ${errors.length} errors`,
      imported,
      errors: errors.length > 0 ? errors : undefined,
      sourceUrl,
      totalDiscovered: discovered.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Import skill error:', error);
    return NextResponse.json(
      { error: 'Failed to import skills', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    // Clean up temp directories
    for (const tempDir of tempDirs) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
