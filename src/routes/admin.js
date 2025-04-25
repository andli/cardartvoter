const express = require("express");
const router = express.Router();
const { importSetWithRateLimiting } = require("../admin/importCards");
const Card = require("../models/Card"); // Add this line to import the Card model

// Simple admin auth middleware
const adminAuth = (req, res, next) => {
  if (req.query.key === process.env.ADMIN_KEY) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
};

// Modified route to import cards by set (works within serverless limits)
router.post("/import-set", adminAuth, async (req, res) => {
  try {
    const setCode = req.body.set || req.query.set;

    if (!setCode) {
      return res.status(400).json({
        success: false,
        message: "Set code is required (e.g. ?set=woe for Wilds of Eldraine)",
      });
    }

    console.log(`Starting import for set: ${setCode}`);
    const added = await importSetWithRateLimiting(setCode);

    res.json({
      success: true,
      message: `Successfully imported ${added} cards from set ${setCode}`,
      added,
    });
  } catch (error) {
    console.error("Import failed:", error);
    res.status(500).json({
      success: false,
      message: "Import failed",
      error: error.message,
    });
  }
});

// Keep the original route for local development only
router.post("/import-cards", adminAuth, async (req, res) => {
  res.json({
    success: false,
    message:
      "Bulk import is disabled on Vercel due to serverless function limitations. Please use /admin/import-set?set=CODE instead.",
  });
});

// Test route to check if admin route is working
router.get("/test", (req, res) => {
  res.json({ message: "Admin route is working" });
});

// Add this route to your existing admin.js file

// Initialize or refresh stats
router.post("/refresh-stats", adminAuth, async (req, res) => {
  try {
    console.log("Admin request to refresh statistics counts");

    const statsService = require("../services/statsService");

    // Use the updated methods with proper error handling
    const cardCount = await statsService.getCardCount(true);
    console.log(`Refreshed card count: ${cardCount}`);

    const voteCount = await statsService.getVoteCount(true);
    console.log(`Refreshed vote count: ${voteCount}`);

    res.json({
      success: true,
      message: "Statistics refreshed successfully",
      stats: {
        cardCount,
        voteCount,
      },
    });
  } catch (error) {
    console.error("Error refreshing stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh statistics",
      error: error.message,
    });
  }
});

module.exports = router;
