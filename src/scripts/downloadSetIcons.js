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

    // Get all sets from Scryfall
    console.log("Fetching sets from Scryfall API...");
    const response = await axios.get("https://api.scryfall.com/sets");
    const sets = response.data.data;

    console.log(`Found ${sets.length} sets to process`);

    // Create default fallback icon
    const defaultSvg = `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="28" rx="4" fill="#e0e0e0"/>
      <text x="14" y="19" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#666">?</text>
    </svg>`;

    await writeFile(path.join(ICONS_DIR, "default.svg"), defaultSvg);
    console.log("Created default set icon");

    // Download each set icon
    let success = 0;
    let failed = 0;

    for (const set of sets) {
      const { code, name } = set;
      const outputPath = path.join(ICONS_DIR, `${code.toLowerCase()}.svg`);

      try {
        const iconUrl = `https://svgs.scryfall.io/sets/${code.toLowerCase()}.svg`;
        const response = await axios.get(iconUrl, {
          responseType: "arraybuffer",
          timeout: 5000,
        });

        await writeFile(outputPath, response.data);
        success++;

        // Progress reporting
        if (success % 20 === 0) {
          console.log(`Downloaded ${success} icons so far...`);
        }
      } catch (err) {
        console.log(
          `Failed to download icon for ${code} (${name}): ${err.message}`
        );
        failed++;
      }

      // Be nice to Scryfall API - small delay between requests
      await new Promise((r) => setTimeout(r, 100));
    }

    console.log(`\nDownload complete: ${success} successful, ${failed} failed`);
  } catch (error) {
    console.error("Error downloading set icons:", error);
  }
}

downloadSetIcons();
