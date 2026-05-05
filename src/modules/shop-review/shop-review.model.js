import mongoose from "mongoose";

const shopReviewSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: [true, "Shop ID is required"],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    title: {
      type: String,
      maxlength: [100, "Title cannot exceed 100 characters"],
      trim: true,
      default: "",
    },
    comment: {
      type: String,
      required: [true, "Review comment is required"],
      minlength: [10, "Comment must be at least 10 characters"],
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
      trim: true,
    },
    images: [
      {
        url: { type: String, required: true },
        public_id: { type: String, default: "" },
      },
    ],
    isEdited: { type: Boolean, default: false },
    isVerifiedPurchase: { type: Boolean, default: false },
    helpfulVotes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "hidden", "flagged"],
      default: "active",
      index: true,
    },
    vendorResponse: {
      comment: { type: String, trim: true, maxlength: 1000 },
      respondedAt: { type: Date }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// One review per user per shop
shopReviewSchema.index({ shopId: 1, userId: 1 }, { unique: true });
shopReviewSchema.index({ shopId: 1, createdAt: -1 });

/**
 * Recalculate average rating and stats for a shop
 */
shopReviewSchema.statics.recalculateShopRating = async function (shopId) {
  try {
    const Shop = mongoose.model("Shop");

    const result = await this.aggregate([
      {
        $match: {
          shopId: new mongoose.Types.ObjectId(shopId),
          status: "active",
        },
      },
      {
        $group: {
          _id: "$shopId",
          avgRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
          star5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
          star4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          star3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          star2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          star1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
        },
      },
    ]);

    if (result.length > 0) {
      const { avgRating, totalReviews, star5, star4, star3, star2, star1 } = result[0];
      await Shop.findByIdAndUpdate(shopId, {
        "rating.average": Math.round(avgRating * 10) / 10,
        "rating.count": totalReviews,
        ratingStats: { star5, star4, star3, star2, star1 },
      });
    } else {
      await Shop.findByIdAndUpdate(shopId, {
        "rating.average": 0,
        "rating.count": 0,
        ratingStats: { star5: 0, star4: 0, star3: 0, star2: 0, star1: 0 },
      });
    }
  } catch (err) {
    console.error("[ShopReview.recalculateShopRating]", err.message);
  }
};

shopReviewSchema.post("save", async function () {
  await this.constructor.recalculateShopRating(this.shopId);
});

shopReviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc) await doc.constructor.recalculateShopRating(doc.shopId);
});

const ShopReview = mongoose.model("ShopReview", shopReviewSchema);
export default ShopReview;
