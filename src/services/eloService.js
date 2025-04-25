// This file implements the Elo rating algorithm for calculating card rankings based on user votes.

class EloService {
    constructor() {
        this.initialRating = 1200; // or 1500
        this.kFactorNew = 32; // Higher K-factor for new cards
        this.kFactorEstablished = 16; // Lower K-factor for established cards
    }

    calculateNewRating(winnerRating, loserRating, winnerKFactor) {
        const expectedWinnerScore = this.expectedScore(winnerRating, loserRating);
        const expectedLoserScore = this.expectedScore(loserRating, winnerRating);

        const newWinnerRating = winnerRating + winnerKFactor * (1 - expectedWinnerScore);
        const newLoserRating = loserRating + winnerKFactor * (0 - expectedLoserScore);

        return {
            newWinnerRating: Math.round(newWinnerRating),
            newLoserRating: Math.round(newLoserRating)
        };
    }

    expectedScore(ratingA, ratingB) {
        return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    }
}

export default new EloService();