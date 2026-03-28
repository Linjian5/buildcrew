# Contributing to BuildCrew

Thank you for your interest in contributing! We welcome contributions in both English and Chinese.

感谢你对 BuildCrew 的关注！我们欢迎中英文的贡献。

## Getting Started / 开始

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_NAME/buildcrew.git`
3. Install dependencies: `pnpm install`
4. Set up the database (see README.md)
5. Start the dev server: `pnpm dev`

## Development / 开发

### Project Structure

```
apps/web/       — React frontend (port 5173)
apps/server/    — Node.js backend (port 3100)
packages/db/    — Database schema (Drizzle ORM)
packages/shared/ — Shared types
tests/          — Test files
```

### Commands

```bash
pnpm dev          # Start frontend + backend
pnpm typecheck    # Type checking
pnpm lint         # Linting
pnpm test         # Run tests
pnpm db:push      # Sync database schema
pnpm db:seed      # Seed demo data
```

## How to Contribute / 如何贡献

### Report Bugs / 报告 Bug

Open an issue with:
- Steps to reproduce / 复现步骤
- Expected vs actual behavior / 预期 vs 实际行为
- Screenshots if applicable / 截图（如有）
- Browser and OS info / 浏览器和系统信息

### Submit Pull Requests / 提交 PR

1. Create a branch: `git checkout -b feat/your-feature`
2. Make your changes
3. Run `pnpm typecheck && pnpm lint` to verify
4. Commit with a descriptive message
5. Push and open a PR

### PR Guidelines / PR 规范

- Keep PRs focused — one feature or fix per PR
- Add tests for new features when possible
- Update documentation if behavior changes
- Follow existing code style

### Commit Message Format / 提交信息格式

```
feat: add wallet balance display
fix: correct Aria department showing wrong value
docs: update README quick start section
refactor: extract action button component
```

Prefixes: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

## Areas for Contribution / 贡献方向

We especially welcome help with:

- **Bug fixes** — Check [open issues](https://github.com/anthropic-ai/buildcrew/issues)
- **i18n** — Improve translations or add new languages
- **Tests** — Unit tests, integration tests, E2E tests
- **Documentation** — Guides, API docs, tutorials
- **New AI providers** — Add support for more LLM providers
- **UI/UX** — Design improvements, accessibility

## Code of Conduct / 行为准则

Be respectful, constructive, and inclusive. We're building something together.

## License / 许可

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.
