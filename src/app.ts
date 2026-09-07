/**
 * @fileoverview Express Application Setup
 * Configures the Express app with all middleware in the correct order.
 *
 * MIDDLEWARE ORDER MATTERS:
 * 1. Security headers (Helmet) — must be first, sets HTTP response headers
 * 2. CORS — before body parsers to handle preflight OPTIONS requests
 * 3. Webhook raw body — BEFORE json() parser (Stripe needs raw buffer)
 * 4. JSON body parser — after raw body handler
 * 5. Cookie parser — before auth middleware reads cookies
 * 6. Request logging (Morgan) — after parsers for complete log data
 * 7. Rate limiting — before routes to throttle at middleware level
 * 8. Routes — core business logic
 * 9. 404 handler — catch unmatched routes
 * 10. Global error handler — MUST BE LAST, 4-argument signature required
 */
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { globalRateLimiter } from "./middlewares/rateLimitMiddleware";
import { errorHandler } from "./middlewares/errorMiddleware";
import routes from "./routes/index";
import { env } from "./config/env";

const app = express();

// Trust proxy is required because the app is hosted on Render (a reverse proxy).
// Without this, express-rate-limit will block Render's internal IP and ban everyone.
app.set("trust proxy", 1);

// 1. Security headers — removes X-Powered-By, sets CSP, HSTS, etc.
app.use(
  helmet({
    // In production, we typically wouldn't disable CSP completely, but as per existing logic, we set undefined
    contentSecurityPolicy: undefined,
  }),
);

// 2. CORS — configured for frontend origin with credentials support
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true, // Required for cookies (refresh token)
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
// Handle preflight OPTIONS for all routes
app.options("*", cors());

// 3. Stripe webhook needs raw body BEFORE json() middleware
// Raw body is stored in req.rawBody for webhook signature verification
app.use(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
);

// 4. JSON body parser (10kb limit prevents payload abuse)
app.use(express.json({ limit: "10kb" }));

// 5. Cookie parser — required for reading HttpOnly refresh token cookie
app.use(cookieParser());

// 6. HTTP request logging (clean, color-coded dev format in dev, combined in production)
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

// 7. Global rate limiting (100 requests per 15 minutes per IP)
app.use(globalRateLimiter);

// 8. Mount all API routes under /api prefix
app.use("/api", routes);

// 9. 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// 10. Global error handler — MUST be last middleware (4 args required by Express)
app.use(errorHandler);

export default app;
