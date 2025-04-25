const express = require("express");
const app = express();
const path = require("path");
const mongoose = require("mongoose");
const expressLayouts = require("express-ejs-layouts");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
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
  expires: 1000 * 60 * 60 * 24 * 7, // 1 week
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
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
    store: store,
    resave: false,
    saveUninitialized: true,
  })
);

// Import routes
const indexRouter = require("./routes/index");
const apiRouter = require("./routes/api");
const adminRouter = require("./routes/admin");

// ONLY AFTER the session middleware, include your routes
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

const cardService = require("./services/cardService");

// Override the default render method to always include card count and title
const originalRender = app.response.render;
app.response.render = async function (view, options, callback) {
  try {
    const count = await cardService.getTotalCardCount();
    options = options || {};
    options.cardCount = count; // This will override any existing cardCount

    // Add a default title if none is provided
    if (options.title === undefined) {
      options.title = "Card Art Voter"; // Default title
    }

    // Call the original render with our enhanced options
    return originalRender.call(this, view, options, callback);
  } catch (error) {
    console.error("Error enhancing render with card count:", error);
    return originalRender.call(this, view, options, callback);
  }
};
