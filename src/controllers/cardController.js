class CardController {
  constructor(cardService) {
    this.cardService = cardService;
  }

  async getAllCards(req, res) {
    try {
      const cards = await this.cardService.fetchAllCards();
      res.status(200).json(cards);
    } catch (error) {
      res.status(500).json({ message: "Error fetching cards", error });
    }
  }

  async getCardById(req, res) {
    const { id } = req.params;
    try {
      const card = await this.cardService.fetchCardById(id);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      res.status(200).json(card);
    } catch (error) {
      res.status(500).json({ message: "Error fetching card", error });
    }
  }

  async compareCards(req, res) {
    const { cardId1, cardId2 } = req.body;
    try {
      const comparisonResult = await this.cardService.compareCards(
        cardId1,
        cardId2
      );
      res.status(200).json(comparisonResult);
    } catch (error) {
      res.status(500).json({ message: "Error comparing cards", error });
    }
  }
}

// Import dependencies
const cardService = require("../services/cardService");

// Export using CommonJS pattern
module.exports = new CardController(cardService);
