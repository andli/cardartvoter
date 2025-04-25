const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema(
  {
    scryfallId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    artist: {
      type: String,
      required: true,
      index: true,
    },

    // Essential display data
    imageUrl: {
      type: String,
      required: true,
    },

    // Contextual information
    set: String,
    setName: String,

    // Voting system data
    rating: {
      type: Number,
      default: 1500,
      index: true,
    },
    comparisons: {
      type: Number,
      default: 0,
    },

    // Simple filtering system
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Card", cardSchema);
