require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);

const ICONS_DIR = path.join(__dirname, "../public/images/set-icons");

// Update the download function to handle missing icons better

async function downloadSetIcons() {
  try {
    // Make sure directory exists
    if (!(await exists(ICONS_DIR))) {
      await mkdir(ICONS_DIR, { recursive: true });
    }

    // Create default icon
    const defaultSvg = `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="28" rx="4" fill="#e0e0e0"/>
      <text x="14" y="19" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#666">?</text>
    </svg>`;

    await writeFile(path.join(ICONS_DIR, "default.svg"), defaultSvg);
    console.log("Created default set icon");

    // Get all sets from Scryfall
    console.log("Fetching sets from Scryfall API...");
    const response = await axios.get("https://api.scryfall.com/sets");
    const sets = response.data.data;

    console.log(`Found ${sets.length} sets to process`);

    // Download each set icon
    let success = 0;
    let failed = 0;
    let missing = [];

    for (const set of sets) {
      const { code, name } = set;
      const outputPath = path.join(ICONS_DIR, `${code.toLowerCase()}.svg`);

      try {
        const iconUrl = `https://svgs.scryfall.io/sets/${code.toLowerCase()}.svg`;
        const response = await axios.get(iconUrl, {
          responseType: "arraybuffer",
          timeout: 5000,
          validateStatus: (status) => status === 200, // Only accept 200 responses
        });

        await writeFile(outputPath, response.data);
        success++;

        // Progress reporting
        if (success % 20 === 0) {
          console.log(`Downloaded ${success} icons so far...`);
        }
      } catch (err) {
        // For 404 errors, generate a text-based icon
        if (err.response && err.response.status === 404) {
          missing.push(code.toLowerCase());

          // Generate a simple text-based icon for missing sets
          const shortName =
            code.length > 3
              ? code.substring(0, 3).toUpperCase()
              : code.toUpperCase();
          const textSvg = `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
            <rect width="28" height="28" rx="4" fill="#f8f9fa"/>
            <text x="14" y="19" font-family="Arial, sans-serif" font-size="${
              shortName.length > 2 ? "8" : "10"
            }" 
                  text-anchor="middle" font-weight="bold" fill="#6c757d">${shortName}</text>
          </svg>`;

          await writeFile(outputPath, textSvg);
          console.log(`Created fallback icon for ${code} (${name})`);
        } else {
          console.log(
            `Failed to download icon for ${code} (${name}): ${err.message}`
          );
          failed++;
        }
      }

      // Be nice to Scryfall API - small delay between requests
      await new Promise((r) => setTimeout(r, 100));
    }

    console.log(
      `\nDownload complete: ${success} successful, ${missing.length} generated fallbacks, ${failed} failed`
    );
    if (missing.length > 0) {
      console.log(
        `Sets without icons: ${missing.slice(0, 10).join(", ")}${
          missing.length > 10 ? "..." : ""
        }`
      );
    }
  } catch (error) {
    console.error("Error downloading set icons:", error);
  }
}

downloadSetIcons();
