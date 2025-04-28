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
exports.getTopRankedArtists = async (limit = 20, minCards = 5) => {
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
exports.getBottomRankedArtists = async (limit = 20, minCards = 5) => {
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

exports.getTopArtists = async (limit = 10) => {
  // First get the global average rating
  const globalAvg = await Card.aggregate([
    { $match: { enabled: true } },
    { $group: { _id: null, avgRating: { $avg: "$rating" } } },
  ]).then((result) => result[0]?.avgRating || 1500); // Default to 1500 if no cards

  // Weight constant - adjust based on your data
  const C = 8;

  // Get all artists with their ratings
  const artists = await Card.aggregate([
    { $match: { enabled: true } },
    {
      $group: {
        _id: "$artist",
        avgRating: { $avg: "$rating" },
        cardCount: { $sum: 1 },
        cards: {
          $push: { id: "$scryfallId", name: "$name", rating: "$rating" },
        },
      },
    },
    {
      $project: {
        artist: "$_id",
        avgRating: 1,
        cardCount: 1,
        cards: 1,
        // Calculate Bayesian average
        bayesianRating: {
          $divide: [
            {
              $add: [
                { $multiply: [C, globalAvg] },
                { $multiply: ["$avgRating", "$cardCount"] },
              ],
            },
            { $add: [C, "$cardCount"] },
          ],
        },
      },
    },
    { $sort: { bayesianRating: -1 } },
    { $limit: limit },
  ]);

  // Format the Bayesian rating for display
  return artists.map((artist) => ({
    ...artist,
    formattedRating: artist.bayesianRating.toFixed(0),
    // Keep averageRating for backwards compatibility
    averageRating: artist.bayesianRating,
  }));
};

exports.getBottomArtists = async (limit = 10) => {
  // First get the global average rating
  const globalAvg = await Card.aggregate([
    { $match: { enabled: true } },
    { $group: { _id: null, avgRating: { $avg: "$rating" } } },
  ]).then((result) => result[0]?.avgRating || 1500); // Default to 1500 if no cards

  // Weight constant - adjust based on your data
  const C = 8;

  // Get all artists with their ratings
  const artists = await Card.aggregate([
    { $match: { enabled: true, comparisons: { $gt: 0 } } },
    {
      $group: {
        _id: "$artist",
        avgRating: { $avg: "$rating" },
        cardCount: { $sum: 1 },
        cards: {
          $push: { id: "$scryfallId", name: "$name", rating: "$rating" },
        },
      },
    },
    {
      $project: {
        artist: "$_id",
        avgRating: 1,
        cardCount: 1,
        cards: 1,
        // Calculate Bayesian average
        bayesianRating: {
          $divide: [
            {
              $add: [
                { $multiply: [C, globalAvg] },
                { $multiply: ["$avgRating", "$cardCount"] },
              ],
            },
            { $add: [C, "$cardCount"] },
          ],
        },
      },
    },
    // Only include artists with at least 3 cards for statistical significance
    { $match: { cardCount: { $gte: 3 } } },
    // Sort by bayesianRating in ASCENDING order for bottom artists
    { $sort: { bayesianRating: 1 } },
    { $limit: limit },
  ]);

  // Format the Bayesian rating for display
  return artists.map((artist) => ({
    ...artist,
    formattedRating: artist.bayesianRating.toFixed(0),
    // Keep averageRating for backwards compatibility
    averageRating: artist.bayesianRating,
  }));
};

// Add these new functions for set rankings

exports.getTopSets = async (limit = 10) => {
  // First get the global average rating
  const globalAvg = await Card.aggregate(
    [
      { $match: { enabled: true } },
      { $group: { _id: null, avgRating: { $avg: "$rating" } } },
    ],
    { allowDiskUse: true }
  ).then((result) => result[0]?.avgRating || 1500);

  // Weight constant
  const C = 8;

  // Get all sets with their ratings
  const sets = await Card.aggregate(
    [
      { $match: { enabled: true, setName: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$setName",
          name: { $first: "$setName" },
          code: { $first: "$set" },
          avgRating: { $avg: "$rating" },
          cardCount: { $sum: 1 },
        },
      },
      {
        $project: {
          name: 1,
          code: 1,
          avgRating: 1,
          cardCount: 1,
          bayesianRating: {
            $divide: [
              {
                $add: [
                  { $multiply: [C, globalAvg] },
                  { $multiply: ["$avgRating", "$cardCount"] },
                ],
              },
              { $add: [C, "$cardCount"] },
            ],
          },
        },
      },
      { $match: { cardCount: { $gte: 5 } } },
      { $sort: { bayesianRating: -1 } },
      { $limit: limit },
    ],
    { allowDiskUse: true }
  );

  // Format the rating
  return sets.map((set) => ({
    ...set,
    formattedRating: set.bayesianRating.toFixed(0),
    averageRating: set.bayesianRating,
  }));
};

exports.getBottomSets = async (limit = 10) => {
  // First get the global average rating
  const globalAvg = await Card.aggregate(
    [
      { $match: { enabled: true } },
      { $group: { _id: null, avgRating: { $avg: "$rating" } } },
    ],
    { allowDiskUse: true }
  ).then((result) => result[0]?.avgRating || 1500);

  // Weight constant - adjust based on your data
  const C = 8;

  // Get all sets with their ratings
  const sets = await Card.aggregate(
    [
      {
        $match: {
          enabled: true,
          comparisons: { $gt: 0 },
          set: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$set",
          name: { $first: "$setName" },
          code: { $first: "$set" },
          avgRating: { $avg: "$rating" },
          cardCount: { $sum: 1 },
        },
      },
      {
        $project: {
          name: 1,
          code: 1,
          avgRating: 1,
          cardCount: 1,
          bayesianRating: {
            $divide: [
              {
                $add: [
                  { $multiply: [C, globalAvg] },
                  { $multiply: ["$avgRating", "$cardCount"] },
                ],
              },
              { $add: [C, "$cardCount"] },
            ],
          },
        },
      },
      { $match: { cardCount: { $gte: 5 } } },
      { $sort: { bayesianRating: 1 } },
      { $limit: limit },
    ],
    { allowDiskUse: true }
  );

  // Format the rating
  return sets.map((set) => ({
    ...set,
    formattedRating: set.bayesianRating.toFixed(0),
    averageRating: set.bayesianRating,
  }));
};
