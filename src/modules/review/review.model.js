
import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
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
        public_id: { type: String, default: "" },  // not required — may be absent if CDN skips it
      },
    ],

    isEdited: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
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

reviewSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});


// One review per user per product
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

reviewSchema.index({ productId: 1, createdAt: -1 });


reviewSchema.statics.recalculateProductRating = async function (productId) {
  try {
    const Product = mongoose.model("Product");

    const result = await this.aggregate([
      {
        $match: {
          productId: new mongoose.Types.ObjectId(productId),
          status: "active",
        },
      },
      {
        $group: {
          _id: "$productId",
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
      await Product.findByIdAndUpdate(productId, {
        rating: Math.round(avgRating * 10) / 10,
        reviewCount: totalReviews,
        ratingStats: { star5, star4, star3, star2, star1 },
      });
    } else {
      await Product.findByIdAndUpdate(productId, {
        rating: 0,
        reviewCount: 0,
        ratingStats: { star5: 0, star4: 0, star3: 0, star2: 0, star1: 0 },
      });
    }
  } catch (err) {
    console.error("[Review.recalculateProductRating]", err.message);
  }
};


reviewSchema.post("save", async function () {
  await this.constructor.recalculateProductRating(this.productId);
});

reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc) await doc.constructor.recalculateProductRating(doc.productId);
});


export default mongoose.model("Review", reviewSchema);