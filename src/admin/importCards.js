const axios = require("axios");
const Card = require("../models/Card");
const Set = require("../models/Set");

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

    const cardsResponse = await axios.get(artworkBulkData.download_uri);
    const allCards = cardsResponse.data;

    console.log(
      `Downloaded ${allCards.length} unique artwork cards from bulk data`
    );

    // NEW STEP: Get all filtered sets before processing
    const filteredSets = await Set.find({ shouldFilter: true })
      .select("code")
      .lean();
    const filteredSetCodes = new Set(filteredSets.map((s) => s.code));

    console.log(`Found ${filteredSetCodes.size} filtered sets to exclude`);

    // Pre-filter cards from filtered sets
    let cardsToImport = allCards.filter(
      (card) => !filteredSetCodes.has(card.set)
    );
    console.log(
      `Removed ${
        allCards.length - cardsToImport.length
      } cards from filtered sets`
    );

    // Step 3: Filter cards based on query if provided
    // Note: We're keeping filtering capability but removing default filters
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
        cardsToImport = cardsToImport.filter((card) => {
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

exports.importSetWithRateLimiting = async (setCode) => {
  try {
    // Check if this set should be filtered
    const setData = await Set.findOne({ code: setCode.toLowerCase() });

    if (setData?.shouldFilter) {
      console.log(`Set ${setCode} is marked for filtering. Skipping import.`);
      return 0; // Return 0 cards added
    }

    // Rest of your existing import code...
  } catch (error) {
    console.error("Error during set import:", error);
    throw error;
  }
};

module.exports = { importCardsWithRateLimiting };
