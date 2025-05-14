const mongoose = require("mongoose");
const config = require("../config/app");

const rankingSchema = new mongoose.Schema(
  {
    cardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Card",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      default: config.elo.ratings.initial,
    },
    comparisons: {
      type: Number,
      required: true,
      default: 0, // Number of comparisons made
    },
  },
  { timestamps: true }
);

const Ranking = mongoose.model("Ranking", rankingSchema);

module.exports = Ranking;
