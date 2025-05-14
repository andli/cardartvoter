const Card = require("../models/Card");
const Vote = require("../models/Vote");
const Stats = require("../models/Stats");
const eloService = require("./eloService");

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

    // Use eloService to calculate new ratings
    const { newWinnerRating, newLoserRating, ratingChange } =
      eloService.processVote(
        {
          rating: winningCard.rating,
          comparisons: winningCard.comparisons,
        },
        {
          rating: losingCard.rating,
          comparisons: losingCard.comparisons,
        }
      );

    // Update ratings with values from eloService
    winningCard.rating = newWinnerRating;
    losingCard.rating = newLoserRating;

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
      ratingChange: ratingChange, // Already formatted by eloService
      winnerNewRating: winningCard.rating,
      loserNewRating: losingCard.rating,
    };
  } catch (error) {
    console.error("Error in processVote:", error);
    throw error;
  }
};
