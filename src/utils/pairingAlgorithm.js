// This file exports functions for determining which cards to pair for voting based on their ratings and comparison history.

const Card = require('../models/Card');

// Function to get pairs of cards for voting
const getCardPairs = async () => {
    const cards = await Card.find().sort({ rating: 1 }); // Fetch cards sorted by rating
    const pairs = [];

    for (let i = 0; i < cards.length; i += 2) {
        if (i + 1 < cards.length) {
            pairs.push([cards[i], cards[i + 1]]); // Create pairs of cards
        }
    }

    return pairs;
};

// Function to prioritize cards with fewer comparisons
const prioritizeCards = async () => {
    const cards = await Card.find().sort({ comparisons: 1 }); // Fetch cards sorted by number of comparisons
    return cards;
};

// Function to get a random pair of cards
const getRandomPair = async () => {
    const count = await Card.countDocuments();
    const randomIndex1 = Math.floor(Math.random() * count);
    let randomIndex2 = Math.floor(Math.random() * count);

    while (randomIndex1 === randomIndex2) {
        randomIndex2 = Math.floor(Math.random() * count); // Ensure the two cards are different
    }

    const card1 = await Card.findOne().skip(randomIndex1);
    const card2 = await Card.findOne().skip(randomIndex2);

    return [card1, card2];
};

module.exports = {
    getCardPairs,
    prioritizeCards,
    getRandomPair,
};