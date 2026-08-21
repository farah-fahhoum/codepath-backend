import { Request, Response } from "express";
import Joi from "joi";
import { ok } from "../lib/response";
import {
  addContestSubmissionInDB,
  addParticipantInDB,
  createContestInDB,
  deleteContestFromDB,
  findParticipantInDB,
  getContestByIdFromDB,
  getContestProblemById,
  getContestsFromDB,
  getMyContestsFromDB,
  getParticipantSubmissions,
  getScoreboardFromDB,
  markParticipantFinishedInDB,
  persistScoreboardRanksInDB,
  pickProblemsForCriteriaInDB,
  problemLabelForIndex,
  updateContestStatusInDB,
} from "../repositories/contest.repo";
import { getUserTopicsFromDB } from "../repositories/roadmapAI.repo";
import {
  getUserQuizPerformanceFromDB,
  getUserCodeforcesStatsFromDB,
} from "../repositories/roadmapAI.repo";
import { checkUserRoleForAuth } from "../repositories/user.repo";
import { FastAPIError, selectContestProblems } from "../lib/fastapiClient";
import { ContestStatusValue } from "../types/contest.type";

const isAdmin = async (userId: string): Promise<boolean> => {
  const role = await checkUserRoleForAuth(userId);
  return role?.role === "Admin";
};

const contestStatusSchema = Joi.object({
  status: Joi.string().valid("DRAFT", "SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"),
});

