export interface QuizOptionSafe {
  id: number;
  optionText: string;
  orderIndex: number;
  isCorrect: boolean;
}

export interface QuizOptionForMentee {
  id: number;
  optionText: string;
  orderIndex: number;
}

export interface QuizQuestionSafe {
  id: number;
  questionTitle: string;
  score: number;
  createdAt: Date;
  options: QuizOptionSafe[];
}

export interface QuizQuestionList {
  id: number;
  questionTitle: string;
  createdAt: Date;
}

export interface QuizQuestionForMentee {
  id: number;
  questionTitle: string;
  score: number;
  options: QuizOptionForMentee[];
}

export interface QuizOptionInput {
  optionText: string;
  orderIndex: number;
  isCorrect: boolean;
}
