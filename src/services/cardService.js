// This file contains business logic related to card operations, such as fetching cards from the Scryfall API.

const axios = require("axios");

class CardService {
  constructor() {
    this.scryfallBaseUrl = "https://api.scryfall.com";
  }

  async getCardPair() {
    try {
      // Get two random cards with artwork
      const card1 = await this.getRandomCard();
      const card2 = await this.getRandomCard();

      // Make sure we have two different cards
      if (card1.id === card2.id) {
        card2 = await this.getRandomCard();
      }

      return [card1, card2];
    } catch (error) {
      console.error("Error fetching card pair:", error);
      throw error;
    }
  }

  async getRandomCard() {
    try {
      // Only get cards that have art
      const response = await axios.get(
        `${this.scryfallBaseUrl}/cards/random?q=game:paper+has:image`
      );

      const card = response.data;

      // Format the card data for our needs
      return {
        id: card.id,
        name: card.name,
        set: card.set_name,
        artist: card.artist || "Unknown Artist",
        imageUrl:
          card.image_uris?.normal ||
          card.image_uris?.large ||
          card.image_uris?.png,
      };
    } catch (error) {
      console.error("Error fetching random card:", error);
      throw error;
    }
  }

  async fetchAllCards() {
    // Implementation for fetching all cards (paginated)
    return [];
  }

  async fetchCardById(id) {
    try {
      const response = await axios.get(`${this.scryfallBaseUrl}/cards/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching card ${id}:`, error);
      throw error;
    }
  }

  async compareCards(cardId1, cardId2) {
    // This would be implemented with your ELO algorithm later
    return { winner: cardId1, loser: cardId2 };
  }
}

module.exports = new CardService();
