const Card = require("../models/Card");
const mongoose = require("mongoose");

/**
 * Get top ranked cards
 */
exports.getTopRankedCards = async (limit = 20, minComparisons = 1) => {
  try {
    const cards = await Card.find({ comparisons: { $gte: minComparisons } })
      .sort({ rating: -1 }) // Descending order (highest first)
      .limit(limit)
      .lean();

    return cards.map((card) => ({
      ...card,
      formattedRating: card.rating.toFixed(0),
    }));
  } catch (error) {
    console.error("Error getting top ranked cards:", error);
    return [];
  }
};

/**
 * Get bottom ranked cards
 */
exports.getBottomRankedCards = async (limit = 20, minComparisons = 1) => {
  try {
    const cards = await Card.find({ comparisons: { $gte: minComparisons } })
      .sort({ rating: 1 }) // Ascending order (lowest first)
      .limit(limit)
      .lean();

    return cards.map((card) => ({
      ...card,
      formattedRating: card.rating.toFixed(0),
    }));
  } catch (error) {
    console.error("Error getting bottom ranked cards:", error);
    return [];
  }
};

/**
 * Get top ranked artists
 */
exports.getTopRankedArtists = async (limit = 20, minCards = 1) => {
  try {
    // Aggregate to get average rating by artist
    const artists = await Card.aggregate([
      // Filter cards with comparisons
      { $match: { comparisons: { $gt: 0 } } },

      // Group by artist and calculate stats
      {
        $group: {
          _id: "$artist",
          averageRating: { $avg: "$rating" },
          cardCount: { $sum: 1 },
          cards: { $push: "$$ROOT" },
        },
      },

      // Filter artists with at least minCards cards
      {
        $match: {
          cardCount: { $gte: minCards },
          _id: { $ne: null, $ne: "" },
        },
      },

      // Sort by average rating
      { $sort: { averageRating: -1 } },

      // Limit results
      { $limit: limit },

      // Format output
      {
        $project: {
          _id: 0,
          name: "$_id",
          averageRating: 1,
          cardCount: 1,
          // Get a notable card's ID for thumbnail
          notableScryfallId: {
            $arrayElemAt: ["$cards.scryfallId", 0],
          },
          // Also get the notable card's name
          notableCardName: {
            $arrayElemAt: ["$cards.name", 0],
          },
        },
      },
    ]);

    return artists;
  } catch (error) {
    console.error("Error getting top ranked artists:", error);
    return [];
  }
};

/**
 * Get top rankings for the homepage
 * (Returns only top cards for the homepage widget)
 */
exports.getTopRankings = async (limit = 10) => {
  try {
    // Get top cards with a low minimum comparisons threshold for homepage
    const topCards = await exports.getTopRankedCards(limit, 1);

    // Return just the array of cards, not an object
    return topCards;
  } catch (error) {
    console.error("Error getting top rankings:", error);
    return [];
  }
};
