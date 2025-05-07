exports.processVote = async (selectedCardId, sessionPair) => {
  try {
    // Get the two cards in the pair from the session
    const card1Id = sessionPair.card1;
    const card2Id = sessionPair.card2;

    if (!card1Id || !card2Id) {
      throw new Error("Missing required card IDs");
    }

    // Determine which card was NOT selected
    const otherCardId = selectedCardId === card1Id ? card2Id : card1Id;

    // Rest of your vote processing logic...
    // Return the result with a rating change
    return {
      selectedCard: selectedCardId,
      ratingChange: 10, // Replace with actual rating change calculation
    };
  } catch (error) {
    console.error("Error in processVote:", error);
    throw error;
  }
};
