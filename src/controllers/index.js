const cardService = require("../services/cardService");
const rankingService = require("../services/rankingService");
const imageHelpers = require("../utils/imageHelpers");

// In your getHomePage controller, store the current card pair in the session
exports.getHomePage = async (req, res) => {
  try {
    const cards = await cardService.getCardPair();
    const topRankings = await rankingService.getTopRankings(10, 1);

    // Store the current card pair in the session
    if (cards.length === 2) {
      req.session.currentPair = {
        card1: cards[0].scryfallId,
        card2: cards[1].scryfallId,
        timestamp: Date.now(),
      };
    }

    // Rest of your existing code
    res.render("index", {
      title: "Home",
      cards,
      topRankings,
      hasCards: cards.length === 2,
      getArtCropUrl: imageHelpers.getArtCropUrl,
      getSmallCardUrl: imageHelpers.getSmallCardUrl,
    });
  } catch (error) {
    console.error("Error loading homepage:", error);
    res
      .status(500)
      .render("error", { message: "Error loading homepage", error });
  }
};
