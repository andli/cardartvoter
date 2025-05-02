// This file exports functions for calculating Elo ratings based on the results of card comparisons.
const appConfig = require("../config/app");

const calculateElo = (ratingA, ratingB, scoreA, scoreB, kFactor) => {
  const expectedScoreA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedScoreB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

  const newRatingA = ratingA + kFactor * (scoreA - expectedScoreA);
  const newRatingB = ratingB + kFactor * (scoreB - expectedScoreB);

  return {
    newRatingA: Math.round(newRatingA),
    newRatingB: Math.round(newRatingB),
  };
};

const getKFactor = (winnerComps, loserComps) => {
  const avgComps = (winnerComps + loserComps) / 2;

  if (avgComps < 10) return appConfig.elo.kFactors.new;
  if (avgComps < 30) return appConfig.elo.kFactors.establishing;
  if (avgComps < 100) return appConfig.elo.kFactors.established;

  return appConfig.elo.kFactors.wellEstablished;
};

const updateRatings = (cardA, cardB, winnerId) => {
  // Use the dynamic K-factor based on comparison count from config
  const kFactor = getKFactor(cardA.comparisons, cardB.comparisons);

  const scoreA = winnerId === cardA.id ? 1 : 0;
  const scoreB = winnerId === cardB.id ? 1 : 0;

  const updatedRatings = calculateElo(
    cardA.rating,
    cardB.rating,
    scoreA,
    scoreB,
    kFactor
  );

  // Apply min/max bounds from config
  return {
    cardA: {
      ...cardA,
      rating: Math.max(
        appConfig.elo.minRating,
        Math.min(appConfig.elo.maxRating, updatedRatings.newRatingA)
      ),
      comparisons: cardA.comparisons + 1,
    },
    cardB: {
      ...cardB,
      rating: Math.max(
        appConfig.elo.minRating,
        Math.min(appConfig.elo.maxRating, updatedRatings.newRatingB)
      ),
      comparisons: cardB.comparisons + 1,
    },
  };
};

module.exports = {
  calculateElo,
  updateRatings,
  getKFactor,
};
