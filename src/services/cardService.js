// This file contains business logic related to card operations, such as fetching cards from the Scryfall API.

const Card = require("../models/Card");

/**
 * Get a pair of cards for voting comparison
 * Supports targeting by card ID
 */
exports.getCardPair = async (targetCardId = null) => {
  try {
    // ID-based targeting
    if (targetCardId) {
      console.log(`Targeting card by ID: ${targetCardId}`);
      const targetCard = await Card.findOne({
        scryfallId: targetCardId,
        enabled: true,
      }).lean();

      if (targetCard) {
        console.log(`Found target card by ID: ${targetCard.name}`);

        // Get a completely random second card using aggregate with $sample
        const randomCards = await Card.aggregate([
          {
            $match: {
              enabled: true,
              _id: { $ne: targetCard._id },
            },
          },
          { $sample: { size: 1 } },
        ]);

        if (randomCards && randomCards.length > 0) {
          return [targetCard, randomCards[0]];
        } else {
          console.log(`No other cards found to pair with ${targetCard.name}`);
        }
      } else {
        console.log(
          `Card with ID ${targetCardId} not found, using normal selection`
        );
      }
    }

    // If we get here, either no target was specified or it wasn't found
    // Use the existing card selection logic...

    // Random number to determine selection strategy
    const strategy = Math.random();

    // Strategy 1 (30%): Target top-rated cards for challenging
    if (strategy < 0.3) {
      // Get a card from the top 20
      const topCards = await Card.find({ enabled: true })
        .sort({ rating: -1 })
        .limit(20)
        .lean();

      // Select one random top card
      const featuredCard =
        topCards[Math.floor(Math.random() * topCards.length)];

      // Find a worthy challenger (from the top 100, but not in top 20)
      const challenger = await Card.aggregate([
        {
          $match: {
            enabled: true,
            _id: { $ne: featuredCard._id },
            rating: { $lt: featuredCard.rating }, // Must be lower rated
          },
        },
        { $sort: { rating: -1 } },
        { $skip: 20 }, // Skip the very top cards
        { $limit: 80 }, // Take the next 80 cards (21-100 in rankings)
        { $sample: { size: 1 } }, // Pick one randomly
      ]).then((results) => results[0]);

      return [featuredCard, challenger];
    }
    // Strategy 2 (30%): Pure random selection
    else if (strategy < 0.6) {
      const randomCards = await Card.aggregate([
        { $match: { enabled: true } },
        { $sample: { size: 2 } },
      ]);
      return randomCards;
    }
    // Strategy 3 (40%): Focus on under-represented cards (your existing strategy)
    else {
      // Use the aggregation pipeline with $sample to get cards with fewer comparisons
      const lessSeenCards = await Card.aggregate([
        { $match: { enabled: true } },
        // Group cards into buckets by comparison count
        // 0-5, 6-20, 21-50, 51-100, >100
        {
          $bucket: {
            groupBy: "$comparisons",
            boundaries: [0, 6, 21, 51, 101],
            default: "many",
            output: {
              count: { $sum: 1 },
              cards: { $push: "$$ROOT" },
            },
          },
        },
        // Rest of your existing pipeline...
        { $sort: { _id: 1 } },
        { $match: { count: { $gt: 0 } } },
        { $limit: 1 },
        { $unwind: "$cards" },
        { $sample: { size: 2 } },
        { $replaceRoot: { newRoot: "$cards" } },
      ]);

      // If we got two cards, return them
      if (lessSeenCards && lessSeenCards.length === 2) {
        return lessSeenCards;
      }

      // Fallback to pure random if the bucketing approach didn't work
      const fallbackCards = await Card.aggregate([
        { $match: { enabled: true } },
        { $sample: { size: 2 } },
      ]);

      return fallbackCards;
    }
  } catch (error) {
    console.error("Error fetching card pair:", error);
    return [];
  }
};

/**
 * Get a card by its Scryfall ID
 */
exports.getCardByScryfallId = async (scryfallId) => {
  return await Card.findOne({ scryfallId }).lean();
};

// Add this function

exports.getTotalCardCount = async () => {
  try {
    const count = await Card.countDocuments({ enabled: true });
    return count;
  } catch (error) {
    console.error("Error getting card count:", error);
    throw error; // Let the middleware handle the error
  }
};
