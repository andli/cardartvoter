const axios = require("axios");
const Card = require("../models/Card");

async function importCardsWithRateLimiting(query) {
  try {
    console.log(
      `Starting import with query: ${query || "unique artwork bulk data"}`
    );

    // Step 1: Get the latest bulk data information
    const bulkDataResponse = await axios.get(
      "https://api.scryfall.com/bulk-data"
    );

    // Changed to use unique_artwork instead of default_cards
    const artworkBulkData = bulkDataResponse.data.data.find(
      (item) => item.type === "unique_artwork"
    );

    if (!artworkBulkData) {
      throw new Error("Could not find unique artwork bulk data download URL");
    }

    console.log(
      `Fetching unique artwork bulk data from: ${artworkBulkData.download_uri}`
    );
    console.log(`Bulk data was updated at: ${artworkBulkData.updated_at}`);

    // Step 2: Download the bulk data (214 MB according to your message)
    const cardsResponse = await axios.get(artworkBulkData.download_uri);
    const allCards = cardsResponse.data;

    console.log(
      `Downloaded ${allCards.length} unique artwork cards from bulk data`
    );

    // Step 3: Filter cards based on query if provided
    // Note: We're keeping filtering capability but removing default filters
    let cardsToImport = allCards;
    if (query && query !== "unique_artwork") {
      // This allows for custom queries but doesn't default to any filters
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

      // Only apply filtering if we actually have filters
      if (filters.length > 0) {
        console.log(`Applying custom filters: ${query}`);
        cardsToImport = allCards.filter((card) => {
          for (const filter of filters) {
            const field = filter.field.replace(/^-/, "");

            // Simple filtering logic for common fields
            if (field === "set") {
              const result = card.set === filter.value;
              return filter.exclude ? !result : result;
            }

            // Add other field filters as needed
          }
          return true;
        });
      }
    }

    console.log(`Preparing to import ${cardsToImport.length} cards`);

    // Step 4: Import the filtered cards
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

        // Log progress periodically
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

    console.log(
      `Import completed. Added ${imported} new unique artwork cards.`
    );
    return imported;
  } catch (error) {
    console.error("Error during card import:", error);
    throw error;
  }
}

module.exports = { importCardsWithRateLimiting };
