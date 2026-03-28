# BuildCrew — Claude Code 项目指南

## 项目简介

BuildCrew 是一个 AI 多智能体编排平台。用户创建虚拟公司，和 CEO（Aria）对话，Aria 自动组建团队、制定计划、分配任务。

## 架构

```
apps/web/          — React 19 前端（Vite + TailwindCSS + shadcn/ui）
apps/server/       — Node.js 后端（Express + TypeScript + socket.io）
packages/db/       — 数据库（PostgreSQL 16 + Drizzle ORM + pgvector）
packages/shared/   — 共享类型和常量
```

## 核心流程

```
用户创建公司 → Aria 对话（苏格拉底式一次一问）
  → 用户点"启动" → 后端 confirm-plan 提取三要素（计划/团队/预算）
  → 场景 A（齐全）：招聘 + 发汇总消息 + 渲染"立即执行"按钮
  → 场景 B（不全）：Aria 问用户补充
  → 用户点"立即执行" → 创建目标 + 任务 + 分配 → 跳转总览页
```

## 关键文件

```
前端：
  apps/web/src/app/pages/OnboardingPage.tsx  — Onboarding 对话流程
  apps/web/src/app/pages/Overview.tsx        — 总览页
  apps/web/src/app/pages/ChatPage.tsx        — 对话页
  apps/web/src/app/components/chat/ChatPanel.tsx — 对话面板
  apps/web/src/contexts/AuthContext.tsx       — 认证上下文
  apps/web/src/contexts/CompanyContext.tsx    — 公司上下文
  apps/web/src/lib/api-client.ts             — API 客户端
  apps/web/src/i18n/                         — 国际化

后端：
  apps/server/src/routes/chat.ts             — 对话 + confirm-plan API
  apps/server/src/routes/companies.ts        — 公司 CRUD
  apps/server/src/services/ai-client.ts      — AI 调用（多 Provider）
  apps/server/src/services/ceo-work-loop.ts  — CEO 工作循环状态机
  apps/server/src/services/action-parser.ts  — action JSON 解析
  apps/server/src/middleware/auth.ts          — JWT 认证
  apps/server/src/lib/role-templates.ts      — 12 角色模板
  apps/server/src/lib/providers.ts           — AI 服务商配置

数据库：
  packages/db/src/schema.ts                  — 表结构
  packages/db/src/seed.ts                    — 演示数据
```

## 开发命令

```bash
pnpm dev            # 启动开发服务（前端 5173 + 后端 3100）
pnpm typecheck      # TypeScript 类型检查
pnpm lint           # ESLint
pnpm test           # 运行测试
pnpm db:push        # 同步数据库 schema
pnpm db:seed        # 填充演示数据
```

## 开发规范

1. AI 调用统一走 ai-client.ts，不要直接 fetch AI 端点
2. 所有用户可见文字必须走 i18n（t('key')），不要硬编码中文或英文
3. confirm-plan 是唯一的招聘入口，不要在其他地方触发招聘
4. 前端传给后端的 language 参数用 normalizeLocale() 归一化
5. CEO（Aria）的 department 是 executive，不是 engineering
6. 改完接口要更新 .env.example 和相关文档

## 当前 AI 配置

```
Provider: 在 apps/server/.env 中配置
支持: OpenAI / Anthropic / DeepSeek / 智谱 / Moonshot / 自定义端点
格式: Anthropic 走原生 /messages，其余走 OpenAI 兼容 /chat/completions
```
