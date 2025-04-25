const cardService = require("../services/cardService");
const rankingService = require("../services/rankingService");
const imageHelpers = require("../utils/imageHelpers");

exports.getHomePage = async (req, res) => {
  try {
    // Get two cards to compare
    const cards = await cardService.getCardPair();

    // Check if we have cards to compare
    const hasCards = cards && cards.length >= 2;

    // Only try to get rankings if we have cards
    const topRankings = hasCards
      ? await rankingService.getTopRankings(10, 1)
      : [];

    // Format the ratings server-side if we have rankings
    if (topRankings.length > 0) {
      topRankings.forEach((card) => {
        card.formattedRating = card.rating.toLocaleString();
      });
    }

    // Render with required data
    res.render("index", {
      title: "Card Art Voter",
      cards: cards || [],
      hasCards: hasCards,
      topRankings: topRankings || [],
      getArtCropUrl: imageHelpers.getArtCropUrl,
      getSmallCardUrl: imageHelpers.getSmallCardUrl,
    });
  } catch (error) {
    console.error("Error loading homepage:", error);
    res.status(500).render("error", {
      message: "Failed to load cards for voting",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};
