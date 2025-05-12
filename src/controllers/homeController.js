const cardService = require("../services/cardService");
const rankingService = require("../services/rankingService");
const statsService = require("../services/statsService");
const imageHelpers = require("../utils/imageHelpers");
const crypto = require("crypto");

// In your getHomePage controller, store the current card pair in the session
exports.getHomePage = async (req, res) => {
  try {
    // Only accept ID parameter
    let targetCardId = req.query.target_card_id || null;
    // if targetCardId starts with https, remove everything before the last slash (ease of use for Scryffall links)
    if (targetCardId && targetCardId.startsWith("https://")) {
      const parts = targetCardId.split("/");
      targetCardId = parts[parts.length - 1];
    }

    // Pass only the ID to cardService
    const cards = await cardService.getCardPair(targetCardId);
    const topRankings = await rankingService.getTopRankings(10, 1);
    const voteCount = await statsService.getVoteCount();
    const cardCount = await statsService.getEnabledCardCount(); // Get count of enabled cards

    // Check if we have exactly 2 cards and both have scryfallId
    const hasValidCards =
      cards &&
      cards.length === 2 &&
      cards[0] &&
      cards[1] &&
      cards[0].scryfallId &&
      cards[1].scryfallId;

    // Generate and store pair ID if we have cards
    let pairId = null;
    if (hasValidCards) {
      // Generate a random nonce for this pair
      pairId = crypto.randomBytes(16).toString("hex");

      req.session.currentPair = {
        card1: cards[0].scryfallId,
        card2: cards[1].scryfallId,
        timestamp: Date.now(),
        pairId: pairId,
      };
    } else {
      console.warn(
        "Did not get two valid cards for voting. Cards received:",
        cards
      );
    }

    // Render the template with all necessary data
    res.render("index", {
      title: "Home",
      cards: hasValidCards ? cards : [],
      topRankings,
      hasCards: hasValidCards,
      pairId: pairId,
      voteHistory: req.session.voteHistory || [], // Pass vote history to template
      getArtCropUrl: imageHelpers.getArtCropUrl,
      getSmallCardUrl: imageHelpers.getSmallCardUrl,
      getCardUrl: imageHelpers.getCardUrl,
      voteCount, // Pass vote count to template
      cardCount, // Pass enabled card count to template
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

// FAQ page handler
exports.getFaqPage = async (req, res) => {
  try {
    // Get statistics for consistent footer display
    const voteCount = await statsService.getVoteCount();
    const cardCount = await statsService.getEnabledCardCount();

    res.render("faq", {
      title: "FAQ",
      voteCount,
      cardCount,
    });
  } catch (error) {
    console.error("Error loading FAQ page:", error);
    res.status(500).render("error", {
      title: "Error",
      message: "Error loading FAQ page",
      error,
    });
  }
};

// Search page handler
exports.getSearchPage = async (req, res) => {
  try {
    // Get statistics for consistent footer display
    const voteCount = await statsService.getVoteCount();
    const cardCount = await statsService.getEnabledCardCount();

    res.render("search", {
      title: "Search",
      voteCount,
      cardCount,
    });
  } catch (error) {
    console.error("Error loading Search page:", error);
    res.status(500).render("error", {
      title: "Error",
      message: "Error loading Search page",
      error,
    });
  }
};
