const mongoose = require("mongoose");
const appConfig = require("../config/app");

const cacheSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: appConfig.cache.ttlSeconds, // Use config value for TTL (in seconds)
    },
  },
  {
    // Add these options to make the model more efficient
    strict: true,
    versionKey: false, // Don't store the __v field to save space
  }
);

// Create a TTL index that automatically removes documents after they expire
cacheSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: appConfig.cache.ttlSeconds }
);

const Cache = mongoose.model("Cache", cacheSchema);

module.exports = Cache;
