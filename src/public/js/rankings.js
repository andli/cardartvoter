// This file handles set icon loading on the rankings page

document.addEventListener("DOMContentLoaded", () => {
  // Load set icons from the appropriate source based on environment
  loadSetIconsFromBlobStorage();
});

/**
 * Load set icons from Vercel Blob storage in production environments
 * or from local filesystem in development
 */
async function loadSetIconsFromBlobStorage() {
  // Find all set icons
  const setIcons = document.querySelectorAll("img.set-icon");
  if (!setIcons.length) return;

  // Only run in production environment
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    // For local development, use local paths directly
    setIcons.forEach((icon) => {
      const code = icon.dataset.code;
      if (code) {
        icon.setAttribute("src", `/images/set-icons/${code.toLowerCase()}.svg`);
      }
    });
    return;
  }

  // For production, fetch URLs from Blob storage
  try {
    // For each set icon, fetch the proper URL
    for (const icon of setIcons) {
      const code = icon.dataset.code;
      if (!code) continue;

      // Fetch the proper URL for this set icon
      const response = await fetch(
        `/api/set-icon-url?code=${encodeURIComponent(code)}`
      );
      if (!response.ok) continue;

      const data = await response.json();
      if (data.url) {
        icon.setAttribute("src", data.url);
      }
    }
  } catch (e) {
    console.error("Error loading set icons from Blob storage:", e);
  }
}
