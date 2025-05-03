const express = require("express");
const app = express();
const path = require("path");
const mongoose = require("mongoose");
const expressLayouts = require("express-ejs-layouts");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const appConfig = require("./config/app");
require("dotenv").config();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(expressLayouts);
app.set("layout", "layouts/layout");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Set up MongoDB session store
const store = new MongoDBStore({
  uri: process.env.MONGODB_URI,
  collection: "sessions",
  expires: appConfig.session.storeExpiry, // Use centralized config
});

// Handle errors with the store
store.on("error", function (error) {
  console.error("Session store error:", error);
});

// Initialize session middleware
app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "secure-random-string-for-cardartvoter",
    cookie: {
      maxAge: appConfig.session.cookieMaxAge, // Use centralized config
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // Changed back to "lax" for better security
      httpOnly: true,
    },
    store: store,
    resave: false,
    saveUninitialized: true,
  })
);

// Import routes
const indexRouter = require("./routes/home");
const apiRouter = require("./routes/api");
const adminRouter = require("./routes/admin");

// Move this BEFORE your route registrations
// Add near where you set up your other middleware (before routes)
const storage = require("./utils/storage");

// Modify the middleware to use the storage utility instead of hardcoded URLs
app.use(async (req, res, next) => {
  const storage = require("./utils/storage");

  // Use an async function that will use the storage utility with fallbacks
  res.locals.getSetIconUrl = async (code) => {
    if (!code) return "/images/default-set-icon.svg";
    return await storage.getIconUrl(code);
  };

  // Provide a synchronous version with Scryfall fallback for immediate rendering
  res.locals.getSetIconUrlSync = (code) => {
    if (!code) return "/images/default-set-icon.svg";
    // Use local path but allow image error handler to fallback to Scryfall
    return `/images/set-icons/${code.toLowerCase()}.svg`;
  };

  next();
});

// AFTER middleware, then register your routes
app.use("/", indexRouter);
app.use("/api", apiRouter);
app.use("/admin", adminRouter);

// Database connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Import helper functions
const imageHelpers = require("./utils/imageHelpers");

// Make helper functions available in all templates
app.locals.getArtCropUrl = imageHelpers.getArtCropUrl;
app.locals.getSmallCardUrl = imageHelpers.getSmallCardUrl;
app.locals.getCardUrl = imageHelpers.getCardUrl;

const statsService = require("./services/statsService");

// Override the default render method
const originalRender = app.response.render;
app.response.render = async function (view, options, callback) {
  try {
    // Get counts with auto-refresh when stale
    const [cardCount, voteCount] = await Promise.all([
      statsService.getCardCount(),
      statsService.getVoteCount(),
    ]);

    options = options || {};
    options.cardCount = cardCount;
    options.voteCount = voteCount;
    options.title = options.title || "Card Art Voter";

    return originalRender.call(this, view, options, callback);
  } catch (error) {
    console.error("Error enhancing render with stats:", error);
    return originalRender.call(this, view, options, callback);
  }
};

// Add this with your other static middleware
app.use(
  "/favicon.ico",
  express.static(path.join(__dirname, "public", "images", "favicon.ico"))
);
