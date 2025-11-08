import express from "express";
import {
  adminAndMenteeLogin,
  menteeRegister,
} from "../controllers/user.controller";
const router = express.Router();

router.post("/login", adminAndMenteeLogin);
router.post("/mentee/register", menteeRegister);

export { router };
