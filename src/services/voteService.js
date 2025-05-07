const Card = require("../models/Card");
const Vote = require("../models/Vote");
const Stats = require("../models/Stats");

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

    // Determine K-factor based on number of comparisons
    const getKFactor = (comparisons) => {
      if (comparisons < 10) return 48; // New cards
      if (comparisons < 30) return 32; // Establishing cards
      if (comparisons < 100) return 24; // Established cards
      return 16; // Well-established cards
    };

    const kFactor = getKFactor(
      Math.min(winningCard.comparisons, losingCard.comparisons)
    );

    // Calculate expected scores with the Elo formula
    const ratingDiff = winningCard.rating - losingCard.rating;
    const expectedWinnerScore = 1 / (1 + Math.pow(10, -ratingDiff / 400));

    // Calculate rating change
    const ratingChange = Math.round(kFactor * (1 - expectedWinnerScore));

    // Update ratings
    winningCard.rating += ratingChange;
    losingCard.rating -= ratingChange;

    // Ensure ratings stay within bounds
    winningCard.rating = Math.min(2000, Math.max(1000, winningCard.rating));
    losingCard.rating = Math.min(2000, Math.max(1000, losingCard.rating));

    // Increment comparison count
    winningCard.comparisons += 1;
    losingCard.comparisons += 1;

    // Save changes to the database
    await Promise.all([winningCard.save(), losingCard.save()]);

    // Record the vote - Fix: use cardId field as required by Vote schema
    const vote = new Vote({
      cardId: winningCard._id, // This matches the schema definition
      // Optional fields can be stored in a separate metadata field if needed
      metadata: {
        losingCardId: losingCard._id,
        winningCardScryfallId: winningCard.scryfallId,
        losingCardScryfallId: losingCard.scryfallId,
        ratingChange: ratingChange,
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
      ratingChange: ratingChange,
      winnerNewRating: winningCard.rating,
      loserNewRating: losingCard.rating,
    };
  } catch (error) {
    console.error("Error in processVote:", error);
    throw error;
  }
};
