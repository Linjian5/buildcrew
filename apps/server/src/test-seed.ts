/**
 * Seeds a test database with a known state for E2E tests.
 * Usage: npx tsx apps/server/src/test-seed.ts
 *
 * Creates:
 *  - 1 test user (test@buildcrew.dev / TestPass123)
 *  - 1 company "TestCorp" in post-execution state (has agents, goals, tasks)
 *  - Chat thread with executed plan (Bug #22 regression data)
 */

import bcrypt from 'bcryptjs';
import {
  db, sql, users, companies, agents, goals, tasks, projects,
  chatThreads, chatMessages, userWallets, walletTransactions,
  usageRecords, conversations, reviews, taskScores, routingDecisions,
  guardianAlerts, guardianPolicies, approvals, knowledgeEntries,
  agentProfiles, agentLoans, experiments, experimentAssignments,
  configs, subscriptions, apiKeys, modelApiKeys, groups,
} from '@buildcrew/db';

async function seed() {
  console.log('Cleaning test data...');
  // Reverse topological order: delete leaf tables first, then parents
  // --- Tables referencing tasks, agents, companies ---
  await db.delete(chatMessages).where(sql`1=1`);
  await db.delete(chatThreads).where(sql`1=1`);
  await db.delete(conversations).where(sql`1=1`);
  await db.delete(reviews).where(sql`1=1`);
  await db.delete(taskScores).where(sql`1=1`);
  await db.delete(routingDecisions).where(sql`1=1`);
  await db.delete(usageRecords).where(sql`1=1`);
  await db.delete(knowledgeEntries).where(sql`1=1`);
  await db.delete(guardianAlerts).where(sql`1=1`);
  await db.delete(guardianPolicies).where(sql`1=1`);
  await db.delete(approvals).where(sql`1=1`);
  await db.delete(experimentAssignments).where(sql`1=1`);
  await db.delete(experiments).where(sql`1=1`);
  await db.delete(agentLoans).where(sql`1=1`);
  await db.delete(agentProfiles).where(sql`1=1`);
  await db.delete(configs).where(sql`1=1`);
  // --- Core tables ---
  await db.delete(tasks).where(sql`1=1`);
  await db.delete(projects).where(sql`1=1`);
  await db.delete(goals).where(sql`1=1`);
  await db.delete(agents).where(sql`1=1`);
  await db.delete(walletTransactions).where(sql`1=1`);
  await db.delete(userWallets).where(sql`1=1`);
  await db.delete(subscriptions).where(sql`1=1`);
  await db.delete(apiKeys).where(sql`1=1`);
  await db.delete(modelApiKeys).where(sql`1=1`);
  await db.delete(companies).where(sql`1=1`);
  await db.delete(groups).where(sql`1=1`);
  await db.delete(users).where(sql`1=1`);

  console.log('Seeding test data...');

  // 1. Test user
  const passwordHash = await bcrypt.hash('TestPass123', 10);
  const [user] = await db.insert(users).values({
    name: 'Test User',
    email: 'test@buildcrew.dev',
    passwordHash,
  }).returning();

  // 2. Wallet with $10 balance
  await db.insert(userWallets).values({
    userId: user!.id,
    balance: '10.00',
  });

  // 3. Company in post-execution state (for regression tests)
  const [company] = await db.insert(companies).values({
    name: 'TestCorp',
    mission: 'Build the best AI platform',
    industry: 'SaaS',
    userId: user!.id,
    budgetMonthly: '5000',
  }).returning();

  // 4. CEO agent (Aria) — department must be 'executive' (Bug #4 regression)
  const [ceo] = await db.insert(agents).values({
    companyId: company!.id,
    name: 'Aria',
    title: 'CEO',
    department: 'executive',
    status: 'working',
    runtimeConfig: { provider: 'deepseek', model: 'deepseek-chat' },
  }).returning();

  // 5. More agents (hired via confirm-plan)
  const agentData = [
    { name: 'Atlas', title: 'CTO', department: 'engineering' },
    { name: 'Pixel', title: 'UI/UX Designer', department: 'design' },
    { name: 'Echo', title: 'QA Engineer', department: 'engineering' },
    { name: 'Scout', title: 'Marketing Lead', department: 'marketing' },
  ];
  const hiredAgents = [];
  for (const a of agentData) {
    const [ag] = await db.insert(agents).values({
      companyId: company!.id,
      ...a,
      status: 'working',
      reportsTo: ceo!.id,
      runtimeConfig: { provider: 'deepseek', model: 'deepseek-chat' },
    }).returning();
    hiredAgents.push(ag!);
  }

  // 6. Goals (Bug #18 regression: task counts must be correct)
  const [goal1] = await db.insert(goals).values({
    companyId: company!.id,
    title: 'Launch Product Development',
    description: 'Build and ship MVP',
    status: 'active',
  }).returning();

  const [goal2] = await db.insert(goals).values({
    companyId: company!.id,
    title: 'Establish Market Presence',
    description: 'Brand awareness',
    status: 'active',
  }).returning();

  // 7. Tasks assigned to agents
  const taskData = [
    { title: 'Design system architecture', goalId: goal1!.id, assignedAgentId: hiredAgents[0]!.id, priority: 'high' as const, status: 'in_progress' },
    { title: 'Build core API', goalId: goal1!.id, assignedAgentId: hiredAgents[0]!.id, priority: 'high' as const, status: 'in_progress' },
    { title: 'Create frontend UI', goalId: goal1!.id, assignedAgentId: hiredAgents[1]!.id, priority: 'high' as const, status: 'pending' },
    { title: 'Write tests', goalId: goal1!.id, assignedAgentId: hiredAgents[2]!.id, priority: 'medium' as const, status: 'pending' },
    { title: 'Deploy to staging', goalId: goal1!.id, assignedAgentId: hiredAgents[0]!.id, priority: 'medium' as const, status: 'pending' },
    { title: 'Create landing page', goalId: goal2!.id, assignedAgentId: hiredAgents[1]!.id, priority: 'high' as const, status: 'pending' },
    { title: 'Setup social media', goalId: goal2!.id, assignedAgentId: hiredAgents[3]!.id, priority: 'medium' as const, status: 'pending' },
  ];
  for (const t of taskData) {
    await db.insert(tasks).values({
      companyId: company!.id,
      ...t,
    });
  }

  // 8. Chat thread with executed plan (Bug #22 regression)
  const [thread] = await db.insert(chatThreads).values({
    companyId: company!.id,
    agentId: ceo!.id,
    userId: user!.id,
    threadType: 'goal_planning',
    status: 'active',
    workflowState: 'completed',
  }).returning();

  // Messages including an executed plan message
  await db.insert(chatMessages).values({
    threadId: thread!.id,
    senderType: 'agent',
    senderAgentId: ceo!.id,
    content: 'Welcome! What would you like to build?',
    messageType: 'text',
  });
  await db.insert(chatMessages).values({
    threadId: thread!.id,
    senderType: 'user',
    content: 'I want to build an AI platform',
    messageType: 'text',
  });
  await db.insert(chatMessages).values({
    threadId: thread!.id,
    senderType: 'agent',
    senderAgentId: ceo!.id,
    content: 'Here is your execution plan summary. Team is ready with Atlas (CTO), Pixel (Designer), Echo (QA), and Scout (Marketing).',
    messageType: 'plan',
    metadata: { action_type: 'executed' }, // Already executed — button must NOT appear
  });
  await db.insert(chatMessages).values({
    threadId: thread!.id,
    senderType: 'agent',
    senderAgentId: ceo!.id,
    content: 'Tasks assigned and the team is starting work. 7 tasks across 2 goals. I\'ll keep you posted on progress.',
    messageType: 'text',
  });

  console.log('Test seed complete');
  console.log(`   User: test@buildcrew.dev / TestPass123`);
  console.log(`   Company: ${company!.name} (${company!.id})`);
  console.log(`   Agents: ${1 + hiredAgents.length}, Goals: 2, Tasks: ${taskData.length}`);
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
