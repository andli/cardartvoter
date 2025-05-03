// This file contains client-side JavaScript for handling ranking-related interactions.

document.addEventListener("DOMContentLoaded", () => {
  const rankingContainer = document.getElementById("ranking-container");

  // Function to fetch and display rankings
  const fetchRankings = async () => {
    try {
      const response = await fetch("/api/rankings");
      const rankings = await response.json();
      displayRankings(rankings);
    } catch (error) {
      console.error("Error fetching rankings:", error);
    }
  };

  // Function to display rankings in the UI
  const displayRankings = (rankings) => {
    rankingContainer.innerHTML = ""; // Clear existing rankings
    rankings.forEach((card) => {
      const cardElement = document.createElement("div");
      cardElement.classList.add("card-ranking");
      cardElement.innerHTML = `
                <img src="${card.imageUrl}" alt="${card.name}" />
                <h3>${card.name}</h3>
                <p>Rating: ${card.rating}</p>
            `;
      rankingContainer.appendChild(cardElement);
    });
  };

  // Initial fetch of rankings
  fetchRankings();

  // Integrate set icon loading functionality for production environment
  loadSetIconsFromBlobStorage();
});

/**
 * Load set icons from Vercel Blob storage in production environments
 */
async function loadSetIconsFromBlobStorage() {
  // Only run in production environment (skip in development/localhost)
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return;
  }

  // Find all set icons
  const setIcons = document.querySelectorAll("img.set-icon");
  if (!setIcons.length) return;

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
