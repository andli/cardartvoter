class VoteController {
  constructor(voteService, cardService) {
    this.voteService = voteService;
    this.cardService = cardService;
  }

  // Add the missing function
  async showVotePage(req, res) {
    try {
      // Get two cards to compare
      const cardPair = await this.cardService.getCardPair();

      res.render("vote", {
        title: "Vote on Card Art",
        cards: cardPair || [
          // Fallback if no cards are available
          {
            id: "placeholder1",
            name: "Card 1",
            imageUrl: "https://via.placeholder.com/350x500",
          },
          {
            id: "placeholder2",
            name: "Card 2",
            imageUrl: "https://via.placeholder.com/350x500",
          },
        ],
      });
    } catch (error) {
      console.error("Error showing vote page:", error);
      res
        .status(500)
        .render("error", { message: "Failed to load voting page" });
    }
  }

  async castVote(req, res) {
    const { cardId, selectedCardId } = req.body;

    try {
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
