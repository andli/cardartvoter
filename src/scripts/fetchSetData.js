const axios = require("axios");
const Set = require("../models/Set");
const mongoose = require("mongoose");
require("dotenv").config();

// Command line arguments
const CONNECTION_STRING_ARG = process.argv.find((arg) =>
  arg.startsWith("--uri=")
);
const CONNECTION_STRING = CONNECTION_STRING_ARG
  ? CONNECTION_STRING_ARG.replace("--uri=", "")
  : process.env.MONGODB_URI;

async function fetchSetData() {
  let connection;

  try {
    if (!CONNECTION_STRING) {
      console.error("❌ ERROR: MongoDB connection string is required.");
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    connection = await mongoose.connect(CONNECTION_STRING);
    console.log("Connected to MongoDB");

    console.log("Fetching set data from Scryfall API...");
    const response = await axios.get("https://api.scryfall.com/sets");
    const sets = response.data.data;

    console.log(`Found ${sets.length} sets`);

    // Process each set
    let created = 0;
    let updated = 0;

    for (const setData of sets) {
      const {
        code,
        name,
        set_type,
        released_at,
        card_count,
        digital,
        nonfoil_only,
        foil_only,
        icon_svg_uri,
      } = setData;

      // Calculate if this set should be filtered
      // We filter out token sets, memorabilia, and promo sets
      const shouldFilter = ["token", "memorabilia", "promo"].includes(set_type);

      // Update or create
      const result = await Set.updateOne(
        { code: code.toLowerCase() },
        {
          code: code.toLowerCase(),
          name,
          set_type,
          release_date: released_at,
          card_count,
          shouldFilter,
          digital: digital || false,
          nonfoil_only: nonfoil_only || false,
          foil_only: foil_only || false,
          icon_svg_uri,
        },
        { upsert: true }
      );

      if (result.upsertedCount) {
        created++;
      } else if (result.modifiedCount) {
        updated++;
      }
    }

    console.log(`Sets processed: ${created} created, ${updated} updated`);
  } catch (error) {
    console.error("Error fetching set data:", error);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log("Disconnected from MongoDB");
    }
  }
}

fetchSetData().catch(console.error);
