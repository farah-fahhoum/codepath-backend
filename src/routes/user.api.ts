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
  setMenteeSkillLevel,
  getMenteeSkillProfileView,
  getSkillLevelOptionsView,
  getSkillSyncStatusView,
  setSkillLevelPreferenceView,
  updateAdmin,
  updateMenteePassword,
  updateMenteeProfile,
  getNearbyUsers,
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

// Specific mentee routes MUST come before /mentees/:id (otherwise :id captures e.g. "skill-level-options")
router.get(
  "/mentees/nearby",
  authorize(["Mentee", "Admin"], false),
  getNearbyUsers
);
router.get(
  "/mentees/profile/view",
  authorize(["Mentee"], false),
  getMenteeProfile
);
router.post(
  "/mentees/profile/update",
  authorize(["Mentee"], false),
  updateMenteeProfile
);
router.post(
  "/mentees/password/update",
  authorize(["Mentee"], false),
  updateMenteePassword
);
router.post(
  "/mentees/skill-level",
  authorize(["Mentee"], false),
  setMenteeSkillLevel
);
router.get(
  "/mentees/skill-profile",
  authorize(["Mentee", "Admin"], false),
  getMenteeSkillProfileView
);
router.get(
  "/mentees/skill-level-options",
  authorize(["Mentee"], false),
  getSkillLevelOptionsView
);
router.get(
  "/mentees/skill-sync-status",
  authorize(["Mentee"], false),
  getSkillSyncStatusView
);
router.post(
  "/mentees/skill-level-preference",
  authorize(["Mentee"], false),
  setSkillLevelPreferenceView
);

router.get("/mentees/:id", authorize(["Admin"], false), getMentee);

//Role Routes
router.get("/roles", authorize(["Admin"], false), getRoles);
router.get("/roles/:id", authorize(["Admin"], false), getRole);

export { router };
