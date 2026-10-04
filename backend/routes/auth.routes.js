import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/auth.controller.js";
import { validateRegister, validateLogin } from "../middleware/validator.js";

const authRouter = Router();

// Rate limiter: Max 10 registration attempts per 15 minutes per IP
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many registration attempts from this IP, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter: Max 5 resend attempts per 15 minutes per IP
const resendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many OTP requests from this IP, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter: Max 15 verification attempts per 15 minutes per IP
const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: "Too many verification attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter: Max 15 login attempts per 15 minutes per IP (Brute-force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: "Too many login attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter: Max 20 OAuth attempts per 15 minutes per IP
const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many OAuth requests, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/auth/register
 */
authRouter.post("/register", registerLimiter, validateRegister, authController.register);

/**
 * POST /api/auth/login
 */
authRouter.post("/login", loginLimiter, validateLogin, authController.login);


/**
 * GET /api/auth/get-me
 */
authRouter.get("/get-me", authController.getMe);

/**
 * GET /api/auth/refresh-token
 */
authRouter.get("/refresh-token", authController.refreshToken);

/**
 * GET /api/auth/logout
 */
authRouter.get("/logout", authController.logout);

/**
 * GET /api/auth/logout-all
 */
authRouter.get("/logout-all", authController.logoutAll);

/**
 * POST /api/auth/verify-email
 */
authRouter.post("/verify-email", verifyEmailLimiter, authController.verifyEmail);

/**
 * POST /api/auth/resend-otp
 */
authRouter.post("/resend-otp", resendOtpLimiter, authController.resendOTP);

/**
 * POST /api/auth/google
 */
authRouter.post("/google", oauthLimiter, authController.googleLogin);

/**
 * GET /api/auth/google-client-id
 */
authRouter.get("/google-client-id", authController.getGoogleClientId);

/**
 * POST /api/auth/github
 */
authRouter.post("/github", oauthLimiter, authController.githubLogin);


/**
 * GET /api/auth/github-client-id
 */
authRouter.get("/github-client-id", authController.getGithubClientId);

export default authRouter;

