export type AlertLevel = 'critical' | 'warning' | 'info';

export interface GuardianAlert {
  id: string;
  level: AlertLevel;
  title: string;
  description: string;
  evidence?: string;
  agentName?: string;
  timestamp: string;
}

export interface GuardianActivity {
  id: string;
  type: 'blocked' | 'passed' | 'warning';
  message: string;
  timestamp: string;
}

export interface GuardianPolicy {
  id: string;
  category: string;
  name: string;
  enabled: boolean;
  rules: number;
}

