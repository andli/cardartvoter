const scryfallService = require("../services/scryfallService");
const cacheService = require("../services/cacheService");
const Card = require("../models/Card");

async function importCardsWithRateLimiting(query) {
  try {
    console.log(`Starting import for query: ${query}`);

    // Use cached results if available (1 hour cache for searches)
    const cacheKey = `search:${query}`;
    let searchResults = cacheService.get(cacheKey);

    if (!searchResults) {
      console.log("No cached results, fetching from Scryfall");
      searchResults = await scryfallService.searchCards(query);
      cacheService.set(cacheKey, searchResults, 60 * 60); // 1 hour cache
    } else {
      console.log("Using cached search results");
    }

    const cards = searchResults.data;
    console.log(`Processing ${cards.length} cards`);

    let imported = 0;
    for (const card of cards) {
      // Skip digital-only cards, tokens, etc.
      if (card.digital || card.layout === "token") {
        continue;
      }

      // Check if already in DB
      const exists = await Card.findOne({ scryfallId: card.id }).lean();
      if (exists) {
        continue;
      }

      // Create new card
      const newCard = new Card({
        name: card.name,
        scryfallId: card.id,
        artist: card.artist,
        setName: card.set_name,
        collectorNumber: card.collector_number,
        rarity: card.rarity,
        enabled: true,
        rating: 1500, // Starting Elo rating
        comparisons: 0,
      });

      await newCard.save();
      imported++;

      // Log progress every 10 cards
      if (imported % 10 === 0) {
        console.log(`Imported ${imported} cards so far`);
      }
    }

    console.log(`Import completed. Added ${imported} new cards.`);
    return imported;
  } catch (error) {
    console.error("Error during card import:", error);
    throw error;
  }
}

module.exports = { importCardsWithRateLimiting };
