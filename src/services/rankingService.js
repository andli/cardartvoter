const Card = require("../models/Card");

/**
 * Get top ranked cards
 */
exports.getTopRankings = async (limit = 10, minComparisons = 5) => {
  try {
    // Make sure to select all needed fields
    const topRankings = await Card.find({
      enabled: true,
      comparisons: { $gte: minComparisons },
    })
      .select("name artist scryfallId rating comparisons") // Explicitly include scryfallId
      .sort({ rating: -1 })
      .limit(limit)
      .lean();

    return topRankings;
  } catch (error) {
    console.error("Error fetching top rankings:", error);
    return [];
  }
};
