const express = require("express");
const router = express.Router();

// Import controller instances (not classes)
const cardController = require("../controllers/cardController");
const voteController = require("../controllers/voteController");

// Card routes
router.get("/cards", cardController.getAllCards);
router.get("/cards/:id", cardController.getCardById);

// Voting routes
router.post("/vote", voteController.castVote);
router.get("/votes/results", voteController.getVoteResults);

module.exports = router;
