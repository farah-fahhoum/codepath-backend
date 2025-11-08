import cors from "cors";
import express from "express";
import morgan from "morgan";
import fs from "fs";

import { router as authRoutes } from "./routes/auth.api";
import { router as userRoutes } from "./routes/user.api";
import { router as contactRoutes } from "./routes/contact.api";

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use(
  morgan("common", {
    stream: fs.createWriteStream("./access.log", { flags: "a" }),
  })
);

app.use(cors({ origin: ["http://localhost:3000"] }));

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/contact", contactRoutes);

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});
