/**
 * Application-wide configuration settings
 */

module.exports = {
  // Cache settings
  cache: {
    refreshThreshold: 5 * 60 * 1000, // 5 minutes in milliseconds
    ttlSeconds: 300, // 5 minutes in seconds (for MongoDB TTL index)
    maxDocumentSize: 16000, // bytes, stay well under 16MB BSON limit to be safe
    enabled: true, // Can be used to disable caching entirely if needed
  },

  // ELO rating settings
  elo: {
    initialRating: 1500,
    minRating: 1000,
    maxRating: 2000,
    kFactors: {
      new: 48, // For cards with < 10 comparisons
      establishing: 32, // For cards with < 30 comparisons
      established: 24, // For cards with < 100 comparisons
      wellEstablished: 16, // For cards with >= 100 comparisons
    },
  },

  // Pairing algorithm settings
  pairing: {
    randomPairChance: 0.45, // 45% chance of pure random pairing
    topCardPairChance: 0.05, // 5% chance of pairing featuring top-rated cards
    // rest is under represented cards
    ratingTolerance: 200, // Look for cards within +/- this rating range
  },

  // Bayesian averaging settings
  bayesian: {
    minCardCount: 8, // Minimum cards required for an artist/set to be ranked
    confidenceDivisor: 30, // Used in confidence score calculation (cardCount/confidenceDivisor)
    minCValue: 25, // Minimum C value for the Bayesian average formula
    cValueScaleFactor: 0.001, // Factor for scaling C value with database size (totalCards * factor)
  },

  // Session settings
  session: {
    cookieMaxAge: 24 * 60 * 60 * 1000, // 1 day
    storeExpiry: 7 * 24 * 60 * 60 * 1000, // 1 week
  },
};
