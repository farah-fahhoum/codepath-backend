import express from "express";
import { authorize } from "../middlewares/authorization";
import {
  createAdmin,
  deleteAdmin,
  getAdmin,
  getAdmins,
  getMentee,
  getMenteeProfile,
  getMentees,
  getRole,
  getRoles,
  updateAdmin,
  updateMenteePassword,
} from "../controllers/user.controller";

const router = express.Router();

//Admin Routes
router.get("/admins", authorize(["Admin"], false), getAdmins);
router.get("/admins/:id", authorize(["Admin"], false), getAdmin);
router.post("/admins/create", authorize(["Admin"], false), createAdmin);
router.post("/admins/update/:id", authorize(["Admin"], false), updateAdmin);
router.delete("/admins/delete/:id", authorize(["Admin"], false), deleteAdmin);

//Mentee Routes
router.get("/mentees", authorize(["Admin"], false), getMentees);
router.get("/mentees/:id", authorize(["Admin"], false), getMentee);
router.get(
  "/mentees/profile/view",
  authorize(["Mentee"], false),
  getMenteeProfile
);
router.post(
  "/mentees/password/update",
  authorize(["Mentee"], false),
  updateMenteePassword
);

//Role Routes
router.get("/roles", authorize(["Admin"], false), getRoles);
router.get("/roles/:id", authorize(["Admin"], false), getRole);

export { router };
