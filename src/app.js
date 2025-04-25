const express = require("express");
const app = express();
const path = require("path");
const mongoose = require("mongoose");
const expressLayouts = require("express-ejs-layouts");
require("dotenv").config();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(expressLayouts);
app.set("layout", "layouts/layout");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Import routes
const indexRouter = require("./routes/index");
const apiRouter = require("./routes/api");
const adminRouter = require("./routes/admin");

// Mount routes
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

// Override the default render method to always include card count
const originalRender = app.response.render;
app.response.render = async function (view, options, callback) {
  try {
    const count = await cardService.getTotalCardCount();
    options = options || {};
    options.cardCount = count; // This will override any existing cardCount

    // Call the original render with our enhanced options
    return originalRender.call(this, view, options, callback);
  } catch (error) {
    console.error("Error enhancing render with card count:", error);
    return originalRender.call(this, view, options, callback);
  }
};
