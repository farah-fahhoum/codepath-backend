import express from "express";
import { authorize } from "../middlewares/authorization";
import {
  calWebhook,
  createBooking,
  createCoachAccount,
  createOrUpdateMyCoachProfile,
  getCoach,
  getCoachBookings,
  getCoaches,
  getMyBookings,
  getMyCoachProfile,
  updateBookingStatus,
} from "../controllers/coach.controller";

const router = express.Router();

// Cal.com webhook (public, HMAC-verified in the controller)
router.post("/webhook/cal", calWebhook);

// Only admins can create coach accounts.
router.post("/", authorize(["Admin"], false), createCoachAccount);

// My coach profile (static paths must come before /:id)
router.get("/me", authorize(["Coach"], false), getMyCoachProfile);
router.post(
  "/me",
  authorize(["Coach"], false),
  createOrUpdateMyCoachProfile,
);

// Bookings
router.get(
  "/bookings/me",
  authorize(["Mentee", "Admin"], false),
  getMyBookings,
);
router.get(
  "/bookings/coach",
  authorize(["Coach", "Admin"], false),
  getCoachBookings,
);
router.patch(
  "/bookings/:id",
  authorize(["Mentee", "Coach", "Admin"], false),
  updateBookingStatus,
);

// Coach listing
router.get("/", authorize(["Mentee", "Admin"], false), getCoaches);
router.get("/:id", authorize(["Mentee", "Admin"], false), getCoach);
router.post(
  "/:id/bookings",
  authorize(["Mentee", "Admin"], false),
  createBooking,
);

export { router };
