import express from "express";
import { authorize } from "../middlewares/authorization";
import {
  createAdmin,
  deleteAdmin,
  getAdmin,
  getAdmins,
  getMentee,
  getMentees,
  getRole,
  getRoles,
  updateAdmin,
} from "../controllers/user.controller";

const router = express.Router();

//Admin Routes
router.get("/admins", getAdmins);
router.get("/admins/:id", getAdmin);
router.post("/admins/create", authorize(["Admin"], false), createAdmin);
router.post("/admins/update/:id", authorize(["Admin"], false), updateAdmin);
router.delete("/admins/delete/:id", deleteAdmin);

//Mentee Routes
router.get("/mentees", authorize(["Admin"], false), getMentees);
router.get("/mentees/:id", authorize(["Admin"], false), getMentee);

//Role Routes
router.get("/roles", authorize(["Admin"], false), getRoles);
router.get("/roles/:id", authorize(["Admin"], false), getRole);

export { router };
