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
        block,
        block_code,
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
              block,
              block_code,
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

// Add this route to filter a specific set by code
router.post("/filter-set", adminAuth, async (req, res) => {
  try {
    const setCode = req.body.set || req.query.set;

    if (!setCode) {
      return res.status(400).json({
        success: false,
        message: "Set code is required (e.g. ?set=woe for Wilds of Eldraine)",
      });
    }

    console.log(`Admin request to filter set with code: ${setCode}`);

    // Find and update the set
    const result = await Set.findOneAndUpdate(
      { code: setCode.toLowerCase() },
      { $set: { shouldFilter: true } },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: `Set with code ${setCode} not found`,
      });
    }

    // Also disable all cards from this set
    const cardResult = await Card.updateMany(
      { set: setCode.toLowerCase() },
      { $set: { enabled: false } }
    );

    res.json({
      success: true,
      message: `Set ${setCode} (${result.name}) has been marked as filtered`,
      set: result,
      cardsDisabled: cardResult.modifiedCount,
    });
  } catch (error) {
    console.error("Error filtering set:", error);
    res.status(500).json({
      success: false,
      message: "Failed to filter set",
      error: error.message,
    });
  }
});

// Add this route to unfilter a specific set by code (allows including promo sets)
router.post("/unfilter-set", adminAuth, async (req, res) => {
  try {
    const setCode = req.body.set || req.query.set;

    if (!setCode) {
      return res.status(400).json({
        success: false,
        message: "Set code is required (e.g. ?set=sld for Secret Lair Drop)",
      });
    }

    console.log(`Admin request to unfilter set with code: ${setCode}`);

    // Find the set first to get information
    const set = await Set.findOne({ code: setCode.toLowerCase() });

    if (!set) {
      return res.status(404).json({
        success: false,
        message: `Set with code ${setCode} not found`,
      });
    }

    // Check if it's a promo set (for informational purposes)
    const isPromo = set.set_type === "promo";

    // Update the set to not be filtered regardless of its type
    const result = await Set.findOneAndUpdate(
      { code: setCode.toLowerCase() },
      { $set: { shouldFilter: false } },
      { new: true }
    );

    // Also enable all cards from this set
    const cardResult = await Card.updateMany(
      { set: setCode.toLowerCase() },
      { $set: { enabled: true } }
    );

    res.json({
      success: true,
      message: `Set ${setCode} (${result.name}) has been unfiltered${
        isPromo ? " despite being a promo set" : ""
      }`,
      set: result,
      cardsEnabled: cardResult.modifiedCount,
      isPromo,
    });
  } catch (error) {
    console.error("Error unfiltering set:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unfilter set",
      error: error.message,
    });
  }
});

// Add this route to list all filtered and promo sets
router.get("/filtered-sets", adminAuth, async (req, res) => {
  try {
    // Get all sets, including filtering status and type
    const sets = await Set.find({})
      .select("code name set_type shouldFilter")
      .lean();

    // Separate into categories
    const filteredSets = sets.filter((set) => set.shouldFilter);
    const promoSets = sets.filter((set) => set.set_type === "promo");
    const unfilteredPromoSets = promoSets.filter((set) => !set.shouldFilter);

    res.json({
      success: true,
      stats: {
        totalSets: sets.length,
        filteredSets: filteredSets.length,
        promoSets: promoSets.length,
        unfilteredPromoSets: unfilteredPromoSets.length,
      },
      filteredSets,
      promoSets,
      unfilteredPromoSets,
    });
  } catch (error) {
    console.error("Error listing filtered sets:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list filtered sets",
      error: error.message,
    });
  }
});

// Add this route to list all excluded sets with detailed information
router.get("/excluded-sets", adminAuth, async (req, res) => {
  try {
    // Get all sets with relevant filtering information
    const allSets = await Set.find({})
      .select('code name set_type block block_code release_date card_count shouldFilter digital')
      .sort({ shouldFilter: -1, set_type: 1, release_date: -1 })
      .lean();
    
    // Get counts of cards per set (including disabled ones)
    const cardCounts = await Card.aggregate([
      { $group: { 
        _id: "$set", 
        totalCards: { $sum: 1 },
        enabledCards: { 
          $sum: { $cond: [{ $eq: ["$enabled", true] }, 1, 0] } 
        }
      }}
    ]);
    
    // Create a map for easy lookup
    const cardCountMap = {};
    cardCounts.forEach(item => {
      cardCountMap[item._id] = {
        totalCards: item.totalCards,
        enabledCards: item.enabledCards
      };
    });
    
    // Enhance set data with card counts
    const enhancedSets = allSets.map(set => {
      const cardData = cardCountMap[set.code] || { totalCards: 0, enabledCards: 0 };
      return {
        ...set,
        cardCounts: cardData,
        exclusionReason: getExclusionReason(set)
      };
    });
    
    // Separate into different categories
    const excludedSets = enhancedSets.filter(set => set.shouldFilter);
    const includedSets = enhancedSets.filter(set => !set.shouldFilter);
    
    // Further categorize excluded sets by reason
    const excludedByType = excludedSets.filter(set => 
      ["token", "memorabilia", "promo", "alchemy", "minigame"].includes(set.set_type));
    const excludedDigital = excludedSets.filter(set => set.digital && !excludedByType.includes(set));
    const excludedOther = excludedSets.filter(set => 
      !excludedByType.includes(set) && !excludedDigital.includes(set));
    
    // Stats
    const stats = {
      totalSets: allSets.length,
      includedSets: includedSets.length,
      excludedSets: excludedSets.length,
      excludedByType: {
        total: excludedByType.length,
        token: excludedByType.filter(s => s.set_type === "token").length,
        promo: excludedByType.filter(s => s.set_type === "promo").length,
        memorabilia: excludedByType.filter(s => s.set_type === "memorabilia").length,
        alchemy: excludedByType.filter(s => s.set_type === "alchemy").length,
        minigame: excludedByType.filter(s => s.set_type === "minigame").length
      },
      excludedDigital: excludedDigital.length,
      excludedOther: excludedOther.length,
      blocks: getBlockStats(allSets)
    };

    res.json({
      success: true,
      stats,
      excludedSets,
      excludedByType,
      excludedDigital,
      excludedOther,
      includedSets
    });
  } catch (error) {
    console.error("Error listing excluded sets:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list excluded sets",
      error: error.message,
    });
  }
});

// Helper function to determine exclusion reason
function getExclusionReason(set) {
  if (!set.shouldFilter) return "Not excluded";
  
  const filteredSetTypes = ["token", "memorabilia", "promo", "alchemy", "minigame"];
  
  if (filteredSetTypes.includes(set.set_type)) {
    return `Set type: ${set.set_type}`;
  }
  
  if (set.digital) {
    return "Digital-only set";
  }
  
  return "Manually excluded";
}

// Helper function to get block statistics
function getBlockStats(sets) {
  const blockMap = {};
  
  sets.forEach(set => {
    if (set.block) {
      if (!blockMap[set.block]) {
        blockMap[set.block] = {
          name: set.block,
          code: set.block_code,
          total: 0,
          included: 0,
          excluded: 0
        };
      }
      
      blockMap[set.block].total++;
      if (set.shouldFilter) {
        blockMap[set.block].excluded++;
      } else {
        blockMap[set.block].included++;
      }
    }
  });
  
  return Object.values(blockMap);
}

module.exports = router;
