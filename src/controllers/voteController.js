const crypto = require("crypto");
const voteService = require("../services/voteService");
const cardService = require("../services/cardService");
const statsService = require("../services/statsService");

exports.submitVote = async (req, res) => {
  try {
    // Log received data for debugging
    console.log("Vote received:", req.body);
    console.log("Session data:", req.session.currentPair);

    const { selectedCardId, pairId } = req.body;

    if (!selectedCardId || !pairId) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
      });
    }

    // Check if session has all required data
    if (
      !req.session.currentPair ||
      !req.session.currentPair.card1 ||
      !req.session.currentPair.card2
    ) {
      console.error("Session missing card data:", req.session);
      return res.status(400).json({
        success: false,
        error: "Session data invalid or missing. Please refresh the page.",
      });
    }

    // Also check if pairId matches
    if (req.session.currentPair.pairId !== pairId) {
      console.error("Pair ID mismatch:", {
        session: req.session.currentPair.pairId,
        request: pairId,
      });
      return res.status(400).json({
        success: false,
        error: "Invalid pair ID. Please refresh the page.",
      });
    }

    // Process the vote - this is where your code might be stopping
    const result = await voteService.processVote(
      selectedCardId,
      req.session.currentPair
    );

    // Get the current vote count
    const voteCount = await statsService.getVoteCount();

    // Get a new card pair
    const newCards = await cardService.getCardPair();

    // Validate that we have two valid cards
    if (
      !newCards ||
      newCards.length !== 2 ||
      !newCards[0] ||
      !newCards[1] ||
      !newCards[0].scryfallId ||
      !newCards[1].scryfallId
    ) {
      console.error("Invalid card pair returned:", newCards);
      return res.status(500).json({
        success: false,
        error: "Could not generate a new card pair. Please refresh the page.",
      });
    }

    // Generate a new pair ID
    const newPairId = crypto.randomBytes(16).toString("hex");

    // Store the new pair in session
    req.session.currentPair = {
      card1: newCards[0].scryfallId,
      card2: newCards[1].scryfallId,
      timestamp: Date.now(),
      pairId: newPairId,
    };

    // Return JSON with both the vote result and new cards
    return res.json({
      success: true,
      result: {
        selectedCard: selectedCardId,
        ratingChange: result.ratingChange || 0,
      },
      voteCount: voteCount, // Include the total vote count
      newPair: {
        cards: newCards,
        pairId: newPairId,
      },
    });
  } catch (error) {
    console.error("Error processing vote:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Error processing vote",
    });
  }
};
