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
import { seedEasyAchievementsInDB } from "./repositories/roadmap.repo";

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use(
  morgan("common", {
    stream: fs.createWriteStream("./access.log", { flags: "a" }),
  }),
);

app.use(cors({ origin: ["http://localhost:3000"] }));

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

// One-time task
(async () => {
  try {
    await seedEasyAchievementsInDB();
    console.log("Achievements seeded");
  } catch (e) {
    console.error("Failed to seed achievements:", e);
  }
})();

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});
