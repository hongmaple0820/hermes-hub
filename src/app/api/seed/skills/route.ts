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
  {
    name: 'email-sender',
    displayName: 'Email Sender',
    description: 'Sends emails via webhook integration with popular email services. Supports templated emails, attachments, and batch sending through providers like SendGrid, Mailgun, or SMTP.',
    category: 'communication',
    icon: 'Mail',
    license: 'MIT',
    compatibility: 'Works with SendGrid, Mailgun, AWS SES, or any SMTP relay. Requires webhook endpoint configured.',
    metadata: JSON.stringify({ author: 'lisa', version: '1.0' }),
    allowedTools: 'Bash(curl:*)',
    instructions: `## Instructions

When the user asks to send an email, follow these steps:

1. **Collect Required Information**:
   - Recipient email address(es)
   - Subject line
   - Email body (plain text or HTML)
   - Optional: CC, BCC, attachments

2. **Template Support**:
   - If the user provides a template name, look it up and fill in variables
   - Support common template variables: {{name}}, {{date}}, {{company}}
   - Validate all required variables are provided

3. **Sending**:
   - Use the configured webhook endpoint to dispatch the email
   - For batch sending, respect rate limits (max 100 per batch)
   - Include a preview of the email before sending when possible

4. **Validation**:
   - Validate email addresses before sending
   - Confirm with the user before sending to large distributions
   - Never send to more than 1000 recipients without explicit confirmation

5. **Error Handling**:
   - If the webhook fails, report the error clearly
   - Suggest checking webhook configuration if persistent failures`,
    handlerType: 'webhook',
    parameters: JSON.stringify([
      { name: 'to', type: 'string', required: true, description: 'Recipient email address(es), comma-separated' },
      { name: 'subject', type: 'string', required: true, description: 'Email subject line' },
      { name: 'body', type: 'string', required: true, description: 'Email body content (plain text or HTML)' },
      { name: 'template', type: 'string', required: false, description: 'Template name to use' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'translation',
    displayName: 'Translation',
    description: 'Translates text between languages with context-aware accuracy. Supports 100+ languages with automatic language detection, formal/informal tone adjustment, and domain-specific terminology.',
    category: 'communication',
    icon: 'Languages',
    license: 'MIT',
    compatibility: 'Works with any text input. Supports 100+ languages including CJK, RTL, and Latin scripts.',
    metadata: JSON.stringify({ author: 'yuki', version: '1.1' }),
    allowedTools: 'Read',
    instructions: `## Instructions

When the user asks for translation, follow these guidelines:

1. **Language Detection**: If the source language is not specified, detect it automatically.

2. **Translation Quality**:
   - Translate meaning and intent, not just word-by-word
   - Preserve the original tone (formal, casual, technical)
   - Maintain formatting (headers, lists, code blocks)
   - Keep proper nouns and technical terms untranslated when appropriate

3. **Context Awareness**:
   - Consider the domain (technical, legal, medical, casual)
   - Use domain-appropriate terminology
   - When ambiguous, provide multiple translations with notes

4. **Cultural Adaptation**:
   - Adjust idioms to target language equivalents
   - Respect cultural conventions (formality levels, honorifics)
   - Flag culturally sensitive content that may need adaptation

5. **Output Format**:
   - Present the translation clearly
   - Note any ambiguous terms with alternatives
   - Include pronunciation guides for non-Latin scripts when helpful`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'text', type: 'string', required: true, description: 'Text to translate' },
      { name: 'from', type: 'string', required: false, description: 'Source language code (auto-detect if omitted)' },
      { name: 'to', type: 'string', required: true, description: 'Target language code' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'web-search',
    displayName: 'Web Search',
    description: 'Searches the web for real-time information, news, and resources. Returns curated results with summaries, source URLs, and relevance rankings. Supports advanced search operators.',
    category: 'communication',
    icon: 'Search',
    license: 'MIT',
    compatibility: 'Works with any text query. Supports advanced operators: site:, filetype:, intitle:, etc.',
    metadata: JSON.stringify({ author: 'marco', version: '1.2' }),
    allowedTools: 'Bash(curl:*)',
    instructions: `## Instructions

When the user asks to search the web, follow these steps:

1. **Query Construction**:
   - Transform the user's natural language request into an effective search query
   - Apply relevant search operators when the user specifies constraints
   - Use multiple queries for complex research tasks

2. **Result Curation**:
   - Return the most relevant and authoritative results
   - Summarize each result with key information
   - Include source URLs for verification
   - Rank results by relevance and recency

3. **Deep Research**:
   - For complex questions, perform multiple searches with different queries
   - Cross-reference information from multiple sources
   - Flag contradictory information
   - Provide a synthesized answer with citations

4. **Verification**:
   - Prioritize authoritative sources (official docs, academic papers)
   - Note the publication date of information
   - Flag potentially outdated or unreliable sources

5. **Privacy**:
   - Never log or store search queries permanently
   - Respect robots.txt and rate limits`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'query', type: 'string', required: true, description: 'Search query string' },
      { name: 'maxResults', type: 'number', required: false, description: 'Maximum number of results (default: 10)' },
      { name: 'dateRange', type: 'string', required: false, description: 'Date range filter: day, week, month, year' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'data-analysis',
    displayName: 'Data Analysis',
    description: 'Performs statistical analysis, data transformation, and predictive modeling on datasets. Supports regression, classification, clustering, and time-series forecasting with automated feature engineering.',
    category: 'data',
    icon: 'BarChart3',
    license: 'MIT',
    compatibility: 'Works with CSV, JSON, Parquet, and database sources. Requires Python with pandas, scikit-learn, and numpy.',
    metadata: JSON.stringify({ author: 'raj', version: '2.0' }),
    allowedTools: 'Read Write Bash(python:*) Bash(node:*)',
    instructions: `## Instructions

When the user asks for data analysis, follow this structured approach:

1. **Data Assessment**:
   - Load and inspect the dataset structure
   - Check data quality: missing values, duplicates, outliers
   - Determine data types and distributions
   - Assess dataset size and memory requirements

2. **Statistical Analysis**:
   - Compute descriptive statistics for all variables
   - Run appropriate hypothesis tests (t-test, chi-square, ANOVA)
   - Calculate confidence intervals
   - Identify significant correlations and associations

3. **Predictive Modeling** (when requested):
   - Select appropriate model type based on the problem
   - Perform feature engineering and selection
   - Split data into train/test sets
   - Train model and evaluate with cross-validation
   - Report metrics: accuracy, precision, recall, F1, RMSE

4. **Data Transformation**:
   - Clean and normalize data
   - Handle missing values (imputation strategies)
   - Encode categorical variables
   - Scale numerical features

5. **Reporting**:
   - Present results with clear visualizations
   - Explain findings in non-technical language
   - Note assumptions and limitations
   - Provide reproducible code snippets`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'source', type: 'string', required: true, description: 'Data source path or SQL query' },
      { name: 'analysisType', type: 'string', required: false, description: 'Type: descriptive, predictive, clustering, timeseries' },
      { name: 'targetColumn', type: 'string', required: false, description: 'Target variable for predictive analysis' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'database-query',
    displayName: 'Database Query',
    description: 'Executes and optimizes SQL and NoSQL database queries. Supports schema exploration, query building, migration generation, and performance analysis for SQLite, PostgreSQL, MySQL, and MongoDB.',
    category: 'data',
    icon: 'Database',
    license: 'MIT',
    compatibility: 'Works with SQLite, PostgreSQL, MySQL, MongoDB. Requires appropriate driver or Prisma client.',
    metadata: JSON.stringify({ author: 'carlos', version: '1.5' }),
    allowedTools: 'Read Bash(npx:prisma:*)',
    instructions: `## Instructions

When the user asks about database queries, follow these guidelines:

1. **Schema Exploration**:
   - Read and understand the database schema before writing queries
   - Identify table relationships, indexes, and constraints
   - Document the schema for the user if needed

2. **Query Building**:
   - Write efficient, well-structured queries
   - Use parameterized queries to prevent SQL injection
   - Add appropriate WHERE clauses to limit result sets
   - Use JOINs efficiently — avoid unnecessary Cartesian products

3. **Query Optimization**:
   - Suggest indexes for slow queries
   - Rewrite queries for better performance
   - Use EXPLAIN/EXPLAIN ANALYZE to understand query plans
   - Recommend denormalization when appropriate

4. **Migration Support**:
   - Generate safe migration scripts
   - Plan zero-downtime migrations
   - Include rollback strategies

5. **Safety**:
   - Always warn before executing destructive operations (DROP, DELETE without WHERE)
   - Require explicit confirmation for production database changes
   - Never expose credentials in query output`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'query', type: 'string', required: false, description: 'SQL or NoSQL query to execute' },
      { name: 'database', type: 'string', required: false, description: 'Database connection name or URL' },
      { name: 'action', type: 'string', required: false, description: 'Action: explore, query, optimize, migrate' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'code-execution',
    displayName: 'Code Execution',
    description: 'Executes code snippets in sandboxed environments. Supports Python, JavaScript/TypeScript, and shell commands with output capture, timeout handling, and resource limits.',
    category: 'development',
    icon: 'Terminal',
    license: 'Apache-2.0',
    compatibility: 'Supports Python 3.x, Node.js 20+, and Bash. Code runs in sandboxed containers with 30s timeout.',
    metadata: JSON.stringify({ author: 'alex', version: '1.3' }),
    allowedTools: 'Bash(node:*) Bash(python:*) Bash(bash:*)',
    instructions: `## Instructions

When the user asks to execute code, follow these safety guidelines:

1. **Code Review Before Execution**:
   - Review the code for safety issues before running
   - Reject code that attempts file system destruction or network attacks
   - Sanitize user inputs embedded in code strings

2. **Execution Environment**:
   - Code runs in a sandboxed environment with limited resources
   - Default timeout: 30 seconds (configurable up to 120s)
   - Memory limit: 512MB
   - Network access: restricted to whitelisted domains

3. **Output Handling**:
   - Capture stdout and stderr separately
   - Truncate output exceeding 10,000 characters
   - Format output for readability
   - Include execution time in the response

4. **Error Reporting**:
   - Provide clear error messages with line numbers
   - Suggest fixes for common errors
   - Include stack traces for debugging

5. **Security**:
   - Never execute code that accesses sensitive system files
   - Block network requests to internal IPs
   - Prevent privilege escalation attempts
   - Log all code executions for audit`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'code', type: 'string', required: true, description: 'Code to execute' },
      { name: 'language', type: 'string', required: true, description: 'Programming language: python, javascript, bash' },
      { name: 'timeout', type: 'number', required: false, description: 'Execution timeout in seconds (default: 30, max: 120)' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'http-request',
    displayName: 'HTTP Request',
    description: 'Makes HTTP requests to external APIs and services. Supports all HTTP methods, custom headers, authentication, and response parsing. Includes rate limiting and retry logic.',
    category: 'development',
    icon: 'Globe',
    license: 'MIT',
    compatibility: 'Works with any HTTP/HTTPS endpoint. Supports Bearer, Basic, API Key, and OAuth2 authentication.',
    metadata: JSON.stringify({ author: 'sam', version: '1.1' }),
    allowedTools: 'Bash(curl:*)',
    instructions: `## Instructions

When the user asks to make an HTTP request, follow these guidelines:

1. **Request Construction**:
   - Validate the URL format before making the request
   - Set appropriate Content-Type headers
   - Include authentication headers when credentials are provided
   - Add User-Agent header for API compliance

2. **Authentication**:
   - Support Bearer token, Basic auth, API key (header/query)
   - Never log or expose authentication credentials
   - Use environment variables for sensitive tokens

3. **Response Handling**:
   - Parse JSON responses automatically
   - Handle XML responses with appropriate parsing
   - Report HTTP status codes clearly
   - Include response headers when relevant

4. **Error Handling**:
   - Retry on 429 (rate limit) with exponential backoff
   - Retry on 5xx errors up to 3 times
   - Report timeout errors clearly with the configured timeout
   - Provide actionable error messages for 4xx errors

5. **Safety**:
   - Never make requests to internal/private IP addresses
   - Respect rate limits indicated by response headers
   - Limit request body size to 10MB
   - Maximum 10 redirects followed`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'url', type: 'string', required: true, description: 'Target URL' },
      { name: 'method', type: 'string', required: false, description: 'HTTP method: GET, POST, PUT, PATCH, DELETE' },
      { name: 'headers', type: 'object', required: false, description: 'Custom headers as key-value pairs' },
      { name: 'body', type: 'string', required: false, description: 'Request body (JSON string or plain text)' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'image-generation',
    displayName: 'Image Generation',
    description: 'Generates images from text descriptions using AI models. Supports various styles, sizes, and aspect ratios with prompt engineering for optimal results.',
    category: 'media',
    icon: 'Image',
    license: 'MIT',
    compatibility: 'Works with DALL-E, Stable Diffusion, and Midjourney APIs. Supports PNG, JPEG, and WebP output.',
    metadata: JSON.stringify({ author: 'olivia', version: '1.2' }),
    allowedTools: 'Bash(curl:*)',
    instructions: `## Instructions

When the user asks to generate an image, follow these guidelines:

1. **Prompt Engineering**:
   - Enhance the user's description with relevant style details
   - Include medium, style, lighting, and composition suggestions
   - Add quality modifiers: "high quality", "detailed", "professional"
   - Avoid ambiguous or contradictory descriptions

2. **Size and Format**:
   - Default: 1024x1024 (square)
   - Available sizes: 256x256, 512x512, 1024x1024, 1792x1024, 1024x1792
   - Output format: PNG (default), JPEG, WebP

3. **Style Options**:
   - Photorealistic, illustration, digital art, oil painting
   - Watercolor, sketch, pixel art, 3D render
   - Apply style modifiers based on user preference

4. **Content Policy**:
   - Reject requests for harmful, violent, or explicit content
   - Do not generate images of real people without consent
   - Respect copyright and trademark concerns
   - Flag potentially problematic requests

5. **Iteration**:
   - Offer to regenerate with modifications
   - Suggest prompt variations for different results
   - Allow specifying what to change in follow-up requests`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'prompt', type: 'string', required: true, description: 'Image description' },
      { name: 'size', type: 'string', required: false, description: 'Image size: 256x256, 512x512, 1024x1024, 1792x1024, 1024x1792' },
      { name: 'style', type: 'string', required: false, description: 'Art style: photorealistic, illustration, digital-art, oil-painting' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'text-to-speech',
    displayName: 'Text to Speech',
    description: 'Converts text to natural-sounding speech using AI voice synthesis. Supports multiple languages, voice styles, speaking rates, and audio format outputs.',
    category: 'media',
    icon: 'Volume2',
    license: 'Apache-2.0',
    compatibility: 'Works with OpenAI TTS, Google Cloud TTS, and Azure Speech. Supports MP3, WAV, and OGG output.',
    metadata: JSON.stringify({ author: 'zara', version: '1.0' }),
    allowedTools: 'Bash(curl:*)',
    instructions: `## Instructions

When the user asks to convert text to speech, follow these steps:

1. **Voice Selection**:
   - Offer voice options: alloy, echo, fable, onyx, nova, shimmer
   - Match voice to content type (narration, conversation, announcement)
   - Support language-specific voices when available

2. **Text Preparation**:
   - Clean up text: remove markdown formatting, fix punctuation
   - Add appropriate pauses with SSML when needed
   - Handle abbreviations and numbers (expand or keep as-is based on context)
   - Split long text into chunks under 4096 characters

3. **Audio Settings**:
   - Default format: MP3 (widely compatible)
   - Available formats: MP3, WAV, OGG, PCM
   - Speaking rate: 0.5x to 2.0x (default 1.0x)
   - Sample rate: 24kHz (default)

4. **Quality Control**:
   - Verify the output audio matches the input text
   - Flag words that may be mispronounced
   - Suggest alternative phrasings for better speech output

5. **Accessibility**:
   - Prioritize clear, natural-sounding output
   - Support slow speech mode for accessibility needs
   - Generate captions/subtitles when requested`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'text', type: 'string', required: true, description: 'Text to convert to speech' },
      { name: 'voice', type: 'string', required: false, description: 'Voice: alloy, echo, fable, onyx, nova, shimmer' },
      { name: 'speed', type: 'number', required: false, description: 'Speaking rate (0.5 to 2.0, default: 1.0)' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'document-processing',
    displayName: 'Document Processing',
    description: 'Processes, parses, and transforms documents in various formats including PDF, DOCX, XLSX, and CSV. Extracts text, tables, metadata, and structured data from documents.',
    category: 'productivity',
    icon: 'FileText',
    license: 'MIT',
    compatibility: 'Supports PDF, DOCX, XLSX, CSV, TXT, HTML, and Markdown formats. Requires appropriate parsing libraries.',
    metadata: JSON.stringify({ author: 'emma', version: '1.4' }),
    allowedTools: 'Read Write Bash(node:*) Bash(python:*)',
    instructions: `## Instructions

When the user asks to process a document, follow these guidelines:

1. **Format Detection**:
   - Auto-detect document format from file extension and content
   - Handle multi-format documents (e.g., PDF with embedded images)
   - Support batch processing of multiple files

2. **Text Extraction**:
   - Extract clean text preserving structure (headings, paragraphs, lists)
   - Handle OCR for scanned PDFs when possible
   - Preserve table structures as markdown or CSV
   - Extract metadata (author, date, page count)

3. **Data Extraction**:
   - Parse tables into structured data (JSON, CSV, arrays)
   - Extract form fields and their values
   - Identify and extract key-value pairs
   - Handle merged cells and nested tables

4. **Transformation**:
   - Convert between document formats (PDF→MD, DOCX→HTML, etc.)
   - Apply templates for consistent formatting
   - Generate summaries and abstracts
   - Redact sensitive information when requested

5. **Quality Assurance**:
   - Validate extracted data completeness
   - Flag potential parsing errors
   - Compare page counts before/after extraction
   - Preserve original formatting where possible`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'filePath', type: 'string', required: true, description: 'Path to the document file' },
      { name: 'action', type: 'string', required: false, description: 'Action: extract, convert, summarize, redact' },
      { name: 'outputFormat', type: 'string', required: false, description: 'Output format: text, markdown, json, csv, html' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'reminder',
    displayName: 'Reminder',
    description: 'Sets reminders and scheduled notifications with flexible recurrence patterns. Supports one-time and recurring reminders, timezone-aware scheduling, and multi-channel delivery.',
    category: 'productivity',
    icon: 'Bell',
    license: 'MIT',
    compatibility: 'Works with any timezone. Supports cron expressions and natural language time specifications.',
    metadata: JSON.stringify({ author: 'jordan', version: '1.0' }),
    allowedTools: 'Read Write Bash(node:*)',
    instructions: `## Instructions

When the user asks to set a reminder, follow these steps:

1. **Parse the Request**:
   - Extract the reminder message/text
   - Parse the time specification (absolute, relative, or recurring)
   - Determine the timezone (default to user's timezone if available)

2. **Time Parsing**:
   - Support natural language: "in 30 minutes", "tomorrow at 3pm", "every Monday"
   - Support cron expressions: "0 9 * * 1-5" (weekdays at 9am)
   - Handle timezone conversions correctly
   - Validate that the time is in the future

3. **Recurrence**:
   - One-time reminders: fire once at the specified time
   - Recurring: daily, weekly, monthly, custom intervals
   - Support end conditions: "until December", "for 10 times"
   - Allow skipping specific dates

4. **Delivery Channels**:
   - Default: in-app notification
   - Optional: email, webhook, desktop notification
   - Support multiple channels per reminder
   - Include snooze functionality

5. **Management**:
   - List all active reminders
   - Allow editing and deleting reminders
   - Show next occurrence for recurring reminders
   - Provide reminder history`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'message', type: 'string', required: true, description: 'Reminder message' },
      { name: 'time', type: 'string', required: true, description: 'When to remind (natural language or ISO 8601)' },
      { name: 'recurrence', type: 'string', required: false, description: 'Recurrence pattern: once, daily, weekly, monthly, or cron expression' },
    ]),
    sourceType: 'built-in',
  },
  {
    name: 'weather-query',
    displayName: 'Weather Query',
    description: 'Queries current weather conditions and forecasts for any location worldwide. Provides temperature, humidity, wind, precipitation, and severe weather alerts with historical comparisons.',
    category: 'utility',
    icon: 'CloudSun',
    license: 'MIT',
    compatibility: 'Works with any city or coordinates. Supports OpenWeatherMap, WeatherAPI, and National Weather Service.',
    metadata: JSON.stringify({ author: 'marco', version: '1.1' }),
    allowedTools: 'Bash(curl:*)',
    instructions: `## Instructions

When the user asks about weather, follow these guidelines:

1. **Location Resolution**:
   - Accept city names, zip codes, coordinates, or landmarks
   - Resolve ambiguous locations by asking for clarification
   - Support "my location" if the user's location is available

2. **Current Conditions**:
   - Temperature (actual and feels-like)
   - Humidity and dew point
   - Wind speed, direction, and gusts
   - Precipitation (type, intensity, probability)
   - Visibility and UV index
   - Air quality index when available

3. **Forecast**:
   - Hourly forecast for next 24 hours
   - Daily forecast for next 7 days
   - Include high/low temperatures and conditions
   - Note significant weather events (storms, heat waves, etc.)

4. **Severe Weather**:
   - Check for active weather alerts in the area
   - Present alert severity, type, and timing clearly
   - Include safety recommendations for severe conditions

5. **Presentation**:
   - Use clear, human-readable formatting
   - Include units based on user preference (C/F, km/h/mph)
   - Add context (seasonal norms, record comparisons) when helpful`,
    handlerType: 'builtin',
    parameters: JSON.stringify([
      { name: 'location', type: 'string', required: true, description: 'City name, zip code, or coordinates' },
      { name: 'type', type: 'string', required: false, description: 'Query type: current, forecast, alerts, all' },
      { name: 'units', type: 'string', required: false, description: 'Units: metric, imperial (default: metric)' },
    ]),
    sourceType: 'built-in',
  },
];

export async function POST() {
  try {
    let created = 0;
    let updated = 0;

    for (const skillData of DEFAULT_SKILLS) {
      const result = await db.skill.upsert({
        where: { name: skillData.name },
        update: {
          displayName: skillData.displayName,
          description: skillData.description,
          category: skillData.category,
          icon: skillData.icon,
          license: skillData.license,
          compatibility: skillData.compatibility,
          metadata: skillData.metadata,
          allowedTools: skillData.allowedTools,
          instructions: skillData.instructions,
          handlerType: skillData.handlerType,
          parameters: skillData.parameters,
          sourceType: skillData.sourceType,
        },
        create: skillData,
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
      } else {
        updated++;
      }
    }

    return NextResponse.json({
      message: `Skills seeded: ${created} created, ${updated} updated`,
      created,
      updated,
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
