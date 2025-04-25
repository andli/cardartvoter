const Card = require("../models/Card");

/**
 * Get top ranked cards
 */
exports.getTopRankings = async (limit = 10, minComparisons = 5) => {
  try {
    const topRankings = await Card.find({
      enabled: true,
      comparisons: { $gte: minComparisons },
    })
      .sort({ rating: -1 })
      .limit(limit)
      .lean();

    return topRankings;
  } catch (error) {
    console.error("Error fetching top rankings:", error);
    return [];
  }
};

/**
 * Get top artists based on average card ratings
 */
exports.getTopArtists = async (limit = 20, minCards = 3) => {
  try {
    const topArtists = await Card.aggregate([
      { $match: { enabled: true } },
      // Group by artist and calculate stats
      {
        $group: {
          _id: "$artist",
          averageRating: { $avg: "$rating" },
          totalCards: { $sum: 1 },
          totalComparisons: { $sum: "$comparisons" },
          bestCard: { $max: "$name" }, // Just to have a representative card
        },
      },
      // Filter artists with at least minCards cards
      { $match: { totalCards: { $gte: minCards } } },
      // Sort by average rating descending
      { $sort: { averageRating: -1 } },
      // Limit to requested number
      { $limit: limit },
      // Project to rename fields
      {
        $project: {
          _id: 0,
          name: "$_id",
          averageRating: 1,
          totalCards: 1,
          totalComparisons: 1,
          bestCard: 1,
        },
      },
    ]);

    // Format the ratings
    topArtists.forEach((artist) => {
      artist.formattedRating = artist.averageRating.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      });
    });

    return topArtists;
  } catch (error) {
    console.error("Error fetching top artists:", error);
    return [];
  }
};
