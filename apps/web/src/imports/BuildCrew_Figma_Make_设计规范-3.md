# BuildCrew — Figma Make Mode 设计文件

> 将每个 Section 的 Prompt 复制到 Figma Make 中即可生成对应页面
> 设计语言：现代 SaaS Dashboard，深色主题优先，科技感 + 专业
> 品牌名：BuildCrew | Tagline: "Build your AI crew. Run your AI company."
> 更新日期：2026-03-23

---

## 目录

1. [设计系统 (Design Tokens)](#1-设计系统)
2. [Agent 数字人角色卡片](#2-agent-数字人角色卡片)
3. [Desktop Dashboard 页面（10 页）](#3-desktop-dashboard-页面)
4. [Mobile 页面（4 页）](#4-mobile-页面)
5. [用户界面、全局导航与完整交互](#5-用户界面与全局导航)
6. [组件库](#6-组件库)
7. [App Store 截图](#7-app-store-截图)
8. [Landing Page（官网）](#8-landing-page官网)
9. [Figma 文件结构与交付 Checklist](#9-figma-文件结构与交付-checklist)

---

## 1. 设计系统

### Figma Make Prompt — Design Tokens

```
Create a design system / style guide page for "BuildCrew", an AI agent orchestration platform that organizes AI coding agents into virtual companies.

Brand personality: Professional, technical, trustworthy, futuristic but warm. Think: Linear meets Vercel meets Bloomberg Terminal, with a touch of team/crew camaraderie.

Logo concept: A minimalist icon combining a wrench/build tool with a group of people silhouette, in electric blue. The wordmark "BuildCrew" uses Inter Bold, with "Build" in white and "Crew" in electric blue.

Color palette:
- Primary: Electric blue (#3B82F6) — actions, links, active states, brand accent
- Secondary: Emerald green (#10B981) — success, online, budget healthy, task complete
- Accent: Amber (#F59E0B) — warnings, attention needed, budget watch
- Danger: Rose (#F43F5E) — errors, over budget, critical alerts, agent error state
- Background (dark mode): #0A0A0F (page bg), #13131A (card bg), #1E1E2A (elevated surfaces)
- Background (light mode): #FFFFFF (page), #F8FAFC (card), #F1F5F9 (elevated)
- Text (dark mode): #F8FAFC (primary), #94A3B8 (secondary), #475569 (muted)
- Text (light mode): #0F172A (primary), #475569 (secondary), #94A3B8 (muted)
- Border: #1E293B (dark), #E2E8F0 (light)

Department colors (used for agent avatar rings and department badges):
- Engineering: #3B82F6 (blue)
- Design: #A855F7 (purple)
- Marketing: #14B8A6 (teal)
- QA/Testing: #F59E0B (amber)
- DevOps: #6B7280 (gray)
- Content: #14B8A6 (teal, shared with marketing)
- Executive: #8B5CF6 (violet)

Typography:
- Headings: Inter (Bold / Semibold)
- Body: Inter (Regular / Medium)
- Code / Monospace: JetBrains Mono
- Type scale: 12 / 14 / 16 / 20 / 24 / 32 / 48 px

Spacing: 4px base unit grid (4, 8, 12, 16, 20, 24, 32, 48, 64 px)

Border radius: 6px (small/buttons), 8px (medium/inputs), 12px (large/cards), 16px (xl/modals)

Shadows (dark mode):
- sm: 0 1px 2px rgba(0,0,0,0.3)
- md: 0 4px 12px rgba(0,0,0,0.4)
- lg: 0 8px 24px rgba(0,0,0,0.5)

Icon style: Lucide icons, 20px default size, 1.5px stroke weight

Include on the page: color swatches with hex codes, type scale samples at each size, spacing ruler, button samples (primary/secondary/ghost/danger) in both states, input field samples, and the BuildCrew logo in full color / monochrome / icon-only variants. Show both dark and light mode side by side.
```

---

## 2. Agent 数字人角色卡片

### 2.1 单张角色卡片

```
Design an "Agent Card" component for BuildCrew — an AI agent orchestration platform. Dark mode.

Card dimensions: 380 x 520 px, rounded corners 16px, background #13131A, subtle 1px border #1E293B. On hover, the border glows softly in the agent's department color.

LAYOUT (top to bottom):

── TOP RIGHT CORNER: Performance Score ──
Animated circular progress ring (60x60 px):
- Ring stroke: 4px, color based on score: green (#10B981) >90, blue (#3B82F6) 70-90, amber (#F59E0B) 50-70, red (#F43F5E) <50
- Center: Large bold number "96" in white, small "/100" in gray below
- Below ring: Trend arrow "↑" green or "↓" amber or "→" gray
- Position: 16px from top-right corner

── CENTER: DIGITAL HUMAN AVATAR (hero element, 160x200 px) ──
Design a stylized digital human character — NOT a robot icon. Modern semi-realistic 3D-style avatar bust (head + shoulders):
- Art style: Clean 3D render, similar to Apple Memoji but more professional/techy. Slightly translucent holographic edges.
- Each agent has UNIQUE visual identity: different hairstyles, face shapes, accessories (glasses, headset, earpiece)
- Department-colored accent glow behind the character
- Subtle holographic/digital particle effect around edges — floating geometric shapes (triangles, hexagons, code brackets)

ANIMATION STATES (show all 5 as keyframe reference):
  - "Idle": Slow breathing (subtle vertical movement), eyes blink every 3-4s, particles drift slowly. Status ring: gray, pulsing softly.
  - "Working": Eyes focused downward, typing motion hint, faster particles, small code snippets floating. Status ring: green, spinning.
  - "Warning": Brow furrowed, amber glow replaces department color, warning triangle floating. Status ring: amber, pulsing.
  - "Paused": Desaturated colors, eyes closed, particles frozen. Status ring: gray, static.
  - "Error": Slight glitch/flicker effect, red glow, error symbol. Status ring: red, fast pulse.

Below avatar:
- Agent name: "Atlas" — 20px bold white
- Role badge: "CTO" — pill in department color, 12px
- Runtime tag: "Claude Opus" — small gray text with model icon
- Status: "● Working" green dot or "● Idle" gray dot — 14px

── BUDGET BAR (full width, 16px horizontal padding) ──
- Left label: "💰 $31.2 / $50"
- Right label: "62%"
- Thin progress bar 4px height, rounded, fill color gradient: green <70%, amber 70-90%, red >90%, background #1E293B

── DIVIDER: 1px #1E293B ──

── BOTTOM: TASK LIST (scrollable, ~180px height) ──
Header: "Tasks" left 14px semibold | "3/5 ✓" right 14px gray

Task rows (each ~32px):
1. ✅ "API 认证模块" — "47min · $1.80" gray — subtle green-tint background
2. ✅ "数据库 Schema 设计" — "23min · $0.90" — green bg
3. ✅ "JWT 中间件" — "31min · $1.20" — green bg
4. 🔄 "WebSocket 集成" — "12min · $0.42" — animated progress bar 60% blue with shimmer — blue left border highlight
5. ⏳ "错误处理重构" — "Queued" — dimmed/grayed

Active task (🔄) has subtle pulsing blue glow on left border.

Style: Card should feel alive — digital human breathes, progress bars shimmer, active task pulses. Subtle, not distracting. Premium feel like sci-fi control panel.
```

### 2.2 八角色全家福（Grid View）

```
Design a grid view showing all 8 Agent Cards for BuildCrew. Dark mode, background #0A0A0F.

Layout: 4 columns x 2 rows, 24px gap. Each card is the Agent Card component (380x520 px).

Row 1 (left to right):

1. "Atlas" — CTO — Claude Opus — WORKING state
   - East Asian male, short neat black hair, thin rectangular glasses, confident half-smile, navy suit collar
   - Blue engineering glow, code bracket {} particles floating
   - Score: 96 ↑ | Budget: $31.2/$50 (62%) green
   - Tasks: 3/5 done, active: "WebSocket 集成"

2. "Nova" — Frontend Engineer — Cursor — WORKING state
   - South Asian female, shoulder-length hair with subtle purple highlights, creative earrings, bright curious eyes
   - Blue engineering glow, UI rectangle and color swatch particles
   - Score: 88 → | Budget: $24.8/$30 (83%) amber
   - Tasks: 2/4 done, active: "Dashboard 组件库"

3. "Sentinel" — QA Engineer — Claude Sonnet — WORKING state
   - Black androgynous, buzz cut, sharp focused eyes, tactical headset on one ear, serious expression
   - Amber QA glow, checkmark and bug icon particles
   - Score: 94 ↑ | Budget: $8.4/$20 (42%) green
   - Tasks: 4/6 done, active: "集成测试编写"

4. "Echo" — Backend Engineer — Codex — WARNING state
   - Caucasian male, messy curly brown hair, stubble, casual hoodie collar, currently looking concerned
   - Amber warning glow overriding blue department color
   - Score: 72 ↓ | Budget: $31/$40 (78%) amber
   - Tasks: 1/3 done, current task shows retry indicator

Row 2:

5. "Sage" — Content Writer — Claude Haiku — IDLE state
   - East Asian female, long hair in elegant bun, round glasses, warm gentle smile, scarf/turtleneck collar
   - Teal marketing glow dimmed, pen/text particles frozen
   - Score: 85 → | Budget: $5/$25 (20%) green
   - Tasks: 5/5 all complete, "No queued tasks"

6. "Vector" — DevOps — Bash Scripts — IDLE state
   - Latino male, beanie hat, terminal-green accent streak in dark hair, utility techwear collar, calm expression
   - Gray devops glow, gear and pipeline arrow particles frozen
   - Score: 93 ↑ | Budget: $3/$15 (20%) green
   - Tasks: 3/3 done

7. "Pixel" — Designer — Claude Opus — PAUSED state
   - Black female, asymmetric bob with color gradient tips (purple to pink), creative piercings, bold expressive look
   - Purple design glow desaturated, paintbrush particles frozen
   - Score: 82 → | Budget: $18/$35 (51%) green
   - Tasks: 1/3 done, "⏸ Paused by user"

8. "Scout" — Marketing — Claude Sonnet — IDLE state
   - Middle Eastern male, well-groomed short beard, professional side-part, friendly confident smile, shirt collar with earpiece
   - Teal marketing glow dimmed, chart bar and megaphone particles frozen
   - Score: 79 ↓ | Budget: $9/$20 (45%) green
   - Tasks: 2/4 done

Visual hierarchy:
- Working agents (1-3): bright, active animations, particles moving
- Warning agent (4 Echo): amber pulse, character stressed
- Idle agents (5-6, 8): slightly dimmer, particles frozen, breathing only
- Paused agent (7 Pixel): desaturated/grayscale-ish, frozen

Overall: looks like a "mission control" monitoring 8 AI employees. Each digital human visually DISTINCT and recognizable at a glance.
```

### 2.3 卡片展开详情（Expanded Panel）

```
Design an expanded Agent detail panel for BuildCrew, dark mode. Appears when clicking an agent card — slides in as right-side drawer (800x600 px) or expands the card.

── LEFT SIDE (320px) ──
- Large digital human avatar (240x300), same character but bigger and more detailed
- Full animation state visible
- Below: Name "Atlas" 24px bold + "CTO" badge + "Claude Opus" tag
- Status: "● Working for 1h 23min"
- Department: "Engineering" with blue dot

── RIGHT SIDE TOP: Performance (480px) ──
- Large score ring 80x80: "96/100" green ring
- Trend: "↑ +3 this week"
- Radar chart 200x200 with 5 axes:
  Correctness: 97 | Code Quality: 92 | Efficiency: 88 | Cost Efficiency: 91 | First-try Pass: 96
- "Specialty: API design, Authentication, WebSocket"
- "Top performer in Engineering dept" green highlight text

── RIGHT SIDE BOTTOM: Full Task List (scrollable) ──
Header: "Tasks This Sprint — 3/5 completed"

Task cards (detailed):
  Task 1: ✅ "API 认证模块" | 47min | $1.80 | Score 98/100 | 2h ago
  Review: ✅ Auto + ✅ Peer (by Sentinel)

  Task 2: ✅ "数据库 Schema 设计" | 23min | $0.90 | Score 94/100

  Task 3: ✅ "JWT 中间件" | 31min | $1.20 | Score 96/100

  Task 4: 🔄 "WebSocket 集成" (HIGHLIGHTED blue border)
  Running: 12min | Cost: $0.42 | Progress: ████████░░░░ 60%
  Live log: monospace last 2 lines "Implementing event handlers for real-time updates..."
  [View Full Log] button

  Task 5: ⏳ "错误处理重构" | Priority: Medium | Est: $0.80
  Assigned by: CEO Agent via Smart Router

── BOTTOM BAR (full width) ──
Budget: "$31.20 / $50.00 this month" full-width progress bar
Actions: [Pause Agent] [Reassign Tasks] [View Full History] [Edit Config]

Style: Like inspecting a crew member in a sci-fi command center. Radar chart and live log are key differentiators from compact card.
```

### 2.4 数字人形象设计规范（Character Sheet）

```
Design a character design reference sheet for BuildCrew's 8 digital human agent avatars.

Title: "BuildCrew Digital Human Design System"

Section 1 — Base Character Template:
Neutral base character (front view, bust) with annotation callouts:
- Head: Slightly stylized proportions (larger head, clean features)
- Style: Semi-realistic 3D render, clean topology, subtle subsurface scattering
- Digital effect: Holographic edge glow 1-2px, faint scan-line overlay at 5% opacity
- Particles: Small floating geometric shapes (triangles, circles, hexagons) orbit slowly
- Background: Circular gradient glow in department color, fading to transparent

Section 2 — 8 Character Lineup (side by side):

Atlas (CTO): East Asian male, short neat black hair, thin rectangular glasses, confident half-smile, navy collar. Particles: code {} arrows.
Nova (Frontend): South Asian female, shoulder-length purple-highlighted hair, creative earrings, bright eyes. Particles: UI rectangles, color swatches.
Sentinel (QA): Black androgynous, buzz cut, sharp eyes, tactical headset, serious. Particles: checkmarks, bug icons.
Echo (Backend): Caucasian male, messy curly brown hair, stubble, hoodie collar. Particles: database cylinders, API arrows.
Sage (Content): East Asian female, hair in bun, round glasses, warm smile, turtleneck. Particles: text lines, pen nibs.
Vector (DevOps): Latino male, beanie, terminal-green hair streak, techwear. Particles: gears, pipeline arrows.
Pixel (Designer): Black female, asymmetric bob purple-to-pink gradient, piercings, bold. Particles: shapes, paintbrush strokes.
Scout (Marketing): Middle Eastern male, short beard, side-part, earpiece, friendly. Particles: chart bars, megaphone.

Section 3 — 5 Animation States (show Atlas in all 5):
Idle | Working | Warning | Paused | Error (with visual descriptions of each)

Section 4 — Department Color Map:
Swatches: Engineering #3B82F6, Design #A855F7, Marketing #14B8A6, QA #F59E0B, DevOps #6B7280, Content #14B8A6, Executive #8B5CF6

Section 5 — 4 Size Variants (show Atlas):
XS 32x32 (table rows) | SM 48x48 (feed items) | MD 160x200 (card) | LG 240x300 (detail panel)

Style: Game studio character design bible. Clean layout, annotation lines, organized reference.
```

---

## 3. Desktop Dashboard 页面

### 3.1 总览页 (Overview)

```
Design a dark-mode SaaS dashboard "Company Overview" page for BuildCrew.

Top bar:
- Left: BuildCrew logo (wrench+people icon, blue) + company dropdown "Acme AI Corp"
- Center: Tabs — Overview (active) | Agents | Tasks | Budget | Knowledge | Guardian | Plugins
- Right: Search (⌘K), notification bell (red badge "3"), user avatar

Row 1 — 4 Stat Cards:
- "Active Agents": "8" with green dot, "3 working · 5 idle"
- "Tasks Today": "12 completed" sparkline trending up, "+4 vs yesterday"
- "Daily Spend": "$18.40" mini bar chart, "Budget: $150/day · 12% used"
- "Guardian Alerts": "2 warnings" amber, "0 critical" green

Row 2 — Two panels:

Left: "Agent Activity Feed" (live):
- 🟢 "Atlas (CTO) completed task #142 — API auth module" — 2min ago
- 🔵 "Nova (Frontend) picked up task #145 — Dashboard redesign" — 5min ago
- 🟡 "Sentinel (QA) flagged issue in PR #89" — 12min ago
- 🔴 "Guardian: Budget warning — Echo at 78% monthly limit" — 18min ago
Each row: agent avatar + event text + timestamp

Right: "Org Chart" (mini tree):
- CEO (top, violet) → CTO (blue) → Backend (gray), Frontend (gray)
- CEO → CMO (teal) → Content (gray)
Each node: circle avatar + name + status dot
"View full org chart →" link

Row 3 — "Today's Goal Progress":
- "Launch MVP by March 30" — 67% ████████░░░ — 8/12 tasks
- "Set up CI/CD pipeline" — 100% ██████████ ✅
- "Write API docs" — 23% ██░░░░░░░░ — 3 blocked (amber)

Footer: "Last heartbeat: 14s ago · All systems operational"

Style: Dark #0A0A0F bg, cards with #1E293B borders, blue accents. Clean, information-dense, Linear/Vercel aesthetic.
```

### 3.2 Agent 管理页

```
Design a dark-mode "Agents" page for BuildCrew dashboard.

Top: "Agents" title + "8 agents hired · 3 active" subtitle
Right: Blue "+ Hire Agent" button + filter dropdown "All Departments"

2-column grid of Agent Cards (use the card component from Section 2):

Show all 8 agents: Atlas/Nova/Sentinel/Echo/Sage/Vector/Pixel/Scout with their respective states, scores, budgets, and department colors as defined in Section 2.2.

Department color-coded: Engineering=blue, Design=purple, Marketing=teal, QA=amber, DevOps=gray

Each card hoverable with department-color border glow.
```

### 3.3 任务看板页 (Kanban)

```
Design a dark-mode Kanban board "Tasks" page for BuildCrew.

Top: "Tasks" title + filter chips [All] [My Approvals (2)] [Blocked (1)] [Today]
View toggle: Kanban (active) | List | Timeline
Search with ⌘K hint

4 Kanban columns:

"Backlog" (5 items, muted header):
Simple cards: title + priority dot + agent avatar
"Implement password reset flow" — orange dot — unassigned

"In Progress" (3 items, blue header):
Rich cards: title, agent avatar+name, goal breadcrumb "MVP Launch > Auth Module > Task", time elapsed, cost
1. "API auth module" — Atlas — 23min — $0.42
2. "Dashboard components" — Nova — 1h12m — $1.20
3. "Unit tests for auth" — Sentinel — 8min — $0.15

"In Review" (2 items, purple header):
Cards with review pipeline status:
1. "Payment integration" — Auto Check ✅ — Peer Review 🔄 (by Atlas)
2. "Landing page copy" — Auto ✅ — Peer ✅ — Human Gate ⏳ Awaiting approval
   Yellow highlight, [Approve] [Reject] buttons visible

"Done" (6 items, green header):
Completed cards with ✅, completion time, cost — slightly faded

Style: Draggable feel, colored column top borders, Linear-like aesthetic.
```

### 3.4 预算仪表盘

```
Design a dark-mode "Budget & Costs" page for BuildCrew.

Top — 4 summary cards:
- "Monthly Budget": "$500"
- "Spent This Month": "$127.40" (25.5%)
- "Projected Month End": "$312" green (under budget)
- "Saved by Smart Router": "$43.20" green arrow ↓

Middle — 2 charts side by side:

Left: "Daily Spend" line chart
X: March 1-23, Y: dollars
Blue line = daily spend, dotted red line = daily limit ($16.67)
Shaded area under line, hover tooltip with agent breakdown

Right: "Spend by Agent" donut chart
Atlas $31.20 (24.5%), Nova $24.80 (19.5%), Echo $22.10 (17.3%), others combined
Center: "$127.40 total"

Bottom — "Agent Budget Details" table:
| Agent | Role | Runtime | Budget | Spent | Remaining | Usage | Status |
Atlas | CTO | Claude Opus | $50 | $31.20 | $18.80 | 62% [====--] | ✅ Healthy
Echo | Backend | Codex | $40 | $31.00 | $9.00 | 78% [======-] | ⚠️ Watch
Nova | Frontend | Cursor | $30 | $24.80 | $5.20 | 83% [======-] | ⚠️ Warning
Sentinel | QA | Sonnet | $20 | $8.40 | $11.60 | 42% [===---] | ✅ Healthy

Usage bars color-coded: green <70%, amber 70-90%, red >90%.
```

### 3.5 Guardian 安全监控页

```
Design a dark-mode "Guardian" security page for BuildCrew.

Top: Alert counters — "0 Critical" green | "2 Warnings" amber pulse | "5 Info" gray
Right: "Guardian Status: Active" green dot + "Policies: 12 rules"

Active alerts:

Card 1 (amber left border):
⚠️ "Budget Velocity Alert — Nova (Frontend)"
"Token consumption 3.2x above average. Possible inefficient prompt loop."
Evidence: "Task #145: 12,400 tokens in 8min (avg: 3,800)"
18min ago | [Investigate] [Pause Agent] [Dismiss]

Card 2 (amber):
⚠️ "File Access Outside Scope — Echo (Backend)"
"Attempted to read /infrastructure/terraform/main.tf — denied_paths."
1h ago | [View Details] [Allow Once] [Dismiss]

Card 3 (blue):
ℹ️ "Repetition Pattern — Sage (Content)"
"Regenerated intro 3 times with similar output."
2h ago | [View Details] [Dismiss]

Bottom: "Recent Guardian Activity" timeline:
🟢 "Blocked rm -rf from Echo" auto-blocked 3h ago
🟢 "Security scan passed PR #87" clean 4h ago
🟡 "Dependency vuln: lodash CVE" 6h ago
🟢 "All agents within budget" hourly check 7h ago

Right sidebar: "Guardian Policies" collapsible — File Access (4), Commands (3), Cost (3), Network (2) — each with toggle
```

### 3.6 Knowledge Hub 页

```
Design a dark-mode "Knowledge Hub" page for BuildCrew.

Top: "Knowledge Hub" + "47 entries · Auto-learning enabled"
Search: "Search knowledge..." with semantic search icon
Filters: All | Patterns | API Quirks | Configs | Past Failures | ADR
Right: "+ Add Entry"

Masonry grid of knowledge cards:

Card 1 (blue "Pattern" tag):
"Auth flow uses JWT + refresh token rotation"
Preview: "All API endpoints except /health require Bearer token..."
Source: "Discovered by Atlas in Task #98"
Tags: [auth] [jwt] [security]
Confidence: ████████░░ 85% — Cited 12 times

Card 2 (amber "API Quirk" tag):
"Stripe webhook requires raw body for signature"
Preview: "Do NOT parse body before stripe.webhooks.constructEvent()..."
Source: "Echo after 2 failed attempts in Task #112"
Tags: [stripe] [webhook] [gotcha]
Confidence: ██████████ 97% — Cited 8 times

Card 3 (red "Past Failure" tag):
"Do not cascade delete on users table"
Preview: "Caused all orders/reviews wiped in staging..."
Tags: [database] [delete] [critical]
Confidence: ██████████ 100%

Card 4 (green "Config"): "PG pool max: 20 local, 100 prod"
Card 5 (purple "ADR"): "ADR-003: React Query over Redux for server state"

Style: Notion database view feel. Color-coded pill tags. Confidence as thin progress bar.
```

### 3.7 Smart Router 页

```
Design a dark-mode "Smart Router" page for BuildCrew.

Top: "Smart Router" + "Intelligent task assignment"
Strategy chips: [Cost Optimized] [Quality First] [Speed First] [Balanced ✓] [Round Robin]
Stats: "42 tasks routed today · Avg 1.2s · Est. savings: $43"

"Recent Routing Decisions" table:
| Task | Complexity | Candidates | Selected | Strategy | Reasoning | Est. Cost |
#148 Fix login | Simple 🟢 | Atlas,Echo,Nova | Echo | Balanced | "Lowest queue, 93% on bugs, Codex 40% cheaper" | $0.30
#147 Design tokens | Medium 🟡 | Pixel,Nova | Pixel | Quality | "Design: Pixel 94% vs Nova 71%" | $1.20
#146 Rate limiting | Complex 🔴 | Atlas,Echo | Atlas | Quality | "97% success on similar scope" | $2.80

Expandable rows for full scoring breakdown.

Bottom left: "Agent Workload" horizontal bars:
Atlas ████████░░ 6 tasks (2 active)
Echo ██████░░░░ 5 (1 active)
Nova █████░░░░░ 4 (1 active)

Bottom right: "Routing Efficiency":
First-try success: 89% (↑12% since Smart Router)
Avg task cost: $1.24 (↓31% vs manual)
Avg completion: 34min (↓18%) — sparkline trends
```

### 3.8 Evolution Engine 页

```
Design a dark-mode "Evolution" page for BuildCrew.

Tabs: [Performance ✓] [A/B Tests] [Experience Replay]

Performance tab:

Agent leaderboard (horizontal cards):
#1 Sentinel (QA) — 96/100 ↑ Improving (green) — sparkline up
#2 Atlas (CTO) — 94/100 → Stable (blue)
#3 Vector (DevOps) — 93/100 ↑
#4 Echo (Backend) — 88/100 ↓ Declining (amber) "Review recommended"

Selected agent detail (Atlas):
Radar chart 5 axes: Correctness 97, Code Quality 92, Efficiency 88, Cost Efficiency 91, First-try Pass 96

Performance history line chart (30 days) with annotated dips

Recommendations panel:
- "Consider reassigning complex DB tasks from Echo to Atlas (+15% success)"
- "Sentinel underutilized — 40% capacity"
- "Sage +20% quality after Knowledge Hub integration"

Style: Gamified leaderboard. Radar chart prominent. Green/amber/red trends.
```

### 3.9 Plugin 管理页

```
Design a dark-mode "Plugins" page for BuildCrew.

Top: "Plugins" + "4 installed · 2 active"
Right: [Browse Plugin Market] blue button + [+ Install from URL] ghost button

Installed Plugins — card grid (2 columns):

Card 1 (active, green dot):
Icon: Jira logo | "Jira Sync" | by @community
"Bi-directional task sync with Jira projects"
Status: Active · Last sync 5min ago
Version: 1.2.0 | [Configure] [Disable] [Remove]

Card 2 (active, green dot):
Icon: Slack logo | "Slack Notifications" | by BuildCrew (official)
"Send agent events and alerts to Slack channels"
Status: Active · 47 notifications today
[Configure] [Disable]

Card 3 (inactive, gray):
Icon: Notion logo | "Notion Export" | by @community
"Export Knowledge Hub entries to Notion pages"
Status: Disabled
[Enable] [Remove]

Card 4 (inactive, gray):
Icon: chart | "Custom Analytics" | by @community
"Additional dashboard widgets for deep analytics"
Status: Disabled
[Enable] [Remove]

Bottom section: "Plugin API" developer callout:
"Build your own plugins — extend BuildCrew with custom integrations."
Code snippet: `export default { name: "my-plugin", onTaskCompleted(task) { ... } }`
[Read Plugin Docs →]

Style: Clean card grid, similar to VS Code extensions panel. Official plugins have a verified badge.
```

### 3.10 集团仪表盘 (Multi-Company)

```
Design a dark-mode "Group Dashboard" page for BuildCrew — showing multiple AI companies managed from one instance.

Top: BuildCrew logo + "Group Overview" + company count "4 companies running"

3 stat cards:
- "4 Companies": with colored dots for each
- "28 Agents": "12 working · 16 idle"
- "Total Spend": "$1,400 / $1,500 monthly budget"

Company health ranking (full-width cards, stacked):

🟢 "AI SaaS Product Co." — 72% goal progress — Budget healthy — 0 alerts
   9 agents | $500/mo | Active since Jan 2026
   [Enter Dashboard →]

🟢 "Cross-Border E-Commerce" — 58% — Budget healthy — 1 alert
   10 agents | $300/mo | Active since Feb 2026
   [Enter Dashboard →]

🟡 "Content Agency" — 34% — Budget tight — 2 alerts
   8 agents | $400/mo | ⚠️ 2 agents approaching limit
   [Enter Dashboard →]

🔴 "Design Studio" — 12% — Over budget — 3 alerts
   8 agents | $200/mo | 🔴 Pixel agent paused (budget exceeded)
   [Enter Dashboard →]

Each card: left color indicator, company name, progress bar, key stats, enter button.

Bottom: "Cross-Company Budget" stacked bar chart showing each company's spend vs budget.

Style: Executive dashboard feel. Scannable health indicators. Click any company → enters that company's full dashboard.
```

---

## 4. Mobile 页面

### 4.1 移动端首页

```
Design mobile screen (iPhone 16 Pro, 393x852) for BuildCrew, dark mode.

Top: "Acme AI Corp" + switch icon, bell with red badge "2"

Quick stats 2x2 grid:
"8 Agents" green "3 active" | "12 Tasks" "4 done today"
"$18.40" "12% budget" | "2 Alerts" amber

"Needs Your Attention" feed:

Card 1 (amber, prominent):
🔔 "Approval Required"
"Nova wants to modify database schema"
"Task: #145 — Dashboard redesign"
[✅ Approve] [❌ Reject] — 5min ago

Card 2 (amber):
⚠️ "Budget Warning"
"Echo at 83% monthly budget — $33.20/$40.00 — 9 days left"
[Increase Budget] [Pause Agent] [Dismiss]

Card 3 (blue):
✅ "Task Completed"
"Atlas finished: API auth module — 47min · $1.80 · 94/100"
[View Details]

Bottom tabs: Home (active blue) | Agents | Tasks | Budget | More

Style: iOS native dark. Approval actions thumb-friendly. Actionable items prioritized.
```

### 4.2 移动端审批页

```
Design mobile approval detail (iPhone 16 Pro, 393x852) for BuildCrew, dark mode.

Nav: "← Back" + "Approval Request"

Agent info: Robot avatar blue ring + "Nova — Frontend Engineer" + "Runtime: Cursor"

Request card:
Type: "Database Schema Change"
Task: "#145 — Dashboard component library"
Goal: "MVP Launch → Frontend → Dashboard"

Change description:
Code block (monospace):
ALTER TABLE preferences
  ADD COLUMN theme VARCHAR(20) DEFAULT 'dark',
  ADD COLUMN language VARCHAR(5) DEFAULT 'en';

Risk: "Medium" amber badge
Affected: "preferences (12,400 rows)"
Reversible: "Yes — DROP COLUMN"
Cost: "$0.12"

Guardian checks:
✅ No destructive operations
✅ Within file scope
⚠️ Schema change — requires approval

Sticky bottom actions:
[✅ Approve] full green large
[❌ Reject with Comment] outlined red
[💬 Ask for More Info] text link
```

### 4.3 移动端日报页

```
Design mobile "Daily Report" (iPhone 16 Pro, 393x852) for BuildCrew, dark mode.

Top: "Daily Report — March 23, 2026" + 🔊 "Listen" button (TTS)

Horizontal scroll summary cards:
"12 Tasks Done" ✅ ↑9 | "$18.40 Spent" 💰 12% | "94 Avg Score" ⭐ ↑2 | "2 Alerts" ⚠️

Highlights:
1. ✅ "API auth completed — all tests passing"
2. ✅ "CI/CD pipeline operational"
3. 🎯 "MVP: 67% → 72%"

Issues:
1. ⚠️ "Nova approaching budget limit"
2. ⚠️ "API docs blocked — waiting endpoints"

Agent Performance:
🥇 Atlas: 3 tasks, $4.20, score 96
🥈 Sentinel: 4 tasks, $2.10, score 94
🥉 Nova: 2 tasks, $5.80, score 88
📉 Echo: 1 task, $3.40, score 72 (flagged)

Tomorrow's Plan:
"5 tasks queued · Est $22-28 · Focus: frontend MVP"

Bottom: "Generated 9:00 AM · Next in 23h"
```

### 4.4 移动端 Agent 卡片列表

```
Design mobile "Agents" screen (iPhone 16 Pro, 393x852) for BuildCrew, dark mode.

Nav: "Agents" title + filter icon

Compact agent cards (full-width, stacked, ~100px each):

Each card:
- Left: SM avatar (48x48) with status ring + department color
- Middle: Name + Role badge + Runtime tag + Status text
- Right: Score ring (40x40) + budget mini bar

8 cards stacked:
Atlas CTO ● Working 96↑ ████░ 62%
Nova Frontend ● Working 88→ ██████░ 83% ⚠️
Sentinel QA ● Working 94↑ ███░░ 42%
Echo Backend ⚠️ Warning 72↓ █████░ 78% ⚠️
Sage Content ● Idle 85→ █░░░░ 20%
Vector DevOps ● Idle 93↑ █░░░░ 20%
Pixel Designer ⏸ Paused 82→ ███░░ 51%
Scout Marketing ● Idle 79↓ ██░░░ 45%

Tap any card → opens detail view (Section 2.3 adapted for mobile)

Bottom tabs same as 4.1

Style: Dense but scannable. Status indicators prominent. Warning agents have amber highlight.
```

---

## 5. 用户界面与全局导航

> 覆盖顶栏右上角用户区域的所有交互状态、下拉菜单、通知面板、搜索弹窗、设置页面、登录/注册流程

### 5.1 顶栏（Top Bar）完整设计

```
Design the complete top navigation bar for BuildCrew dashboard, dark mode. Full width, height 56px, background #0A0A0F, bottom border 1px #1E293B.

Layout (left to right):

── LEFT ZONE (brand + company) ──
- BuildCrew logo icon (wrench+people, 24x24, blue #3B82F6)
- Company name "Acme AI Corp" as dropdown trigger — 14px medium white
- Small chevron-down icon (12px, gray)
- Green status dot (6px) next to company name indicating "All systems operational"

── CENTER ZONE (main navigation tabs) ──
Tab items with 16px medium text, 32px horizontal spacing:
[Overview] [Agents] [Tasks] [Budget] [Knowledge] [Guardian] [Plugins]
- Active tab: white text + blue underline (2px) + subtle blue glow
- Inactive: #94A3B8 (gray text)
- Hover: white text, no underline yet
- Each tab can have a notification badge (small red circle with count) — e.g., "Tasks" tab might show a blue badge "3" for pending approvals

── RIGHT ZONE (utilities + user) ──
Items from left to right, 12px spacing between items:

1. Search trigger button:
   - Icon: magnifying glass (Lucide Search, 20px, gray)
   - Text: "Search..." in 13px gray
   - Keyboard shortcut badge: "⌘K" in a small pill (bg #1E1E2A, text #94A3B8, rounded 4px)
   - Hover: icon turns white, bg subtle lighten
   - Click: opens Command Palette overlay (see Section 5.3)

2. Notification bell:
   - Icon: Lucide Bell, 20px, gray
   - Badge: red circle (16px) with white count "3" — positioned top-right of icon
   - Hover: icon turns white
   - Click: opens Notification Panel (see Section 5.4)

3. User avatar + dropdown:
   - Circular avatar (32x32) with 2px border ring
     - If user has uploaded photo: show photo
     - Default: initials on gradient background (first letter of name, bg blue-to-violet gradient)
   - Online status: green dot (8px) bottom-right of avatar
   - Click: opens User Dropdown Menu (see Section 5.2)

Show the top bar in TWO states:
State A: Normal (no notifications, no dropdowns open)
State B: Active (notification badge "3", user dropdown open)
```

### 5.2 用户下拉菜单（User Dropdown）

```
Design the user dropdown menu for BuildCrew, dark mode. Opens when clicking the user avatar in top-right corner.

Dropdown panel: width 280px, rounded 12px, bg #13131A, border 1px #1E293B, shadow-lg. Appears below and right-aligned with the avatar.

LAYOUT (top to bottom):

── HEADER SECTION ──
- User avatar (48x48) + Name "Lin" (16px bold white) + Email "lin@example.com" (13px gray)
- Subscription badge: "Pro" pill (green bg, small) or "Free" (gray bg)
- If Pro: "Renews Apr 23, 2026" in 12px gray

── DIVIDER (1px #1E293B) ──

── ACCOUNT SECTION ──
Menu items (each 40px height, 14px, full-width hover bg #1E1E2A, rounded 6px, 8px horizontal padding):
- 👤 "Profile & Account" — right arrow icon
- ⚙️ "Settings" — right arrow icon
- 🔑 "API Keys" — right arrow icon, amber dot if no key set
- 💳 "Subscription & Billing" — right arrow icon
- 🧩 "My Plugins" — right arrow icon, count badge "2 installed"

── DIVIDER ──

── COMPANY SECTION ──
- 🏢 "Switch Company" — right arrow, opens company submenu
- ➕ "Create New Company" — blue text

── DIVIDER ──

── PREFERENCES SECTION ──
- 🌙 "Dark Mode" — toggle switch (ON by default, green)
- 🌐 "Language" — "English" with dropdown chevron
- 🔔 "Notification Preferences" — right arrow

── DIVIDER ──

── FOOTER SECTION ──
- 📖 "Documentation" — external link icon
- 💬 "Community (Discord)" — external link icon
- 🐛 "Report a Bug" — external link icon
- ❓ "Help & Support" — right arrow

── DIVIDER ──

- 🚪 "Sign Out" — red text, left-aligned

── BOTTOM (if Free user) ──
Upgrade banner: blue gradient bg, "Upgrade to Pro — Unlimited agents, Smart Router, mobile access" + [Upgrade $29/mo] button

Show TWO states: dropdown for a Pro user (with green Pro badge) and for a Free user (with upgrade banner at bottom).
```

### 5.3 命令面板 / 全局搜索（Command Palette）

```
Design a Command Palette / global search overlay for BuildCrew, dark mode. Opens via ⌘K shortcut or clicking the search bar.

Overlay: centered on screen, width 640px, max-height 480px, rounded 16px, bg #13131A, border 1px #1E293B, shadow-xl. Background page dims to 50% opacity (dark scrim).

── TOP: SEARCH INPUT ──
- Left: magnifying glass icon (20px, gray)
- Input field: "Search agents, tasks, knowledge..." placeholder, 16px, white text
- Right: "ESC" pill badge to close
- No border on input, full-width, 48px height, bg transparent

── DIVIDER ──

── RESULTS AREA (scrollable) ──

When empty (just opened), show recent + quick actions:

Section "Quick Actions" (gray header, 12px uppercase):
- 🆕 "Create New Task" — keyboard hint: Enter
- 👤 "Hire New Agent" — hint: ⌘+H
- 🏢 "Switch Company" — hint: ⌘+Shift+C
- ⏸ "Pause All Agents" — hint: ⌘+Shift+P

Section "Recent" (gray header):
- 📋 "Task #148 — Fix login bug" — assigned to Echo
- 🤖 "Atlas (CTO)" — last active 2min ago
- 📊 "Budget Dashboard" — page

When typing (e.g., user types "atlas"):

Section "Agents" (with count badge):
- 🤖 "Atlas" — CTO · Engineering · Working · Score 96
  Highlighted matching text "Atlas" in blue

Section "Tasks" (with count badge):
- 📋 "API auth module" — assigned to Atlas · Done
- 📋 "WebSocket 集成" — assigned to Atlas · In Progress

Section "Knowledge" (with count badge):
- 🧠 "JWT refresh token rotation" — discovered by Atlas

Section "Pages" (with count badge):
- 📄 "Agent Detail — Atlas"

Each result row: icon + title + subtitle (gray) + matching text highlighted in blue
Arrow keys to navigate (selected row has bg #1E1E2A), Enter to open
Bottom bar: "↑↓ Navigate" "Enter Open" "ESC Close" — gray hints

Style: Spotlight / Raycast / Linear command palette feel. Fast, keyboard-first.
```

### 5.4 通知面板（Notification Panel）

```
Design a notification panel for BuildCrew, dark mode. Opens when clicking the bell icon in top-right. Slides in as a right-side panel or drops down as a wide dropdown.

Panel: width 400px, full height (or max 600px dropdown), bg #13131A, border-left 1px #1E293B (if slide panel) or rounded 12px with border (if dropdown).

── HEADER ──
- "Notifications" 16px bold + badge "3 unread"
- Right: [Mark All Read] ghost button + [Settings ⚙️] icon button

── FILTER TABS ──
[All (12)] [Unread (3)] [Approvals (2)] [Alerts (1)] [System (0)]
Active tab: blue underline, inactive: gray

── NOTIFICATION LIST (scrollable) ──

Unread notifications have a blue left border (3px) and slightly brighter background (#1A1A25).

Notification 1 (unread, approval type):
- Icon: 🔔 amber circle
- "Approval Required" — bold white 14px
- "Nova wants to modify database schema for Task #145"
- "5 minutes ago"
- Quick actions: [Approve ✅] [Reject ❌] inline small buttons
- Unread indicator: blue dot left side

Notification 2 (unread, alert type):
- Icon: ⚠️ amber
- "Budget Warning"
- "Echo (Backend) reached 83% of monthly budget ($33.20/$40)"
- "32 minutes ago"
- Quick action: [View Budget →]
- Blue dot

Notification 3 (unread, completion type):
- Icon: ✅ green
- "Task Completed"
- "Atlas finished 'API auth module' — Score: 98/100 — Cost: $1.80"
- "1 hour ago"
- Quick action: [View Task →]
- Blue dot

Notification 4 (read, info type):
- Icon: ℹ️ blue, dimmed
- "Agent Hired"
- "Pixel (Designer) joined the company"
- "3 hours ago"
- No blue dot, slightly faded

Notification 5 (read, system type):
- Icon: 🔧 gray, dimmed
- "System Update"
- "BuildCrew v1.2.0 available. New: Smart Router improvements."
- "Yesterday"
- Quick action: [Update →]

── BOTTOM ──
[View All Notifications →] link centered

Style: Clean, scannable. Unread items are visually prominent. Quick actions allow resolving without leaving the current page.
```

### 5.5 设置页面（Settings）

```
Design a "Settings" page for BuildCrew, dark mode. Accessed from User Dropdown > Settings.

Layout: Left sidebar navigation (240px) + right content area (flexible).

Left sidebar — Settings navigation:
Sections with icons (each item 40px height, active has blue left border + blue text):

"Account"
  - 👤 Profile (active)
  - 🔑 API Keys
  - 💳 Subscription
  - 🔒 Security

"Company" (scoped to current company)
  - 🏢 General
  - 👥 Members (Team plan only, shows lock icon for Free/Pro)
  - 🛡️ Guardian Policies
  - 🔔 Notifications
  - 🧩 Plugins

"Preferences"
  - 🎨 Appearance
  - 🌐 Language & Region
  - ⌨️ Keyboard Shortcuts

Right content — "Profile" tab active:

Section "Personal Information":
- Avatar upload area (80x80 circle + "Change Photo" button below)
- Form fields (stacked, each with label + input):
  - "Display Name": text input, value "Lin"
  - "Email": text input, value "lin@example.com", verified badge ✅
  - "Role": dropdown, "Owner"

Section "Connected Accounts":
- GitHub: "Connected as @lin" — green check — [Disconnect] button
- Google: "Not connected" — [Connect] button

Section "Danger Zone" (red border card, bottom):
- "Delete Account" — description "Permanently delete your account and all data"
- [Delete Account] red outline button

[Save Changes] blue button, top-right of content area, disabled until form is dirty

---

Also show the "API Keys" tab content as a second frame:

Section "API Keys":
- Description: "Manage API keys for programmatic access to BuildCrew"
- Table:
  | Name | Key | Created | Last Used | Actions |
  | "Production" | bc_sk_...7x4f (masked) | Mar 10 | Mar 23 | [Reveal] [Revoke] |
  | "Development" | bc_sk_...9k2m (masked) | Mar 15 | Mar 22 | [Reveal] [Revoke] |
- [+ Create New Key] button
- Warning box: "API keys grant full access to your account. Never share them."

---

Also show the "Subscription" tab:

Section "Current Plan":
- Large card showing:
  - Plan name: "Pro" with blue badge
  - Price: "$29/month" (or "$290/year")
  - Renewal: "Next billing date: April 23, 2026"
  - Payment: "Visa ending in 4242" with [Update Payment] button
  - Features included (checkmark list):
    ✅ Unlimited Agents
    ✅ Unlimited Plugins
    ✅ Smart Router
    ✅ Guardian Advanced
    ✅ Mobile App
    ✅ Knowledge Hub

- [Change Plan] button → shows plan comparison (Free/Pro/Team)
- [Cancel Subscription] gray text link below
- Invoice history table:
  | Date | Amount | Status | Invoice |
  | Mar 23 | $29.00 | Paid ✅ | [Download PDF] |
  | Feb 23 | $29.00 | Paid ✅ | [Download PDF] |

---

Also show the "Appearance" tab:

Section "Theme":
- Three theme cards (selectable radio):
  - 🌙 "Dark" (selected, blue border)
  - ☀️ "Light"
  - 💻 "System" (follow OS)
- Preview thumbnail of dashboard in each theme

Section "Accent Color":
- 6 color swatches to choose primary accent:
  Blue (#3B82F6, selected) | Purple (#8B5CF6) | Green (#10B981) | Red (#EF4444) | Orange (#F97316) | Pink (#EC4899)
- "Default: Blue" text

Section "Sidebar":
- Toggle: "Compact sidebar" — off by default
- Toggle: "Show agent avatars in sidebar" — on

Style: Clean settings page like GitHub Settings or Linear Settings. Left nav stays visible, content scrolls independently.
```

### 5.6 登录 / 注册 / Onboarding 流程

```
Design the authentication and onboarding flow for BuildCrew, dark mode. 4 screens.

SCREEN 1 — Login Page (full page, centered card):
Background: dark gradient #0A0A0F with subtle grid pattern
Center card (480px wide, rounded 16px, bg #13131A, border #1E293B, shadow-lg):

- BuildCrew logo + "BuildCrew" wordmark (centered, top)
- "Welcome back" — 24px bold
- "Sign in to manage your AI crew" — 14px gray

- [Continue with GitHub] button (full width, dark bg with GitHub icon)
- [Continue with Google] button (full width, dark bg with Google icon)

- Divider: "or" with lines

- Email input field
- Password input field
- [Sign In] blue button full width
- "Forgot password?" text link right-aligned

- Bottom: "Don't have an account? [Sign up]" — gray text with blue link

SCREEN 2 — Sign Up Page:
Same layout as login but:
- "Create your account" heading
- "Start building your AI crew — free forever" subtitle
- Fields: Name, Email, Password
- [Create Account] blue button
- "Already have an account? [Sign in]"
- Terms: "By signing up, you agree to our Terms of Service and Privacy Policy" — small gray, links in blue

SCREEN 3 — Onboarding Step 1 (after first sign-up):
Full page, centered content (max-width 600px):
- Progress: step indicator "1 / 3" with progress bar at top
- "Create your first company" — 24px bold
- "What kind of AI company do you want to build?" — 14px gray

- Company name input: "My AI Company" placeholder
- Mission textarea: "Describe your company's goal..." placeholder

- Template cards (selectable grid, 2 columns):
  🚀 "SaaS Product" — "Build a software product from scratch" — 9 agents
  🛒 "E-Commerce" — "Run a cross-border online store" — 10 agents
  📝 "Content Agency" — "Create and manage content at scale" — 8 agents
  🎨 "Design Studio" — "Deliver design projects for clients" — 8 agents
  ⚡ "Custom" — "Start from scratch with just a CEO agent"
  Each card: icon + title + subtitle + agent count badge
  Selected card has blue border + checkmark

- [Continue →] blue button

SCREEN 4 — Onboarding Step 2:
- Progress: "2 / 3"
- "Meet your CEO" — 24px bold
- Large digital human avatar (CEO character, animated idle state)
- "Your CEO agent will help you hire the rest of the team and set strategy"

- "CEO Name" input: default "Aria"
- "AI Model" dropdown: Claude Opus (recommended) | Claude Sonnet | GPT-4o | DeepSeek V3.2
- "Monthly Budget" slider: $0 — $500 (default $50)
  Shows estimated: "~1,000 tasks per month at this budget"

- "API Key" input: "Enter your API key for the selected model" with [How to get a key?] link
  Validated state: green checkmark if valid

- [Launch Your Company 🚀] blue button, large, prominent

Style: Onboarding should feel exciting, not like a form. The CEO character animation and template cards make it feel like building something alive. Progress indicator gives momentum.
```

### 5.7 移动端用户菜单

```
Design the mobile user menu for BuildCrew (iPhone 16 Pro, 393x852), dark mode.

Triggered by tapping "More" tab in bottom navigation.

Full-screen overlay sliding up from bottom, rounded top corners 16px, bg #13131A.

── HEADER ──
User avatar (56x56) centered + "Lin" 18px bold + "lin@example.com" 13px gray
"Pro" badge green pill
[×] close button top-right

── MENU ITEMS (full-width list, 52px each, 16px text) ──
Section "Account":
- 👤 Profile & Account →
- 🔑 API Keys →
- 💳 Subscription →

Section "Company":
- 🏢 Switch Company → (shows current: "Acme AI Corp")
- ⚙️ Company Settings →

Section "Preferences":
- 🌙 Dark Mode — toggle (ON)
- 🔔 Notifications → (shows "3 unread" badge)
- 🌐 Language — "English" →

Section "Support":
- 📖 Documentation ↗
- 💬 Discord ↗
- 🐛 Report Bug →

── BOTTOM ──
[Sign Out] red text button centered
"BuildCrew v1.2.0" version text, tiny gray, centered

Style: iOS-style action sheet feel. Large touch targets. Clean grouping.
```

### 5.8 公司切换面板（Company Switcher）

```
Design a company switcher dropdown for BuildCrew, dark mode. Opens when clicking the company name in the top-left of the top bar.

Dropdown: width 320px, rounded 12px, bg #13131A, border 1px #1E293B, shadow-lg. Appears below the company name.

── HEADER ──
"Your Companies" 13px gray uppercase + [+ New Company] blue text button right-aligned

── COMPANY LIST ──
Each company row (56px height, hover bg #1E1E2A, rounded 8px):

Row 1 (current, selected — has blue left border + blue checkmark right):
- Color dot: 🟢 green (healthy)
- Company name: "Acme AI Corp" 14px bold white
- Subtitle: "SaaS · 8 agents · $127/$500 budget" 12px gray
- Right: ✅ blue checkmark

Row 2:
- 🟢 green dot
- "Cross-Border E-Commerce" 14px white
- "E-Commerce · 10 agents · $89/$300" 12px gray

Row 3:
- 🟡 amber dot (warning)
- "Content Agency" 14px white
- "Content · 8 agents · ⚠️ 2 alerts" 12px amber
- Small amber warning badge

Row 4:
- 🔴 red dot (over budget)
- "Design Studio" 14px white
- "Design · 8 agents · 🔴 Over budget" 12px red

── DIVIDER ──

── BOTTOM ──
- 🏢 "Group Dashboard" — view all companies → link
- ⚙️ "Manage Companies" → link

Click a company row → switches to that company's dashboard, top bar company name updates.

Style: Quick, clean switcher. Status dots give instant health overview without entering each company.
```

### 5.9 Org Chart 完整页面

```
Design a full-page "Org Chart" view for BuildCrew, dark mode. Accessed by clicking "View full org chart →" from Overview, or as a sub-view of Agents page.

Top: "Organization Chart" title + "Acme AI Corp" subtitle + [Edit Structure] button + zoom controls (+ / - / fit)

Main area — Interactive tree visualization, centered, zoomable and pannable:

Tree structure (vertical, top to bottom):

Level 0 (CEO):
┌────────────────────────┐
│ 👤 Aria (CEO)          │
│ Executive · Claude Opus │
│ ● Working · Score 92   │
│ Budget: $45/$60        │
└──────────┬─────────────┘
           │
     ┌─────┴──────────────────┐
     │                        │
Level 1 (C-suite):
┌─────────────────┐    ┌─────────────────┐
│ 👤 Atlas (CTO)  │    │ 👤 Scout (CMO)  │
│ Eng · Opus      │    │ Mkt · Sonnet    │
│ ● Working · 96  │    │ ● Idle · 79     │
│ $31.2/$50       │    │ $9/$20          │
└───────┬─────────┘    └───────┬─────────┘
        │                      │
   ┌────┼────┐            ┌────┘
   │    │    │            │
Level 2 (Individual contributors):
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│Nova  │ │Echo  │ │Senti.│ │Sage  │
│Front │ │Back  │ │QA    │ │Cont. │
│●Work │ │⚠️Warn│ │●Work │ │●Idle │
│88    │ │72    │ │94    │ │85    │
└──────┘ └──────┘ └──────┘ └──────┘

Also show separately:
┌──────┐ ┌──────┐
│Vector│ │Pixel │
│DevOps│ │Design│
│●Idle │ │⏸Pause│
│93    │ │82    │
└──────┘ └──────┘

Each node is a mini agent card:
- Digital human avatar (SM 48x48) at top
- Name + role
- Status dot + score
- Department color border (left side)
- Click → opens agent detail panel

Connection lines:
- Solid lines for direct report relationships
- Color-coded by department (blue for engineering branch, teal for marketing)
- Animated pulse on lines between working agents

Right sidebar (collapsible):
"Org Summary"
- Total: 8 agents
- By Department: Engineering 4, Marketing 2, Design 1, DevOps 1
- By Status: Working 3, Idle 3, Warning 1, Paused 1
- Total Budget: $127.40/$215.00/month

Interaction: drag to pan, scroll to zoom, click node to select, double-click to open detail.

Style: Clean tree visualization like organizational chart tools. Not cluttered. Generous spacing between nodes. Subtle animated connections.
```

### 5.10 Hire Agent 弹窗（完整流程）

```
Design a "Hire New Agent" modal dialog for BuildCrew, dark mode. Opens from Agents page → "+ Hire Agent" button.

Modal: width 560px, max-height 80vh, rounded 16px, bg #13131A, border 1px #1E293B, shadow-xl. Centered with dark scrim behind.

── STEP 1 of 3: Choose Role ──

Header: "Hire a New Agent" 20px bold + step indicator "1/3" + [×] close button

"Choose a role template or create custom"

Role template grid (2 columns, scrollable):
Each template card (selectable, click to select, selected has blue border):

- 💼 "CTO" — "Technical architecture, engineering team lead" — Executive — Recommended: Claude Opus
- 🖥️ "Frontend Engineer" — "React, UI/UX implementation" — Engineering — Rec: Cursor
- ⚙️ "Backend Engineer" — "APIs, databases, infrastructure" — Engineering — Rec: Codex
- 🧪 "QA Engineer" — "Testing, quality assurance, bug hunting" — QA — Rec: Claude Sonnet
- 🎨 "Designer" — "UI design, brand, visual assets" — Design — Rec: Claude Opus
- 📝 "Content Writer" — "Blog posts, docs, marketing copy" — Content — Rec: Claude Haiku
- 📊 "Marketing" — "Growth, ads, social media, analytics" — Marketing — Rec: Claude Sonnet
- 🔧 "DevOps" — "CI/CD, deployment, infrastructure" — DevOps — Rec: Bash Scripts
- ➕ "Custom Role" — "Define your own role from scratch" — dashed border

Bottom: [Cancel] ghost + [Next →] blue (disabled until selection)

── STEP 2 of 3: Configure Agent ──

Header: "Configure Atlas" (name from template) + "2/3" + [← Back]

Form fields:
- "Agent Name": text input, pre-filled from template, editable — "Atlas"
- "Job Title": text input — "CTO"
- "Department": dropdown — Engineering / Design / Marketing / QA / DevOps / Content / Executive / Custom
- "Reports To": dropdown of existing agents — "Aria (CEO)" or "None (top-level)"
- "AI Model": dropdown with recommendations
  - Claude Opus 4 (Recommended for this role) ⭐
  - Claude Sonnet 4
  - GPT-4o
  - DeepSeek V3.2
  - Codex
  - Custom (enter endpoint)
- "API Key": password input — "sk-..." (if not already configured for this model)
  Status: ✅ "Valid key detected" or ❌ "Invalid key"
- "Monthly Budget": number input with slider — $50 default
  Helper text: "~1,000 tasks/month at this budget"
- "Heartbeat Interval": dropdown — Every 1min / 5min (default) / 15min / 30min / 1hour
- "Max Concurrent Tasks": number — 1 / 2 (default) / 3 / 5

Bottom: [← Back] ghost + [Next →] blue

── STEP 3 of 3: Review & Hire ──

Header: "Review & Hire" + "3/3"

Summary card (preview of agent card):
- Digital human avatar (generated based on role template)
- Name: Atlas
- Role: CTO · Engineering · Executive
- Model: Claude Opus 4
- Budget: $50/month
- Heartbeat: Every 5 minutes
- Reports to: Aria (CEO)
- Concurrent tasks: 2

Estimated impact:
- "Monthly cost increase: ~$50"
- "Total company budget usage: $177/$500 (35%)"

Checkbox: "☐ Start agent immediately after hiring" (checked by default)
Checkbox: "☐ Auto-assign queued tasks matching this role"

Bottom: [← Back] ghost + [🎉 Hire Atlas] blue prominent button

After clicking Hire → brief celebration animation (confetti or subtle particle burst) → redirects to agent detail page

Style: Wizard-style multi-step modal. Clean, guided, no overwhelming options. Recommended choices highlighted.
```

### 5.11 Review Pipeline 详情页

```
Design a "Review Details" slide-over panel for BuildCrew, dark mode. Opens when clicking a task in "In Review" column of Kanban.

Slide-over: 640px wide, from right side, full height, bg #13131A, border-left 1px #1E293B.

── HEADER ──
"Review: Payment Integration" 18px bold + Task #143 badge
Status: "In Review" blue badge
[×] close button

── REVIEW PIPELINE VISUALIZATION ──
Horizontal pipeline with 3 stages connected by arrows:

[Stage 1: Auto Check] ✅ Passed
  └ Lint ✅ | TypeCheck ✅ | Tests ✅ (14/14) | Security ✅
  Duration: 45s | No issues found

→ arrow →

[Stage 2: Peer Review] 🔄 In Progress
  └ Reviewer: Atlas (CTO)
  └ Started: 8 min ago
  └ Comments: 2 (1 resolved, 1 open)

→ arrow →

[Stage 3: Human Gate] ⏳ Waiting
  └ "Will activate after peer review passes"
  └ Reason: "Touches payment module (configured in Guardian policy)"

── REVIEW COMMENTS ──
Thread-style comments:

Comment 1 (resolved, dimmed):
Avatar: Atlas | "Consider using a transaction wrapper for the Stripe calls" | 6 min ago
→ Reply: Agent Echo: "Done, wrapped in try/catch with rollback" | 4 min ago
→ Status: ✅ Resolved

Comment 2 (open, highlighted):
Avatar: Atlas | "Missing error handling for webhook timeout scenario. What happens if Stripe doesn't respond in 30s?" | 3 min ago
→ Status: 🔴 Open — awaiting response from Echo

── CODE CHANGES (collapsible) ──
File tree of changed files:
├── src/payments/stripe.ts (+45, -12)
├── src/payments/webhook.ts (+28, -3)
└── tests/payments/stripe.test.ts (+67, -0)

Inline diff preview (first file):
+ import { withTransaction } from '../db/transaction';
+ export async function processPayment(amount: number) {
+   return withTransaction(async (tx) => {
...abbreviated diff...

── BOTTOM ACTION BAR (sticky) ──
If user is the Human Gate approver:
[✅ Approve & Merge] green + [❌ Request Changes] red outline + [💬 Add Comment] ghost

If peer review still in progress:
"Waiting for peer review to complete" — dimmed actions

Style: GitHub PR review feel. Pipeline visualization at top gives instant status. Comments are threaded and interactive.
```

### 5.12 Error / 404 / Loading / Maintenance 状态页

```
Design 4 system state pages for BuildCrew, dark mode. Each is a full-page centered layout.

PAGE 1 — Loading / Splash:
- Center: BuildCrew logo icon (64x64) with subtle pulse animation
- Below: "Loading your AI company..." 16px gray
- Thin progress bar or spinning dots below text
- Background: #0A0A0F
Used when: app first loads, switching companies

PAGE 2 — 404 Not Found:
- Center: Large "404" in 80px bold, slightly transparent (#1E293B)
- Below: Illustration of a confused digital human character (one of the 8 agents, looking puzzled)
- Text: "Page not found" 24px bold white
- Subtext: "The page you're looking for doesn't exist or has been moved." 14px gray
- [← Back to Dashboard] blue button
- [Report this issue] gray text link

PAGE 3 — Error / Something Went Wrong:
- Center: Illustration of a digital human with error/glitch effect
- Text: "Something went wrong" 24px bold white
- Subtext: "We've been notified and are working on it." 14px gray
- Error code: "Error BC-5001" in 12px monospace gray
- [Try Again] blue button + [Go to Dashboard] ghost button
- Collapsible "Technical details" showing error stack (monospace, for developers)

PAGE 4 — Maintenance:
- Center: Illustration of a digital human wearing a hard hat / holding wrench
- Text: "We're upgrading BuildCrew" 24px bold white
- Subtext: "Scheduled maintenance in progress. We'll be back shortly." 14px gray
- Estimated time: "Expected completion: ~15 minutes"
- [Check Status Page] blue outline button
- Social links: "Follow @buildcrew for updates"

Style: Friendly, not scary. The digital human characters make error pages feel on-brand rather than generic. Subtle animations (breathing, particle effects) even on error pages.
```

### 5.13 ClipMart 市场浏览页

```
Design a "ClipMart" marketplace browsing page for BuildCrew, dark mode. Accessed from sidebar or Plugins page → "Browse Plugin Market".

Top bar: "ClipMart" logo (shopping bag + paper clip icon) + search bar "Search templates, roles, skills, plugins..." + [My Purchases] button

Category tabs:
[All] [Company Templates] [Role Templates] [Skill Packs] [Workflow Templates] [Avatar Packs]

Filter sidebar (left, 240px):
- Price: [Free] [Paid] [All]
- Rating: ★★★★★ and above / ★★★★ / ★★★
- Sort: Most Popular | Newest | Highest Rated | Price Low-High

Main content — Card grid (3 columns):

Card 1 (Company Template, featured):
- Thumbnail: preview org chart illustration
- "🛒 Cross-Border E-Commerce" — by BuildCrew (official) ✅
- "10 agents · Full org chart · Amazon/Shopee ready"
- Rating: ★★★★★ (4.9) · 2.3K downloads
- Price: "Free" green badge
- [Install] blue button

Card 2 (Skill Pack):
- Thumbnail: code/API illustration
- "⚡ Stripe Integration Pack"  — by @community-dev
- "Payment processing, webhooks, subscription management"
- ★★★★☆ (4.2) · 890 downloads
- Price: "$9.99"
- [Buy & Install] blue button

Card 3 (Role Template):
- Thumbnail: digital human silhouette
- "👤 SEO Specialist" — by @seo-guru ✅ Verified
- "Keyword research, content optimization, rank tracking"
- ★★★★★ (4.7) · 1.5K downloads
- Price: "Free"
- [Install]

Card 4 (Workflow Template):
- "📋 Sprint Planning Flow" — by BuildCrew (official)
- "2-week sprint cycle with automated standup and retro"
- ★★★★☆ (4.4) · 670 downloads
- Price: "$4.99"

Card 5 (Avatar Pack):
- "🎨 Cyberpunk Avatar Pack" — by @pixel-artist
- "8 cyberpunk-themed digital human skins"
- ★★★★☆ (4.0) · 340 downloads
- Price: "$2.99"

Card 6 (Company Template):
- "📚 Education / Course Factory" — by BuildCrew
- "7 agents · Course design to student ops"
- Free

── DETAIL VIEW (when clicking a card) ──
Expand to full detail page or large modal:
- Large header image / preview screenshots (carousel)
- Title + author + verified badge
- Description (markdown rendered)
- "What's Included": list of agents/skills/workflows
- Reviews section (user comments + ratings)
- Version history
- [Install] or [Buy $X] large button
- Compatibility: "Requires BuildCrew v1.2+"

Style: App Store / Shopify App Store feel. Clean cards, clear pricing, trust signals (verified, ratings, download counts). The marketplace should feel like browsing a curated store.
```

### 5.14 Toast / Snackbar 通知组件

```
Design toast notification components for BuildCrew, dark mode. These appear at bottom-right of desktop or bottom-center of mobile for quick feedback.

4 variants (each 360px wide, rounded 12px, shadow-lg):

1. Success toast (green left border, bg #13131A):
   - ✅ green icon
   - "Agent hired successfully" bold 14px
   - "Atlas (CTO) is now part of your team" 13px gray
   - [View Agent] text link blue
   - [×] close button, auto-dismiss after 5s
   - Subtle slide-in from right animation

2. Error toast (red left border):
   - ❌ red icon
   - "Failed to create task" bold 14px
   - "Error BC-4003: Insufficient budget for this agent" 13px gray
   - [Retry] text link + [×]
   - Does NOT auto-dismiss

3. Warning toast (amber left border):
   - ⚠️ amber icon
   - "Budget alert" bold 14px
   - "Echo is at 90% of monthly budget" 13px gray
   - [View Budget] text link + [×]
   - Auto-dismiss 8s

4. Info toast (blue left border):
   - ℹ️ blue icon
   - "Task assigned" bold 14px
   - "Smart Router assigned Task #149 to Atlas" 13px gray
   - [×] auto-dismiss 4s

Stacking: Multiple toasts stack vertically with 8px gap, newest on top. Max 3 visible, older ones fade out.

Mobile variant: full-width, appears from bottom, swipe to dismiss.

Also show a progress toast for long operations:
   - 🔄 spinner icon
   - "Installing plugin..." bold
   - Progress bar underneath (thin, blue, animated)
   - No close button until complete
```

---

## 6. 组件库

### Figma Make Prompt — Component Library

```
Create a component library page for BuildCrew with dark + light mode variants.

12 component categories:

1. Agent Avatar (4 sizes: XS 32/SM 48/MD 160x200/LG 240x300):
   - Circular with department-color status ring
   - Status dot: green (active), gray (idle), amber (warning), red (error)

2. Stat Card:
   - Icon + large number + label + trend indicator
   - Variants: default, success (green), warning (amber), danger (red)
   - With/without sparkline

3. Alert Card:
   - Left color border (severity)
   - Icon + title + description + timestamp + action buttons
   - Variants: info (blue), warning (amber), critical (red), success (green)

4. Task Card (Kanban):
   - Title + agent avatar + priority dot + goal breadcrumb + time + cost
   - States: backlog, in-progress, in-review, done

5. Budget Bar:
   - Thin horizontal fill bar + "$X / $Y (Z%)" label
   - Color transitions: green → amber → red

6. Approval Card (Mobile):
   - Agent header + request + risk badge + approve/reject buttons (large touch targets)

7. Navigation:
   - Desktop top nav with tabs
   - Desktop sidebar (collapsed + expanded)
   - Mobile bottom tab bar
   - Breadcrumb trail

8. Data Table:
   - Sortable columns + row hover + expandable rows + pagination

9. Charts:
   - Line (spend over time), Donut (distribution), Radar (performance), Horizontal bar (workload), Sparkline (inline trend)

10. Badges/Tags:
    - Department: Engineering/Design/Marketing/QA/DevOps (color-coded)
    - Status: Active/Idle/Paused/Error
    - Priority: Low/Medium/High/Critical
    - Runtime: Claude Opus/Sonnet/Haiku/Cursor/Codex/Bash
    - Plugin: Official/Community/Verified

11. Empty States:
    - "No agents hired" — illustration + "Hire your first agent" CTA
    - "No alerts" — shield check illustration
    - "Knowledge Hub empty" — book + "Auto-populates as agents work"
    - "No plugins installed" — puzzle piece + "Browse marketplace"

12. Modals/Dialogs:
    - "Hire New Agent" form dialog
    - "Confirm Dangerous Action" dialog
    - "Review Details" slide-over
    - "Install Plugin" confirmation

All components: dark + light mode, default/hover/active/disabled states, 8px grid, WCAG AA contrast.
```

---

## 7. App Store 截图

### 7.1 Mac App Store (2560x1600, 5 张)

```
Design 5 Mac App Store screenshots (2560x1600) for BuildCrew.

All screenshots: dark gradient background (#0A0A2E → #0A0A0F), BuildCrew logo watermark top-left, consistent visual language.

Screenshot 1 — Hero:
Center: Dashboard Overview page screenshot, slightly angled with subtle shadow/reflection
Top text (large bold white): "One Dashboard for All Your AI Agents"
Bottom text (gray): "Organize Claude Code, Cursor, Codex & more into a company"

Screenshot 2 — Digital Human Team:
Center: 8 Agent Cards grid view with animated digital humans
Top text: "Meet Your AI Crew"
Bottom text: "Each agent has a role, a boss, and a budget"

Screenshot 3 — Budget Control:
Center: Budget dashboard with charts and cost table
Top text: "Never Overspend Again"
Bottom text: "Real-time cost tracking with automatic limits"

Screenshot 4 — Guardian:
Center: Guardian alerts page with amber/blue alert cards
Top text: "AI Safety Built In"
Bottom text: "24/7 monitoring catches dangerous actions before they happen"

Screenshot 5 — Mobile:
Center: iPhone mockup showing mobile approval screen
Top text: "Manage From Your Phone"
Bottom text: "Approve, reject, and monitor from anywhere"

Style: Apple-standard format. Text readable at thumbnail size. Consistent across all 5.
```

### 7.2 iOS App Store (1290x2796, 5 张)

```
Design 5 iOS App Store screenshots (1290x2796, iPhone 16 Pro Max) for BuildCrew mobile.

All: dark background, iPhone 16 Pro device frame, large top text + smaller subtitle.

Screenshot 1: Mobile home with "Needs Your Attention" feed
"Your AI Company in Your Pocket" / "Monitor and manage all agents on the go"

Screenshot 2: Approval detail screen
"One-Tap Approvals" / "Review critical decisions instantly"

Screenshot 3: Daily report screen
"Morning Briefing" / "Know what your AI team accomplished — listen or read"

Screenshot 4: Guardian alerts mobile
"Stay Safe" / "Immediate notifications when something needs attention"

Screenshot 5: Agent cards list mobile
"Your AI Crew at a Glance" / "Track every agent's status, score, and budget"
```

---

## 8. Landing Page（官网）

```
Design a full landing page for buildcrew.dev in dark mode.

Section 1 — Hero (full viewport):
Nav: "BuildCrew" logo left, [Features, Pricing, Docs, Blog] center, [Sign In] [Download Free ↓] right
Headline (large bold white): "Build Your AI Crew. Run Your AI Company."
Subheadline (gray): "Orchestrate Claude Code, Cursor, Codex, and any AI agent with org charts, budgets, and governance. Free and open source."
CTAs: [Download Free — macOS / Windows / Linux] blue primary + [View on GitHub →] outline
Below CTAs: "MIT Licensed · No account required · Self-hosted" small gray
Hero image: Dashboard screenshot with glow effect, floating above dark gradient

Section 2 — Logo bar:
"Works with" + logos: Claude Code, Cursor, Codex, OpenClaw, Bash, "any HTTP agent" — grayscale

Section 3 — Problem/Solution:
Left (problem): "You already have the workers."
❌ "Agents in separate terminals, no communication"
❌ "No cost visibility until the bill arrives"
❌ "Restart your computer, lose everything"
Right (solution): "Give them a company to work in."
✅ "One dashboard, one org chart, one source of truth"
✅ "Real-time budget tracking with automatic limits"
✅ "Persistent state survives reboots and crashes"

Section 4 — Meet the Crew:
Show 4 digital human avatars (Atlas, Nova, Sentinel, Echo) in a row with their name/role/score
"Your AI team, visualized. Each agent has a face, a role, and a track record."

Section 5 — Features grid (3x2):
🏢 Org Charts | 🎯 Goal Alignment | 💰 Budget Control
🛡️ Guardian | 🧠 Knowledge Hub | 🧩 Plugin System

Section 6 — "5 Minutes to Your First AI Company":
Terminal → `npx buildcrew onboard --yes` → Dashboard with first agent
Copy button on code block

Section 7 — Plugin Ecosystem:
"Extend with plugins. Keep your core."
Show 4 plugin cards (Jira, Slack, Notion, Custom) + "Build your own →"
"Your integrations, your workflow. Our engine, our intelligence."

Section 8 — Pricing:
Free $0 — 5 agents, 3 plugins, community support
Pro $29/mo — Unlimited agents+plugins, Smart Router, Guardian, mobile
Team $99/mo — Evolution Engine, SSO, multi-user, audit logs

Section 9 — Social proof:
GitHub stars counter + "Used by developers at" logos + 2-3 quote cards

Section 10 — CTA:
"Ready to build your AI crew?"
[Download Free] [Read the Docs]

Footer: Logo + tagline, Product/Resources/Company/Legal links, GitHub/X/Discord, "© 2026 BuildCrew · MIT Licensed"

Style: Premium SaaS. Linear.app / Vercel aesthetic. Subtle gradients, glassmorphism on cards, smooth scroll animations. Dark throughout with blue accents. The digital human characters in Section 4 are the unique visual differentiator.
```

---

## 9. Figma 文件结构与交付 Checklist

### Figma 文件组织

```
BuildCrew Design System
├── 📄 Cover (logo + version + date)
├── 📁 1. Design System
│   └── Tokens / Colors / Typography / Icons / Logo variants
├── 📁 2. Digital Humans
│   ├── Character Sheet (8 characters)
│   ├── Animation States (5 states reference)
│   └── Size Variants (XS/SM/MD/LG)
├── 📁 3. Components
│   └── All 12+ component categories (dark + light)
├── 📁 4. Desktop (10 pages)
│   ├── Overview
│   ├── Agents (grid of agent cards)
│   ├── Tasks (Kanban)
│   ├── Budget
│   ├── Guardian
│   ├── Knowledge Hub
│   ├── Smart Router
│   ├── Evolution
│   ├── Plugins
│   └── Group Dashboard (multi-company)
├── 📁 5. User & Navigation
│   ├── Top Bar (normal + active states)
│   ├── User Dropdown Menu (Pro / Free variants)
│   ├── Command Palette (empty + search results)
│   ├── Notification Panel (with unread items)
│   ├── Settings Page (Profile / API Keys / Subscription / Appearance)
│   └── Login / Sign Up / Onboarding (4 screens)
├── 📁 6. Mobile (4 pages + user menu)
│   ├── Home
│   ├── Approval Detail
│   ├── Daily Report
│   ├── Agent List
│   └── User Menu (More tab)
├── 📁 7. App Store Screenshots
│   ├── macOS (5 × 2560x1600)
│   └── iOS (5 × 1290x2796)
└── 📁 8. Landing Page
    └── Full page (buildcrew.dev)
```

### 设计交付 Checklist

```
□ 所有页面 Dark Mode 完成
□ 关键页面 Light Mode（Overview / Agents / Tasks / Budget / Settings）
□ 8 个数字人角色形象完成（5 种状态 × 4 种尺寸）
□ 组件库命名规范（BuildCrew/Component/Variant 格式）
□ 响应式断点标注（Desktop 1440px / Tablet 768px / Mobile 393px）
□ 交互原型连线（页面跳转、Tab 切换、Modal、卡片展开、下拉菜单）
□ 顶栏完整设计（Logo + 公司切换 + 导航 + 搜索 + 通知 + 用户头像）
□ 用户下拉菜单（Pro 版 + Free 版两种状态）
□ 命令面板 ⌘K（空状态 + 搜索结果状态）
□ 通知面板（未读/已读 + 快捷操作 + 筛选 Tab）
□ 设置页面完成（Profile / API Keys / Subscription / Appearance 四个 Tab）
□ 登录/注册/Onboarding 流程（4 个页面）
□ 移动端用户菜单（More tab 展开）
□ Plugin 页面完成（安装/配置/市场浏览）
□ 集团仪表盘完成（多公司切换）
□ App Store 截图导出 PNG
□ Landing Page 切片标注
□ 开发交付标注（间距/字号/色值/动效参数）
□ 品牌资产导出（Logo SVG + PNG 全尺寸）
```

---

*BuildCrew Figma 设计文件 — v1.2 (完整版：补全所有缺失页面与交互状态)*
