// src/services/scryfallService.js
const axios = require("axios");
const { setTimeout } = require("timers/promises");

class ScryfallService {
  constructor() {
    this.baseUrl = "https://api.scryfall.com";
    this.userAgent = "CardArtVoter/1.0 (your-email@example.com)";
    this.requestQueue = [];
    this.processing = false;

    // Configure rate limiting - 50-100ms between requests
    this.requestDelay = 100; // milliseconds
  }

  /**
   * Queue a request to Scryfall with proper rate limiting
   */
  async queueRequest(endpoint, params = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ endpoint, params, resolve, reject });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the queue of Scryfall requests with proper delays
   */
  async processQueue() {
    if (this.requestQueue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const { endpoint, params, resolve, reject } = this.requestQueue.shift();

    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        params,
        headers: {
          "User-Agent": this.userAgent,
        },
      });

      resolve(response.data);
    } catch (error) {
      console.error(`Scryfall API error: ${error.message}`);
      reject(error);
    }

    // Wait before processing next request
    await setTimeout(this.requestDelay);
    this.processQueue();
  }

  /**
   * Get card data by Scryfall ID
   */
  async getCardById(scryfallId) {
    return this.queueRequest(`/cards/${scryfallId}`);
  }

  /**
   * Search for cards with advanced filtering
   */
  async searchCards(query) {
    return this.queueRequest("/cards/search", { q: query });
  }
}

module.exports = new ScryfallService();
