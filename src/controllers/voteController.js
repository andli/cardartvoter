class VoteController {
  constructor(voteService, cardService) {
    this.voteService = voteService;
    this.cardService = cardService;
  }

  async castVote(req, res) {
    const { cardId, selectedCardId } = req.body;

    try {
      // Log the request data and session for debugging
      console.log("Vote request:", { cardId, selectedCardId });
      console.log("Session pair:", req.session?.currentPair);

      // Strict validation
      if (!req.session || !req.session.currentPair) {
        console.warn("Vote attempt with no active session");
        return res.status(403).json({ error: "Invalid voting session" });
      }

      const { card1, card2, timestamp } = req.session.currentPair;

      // CRITICAL: Exact string matching for the IDs
      const validPair =
        (selectedCardId === card1 && cardId === card2) ||
        (selectedCardId === card2 && cardId === card1);

      if (!validPair) {
        console.warn(
          `SECURITY ALERT: Invalid vote attempt. Got ${selectedCardId} vs ${cardId}, expected ${card1} vs ${card2}`
        );
        return res.status(403).json({ error: "Invalid card pair" });
      }

      // Prevent old session reuse
      const now = Date.now();
      if (now - timestamp > 300000) {
        // 5 minutes expiration
        return res.status(403).json({ error: "Voting session expired" });
      }

      // Clear the pair to prevent reuse
      req.session.currentPair = null;
      await new Promise((resolve) => req.session.save(resolve));

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
