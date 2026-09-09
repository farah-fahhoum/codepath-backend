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
  parseRulesOfEngagement,
  parseTags,
  persistScoreboardRanksInDB,
  pickCodePathProblemsFromAISelectionInDB,
  problemLabelForIndex,
  startVirtualContestInDB,
  syncContestLifecycleInDB,
  updateContestInDB,
  updateContestStatusInDB,
  verifyPublishedCodePathProblemsInDB,
} from "../repositories/contest.repo";
import { createCodePathSubmissionInDB } from "../repositories/codepathProblem.repo";
import { recordProblemAttempt } from "../repositories/userProblemAttempt.repo";
import { refreshSkillSnapshotFast, scheduleFullSkillSnapshotRefresh } from "../services/assessment.service";
import { checkUserRoleForAuth } from "../repositories/user.repo";
import { defaultExecutionProvider, SupportedExecutionLanguage } from "../services/execution";
import { JudgeService } from "../services/judge";
import { FastAPIError } from "../lib/fastapiClient";
import { ContestStatusValue } from "../types/contest.type";

const judgeService = new JudgeService(defaultExecutionProvider);

const isAdmin = async (userId: string): Promise<boolean> => {
  const role = await checkUserRoleForAuth(userId);
  return role?.role === "Admin";
};

const assertFutureScheduledStart = (value: Date | string | null | undefined): Date | null => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error("Invalid scheduled start time"), { status: 400 });
  }
  if (date.getTime() < Date.now()) {
    throw Object.assign(new Error("Scheduled start time must be in the future"), { status: 400 });
  }
  return date;
};

const participantCanSubmit = (
  contestStatus: string,
  participant: { isVirtualReplay: boolean; virtualStartTime: Date | null; finished: boolean },
): boolean => {
  if (!participant.virtualStartTime || participant.finished) return false;
  if (contestStatus === "ONGOING" && !participant.isVirtualReplay) return true;
  if (contestStatus === "COMPLETED" && participant.isVirtualReplay) return true;
  return false;
};

const mapContestProblems = (problems: Array<{
  id: string;
  label: string;
  order: number;
  codePathProblem: {
    id: string;
    slug: string;
    title: string;
    rating: number;
    tags: string;
  };
}>) =>
  problems.map((p) => ({
    id: p.id,
    label: p.label,
    order: p.order,
    codePathProblem: {
      id: p.codePathProblem.id,
      slug: p.codePathProblem.slug,
      title: p.codePathProblem.title,
      rating: p.codePathProblem.rating,
      tags: parseTags(p.codePathProblem.tags),
    },
  }));

const isContestContentLocked = (contest: {
  status: string;
  scheduledStartTime: Date | null;
}): boolean => {
  if (contest.status !== "SCHEDULED") return false;
  if (!contest.scheduledStartTime) return false;
  return contest.scheduledStartTime.getTime() > Date.now();
};

const mapContestDetail = (
  contest: NonNullable<Awaited<ReturnType<typeof getContestByIdFromDB>>>,
  options?: { hideProblems?: boolean },
) => {
  const start = contest.scheduledStartTime ?? contest.virtualStartTime;
  const scheduledEndTime = start
    ? new Date(start.getTime() + contest.durationMinutes * 60 * 1000)
    : null;

  return {
    id: contest.id,
    title: contest.title,
    description: contest.description,
    type: contest.type,
    status: contest.status,
    difficulty: contest.difficulty,
    durationMinutes: contest.durationMinutes,
    scheduledStartTime: contest.scheduledStartTime,
    scheduledEndTime,
    freezeEnabled: contest.freezeEnabled,
    freezeMinutes: contest.freezeMinutes,
    virtualStartTime: contest.virtualStartTime,
    rulesOfEngagement: parseRulesOfEngagement(contest.rulesOfEngagement),
    createdByUserId: contest.createdByUserId,
    createdAt: contest.createdAt,
    problems: options?.hideProblems ? [] : mapContestProblems(contest.problems),
    problemCount: contest.problems.length,
    contentLocked: options?.hideProblems ?? false,
    participants: contest.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      username: p.user.username,
      fullName: p.user.profile?.fullName ?? null,
      virtualStartTime: p.virtualStartTime,
      finished: p.finished,
      isVirtualReplay: p.isVirtualReplay,
      solvedCount: p.solvedCount,
      rank: p.rank,
    })),
  };
};

const contestStatusSchema = Joi.object({
  status: Joi.string().valid("DRAFT", "SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"),
});

