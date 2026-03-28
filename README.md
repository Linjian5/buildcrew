# BuildCrew

**Build your AI crew. Run your AI company.**

BuildCrew is an open-source platform that organizes multiple AI agents into a virtual company. Chat with your AI CEO (Aria), she'll build your team, plan your project, and get things done — autonomously.

> If AI agents are employees, BuildCrew is the company they work in.

BuildCrew / 构建你的 AI 团队，运行你的 AI 公司。

BuildCrew 是一个开源的 AI 多智能体编排平台。通过和 AI CEO（Aria）对话，她会自动组建团队、制定计划、分配任务、协作执行。

---

## How It Works / 工作流程

```
Create Company  -->  Chat with Aria  -->  Launch Plan  -->  Execute  -->  Dashboard
创建公司            和 Aria 对话          启动方案          执行          总览页
```

1. **Create a company** — Pick a name, mission, and industry template
2. **Chat with Aria (AI CEO)** — She asks smart questions, one at a time, with her own analysis
3. **Launch** — Aria summarizes the plan, team, and budget. You review
4. **Execute** — One click. Aria hires agents, creates goals, assigns tasks
5. **Dashboard** — Watch your AI company work: org chart, tasks, progress

## Features

- **Aria (AI CEO)** — Socratic-style autonomous workflow. She thinks, plans, and acts
- **Multi-Agent Team** — 12 specialized roles: engineers, designers, marketers, analysts
- **Org Charts** — Departments, reporting lines, role-based hierarchy
- **Task Management** — Goals, tasks, assignment, progress tracking
- **Smart Router** — Routes tasks to the best agent based on skills, cost, availability
- **Guardian** — Security monitoring, anomaly detection, automatic alerts
- **Review Pipeline** — 3-stage review: auto check, peer review, human approval
- **Knowledge Hub** — Semantic search, auto-extraction, shared context
- **Multi-Model** — Works with Claude, GPT, DeepSeek, GLM, Kimi, and more
- **i18n** — English, 简体中文, 日本語
- **Digital Humans** — Animated Q-style 3D characters for each agent

## Quick Start / 快速开始

### Prerequisites / 前置条件

- Node.js 20+
- pnpm 9.15+
- PostgreSQL 16
- Redis

### Install & Run / 安装运行

```bash
git clone https://github.com/anthropic-ai/buildcrew.git
cd buildcrew
pnpm install

# Database / 数据库
createdb buildcrew
cp apps/server/.env.example apps/server/.env
# Edit .env — add your AI provider API key
# 编辑 .env — 填入你的 AI 服务商 API Key

pnpm db:push
pnpm db:seed

# Start / 启动
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173)

### First Run / 首次使用

1. Register an account / 注册账号
2. Create a company — pick a template / 创建公司 — 选择模板
3. Chat with Aria — tell her your goals / 和 Aria 对话 — 说你要做什么
4. Click "Launch" — review the plan / 点"启动" — 审核方案
5. Click "Execute" — watch your AI company work / 点"立即执行" — 看 AI 团队工作

### AI Provider Setup / AI 服务配置

Configure your AI provider in `apps/server/.env`:

```env
PLATFORM_AI_KEY=your-api-key
PLATFORM_AI_PROVIDER=openai          # openai / anthropic / deepseek / zhipu / moonshot
PLATFORM_AI_MODEL=gpt-4o             # model name
PLATFORM_AI_ENDPOINT=https://api.openai.com/v1
```

Supported providers / 支持的服务商:

| Provider | Models |
|----------|--------|
| OpenAI | gpt-4o, gpt-4o-mini |
| Anthropic | claude-sonnet-4-6, claude-haiku-4-5 |
| DeepSeek | deepseek-chat, deepseek-coder |
| Zhipu (GLM) | glm-4-plus, glm-4-flash |
| Moonshot (Kimi) | moonshot-v1-8k, moonshot-v1-128k |
| Custom | Any OpenAI-compatible endpoint |

## Tech Stack / 技术栈

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, TailwindCSS, shadcn/ui |
| Backend | Node.js, Express, TypeScript, socket.io |
| Database | PostgreSQL 16, Drizzle ORM, pgvector |
| Cache | Redis, BullMQ |
| AI | OpenAI-compatible + Anthropic native format |
| Testing | Vitest, Playwright |

## Project Structure / 项目结构

```
buildcrew/
├── apps/
│   ├── web/              — React frontend
│   └── server/           — Node.js API server
├── packages/
│   ├── shared/           — Shared types & constants
│   └── db/               — Database schema (Drizzle ORM)
├── tests/                — Unit / Integration / E2E tests
└── docs/                 — Documentation
```

## Scripts / 常用命令

```bash
pnpm dev                # Start dev server / 启动开发服务
pnpm build              # Production build / 生产构建
pnpm typecheck          # TypeScript check / 类型检查
pnpm lint               # ESLint
pnpm test               # Run tests / 运行测试
pnpm db:push            # Apply schema / 同步数据库
pnpm db:seed            # Seed demo data / 填充演示数据
```

## Roadmap / 路线图

- [x] Core engine — Company, Agent, Task CRUD
- [x] Aria (AI CEO) — Socratic dialogue + autonomous planning
- [x] Multi-model support — 6 providers
- [x] i18n — 3 languages
- [x] Digital humans — 12 roles with animations
- [ ] Wallet & billing — Token-based cost tracking
- [ ] Continuous operations — Event-driven agent work loop
- [ ] Plugin SDK — Extend with custom tools
- [ ] Cloud deployment — One-click deploy

## Contributing / 贡献

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Issues and PRs in both English and Chinese are welcome.
欢迎提交中英文的 Issue 和 PR。

## License / 许可

[Apache-2.0](LICENSE)

---

Built with Claude Code.
