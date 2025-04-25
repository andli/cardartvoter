const axios = require("axios");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Card = require("../models/Card");
require("dotenv").config();

async function fetchBulkData() {
  try {
    console.log("Fetching bulk data information...");
    const bulkInfoResponse = await axios.get(
      "https://api.scryfall.com/bulk-data"
    );

    // Find the unique artwork data
    const uniqueArtworkData = bulkInfoResponse.data.data.find(
      (item) => item.type === "unique_artwork"
    );

    if (!uniqueArtworkData) {
      throw new Error("Could not find unique artwork bulk data");
    }

    console.log(`Found unique artwork data: ${uniqueArtworkData.download_uri}`);
    console.log(`Last updated: ${uniqueArtworkData.updated_at}`);
    console.log(
      `Size: ${(uniqueArtworkData.size / 1024 / 1024).toFixed(2)} MB`
    );

    return uniqueArtworkData;
  } catch (error) {
    console.error("Error fetching bulk data info:", error);
    throw error;
  }
}

async function downloadAndImportCards() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const bulkData = await fetchBulkData();

    console.log("Downloading unique artwork data...");
    const response = await axios.get(bulkData.download_uri, {
      responseType: "json",
    });

    const cards = response.data;
    console.log(`Downloaded ${cards.length} cards with unique artwork`);

    // Filter out unwanted cards
    const filteredCards = cards.filter((card) => {
      // Skip cards without images
      if (!card.image_uris || !card.image_uris.large) {
        return false;
      }

      // Skip tokens and emblems
      if (
        card.layout === "token" ||
        card.layout === "emblem" ||
        card.type_line.includes("Token") ||
        card.type_line.includes("Emblem")
      ) {
        return false;
      }

      // Skip cards without artists
      if (!card.artist) {
        return false;
      }

      return true;
    });

    console.log(`Filtered to ${filteredCards.length} valid cards`);

    // Transform to our schema
    const cardDocuments = filteredCards.map((card) => ({
      scryfallId: card.id,
      name: card.name,
      artist: card.artist,
      imageUrl: card.image_uris.large || card.image_uris.normal,
      set: card.set,
      setName: card.set_name,
      rating: 1500,
      comparisons: 0,
      enabled: true,
    }));

    // Check for existing cards
    const existingIds = await Card.distinct("scryfallId");
    const newCards = cardDocuments.filter(
      (card) => !existingIds.includes(card.scryfallId)
    );

    console.log(`Found ${newCards.length} new cards to add`);

    if (newCards.length > 0) {
      // Insert in batches
      const batchSize = 500;
      for (let i = 0; i < newCards.length; i += batchSize) {
        const batch = newCards.slice(i, i + batchSize);
        await Card.insertMany(batch);
        console.log(
          `Imported batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(
            newCards.length / batchSize
          )}`
        );
      }
    }

    console.log("Import complete!");
    mongoose.connection.close();

    return {
      processed: filteredCards.length,
      added: newCards.length,
    };
  } catch (error) {
    console.error("Import failed:", error);
    if (mongoose.connection.readyState === 1) {
      mongoose.connection.close();
    }
    throw error;
  }
}

// If this file is run directly (not imported)
if (require.main === module) {
  downloadAndImportCards()
    .then((result) => {
      console.log(
        `Import summary: ${result.processed} cards processed, ${result.added} new cards added`
      );
    })
    .catch((err) => {
      console.error("Import failed:", err);
      process.exit(1);
    });
}

module.exports = { downloadAndImportCards };
