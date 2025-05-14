const express = require("express");
const router = express.Router();
const Card = require("../models/Card");
const voteService = require("../services/voteService");

// Replace the existing POST /vote route with our controller
router.post("/vote", async (req, res) => {
  try {
    const { selectedCardId, otherCardId, pairId } = req.body;

    // Add detailed logging to understand the issue
    console.log("Vote request received:", {
      selectedCardId,
      otherCardId,
      pairId,
      sessionPair: req.session.currentPair
        ? {
            card1: req.session.currentPair.card1,
            card2: req.session.currentPair.card2,
            pairId: req.session.currentPair.pairId,
            isTargeted: req.session.currentPair.isTargeted,
          }
        : null,
    });

    // Basic validation
    if (!selectedCardId || !otherCardId) {
      return res.status(400).json({
        success: false,
        message: "Missing selected or other card ID",
      });
    }

    // Session validation with better handling for edge cases
    if (!req.session.currentPair) {
      console.log("No current pair in session - creating an implicit pair");

      // For robustness, create a temporary pair object if missing
      // This helps with page refreshes and other edge cases
      req.session.currentPair = {
        card1: selectedCardId,
        card2: otherCardId,
        timestamp: Date.now(),
        pairId: pairId,
        isImplicitlyCreated: true,
      };
    }

    // Special handling for targeted requests which might cause session issues
    const isTargetedRequest = req.session.currentPair.isTargeted;

    // Flexible validation to handle edge cases better
    let isValidVote = false;

    // Normal validation
    if (pairId === req.session.currentPair.pairId) {
      isValidVote = true;
    }
    // Special case: The cards match what's in the session but pairId doesn't
    else if (
      (req.session.currentPair.card1 === selectedCardId &&
        req.session.currentPair.card2 === otherCardId) ||
      (req.session.currentPair.card1 === otherCardId &&
        req.session.currentPair.card2 === selectedCardId)
    ) {
      console.log("Cards match but pair ID doesn't - allowing vote anyway");
      isValidVote = true;
    }
    // Special case: Targeted requests might have session issues
    else if (isTargetedRequest) {
      console.log("Targeted request with mismatched pair ID - allowing vote");
      isValidVote = true;
    }

    if (!isValidVote) {
      return res.status(400).json({
        success: false,
        message: "Invalid pair ID. Please refresh the page.",
      });
    }

    // Process the vote with service
    await voteService.processVote(selectedCardId, otherCardId);

    // Update vote history in session
    if (!req.session.voteHistory) {
      req.session.voteHistory = [];
    }
    req.session.voteHistory.unshift({
      selectedCardId,
      otherCardId,
      timestamp: Date.now(),
    });
    if (req.session.voteHistory.length > 20) {
      req.session.voteHistory = req.session.voteHistory.slice(0, 20);
    }

    // Clear the current pair to force a new pair next time
    req.session.currentPair = null;

    // Save the session explicitly to avoid race conditions
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({
      success: true,
      message: "Vote recorded successfully",
    });
  } catch (error) {
    console.error("Error processing vote:", error);
    res.status(500).json({
      success: false,
      message: "Server error while processing vote",
    });
  }
});

