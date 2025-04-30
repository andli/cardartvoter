const fs = require("fs").promises;
const path = require("path");
const { put, list } = require("@vercel/blob");

const isDev = process.env.NODE_ENV !== "production";
const localIconsDir = path.join(__dirname, "../public/images/set-icons");

// Cache for production blob URLs
let iconCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

// Environment-aware storage functions
exports.storeIcon = async (iconName, data) => {
  if (isDev) {
    // Store locally in development
    await fs.mkdir(localIconsDir, { recursive: true });
    await fs.writeFile(path.join(localIconsDir, iconName), data);
    return `/images/set-icons/${iconName}`;
  } else {
    // Store in Vercel Blob in production
    const blob = await put(`set-icons/${iconName}`, data, {
      contentType: "image/svg+xml",
      access: "public",
    });

    // Update the cache with the new blob
    if (iconCache) {
      const code = iconName.replace(".svg", "");
      iconCache[code] = blob.url;
    }

    return blob.url;
  }
};

exports.getIconUrl = async (setCode) => {
  if (!setCode) return "/images/default-set-icon.svg";

  const iconName = `${setCode.toLowerCase()}.svg`;

  if (isDev) {
    // Check if file exists locally
    try {
      await fs.access(path.join(localIconsDir, iconName));
      return `/images/set-icons/${iconName}`;
    } catch (e) {
      return "/images/default-set-icon.svg";
    }
  } else {
    // Production mode using Vercel Blob
    try {
      // Refresh cache if needed
      if (!iconCache || Date.now() - cacheTimestamp > CACHE_DURATION) {
        const { blobs } = await list({ prefix: "set-icons/" });
        iconCache = {};

        for (const blob of blobs) {
          const filename = blob.pathname.split("/").pop();
          const code = filename.replace(".svg", "");
          iconCache[code] = blob.url;
        }

        cacheTimestamp = Date.now();
      }

      // Return the icon URL from cache or default
      const code = setCode.toLowerCase();
      return iconCache[code] || "/images/default-set-icon.svg";
    } catch (e) {
      console.error("Error retrieving icon URL:", e);
      return "/images/default-set-icon.svg";
    }
  }
};

// Add a helper function to check if an icon exists
exports.iconExists = async (setCode) => {
  if (!setCode) return false;

  const iconName = `${setCode.toLowerCase()}.svg`;

  if (isDev) {
    try {
      await fs.access(path.join(localIconsDir, iconName));
      return true;
    } catch {
      return false;
    }
  } else {
    // Production mode - handle missing token
    try {
      // Check if blob is configured
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.warn("Vercel Blob token not configured, using fallback paths");
        return false; // Just assume it doesn't exist and let onerror handle it
      }

      if (!iconCache || Date.now() - cacheTimestamp > CACHE_DURATION) {
        const { blobs } = await list({ prefix: "set-icons/" });
        iconCache = {};

        for (const blob of blobs) {
          const filename = blob.pathname.split("/").pop();
          const code = filename.replace(".svg", "");
          iconCache[code] = blob.url;
        }

        cacheTimestamp = Date.now();
      }

      return !!iconCache[setCode.toLowerCase()];
    } catch (e) {
      console.error("Error checking if icon exists:", e);
      return false; // Safer to return false and use fallback
    }
  }
};
