import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import config from "../config/config.js";
import userModel from "../models/user.model.js";
import otpModel from "../models/otp.model.js";
import sessionModel from "../models/session.model.js";
import { sendEmail } from "../services/email.service.js";
import { generateOtp, getOtphtml } from "../utils/utils.js";
import { syncUserToMySQL, checkPassword, validEmail } from "../utils/helpers.js";

// ✅ REGISTER
export async function register(req, res) {
  try {
    let { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, email, and password are required" });
    }

    username = String(username).trim();
    if (username.length < 2 || username.length > 100) {
      return res.status(400).json({ message: "Username must be between 2 and 100 characters" });
    }

    email = String(email).toLowerCase().trim();
    if (!validEmail(email)) {
      return res.status(400).json({ message: "A valid email address (max 254 characters) is required" });
    }

    try {
      checkPassword(password);
    } catch (pwErr) {
      return res.status(400).json({ message: pwErr.message });
    }

    // 🔍 Check existing user
    const isAlreadyRegistered = await userModel.findOne({
      $or: [{ username }, { email }],
    });

    if (isAlreadyRegistered) {
      return res.status(409).json({
        message: "username or email already exists",
      });
    }

    // 🔐 Hash password with bcrypt (10 rounds)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if this is the first user; if so, make them Admin
    const userCount = await userModel.countDocuments();
    const role = userCount === 0 ? "Admin" : "Member";

    // 👤 Create user in MongoDB with password history initialized
    const user = await userModel.create({
      username,
      email,
      password: hashedPassword,
      passwordHistory: [hashedPassword],
      role,
      verified: false,
    });

    // Delete old OTPs if any
    await otpModel.deleteMany({ email });

    // Generate 6-digit OTP
    const otp = generateOtp();
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Dev] Generated OTP for ${email}: ${otp}`);
    } else {
      console.log(`[Auth] OTP generated for ${email}`);
    }
    const html = getOtphtml(otp);

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    await otpModel.create({
      email,
      user: user._id,
      otpHash,
    });

    // Send verification email via Nodemailer Google OAuth2
    try {
      await sendEmail(email, "Verify your email - DevFlow OTP Verification", `Your OTP is ${otp}`, html);
    } catch (emailErr) {
      console.error("Failed to send OTP email:", emailErr.message);
    }

    // ✅ Response
    res.status(201).json({
      message: "user registered successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        verified: user.verified,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
}

// ✅ LOGIN
export async function login(req, res) {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    if (typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ message: "Password exceeds maximum permitted length of 128 characters" });
    }

    email = String(email).toLowerCase().trim();

    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Check account-aware lockout state
    if (user.isLocked && user.isLocked()) {
      return res.status(429).json({
        message: "Account is temporarily locked due to multiple failed login attempts. Please try again after 15 minutes.",
      });
    }

    if (!user.verified) {
      return res.status(401).json({
        message: "Please verify your email before logging in",
      });
    }

    let isPasswordValid = false;
    if (user.password.startsWith('$2')) {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } else {
      // Legacy SHA-256 fallback & auto-upgrade
      const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");
      if (hashedPassword === user.password) {
        isPasswordValid = true;
        // Upgrade to bcrypt asynchronously
        bcrypt.hash(password, 10).then(newHash => {
          userModel.findByIdAndUpdate(user._id, { password: newHash }).exec();
        }).catch(() => {});
      }
    }

    if (!isPasswordValid) {
      if (user.incrementFailedAttempts) {
        await user.incrementFailedAttempts();
      }
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Reset failed attempts upon successful authentication
    if (user.resetFailedAttempts) {
      await user.resetFailedAttempts();
    }


    // Sync user with MySQL users table for foreign-key integrity in workspace
    const mysqlId = await syncUserToMySQL(user);

    // 7-day Refresh Token
    const refreshToken = jwt.sign(
      { id: user._id },
      config.JWT_SECRET,
      { expiresIn: "7d" }
    );
    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    // Save session in MongoDB
    const session = await sessionModel.create({
      user: user._id,
      refreshTokenHash,
      ip: req.ip || req.connection.remoteAddress || "127.0.0.1",
      userAgent: req.headers["user-agent"] || "browser",
    });

    // 15-minute Access Token
    const accessToken = jwt.sign(
      {
        id: user._id,
        mysql_id: mysqlId,
        sessionId: session._id,
        email: user.email,
        role: user.role || "Member",
      },
      config.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // Set HTTP-Only Cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      message: "Logged in successfully",
      user: {
        id: mysqlId || user._id,
        user_id: mysqlId || user._id,
        mongo_id: user._id,
        username: user.username,
        name: user.username,
        email: user.email,
        role: user.role || "Member",
        designation: user.designation || "",
        verified: user.verified,
      },
      accessToken,
      token: accessToken, // for backward-compatible frontend consumers
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
}

// ✅ GET ME (Current User Info)
export async function getMe(req, res) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "token not found",
      });
    }

    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return res.status(401).json({
        message: "Invalid token format",
      });
    }

    const token = parts[1];
    const decoded = jwt.verify(token, config.JWT_SECRET);

    // Fetch user from MongoDB without password
    const user = await userModel.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const mysqlId = decoded.mysql_id || (await syncUserToMySQL(user));

    res.status(200).json({
      message: "User fetched successfully",
      user: {
        id: mysqlId || user._id,
        user_id: mysqlId || user._id,
        mongo_id: user._id,
        username: user.username,
        name: user.username,
        email: user.email,
        role: user.role || "Member",
        designation: user.designation || "",
        verified: user.verified,
      },
    });
  } catch (error) {
    res.status(401).json({
      message: "Invalid token",
      error: error.message,
    });
  }
}

// ✅ REFRESH TOKEN
export async function refreshToken(req, res) {
  try {
    const rToken = req.cookies.refreshToken;

    if (!rToken) {
      return res.status(401).json({
        message: "Refresh token not found",
      });
    }

    const decoded = jwt.verify(rToken, config.JWT_SECRET);
    const refreshTokenHash = crypto.createHash("sha256").update(rToken).digest("hex");

    // Check non-revoked session in MongoDB
    const session = await sessionModel.findOne({
      refreshTokenHash,
      revoked: false,
    });

    if (!session) {
      return res.status(401).json({
        message: "Session not found or invalid",
      });
    }

    const user = await userModel.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Create new Access Token
    const accessToken = jwt.sign(
      {
        id: user._id,
        sessionId: session._id,
        email: user.email,
        role: user.role || "Member",
      },
      config.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // Rotate Refresh Token
    const newRefreshToken = jwt.sign(
      { id: user._id },
      config.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const newRefreshTokenHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");
    session.refreshTokenHash = newRefreshTokenHash;
    await session.save();

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "Access token refreshed successfully",
      accessToken,
      token: accessToken,
    });
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired refresh token",
      error: error.message,
    });
  }
}

// ✅ LOGOUT
export async function logout(req, res) {
  try {
    const rToken = req.cookies.refreshToken;

    if (rToken) {
      const refreshTokenHash = crypto.createHash("sha256").update(rToken).digest("hex");
      const session = await sessionModel.findOne({
        refreshTokenHash,
        revoked: false,
      });

      if (session) {
        session.revoked = true;
        await session.save();
      }
    }

    res.clearCookie("refreshToken");

    return res.status(200).json({
      message: "Logged Out Successfully",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
}

// ✅ LOGOUT ALL DEVICES
export async function logoutAll(req, res) {
  try {
    const rToken = req.cookies.refreshToken;

    if (!rToken) {
      return res.status(400).json({
        message: "Refresh token not found",
      });
    }

    const decoded = jwt.verify(rToken, config.JWT_SECRET);

    await sessionModel.updateMany(
      { user: decoded.id, revoked: false },
      { revoked: true }
    );

    res.clearCookie("refreshToken");

    return res.status(200).json({
      message: "Logged Out From all devices Successfully",
    });
  } catch (error) {
    res.status(401).json({ message: "Invalid token", error: error.message });
  }
}

// ✅ VERIFY EMAIL (WITH OTP)
export async function verifyEmail(req, res) {
  try {
    let { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    email = email.toLowerCase().trim();

    const otpHash = crypto
      .createHash("sha256")
      .update(String(otp).trim())
      .digest("hex");

    console.log("Verifying OTP for:", email);

    const otpRecord = await otpModel.findOne({
      email,
      otpHash,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    // Update user to verified
    const user = await userModel.findByIdAndUpdate(
      otpRecord.user,
      { verified: true },
      { new: true }
    );

    // Delete verified OTP record
    await otpRecord.deleteOne();

    // Sync newly verified user with MySQL users table
    const mysqlId = await syncUserToMySQL(user);

    return res.status(200).json({
      message: "Email verified successfully",
      user: {
        id: mysqlId || user._id,
        user_id: mysqlId || user._id,
        mongo_id: user._id,
        username: user.username,
        email: user.email,
        verified: user.verified,
        role: user.role || "Member",
      },
    });
  } catch (error) {
    console.error("Verify Email Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
}

// ✅ RESEND OTP
export async function resendOTP(req, res) {
  try {
    let { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    email = email.toLowerCase().trim();

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.verified) {
      return res.status(400).json({
        message: "Email already verified",
      });
    }

    // Delete old OTPs
    await otpModel.deleteMany({ email });

    // Generate new OTP
    const otp = generateOtp();
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Dev] Resent OTP for ${email}: ${otp}`);
    } else {
      console.log(`[Auth] OTP resent for ${email}`);
    }
    const html = getOtphtml(otp);

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    await otpModel.create({
      email,
      user: user._id,
      otpHash,
    });

    try {
      await sendEmail(email, "Verify your email - DevFlow OTP Verification", `Your OTP is ${otp}`, html);
    } catch (err) {
      console.error("Error sending resend OTP email:", err.message);
    }

    res.status(200).json({
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
}

// ✅ GOOGLE LOGIN
export async function googleLogin(req, res) {
  try {
    const { credential, token, accessToken } = req.body;
    const idToken = credential || token;

    if (!idToken && !accessToken) {
      return res.status(400).json({ message: "Google credential or token is required" });
    }

    let googleUser = null;

    if (idToken) {
      // Verify Google ID Token via Google's tokeninfo endpoint
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
      if (!response.ok) {
        const errText = await response.text();
        console.error("Google token verification failed:", errText);
        return res.status(401).json({ message: "Invalid or expired Google credential" });
      }
      googleUser = await response.json();
    } else if (accessToken) {
      // Verify via Google userinfo endpoint
      const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        return res.status(401).json({ message: "Invalid Google access token" });
      }
      googleUser = await response.json();
    }

    if (!googleUser || !googleUser.email) {
      return res.status(400).json({ message: "Could not retrieve email from Google profile" });
    }

    const email = googleUser.email.toLowerCase().trim();
    const name = googleUser.name || googleUser.given_name || email.split("@")[0];

    // Find existing user by email
    let user = await userModel.findOne({ email });

    if (!user) {
      // Generate a unique clean username
      let baseUsername = name.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() || email.split("@")[0];
      if (baseUsername.length < 3) baseUsername = `user_${baseUsername}`;
      let username = baseUsername;
      let counter = 1;
      while (await userModel.findOne({ username })) {
        username = `${baseUsername}${counter++}`;
      }

      // Secure random password for Google-authenticated user
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await userModel.create({
        username,
        email,
        password: hashedPassword,
        verified: true, // Google pre-verifies email
        role: "Member",
        designation: "Google Member",
        avatar: googleUser.picture || "",
        googleId: googleUser.sub || null,
        authProvider: "google",
      });
    } else {
      // If user was not verified yet, Google login proves email ownership
      let needsSave = false;
      if (!user.verified) {
        user.verified = true;
        needsSave = true;
      }
      if (!user.googleId && googleUser.sub) {
        user.googleId = googleUser.sub;
        needsSave = true;
      }
      if (googleUser.picture && !user.avatar) {
        user.avatar = googleUser.picture;
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
      }
    }

    // Sync user with MySQL users table for workspace foreign keys
    const mysqlId = await syncUserToMySQL(user);

    // 7-day Refresh Token
    const refreshToken = jwt.sign(
      { id: user._id },
      config.JWT_SECRET,
      { expiresIn: "7d" }
    );
    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    // Save session in MongoDB
    const session = await sessionModel.create({
      user: user._id,
      refreshTokenHash,
      ip: req.ip || req.connection.remoteAddress || "127.0.0.1",
      userAgent: req.headers["user-agent"] || "google-auth",
    });

    // 15-minute Access Token
    const appAccessToken = jwt.sign(
      {
        id: user._id,
        mysql_id: mysqlId,
        sessionId: session._id,
        email: user.email,
        role: user.role || "Member",
      },
      config.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // Set HTTP-Only Cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Logged in with Google successfully",
      user: {
        id: mysqlId || user._id,
        user_id: mysqlId || user._id,
        mongo_id: user._id,
        username: user.username,
        name: user.username,
        email: user.email,
        role: user.role || "Member",
        designation: user.designation || "",
        verified: user.verified,
        picture: googleUser.picture || null,
        avatar: user.avatar || googleUser.picture || null,
      },
      accessToken: appAccessToken,
      token: appAccessToken,
    });
  } catch (error) {
    console.error("Google Login Error:", error);
    res.status(500).json({
      message: "Google login server error",
      error: error.message,
    });
  }
}

