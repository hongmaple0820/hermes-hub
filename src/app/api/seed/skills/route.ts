import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const DEFAULT_SKILLS = [
  {
    name: 'commit-helper',
    displayName: 'Commit Helper',
    description: 'Generates conventional commit messages from staged changes. Analyzes git diff output and produces well-structured commit messages following the Conventional Commits specification.',
    category: 'development',
    icon: 'GitCommit',
    license: 'MIT',
    compatibility: 'Works with any git repository. Requires git CLI available in PATH.',
    metadata: JSON.stringify({ author: 'nathan', version: '1.0' }),
    allowedTools: 'Bash(git:*) Read',
    instructions: `## Instructions

When the user asks you to commit, examine the staged changes with
\`git diff --cached\` and generate a conventional commit message.

Follow these rules:
1. Use the Conventional Commits format: \`type(scope): description\`
2. Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
3. Scope is optional but recommended for monorepos or large projects
4. Description should be imperative mood ("add feature" not "added feature")
5. If there are breaking changes, add \`BREAKING CHANGE:\` in the footer
6. Include a body if the changes are complex or non-obvious

If no changes are staged, remind the user to stage files with \`git add\`.
If both staged and unstaged changes exist, warn the user that unstaged changes won't be included.`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'scope', type: 'string', required: false, description: 'Optional scope for the commit message' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'code-review',
    displayName: 'Code Review',
    description: 'Performs thorough code review on changes or specific files. Identifies bugs, security issues, performance problems, and style violations with actionable suggestions.',
    category: 'development',
    icon: 'Code',
    license: 'MIT',
    compatibility: 'Works with any programming language. Best results with TypeScript, Python, and JavaScript.',
    metadata: JSON.stringify({ author: 'sarah', version: '1.2' }),
    allowedTools: 'Read Bash(git:*)',
    instructions: `## Instructions

When the user asks for a code review, analyze the provided code or changes
systematically. Follow this review framework:

1. **Correctness**: Does the code do what it's supposed to do? Look for logic errors,
   off-by-one errors, null/undefined handling, and edge cases.
2. **Security**: Check for injection vulnerabilities, insecure data handling,
   exposed secrets, and authentication/authorization issues.
3. **Performance**: Identify unnecessary computations, memory leaks, N+1 queries,
   and opportunities for optimization.
4. **Maintainability**: Assess code readability, naming conventions, function length,
   and adherence to project style guides.
5. **Testing**: Are there sufficient tests? Do tests cover edge cases?

Format your review as:
- 🔴 **Critical**: Issues that must be fixed (bugs, security vulnerabilities)
- 🟡 **Warning**: Issues that should be fixed (performance, maintainability)
- 🟢 **Suggestion**: Nice-to-have improvements (style, refactoring)

Always provide specific line references and code suggestions for fixes.`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'filePath', type: 'string', required: false, description: 'Specific file to review' },
      { name: 'focus', type: 'string', required: false, description: 'Focus area: security, performance, style, all' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'test-writer',
    displayName: 'Test Writer',
    description: 'Generates comprehensive unit tests for functions, classes, and modules. Supports Jest, Vitest, pytest, and other testing frameworks with proper mocking and assertions.',
    category: 'development',
    icon: 'TestTube',
    license: 'MIT',
    compatibility: 'Supports Jest, Vitest, pytest, and Go testing frameworks. Works best with TypeScript and Python.',
    metadata: JSON.stringify({ author: 'mike', version: '1.1' }),
    allowedTools: 'Read Write Bash(npm:* Bash(npx:*)',
    instructions: `## Instructions

When the user asks you to write tests, first examine the source code to understand
what needs to be tested. Then generate comprehensive test suites.

Follow these principles:
1. **Test structure**: Use the Arrange-Act-Assert pattern
2. **Coverage**: Test happy paths, edge cases, error conditions, and boundary values
3. **Naming**: Use descriptive test names that explain the expected behavior
4. **Mocking**: Mock external dependencies (APIs, databases, file systems)
5. **Isolation**: Each test should be independent and not rely on other tests
6. **Deterministic**: Tests should produce the same results every time

For each function/method, generate tests for:
- Normal/expected inputs (happy path)
- Empty/null/undefined inputs
- Boundary values (0, MAX, MIN)
- Invalid inputs and error handling
- Side effects and state changes

Use the project's existing test framework and patterns. If no tests exist yet,
set up the framework and create the first test file.`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'filePath', type: 'string', required: true, description: 'Path to the source file to test' },
      { name: 'framework', type: 'string', required: false, description: 'Testing framework (jest, vitest, pytest)' },
      { name: 'coverageTarget', type: 'number', required: false, description: 'Target coverage percentage' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'doc-generator',
    displayName: 'Doc Generator',
    description: 'Generates documentation from source code including API docs, README files, JSDoc/TSDoc comments, and architecture diagrams. Supports OpenAPI, TypeDoc, and JSDoc formats.',
    category: 'development',
    icon: 'FileText',
    license: 'Apache-2.0',
    compatibility: 'Works with TypeScript, JavaScript, Python. Generates Markdown, HTML, and OpenAPI specs.',
    metadata: JSON.stringify({ author: 'emma', version: '2.0' }),
    allowedTools: 'Read Write Bash(npm:*)',
    instructions: `## Instructions

When the user asks you to generate documentation, analyze the source code and
produce clear, comprehensive documentation.

For API documentation:
1. Document all public endpoints with HTTP method, path, description
2. Include request/response schemas with examples
3. Document authentication requirements
4. Include error responses and their meanings
5. Generate OpenAPI 3.0 spec if requested

For code documentation:
1. Add JSDoc/TSDoc comments to all exported functions and classes
2. Include @param, @returns, @throws tags
3. Add usage examples for complex APIs
4. Document side effects and important behaviors

For README files:
1. Start with a clear project description
2. Include installation instructions
3. Provide quick start examples
4. Document configuration options
5. Include a contributing guide if appropriate

Always match the project's existing documentation style and conventions.`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'type', type: 'string', required: true, description: 'Documentation type: api, readme, jsdoc, openapi' },
      { name: 'filePath', type: 'string', required: false, description: 'Source file to document' },
      { name: 'format', type: 'string', required: false, description: 'Output format: markdown, html, json' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'api-designer',
    displayName: 'API Designer',
    description: 'Designs RESTful APIs with proper resource modeling, endpoint design, authentication, versioning, and error handling. Generates OpenAPI specifications and implementation scaffolding.',
    category: 'development',
    icon: 'Globe',
    license: 'MIT',
    compatibility: 'Generates OpenAPI 3.0 specs. Works with Express, Fastify, Next.js API routes, and FastAPI.',
    metadata: JSON.stringify({ author: 'alex', version: '1.3' }),
    allowedTools: 'Read Write Bash(npm:*)',
    instructions: `## Instructions

When the user asks you to design an API, follow RESTful best practices:

1. **Resource Modeling**: Identify nouns (resources) from requirements. Use plural
   resource names (e.g., /users, /articles). Design resource relationships.

2. **Endpoint Design**: Use standard HTTP methods semantically:
   - GET for retrieval (never modify data)
   - POST for creation
   - PUT for full replacement
   - PATCH for partial updates
   - DELETE for removal

3. **URL Structure**: Use nested resources for relationships (/users/:id/posts),
   query parameters for filtering/sorting/pagination.

4. **Versioning**: Prefer URL-based versioning (/v1/users) or header-based
   (Accept: application/vnd.api.v1+json).

5. **Authentication**: Design with Bearer tokens or API keys. Document required
   scopes per endpoint.

6. **Error Handling**: Use consistent error format with RFC 7807 Problem Details.
   Include error code, message, and optional details.

7. **Pagination**: Use cursor-based or offset pagination with metadata.

Generate a complete OpenAPI 3.0 specification as the primary deliverable.`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'description', type: 'string', required: true, description: 'Description of the API to design' },
      { name: 'framework', type: 'string', required: false, description: 'Target framework (express, fastify, nextjs, fastapi)' },
      { name: 'authType', type: 'string', required: false, description: 'Authentication type (bearer, apikey, oauth2)' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'db-analyzer',
    displayName: 'DB Analyzer',
    description: 'Analyzes database schemas, identifies optimization opportunities, suggests indexes, detects normalization issues, and generates migration strategies. Supports SQL and NoSQL databases.',
    category: 'data',
    icon: 'Database',
    license: 'MIT',
    compatibility: 'Works with Prisma schemas, SQL DDL, MongoDB document samples. Best with PostgreSQL and SQLite.',
    metadata: JSON.stringify({ author: 'carlos', version: '1.0' }),
    allowedTools: 'Read Bash(npx:prisma:*)',
    instructions: `## Instructions

When the user asks you to analyze a database, examine the schema and provide
a comprehensive analysis:

1. **Schema Review**:
   - Check for proper normalization (1NF, 2NF, 3NF)
   - Identify redundant data and denormalization opportunities
   - Verify foreign key relationships and cascading behavior
   - Check for appropriate data types and constraints

2. **Index Analysis**:
   - Identify missing indexes based on common query patterns
   - Detect unused or redundant indexes
   - Suggest composite indexes for multi-column queries
   - Recommend partial indexes for filtered queries

3. **Performance Issues**:
   - Find N+1 query opportunities
   - Detect potential deadlocks from lock ordering
   - Identify expensive JOINs that could benefit from denormalization
   - Check for missing pagination in queries

4. **Migration Strategy**:
   - Generate safe migration scripts (non-destructive)
   - Plan zero-downtime migrations for production
   - Suggest data backfill strategies

5. **Security**:
   - Check for SQL injection vulnerabilities in raw queries
   - Verify proper access control at the data layer
   - Identify sensitive data that should be encrypted

Always provide specific SQL or Prisma migration code for recommendations.`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'schemaPath', type: 'string', required: false, description: 'Path to Prisma schema or SQL DDL file' },
      { name: 'focus', type: 'string', required: false, description: 'Analysis focus: performance, normalization, indexes, all' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'security-scanner',
    displayName: 'Security Scanner',
    description: 'Scans code for security vulnerabilities including injection attacks, authentication flaws, insecure dependencies, and data exposure. Provides OWASP Top 10 coverage with remediation guidance.',
    category: 'development',
    icon: 'Shield',
    license: 'MIT',
    compatibility: 'Works with any codebase. Best results with web applications using TypeScript/JavaScript, Python.',
    metadata: JSON.stringify({ author: 'priya', version: '1.4' }),
    allowedTools: 'Read Bash(npm:*) Bash(npx:*)',
    instructions: `## Instructions

When the user asks for a security scan, systematically check the codebase for
vulnerabilities based on the OWASP Top 10:

1. **Injection (A01)**: Check for SQL injection, NoSQL injection, command injection,
   and LDAP injection in user inputs. Look for string concatenation in queries.

2. **Broken Authentication (A02)**: Verify session management, password storage,
   multi-factor authentication, and credential recovery flows.

3. **Sensitive Data Exposure (A03)**: Check for hardcoded secrets, unencrypted
   sensitive data, missing TLS, and improper error messages leaking internals.

4. **XXE (A04)**: Look for XML parsing without disabled external entities.

5. **Broken Access Control (A05)**: Verify authorization checks, IDOR vulnerabilities,
   and proper CORS configuration.

6. **Security Misconfiguration (A06)**: Check for default credentials, unnecessary
   features enabled, verbose error messages, and missing security headers.

7. **Cross-Site Scripting (A07)**: Identify XSS vulnerabilities in template rendering,
   DOM manipulation, and URL parameters.

8. **Insecure Deserialization (A08)**: Check for unsafe pickle, yaml.load, and
   JSON.parse with eval patterns.

9. **Known Vulnerabilities (A09)**: Scan package.json/requirements.txt for
   known vulnerable dependencies.

10. **SSRF (A10)**: Check for server-side requests with user-controlled URLs.

Report findings with severity (Critical/High/Medium/Low), affected code location,
and specific remediation steps.`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'path', type: 'string', required: false, description: 'Directory or file to scan' },
      { name: 'severity', type: 'string', required: false, description: 'Minimum severity to report: critical, high, medium, low' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'perf-optimizer',
    displayName: 'Performance Optimizer',
    description: 'Analyzes code for performance bottlenecks and suggests optimizations. Covers algorithmic complexity, memory usage, caching strategies, bundle size, and runtime performance.',
    category: 'development',
    icon: 'Gauge',
    license: 'MIT',
    compatibility: 'Works with any codebase. Specialized for JavaScript/TypeScript and Python performance analysis.',
    metadata: JSON.stringify({ author: 'kai', version: '1.1' }),
    allowedTools: 'Read Write Bash(node:*) Bash(npm:*)',
    instructions: `## Instructions

When the user asks for performance optimization, analyze the code with these
categories:

1. **Algorithmic Complexity**: Identify O(n²) or worse algorithms that could be
   optimized. Look for nested loops, recursive calls without memoization, and
   unnecessary data structure traversals.

2. **Memory Usage**: Detect memory leaks (event listeners not cleaned up,
   closures retaining references, growing caches). Identify large object
   allocations and suggest streaming or chunking.

3. **Caching Opportunities**: Find repeated computations that could be memoized.
   Suggest appropriate cache invalidation strategies. Recommend CDN caching
   for static assets.

4. **Bundle Size (Frontend)**: Identify large dependencies, unused code,
   and opportunities for code splitting. Suggest lazy loading for routes
   and heavy components.

5. **Database Performance**: Find N+1 queries, missing indexes, and
   unnecessary data fetching. Suggest query optimization and connection pooling.

6. **Runtime Performance**: Identify unnecessary re-renders (React), suggest
   Web Workers for CPU-intensive tasks, and recommend efficient data structures.

Provide before/after code examples for each optimization with expected
performance improvement estimates.`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'filePath', type: 'string', required: false, description: 'File to optimize' },
      { name: 'focus', type: 'string', required: false, description: 'Optimization focus: algorithms, memory, caching, bundle, all' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'i18n-helper',
    displayName: 'i18n Helper',
    description: 'Assists with internationalization and localization. Extracts translatable strings, manages translation files, handles pluralization rules, and generates locale-specific content for multiple languages.',
    category: 'productivity',
    icon: 'Languages',
    license: 'MIT',
    compatibility: 'Works with i18next, react-intl, next-intl, and custom i18n setups. Supports JSON and YAML translation files.',
    metadata: JSON.stringify({ author: 'yuki', version: '1.0' }),
    allowedTools: 'Read Write Bash(npm:*)',
    instructions: `## Instructions

When the user asks for i18n help, follow these guidelines:

1. **String Extraction**: Scan source code for hardcoded user-facing strings.
   Replace them with translation function calls (t(), i18n.t(), formatMessage()).
   Generate the corresponding translation key entries.

2. **Translation File Management**: Keep translation files (JSON/YAML) in sync
   across all locales. When adding a key to one locale, add placeholder entries
   to all other locales with a clear marker like "[UNTRANSLATED]".

3. **Key Naming Convention**: Use nested dot notation that reflects the UI
   structure: \`section.component.element.state\` (e.g., "dashboard.stats.onlineAgents").

4. **Pluralization**: Use the i18n framework's pluralization support. For
   English: \`{count} item\` / \`{count} items\`. For languages with complex
   plural rules (Russian, Arabic), use the appropriate ICU MessageFormat.

5. **RTL Support**: When adding new locales, flag RTL languages (Arabic, Hebrew,
   Farsi) and ensure CSS uses logical properties (start/end instead of left/right).

6. **Best Practices**:
   - Never concatenate translated strings
   - Use interpolation for variables: \`Hello, {name}\`
   - Provide context comments for translators
   - Keep translation keys stable across versions

When generating translations for non-English locales, provide high-quality
translations that respect cultural nuances, not just literal translations.`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'action', type: 'string', required: true, description: 'Action: extract, translate, sync, validate' },
      { name: 'locales', type: 'string', required: false, description: 'Comma-separated locale codes (e.g., en,zh,ja,ko)' },
      { name: 'filePath', type: 'string', required: false, description: 'Source file or translation directory path' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'deploy-manager',
    displayName: 'Deploy Manager',
    description: 'Manages deployment workflows including building, testing, and deploying applications. Supports Docker, Kubernetes, and serverless platforms with environment-specific configurations.',
    category: 'productivity',
    icon: 'Rocket',
    license: 'Apache-2.0',
    compatibility: 'Supports Docker, Kubernetes, Vercel, AWS Lambda, and Railway. Requires appropriate CLI tools installed.',
    metadata: JSON.stringify({ author: 'jordan', version: '1.5' }),
    allowedTools: 'Read Write Bash(docker:*) Bash(kubectl:*) Bash(npm:*)',
    instructions: `## Instructions

When the user asks about deployment, help them with the deployment lifecycle:

1. **Pre-deployment Checks**:
   - Verify environment variables are set for the target environment
   - Run the test suite to ensure no regressions
   - Check for uncommitted changes in git
   - Validate configuration files (Dockerfile, k8s manifests, serverless.yml)

2. **Build Process**:
   - Generate optimized production builds
   - Create Docker images with minimal layers
   - Tag builds with semantic versioning

3. **Deployment Strategies**:
   - **Rolling update**: Default for Kubernetes, zero-downtime
   - **Blue-Green**: Switch traffic between two identical environments
   - **Canary**: Gradually shift traffic to the new version
   - **Feature flags**: Deploy behind flags for controlled rollout

4. **Environment Management**:
   - Manage separate configurations for dev, staging, production
   - Never expose production secrets in non-production environments
   - Use environment-specific database connections

5. **Post-deployment Verification**:
   - Run smoke tests against the deployed endpoint
   - Check health endpoints
   - Monitor error rates and response times
   - Verify database migrations completed successfully

6. **Rollback**: Always have a rollback plan. Document how to quickly revert
   to the previous version if issues arise.

Never deploy to production without explicit user confirmation.`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'action', type: 'string', required: true, description: 'Action: prepare, build, deploy, rollback, status' },
      { name: 'environment', type: 'string', required: false, description: 'Target environment: staging, production' },
      { name: 'platform', type: 'string', required: false, description: 'Deployment platform: docker, k8s, vercel, lambda, railway' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'debug-assistant',
    displayName: 'Debug Assistant',
    description: 'Helps debug issues by analyzing error messages, tracing code execution, examining logs, and suggesting fixes. Supports systematic debugging methodology with root cause analysis.',
    category: 'development',
    icon: 'Bug',
    license: 'MIT',
    compatibility: 'Works with any programming language. Best with TypeScript, JavaScript, and Python error stacks.',
    metadata: JSON.stringify({ author: 'chen', version: '1.2' }),
    allowedTools: 'Read Bash(node:*) Bash(npm:*) Bash(git:*)',
    instructions: `## Instructions

When the user asks for debugging help, follow a systematic approach:

1. **Understand the Problem**:
   - Read the error message carefully — it often contains the exact issue
   - Identify the error type (TypeError, ReferenceError, RuntimeError, etc.)
   - Note the stack trace and the line numbers involved
   - Ask clarifying questions if the error description is vague

2. **Reproduce the Issue**:
   - Identify the minimal steps to reproduce
   - Check if it's environment-specific (dev vs prod, OS, Node version)
   - Verify the issue exists in the current code state

3. **Analyze the Code**:
   - Read the file(s) mentioned in the stack trace
   - Trace the execution flow from the entry point to the error
   - Check variable types and values at each step
   - Look for common patterns: off-by-one, null/undefined, race conditions

4. **Identify Root Cause**:
   - Don't just fix the symptom — find the underlying cause
   - Check recent git changes: \`git log --oneline -10\`
   - Look for related issues in the same area of code
   - Consider whether the issue could affect other parts of the system

5. **Propose Fix**:
   - Provide a specific code change with explanation
   - Consider edge cases the fix might introduce
   - Suggest a test that would have caught this bug
   - If multiple fixes are possible, explain trade-offs

6. **Verify**:
   - Suggest how to verify the fix works
   - Check for similar issues elsewhere in the codebase
   - Recommend monitoring or logging improvements

Never skip to a solution without understanding the root cause.`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'error', type: 'string', required: false, description: 'Error message or description' },
      { name: 'filePath', type: 'string', required: false, description: 'File where error occurs' },
      { name: 'stackTrace', type: 'string', required: false, description: 'Stack trace if available' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'data-analyst',
    displayName: 'Data Analyst',
    description: 'Analyzes datasets, generates statistics, creates visualizations, and extracts insights from data. Supports CSV, JSON, and database sources with statistical analysis and chart generation.',
    category: 'data',
    icon: 'BarChart3',
    license: 'MIT',
    compatibility: 'Works with CSV, JSON, and SQL data sources. Generates charts using matplotlib, D3.js, or ECharts.',
    metadata: JSON.stringify({ author: 'nina', version: '1.3' }),
    allowedTools: 'Read Write Bash(node:*) Bash(python:*)',
    instructions: `## Instructions

When the user asks for data analysis, follow this workflow:

1. **Data Loading & Inspection**:
   - Load the data from the provided source (CSV, JSON, database)
   - Display basic info: row count, column types, missing values
   - Show the first few rows for a quick overview
   - Identify the data types (numerical, categorical, datetime, text)

2. **Descriptive Statistics**:
   - For numerical columns: mean, median, std, min, max, quartiles
   - For categorical columns: unique values, frequency distribution, mode
   - For datetime columns: range, distribution over time
   - Calculate correlation between numerical features

3. **Data Cleaning**:
   - Identify and handle missing values (impute or drop)
   - Detect and handle outliers (IQR method or z-score)
   - Standardize inconsistent formatting (dates, categories)
   - Remove duplicate records

4. **Analysis & Insights**:
   - Identify trends, patterns, and anomalies
   - Perform grouping and aggregation as relevant
   - Run statistical tests if hypotheses need validation
   - Generate actionable insights from the data

5. **Visualization**:
   - Choose appropriate chart types for the data
   - Bar charts for categorical comparisons
   - Line charts for trends over time
   - Scatter plots for relationships
   - Heatmaps for correlation matrices
   - Always include proper labels, titles, and legends

6. **Report**:
   - Summarize key findings in plain language
   - Include supporting statistics and visualizations
   - Note limitations and assumptions
   - Suggest further analysis if warranted`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'source', type: 'string', required: true, description: 'Data source: file path, URL, or SQL query' },
      { name: 'analysis', type: 'string', required: false, description: 'Analysis type: summary, trend, comparison, correlation, outlier' },
      { name: 'visualize', type: 'boolean', required: false, description: 'Generate visualizations (default: true)' },
    ]),
    sourceType: 'built-in',
  },
];

export async function POST() {
  try {
    let created = 0;
    let skipped = 0;

    for (const skillData of DEFAULT_SKILLS) {
      const existing = await db.skill.findUnique({
        where: { name: skillData.name },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await db.skill.create({ data: skillData });
      created++;
    }

    return NextResponse.json({
      message: `Skills seeded: ${created} created, ${skipped} already existed`,
      created,
      skipped,
      total: DEFAULT_SKILLS.length,
    });
  } catch (error) {
    console.error('Seed skills error:', error);
    return NextResponse.json(
      { error: 'Failed to seed skills', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
