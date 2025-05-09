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
    const topArtists = await rankingService.getTopArtists(15);

    // Get bottom artists
    const bottomArtists = await rankingService.getBottomArtists(15);

    // Get top and bottom sets
    const topSets = await rankingService.getTopSets(10);
    const bottomSets = await rankingService.getBottomSets(10);

    res.render("rankings", {
      title: "Card Art Rankings",
      topCards,
      bottomCards,
      topArtists,
      bottomArtists,
      topSets, // Add this
      bottomSets, // Add this
      getArtCropUrl: imageHelpers.getArtCropUrl,
      getCardUrl: imageHelpers.getCardUrl,
      getSetIconPath: (code) => `/images/set-icons/${code.toLowerCase()}.svg`, // For backward compatibility
    });
  } catch (error) {
    console.error("Error getting rankings:", error);
    res.status(500).send("Error fetching rankings");
  }
};
