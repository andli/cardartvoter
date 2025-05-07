const mongoose = require("mongoose");

const voteSchema = new mongoose.Schema({
  cardId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Card",
  },
  userId: {
    type: String,
    required: false, // Assuming votes can be anonymous
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed, // Flexible field for additional data
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Vote = mongoose.model("Vote", voteSchema);

module.exports = Vote;
