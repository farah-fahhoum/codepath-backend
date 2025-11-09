import { PrismaClient } from "@prisma/client";
import { quizQuestionList, quizQuestionSafe } from "../types/quiz.type";

const prisma = new PrismaClient();

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
