const express = require("express");
const router = express.Router();
const rankingController = require("../controllers/rankingController");
const cardService = require("../services/cardService");
const rankingService = require("../services/rankingService");

// Home route
router.get("/", async (req, res) => {
  try {
    // Get two cards to compare
    const cards = await cardService.getCardPair();

    // Get top ranked cards
    const topRankings = await rankingService.getTopRankings(10);

    // Render with required data
    res.render("index", {
      title: "Card Art Voter",
      cards: cards || [],
      topRankings: topRankings || [],
    });
  } catch (error) {
    console.error("Error loading homepage:", error);
    res.status(500).render("error", {
      message: "Failed to load cards for voting",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
});

// Full Rankings page
router.get("/rankings", rankingController.displayRankings);

// API routes
router.use("/api", require("./api"));

module.exports = router;
