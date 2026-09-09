import axios from "axios";
import {
  ContestSelectionRequest,
  ContestSelectionResponse,
  ReferenceCurateRequest,
  ReferenceCurateResponse,
  RoadmapGenerateRequest,
  RoadmapGenerateResponse,
  SkillAssessmentRequest,
  SkillAssessmentResponse,
} from "../types/fastapi.type";

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000";

export class FastAPIError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "FastAPIError";
    this.status = status;
  }
}

const fastapiClient = axios.create({
  baseURL: FASTAPI_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

export async function postFastAPI<T>(
  path: string,
  payload: unknown,
  timeoutMs = 20000,
): Promise<T> {
  try {
    const { data } = await fastapiClient.post(path, payload, { timeout: timeoutMs });
    // FastAPI now wraps responses in { success, message, data }; unwrap to data.
    if (data && typeof data === "object" && "success" in data && "data" in data) {
      return (data as { data: T }).data;
    }
    return data as T;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        const body = error.response.data as
          | { detail?: string | { message?: string }; message?: string; success?: boolean }
          | undefined;
        const detailRaw = body?.detail;
        const detail =
          (typeof detailRaw === "string" && detailRaw) ||
          (detailRaw &&
            typeof detailRaw === "object" &&
            typeof detailRaw.message === "string" &&
            detailRaw.message) ||
          (typeof body?.message === "string" && body.message) ||
          error.response.statusText ||
          `AI service error (${error.response.status})`;
        throw new FastAPIError(error.response.status, String(detail));
      }
      if (error.code === "ECONNREFUSED") {
        throw new FastAPIError(503, "AI service is currently unavailable");
      }
      if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
        throw new FastAPIError(504, "AI service request timeout");
      }
      throw new FastAPIError(502, `Bad gateway: ${error.message}`);
    }
    throw new FastAPIError(500, String((error as Error).message));
  }
}

export const generateRoadmap = (payload: RoadmapGenerateRequest): Promise<RoadmapGenerateResponse> =>
  postFastAPI<RoadmapGenerateResponse>("/api/roadmap/generate", payload, 120000);

export const selectContestProblems = (payload: ContestSelectionRequest): Promise<ContestSelectionResponse> =>
  postFastAPI<ContestSelectionResponse>("/api/contest/select-problems", payload);

export const curateReference = (payload: ReferenceCurateRequest): Promise<ReferenceCurateResponse> =>
  postFastAPI<ReferenceCurateResponse>("/api/reference/curate", payload);

export const evaluateSkillAssessment = (
  payload: SkillAssessmentRequest,
): Promise<SkillAssessmentResponse> =>
  postFastAPI<SkillAssessmentResponse>("/api/assessment/evaluate", payload, 20000);
