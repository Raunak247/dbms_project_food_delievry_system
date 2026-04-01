const jwt = require("jsonwebtoken");

function signAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name
    },
    process.env.JWT_SECRET || "dev_jwt_secret_change_me",
    { expiresIn: "7d" }
  );
}

module.exports = {
  signAccessToken
};
