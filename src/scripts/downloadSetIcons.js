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

    console.log(`Found ${sets.length} sets from Scryfall API`);

    // Make sure default icon exists
    const DEFAULT_ICON_PATH = path.join(
      __dirname,
      "../public/images/default-set-icon.svg"
    );
    if (!(await exists(DEFAULT_ICON_PATH))) {
      // Create a simple default icon
      const defaultSvg = `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" rx="4" fill="#e0e0e0"/>
        <text x="14" y="19" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#666">?</text>
      </svg>`;
      await writeFile(DEFAULT_ICON_PATH, defaultSvg);
      console.log("Created default set icon");
    }

    // Download icons (no fallbacks)
    let success = 0;
    let skipped = 0;

    // Process all sets
    console.log("Downloading icons (this may take a while)...");
    for (let i = 0; i < sets.length; i++) {
      const set = sets[i];
      const { code } = set;
      const setCode = code.toLowerCase();
      const outputPath = path.join(ICONS_DIR, `${setCode}.svg`);

      try {
        const iconUrl = `https://svgs.scryfall.io/sets/${setCode}.svg`;
        const response = await axios
          .get(iconUrl, {
            responseType: "arraybuffer",
            timeout: 3000,
            validateStatus: function (status) {
              return status === 200; // Only proceed if successful
            },
          })
          .catch(() => null); // Catch 404s and other errors

        if (response && response.data) {
          await writeFile(outputPath, response.data);
          success++;

          if (success % 20 === 0) {
            console.log(`Downloaded ${success} icons so far...`);
          }
        } else {
          skipped++;
        }
      } catch (err) {
        // Just skip on any error
        skipped++;
      }

      // Small delay to be nice to Scryfall
      if (i % 5 === 0) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    console.log(`\nDownload complete: ${success} icons downloaded`);
    console.log(`${skipped} sets will use the default icon`);
  } catch (error) {
    console.error("Error downloading set icons:", error);
  }
}

downloadSetIcons().catch(console.error);
