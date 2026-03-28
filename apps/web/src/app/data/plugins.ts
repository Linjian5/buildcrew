export interface Plugin {
  id: string;
  name: string;
  author: string;
  description: string;
  status: 'active' | 'inactive';
  icon: string;
  version: string;
  isOfficial: boolean;
  lastActivity?: string;
  activityCount?: number;
}

