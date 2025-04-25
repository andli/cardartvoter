class VoteController {
  constructor(voteService, cardService) {
    this.voteService = voteService;
    this.cardService = cardService;
  }

  async castVote(req, res) {
    const { cardId, selectedCardId } = req.body;

    try {
      // Validate that these cards were actually served to the user
      if (!req.session.currentPair) {
        return res.status(400).json({ error: "No active voting session" });
      }

      const { card1, card2, timestamp } = req.session.currentPair;

      // Validate the card pair
      const validPair =
        (selectedCardId === card1 && cardId === card2) ||
        (selectedCardId === card2 && cardId === card1);

      if (!validPair) {
        console.warn(
          `Invalid vote attempt: user tried to vote for ${selectedCardId} vs ${cardId}, but was shown ${card1} vs ${card2}`
        );
        return res
          .status(400)
          .json({ error: "Don't be a cheater. Invalid card pair." });
      }

      // Validate timestamp (prevent votes on stale pairs)
      const now = Date.now();
      if (now - timestamp > 3600000) {
        // 1 hour expiration
        return res.status(400).json({ error: "Voting session expired" });
      }

      // Clear the current pair to prevent duplicate votes
      req.session.currentPair = null;

      // Record the vote
      await this.voteService.recordVote(cardId, selectedCardId);

      // Update card rankings based on the vote
      await this.cardService.updateCardRankings(cardId, selectedCardId);

      res.status(200).json({ message: "Vote recorded successfully." });
    } catch (error) {
      res.status(500).json({ message: "Error recording vote.", error });
    }
  }

  async getVoteResults(req, res) {
    try {
      const results = await this.voteService.getVoteResults();
      res.status(200).json(results);
    } catch (error) {
      res.status(500).json({ message: "Error fetching vote results.", error });
    }
  }
}

// Fix export syntax to use CommonJS
const voteService = require("../services/voteService");
const cardService = require("../services/cardService");
const controller = new VoteController(voteService, cardService);

module.exports = controller;
