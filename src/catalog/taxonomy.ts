import type { Theme } from '../types.js';

export interface ThemeRule extends Theme {
  /**
   * Keywords matched on word boundaries against the name and the description.
   * A trailing `*` matches any suffix (`deploy*` → deploy, deployment…).
   */
  keywords: string[];
}

export const OTHER_THEME: Theme = { id: 'other', label: 'Other' };

export const THEMES: ThemeRule[] = [
  {
    id: 'frontend',
    label: 'Frontend & web',
    keywords: [
      'frontend', 'front-end', 'react', 'nextjs', 'next.js', 'vue', 'nuxt', 'svelte', 'sveltekit', 'angular',
      'solid', 'astro', 'remix', 'tailwind*', 'css', 'html', 'shadcn', 'ui component*', 'web app*', 'website*',
      'landing page*', 'browser', 'dom', 'vite', 'webpack', 'accessibility', 'a11y', 'responsive', 'web component*',
      'jsx', 'tsx', 'storybook', 'three.js', 'threejs', 'webgl', 'animation*', 'framer', 'gsap',
      '前端', 'フロントエンド',
    ],
  },
  {
    id: 'backend',
    label: 'Backend & APIs',
    keywords: [
      'backend', 'back-end', 'api', 'apis', 'rest', 'graphql', 'grpc', 'server', 'servers', 'endpoint*', 'express',
      'fastapi', 'django', 'flask', 'rails', 'laravel', 'spring', 'nestjs', 'hono', 'microservice*', 'webhook*',
      'auth', 'authentication', 'oauth', 'stripe', 'payment*', 'queue*', 'cache', 'caching', 'dotnet', '.net',
      'node.js', 'nodejs', 'bun', 'deno', '后端', '接口', 'バックエンド',
    ],
  },
  {
    id: 'code',
    label: 'Code & architecture',
    keywords: [
      'code', 'coding', 'codebase*', 'programming', 'implement*', 'spec', 'specs', 'specification*', 'architecture*',
      'architect', 'design pattern*', 'pattern*', 'hexagonal', 'ddd', 'domain-driven', 'clean architecture', 'adr',
      'module*', 'monorepo', 'dependenc*', 'typescript', 'javascript', 'python', 'go', 'golang', 'rust', 'java',
      'kotlin', 'php', 'elixir', 'ruby', 'c#', 'c++', 'scala', 'haskell', 'zig', 'performance', 'optimi*',
      'algorithm*', 'data structure*', 'concurren*', 'async', 'type system', 'types', 'compiler*', 'wasm',
      'webassembly', 'ast', 'tree-sitter', 'legacy', 'migrat*', 'upgrade*', 'codegen',
      '架构', '代码', '编程', 'アーキテクチャ', 'コード', 'プログラミング',
    ],
  },
  {
    id: 'mobile',
    label: 'Mobile',
    keywords: [
      'mobile', 'ios', 'android', 'swift', 'swiftui', 'uikit', 'react native', 'react-native', 'expo', 'flutter',
      'dart', 'jetpack compose', 'xcode', 'app store', 'play store', 'watchos', 'visionos',
      '移动端', '小程序', 'アプリ',
    ],
  },
  {
    id: 'databases',
    label: 'Databases',
    keywords: [
      'database*', 'sql', 'postgres*', 'mysql', 'sqlite', 'mongodb', 'mongo', 'redis', 'supabase', 'firebase',
      'prisma', 'drizzle', 'orm', 'schema*', 'migration*', 'query', 'queries', 'neon', 'dynamodb', 'cassandra',
      'clickhouse', 'duckdb', 'elasticsearch', 'vector database*', 'pgvector', 'convex', 'planetscale',
      '数据库', 'データベース',
    ],
  },
  {
    id: 'devops',
    label: 'DevOps & cloud',
    keywords: [
      'devops', 'deploy*', 'ci', 'cd', 'ci/cd', 'pipeline*', 'github action*', 'docker*', 'kubernetes', 'k8s', 'helm',
      'terraform', 'pulumi', 'ansible', 'aws', 'azure', 'gcp', 'google cloud', 'cloudflare', 'vercel', 'netlify',
      'infrastructure', 'infra', 'serverless', 'lambda', 'monitoring', 'observability', 'logging', 'logs',
      'sentry', 'datadog', 'grafana', 'prometheus', 'incident*', 'sre', 'linux', 'bash', 'shell', 'nginx',
      '部署', '运维', '服务器', 'デプロイ',
    ],
  },
  {
    id: 'testing',
    label: 'Testing & quality',
    keywords: [
      'test', 'tests', 'testing', 'tdd', 'unit test*', 'e2e', 'end-to-end', 'playwright', 'cypress', 'jest', 'vitest',
      'pytest', 'qa', 'code review*', 'review*', 'lint*', 'refactor*', 'debug*', 'bug*', 'quality', 'clean code',
      'code smell*', 'coverage', 'regression', 'static analysis', 'best practice*',
      '测试', 'テスト', '审查', 'レビュー',
    ],
  },
  {
    id: 'security',
    label: 'Security',
    keywords: [
      'security', 'secure', 'vulnerabilit*', 'pentest*', 'penetration', 'owasp', 'cve', 'exploit*', 'malware',
      'threat*', 'security audit*', 'secret*', 'encryption', 'crypto', 'cryptography', 'compliance', 'gdpr', 'soc 2', 'soc2',
      'iam', 'firewall', 'forensic*', 'ctf', 'red team', 'blue team', 'siem', 'xss', 'injection',
      '安全', 'セキュリティ', 'guard*', 'guardrail*', 'safety',
    ],
  },
  {
    id: 'ai',
    label: 'AI, LLMs & agents',
    keywords: [
      'ai', 'llm', 'llms', 'gpt', 'openai', 'anthropic', 'claude api', 'gemini', 'prompt*', 'agent', 'agents',
      'agentic', 'multi-agent', 'subagent*', 'mcp', 'model context protocol', 'rag', 'embedding*', 'fine-tun*',
      'machine learning', 'ml', 'deep learning', 'neural', 'pytorch', 'tensorflow', 'hugging face', 'huggingface',
      'langchain', 'llamaindex', 'inference', 'eval', 'evals', 'chatbot*', 'transformer*',
      '智能体', '大模型', '提示词', 'エージェント', 'プロンプト',
    ],
  },
  {
    id: 'data',
    label: 'Data & analytics',
    keywords: [
      'data', 'dataset*', 'analytics', 'analysis', 'analyze', 'analyse', 'etl', 'elt', 'pandas', 'numpy', 'polars',
      'spark', 'dbt', 'airflow', 'snowflake', 'bigquery', 'csv', 'json', 'excel', 'spreadsheet*', 'xlsx', 'chart*',
      'visuali*', 'dashboard*', 'statistic*', 'metrics', 'bi', 'tableau', 'power bi', 'jupyter', 'notebook*',
      'scrap*', 'crawl*', 'web scraping',
      '数据', '分析', 'データ', '分析する',
    ],
  },
  {
    id: 'documents',
    label: 'Documents & office',
    keywords: [
      'document*', 'pdf', 'docx', 'word', 'pptx', 'powerpoint', 'slides', 'slide deck*', 'presentation*', 'markdown',
      'latex', 'ocr', 'office', 'google docs', 'google sheets', 'notion', 'confluence', 'template*', 'forms',
      'invoice*', 'report*',
      '文档', 'ドキュメント', '知识库',
    ],
  },
  {
    id: 'design',
    label: 'Design & UI/UX',
    keywords: [
      'design', 'designer', 'ui', 'ux', 'ui/ux', 'figma', 'design system*', 'typography', 'color*', 'palette*',
      'logo*', 'brand*', 'icon*', 'wireframe*', 'mockup*', 'prototype*', 'layout*', 'visual', 'aesthetic*',
      'canvas', 'illustration*', 'svg',
      '设计', 'デザイン',
    ],
  },
  {
    id: 'media',
    label: 'Image, video & audio',
    keywords: [
      'image*', 'photo*', 'video*', 'audio', 'music', 'sound', 'voice', 'speech', 'tts', 'text-to-speech',
      'transcri*', 'podcast*', 'ffmpeg', 'remotion', 'avatar*', 'midjourney', 'stable diffusion', 'dall-e',
      'image generation', 'video generation', '3d', 'blender', 'animation', 'gif*', 'youtube', 'tiktok',
      '视频', '图片', '图像', '音频', '动画', '動画', '画像', 'flux', 'kling', 'seedance', 'nano banana', 'lipsync', 'face swap', 'controlnet', 'motion graphics', 'hyperframes', 'higgsfield',
    ],
  },
  {
    id: 'writing',
    label: 'Writing & communication',
    keywords: [
      'writ*', 'writer', 'copywriting', 'copy', 'content', 'blog*', 'article*', 'essay*', 'editing', 'proofread*',
      'grammar', 'translat*', 'language*', 'storytelling', 'email*', 'newsletter*', 'communication', 'slack',
      'discord', 'message*', 'tweet*', 'twitter', 'linkedin', 'social media', 'documentation', 'docs', 'readme',
      'changelog*', 'technical writing',
      '写作', '文章', '翻译', '公众号', '小红书', '文章を',
    ],
  },
  {
    id: 'business',
    label: 'Marketing, business & finance',
    keywords: [
      'marketing', 'seo', 'sem', 'growth', 'sales', 'crm', 'lead*', 'customer*', 'business', 'startup*', 'pitch',
      'product manag*', 'pricing', 'ecommerce', 'e-commerce', 'shopify', 'finance', 'financial', 'accounting',
      'invest*', 'trading', 'stock*', 'legal', 'contract*', 'hr', 'recruit*', 'hiring', 'strategy', 'competitor*',
      'market research', 'ads', 'advertising', 'campaign*', 'brand strategy',
      '营销', '电商', '销售', '投资', '股票', 'マーケティング',
      'reconcil*', 'ledger', 'balance sheet', 'accrual*', 'fund', 'funds', 'mvp', 'entrepreneur*', 'job', 'jobs', 'resume', 'career', 'interview prep', '求职', '商业', '简历',
    ],
  },
  {
    id: 'productivity',
    label: 'Productivity & workflows',
    keywords: [
      'productivity', 'workflow*', 'automation', 'automate*', 'plan', 'planning', 'planner', 'task*', 'todo*',
      'project manag*', 'jira', 'linear', 'asana', 'trello', 'calendar', 'meeting*', 'notes', 'note-taking',
      'obsidian', 'knowledge base', 'memory', 'brainstorm*', 'skill', 'skills', 'skill creator', 'git', 'github',
      'commit*', 'pull request*', 'pr', 'branch*', 'worktree*', 'cli', 'terminal', 'claude code', 'cursor',
      'codex', 'vscode', 'ide', 'productive',
      'retro*', 'retrospective*', 'session*', 'context', 'learn*', 'idea*', 'thinking', 'decision*', 'interview*', 'questionnaire*', 'mentor*', 'coach*', 'perspective', 'mental model*', 'lark', 'feishu', 'dingtalk', 'wechat', '飞书', '钉钉', '微信', '思维', '决策', '效率', '工作流', '任务',
    ],
  },
  {
    id: 'research',
    label: 'Research & science',
    keywords: [
      'research', 'researcher', 'science', 'scientific', 'paper*', 'arxiv', 'pubmed', 'literature', 'academic',
      'citation*', 'bioinformatic*', 'biology', 'genomic*', 'chemistry', 'physics', 'math', 'mathematics',
      'medical', 'clinical', 'health', 'healthcare', 'education', 'learning', 'teach*', 'tutor*', 'quiz*',
      'experiment*', 'hypothes*',
      '论文', '研究', '学习', '教育', '論文', '研究',
      'algebra', 'logic', 'category theory', 'theorem*', 'proof*', 'calculus', 'geometry', 'psycholog*', 'philosoph*', '心理学', '哲学',
    ],
  },
];