// Get a smart pair of cards for comparison
router.get("/cards/pair", async (req, res) => {
  try {
    const count = await Card.countDocuments({ enabled: true });

    if (count < 2) {
      return res.status(404).json({ message: "Not enough cards available" });
    }

    // First decide what type of pairing to do
    const randomValue = Math.random();

    // 10% of the time - completely random pairing (unchanged)
    if (randomValue < 0.1) {
      const randomCards = await Card.aggregate([
        { $match: { enabled: true } },
        { $sample: { size: 2 } },
      ]);
      return res.json(randomCards);
    }

    // 15% of the time - extreme rating pairing to test rating boundaries
    else if (randomValue < 0.25) {
      // Get cards with min requirements (5+ comparisons)
      const minComparisons = 5;

      // Decide which extreme pairing pattern to use
      const extremeType = Math.floor(Math.random() * 3);

      if (extremeType === 0) {
        // Pair two high-rated cards against each other
        const highCards = await Card.find({
          enabled: true,
          comparisons: { $gte: minComparisons },
        })
          .sort({ rating: -1 }) // Highest ratings first
          .limit(20) // Get top 20
          .lean();

        // Select 2 random cards from this high-rated pool
        const highPair = [
          highCards[Math.floor(Math.random() * Math.min(highCards.length, 10))],
          highCards[
            Math.floor(Math.random() * Math.min(highCards.length, 10)) + 10
          ],
        ];

        return res.json(highPair);
      } else if (extremeType === 1) {
        // Pair two low-rated cards against each other
        const lowCards = await Card.find({
          enabled: true,
          comparisons: { $gte: minComparisons },
        })
          .sort({ rating: 1 }) // Lowest ratings first
          .limit(20) // Get bottom 20
          .lean();

        // Select 2 random cards from this low-rated pool
        const lowPair = [
          lowCards[Math.floor(Math.random() * Math.min(lowCards.length, 10))],
          lowCards[
            Math.floor(Math.random() * Math.min(lowCards.length, 10)) + 10
          ],
        ];

        return res.json(lowPair);
      } else {
        // Pair a high-rated card against a low-rated card
        const highCard = await Card.findOne({
          enabled: true,
          comparisons: { $gte: minComparisons },
        })
          .sort({ rating: -1 }) // Highest rating
          .skip(Math.floor(Math.random() * 10));

        const lowCard = await Card.findOne({
          enabled: true,
          _id: { $ne: highCard._id }, // Ensure we don't pick the same card
          comparisons: { $gte: minComparisons },
        })
          .sort({ rating: 1 }) // Lowest rating
          .skip(Math.floor(Math.random() * 10));

        return res.json([highCard, lowCard]);
      }
    }

    // 75% of the time - use existing logic for selecting cards with fewer comparisons
    else {
      // Choose a card that has fewer comparisons (your existing code)
      const lessSeenCard = await Card.findOne({ enabled: true })
        .sort({ comparisons: 1, _id: 1 })
        .skip(Math.floor(Math.random() * 20)); // Some randomization

      if (!lessSeenCard) {
        return res.status(500).json({ message: "Error finding card" });
      }

      // Find another card with similar rating (within ~200 points)
      const rating = lessSeenCard.rating;
      const ratingMin = rating - 200;
      const ratingMax = rating + 200;

      const secondCard = await Card.findOne({
        _id: { $ne: lessSeenCard._id },
        enabled: true,
        rating: { $gte: ratingMin, $lte: ratingMax },
      }).skip(Math.floor(Math.random() * 10));

      // Fallback to a more different card if we couldn't find one close in rating
      if (!secondCard) {
        const fallbackCard = await Card.findOne({
          _id: { $ne: lessSeenCard._id },
          enabled: true,
        }).skip(Math.floor(Math.random() * 50));

        if (!fallbackCard) {
          return res.status(500).json({ message: "Error finding second card" });
        }

        return res.json([lessSeenCard, fallbackCard]);
      }

      return res.json([lessSeenCard, secondCard]);
    }
  } catch (error) {
    console.error("Error fetching card pair:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get top ranked cards
router.get("/cards/top", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const minComparisons = parseInt(req.query.minComparisons) || 5;

    const topCards = await Card.find({
      enabled: true,
      comparisons: { $gte: minComparisons },
    })
      .sort({ rating: -1 })
      .limit(limit);

    res.json(topCards);
  } catch (error) {
    console.error("Error fetching top cards:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Add a fallback route for card back thumbnail
router.get("/card-back-thumb", (req, res) => {
  res.set("Content-Type", "image/svg+xml");

  // Generate a simple SVG placeholder
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <rect width="40" height="40" rx="3" fill="#2a3f5f" />
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="12">Art</text>
    </svg>
  `;

  res.send(svg);
});

// Add a full-size card back
router.get("/card-back", (req, res) => {
  res.set("Content-Type", "image/svg+xml");

  // Generate a simple SVG placeholder
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="244" height="340" viewBox="0 0 244 340">
      <rect width="244" height="340" rx="10" fill="#2a3f5f" />
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="24">Card Art</text>
    </svg>
  `;

  res.send(svg);
});

// Add this debug route - remove in production
router.get("/debug/card-check", async (req, res) => {
  try {
    // Check for cards without scryfallId
    const missingIdCount = await Card.countDocuments({
      $or: [
        { scryfallId: { $exists: false } },
        { scryfallId: null },
        { scryfallId: "" },
      ],
    });

    // Get a sample card to check structure
    const sampleCard = await Card.findOne().lean();

    res.json({
      totalCards: await Card.countDocuments(),
      cardsWithoutScryfallId: missingIdCount,
      sampleCard,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this debug route to check if set icon files exist
router.get("/debug/set-icons", async (req, res) => {
  try {
    const fs = require("fs").promises;
    const path = require("path");

    const iconDir = path.join(__dirname, "../public/images/set-icons");

    try {
      // Try to list the directory contents
      const files = await fs.readdir(iconDir);

      // Return information about the directory
      res.json({
        success: true,
        message: `Found ${files.length} set icon files`,
        exampleFiles: files.slice(0, 10),
        iconDir: iconDir,
        nodeEnv: process.env.NODE_ENV || "development",
      });
    } catch (err) {
      res.json({
        success: false,
        message: `Error reading set icons directory: ${err.message}`,
        iconDir: iconDir,
        error: err.toString(),
        nodeEnv: process.env.NODE_ENV || "development",
      });
    }
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack:
        process.env.NODE_ENV === "production"
          ? "Hidden in production"
          : error.stack,
    });
  }
});

// API endpoint to get the Vercel Blob URL for a set icon
router.get("/set-icon-url", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: "Set code is required" });
    }

    const storage = require("../utils/storage");
    const url = await storage.getIconUrl(code);

    res.json({ url });
  } catch (error) {
    console.error("Error getting set icon URL:", error);
    res.status(500).json({ error: "Failed to get set icon URL" });
  }
});

// Search autocomplete endpoint
router.get("/search/autocomplete", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) {
      return res.json([]);
    }

    // Create a case-insensitive regex for the search
    const searchRegex = new RegExp(query, "i");

    // Find cards that match the search query
    const results = await Card.find({
      enabled: true,
      name: searchRegex,
    })
      .select("name scryfallId artist setName setCode")
      .sort("name")
      .limit(10)
      .lean();

    res.json(results);
  } catch (error) {
    console.error("Error in search autocomplete:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Search for a specific card by name
router.get("/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) {
      return res.status(400).json({ message: "Search query too short" });
    }

    // Create a case-insensitive regex for the search
    const searchRegex = new RegExp(query, "i");

    // Find the card that best matches the search query
    const card = await Card.findOne({
      enabled: true,
      name: searchRegex,
    })
      .sort("name")
      .lean();

    if (!card) {
      return res
        .status(404)
        .json({ message: "No card found matching that name" });
    }

    res.json(card);
  } catch (error) {
    console.error("Error in card search:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get ranking information for a specific card
router.get("/card/:scryfallId/ranking", async (req, res) => {
  try {
    const { scryfallId } = req.params;

    // Find the card by scryfallId
    const card = await Card.findOne({ scryfallId, enabled: true }).lean();

    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    // Get total cards for percentile calculation
    const totalCards = await Card.countDocuments({ enabled: true });

    // Get rank of the card (how many cards have higher rating)
    const higherRated = await Card.countDocuments({
      enabled: true,
      rating: { $gt: card.rating },
    });

    // Add 1 to get the actual rank (1-based indexing)
    const rank = higherRated + 1;

    res.json({
      card,
      ranking: {
        rank,
        totalCards,
      },
    });
  } catch (error) {
    console.error("Error getting card ranking:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
