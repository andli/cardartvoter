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

    // Increase randomness - 25% completely random
    if (Math.random() < 0.25) {
      // Use aggregate with $sample for better randomness
      const randomCards = await Card.aggregate([
        { $match: { enabled: true } },
        { $sample: { size: 2 } },
      ]);
      return randomCards;
    }

    // More randomness in finding less-seen cards
    const randomSkip = Math.floor(
      Math.random() * Math.min(50, totalCards / 10)
    );
    const lessSeenCard = await Card.findOne({ enabled: true })
      .sort({ comparisons: 1 })
      .skip(randomSkip)
      .lean();

    if (!lessSeenCard) {
      throw new Error("Error finding card");
    }

    // Find another card with more randomness
    const rating = lessSeenCard.rating;
    const ratingRange = 300; // Wider range for more variety

    // Use aggregate for second card to ensure real randomness
    const secondCardQuery = await Card.aggregate([
      {
        $match: {
          scryfallId: { $ne: lessSeenCard.scryfallId },
          enabled: true,
          rating: {
            $gte: rating - ratingRange,
            $lte: rating + ratingRange,
          },
        },
      },
      { $sample: { size: 1 } },
    ]);

    const secondCard = secondCardQuery.length > 0 ? secondCardQuery[0] : null;

    if (!secondCard) {
      // Fallback - just get any random card that's not the same
      const fallbackCard = await Card.aggregate([
        {
          $match: {
            scryfallId: { $ne: lessSeenCard.scryfallId },
            enabled: true,
          },
        },
        { $sample: { size: 1 } },
      ]);

      if (!fallbackCard.length) {
        throw new Error("Could not find a second card");
      }

      return [lessSeenCard, fallbackCard[0]];
    }

    return [lessSeenCard, secondCard];
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
