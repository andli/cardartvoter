const Card = require("../models/Card");
const Set = require("../models/Set"); // Add this import
const mongoose = require("mongoose");

/**
 * Get top ranked cards
 */
exports.getTopRankedCards = async (limit = 20, minComparisons = 1) => {
  try {
    const cards = await Card.find({
      enabled: true,
      comparisons: { $gte: minComparisons },
    })
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
    const cards = await Card.find({
      enabled: true,
      comparisons: { $gte: minComparisons },
    })
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
 * CONSOLIDATE ARTIST FUNCTIONS
 * Keep the Bayesian implementations and remove the duplicates
 */

// Standardize the function names throughout the codebase
exports.getTopArtists = async (limit = 10) => {
  // First get the global average rating and total card count
  const stats = await Card.aggregate([
    { $match: { enabled: true } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$rating" },
        totalCards: { $sum: 1 },
      },
    },
  ]).then((result) => ({
    globalAvg: result[0]?.avgRating || 1500,
    totalCards: result[0]?.totalCards || 0,
  }));

  // Make C value scale with database size - minimum 40
  const C = Math.max(40, Math.floor(stats.totalCards * 0.01));

  // First, get highest rated card for each artist
  const highestRatedCardsByArtist = await Card.aggregate([
    { $match: { enabled: true, rating: { $gt: 1500 } } },
    { $sort: { rating: -1 } }, // Sort all cards by rating descending
    {
      $group: {
        _id: "$artist",
        notableScryfallId: { $first: "$scryfallId" },
        notableCardName: { $first: "$name" },
      },
    },
  ]);

  // Create a lookup map for fast access
  const notableCardsMap = {};
  highestRatedCardsByArtist.forEach((item) => {
    notableCardsMap[item._id] = {
      scryfallId: item.notableScryfallId,
      name: item.notableCardName,
    };
  });

  // Set minimum card count for top rankings
  const minCardCount = 10;

  // Get all artists with their ratings
  const artists = await Card.aggregate([
    { $match: { enabled: true, comparisons: { $gt: 0 } } },
    {
      $group: {
        _id: "$artist",
        name: { $first: "$artist" },
        avgRating: { $avg: "$rating" },
        cardCount: { $sum: 1 },
      },
    },
    // Higher minimum card threshold
    { $match: { cardCount: { $gte: minCardCount } } },
    {
      $addFields: {
        // Calculate Bayesian average with dynamic C value
        bayesianRating: {
          $divide: [
            {
              $add: [
                { $multiply: [C, stats.globalAvg] },
                { $multiply: ["$avgRating", "$cardCount"] },
              ],
            },
            { $add: [C, "$cardCount"] },
          ],
        },
        confidenceScore: {
          $min: [1, { $divide: ["$cardCount", 30] }],
        },
      },
    },
    { $sort: { bayesianRating: -1 } },
    { $limit: limit },
  ]);

  // Add the notable card information back to each artist
  return artists.map((artist) => {
    const notable = notableCardsMap[artist._id] || {};
    return {
      ...artist,
      notableScryfallId: notable.scryfallId || null,
      notableCardName: notable.name || null,
      formattedRating: artist.bayesianRating.toFixed(0),
      averageRating: artist.bayesianRating,
    };
  });
};

exports.getBottomArtists = async (limit = 10) => {
  // First get the global average rating and total card count
  const stats = await Card.aggregate([
    { $match: { enabled: true } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$rating" },
        totalCards: { $sum: 1 },
      },
    },
  ]).then((result) => ({
    globalAvg: result[0]?.avgRating || 1500,
    totalCards: result[0]?.totalCards || 0,
  }));

  // Make C value scale with database size - minimum 40
  const C = Math.max(40, Math.floor(stats.totalCards * 0.01));

  // Set minimum card count for rankings
  const minCardCount = 10;

  // Get all artists with their ratings
  const artists = await Card.aggregate([
    { $match: { enabled: true, comparisons: { $gt: 0 } } },
    {
      $group: {
        _id: "$artist",
        name: { $first: "$artist" },
        avgRating: { $avg: "$rating" },
        cardCount: { $sum: 1 },
        notableScryfallId: {
          $first: {
            $cond: {
              if: { $gte: ["$rating", 1600] },
              then: "$scryfallId",
              else: null,
            },
          },
        },
        notableCardName: {
          $first: {
            $cond: {
              if: { $gte: ["$rating", 1600] },
              then: "$name",
              else: null,
            },
          },
        },
        cards: {
          $push: { id: "$scryfallId", name: "$name", rating: "$rating" },
        },
      },
    },
    // Higher minimum card threshold
    { $match: { cardCount: { $gte: minCardCount } } },
    {
      $addFields: {
        // Calculate Bayesian average with dynamic C value
        bayesianRating: {
          $divide: [
            {
              $add: [
                { $multiply: [C, stats.globalAvg] },
                { $multiply: ["$avgRating", "$cardCount"] },
              ],
            },
            { $add: [C, "$cardCount"] },
          ],
        },
        confidenceScore: {
          $min: [1, { $divide: ["$cardCount", 30] }],
        },
      },
    },
    { $sort: { bayesianRating: 1 } }, // Sort ascending for bottom artists
    { $limit: limit },
  ]);

  // Format for UI display and maintain compatibility
  return artists.map((artist) => ({
    ...artist,
    formattedRating: artist.bayesianRating.toFixed(0),
    averageRating: artist.bayesianRating,
  }));
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

exports.getTopSets = async (limit = 10) => {
  // Get valid set codes first (those that shouldn't be filtered out)
  const validSets = await Set.find({ shouldFilter: false })
    .select("code")
    .lean();

  const validSetCodes = validSets.map((set) => set.code);

  const sets = await Card.aggregate([
    // Only include valid sets
    {
      $match: {
        enabled: true,
        set: { $in: validSetCodes },
        setName: { $exists: true, $ne: null },
      },
    },

    // Rest of your aggregation...
    {
      $group: {
        _id: "$setName",
        name: { $first: "$setName" },
        code: { $first: "$set" },
        avgRating: { $avg: "$rating" },
        cardCount: { $sum: 1 },
      },
    },
    { $match: { cardCount: { $gte: 5 } } },
    { $sort: { avgRating: -1 } },
    { $limit: limit },
  ]);

  return sets;
};

exports.getBottomSets = async (limit = 10) => {
  // Get valid set codes first (those that shouldn't be filtered out)
  const validSets = await Set.find({ shouldFilter: false })
    .select("code")
    .lean();

  const validSetCodes = validSets.map((set) => set.code);

  const sets = await Card.aggregate([
    // Only include valid sets
    {
      $match: {
        enabled: true,
        set: { $in: validSetCodes },
        setName: { $exists: true, $ne: null },
      },
    },

    // Rest of your aggregation...
    {
      $group: {
        _id: "$setName",
        name: { $first: "$setName" },
        code: { $first: "$set" },
        avgRating: { $avg: "$rating" },
        cardCount: { $sum: 1 },
      },
    },
    { $match: { cardCount: { $gte: 5 } } },
    { $sort: { avgRating: 1 } }, // Note: different sort order for bottom
    { $limit: limit },
  ]);

  return sets;
};
