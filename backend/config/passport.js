const passport = require("passport");
const bcrypt = require("bcryptjs");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const db = require("./db");

function configurePassport() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/auth/oauth/google/callback";

  if (!clientID || !clientSecret) {
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName || "Google User";

          if (!email) {
            return done(new Error("Google account email not available"));
          }

          const [existing] = await db.query(
            "SELECT id, name, email FROM users WHERE email = ? LIMIT 1",
            [email]
          );

          if (existing.length > 0) {
            return done(null, existing[0]);
          }

          const tempPassword = await bcrypt.hash(`oauth_${profile.id}_${Date.now()}`, 10);
          const [result] = await db.query(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [name, email, tempPassword]
          );

          return done(null, {
            id: result.insertId,
            name,
            email
          });
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
}

module.exports = configurePassport;
