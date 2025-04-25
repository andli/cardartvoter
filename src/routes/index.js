const express = require("express");
const router = express.Router();
const indexController = require("../controllers/index"); // Import your controller
const rankingController = require("../controllers/rankingController");

// Use the controller function instead of the inline function
router.get("/", indexController.getHomePage);

// Full Rankings page
router.get("/rankings", rankingController.displayRankings);

// API routes
router.use("/api", require("./api"));

module.exports = router;
