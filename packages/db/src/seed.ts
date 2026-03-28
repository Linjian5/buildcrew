import bcrypt from 'bcryptjs';
import { db } from './client';
import { users, companies, agents, tasks, goals } from './schema/index';
import { sql } from 'drizzle-orm';

const DEMO_PASSWORD = 'Demo123456';

interface DemoUser {
  email: string;
  name: string;
  company: {
    name: string;
    mission: string;
    industry: string;
    budgetMonthly: string;
  };
  agents: Array<{
    name: string;
    title: string;
    department: string;
    level: string;
    budgetMonthly: string;
    reportsTo?: string; // name of agent to report to (resolved after insert)
  }>;
  tasks: Array<{
    title: string;
    description: string;
    priority: string;
    status: string;
  }>;
  goals: Array<{ title: string; description: string }>;
}

const DEMO_DATA: DemoUser[] = [
  {
    email: 'demo1@buildcrew.dev',
    name: 'Alice Chen',
    company: {
      name: 'Acme AI Corp',
      mission: 'Build an AI note-taking app to $1M MRR',
      industry: 'saas',
      budgetMonthly: '500.00',
    },
    agents: [
      { name: 'Aria', title: 'CEO', department: 'executive', level: 'executive', budgetMonthly: '100.00' },
      { name: 'Atlas', title: 'CTO', department: 'engineering', level: 'executive', budgetMonthly: '80.00', reportsTo: 'Aria' },
      { name: 'Nova', title: 'Lead Engineer', department: 'engineering', level: 'senior', budgetMonthly: '60.00', reportsTo: 'Atlas' },
      { name: 'Echo', title: 'QA Engineer', department: 'qa', level: 'mid', budgetMonthly: '40.00', reportsTo: 'Atlas' },
      { name: 'Pixel', title: 'UI Designer', department: 'design', level: 'mid', budgetMonthly: '45.00', reportsTo: 'Aria' },
    ],
    tasks: [
      { title: 'Implement JWT authentication', description: 'Add login/register with JWT tokens', priority: 'high', status: 'done' },
      { title: 'Build note editor component', description: 'Rich text editor with markdown support', priority: 'high', status: 'in_progress' },
      { title: 'Design landing page', description: 'Hero section, features, pricing', priority: 'medium', status: 'in_progress' },
      { title: 'Set up CI/CD pipeline', description: 'GitHub Actions for test + deploy', priority: 'medium', status: 'done' },
      { title: 'Implement search functionality', description: 'Full-text search across notes', priority: 'high', status: 'backlog' },
      { title: 'Add collaboration features', description: 'Real-time co-editing with WebSocket', priority: 'critical', status: 'backlog' },
    ],
    goals: [
      { title: 'Launch MVP', description: 'Ship the first version to early adopters' },
      { title: 'Reach 1000 users', description: 'Grow user base through Product Hunt launch' },
    ],
  },
  {
    email: 'demo2@buildcrew.dev',
    name: 'Bob Zhang',
    company: {
      name: 'Cross-Border E-Commerce',
      mission: 'Build a Shopify alternative for cross-border sellers',
      industry: 'ecommerce',
      budgetMonthly: '800.00',
    },
    agents: [
      { name: 'Sage', title: 'CEO', department: 'executive', level: 'executive', budgetMonthly: '120.00' },
      { name: 'Forge', title: 'Backend Lead', department: 'engineering', level: 'senior', budgetMonthly: '90.00', reportsTo: 'Sage' },
      { name: 'Flux', title: 'DevOps Engineer', department: 'operations', level: 'mid', budgetMonthly: '60.00', reportsTo: 'Forge' },
      { name: 'Cipher', title: 'Data Engineer', department: 'engineering', level: 'senior', budgetMonthly: '70.00', reportsTo: 'Forge' },
    ],
    tasks: [
      { title: 'Product catalog API', description: 'CRUD for products with variants and pricing', priority: 'critical', status: 'in_progress' },
      { title: 'Payment gateway integration', description: 'Stripe + PayPal + local methods', priority: 'high', status: 'backlog' },
      { title: 'Inventory sync service', description: 'Real-time stock sync across warehouses', priority: 'high', status: 'backlog' },
      { title: 'Order management system', description: 'Order lifecycle: placed→paid→shipped→delivered', priority: 'critical', status: 'in_review' },
    ],
    goals: [
      { title: 'Beta Launch Q2', description: 'Launch beta to 50 pilot sellers' },
    ],
  },
  {
    email: 'demo3@buildcrew.dev',
    name: 'Carol Wu',
    company: {
      name: 'Content Agency',
      mission: 'AI-powered content creation at scale',
      industry: 'media',
      budgetMonthly: '300.00',
    },
    agents: [
      { name: 'Muse', title: 'Creative Director', department: 'executive', level: 'executive', budgetMonthly: '80.00' },
      { name: 'Quill', title: 'Content Writer', department: 'content', level: 'mid', budgetMonthly: '50.00', reportsTo: 'Muse' },
      { name: 'Lens', title: 'Visual Designer', department: 'design', level: 'mid', budgetMonthly: '50.00', reportsTo: 'Muse' },
    ],
    tasks: [
      { title: 'Blog post generator', description: 'Generate SEO-optimized blog posts from keywords', priority: 'high', status: 'done' },
      { title: 'Social media scheduler', description: 'Auto-post to Twitter, LinkedIn, Instagram', priority: 'medium', status: 'in_progress' },
      { title: 'Content analytics dashboard', description: 'Track views, engagement, conversions', priority: 'medium', status: 'backlog' },
    ],
    goals: [
      { title: '100 articles/month', description: 'Scale content production to 100 articles per month' },
    ],
  },
  {
    email: 'demo4@buildcrew.dev',
    name: 'David Li',
    company: {
      name: 'Design Studio',
      mission: 'AI-assisted design system for startups',
      industry: 'design',
      budgetMonthly: '250.00',
    },
    agents: [
      { name: 'Prism', title: 'Design Lead', department: 'design', level: 'executive', budgetMonthly: '70.00' },
      { name: 'Shade', title: 'UI Engineer', department: 'engineering', level: 'senior', budgetMonthly: '60.00', reportsTo: 'Prism' },
    ],
    tasks: [
      { title: 'Component library v1', description: 'Build 30 core UI components with Figma tokens', priority: 'critical', status: 'in_progress' },
      { title: 'Theme generator', description: 'AI generates color palettes from brand keywords', priority: 'high', status: 'backlog' },
      { title: 'Figma plugin', description: 'Export design tokens directly from Figma', priority: 'medium', status: 'backlog' },
    ],
    goals: [
      { title: 'Ship component library', description: 'Publish v1.0 to npm' },
    ],
  },
];

