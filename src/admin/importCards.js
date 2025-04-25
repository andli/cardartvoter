const axios = require("axios");
const Card = require("../models/Card");

/**
 * Import cards for a specific set (Vercel-friendly)
 */
async function importSetWithRateLimiting(setCode) {
  try {
    console.log(`Importing cards from set: ${setCode}`);

    // Use search API instead of bulk data
    const searchUrl = `https://api.scryfall.com/cards/search?q=set:${setCode}`;
    console.log(`Fetching cards from: ${searchUrl}`);

    const response = await axios.get(searchUrl);
    const cards = response.data.data || [];

    console.log(`Found ${cards.length} cards in set ${setCode}`);

    let imported = 0;

    for (const card of cards) {
      try {
        // Skip cards without images or digital-only cards
        if (!card.image_uris || !card.image_uris.normal || card.digital) {
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
          artist: card.artist || "Unknown",
          setName: card.set_name,
          collectorNumber: card.collector_number,
          rarity: card.rarity,
          enabled: true,
          imageUrl: card.image_uris.normal,
          rating: 1500,
          comparisons: 0,
        });

        await newCard.save();
        imported++;
      } catch (err) {
        console.error(
          `Error processing card ${card.name || "unknown"}:`,
          err.message
        );
      }
    }

    console.log(
      `Import completed. Added ${imported} new cards from set ${setCode}.`
    );
    return imported;
  } catch (error) {
    console.error(`Error importing set ${setCode}:`, error);
    throw error;
  }
}

// Export both functions
module.exports = {
  importCardsWithRateLimiting,
  importSetWithRateLimiting,
};
