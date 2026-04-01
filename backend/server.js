const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const session = require("express-session");
const passport = require("passport");
const http = require("http");

const authRoutes = require("./routes/authRoutes");
const oauthRoutes = require("./routes/oauthRoutes");
const orderRoutes = require("./routes/orderRoutes");
const restaurantRoutes = require("./routes/restaurantRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const promoRoutes = require("./routes/promoRoutes");
const errorHandler = require("./middleware/errorHandler");
const { authenticateToken } = require("./middleware/authMiddleware");
const { authLimiter } = require("./middleware/rateLimiter");
const initDb = require("./config/initDb");
const configurePassport = require("./config/passport");
const { initSocket } = require("./utils/socket");

dotenv.config();

const app = express();
const server = http.createServer(app);

configurePassport();

app.use(cors());
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_session_secret_change_me",
    resave: false,
    saveUninitialized: false
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/auth/oauth", oauthRoutes);
app.use("/api/orders", authenticateToken, orderRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/reviews", authenticateToken, reviewRoutes);
app.use("/api/inventory", authenticateToken, inventoryRoutes);
app.use("/api/promos", promoRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    await initDb();
    initSocket(server);
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Database initialization failed", error.message);
    process.exit(1);
  }
}

bootstrap();
