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

// Submit a vote between two cards
router.post("/vote", async (req, res) => {
  try {
    const { selectedCardId, pairId, otherCardId } = req.body;

    // Check required parameters - we need both the selected card and the pair ID
    if (!selectedCardId || !pairId) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    // Get the selected card
    const selectedCard = await Card.findOne({ scryfallId: selectedCardId });
    
    if (!selectedCard) {
      return res.status(404).json({ message: "Selected card not found" });
    }
    
    // Get the other card in the pair - either from the request body or from the session
    let otherCard;
    
    // If the client explicitly provided the other card ID
    if (otherCardId) {
      otherCard = await Card.findOne({ scryfallId: otherCardId });
    }
    // Try to get the other card from the session
    else if (req.session.currentPair && 
        (req.session.currentPair.card1 === selectedCardId || req.session.currentPair.card2 === selectedCardId)) {
      // Get the other card ID from the pair
      const otherCardScryfallId = 
        req.session.currentPair.card1 === selectedCardId 
          ? req.session.currentPair.card2 
          : req.session.currentPair.card1;
      
      otherCard = await Card.findOne({ scryfallId: otherCardScryfallId });
    }
    
    // If we still don't have the other card, try to find any other card as a fallback
    if (!otherCard) {
      console.warn("Could not find the other card in the pair, using fallback method");
      otherCard = await Card.findOne({ 
        scryfallId: { $ne: selectedCardId }, 
        enabled: true 
      });
    }

    if (!otherCard) {
      return res.status(404).json({ message: "Could not find the other card in the pair" });
    }

    // Set the winning and losing cards based on the vote
    const winningCard = selectedCard;
    const losingCard = otherCard;

    // Determine K-factor based on combined comparison counts
    const getKFactor = (winnerComps, loserComps) => {
      const avgComps = (winnerComps + loserComps) / 2;
      if (avgComps < 10) return 48; // New cards (reduced from 64)
      if (avgComps < 30) return 32; // Establishing cards
      if (avgComps < 100) return 24; // Established cards
      return 16; // Well-established cards
    };

    // Use a single K factor for both cards
    const K = getKFactor(winningCard.comparisons, losingCard.comparisons);

    // Calculate expected scores with simpler approach
    const ratingDiff = winningCard.rating - losingCard.rating;
    const expectedWinner = 1 / (1 + Math.pow(10, -ratingDiff / 400));
    const expectedLoser = 1 - expectedWinner;

    // Calculate new ratings using the same K
    const ratingChange = Math.round(K * (1 - expectedWinner));
    winningCard.rating = Math.max(
      1000,
      Math.min(2000, winningCard.rating + ratingChange)
    );
    losingCard.rating = Math.max(
      1000,
      Math.min(2000, losingCard.rating - ratingChange)
    );

    // Track the number of comparisons
    winningCard.comparisons += 1;
    losingCard.comparisons += 1;

    // Save changes
    await winningCard.save();
    await losingCard.save();

    // Get a new card pair for the next round
    const newPair = await Card.aggregate([
      { $match: { enabled: true } },
      { $sample: { size: 2 } },
    ]);

    // Generate a new pair ID
    const newPairId = require("crypto").randomBytes(16).toString("hex");

    // Store the new pair in session
    req.session.currentPair = {
      card1: newPair[0].scryfallId,
      card2: newPair[1].scryfallId,
      timestamp: Date.now(),
      pairId: newPairId,
    };

    // Return ONE response with all the data
    return res.json({
      success: true,
      result: {
        winner: {
          id: winningCard._id,
          name: winningCard.name,
          oldRating: winningCard.rating - ratingChange,
          newRating: winningCard.rating,
          change: ratingChange,
        },
        loser: {
          id: losingCard._id,
          name: losingCard.name,
          oldRating: losingCard.rating + ratingChange,
          newRating: losingCard.rating,
          change: -ratingChange,
        },
      },
      newPair: {
        cards: newPair,
        pairId: newPairId,
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
