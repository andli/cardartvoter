const Stats = require("../models/Stats");
const Card = require("../models/Card"); // Add direct model imports
const Vote = require("../models/Vote"); // Add direct model imports
const mongoose = require("mongoose");

// Cache expiration time (5 minutes)
const REFRESH_THRESHOLD = 5 * 60 * 1000;

const statsService = {
  /**
   * Get a stat with time-based refresh
   */
  async getStat(key, countFn, force = false) {
    try {
      // Find existing stat
      let stat = await Stats.findOne({ key });

      // If no stat exists yet, create it with initial count
      if (!stat) {
        console.log(`Initial count for ${key}...`);
        const initialValue = await countFn();
        stat = await Stats.create({
          key,
          value: initialValue,
          lastUpdated: new Date(),
        });
        return stat.value;
      }

      // Check if force refresh or timestamp is older than threshold
      const now = Date.now();
      const lastUpdated = new Date(stat.lastUpdated).getTime();

      if (force || now - lastUpdated > REFRESH_THRESHOLD) {
        console.log(
          `${force ? "Forced refresh" : "Refreshing stale count"} for ${key}...`
        );

        // Get fresh count
        const freshValue = await countFn();

        // Update the stat with new count and timestamp
        await Stats.updateOne(
          { key },
          {
            value: freshValue,
            lastUpdated: new Date(),
          }
        );

        return freshValue;
      }

      // Return cached value if it's fresh enough
      return stat.value;
    } catch (error) {
      console.error(`Error getting stat ${key}:`, error);
      return 0;
    }
  },

  /**
   * Get card count with auto-refresh when stale
   */
  async getCardCount(force = false) {
    return this.getStat(
      "cardCount",
      async () => {
        try {
          // Use the directly imported model
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
   * Get vote count with auto-refresh when stale
   */
  async getVoteCount(force = false) {
    return this.getStat(
      "voteCount",
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
};

module.exports = statsService;
