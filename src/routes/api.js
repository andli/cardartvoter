const express = require("express");
const router = express.Router();
const Card = require("../models/Card");
const voteController = require("../controllers/voteController");

// Replace the existing POST /vote route with our controller
router.post("/vote", voteController.submitVote);

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

// Artist search autocomplete endpoint
router.get("/search/artist/autocomplete", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) {
      return res.json([]);
    }

    // Create a case-insensitive regex for the search
    const searchRegex = new RegExp(query, "i");

    // Find distinct artists that match the search query
    const results = await Card.aggregate([
      { $match: { enabled: true, artist: searchRegex } },
      { $group: { _id: "$artist", name: { $first: "$artist" } } },
      { $sort: { name: 1 } },
      { $limit: 10 },
    ]);

    res.json(results.map((artist) => ({ name: artist.name })));
  } catch (error) {
    console.error("Error in artist search autocomplete:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Search for a specific artist
router.get("/search/artist", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) {
      return res.status(400).json({ message: "Search query too short" });
    }

    // Get all artists with their stats for comparison
    const allArtists = await Card.aggregate([
      { $match: { enabled: true, comparisons: { $gt: 0 } } },
      {
        $group: {
          _id: "$artist",
          name: { $first: "$artist" },
          avgRating: { $avg: "$rating" },
          cardCount: { $sum: 1 },
        },
      },
      { $sort: { avgRating: -1 } },
    ]);

    // Get stats for the specific artist
    const exactMatch = allArtists.find(
      (a) => a.name.toLowerCase() === query.toLowerCase()
    );
    const artist =
      exactMatch ||
      allArtists.find((a) =>
        a.name.toLowerCase().includes(query.toLowerCase())
      );

    if (!artist) {
      return res.status(404).json({ message: "Artist not found" });
    }

    // Calculate the artist's rank
    const artistRank = allArtists.findIndex((a) => a._id === artist._id) + 1;
    const totalArtists = allArtists.length;

    // Get some sample cards by this artist
    const sampleCards = await Card.find({
      enabled: true,
      artist: artist.name,
    })
      .sort({ rating: -1 })
      .limit(5)
      .select("name scryfallId rating setName")
      .lean();

    res.json({
      artist: artist.name,
      averageRating: artist.avgRating.toFixed(0),
      cardCount: artist.cardCount,
      rank: artistRank,
      totalArtists,
      sampleCards,
    });
  } catch (error) {
    console.error("Error in artist search:", error);
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
