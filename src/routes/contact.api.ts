import express from "express";
import {
  getContactInfo,
  getContactInquiries,
  getContactInquiry,
  SendContactInquery,
  updateContactInfo,
} from "../controllers/contact.controller";
import { authorize } from "../middlewares/authorization";
const router = express.Router();

//Contact Info Routes
router.get("/info", getContactInfo);
router.post("/info/update", authorize(["Admin"], false), updateContactInfo);

//Conact Inquery Routes
router.get("/inquiries", authorize(["Admin"], false), getContactInquiries);
router.get("/inquiries/:id", authorize(["Admin"], false), getContactInquiry);
router.post("/inquiries/send", SendContactInquery);

export { router };
