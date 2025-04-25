// This file exports functions for calculating Elo ratings based on the results of card comparisons.

const calculateElo = (ratingA, ratingB, scoreA, scoreB, kFactor) => {
    const expectedScoreA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    const expectedScoreB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

    const newRatingA = ratingA + kFactor * (scoreA - expectedScoreA);
    const newRatingB = ratingB + kFactor * (scoreB - expectedScoreB);

    return {
        newRatingA: Math.round(newRatingA),
        newRatingB: Math.round(newRatingB)
    };
};

const updateRatings = (cardA, cardB, winnerId) => {
    const kFactor = cardA.comparisons < 10 || cardB.comparisons < 10 ? 32 : 16; // Higher K-factor for new cards
    const scoreA = winnerId === cardA.id ? 1 : 0;
    const scoreB = winnerId === cardB.id ? 1 : 0;

    const updatedRatings = calculateElo(cardA.rating, cardB.rating, scoreA, scoreB, kFactor);

    return {
        cardA: {
            ...cardA,
            rating: updatedRatings.newRatingA,
            comparisons: cardA.comparisons + 1
        },
        cardB: {
            ...cardB,
            rating: updatedRatings.newRatingB,
            comparisons: cardB.comparisons + 1
        }
    };
};

module.exports = {
    calculateElo,
    updateRatings
};