export const getContests = async (req: Request, res: Response) => {
  try {
    const { value, error } = contestStatusSchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.message });

    const contests = await getContestsFromDB(value.status);
    return res.status(200).json(ok(contests));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getMyContests = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;
    const contests = await getMyContestsFromDB(userId);
    return res.status(200).json(ok(contests));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getContest = async (req: Request, res: Response) => {
  try {
    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const contest = await getContestByIdFromDB(value.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });

    return res.status(200).json(ok({
      id: contest.id,
      title: contest.title,
      description: contest.description,
      type: contest.type,
      status: contest.status,
      durationMinutes: contest.durationMinutes,
      freezeEnabled: contest.freezeEnabled,
      freezeMinutes: contest.freezeMinutes,
      virtualStartTime: contest.virtualStartTime,
      createdByUserId: contest.createdByUserId,
      createdAt: contest.createdAt,
      problems: contest.problems.map((p: any) => ({
        id: p.id,
        label: p.label,
        order: p.order,
        topic: p.topic,
        problem: {
          id: p.problem.id,
          externalProblemId: p.problem.externalProblemId,
          contestId: p.problem.contestId,
          index: p.problem.index,
          rating: p.problem.rating,
          title: p.problem.title,
        },
      })),
      participants: contest.participants.map((p: any) => ({
        id: p.id,
        userId: p.userId,
        username: p.user.username,
        fullName: p.user.profile?.fullName ?? null,
        virtualStartTime: p.virtualStartTime,
        finished: p.finished,
      })),
    }));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

interface ResolvedProblems {
  problems: Array<{ problemId: number; topicId?: number | null }>;
  contestTiming?: { startTime: string; endTime: string; durationMinutes: string };
}

const resolveProblems = async (body: {
  problems?: Array<{ problemId: number; topicId?: number | null }>;
  selection?: {
    targetSkillTier?: string;
    topics?: Array<{ id?: number | null; title: string }>;
    totalProblems?: number;
  };
  userId: string;
}): Promise<ResolvedProblems> => {
  if (body.problems && body.problems.length > 0) {
    return { problems: body.problems };
  }

  if (body.selection) {
    const topics = body.selection.topics?.length
      ? body.selection.topics
      : (await getUserTopicsFromDB()).map((t) => ({ id: t.id, title: t.title }));

    if (topics.length === 0) {
      throw Object.assign(new Error("No topics provided for problem selection"), { status: 400 });
    }

    let response;
    try {
      const [quizPerformance, codeforcesStats] = await Promise.all([
        getUserQuizPerformanceFromDB(body.userId),
        getUserCodeforcesStatsFromDB(body.userId),
      ]);

      response = await selectContestProblems({
        userId: body.userId,
        targetSkillTier: body.selection.targetSkillTier || "Beginner",
        topics: topics.map((topic) => ({ id: topic.id ?? null, title: topic.title })),
        quizPerformance,
        codeforcesStats,
        totalProblems: body.selection.totalProblems || 12,
      });
    } catch (error) {
      if (error instanceof FastAPIError) {
        throw Object.assign(new Error(error.message), { status: error.status });
      }
      throw error;
    }

    if (!response.criteria || response.criteria.length === 0) {
      throw Object.assign(new Error("AI could not select any problems"), { status: 400 });
    }

    const dbProblems = await pickProblemsForCriteriaInDB(response.criteria);

    return {
      problems: dbProblems,
      contestTiming: response.contestTiming ?? undefined,
    };
  }

  throw Object.assign(
    new Error("Provide problems[] or selection (AI-generated criteria)"),
    { status: 400 },
  );
};

export const createContest = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const inputSchema = Joi.object({
      title: Joi.string().min(1).required(),
      description: Joi.string().optional().allow(""),
      durationMinutes: Joi.number().integer().min(1).max(600).required(),
      freezeEnabled: Joi.boolean().optional().default(true),
      freezeMinutes: Joi.number().integer().min(1).optional().allow(null),
      problems: Joi.array()
        .items(
          Joi.object({
            problemId: Joi.number().integer().positive().required(),
            topicId: Joi.number().integer().positive().optional().allow(null),
          }),
        )
        .optional(),
      selection: Joi.object({
        targetSkillTier: Joi.string().optional(),
        topics: Joi.array()
          .items(
            Joi.object({
              id: Joi.number().integer().positive().optional().allow(null),
              title: Joi.string().required(),
            }),
          )
          .optional(),
        totalProblems: Joi.number().integer().min(1).max(26).optional(),
      }).optional(),
    });

    const { value, error } = inputSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const resolved = await resolveProblems({ ...value, userId });

    const contestProblems = resolved.problems.map((p, index) => ({
      problemId: p.problemId,
      topicId: p.topicId ?? null,
      label: problemLabelForIndex(index),
      order: index,
    }));

    const contest = await createContestInDB({
      title: value.title,
      description: value.description,
      durationMinutes: value.durationMinutes,
      freezeEnabled: value.freezeEnabled,
      freezeMinutes: value.freezeMinutes ?? null,
      createdByUserId: userId,
      problems: contestProblems,
    });

    return res.status(201).json(ok({
      contestId: contest.id,
      contestTiming: resolved.contestTiming ?? null,
    }, "Contest created successfully"));
  } catch (error: any) {
    const status = error?.status;
    if (status) return res.status(status).json({ message: error.message });
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const startContest = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;
    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const contest = await getContestByIdFromDB(value.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });
    if (contest.createdByUserId !== userId && !(await isAdmin(userId))) {
      return res.status(403).json({ message: "Only the contest host can start it" });
    }

    const updated = await updateContestStatusInDB(
      contest.id,
      "ONGOING" as ContestStatusValue,
      new Date(),
    );

    return res.status(200).json(ok({
      status: updated.status,
      virtualStartTime: updated.virtualStartTime,
    }, "Contest started"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const joinContest = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;
    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const contest = await getContestByIdFromDB(value.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });
    if (contest.status === "COMPLETED" || contest.status === "CANCELLED") {
      return res.status(400).json({ message: "Contest is not open for participation" });
    }

    const existing = await findParticipantInDB(contest.id, userId);
    if (existing) {
      return res.status(200).json(ok({
        participant: existing,
      }, "Already a participant"));
    }

    const participant = await addParticipantInDB(contest.id, userId, new Date());
    return res.status(201).json(ok({
      participant,
    }, "Joined contest successfully"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const submitSolution = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value: params, error: paramError } = paramSchema.validate(req.params);
    if (paramError) return res.status(400).json({ message: paramError.message });

    const bodySchema = Joi.object({
      contestProblemId: Joi.string().required(),
      verdict: Joi.string().min(1).required(),
      programmingLanguage: Joi.string().min(1).required(),
    });
    const { value: body, error: bodyError } = bodySchema.validate(req.body);
    if (bodyError) return res.status(400).json({ message: bodyError.message });

    const contest = await getContestByIdFromDB(params.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });
    if (contest.status !== "ONGOING") {
      return res.status(400).json({ message: "Contest is not running" });
    }

    const participant = await findParticipantInDB(contest.id, userId);
    if (!participant || !participant.virtualStartTime) {
      return res.status(400).json({ message: "Join the contest before submitting" });
    }

    const contestProblem = await getContestProblemById(body.contestProblemId);
    if (!contestProblem || contestProblem.contestId !== contest.id) {
      return res.status(400).json({ message: "Problem does not belong to this contest" });
    }

    const elapsedMinutes = Math.max(
      0,
      Math.floor((Date.now() - participant.virtualStartTime.getTime()) / 60000),
    );
    if (elapsedMinutes > contest.durationMinutes) {
      return res.status(400).json({ message: "Contest duration has ended" });
    }

    const submission = await addContestSubmissionInDB({
      contestId: contest.id,
      participantId: participant.id,
      contestProblemId: contestProblem.id,
      verdict: body.verdict,
      submissionTimeMinutes: elapsedMinutes,
      programmingLanguage: body.programmingLanguage,
    });

    return res.status(201).json(ok({
      submission,
    }, "Submission recorded"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const finishContest = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const contest = await getContestByIdFromDB(value.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });

    const participant = await findParticipantInDB(contest.id, userId);
    if (!participant) {
      return res.status(400).json({ message: "You are not a participant" });
    }

    await markParticipantFinishedInDB(participant.id);
    return res.status(200).json(ok(null, "Contest participation finished"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getScoreboard = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const querySchema = Joi.object({
      final: Joi.boolean().optional().default(false),
    });
    const { value: query } = querySchema.validate(req.query);

    const contest = await getContestByIdFromDB(value.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });

    if (query.final && !(await isAdmin(userId))) {
      return res.status(403).json({ message: "Only admins can view the final scoreboard" });
    }

    const scoreboard = await getScoreboardFromDB(contest.id, { final: query.final });
    return res.status(200).json(ok({
      contestId: contest.id,
      frozen: query.final ? false : contest.freezeEnabled && contest.freezeMinutes != null,
      freezeMinutes: contest.freezeMinutes,
      scoreboard,
    }));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const getMySubmissions = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const contest = await getContestByIdFromDB(value.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });

    const participant = await findParticipantInDB(contest.id, userId);
    if (!participant) return res.status(200).json(ok({ submissions: [] }));

    const submissions = await getParticipantSubmissions(contest.id, participant.id);
    return res.status(200).json(ok({ submissions }));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const completeContest = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const contest = await getContestByIdFromDB(value.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });
    if (contest.createdByUserId !== userId && !(await isAdmin(userId))) {
      return res.status(403).json({ message: "Only the contest host can complete it" });
    }

    await persistScoreboardRanksInDB(contest.id);
    const updated = await updateContestStatusInDB(contest.id, "COMPLETED");

    return res.status(200).json(ok({
      status: updated.status,
    }, "Contest completed"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const cancelContest = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const contest = await getContestByIdFromDB(value.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });
    if (contest.createdByUserId !== userId && !(await isAdmin(userId))) {
      return res.status(403).json({ message: "Only the contest host can cancel it" });
    }

    const updated = await updateContestStatusInDB(contest.id, "CANCELLED");
    return res.status(200).json(ok({ status: updated.status }, "Contest cancelled"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const deleteContest = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;

    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const contest = await getContestByIdFromDB(value.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });
    if (contest.createdByUserId !== userId && !(await isAdmin(userId))) {
      return res.status(403).json({ message: "Only the contest host can delete it" });
    }

    await deleteContestFromDB(contest.id);
    return res.status(200).json(ok(null, "Contest deleted"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};
