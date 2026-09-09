import { prisma } from "../lib/prisma";
import {
  QuizOptionInput,
  QuizQuestionForMentee,
  QuizQuestionList,
  QuizQuestionSafe,
} from "../types/quiz.type";

const optionSelectForMentee = {
  id: true,
  optionText: true,
  orderIndex: true,
};

const optionSelectForAdmin = {
  ...optionSelectForMentee,
  isCorrect: true,
};

function sortOptions<T extends { orderIndex: number }>(options: T[]): T[] {
  return [...options].sort((a, b) => a.orderIndex - b.orderIndex);
}

export const getQuizQuestionsFromDB = async (): Promise<QuizQuestionList[]> => {
  const questionsRecords = await prisma.quizQuestion.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, questionTitle: true, createdAt: true },
  });
  return questionsRecords;
};

export const getQuizQuestionByIdFromDB = async (
  id: number,
): Promise<QuizQuestionSafe | null> => {
  const question = await prisma.quizQuestion.findUnique({
    where: { id },
    select: {
      id: true,
      questionTitle: true,
      score: true,
      createdAt: true,
      options: {
        select: optionSelectForAdmin,
      },
    },
  });
  if (!question) return null;
  return {
    ...question,
    options: sortOptions(question.options),
  };
};

export const addQuizQuestionToDB = async (
  questionTitle: string,
  score: number,
  options: QuizOptionInput[],
) => {
  await prisma.quizQuestion.create({
    data: {
      questionTitle,
      score,
      options: {
        create: options.map((option) => ({
          optionText: option.optionText,
          orderIndex: option.orderIndex,
          isCorrect: option.isCorrect,
        })),
      },
    },
  });
};

export const updateQuizQuestionInDB = async (
  id: number,
  data: {
    questionTitle?: string;
    score?: number;
    options?: QuizOptionInput[];
  },
) => {
  const { questionTitle, score, options } = data;

  await prisma.$transaction(async (tx) => {
    await tx.quizQuestion.update({
      where: { id },
      data: {
        ...(questionTitle !== undefined ? { questionTitle } : {}),
        ...(score !== undefined ? { score } : {}),
      },
    });

    if (options) {
      await tx.quizOption.deleteMany({ where: { questionId: id } });
      await tx.quizOption.createMany({
        data: options.map((option) => ({
          questionId: id,
          optionText: option.optionText,
          orderIndex: option.orderIndex,
          isCorrect: option.isCorrect,
        })),
      });
    }
  });
};

export const deleteQuizQuestionFromDB = async (id: number): Promise<number> => {
  const recordsAffected = await prisma.quizQuestion.delete({ where: { id } });
  if (recordsAffected) return 1;
  return 0;
};

const mapQuestionForMentee = (
  question: {
    id: number;
    questionTitle: string;
    score: number;
    options: Array<{ id: number; optionText: string; orderIndex: number }>;
  },
): QuizQuestionForMentee => ({
  id: question.id,
  questionTitle: question.questionTitle,
  score: question.score,
  options: sortOptions(question.options),
});

export const getRandomQuizQuestionsFromDBForMentee = async (
  count: number,
): Promise<QuizQuestionForMentee[]> => {
  const all = await prisma.quizQuestion.findMany({
    select: {
      id: true,
      questionTitle: true,
      score: true,
      options: { select: optionSelectForMentee },
    },
  });
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const n = Math.max(0, Math.min(count, all.length));
  return all.slice(0, n).map(mapQuestionForMentee);
};

export const getAllQuizQuestionsForMentee = async (): Promise<
  QuizQuestionForMentee[]
> => {
  const all = await prisma.quizQuestion.findMany({
    select: {
      id: true,
      questionTitle: true,
      score: true,
      options: { select: optionSelectForMentee },
    },
  });
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.map(mapQuestionForMentee);
};

export const getMenteeQuizResult = async (userId: string): Promise<string> => {
  const result = await prisma.userSkillAssessment.findFirst({
    where: {
      userId,
      assessmentType: "Quiz",
    },
    include: { skillLevel: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });

  if (!result || !result.skillLevel) {
    return "Not Assessed";
  }

  return result.skillLevel.title;
};
