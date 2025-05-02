const Cache = require("../models/Cache");
const appConfig = require("../config/app");

/**
 * A service that provides MongoDB-based caching with TTL expiration
 * Optimized for MongoDB Atlas free tier
 */
const cacheService = {
  /**
   * Get a cached value or compute it if not available
   * @param {string} key - The cache key
   * @param {Function} computeFn - Async function to compute the value if not cached
   * @param {boolean} force - Whether to force recomputation
   * @returns {Promise<any>} - The cached or computed value
   */
  async getOrSet(key, computeFn, force = false) {
    // Skip caching if disabled in config
    if (!appConfig.cache.enabled) {
      return await computeFn();
    }

    try {
      if (!force) {
        // Try to get from cache first
        const cachedItem = await Cache.findOne({ key }).lean();
        if (cachedItem) {
          return cachedItem.value;
        }
      }

      // If not in cache or force refresh, compute the value
      const value = await computeFn();

      // Estimate the size of the value (rough approximation)
      const valueSize = JSON.stringify(value).length;

      // Only cache if the value size is reasonable (to avoid exceeding Atlas limits)
      if (valueSize <= appConfig.cache.maxDocumentSize) {
        // Store in cache (upsert)
        await Cache.updateOne(
          { key },
          { key, value, createdAt: new Date() },
          { upsert: true }
        );
      } else {
        console.warn(
          `Value for key "${key}" exceeds max document size (${valueSize} bytes), not caching`
        );
      }

      return value;
    } catch (error) {
      console.error(`Cache error for key ${key}:`, error);
      // On error, try to compute directly
      return await computeFn();
    }
  },

  /**
   * Invalidate a specific cache key
   * @param {string} key - The cache key to invalidate
   */
  async invalidate(key) {
    if (!appConfig.cache.enabled) return;

    try {
      await Cache.deleteOne({ key });
    } catch (error) {
      console.error(`Error invalidating cache key ${key}:`, error);
    }
  },

  /**
   * Invalidate multiple cache keys matching a pattern
   * @param {RegExp} pattern - Regular expression to match keys
   */
  async invalidatePattern(pattern) {
    if (!appConfig.cache.enabled) return;

    try {
      await Cache.deleteMany({ key: { $regex: pattern } });
    } catch (error) {
      console.error(`Error invalidating cache with pattern ${pattern}:`, error);
    }
  },

  /**
   * Clear the entire cache
   */
  async clear() {
    if (!appConfig.cache.enabled) return;

    try {
      await Cache.deleteMany({});
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  },

  /**
   * Get cache statistics (useful for monitoring)
   * @returns {Promise<Object>} Cache stats
   */
  async getStats() {
    if (!appConfig.cache.enabled) {
      return { enabled: false, count: 0, totalSize: 0 };
    }

    try {
      // Count total cache entries
      const count = await Cache.countDocuments();

      // This is an expensive operation, use sparingly
      const cacheItems = await Cache.find().lean();
      const totalSize = cacheItems.reduce((size, item) => {
        return size + JSON.stringify(item).length;
      }, 0);

      return {
        enabled: true,
        count,
        totalSize,
        averageSize: count ? Math.round(totalSize / count) : 0,
      };
    } catch (error) {
      console.error("Error getting cache stats:", error);
      return { enabled: true, error: error.message };
    }
  },
};

module.exports = cacheService;
