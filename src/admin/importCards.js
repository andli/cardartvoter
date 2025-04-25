const scryfallService = require("../services/scryfallService");
const cacheService = require("../services/cacheService");
const Card = require("../models/Card");
const axios = require("axios");

async function importCardsWithRateLimiting(query) {
  try {
    console.log(`Starting import for query: ${query}`);

    // Fetch cards from Scryfall
    const response = await axios.get(`https://api.scryfall.com/cards/search`, {
      params: { q: query, order: "released", dir: "desc" },
    });

    const cards = response.data.data;
    console.log(`Processing ${cards.length} cards`);

    let imported = 0;
    // Add delay between processing each card to respect rate limits
    for (const card of cards) {
      try {
        // Skip cards without images
        if (!card.image_uris || !card.image_uris.normal) {
          console.log(`Skipping ${card.name} - no standard image found`);
          continue;
        }

        // Check if already in DB
        const exists = await Card.findOne({ scryfallId: card.id }).lean();
        if (exists) {
          console.log(`Skipping ${card.name} - already exists`);
          continue;
        }

        // Create new card with imageUrl field
        const newCard = new Card({
          name: card.name,
          scryfallId: card.id,
          artist: card.artist || "Unknown",
          setName: card.set_name,
          collectorNumber: card.collector_number,
          rarity: card.rarity,
          enabled: true,
          // Add the missing imageUrl field
          imageUrl: card.image_uris.normal,
          rating: 1500, // Starting Elo rating
          comparisons: 0,
        });

        await newCard.save();
        imported++;

        // Add a delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`Error processing card ${card.name}:`, err.message);
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
