export interface quizQuestionSafe {
  id: number;
  questionTitle: string;
  answer: string;
  score: number;
  createdAt: Date;
}

export interface quizQuestionList {
  questionTitle: string;
  createdAt: Date;
}
