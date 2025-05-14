const Card = require("../models/Card");
const Vote = require("../models/Vote");
const Stats = require("../models/Stats");
const config = require("../config/app");

// Get system constants from config file instead of hardcoding
const RATING_MIN = config.elo.ratings.min;
const RATING_MAX = config.elo.ratings.max;
const RATING_INIT = config.elo.ratings.initial;

exports.processVote = async (selectedCardId, sessionPair) => {
  try {
    // Get the two cards in the pair from the session
    const card1Id = sessionPair.card1;
    const card2Id = sessionPair.card2;

    if (!card1Id || !card2Id) {
      throw new Error("Missing required card IDs");
    }

    // Determine which card was selected (winner) and which was not (loser)
    const winningCardId = selectedCardId;
    const losingCardId = selectedCardId === card1Id ? card2Id : card1Id;

    // Find both cards in the database
    const [winningCard, losingCard] = await Promise.all([
      Card.findOne({ scryfallId: winningCardId }),
      Card.findOne({ scryfallId: losingCardId }),
    ]);

    if (!winningCard || !losingCard) {
      throw new Error(
        `One or more cards not found in database. Winner: ${winningCardId}, Loser: ${losingCardId}`
      );
    }

    // Enhanced K-factor determination for better rating movement
    const getKFactor = (winnerComps, loserComps) => {
      const avgComps = (winnerComps + loserComps) / 2;

      // More granular K-factor scaling based on comparisons
      if (avgComps < 5) return 64; // Very new cards
      if (avgComps < 15) return 48; // New cards
      if (avgComps < 30) return 40; // Establishing cards
      if (avgComps < 50) return 32; // Semi-established cards
      if (avgComps < 100) return 24; // Established cards
      if (avgComps < 200) return 16; // Well-established cards
      return 12; // Very established cards
    };

    // Use a dynamic K-factor based on both cards' comparison count
    const kFactor = getKFactor(winningCard.comparisons, losingCard.comparisons);

    // Calculate expected scores with the Elo formula
    const ratingDiff = winningCard.rating - losingCard.rating;
    const expectedWinnerScore = 1 / (1 + Math.pow(10, -ratingDiff / 800)); // Widened divisor for expanded range

    // Calculate rating change with decimal precision
    const ratingChange = kFactor * (1 - expectedWinnerScore);

    // Update ratings with decimal precision (mongoose will store these properly)
    winningCard.rating += ratingChange;
    losingCard.rating -= ratingChange;

    // Ensure ratings stay within expanded bounds
    winningCard.rating = Math.min(
      RATING_MAX,
      Math.max(RATING_MIN, winningCard.rating)
    );
    losingCard.rating = Math.min(
      RATING_MAX,
      Math.max(RATING_MIN, losingCard.rating)
    );

    // Increment comparison count
    winningCard.comparisons += 1;
    losingCard.comparisons += 1;

    // Save changes to the database
    await Promise.all([winningCard.save(), losingCard.save()]);

    // Record the vote - use cardId field as required by Vote schema
    const vote = new Vote({
      cardId: winningCard._id, // This matches the schema definition
      // Optional fields can be stored in a separate metadata field if needed
      metadata: {
        losingCardId: losingCard._id,
        winningCardScryfallId: winningCard.scryfallId,
        losingCardScryfallId: losingCard.scryfallId,
        ratingChange: ratingChange,
        winnerRating: winningCard.rating,
        loserRating: losingCard.rating,
      },
    });

    await vote.save();

    // Update stats
    await Stats.findOneAndUpdate(
      { key: "totalVotes" },
      { $inc: { value: 1 } },
      { upsert: true }
    );

    return {
      selectedCard: winningCardId,
      ratingChange: Math.round(ratingChange * 10) / 10, // Return with 1 decimal place for display
      winnerNewRating: Math.round(winningCard.rating * 10) / 10,
      loserNewRating: Math.round(losingCard.rating * 10) / 10,
    };
  } catch (error) {
    console.error("Error in processVote:", error);
    throw error;
  }
};
