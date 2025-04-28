const rankingService = require("../services/rankingService");
const imageHelpers = require("../utils/imageHelpers");
const Card = require("../models/Card");

exports.displayRankings = async (req, res) => {
  try {
    // Get top cards
    const topCards = await rankingService.getTopRankedCards(20);

    // Get bottom cards
    const bottomCards = await rankingService.getBottomRankedCards(20);

    // Get top artists
    const topArtists = await rankingService.getTopRankedArtists(10);

    // Get bottom artists - add this line
    const bottomArtists = await rankingService.getBottomRankedArtists(10);

    res.render("rankings", {
      title: "Card Art Rankings",
      topCards,
      bottomCards,
      topArtists,
      bottomArtists, // Add this line
      getArtCropUrl: imageHelpers.getArtCropUrl,
      getCardUrl: imageHelpers.getCardUrl,
    });
  } catch (error) {
    console.error("Error getting rankings:", error);
    res.status(500).send("Error fetching rankings");
  }
};
