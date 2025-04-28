require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);

const ICONS_DIR = path.join(__dirname, "../public/images/set-icons");

async function downloadSetIcons() {
  try {
    // Make sure directory exists
    if (!(await exists(ICONS_DIR))) {
      await mkdir(ICONS_DIR, { recursive: true });
    }

    // First, test a few known sets to verify the API works
    console.log(
      "TESTING PHASE: Checking if Scryfall icon API is accessible..."
    );
    const testSets = ["one", "neo", "mkm", "dom", "ltr"]; // Modern sets likely to have icons
    let testSuccesses = 0;

    for (const testCode of testSets) {
      try {
        const testUrl = `https://svgs.scryfall.io/sets/${testCode}.svg`;
        console.log(`Testing: ${testUrl}`);

        const response = await axios.get(testUrl, {
          responseType: "arraybuffer",
          timeout: 3000,
        });

        if (response.status === 200) {
          console.log(`✅ Success: ${testCode} icon available`);
          testSuccesses++;

          // Save this test icon
          const outputPath = path.join(ICONS_DIR, `${testCode}.svg`);
          await writeFile(outputPath, response.data);
        }
      } catch (err) {
        console.error(`❌ Test failed for ${testCode}: ${err.message}`);
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    if (testSuccesses === 0) {
      console.error(
        "❌ All test downloads failed. Scryfall icon API may be unavailable."
      );
      console.error("Proceeding to create fallback icons for all sets...");
    } else {
      console.log(
        `✅ Test phase successful (${testSuccesses}/${testSets.length} icons downloaded)`
      );
    }

    // Get all sets from Scryfall
    console.log("\nMAIN PHASE: Fetching all sets from Scryfall API...");
    const response = await axios.get("https://api.scryfall.com/sets");
    const sets = response.data.data;

    console.log(`Found ${sets.length} sets from Scryfall API`);

    // Download each set icon
    let success = 0;
    let failed = 0;

    // Process all sets
    for (let i = 0; i < sets.length; i++) {
      const set = sets[i];
      const { code, name } = set;
      const setCode = code.toLowerCase();
      const outputPath = path.join(ICONS_DIR, `${setCode}.svg`);

      // Skip if we already downloaded this in test phase
      if (testSets.includes(setCode) && (await exists(outputPath))) {
        success++;
        continue;
      }

      try {
        const iconUrl = `https://svgs.scryfall.io/sets/${setCode}.svg`;

        const response = await axios
          .get(iconUrl, {
            responseType: "arraybuffer",
            timeout: 5000,
          })
          .catch((err) => {
            // If we get a 404, generate a fallback
            if (err.response && err.response.status === 404) {
              return { status: 404 };
            }
            throw err;
          });

        // If 404 response, create fallback
        if (response.status === 404) {
          createFallbackIcon(setCode, outputPath);
          console.log(
            `Created fallback for ${setCode} (${name}) - icon not found`
          );
        } else {
          // Got a valid icon
          await writeFile(outputPath, response.data);
          success++;

          if (success % 20 === 0 || i === sets.length - 1) {
            console.log(`Downloaded ${success}/${sets.length} set icons...`);
          }
        }
      } catch (err) {
        // Create fallback for any error
        console.log(`Error for ${setCode}: ${err.message}`);
        createFallbackIcon(setCode, outputPath);
        failed++;
      }

      // Be nice to Scryfall's API
      await new Promise((r) => setTimeout(r, 100));
    }

    console.log(`\nDownload summary:`);
    console.log(`✅ Successfully downloaded: ${success} icons`);
    console.log(`⚠️ Created fallbacks: ${sets.length - success} icons`);
  } catch (error) {
    console.error("Error downloading set icons:", error);
  }
}

// Helper to create fallback icons
async function createFallbackIcon(code, outputPath) {
  const shortName =
    code.length > 3 ? code.substring(0, 3).toUpperCase() : code.toUpperCase();
  const textSvg = `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    <rect width="28" height="28" rx="4" fill="#f8f9fa"/>
    <text x="14" y="19" font-family="Arial, sans-serif" font-size="${
      shortName.length > 2 ? "8" : "10"
    }" 
          text-anchor="middle" font-weight="bold" fill="#6c757d">${shortName}</text>
  </svg>`;

  await writeFile(outputPath, textSvg);
}

downloadSetIcons().catch(console.error);
