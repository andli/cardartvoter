const axios = require("axios");
const Card = require("../models/Card");

async function importCardsWithRateLimiting(query) {
  try {
    console.log(`Starting import with query: ${query || "default bulk data"}`);

    // Step 1: Get the latest bulk data information
    const bulkDataResponse = await axios.get(
      "https://api.scryfall.com/bulk-data"
    );
    const defaultBulkData = bulkDataResponse.data.data.find(
      (item) => item.type === "default_cards" // or "oracle_cards" for a smaller set
    );

    if (!defaultBulkData) {
      throw new Error("Could not find default bulk data download URL");
    }

    console.log(`Fetching bulk data from: ${defaultBulkData.download_uri}`);
    console.log(`Bulk data was updated at: ${defaultBulkData.updated_at}`);

    // Step 2: Download the bulk data (this can be several MB)
    const cardsResponse = await axios.get(defaultBulkData.download_uri);
    const allCards = cardsResponse.data;

    console.log(`Downloaded ${allCards.length} cards from bulk data`);

    // Step 3: Filter cards based on query if provided
    let cardsToImport = allCards;
    if (query) {
      // IMPORTANT: This is a very simplified query parser
      // For a real implementation, you'd need a more robust parser
      const filters = query
        .split(" ")
        .map((part) => {
          if (part.includes(":")) {
            const [field, value] = part.split(":");
            return { field, value, exclude: field.startsWith("-") };
          }
          return null;
        })
        .filter(Boolean);

      cardsToImport = allCards.filter((card) => {
        for (const filter of filters) {
          const field = filter.field.replace(/^-/, "");

          // Handle special cases
          if (field === "is" && filter.value === "booster") {
            const result = card.booster === true;
            return filter.exclude ? !result : result;
          }
          if (field === "is" && filter.value === "digital") {
            const result = card.digital === true;
            return filter.exclude ? !result : result;
          }
          if (field === "set") {
            const result = card.set === filter.value;
            return filter.exclude ? !result : result;
          }
        }
        return true;
      });

      console.log(
        `Filtered to ${cardsToImport.length} cards matching query: ${query}`
      );
    }

    // Step 4: Import the cards
    let imported = 0;

    for (const card of cardsToImport) {
      try {
        // Skip cards without images
        if (!card.image_uris || !card.image_uris.normal) {
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

        // Log progress
        if (imported % 100 === 0) {
          console.log(`Imported ${imported} cards so far`);
        }
      } catch (err) {
        console.error(
          `Error processing card ${card.name || "unknown"}:`,
          err.message
        );
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
