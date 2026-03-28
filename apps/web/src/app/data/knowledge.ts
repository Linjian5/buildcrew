export type KnowledgeType = 'pattern' | 'api-quirk' | 'config' | 'past-failure' | 'adr';

export interface KnowledgeEntry {
  id: string;
  type: KnowledgeType;
  title: string;
  preview: string;
  source: string;
  tags: string[];
  confidence: number;
  cited: number;
}

