const express = require("express");
const router = express.Router();
const {
  importSetWithRateLimiting,
  importCardsWithRateLimiting,
} = require("../admin/importCards");
const Card = require("../models/Card");
const Set = require("../models/Set");
const storage = require("../utils/storage");
const axios = require("axios");

// Simple admin auth middleware
const adminAuth = (req, res, next) => {
  if (req.query.key === process.env.ADMIN_KEY) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
};

// Modified route to import cards by set (works within serverless limits)
router.post("/import-set", adminAuth, async (req, res) => {
  try {
    const setCode = req.body.set || req.query.set;

    if (!setCode) {
      return res.status(400).json({
        success: false,
        message: "Set code is required (e.g. ?set=woe for Wilds of Eldraine)",
      });
    }

    console.log(`Starting import for set: ${setCode}`);
    const added = await importSetWithRateLimiting(setCode);

    res.json({
      success: true,
      message: `Successfully imported ${added} cards from set ${setCode}`,
      added,
    });
  } catch (error) {
    console.error("Import failed:", error);
    res.status(500).json({
      success: false,
      message: "Import failed",
      error: error.message,
    });
  }
});

// Test route to check if admin route is working
router.get("/test", (req, res) => {
  res.json({ message: "Admin route is working" });
});

// Add this route to your existing admin.js file

// Initialize or refresh stats
router.post("/refresh-stats", adminAuth, async (req, res) => {
  try {
    console.log("Admin request to refresh statistics counts");

    const statsService = require("../services/statsService");

    // Use the updated methods with proper error handling
    const cardCount = await statsService.getCardCount(true);
    console.log(`Refreshed card count: ${cardCount}`);

    const voteCount = await statsService.getVoteCount(true);
    console.log(`Refreshed vote count: ${voteCount}`);

    res.json({
      success: true,
      message: "Statistics refreshed successfully",
      stats: {
        cardCount,
        voteCount,
      },
    });
  } catch (error) {
    console.error("Error refreshing stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh statistics",
      error: error.message,
    });
  }
});

// Add this route to your existing admin.js file

// Update sets data from Scryfall
router.post("/update-sets", adminAuth, async (req, res) => {
  try {
    console.log("Admin request to update set data from Scryfall");

    // Fetch set data from Scryfall
    console.log("Fetching set data from Scryfall API...");
    const response = await axios.get("https://api.scryfall.com/sets");
    const sets = response.data.data;

    console.log(`Found ${sets.length} sets from Scryfall`);

    // Prepare bulk operations
    const bulkOps = [];

    // Create operations for each set
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
      const filteredSetTypes = [
        "token",
        "memorabilia",
        "promo",
        "alchemy",
        "minigame",
      ];

      // Filter out both specific set types AND any digital sets
      const shouldFilter =
        filteredSetTypes.includes(set_type) || digital === true;

      // Add to bulk operations array
      bulkOps.push({
        updateOne: {
          filter: { code: code.toLowerCase() },
          update: {
            $set: {
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
          },
          upsert: true,
        },
      });
    }

    // Execute all updates in a single database call!
    console.log(`Executing bulk operation for ${bulkOps.length} sets`);
    const result = await Set.bulkWrite(bulkOps);

    res.json({
      success: true,
      message: `Sets processed successfully`,
      stats: {
        total: sets.length,
        inserted: result.upsertedCount,
        modified: result.modifiedCount,
        matched: result.matchedCount,
      },
    });
  } catch (error) {
    console.error("Error updating sets:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update sets",
      error: error.message,
    });
  }
});

