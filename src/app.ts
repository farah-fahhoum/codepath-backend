import cors from "cors";
import express from "express";
import morgan from "morgan";
import fs from "fs";

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use(
  morgan("common", {
    stream: fs.createWriteStream("./access.log", { flags: "a" }),
  })
);

app.use(cors({ origin: ["http://localhost:3000"] }));

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});
