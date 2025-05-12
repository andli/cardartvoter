const mongoose = require("mongoose");

const setSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    set_type: {
      type: String,
      required: true,
      index: true,
    },
    release_date: Date,
    card_count: Number,
    block: {
      type: String,
      index: true,
    },
    block_code: {
      type: String,
      index: true,
    },
    shouldFilter: {
      type: Boolean,
      default: false,
      index: true,
    },
    digital: Boolean,
    nonfoil_only: Boolean,
    foil_only: Boolean,
    icon_svg_uri: String,
  },
  {
    timestamps: true,
  }
);

// Add compound index for efficient filtering
setSchema.index({ shouldFilter: 1, code: 1 });

const Set = mongoose.model("Set", setSchema);

module.exports = Set;
