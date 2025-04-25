const express = require("express");
const router = express.Router();
const { importCardsWithRateLimiting } = require("../admin/importCards");

// Simple admin auth middleware
const adminAuth = (req, res, next) => {
  if (req.query.key === process.env.ADMIN_KEY) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
};

// Admin route to trigger card import
router.post("/import-cards", adminAuth, async (req, res) => {
  try {
    // Use the correct function name and pass a query parameter
    const query = req.body.query || req.query.query || "is:booster -is:digital";

    console.log(`Starting import with query: ${query}`);
    const added = await importCardsWithRateLimiting(query);

    res.json({
      success: true,
      message: `Import completed successfully: ${added} new cards added`,
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

// Test route to check if admin route is working
router.get("/test", (req, res) => {
  res.json({ message: "Admin route is working" });
});

module.exports = router;
