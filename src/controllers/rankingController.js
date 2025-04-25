const rankingService = require("../services/rankingService");
const imageHelpers = require("../utils/imageHelpers");
const Card = require("../models/Card");

exports.displayRankings = async (req, res) => {
  try {
    // CHANGED: Use minimum 1 comparison to match the index page
    const topCards = await rankingService.getTopRankings(20, 1);

    // Get top 20 artists with at least 3 cards
    const topArtists = await rankingService.getTopArtists(20, 3);

    // Get additional data for notable cards
    const enhancedArtists = await Promise.all(
      topArtists.map(async (artist) => {
        // Find the notable card to get its scryfallId
        const notableCard = await Card.findOne({
          name: artist.bestCard,
          artist: artist.name,
          enabled: true,
        }).lean();

        return {
          ...artist,
          notableScryfallId: notableCard ? notableCard.scryfallId : null,
          formattedRating: Math.round(artist.averageRating).toLocaleString(),
        };
      })
    );

    // Format ratings for display
    topCards.forEach((card) => {
      card.formattedRating = Math.round(card.rating).toLocaleString();
    });

    // Render the rankings page
    res.render("rankings", {
      title: "Card Art Rankings",
      topCards: topCards || [],
      topArtists: enhancedArtists || [],
      getArtCropUrl: imageHelpers.getArtCropUrl,
      getSmallCardUrl: imageHelpers.getSmallCardUrl,
    });
  } catch (error) {
    console.error("Error loading rankings page:", error);
    res.status(500).render("error", {
      message: "Failed to load rankings",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};
