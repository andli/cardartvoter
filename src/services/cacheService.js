const NodeCache = require("node-cache");

class CacheService {
  constructor() {
    // Cache Scryfall data for 24 hours by default
    this.cache = new NodeCache({ stdTTL: 24 * 60 * 60 });
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value, ttl = undefined) {
    return this.cache.set(key, value, ttl);
  }

  has(key) {
    return this.cache.has(key);
  }
}

module.exports = new CacheService();
