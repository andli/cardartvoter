require("dotenv").config();
const mongoose = require("mongoose");
const Card = require("../models/Card");
const readline = require("readline");

// Command line arguments
const DRY_RUN = process.argv.includes("--dry-run");
const CONNECTION_STRING_ARG = process.argv.find((arg) => arg.startsWith("--uri="));
const CONNECTION_STRING = CONNECTION_STRING_ARG
  ? CONNECTION_STRING_ARG.replace("--uri=", "")
  : null;

// Default rating values
const OLD_MIN_RATING = 1000;
const OLD_MAX_RATING = 2000;
const OLD_DEFAULT_RATING = 1500;
const NEW_MIN_RATING = 0;
const NEW_MAX_RATING = 5000;
const NEW_DEFAULT_RATING = 2500;

// Rating scale factor
const SCALE_FACTOR = (NEW_MAX_RATING - NEW_MIN_RATING) / (OLD_MAX_RATING - OLD_MIN_RATING);

if (!CONNECTION_STRING) {
  console.error("❌ ERROR: Connection string is required. Please provide --uri=mongodb://...");
  console.error("Example: node src/scripts/migrateRatings.js --uri=XXXXX --dry-run");
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
  console.log(`⚠️ Connection: ${CONNECTION_STRING.replace(/:([^\/]+)@/, ":*****@")}`);
  console.log(`⚠️ This script will update ALL card ratings from ${OLD_MIN_RATING}-${OLD_MAX_RATING} to ${NEW_MIN_RATING}-${NEW_MAX_RATING}`);
  console.log(`⚠️ Default rating will change from ${OLD_DEFAULT_RATING} to ${NEW_DEFAULT_RATING}`);

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

// Convert an old rating to a new rating
function scaleRating(oldRating) {
  // Linear transformation
  // newRating = (oldRating - oldMin) * scaleFactor + newMin
  return (oldRating - OLD_MIN_RATING) * SCALE_FACTOR + NEW_MIN_RATING;
}

// Display a histogram of ratings
function displayHistogram(ratings, bucketSize = 100) {
  const histogram = {};
  let min = Math.floor(Math.min(...ratings) / bucketSize) * bucketSize;
  let max = Math.ceil(Math.max(...ratings) / bucketSize) * bucketSize;
  
  // Initialize buckets
  for (let i = min; i <= max; i += bucketSize) {
    histogram[i] = 0;
  }
  
  // Count ratings in each bucket
  ratings.forEach(rating => {
    const bucket = Math.floor(rating / bucketSize) * bucketSize;
    histogram[bucket] = (histogram[bucket] || 0) + 1;
  });
  
  // Find the maximum count for scaling the bars
  const maxCount = Math.max(...Object.values(histogram));
  const maxBarLength = 50; // Maximum length of histogram bars
  
  console.log("\n--- Rating Distribution ---");
  
  // Display histogram
  Object.keys(histogram).sort((a, b) => Number(a) - Number(b)).forEach(bucket => {
    const count = histogram[bucket];
    const percentage = (count / ratings.length * 100).toFixed(1);
    const barLength = Math.round((count / maxCount) * maxBarLength);
    const bar = '█'.repeat(barLength);
    console.log(`${bucket.toString().padStart(4)}-${(Number(bucket) + bucketSize - 1).toString().padStart(4)}: ${count.toString().padStart(5)} (${percentage.padStart(4)}%) ${bar}`);
  });
}

async function migrateRatings() {
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

    // Connect to the database
    connection = await mongoose.connect(CONNECTION_STRING);
    console.log("Connected to MongoDB");
    
    // Count total cards
    const totalCards = await Card.countDocuments();
    console.log(`Found ${totalCards} cards in the database`);
    
    // Get rating statistics before migration
    const oldRatings = await Card.find({}, 'rating').lean();
    const oldRatingValues = oldRatings.map(card => card.rating);
    
    const oldStats = {
      min: Math.min(...oldRatingValues),
      max: Math.max(...oldRatingValues),
      avg: oldRatingValues.reduce((sum, val) => sum + val, 0) / oldRatingValues.length,
      median: oldRatingValues.sort((a, b) => a - b)[Math.floor(oldRatingValues.length / 2)],
      count: oldRatingValues.length
    };
    
    console.log("\n--- Current Rating Statistics ---");
    console.log(`Min: ${oldStats.min.toFixed(2)}`);
    console.log(`Max: ${oldStats.max.toFixed(2)}`);
    console.log(`Avg: ${oldStats.avg.toFixed(2)}`);
    console.log(`Median: ${oldStats.median.toFixed(2)}`);
    
    // Show histogram of current ratings
    displayHistogram(oldRatingValues);
    
    // Calculate what the new ratings would be
    const newRatingValues = oldRatingValues.map(rating => scaleRating(rating));
    
    const newStats = {
      min: Math.min(...newRatingValues),
      max: Math.max(...newRatingValues),
      avg: newRatingValues.reduce((sum, val) => sum + val, 0) / newRatingValues.length,
      median: newRatingValues.sort((a, b) => a - b)[Math.floor(newRatingValues.length / 2)]
    };
    
    console.log("\n--- Projected New Rating Statistics ---");
    console.log(`Min: ${newStats.min.toFixed(2)}`);
    console.log(`Max: ${newStats.max.toFixed(2)}`);
    console.log(`Avg: ${newStats.avg.toFixed(2)}`);
    console.log(`Median: ${newStats.median.toFixed(2)}`);
    
    // Show histogram of projected new ratings
    displayHistogram(newRatingValues, 500);

    if (DRY_RUN) {
      console.log("\n⚠️ DRY RUN: No changes were made to the database");
      return;
    }
    
    console.log("\nUpdating card ratings...");
    
    // Perform the update - Using MongoDB's aggregation pipeline to transform the data
    const result = await Card.updateMany(
      {}, 
      [
        { 
          $set: { 
            rating: { 
              $add: [
                { 
                  $multiply: [
                    { $subtract: ["$rating", OLD_MIN_RATING] }, 
                    SCALE_FACTOR
                  ]
                },
                NEW_MIN_RATING
              ]
            } 
          }
        }
      ]
    );
    
    console.log(`✅ Successfully updated ${result.modifiedCount} of ${result.matchedCount} cards`);
    
    // Update the default rating for new cards in the Card model
    console.log(`Updating schema default rating to ${NEW_DEFAULT_RATING}...`);
    
    // We can't update the schema default directly, but we've already updated this in the Card model file
    console.log("✅ Remember to update the Card model's default rating in the schema!");

    // Verify a few random cards to confirm the transformation worked
    const sampleCards = await Card.find().sort({ comparisons: -1 }).limit(5).lean();
    console.log("\n--- Sample Updated Cards ---");
    sampleCards.forEach(card => {
      console.log(`${card.name}: Rating = ${card.rating.toFixed(2)}, Comparisons = ${card.comparisons}`);
    });
    
  } catch (error) {
    console.error("Error migrating ratings:", error);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log("Disconnected from MongoDB");
    }
  }
}

// Execute the migration
migrateRatings().catch(console.error);