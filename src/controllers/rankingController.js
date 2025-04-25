const rankingService = require("../services/rankingService");
const imageHelpers = require("../utils/imageHelpers");

exports.displayRankings = async (req, res) => {
  try {
    // Get top 20 cards with at least 5 comparisons
    const topCards = await rankingService.getTopRankings(20, 5);

    // Get top 20 artists with at least 3 cards
    const topArtists = await rankingService.getTopArtists(20, 3);

    // Format ratings for display
    topCards.forEach((card) => {
      card.formattedRating = card.rating.toLocaleString();
    });

    // Render the rankings page with layout
    res.render("rankings", {
      title: "Card Art Rankings", // This will be used in the layout's title tag
      topCards: topCards || [],
      topArtists: topArtists || [],
      getArtCropUrl: imageHelpers.getArtCropUrl,
    });
  } catch (error) {
    console.error("Error loading rankings page:", error);
    res.status(500).render("error", {
      message: "Failed to load rankings",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};