// Add this new admin route
router.post("/download-set-icons", adminAuth, async (req, res) => {
  try {
    // Add this line to define isDev
    const isDev = process.env.NODE_ENV !== "production";

    console.log(
      `Admin request to download set icons (${
        isDev ? "development" : "production"
      } mode)`
    );

    // Get all sets from the database
    const sets = await Set.find({ shouldFilter: false }).lean();
    console.log(`Found ${sets.length} sets to process`);

    let downloaded = 0;
    let failed = 0;
    let skipped = 0;

    // Process each set
    for (const set of sets) {
      try {
        if (!set.code) {
          skipped++;
          continue;
        }

        const setCode = set.code.toLowerCase();
        const iconName = `${setCode}.svg`;

        // Check if we already have this icon
        if (await storage.iconExists(setCode)) {
          skipped++;
          continue;
        }

        // Construct icon URL
        const iconUrl = `https://svgs.scryfall.io/sets/${setCode}.svg`;

        // Fetch the icon
        const response = await axios
          .get(iconUrl, {
            responseType: "arraybuffer",
            validateStatus: (status) => status === 200,
          })
          .catch(() => null);

        if (!response || !response.data) {
          failed++;
          continue;
        }

        // Store in appropriate storage based on environment
        await storage.storeIcon(iconName, response.data);
        downloaded++;

        // Add small delay to be nice to Scryfall
        await new Promise((r) => setTimeout(r, 100));

        // Log progress periodically
        if (downloaded % 10 === 0) {
          console.log(`Downloaded ${downloaded} icons so far...`);
        }
      } catch (err) {
        console.error(`Error processing set ${set.code}:`, err);
        failed++;
      }
    }

    res.json({
      success: true,
      message: `Set icons processed: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`,
      stats: { downloaded, skipped, failed, total: sets.length },
    });
  } catch (error) {
    console.error("Error downloading set icons:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download set icons",
      error: error.message,
    });
  }
});

// Add this route to update card filters based on set data
router.post("/update-card-filters", adminAuth, async (req, res) => {
  try {
    console.log("Admin request to update card filtering based on set data");

    // Get all filtered sets
    const filteredSets = await Set.find({ shouldFilter: true })
      .select("code")
      .lean();
    const filteredSetCodes = filteredSets.map((s) => s.code);

    console.log(`Found ${filteredSetCodes.length} filtered sets`);

    // Disable cards from filtered sets
    const result = await Card.updateMany(
      { set: { $in: filteredSetCodes } },
      { $set: { enabled: false } }
    );

    // Re-enable cards from non-filtered sets (in case set filter status changed)
    const enableResult = await Card.updateMany(
      { set: { $nin: filteredSetCodes }, enabled: false },
      { $set: { enabled: true } }
    );

    res.json({
      success: true,
      message: "Card filters updated successfully",
      stats: {
        disabledCards: result.modifiedCount,
        enabledCards: enableResult.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Error updating card filters:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update card filters",
      error: error.message,
    });
  }
});

// Import cards from all sets
router.post("/import-all-sets", adminAuth, async (req, res) => {
  try {
    console.log("Starting import for all sets");

    // Get all sets that aren't filtered
    const sets = await Set.find({ shouldFilter: false }).lean();
    console.log(`Found ${sets.length} sets to import`);

    // Track progress
    const results = {
      totalSets: sets.length,
      completedSets: 0,
      failedSets: 0,
      totalCardsAdded: 0,
      failedSetCodes: [],
    };

    // Send initial response to avoid timeout
    res.write(
      JSON.stringify({
        success: true,
        message: `Started importing ${sets.length} sets. This process will continue in the background.`,
        sets: sets.length,
      })
    );
    res.end();

    // Process sets sequentially to avoid rate limiting issues
    for (const set of sets) {
      try {
        const setCode = set.code.toLowerCase();
        console.log(
          `Importing set ${setCode} (${results.completedSets + 1}/${
            results.totalSets
          })`
        );

        // Import the set
        const added = await importSetWithRateLimiting(setCode);

        // Update progress
        results.completedSets++;
        results.totalCardsAdded += added;

        // Add delay between sets to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));

        console.log(`Completed ${setCode}: Added ${added} cards`);
      } catch (error) {
        console.error(`Failed to import set ${set.code}:`, error);
        results.failedSets++;
        results.failedSetCodes.push(set.code);
      }
    }

    // Log final results
    console.log(
      `Import all sets completed: ${results.completedSets} sets processed successfully, ${results.failedSets} failed`
    );
    console.log(`Total cards added: ${results.totalCardsAdded}`);

    // Update stats after import
    const statsService = require("../services/statsService");
    await statsService.getCardCount(true);
  } catch (error) {
    console.error("Import all sets failed:", error);
  }
});

module.exports = router;