export const getContests = async (req: Request, res: Response) => {
  try {
    const { value, error } = contestStatusSchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.message });

    // @ts-expect-error userId is defined
    const userId = req.user?.id as string | undefined;
    const admin = userId ? await isAdmin(userId) : false;

    const contests = await getContestsFromDB(value.status, {
      excludeDraft: !admin,
      userId,
    });
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

    await syncContestLifecycleInDB(value.id);

    const contest = await getContestByIdFromDB(value.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });

    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;
    if (contest.status === "DRAFT" && !(await isAdmin(userId))) {
      return res.status(404).json({ message: "Contest not found" });
    }

    const admin = await isAdmin(userId);
    const contentLocked = isContestContentLocked(contest) && !admin;

    return res.status(200).json(ok(mapContestDetail(contest, { hideProblems: contentLocked })));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

const resolveCodePathProblemIds = async (
  body: {
    problems?: Array<{ codePathProblemId: string }>;
    selection?: {
      targetSkillTier?: string;
      topics?: Array<{ id?: number; title: string }>;
      totalProblems?: number;
    };
  },
  userId: string,
): Promise<string[]> => {
  if (body.problems && body.problems.length > 0) {
    return body.problems.map((p) => p.codePathProblemId);
  }

  if (body.selection) {
    const topics = body.selection.topics?.length
      ? body.selection.topics
      : [{ title: "implementation" }, { title: "math" }];

    try {
      const ids = await pickCodePathProblemsFromAISelectionInDB({
        userId,
        targetSkillTier: body.selection.targetSkillTier || "Intermediate",
        topics,
        totalProblems: body.selection.totalProblems || 6,
      });

      if (ids.length === 0) {
        throw Object.assign(new Error("No published CodePath problems available for AI selection"), {
          status: 400,
        });
      }

      return ids;
    } catch (error) {
      if (error instanceof FastAPIError) {
        throw Object.assign(new Error(error.message), { status: error.status });
      }
      throw error;
    }
  }

  throw Object.assign(
    new Error("Provide problems[] with CodePath problem IDs or AI selection criteria"),
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
      difficulty: Joi.string().valid("EASY", "MEDIUM", "HARD").optional(),
      durationMinutes: Joi.number().integer().min(1).max(600).required(),
      scheduledStartTime: Joi.date().iso().optional().allow(null),
      freezeEnabled: Joi.boolean().optional().default(true),
      freezeMinutes: Joi.number().integer().min(1).optional().allow(null),
      rulesOfEngagement: Joi.array().items(Joi.string().min(1)).optional(),
      problems: Joi.array()
        .items(
          Joi.object({
            codePathProblemId: Joi.string().required(),
          }),
        )
        .optional(),
      selection: Joi.object({
        targetSkillTier: Joi.string().optional(),
        topics: Joi.array()
          .items(
            Joi.object({
              id: Joi.number().integer().optional(),
              title: Joi.string().required(),
            }),
          )
          .optional(),
        totalProblems: Joi.number().integer().min(1).max(26).optional(),
      }).optional(),
    });

    const { value, error } = inputSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const scheduledStartTime = value.scheduledStartTime
      ? assertFutureScheduledStart(value.scheduledStartTime)
      : null;

    const problemIds = await resolveCodePathProblemIds(value, userId);
    const missing = await verifyPublishedCodePathProblemsInDB(problemIds);
    if (missing.length > 0) {
      return res.status(400).json({
        message: `One or more problems are not published: ${missing.join(", ")}`,
      });
    }

    const contestProblems = problemIds.map((id, index) => ({
      codePathProblemId: id,
      label: problemLabelForIndex(index),
      order: index,
    }));

    const contest = await createContestInDB({
      title: value.title,
      description: value.description,
      difficulty: value.difficulty,
      durationMinutes: value.durationMinutes,
      scheduledStartTime,
      freezeEnabled: value.freezeEnabled,
      freezeMinutes: value.freezeMinutes ?? null,
      rulesOfEngagement: value.rulesOfEngagement,
      createdByUserId: userId,
      problems: contestProblems,
    });

    return res.status(201).json(ok({ contestId: contest.id }, "Contest created successfully"));
  } catch (error: any) {
    const status = error?.status;
    if (status) return res.status(status).json({ message: error.message });
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const updateContest = async (req: Request, res: Response) => {
  try {
    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value: params, error: paramError } = paramSchema.validate(req.params);
    if (paramError) return res.status(400).json({ message: paramError.message });

    const bodySchema = Joi.object({
      title: Joi.string().min(1).optional(),
      description: Joi.string().optional().allow("", null),
      difficulty: Joi.string().valid("EASY", "MEDIUM", "HARD").optional(),
      durationMinutes: Joi.number().integer().min(1).max(600).optional(),
      scheduledStartTime: Joi.date().iso().optional().allow(null),
      freezeEnabled: Joi.boolean().optional(),
      freezeMinutes: Joi.number().integer().min(1).optional().allow(null),
      rulesOfEngagement: Joi.array().items(Joi.string().min(1)).optional(),
      problems: Joi.array()
        .items(
          Joi.object({
            codePathProblemId: Joi.string().required(),
          }),
        )
        .optional(),
    });

    const { value: body, error: bodyError } = bodySchema.validate(req.body);
    if (bodyError) return res.status(400).json({ message: bodyError.message });

    const scheduledStartTime =
      body.scheduledStartTime !== undefined
        ? body.scheduledStartTime === null
          ? null
          : assertFutureScheduledStart(body.scheduledStartTime)
        : undefined;

    const contest = await getContestByIdFromDB(params.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });
    if (contest.status !== "DRAFT") {
      return res.status(400).json({ message: "Only draft contests can be edited" });
    }

    let contestProblems: Array<{ codePathProblemId: string; label: string; order: number }> | undefined;
    if (body.problems) {
      const problemIds = body.problems.map((p: { codePathProblemId: string }) => p.codePathProblemId);
      const missing = await verifyPublishedCodePathProblemsInDB(problemIds);
      if (missing.length > 0) {
        return res.status(400).json({
          message: `One or more problems are not published: ${missing.join(", ")}`,
        });
      }
      contestProblems = problemIds.map((id: string, index: number) => ({
        codePathProblemId: id,
        label: problemLabelForIndex(index),
        order: index,
      }));
    }

    await updateContestInDB(params.id, {
      title: body.title,
      description: body.description,
      difficulty: body.difficulty,
      durationMinutes: body.durationMinutes,
      scheduledStartTime,
      freezeEnabled: body.freezeEnabled,
      freezeMinutes: body.freezeMinutes,
      rulesOfEngagement: body.rulesOfEngagement,
      problems: contestProblems,
    });

    const refreshed = await getContestByIdFromDB(params.id);
    if (!refreshed) return res.status(404).json({ message: "Contest not found" });

    return res.status(200).json(ok(mapContestDetail(refreshed), "Contest updated"));
  } catch (error: any) {
    const status = error?.status;
    if (status) return res.status(status).json({ message: error.message });
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const publishContest = async (req: Request, res: Response) => {
  try {
    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const contest = await getContestByIdFromDB(value.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });
    if (contest.status !== "DRAFT") {
      return res.status(400).json({ message: "Only draft contests can be published" });
    }
    if (contest.problems.length === 0) {
      return res.status(400).json({ message: "Contest must have at least one problem" });
    }
    if (!contest.scheduledStartTime) {
      return res.status(400).json({
        message: "Contest must have a scheduled start time before publishing",
      });
    }
    assertFutureScheduledStart(contest.scheduledStartTime);

    const updated = await updateContestStatusInDB(contest.id, "SCHEDULED");
    return res.status(200).json(ok({ status: updated.status }, "Contest published"));
  } catch (error) {
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
    if (contest.status !== "SCHEDULED") {
      return res.status(400).json({ message: "Contest must be published (scheduled) before starting" });
    }

    const startTime = contest.scheduledStartTime ?? new Date();
    const updated = await updateContestStatusInDB(
      contest.id,
      "ONGOING" as ContestStatusValue,
      startTime,
    );

    return res.status(200).json(ok({
      status: updated.status,
      virtualStartTime: updated.virtualStartTime,
    }, "Contest started"));
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

export const startVirtualContest = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId is defined
    const userId = req.user?.id as string;
    const paramSchema = Joi.object({ id: Joi.string().required() });
    const { value, error } = paramSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.message });

    const contest = await getContestByIdFromDB(value.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });
    if (contest.status !== "COMPLETED") {
      return res.status(400).json({
        message: "Virtual simulation is only available for completed contests",
      });
    }

    const participant = await startVirtualContestInDB(contest.id, userId);
    return res.status(200).json(
      ok(
        {
          participant: {
            id: participant.id,
            userId: participant.userId,
            virtualStartTime: participant.virtualStartTime,
            isVirtualReplay: participant.isVirtualReplay,
            finished: participant.finished,
          },
        },
        "Virtual contest started",
      ),
    );
  } catch (error: any) {
    const status = error?.status;
    if (status) return res.status(status).json({ message: error.message });
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

    await syncContestLifecycleInDB(value.id);

    const contest = await getContestByIdFromDB(value.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });
    if (contest.status !== "ONGOING") {
      return res.status(400).json({ message: "Contest is not open for participation" });
    }

    const existing = await findParticipantInDB(contest.id, userId);
    if (existing) {
      return res.status(200).json(ok({ participant: existing }, "Already a participant"));
    }

    const participant = await addParticipantInDB(contest.id, userId, new Date());
    return res.status(201).json(ok({ participant }, "Joined contest successfully"));
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
      code: Joi.string().min(1).required(),
      language: Joi.string().valid("cpp", "java", "python", "javascript").required(),
    });
    const { value: body, error: bodyError } = bodySchema.validate(req.body);
    if (bodyError) return res.status(400).json({ message: bodyError.message });

    const contest = await getContestByIdFromDB(params.id);
    if (!contest) return res.status(404).json({ message: "Contest not found" });
    if (contest.status !== "ONGOING" && contest.status !== "COMPLETED") {
      return res.status(400).json({ message: "Contest is not open for submissions" });
    }

    const participant = await findParticipantInDB(contest.id, userId);
    if (!participant || !participantCanSubmit(contest.status, participant)) {
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

    const problem = contestProblem.codePathProblem;
    const language = body.language as SupportedExecutionLanguage;

    const judgeResult = await judgeService.judge({
      problem: {
        id: problem.id,
        timeLimitMs: problem.timeLimitMs,
        memoryLimitMb: problem.memoryLimitMb,
      },
      testCases: problem.testCases.map((tc) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isSample: tc.isSample,
        sortOrder: tc.sortOrder,
      })),
      language,
      code: body.code,
      maxCases: problem.testCases.length,
    });

    const codePathSubmission = await createCodePathSubmissionInDB({
      problemId: problem.id,
      userId,
      language,
      code: body.code,
      verdict: judgeResult.verdict,
      passedCount: judgeResult.passedCount,
      totalCount: judgeResult.totalCount,
      runtimeMs: judgeResult.runtimeMs,
      message: judgeResult.message,
      stderr: judgeResult.stderr,
    });

    const submission = await addContestSubmissionInDB({
      contestId: contest.id,
      participantId: participant.id,
      contestProblemId: contestProblem.id,
      codePathSubmissionId: codePathSubmission.id,
      verdict: judgeResult.verdict,
      submissionTimeMinutes: elapsedMinutes,
      programmingLanguage: language,
    });

    await recordProblemAttempt({
      userId,
      externalProblemId: problem.id,
      platform: "CodePath",
      solved: judgeResult.verdict === "AC",
      source: "contest",
      executionTimeMs: judgeResult.runtimeMs,
    });

    const sampleCaseResults = judgeResult.caseResults
      .filter((c) => c.isSample)
      .map((c) => ({
        index: c.index,
        verdict: c.verdict,
        stdout: c.stdout,
        stderr: c.stderr,
        timeMs: c.timeMs,
      }));

    return res.status(201).json(ok({
      submission: {
        id: submission.id,
        contestProblemId: submission.contestProblemId,
        verdict: submission.verdict,
        submissionTimeMinutes: submission.submissionTimeMinutes,
        programmingLanguage: submission.programmingLanguage,
        codePathSubmissionId: submission.codePathSubmissionId,
        createdAt: submission.createdAt,
      },
      judge: {
        verdict: judgeResult.verdict,
        passedCount: judgeResult.passedCount,
        totalCount: judgeResult.totalCount,
        runtimeMs: judgeResult.runtimeMs,
        message: judgeResult.message,
        sampleCaseResults,
      },
    }, "Submission judged"));
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
    await refreshSkillSnapshotFast(userId);
    scheduleFullSkillSnapshotRefresh(userId);
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

    if (isContestContentLocked(contest) && !(await isAdmin(userId))) {
      return res.status(403).json({
        message: "Scoreboard is not available until the contest starts",
      });
    }

    const forceFinal = contest.status === "COMPLETED" || query.final;
    if (query.final && contest.status !== "COMPLETED" && !(await isAdmin(userId))) {
      return res.status(403).json({ message: "Only admins can view the final scoreboard" });
    }

    const scoreboard = await getScoreboardFromDB(contest.id, { final: forceFinal });
    return res.status(200).json(ok({
      contestId: contest.id,
      frozen: forceFinal ? false : contest.freezeEnabled && contest.freezeMinutes != null,
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

    if (isContestContentLocked(contest) && !(await isAdmin(userId))) {
      return res.status(200).json(ok({ submissions: [] }));
    }

    const participant = await findParticipantInDB(contest.id, userId);
    if (!participant) return res.status(200).json(ok({ submissions: [] }));

    const submissions = await getParticipantSubmissions(contest.id, participant.id);
    return res.status(200).json(ok({
      submissions: submissions.map((s) => ({
        id: s.id,
        contestProblemId: s.contestProblemId,
        problemLabel: s.contestProblem.label,
        codePathProblemId: s.contestProblem.codePathProblemId,
        verdict: s.verdict,
        submissionTimeMinutes: s.submissionTimeMinutes,
        programmingLanguage: s.programmingLanguage,
        codePathSubmissionId: s.codePathSubmissionId,
        createdAt: s.createdAt,
      })),
    }));
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

    return res.status(200).json(ok({ status: updated.status }, "Contest completed"));
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
