import { prisma } from "../lib/prisma";
import {
  quizQuestionForMentee,
  quizQuestionList,
  quizQuestionSafe,
} from "../types/quiz.type";

export const getQuizQuestionsFromDB = async (): Promise<quizQuestionList[]> => {
  const questionsRecords = await prisma.quizQuestion.findMany({
    orderBy: { createdAt: "desc" },
    select: { questionTitle: true, createdAt: true },
  });
  return questionsRecords;
};

export const getQuizQuestionByIdFromDB = async (
  id: number
): Promise<quizQuestionSafe | null> => {
  const question = await prisma.quizQuestion.findUnique({
    where: { id },
    select: {
      id: true,
      questionTitle: true,
      answer: true,
      score: true,
      createdAt: true,
    },
  });
  return question ?? null;
};

export const addQuizQuestionToDB = async (
  questionTitle: string,
  answer: string,
  score: number
) => {
  await prisma.quizQuestion.create({
    data: { questionTitle, answer, score },
  });
};

export const updateQuizQuestionInDB = async (
  id: number,
  data: { questionTitle?: string; answer?: string; score?: number }
) => {
  await prisma.quizQuestion.update({
    where: { id },
    data,
  });
};

export const deleteQuizQuestionFromDB = async (id: number): Promise<number> => {
  const recordsAffected = await prisma.quizQuestion.delete({ where: { id } });
  if (recordsAffected) return 1;
  else return 0;
};

export const getRandomQuizQuestionsFromDBForMentee = async (
  count: number
): Promise<quizQuestionForMentee[]> => {
  const all = await prisma.quizQuestion.findMany({
    select: { id: true, questionTitle: true, score: true },
  });
  // Shuffle using Fisher-Yates
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const n = Math.max(0, Math.min(count, all.length));
  return all.slice(0, n);
};
