// This file contains business logic related to card operations, such as fetching cards from the Scryfall API.

const Card = require("../models/Card");

/**
 * Get a pair of cards for voting comparison
 */
exports.getCardPair = async () => {
  try {
    // Count total available cards
    const totalCards = await Card.countDocuments({ enabled: true });

    if (totalCards < 2) {
      console.warn(
        `Only ${totalCards} cards available in database. Need at least 2 for comparison.`
      );
      // Return empty array instead of throwing error
      return [];
    }

    // Increase randomness - increase to 50% completely random selections
    if (Math.random() < 0.5) {
      // Use aggregate with $sample for better randomness
      const randomCards = await Card.aggregate([
        { $match: { enabled: true } },
        { $sample: { size: 2 } },
      ]);
      return randomCards;
    }

    // For the other 50%, use a better strategy to find under-represented cards
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
      // Sort by bucket (prioritize less-compared cards)
      { $sort: { _id: 1 } },
      // Get the first non-empty bucket
      { $match: { count: { $gt: 0 } } },
      { $limit: 1 },
      // Unwind to get individual cards
      { $unwind: "$cards" },
      // Get a random sample from this bucket
      { $sample: { size: 2 } },
      // Just return the card
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
