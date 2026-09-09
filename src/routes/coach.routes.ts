import express from "express";
import { authorize } from "../middlewares/authorization";
import { coachAvatarUploadMiddleware } from "../middlewares/coachAvatarUpload";
import {
  calWebhook,
  createBooking,
  createCoachAccount,
  createOrUpdateMyCoachProfile,
  updateCoachProfile,
  uploadCoachAvatar,
  deleteCoachAvatar,
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
router.post(
  "/:id/avatar",
  authorize(["Admin"], false),
  (req, res, next) => {
    coachAvatarUploadMiddleware(req, res, (error) => {
      if (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : "Invalid image upload",
        });
      }
      return next();
    });
  },
  uploadCoachAvatar,
);
router.delete(
  "/:id/avatar",
  authorize(["Admin"], false),
  deleteCoachAvatar,
);
router.patch("/:id", authorize(["Admin"], false), updateCoachProfile);
router.get("/:id", authorize(["Mentee", "Admin"], false), getCoach);
router.post(
  "/:id/bookings",
  authorize(["Mentee", "Admin"], false),
  createBooking,
);

export { router };
