# BuildCrew

[English](README.md) | [简体中文](README_zh-CN.md)

**Build your AI crew. Run your AI company.**

BuildCrew is an open-source platform that organizes multiple AI agents into a virtual company. Chat with your AI CEO (Aria), she'll build your team, plan your project, and get things done — autonomously.

> If AI agents are employees, BuildCrew is the company they work in.

![BuildCrew Dashboard](docs/images/overview.png)

---

## How It Works

```
Create Company  →  Chat with Aria  →  Launch Plan  →  Execute  →  Dashboard
```

1. **Create a company** — Pick a name, mission, and industry template
2. **Chat with Aria (AI CEO)** — She asks smart questions, one at a time, with her own analysis and suggestions
3. **Launch** — Aria summarizes the plan, team, and estimated cost. You review
4. **Execute** — One click. Aria hires agents, creates goals, assigns tasks
5. **Dashboard** — Watch your AI company work: org chart, tasks, progress

![Chat with Aria](docs/images/onboarding.png)

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

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9.15+
- PostgreSQL 16
- Redis

### Install & Run

```bash
git clone https://github.com/Linjian5/buildcrew.git
cd buildcrew
pnpm install

# Database
createdb buildcrew
cp apps/server/.env.example apps/server/.env
# Edit .env — add your AI provider API key

pnpm db:push
pnpm db:seed

# Start
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173)

### First Run

1. Register an account
2. Create a company — pick an industry template
3. Chat with Aria — tell her your goals
4. Click **Launch** — review the plan
5. Click **Execute Now** — watch your AI company work

### AI Provider Setup

Configure your AI provider in `apps/server/.env`:

```env
PLATFORM_AI_KEY=your-api-key
PLATFORM_AI_PROVIDER=openai
PLATFORM_AI_MODEL=gpt-4o
PLATFORM_AI_ENDPOINT=https://api.openai.com/v1
```

| Provider | Models |
|----------|--------|
| OpenAI | gpt-4o, gpt-4o-mini |
| Anthropic | claude-sonnet-4-6, claude-haiku-4-5 |
| DeepSeek | deepseek-chat, deepseek-coder |
| Zhipu (GLM) | glm-4-plus, glm-4-flash |
| Moonshot (Kimi) | moonshot-v1-8k, moonshot-v1-128k |
| Custom | Any OpenAI-compatible endpoint |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, TailwindCSS, shadcn/ui |
| Backend | Node.js, Express, TypeScript, socket.io |
| Database | PostgreSQL 16, Drizzle ORM, pgvector |
| Cache | Redis, BullMQ |
| AI | OpenAI-compatible + Anthropic native format |
| Testing | Vitest, Playwright |

## Project Structure

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

## Scripts

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm typecheck        # TypeScript check
pnpm lint             # ESLint
pnpm test             # Run tests
pnpm db:push          # Apply schema
pnpm db:seed          # Seed demo data
```

## Roadmap

### Phase 1 — Foundation (Done)

- [x] Core engine — Company, Agent, Task CRUD + WebSocket real-time sync
- [x] Aria (AI CEO) — Socratic-style dialogue, autonomous planning, two-step execution
- [x] Multi-model AI — Claude, GPT, DeepSeek, GLM, Kimi + any OpenAI-compatible endpoint
- [x] Smart Router — 5 routing strategies based on agent skills, cost, and availability
- [x] Guardian — 4-level alert system with automatic anomaly response
- [x] Review Pipeline — 3-stage review: auto check → peer review → human approval
- [x] Knowledge Hub — Semantic search (pgvector), auto-extraction, context injection
- [x] Evolution Engine — Performance scoring, capability profiles, A/B testing
- [x] Digital Humans — 12 Q-style 3D animated characters (5 states each)
- [x] i18n — English, 简体中文, 日本語
- [x] Auth — JWT login/register, session persistence

### Phase 2 — Stability (In Progress)

- [ ] Wallet & Billing — Prepaid credits, token-based cost tracking, per-agent budgets
- [ ] Continuous Operations — Event-driven agent work loop (task complete → next task → milestone report)
- [ ] Notification System — Real-time alerts, unread badges, in-app notification center
- [ ] Automated Testing — Playwright E2E tests for core flow, CI/CD pipeline
- [ ] Role Cognitive System — 8-module platform awareness + role-specific professional knowledge

### Phase 3 — Growth

- [ ] Plugin SDK — Build custom tools and integrations for agents
- [ ] Agent Marketplace — Share and discover community-built agent roles
- [ ] Team Templates — Pre-built team configurations for common use cases (SaaS, E-commerce, Content)
- [ ] Advanced Analytics — Cost breakdown, productivity metrics, trend charts
- [ ] Cloud Deployment — One-click deploy to Vercel + Railway
- [ ] Multi-Company Groups — Manage multiple AI companies from one dashboard
- [ ] Custom Agent Builder — Create your own specialized agents with custom prompts and skills

### Phase 4 — Scale

- [ ] Mobile App — iOS & Android companion app
- [ ] API & SDK — Public API for external integrations and automation
- [ ] Virtual Office — Top-down view of your AI company with real-time agent activity
- [ ] Cross-Company Collaboration — Agents from different companies working together
- [ ] Self-Hosted Option — Docker / Kubernetes deployment for enterprise
- [ ] Fine-Tuned Models — Specialized models trained on your company's data and style

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Issues and PRs in both English and Chinese are welcome.

## License

[Apache-2.0](LICENSE)

---

Built with [Claude Code](https://claude.ai/code).
