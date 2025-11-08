import express from "express";
const router = express.Router();
import { authorize } from "../middlewares/authorization";
import {
  createAdmin,
  deleteAdmin,
  getAdmin,
  getAdmins,
  getMentee,
  getMentees,
  updateAdmin,
} from "../controllers/user.controller";

//Admin Routes
router.get("/admins", getAdmins);
router.get("/admins/:id", getAdmin);
router.post("/admins/create", authorize(["Admin"], false), createAdmin);
router.post("/admins/update/:id", authorize(["Admin"], false), updateAdmin);
router.delete("/admins/delete/:id", deleteAdmin);

//Mentee Routes
router.get("/mentees", authorize(["Admin"], false), getMentees);
router.get("/mentees/:id", authorize(["Admin"], false), getMentee);

export { router };
