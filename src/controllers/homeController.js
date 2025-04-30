const cardService = require("../services/cardService");
const rankingService = require("../services/rankingService");
const imageHelpers = require("../utils/imageHelpers");
const crypto = require("crypto");

// In your getHomePage controller, store the current card pair in the session
exports.getHomePage = async (req, res) => {
  try {
    // Only accept ID parameter
    const targetCardId = req.query.target_card_id || null;

    // Pass only the ID to cardService
    const cards = await cardService.getCardPair(targetCardId);
    const topRankings = await rankingService.getTopRankings(10, 1);

    // Generate and store pair ID if we have cards
    let pairId = null;
    if (cards.length === 2) {
      // Generate a random nonce for this pair
      pairId = crypto.randomBytes(16).toString("hex");

      req.session.currentPair = {
        card1: cards[0].scryfallId,
        card2: cards[1].scryfallId,
        timestamp: Date.now(),
        pairId: pairId,
      };
    }

    // Render the template with all necessary data
    res.render("index", {
      title: "Home",
      cards,
      topRankings,
      hasCards: cards.length === 2,
      pairId: pairId,
      getArtCropUrl: imageHelpers.getArtCropUrl,
      getSmallCardUrl: imageHelpers.getSmallCardUrl,
    });
  } catch (error) {
    console.error("Error loading homepage:", error);
    res.status(500).render("error", {
      title: "Error",
      message: "Error loading homepage",
      error,
    });
  }
};
