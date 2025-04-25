const express = require("express");
const router = express.Router();
const Card = require("../models/Card");

// Get a smart pair of cards for comparison
router.get("/cards/pair", async (req, res) => {
  try {
    const count = await Card.countDocuments({ enabled: true });

    if (count < 2) {
      return res.status(404).json({ message: "Not enough cards available" });
    }

    // Occasionally choose a completely random pair (10% of the time)
    if (Math.random() < 0.1) {
      const randomCards = await Card.aggregate([
        { $match: { enabled: true } },
        { $sample: { size: 2 } },
      ]);

      return res.json(randomCards);
    }

    // Choose a card that has fewer comparisons
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
  } catch (error) {
    console.error("Error fetching card pair:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Submit a vote between two cards
router.post("/vote", async (req, res) => {
  try {
    const { selectedCardId, cardId } = req.body;

    // Validate input
    if (!selectedCardId || !cardId) {
      return res.status(400).json({ message: "Missing required card IDs" });
    }

    // Use findOne with scryfallId instead of findById
    const winningCard = await Card.findOne({ scryfallId: selectedCardId });
    const losingCard = await Card.findOne({ scryfallId: cardId });

    if (!winningCard || !losingCard) {
      return res.status(404).json({
        message: "One or both cards not found",
        winningCardFound: !!winningCard,
        losingCardFound: !!losingCard,
      });
    }

    // Determine K-factor based on number of comparisons
    const getKFactor = (comparisons) => {
      if (comparisons < 10) return 64; // New cards
      if (comparisons < 30) return 32; // Establishing cards
      if (comparisons < 100) return 24; // Established cards
      return 16; // Well-established cards
    };

    const winnerK = getKFactor(winningCard.comparisons);
    const loserK = getKFactor(losingCard.comparisons);

    // Calculate expected scores
    const ratingDiff = losingCard.rating - winningCard.rating;
    const expectedWinner = 1 / (1 + Math.pow(10, ratingDiff / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, -ratingDiff / 400));

    // Calculate new ratings
    const oldWinnerRating = winningCard.rating;
    const oldLoserRating = losingCard.rating;

    winningCard.rating = Math.round(
      winningCard.rating + winnerK * (1 - expectedWinner)
    );
    losingCard.rating = Math.round(
      losingCard.rating + loserK * (0 - expectedLoser)
    );

    // Track the number of comparisons
    winningCard.comparisons += 1;
    losingCard.comparisons += 1;

    // Save changes
    await winningCard.save();
    await losingCard.save();

    // Return the rating changes
    res.json({
      winner: {
        id: winningCard._id,
        name: winningCard.name,
        oldRating: oldWinnerRating,
        newRating: winningCard.rating,
        change: winningCard.rating - oldWinnerRating,
      },
      loser: {
        id: losingCard._id,
        name: losingCard.name,
        oldRating: oldLoserRating,
        newRating: losingCard.rating,
        change: losingCard.rating - oldLoserRating,
      },
    });
  } catch (error) {
    console.error("Error processing vote:", error);
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

module.exports = router;
