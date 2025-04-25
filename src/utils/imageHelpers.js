/**
 * Helper functions for image URL generation
 */

/**
 * Generates a URL for Scryfall's art crop (just artwork, no card frame)
 */
exports.getArtCropUrl = (scryfallId) => {
  if (!scryfallId) return "/api/card-back-thumb";

  // Format: https://cards.scryfall.io/art_crop/front/6/d/6da045f8-6278-4c84-9d39-025adf0789c1.jpg
  try {
    const firstChar = scryfallId.charAt(0);
    const secondChar = scryfallId.charAt(1);
    return `https://cards.scryfall.io/art_crop/front/${firstChar}/${secondChar}/${scryfallId}.jpg`;
  } catch (err) {
    console.error("Error generating art URL for", scryfallId, err);
    return "/api/card-back-thumb";
  }
};

/**
 * Generates a URL for Scryfall's small card images
 */
exports.getSmallCardUrl = (scryfallId) => {
  if (!scryfallId) return "/api/card-back";

  try {
    const firstChar = scryfallId.charAt(0);
    const secondChar = scryfallId.charAt(1);
    return `https://cards.scryfall.io/small/front/${firstChar}/${secondChar}/${scryfallId}.jpg`;
  } catch (err) {
    console.error("Error generating small card URL for", scryfallId, err);
    return "/api/card-back";
  }
};

/**
 * Generates a URL for Scryfall's normal card images
 */
exports.getCardUrl = (scryfallId) => {
  if (!scryfallId) return "/api/card-back";

  try {
    const firstChar = scryfallId.charAt(0);
    const secondChar = scryfallId.charAt(1);
    return `https://cards.scryfall.io/normal/front/${firstChar}/${secondChar}/${scryfallId}.jpg`;
  } catch (err) {
    console.error("Error generating card URL for", scryfallId, err);
    return "/api/card-back";
  }
};
