import express from "express";
import { askChatbot } from "../controllers/chatbot.controller";
import { authorize } from "../middlewares/authorization";
const router = express.Router();

router.post("/ask", authorize(["Mentee"], false), askChatbot);

export { router };
