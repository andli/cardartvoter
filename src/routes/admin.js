const express = require("express");
const router = express.Router();
const { downloadAndImportCards } = require("../admin/importCards");

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
    const result = await downloadAndImportCards();
    res.json({
      success: true,
      message: `Import completed successfully: ${result.processed} cards processed, ${result.added} new cards added`,
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

module.exports = router; // Make sure this is included
