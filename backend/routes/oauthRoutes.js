const express = require("express");
const passport = require("passport");
const { signAccessToken } = require("../utils/token");

const router = express.Router();

router.get("/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      message: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
    });
  }

  return passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/api/auth/oauth/failure" }),
  (req, res) => {
    const token = signAccessToken(req.user);
    const frontendUrl = process.env.OAUTH_FRONTEND_REDIRECT || "http://localhost:3000";
    const payload = encodeURIComponent(JSON.stringify(req.user));
    return res.redirect(`${frontendUrl}/?token=${token}&user=${payload}`);
  }
);

router.get("/failure", (_req, res) => {
  res.status(401).json({ message: "OAuth login failed" });
});

module.exports = router;
