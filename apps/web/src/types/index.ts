/**
 * Re-export shared types from @buildcrew/shared.
 * Frontend-specific types that don't exist in shared are defined here.
 */

// Re-export all types and constants from shared
export {
  type Agent,
  type AgentRuntime,
  type AgentPerformance,
  type Task,
  type TaskScore,
  type Company,
  type WsMessage,
  type ApiResponse,
  type ApiError,
  type PaginatedResponse,
  AgentStatus,
  TaskStatus,
  TaskPriority,
  Department,
  AgentLevel,
  WsEvent,
} from '@buildcrew/shared';

// Frontend aliases for backward compat
export type AgentDepartment = import('@buildcrew/shared').Department;
export type WsEventType = import('@buildcrew/shared').WsEvent;
