import express from "express";
import {
  adminAndMenteeLogin,
  logout,
  menteeRegister,
} from "../controllers/user.controller";
const router = express.Router();

router.post("/login", adminAndMenteeLogin);
router.post("/logout", logout);
router.post("/mentee/register", menteeRegister);

export { router };