// ✅ GET GOOGLE CLIENT ID
export function getGoogleClientId(req, res) {
  res.status(200).json({
    clientId: config.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "",
  });
}

// ✅ GITHUB LOGIN
export async function githubLogin(req, res) {
  try {
    const { code, redirectUri } = req.body;

    if (!code) {
      return res.status(400).json({ message: "GitHub authorization code is required" });
    }

    if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET) {
      return res.status(400).json({
        message: "GitHub OAuth is not configured on the server. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in backend/.env.",
      });
    }

    // Exchange authorization code for GitHub access token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: config.GITHUB_CLIENT_ID,
        client_secret: config.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error("GitHub access token exchange error:", tokenData);
      return res.status(401).json({
        message: tokenData.error_description || "Failed to exchange GitHub authorization code",
      });
    }

    const githubAccessToken = tokenData.access_token;

    // Fetch user profile from GitHub API
    const userProfileRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${githubAccessToken}`,
        "User-Agent": "DevFlow-App",
      },
    });

    if (!userProfileRes.ok) {
      return res.status(401).json({ message: "Failed to fetch GitHub profile" });
    }

    const githubProfile = await userProfileRes.json();
    let email = githubProfile.email;

    // If email is null/private, fetch emails from GitHub user/emails endpoint
    if (!email) {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${githubAccessToken}`,
          "User-Agent": "DevFlow-App",
        },
      });

      if (emailsRes.ok) {
        const emails = await emailsRes.json();
        const primaryEmail = emails.find(e => e.primary && e.verified) || emails.find(e => e.verified) || emails[0];
        if (primaryEmail) {
          email = primaryEmail.email;
        }
      }
    }

    if (!email) {
      email = `${githubProfile.login.toLowerCase()}@users.noreply.github.com`;
    }

    email = email.toLowerCase().trim();
    const name = githubProfile.name || githubProfile.login;

    // Find existing user by githubId or email
    let user = await userModel.findOne({
      $or: [{ githubId: String(githubProfile.id) }, { email }],
    });

    if (!user) {
      let baseUsername = (githubProfile.login || name).replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
      if (baseUsername.length < 3) baseUsername = `gh_${baseUsername}`;
      let username = baseUsername;
      let counter = 1;
      while (await userModel.findOne({ username })) {
        username = `${baseUsername}${counter++}`;
      }

      const randomPassword = crypto.randomBytes(32).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await userModel.create({
        username,
        email,
        password: hashedPassword,
        verified: true,
        role: "Member",
        designation: "GitHub Member",
        avatar: githubProfile.avatar_url || "",
        githubId: String(githubProfile.id),
        authProvider: "github",
      });
    } else {
      let needsSave = false;
      if (!user.verified) {
        user.verified = true;
        needsSave = true;
      }
      if (!user.githubId) {
        user.githubId = String(githubProfile.id);
        needsSave = true;
      }
      if (githubProfile.avatar_url && !user.avatar) {
        user.avatar = githubProfile.avatar_url;
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
      }
    }

    // Sync user with MySQL users table
    const mysqlId = await syncUserToMySQL(user);

    // 7-day Refresh Token
    const refreshToken = jwt.sign(
      { id: user._id },
      config.JWT_SECRET,
      { expiresIn: "7d" }
    );
    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    // Save session in MongoDB
    const session = await sessionModel.create({
      user: user._id,
      refreshTokenHash,
      ip: req.ip || req.connection.remoteAddress || "127.0.0.1",
      userAgent: req.headers["user-agent"] || "github-auth",
    });

    // 15-minute Access Token
    const appAccessToken = jwt.sign(
      {
        id: user._id,
        mysql_id: mysqlId,
        sessionId: session._id,
        email: user.email,
        role: user.role || "Member",
      },
      config.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // Set HTTP-Only Cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Logged in with GitHub successfully",
      user: {
        id: mysqlId || user._id,
        user_id: mysqlId || user._id,
        mongo_id: user._id,
        username: user.username,
        name: user.username,
        email: user.email,
        role: user.role || "Member",
        designation: user.designation || "",
        verified: user.verified,
        picture: githubProfile.avatar_url || user.avatar || null,
        avatar: githubProfile.avatar_url || user.avatar || null,
      },
      accessToken: appAccessToken,
      token: appAccessToken,
    });
  } catch (error) {
    console.error("GitHub Login Error:", error);
    res.status(500).json({
      message: "GitHub login server error",
      error: error.message,
    });
  }
}

// ✅ GET GITHUB CLIENT ID
export function getGithubClientId(req, res) {
  res.status(200).json({
    clientId: config.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID || "",
  });
}
