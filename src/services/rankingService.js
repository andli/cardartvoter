const Card = require("../models/Card");
const Set = require("../models/Set");
const mongoose = require("mongoose");
const appConfig = require("../config/app");

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

  // Use fixed C value for artists from config
  const C = appConfig.bayesian.artistCValue;

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
    // Use minimum card threshold from config
    { $match: { cardCount: { $gte: appConfig.bayesian.minCardCount } } },
    {
      $addFields: {
        // Calculate Bayesian average with fixed C value
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
          $min: [
            1,
            { $divide: ["$cardCount", appConfig.bayesian.confidenceDivisor] },
          ],
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

  // Use fixed C value for artists from config
  const C = appConfig.bayesian.artistCValue;

  // First, get LOWEST rated card for each artist (changed from highest)
  const lowestRatedCardsByArtist = await Card.aggregate([
    { $match: { enabled: true, comparisons: { $gte: 5 } } }, // Ensure some votes for fairness
    { $sort: { rating: 1 } }, // Sort all cards by rating ASCENDING (lowest first)
    {
      $group: {
        _id: "$artist",
        notableScryfallId: { $first: "$scryfallId" }, // Now gets their worst card
        notableCardName: { $first: "$name" },
        worstRating: { $first: "$rating" }, // Track lowest rating for reference
      },
    },
  ]);

  // Create a lookup map for fast access
  const notableCardsMap = {};
  lowestRatedCardsByArtist.forEach((item) => {
    notableCardsMap[item._id] = {
      scryfallId: item.notableScryfallId,
      name: item.notableCardName,
      rating: item.worstRating,
    };
  });

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
    // Use minimum card threshold from config
    { $match: { cardCount: { $gte: appConfig.bayesian.minCardCount } } },
    {
      $addFields: {
        // Calculate Bayesian average with fixed C value
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
          $min: [
            1,
            { $divide: ["$cardCount", appConfig.bayesian.confidenceDivisor] },
          ],
        },
      },
    },
    { $sort: { bayesianRating: 1 } }, // Sort ascending for bottom artists
    { $limit: limit },
  ]);

  // Add the notable card information back to each artist
  return artists.map((artist) => {
    const notable = notableCardsMap[artist._id] || {};
    return {
      ...artist,
      notableScryfallId: notable.scryfallId || null,
      notableCardName: notable.name || null,
      notableCardRating: notable.rating || null, // Add rating for reference
      formattedRating: artist.bayesianRating.toFixed(0),
      averageRating: artist.bayesianRating,
    };
  });
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
  // First get the global average rating
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

  // Use fixed C value for sets from config
  const C = appConfig.bayesian.setCValue;

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
    {
      $group: {
        _id: "$setName",
        name: { $first: "$setName" },
        code: { $first: "$set" },
        avgRating: { $avg: "$rating" },
        cardCount: { $sum: 1 },
      },
    },
    // Use configurable minimum card count for sets
    { $match: { cardCount: { $gte: appConfig.bayesian.minCardCount } } },
    {
      $addFields: {
        // Calculate Bayesian average
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
          $min: [
            1,
            { $divide: ["$cardCount", appConfig.bayesian.confidenceDivisor] },
          ],
        },
      },
    },
    { $sort: { bayesianRating: -1 } },
    { $limit: limit },
  ]);

  return sets;
};

exports.getBottomSets = async (limit = 10) => {
  // First get the global average rating
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

  // Use fixed C value for sets from config
  const C = appConfig.bayesian.setCValue;

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
    {
      $group: {
        _id: "$setName",
        name: { $first: "$setName" },
        code: { $first: "$set" },
        avgRating: { $avg: "$rating" },
        cardCount: { $sum: 1 },
      },
    },
    // Use configurable minimum card count for sets
    { $match: { cardCount: { $gte: appConfig.bayesian.minCardCount } } },
    {
      $addFields: {
        // Calculate Bayesian average
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
          $min: [
            1,
            { $divide: ["$cardCount", appConfig.bayesian.confidenceDivisor] },
          ],
        },
      },
    },
    { $sort: { bayesianRating: 1 } }, // Sort ascending for bottom sets
    { $limit: limit },
  ]);

  return sets;
};
