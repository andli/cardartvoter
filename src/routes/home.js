const express = require("express");
const router = express.Router();
const homeController = require("../controllers/homeController"); // Import your controller
const rankingController = require("../controllers/rankingController");

// Use the controller function instead of the inline function
router.get("/", homeController.getHomePage);

// Full Rankings page
router.get("/rankings", rankingController.displayRankings);

// FAQ page
router.get("/faq", homeController.getFaqPage);

// Search page
router.get("/search", homeController.getSearchPage);

// API routes
router.use("/api", require("./api"));

module.exports = router;