async function seed() {
  console.log('Seeding database...');

  // Clear existing data
  await db.execute(sql`TRUNCATE TABLE usage_records, model_api_keys, api_keys, agent_loans, experiment_assignments, experiments, task_scores, knowledge_entries, groups, approvals, reviews, guardian_alerts, guardian_policies, routing_decisions, agent_profiles, conversations, configs, tasks, projects, goals, agents, companies, users CASCADE`);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const demo of DEMO_DATA) {
    // Create user
    const [user] = await db
      .insert(users)
      .values({ email: demo.email, name: demo.name, passwordHash })
      .returning();
    if (!user) throw new Error(`Failed to create user ${demo.email}`);
    console.log(`  User: ${user.email} (${user.id})`);

    // Create company linked to user
    const [company] = await db
      .insert(companies)
      .values({
        userId: user.id,
        name: demo.company.name,
        mission: demo.company.mission,
        industry: demo.company.industry,
        budgetMonthly: demo.company.budgetMonthly,
        currency: 'USD',
      })
      .returning();
    if (!company) throw new Error(`Failed to create company ${demo.company.name}`);
    console.log(`  Company: ${company.name} (${company.id})`);

    // Create agents (two passes: first without reportsTo, then set reportsTo)
    const agentMap = new Map<string, string>(); // name → id
    for (const a of demo.agents) {
      const [agent] = await db
        .insert(agents)
        .values({
          companyId: company.id,
          name: a.name,
          title: a.title,
          department: a.department,
          level: a.level,
          status: 'idle',
          runtimeConfig: { provider: 'anthropic', model: 'claude-sonnet-4' },
          budgetMonthly: a.budgetMonthly,
          budgetSpent: '0',
          heartbeatIntervalSec: 300,
          maxConcurrentTasks: 2,
        })
        .returning();
      if (!agent) throw new Error(`Failed to create agent ${a.name}`);
      agentMap.set(a.name, agent.id);
    }

    // Set reportsTo references
    for (const a of demo.agents) {
      if (a.reportsTo) {
        const agentId = agentMap.get(a.name);
        const managerId = agentMap.get(a.reportsTo);
        if (agentId && managerId) {
          await db.execute(sql`UPDATE agents SET reports_to = ${managerId} WHERE id = ${agentId}`);
        }
      }
    }
    console.log(`  Agents: ${demo.agents.map((a) => a.name).join(', ')}`);

    // Create goals
    for (const g of demo.goals) {
      await db.insert(goals).values({ companyId: company.id, title: g.title, description: g.description });
    }

    // Create tasks (assign to first non-CEO agent if in_progress)
    const workerAgentId = demo.agents.length > 1 ? agentMap.get(demo.agents[1]!.name) : agentMap.get(demo.agents[0]!.name);
    for (const t of demo.tasks) {
      await db.insert(tasks).values({
        companyId: company.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: t.status,
        assignedAgentId: t.status !== 'backlog' ? workerAgentId : null,
        startedAt: t.status !== 'backlog' ? new Date(Date.now() - 3600000) : null,
        completedAt: t.status === 'done' ? new Date() : null,
      });
    }
    console.log(`  Tasks: ${demo.tasks.length}, Goals: ${demo.goals.length}`);
  }

  console.log('\nSeed complete. 4 demo accounts created:');
  for (const d of DEMO_DATA) {
    console.log(`  ${d.email} / ${DEMO_PASSWORD} → ${d.company.name}`);
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
