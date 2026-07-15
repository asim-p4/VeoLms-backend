import { Router } from "express";
import authRoutes from "./authRoutes";
import userRoutes from "./userRoutes";
import courseRoutes from "./courseRoutes";
import lessonRoutes from "./lessonRoutes";
import adminRoutes from "./adminRoutes";
import enrollmentRoutes from "./enrollmentRoutes";
import progressRoutes from "./progressRoutes";
import paymentRoutes from "./paymentRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/courses", courseRoutes);
router.use("/lessons", lessonRoutes);
router.use("/admin", adminRoutes);
router.use("/enrollments", enrollmentRoutes);
router.use("/progress", progressRoutes);
router.use("/payments", paymentRoutes);

export default router;