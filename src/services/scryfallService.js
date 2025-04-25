// src/services/scryfallService.js
const axios = require('axios');

const ScryfallAPI = axios.create({
    baseURL: 'https://api.scryfall.com',
});

class ScryfallService {
    async fetchCardById(cardId) {
        try {
            const response = await ScryfallAPI.get(`/cards/${cardId}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching card with ID ${cardId}:`, error);
            throw error;
        }
    }

    async searchCards(query) {
        try {
            const response = await ScryfallAPI.get('/cards/search', {
                params: { q: query },
            });
            return response.data;
        } catch (error) {
            console.error(`Error searching for cards with query "${query}":`, error);
            throw error;
        }
    }

    async fetchRandomCard() {
        try {
            const response = await ScryfallAPI.get('/cards/random');
            return response.data;
        } catch (error) {
            console.error('Error fetching a random card:', error);
            throw error;
        }
    }
}

module.exports = new ScryfallService();