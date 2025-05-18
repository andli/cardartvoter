const crypto = require("crypto");
const voteService = require("../services/voteService");
const cardService = require("../services/cardService");
const statsService = require("../services/statsService");

exports.submitVote = async (req, res) => {
  try {
    const { selectedCardId, pairId } = req.body;

    if (!selectedCardId || !pairId) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
      });
    }

    // Enhanced session validation with specific error details
    if (!req.session) {
      console.error("No session object available");
      return res.status(400).json({
        success: false,
        error: "Session not initialized",
        details: "Your browser may be blocking cookies",
      });
    }

    if (!req.session.currentPair) {
      console.error("Session exists but missing currentPair data");

      // If user has selectedCardId, we can still process the vote
      // by creating a fallback response with new cards
      console.log("Attempting to generate new card pair as fallback");

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
        return res.status(500).json({
          success: false,
          error: "Could not generate new cards. Please refresh the page.",
        });
      }

      // Generate a new pair ID
      const newPairId = crypto.randomBytes(16).toString("hex");

      // Store in session for future requests
      req.session.currentPair = {
        card1: newCards[0].scryfallId,
        card2: newCards[1].scryfallId,
        timestamp: Date.now(),
        pairId: newPairId,
        // Check if the original request was for a targeted card
        isTargeted: req.query && req.query.target_card_id ? true : false
      };

      // Force session save to ensure it persists
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error("Failed to save session:", err);
            reject(err);
          } else {
            resolve();
          }
        });
      });

      // Return cards without processing the vote this time
      return res.json({
        success: true,
        info: "Session was reset. Please try voting again.",
        voteCount: await statsService.getVoteCount(),
        newPair: {
          cards: newCards,
          pairId: newPairId,
        },
      });
    }

    // Check if we have both card IDs in the session
    if (!req.session.currentPair.card1 || !req.session.currentPair.card2) {
      console.error("Session card data incomplete:", req.session.currentPair);
      return res.status(400).json({
        success: false,
        error: "Session data incomplete. Please refresh the page.",
      });
    }

    // Check if pairId matches
    if (req.session.currentPair.pairId !== pairId) {
      console.error("Pair ID mismatch:", {
        session: req.session.currentPair.pairId,
        request: pairId,
        isTargeted: req.session.currentPair.isTargeted
      });
      
      // Special handling for targeted votes - they should be allowed even with mismatched pairId
      if (req.session.currentPair.isTargeted) {
        console.log("Allowing vote for targeted card despite pair ID mismatch");
      } else {
        return res.status(400).json({
          success: false,
          error: "Invalid pair ID. Please refresh the page.",
        });
      }
    }

    // Process the vote
    const result = await voteService.processVote(
      selectedCardId,
      req.session.currentPair
    );

    // Initialize vote history array if it doesn't exist
    if (!req.session.voteHistory) {
      req.session.voteHistory = [];
    }

    // Get details of the cards from the current pair
    const card1 = await cardService.getCardByScryfallId(
      req.session.currentPair.card1
    );
    const card2 = await cardService.getCardByScryfallId(
      req.session.currentPair.card2
    );

    // Determine which card is the winner and which is the loser
    const isCard1Winner = selectedCardId === req.session.currentPair.card1;

    // Add the current vote to history with position information
    if (card1 && card2) {
      const voteHistory = {
        leftCard: {
          id: card1.scryfallId,
          name: card1.name,
          isWinner: isCard1Winner,
        },
        rightCard: {
          id: card2.scryfallId,
          name: card2.name,
          isWinner: !isCard1Winner,
        },
        timestamp: Date.now(),
      };

      // Add to front of array (newest first)
      req.session.voteHistory.unshift(voteHistory);

      // Keep only last 3 entries
      if (req.session.voteHistory.length > 3) {
        req.session.voteHistory = req.session.voteHistory.slice(0, 3);
      }

      // Explicitly force save the session to ensure vote history persists
      // This is critical for serverless environments like Vercel
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error("Failed to save vote history to session store:", err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

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
      // Preserve the isTargeted flag if it exists
      isTargeted: req.session.currentPair && req.session.currentPair.isTargeted
    };

    // Return JSON with both the vote result, new cards, and vote history
    return res.json({
      success: true,
      result: {
        selectedCard: selectedCardId,
        ratingChange: result.ratingChange || 0,
      },
      voteCount: await statsService.getVoteCount(), // Properly retrieve the vote count
      newPair: {
        cards: newCards,
        pairId: newPairId,
      },
      voteHistory: req.session.voteHistory, // Include vote history in response
    });
  } catch (error) {
    console.error("Error processing vote:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Error processing vote",
    });
  }
};
