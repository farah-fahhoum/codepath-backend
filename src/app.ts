import cors from "cors";
import express from "express";
import morgan from "morgan";
import fs from "fs";

import { router as authRoutes } from "./routes/auth.api";
import { router as userRoutes } from "./routes/user.api";
import { router as contactRoutes } from "./routes/contact.api";
import { router as quizRoutes } from "./routes/quiz.api";
import { router as problemRoutes } from "./routes/problem.api";
import { router as chatbotRouter } from "./routes/chatbot.api";
import { router as statisticsRouter } from "./routes/statistics.api";
import { router as roadmapRoutes } from "./routes/roadmap.routes";
import { router as skillLevelRoutes } from "./routes/skillLevel.api";
import { router as topicRoutes } from "./routes/topic.api";
import { router as externalAccountRoutes } from "./routes/externalAccount.api";
import { router as contestRoutes } from "./routes/contest.routes";
import { router as coachRoutes } from "./routes/coach.routes";
import { router as referenceRoutes } from "./routes/reference.routes";

const app = express();
app.use(
  express.json({
    limit: "20mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use(
  morgan("common", {
    stream: fs.createWriteStream("./access.log", { flags: "a" }),
  }),
);

app.use(cors({ origin: ["http://localhost:3000"] }));

// Standard response envelope: { success, message, data }
app.use((_req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = ((body: any) => {
    // Pass through bodies that already follow the standard envelope.
    if (body && typeof body === "object" && "success" in body && "data" in body) {
      return originalJson(body);
    }
    const success = res.statusCode < 400;
    const message =
      body && typeof body === "object" && typeof body.message === "string"
        ? body.message
        : success
          ? "Success"
          : "Request failed";
    return originalJson({
      success,
      message,
      data: success ? (body ?? null) : null,
    });
  }) as typeof res.json;
  next();
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/contact", contactRoutes);
app.use("/quiz", quizRoutes);
app.use("/problems", problemRoutes);
app.use("/chatbot", chatbotRouter);
app.use("/statistics", statisticsRouter);
app.use("/roadmaps", roadmapRoutes);
app.use("/skill-levels", skillLevelRoutes);
app.use("/topics", topicRoutes);
app.use("/external-accounts", externalAccountRoutes);
app.use("/contests", contestRoutes);
app.use("/coaches", coachRoutes);
app.use("/reference", referenceRoutes);

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});
