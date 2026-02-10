export interface favouriteProblem {
  id: string;
  externalProblemId: string;
  platform: string;
  createdAt: Date;
}

export interface SubmissionRequest {
  externalSubmissionId: string;
  problemId: string;
  platform: string;
  submissionTime: number;
  verdict: string;
  executionTime?: number;
  memoryUsed?: number;
  programmingLanguage: string;
}
