// This file implements the Elo rating algorithm for calculating card rankings based on user votes.
const config = require("../config/app");

class EloService {
  constructor() {
    // Get values from config file
    this.initialRating = config.elo.ratings.initial;
    this.kFactorNew = config.elo.kFactors.new;
    this.kFactorEstablishing = config.elo.kFactors.establishing;
    this.kFactorEstablished = config.elo.kFactors.established;
    this.kFactorWellEstablished = config.elo.kFactors.wellEstablished;
    this.minRating = config.elo.ratings.min;
    this.maxRating = config.elo.ratings.max;
  }

  calculateNewRating(winnerRating, loserRating, winnerKFactor) {
    const expectedWinnerScore = this.expectedScore(winnerRating, loserRating);
    const expectedLoserScore = this.expectedScore(loserRating, winnerRating);

    const newWinnerRating =
      winnerRating + winnerKFactor * (1 - expectedWinnerScore);
    const newLoserRating =
      loserRating + winnerKFactor * (0 - expectedLoserScore);

    // Ensure ratings stay within bounds
    const boundedWinnerRating = Math.min(
      this.maxRating,
      Math.max(this.minRating, newWinnerRating)
    );
    const boundedLoserRating = Math.min(
      this.maxRating,
      Math.max(this.minRating, newLoserRating)
    );

    return {
      newWinnerRating: Math.round(boundedWinnerRating),
      newLoserRating: Math.round(boundedLoserRating),
    };
  }

  expectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  /**
   * Get the appropriate K-factor based on the number of comparisons
   * @param {number} comparisons - Number of comparisons for the card
   * @returns {number} - The K-factor to use for Elo calculations
   */
  getKFactor(comparisons) {
    if (comparisons < 10) {
      return this.kFactorNew; // Higher K-factor for new cards (<10 comparisons)
    } else if (comparisons < 30) {
      return this.kFactorEstablishing; // Medium K-factor for establishing cards (10-29 comparisons)
    } else if (comparisons < 100) {
      return this.kFactorEstablished; // Lower K-factor for established cards (30-99 comparisons)
    } else {
      return this.kFactorWellEstablished; // Lowest K-factor for well-established cards (100+ comparisons)
    }
  }

  /**
   * Process a vote between two cards and calculate their new ratings
   * @param {Object} winnerCard - The winning card with rating and comparisons
   * @param {Object} loserCard - The losing card with rating and comparisons
   * @returns {Object} - Object with new ratings for both cards
   */
  processVote(winnerCard, loserCard) {
    // Determine the appropriate K-factor based on both cards' comparisons
    const avgComparisons = (winnerCard.comparisons + loserCard.comparisons) / 2;
    const kFactor = this.getKFactor(avgComparisons);

    // Calculate new ratings
    const { newWinnerRating, newLoserRating } = this.calculateNewRating(
      winnerCard.rating,
      loserCard.rating,
      kFactor
    );

    return {
      newWinnerRating,
      newLoserRating,
      ratingChange: Math.abs(winnerCard.rating - newWinnerRating),
    };
  }
}

module.exports = new EloService();
