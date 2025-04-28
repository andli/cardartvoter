require("dotenv").config();
const mongoose = require("mongoose");
const axios = require("axios");
const Card = require("../models/Card");
const readline = require("readline");

// Command line arguments
const DRY_RUN = process.argv.includes("--dry-run");
const CONNECTION_STRING_ARG = process.argv.find((arg) =>
  arg.startsWith("--uri=")
);
const CONNECTION_STRING = CONNECTION_STRING_ARG
  ? CONNECTION_STRING_ARG.replace("--uri=", "")
  : null;

if (!CONNECTION_STRING) {
  console.error(
    "❌ ERROR: Connection string is required. Please provide --uri=mongodb://..."
  );
  console.error(
    "Example: node src/scripts/addSetCodes.js --uri=mongodb+srv://user:password@cluster.mongodb.net/dbname --dry-run"
  );
  process.exit(1);
}

if (DRY_RUN) {
  console.log("⚠️ DRY RUN MODE: No database changes will be made");
}

// Safety confirmation
async function confirmConnection() {
  // Extract database name from connection string (best effort)
  const dbName = CONNECTION_STRING.split("/").pop().split("?")[0];

  console.log(`⚠️ About to connect to database: ${dbName || "unknown"}`);
  console.log(
    `⚠️ Connection: ${CONNECTION_STRING.replace(/:([^\/]+)@/, ":*****@")}`
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Are you sure you want to proceed? (yes/no): ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes");
    });
  });
}

async function updateMissingSetCodes() {
  let connection;
  try {
    // Confirm before connecting
    if (!DRY_RUN) {
      const confirmed = await confirmConnection();
      if (!confirmed) {
        console.log("Operation cancelled by user");
        process.exit(0);
      }
    }

    // Connect with the provided connection string
    connection = await mongoose.connect(CONNECTION_STRING);
    console.log("Connected to MongoDB");

    // Rest of the function remains unchanged
    const missingSetCount = await Card.countDocuments({
      $or: [{ set: { $exists: false } }, { set: null }],
      setName: { $exists: true, $ne: null },
    });

    console.log(`Found ${missingSetCount} cards missing set code`);

    // Verify this matches what we expect
    if (missingSetCount === 0) {
      console.log("No cards need updating. Exiting.");
      return;
    }

    // Fetch set data from Scryfall API
    console.log("Fetching set data from Scryfall API...");
    const response = await axios.get("https://api.scryfall.com/sets");
    const setMap = {};

    // Build a map of setName to set code
    response.data.data.forEach((set) => {
      setMap[set.name] = set.code;
    });

    console.log(`Fetched ${Object.keys(setMap).length} sets from Scryfall API`);

    // Process cards in small batches to avoid memory issues
    const BATCH_SIZE = 100;
    let processed = 0;
    let updated = 0;
    let failed = 0;

    // Get distinct set names for missing cards
    const distinctSetNames = await Card.distinct("setName", {
      $or: [{ set: { $exists: false } }, { set: null }],
      setName: { $exists: true, $ne: null },
    });

    console.log(
      `Found ${distinctSetNames.length} distinct set names to process`
    );
    console.log(
      `Set names sample: ${distinctSetNames.slice(0, 5).join(", ")}${
        distinctSetNames.length > 5 ? "..." : ""
      }`
    );

    // Process each set name
    for (const setName of distinctSetNames) {
      const setCode = setMap[setName];

      if (setCode) {
        if (DRY_RUN) {
          // In dry run mode, just log what would happen
          const count = await Card.countDocuments({
            setName: setName,
            $or: [{ set: { $exists: false } }, { set: null }],
          });
          console.log(
            `Would update ${count} cards for set "${setName}" → "${setCode}" (DRY RUN)`
          );
          updated += count;
        } else {
          // Real update
          const result = await Card.updateMany(
            {
              setName: setName,
              $or: [{ set: { $exists: false } }, { set: null }],
            },
            { $set: { set: setCode } }
          );

          console.log(
            `Updated ${result.modifiedCount} cards for set "${setName}" → "${setCode}"`
          );
          updated += result.modifiedCount;
        }
      } else {
        // Log missing mappings
        const count = await Card.countDocuments({
          setName: setName,
          $or: [{ set: { $exists: false } }, { set: null }],
        });

        console.warn(
          `⚠️ No set code found for "${setName}" (${count} cards affected)`
        );
        failed += count;

        // Check for partial matches
        const possibleMatches = Object.keys(setMap).filter(
          (name) =>
            name
              .toLowerCase()
              .includes(setName.toLowerCase().replace(/[:\-]/g, " ")) ||
            setName
              .toLowerCase()
              .includes(name.toLowerCase().replace(/[:\-]/g, " "))
        );

        if (possibleMatches.length > 0) {
          console.log(`  Possible matches for "${setName}":`);
          possibleMatches.slice(0, 3).forEach((match) => {
            console.log(`    - "${match}" → ${setMap[match]}`);
          });
        }
      }

      processed++;
      if (processed % 10 === 0) {
        console.log(
          `Progress: ${processed}/${distinctSetNames.length} set names processed`
        );
      }
    }

    console.log("\n--- Summary ---");
    console.log(
      `${
        DRY_RUN ? "✅ Would have updated" : "✅ Successfully updated"
      } ${updated} cards`
    );
    console.log(
      `❌ ${
        DRY_RUN ? "Would fail to update" : "Failed to update"
      } ${failed} cards (missing set code mappings)`
    );
  } catch (error) {
    console.error("Error updating set codes:", error);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log("Disconnected from MongoDB");
    }
  }
}

updateMissingSetCodes().catch(console.error);