/** Labels used by other directories (Smithery, SkillsMP) mapped to our themes. */
export const LABEL_MAP: Record<string, string> = {
  // Smithery
  coding: 'code',
  productivity: 'productivity',
  design: 'design',
  'data & analytics': 'data',
  devops: 'devops',
  business: 'business',
  'ai & ml': 'ai',
  writing: 'writing',
  communication: 'writing',
  planning: 'productivity',
  research: 'research',
  security: 'security',
  // SkillsMP top-level and common slugs
  frontend: 'frontend',
  backend: 'backend',
  'full-stack': 'backend',
  mobile: 'mobile',
  'testing-security': 'testing',
  testing: 'testing',
  'data-ai': 'ai',
  'llm-ai': 'ai',
  'machine-learning': 'ai',
  'data-engineering': 'data',
  'sql-databases': 'databases',
  'nosql-databases': 'databases',
  cloud: 'devops',
  containers: 'devops',
  cicd: 'devops',
  monitoring: 'devops',
  documentation: 'writing',
  'content-media': 'media',
  'sales-marketing': 'business',
  'finance-investment': 'business',
  ecommerce: 'business',
  'project-management': 'productivity',
  'git-workflows': 'productivity',
  'cli-tools': 'productivity',
  'code-quality': 'testing',
  'scientific-computing': 'research',
  bioinformatics: 'research',
  education: 'research',
};

export function allThemes(): Theme[] {
  return [...THEMES.map(({ id, label }) => ({ id, label })), OTHER_THEME];
}
