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
exports.getTopRankedArtists = async (limit = 20, minCards = 10) => {
  try {
    // First, get top artists without storing all card data
    const artistStats = await Card.aggregate([
      // Filter cards with comparisons
      { $match: { comparisons: { $gt: 0 } } },

      // Group by artist but don't store all cards
      {
        $group: {
          _id: "$artist",
          averageRating: { $avg: "$rating" },
          cardCount: { $sum: 1 },
        },
      },

      // Filter artists with at least minCards cards (now 5)
      {
        $match: {
          cardCount: { $gte: minCards },
          _id: { $ne: null, $ne: "" },
        },
      },

      // Rest of the aggregation pipeline...
      // Sort by average rating
      { $sort: { averageRating: -1 } },

      // Limit results
      { $limit: limit },
    ]);

    // Now get a notable card for each artist in a separate query
    const artists = await Promise.all(
      artistStats.map(async (artist) => {
        // Find one notable card for this artist
        const notableCard = await Card.findOne(
          { artist: artist._id, comparisons: { $gt: 0 } },
          { name: 1, scryfallId: 1 }
        ).sort({ rating: -1 });

        return {
          name: artist._id,
          averageRating: artist.averageRating,
          cardCount: artist.cardCount,
          notableScryfallId: notableCard?.scryfallId || null,
          notableCardName: notableCard?.name || null,
        };
      })
    );

    return artists;
  } catch (error) {
    console.error("Error getting top ranked artists:", error);
    return [];
  }
};

/**
 * Get bottom ranked artists
 */
exports.getBottomRankedArtists = async (limit = 20, minCards = 10) => {
  try {
    // First, get bottom artists without storing all card data
    const artistStats = await Card.aggregate([
      // Filter cards with comparisons
      { $match: { comparisons: { $gt: 0 } } },

      // Group by artist but don't store all cards
      {
        $group: {
          _id: "$artist",
          averageRating: { $avg: "$rating" },
          cardCount: { $sum: 1 },
        },
      },

      // Filter artists with at least minCards cards
      {
        $match: {
          cardCount: { $gte: minCards },
          _id: { $ne: null, $ne: "" },
        },
      },

      // Sort by averageRating ascending (for bottom artists)
      { $sort: { averageRating: 1 } },

      // Limit results
      { $limit: limit },
    ]);

    // Now get a notable card for each artist in a separate query
    const artists = await Promise.all(
      artistStats.map(async (artist) => {
        // Find one notable card for this artist
        const notableCard = await Card.findOne(
          { artist: artist._id, comparisons: { $gt: 0 } },
          { name: 1, scryfallId: 1 }
        ).sort({ rating: -1 });

        return {
          name: artist._id,
          averageRating: artist.averageRating,
          cardCount: artist.cardCount,
          notableScryfallId: notableCard?.scryfallId || null,
          notableCardName: notableCard?.name || null,
        };
      })
    );

    return artists;
  } catch (error) {
    console.error("Error getting bottom ranked artists:", error);
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
