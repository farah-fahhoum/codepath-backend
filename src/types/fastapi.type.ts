export interface FastApiTopicInput {
  id?: number | null;
  title: string;
}

export interface FastApiPerformanceItem {
  topic: string;
  attempts?: number;
  solved?: number;
  total?: number | null;
  accuracy?: number | null;
}

export interface FastApiCodeforcesStats {
  rating?: number;
  tier?: string | null;
  problemsSolved?: number;
  accuracy?: number | null;
  topicBreakdown?: FastApiPerformanceItem[];
}

export interface FastApiSkillAssessmentInput {
  assessmentType?: string | null;
  score?: number;
  skillLevelId?: number | null;
}

export interface PracticeProblem {
  name: string;
  contestId: number;
  index: string;
  rating: number;
  tags: string[];
  link: string;
}

export interface RoadmapGenerateRequest {
  userId: string;
  topics: FastApiTopicInput[];
  skillAssessments?: FastApiSkillAssessmentInput[];
  quizPerformance?: FastApiPerformanceItem[];
  codeforcesStats?: FastApiCodeforcesStats | null;
}

export interface RoadmapModule {
  order: number;
  topicId: number | null;
  topicTitle: string;
  learningObjective: string;
  estimatedHours: number;
  suggestedDifficultyRange: { min: number; max: number };
  practiceProblems: PracticeProblem[];
}

export interface RoadmapGenerateResponse {
  modules: RoadmapModule[];
}

export interface ContestProblemOut {
  name: string;
  contestId: number;
  index: string;
  rating: number;
  tags: string[];
  link: string;
  difficultyTier: string;
}

export interface ContestSelectionRequest {
  userId: string;
  targetSkillTier: string;
  topics: FastApiTopicInput[];
  quizPerformance?: FastApiPerformanceItem[];
  codeforcesStats?: FastApiCodeforcesStats | null;
  totalProblems?: number;
}

export interface ContestProblemCriteria {
  topicId: number | null;
  topicTitle: string;
  suggestedDifficulty: number;
  count: number;
}

export interface ContestSelectionResponse {
  criteria: ContestProblemCriteria[];
  totalProblems: number;
  problems: ContestProblemOut[];
  contestTiming: {
    startTime: string;
    endTime: string;
    durationMinutes: string;
  } | null;
}

export interface ReferenceSnippetInput {
  id: string;
  title: string;
  topicId?: number | null;
  topicTitle?: string | null;
  language?: string | null;
  notesPreview?: string | null;
}

export interface ReferenceCurateRequest {
  userId: string;
  snippets: ReferenceSnippetInput[];
  quizPerformance?: FastApiPerformanceItem[];
  codeforcesStats?: FastApiCodeforcesStats | null;
}

export interface ReferenceSection {
  topicId: number | null;
  topicTitle: string;
  intro: string;
  snippetIds: string[];
}

export interface ReferenceCurateResponse {
  sections: ReferenceSection[];
}
