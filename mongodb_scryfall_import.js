// mongodb_import.js
const { MongoClient } = require("mongodb");
const axios = require("axios");
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

// Get MongoDB URI from environment variable
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("ERROR: MONGODB_URI environment variable is not set");
  console.error(
    "Please create a .env file with your MongoDB connection string"
  );
  console.error(
    "Example: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/cardartvoter"
  );
  process.exit(1);
}

async function importCards() {
  // 1. Get the unique artwork bulk data URL
  console.log("Fetching bulk data URL...");
  const bulkDataResponse = await axios.get(
    "https://api.scryfall.com/bulk-data"
  );
  const artworkData = bulkDataResponse.data.data.find(
    (item) => item.type === "unique_artwork"
  );

  // 2. Download the bulk data file
  console.log(`Downloading artwork data from ${artworkData.download_uri}...`);
  const cardsResponse = await axios.get(artworkData.download_uri);
  const allCards = cardsResponse.data;

  // 3. Process cards
  console.log(`Processing ${allCards.length} cards...`);
  const processedCards = allCards
    .filter((card) => card.image_uris && card.image_uris.normal)
    .map((card) => ({
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
      createdAt: new Date(),
    }));

  // 4. Connect to MongoDB and import
  console.log("Connecting to MongoDB...");
  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db();
  const collection = db.collection("cards");

  // 5. Import in batches to avoid memory issues
  const batchSize = 1000;
  let imported = 0;

  for (let i = 0; i < processedCards.length; i += batchSize) {
    const batch = processedCards.slice(i, i + batchSize);

    // Use updateOne with upsert for each card to avoid duplicates
    const operations = batch.map((card) => ({
      updateOne: {
        filter: { scryfallId: card.scryfallId },
        update: { $setOnInsert: card },
        upsert: true,
      },
    }));

    const result = await collection.bulkWrite(operations);
    imported += result.upsertedCount;
    console.log(
      `Processed ${i + batch.length}/${processedCards.length} cards, upserted ${
        result.upsertedCount
      }`
    );
  }

  await client.close();
  console.log(`Import complete. Added ${imported} new cards.`);
}

importCards().catch(console.error);
