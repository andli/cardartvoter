const Card = require("../models/Card");
const Vote = require("../models/Vote");
const mongoose = require("mongoose");
const cacheService = require("./cacheService");
const appConfig = require("../config/app");

const statsService = {
  /**
   * Get card count with MongoDB-based caching
   */
  async getCardCount(force = false) {
    return cacheService.getOrSet(
      "stats:cardCount",
      async () => {
        try {
          const count = await Card.countDocuments();
          return count;
        } catch (error) {
          console.error("Error counting cards:", error);
          return 0;
        }
      },
      force
    );
  },

  /**
   * Get count of enabled cards with MongoDB-based caching
   */
  async getEnabledCardCount(force = false) {
    return cacheService.getOrSet(
      "stats:enabledCardCount",
      async () => {
        try {
          const count = await Card.countDocuments({ enabled: true });
          return count;
        } catch (error) {
          console.error("Error counting enabled cards:", error);
          return 0;
        }
      },
      force
    );
  },

  /**
   * Get vote count with MongoDB-based caching
   */
  async getVoteCount(force = false) {
    return cacheService.getOrSet(
      "stats:voteCount",
      async () => {
        try {
          // Sum all comparisons across cards
          const result = await Card.aggregate([
            {
              $group: {
                _id: null,
                totalComparisons: { $sum: "$comparisons" },
              },
            },
          ]);

          // Since each comparison involves two cards, divide by 2 to get actual vote count
          const voteCount =
            result.length > 0 ? Math.floor(result[0].totalComparisons / 2) : 0;

          return voteCount;
        } catch (error) {
          console.error("Error counting votes via comparisons:", error);
          return 0;
        }
      },
      force
    );
  },

  /**
   * Invalidate all stats caches when data changes
   * Use this after bulk operations or significant changes
   */
  async invalidateAllStats() {
    await cacheService.invalidatePattern(/^stats:/);
  },
};

module.exports = statsService;
