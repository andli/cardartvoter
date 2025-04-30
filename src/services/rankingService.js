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
 * Get top ranked artists
 */
exports.getTopRankedArtists = async (limit = 20, minCards = 5) => {
  try {
    // First, get top artists without storing all card data
    const artistStats = await Card.aggregate([
      // Filter cards with comparisons
      { $match: { enabled: true, comparisons: { $gt: 0 } } },

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
      { $match: { enabled: true, comparisons: { $gt: 0 } } },

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

  // Increase the weight constant significantly
  const C = 25; // Previously 8, now 25 to reduce impact of small samples

  // Get all artists with their ratings
  const artists = await Card.aggregate([
    { $match: { enabled: true } },
    {
      $group: {
        _id: "$artist",
        avgRating: { $avg: "$rating" },
        cardCount: { $sum: 1 },
        // Find the highest rated card for this artist
        notableScryfallId: {
          $first: {
            $cond: {
              if: { $gte: ["$rating", 1600] }, // Only select well-rated cards as examples
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
    // Add minimum card threshold - consistent with bottom artists
    { $match: { cardCount: { $gte: 5 } } },
    {
      $project: {
        artist: "$_id",
        avgRating: 1,
        cardCount: 1,
        notableScryfallId: 1,
        notableCardName: 1,
        cards: 1,
        // Calculate Bayesian average with increased C
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
        // Add confidence score
        confidenceScore: {
          $min: [1, { $divide: ["$cardCount", 20] }], // Max confidence at 20+ cards
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
  ]).then((result) => result[0]?.avgRating || 1500);

  // Use the same increased weight constant
  const C = 25; // Was 8, now 25

  // Get all artists with their ratings
  const artists = await Card.aggregate([
    { $match: { enabled: true, comparisons: { $gt: 0 } } },
    {
      $group: {
        _id: "$artist",
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
    // Add minimum card threshold - consistent with bottom artists
    { $match: { cardCount: { $gte: 5 } } },
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
