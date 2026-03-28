export const AgentStatus = {
  IDLE: 'idle',
  WORKING: 'working',
  PAUSED: 'paused',
  ERROR: 'error',
  WARNING: 'warning',
} as const;
export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];

export const TaskStatus = {
  BACKLOG: 'backlog',
  IN_PROGRESS: 'in_progress',
  IN_REVIEW: 'in_review',
  DONE: 'done',
  BLOCKED: 'blocked',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const Department = {
  EXECUTIVE: 'executive',
  ENGINEERING: 'engineering',
  DESIGN: 'design',
  QA: 'qa',
  PRODUCT: 'product',
  MARKETING: 'marketing',
  OPERATIONS: 'operations',
} as const;
export type Department = (typeof Department)[keyof typeof Department];

export const AgentLevel = {
  EXECUTIVE: 'executive',
  SENIOR: 'senior',
  MID: 'mid',
  JUNIOR: 'junior',
} as const;
export type AgentLevel = (typeof AgentLevel)[keyof typeof AgentLevel];

export const GoalStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  PAUSED: 'paused',
} as const;
export type GoalStatus = (typeof GoalStatus)[keyof typeof GoalStatus];

export const ProjectStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const ConversationRole = {
  AGENT: 'agent',
  SYSTEM: 'system',
  USER: 'user',
} as const;
export type ConversationRole = (typeof ConversationRole)[keyof typeof ConversationRole];
