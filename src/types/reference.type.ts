export interface SolutionSnippet {
  id: string;
  userId: string;
  topicId: number | null;
  title: string;
  language: string;
  code: string;
  notes: string | null;
  tags: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  topic: { id: number; title: string } | null;
}
