/**
 * Agent role templates for batch hiring during onboarding.
 * These match the names Aria recommends in her onboarding conversation.
 */

export interface RoleTemplate {
  name: string;
  title: string;
  department: string;
  level: string;
  budgetPct: number; // percentage of company monthly budget
}

export const ROLE_TEMPLATES: Record<string, RoleTemplate> = {
  atlas:    { name: 'Atlas',    title: 'CTO',              department: 'engineering',  level: 'executive', budgetPct: 0.15 },
  nova:     { name: 'Nova',     title: 'Lead Engineer',    department: 'engineering',  level: 'senior',    budgetPct: 0.12 },
  echo:     { name: 'Echo',     title: 'Backend Engineer', department: 'engineering',  level: 'mid',       budgetPct: 0.10 },
  sentinel: { name: 'Sentinel', title: 'QA Engineer',      department: 'qa',           level: 'mid',       budgetPct: 0.08 },
  vector:   { name: 'Vector',   title: 'DevOps Engineer',  department: 'operations',   level: 'mid',       budgetPct: 0.08 },
  pixel:    { name: 'Pixel',    title: 'Designer',         department: 'design',       level: 'mid',       budgetPct: 0.08 },
  sage:     { name: 'Sage',     title: 'Content Writer',   department: 'content',      level: 'mid',       budgetPct: 0.06 },
  scout:    { name: 'Scout',    title: 'Marketing Specialist', department: 'marketing', level: 'mid',      budgetPct: 0.06 },
  cipher:   { name: 'Cipher',   title: 'Data Engineer',    department: 'engineering',  level: 'senior',    budgetPct: 0.10 },
};

/**
 * Resolve role keys from various formats:
 * - exact key: "atlas"
 * - name: "Atlas"
 * - title partial: "CTO", "Backend Engineer"
 */
export function resolveRoleKey(input: string): string | null {
  const lower = input.toLowerCase().trim();
  // Direct key match
  if (ROLE_TEMPLATES[lower]) return lower;
  // Name match
  for (const [key, tpl] of Object.entries(ROLE_TEMPLATES)) {
    if (tpl.name.toLowerCase() === lower) return key;
  }
  // Title partial match
  for (const [key, tpl] of Object.entries(ROLE_TEMPLATES)) {
    if (tpl.title.toLowerCase().includes(lower) || lower.includes(tpl.title.toLowerCase())) return key;
  }
  return null;
}
