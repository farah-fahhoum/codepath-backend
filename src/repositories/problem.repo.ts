import { prisma } from "../lib/prisma";
import { favouriteProblem } from "../types/problem.type";
export const getUserFavouriteProblemsFromDB = async (
  userId: string
): Promise<favouriteProblem[]> => {
  const list = await prisma.favouriteProblem.findMany({
    where: { userId },
    select: {
      id: true,
      externalProblemId: true,
      platform: true,
      createdAt: true,
    },
  });
  return list;
};

export const addProblemToFavouriteDB = async (
  userId: string,
  externalProblemId: string,
  platform: string
) => {
  await prisma.favouriteProblem.create({
    data: {
      userId: userId,
      externalProblemId: externalProblemId,
      platform: platform,
    },
  });
};

export const deleteProblemFromFavouriteDB = async (
  id: string
): Promise<number> => {
  const recordsAffected = await prisma.favouriteProblem.delete({
    where: { id },
  });
  if (recordsAffected) return 1;
  else return 0;
};

export const checkFavouriteBelongsToUser = async (
  userId: string,
  id: string
): Promise<boolean> => {
  const recordExist = await prisma.favouriteProblem.findFirst({
    where: { userId, id },
  });
  if (recordExist) return true;
  else return false;
};

export const checkFavouriteExistForUser = async (
  userId: string,
  externalProblemId: string,
  platform: string
): Promise<boolean> => {
  const recordExist = await prisma.favouriteProblem.findFirst({
    where: {
      userId: userId,
      externalProblemId: externalProblemId,
      platform: platform,
    },
  });
  if (recordExist) {
    return true;
  } else return false;
};
