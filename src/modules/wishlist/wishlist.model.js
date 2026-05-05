import { Schema, model } from "mongoose";


const wishlistItemSchema = new Schema(
    {
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true ,
        },
       
        productSnapshot: {
            name: { type: String, required: true },
            price: { type: Number, required: true },
            image: { type: String },
            slug: { type: String },
        },
        addedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: true }
);

const wishlistSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true, 
            index: true,
        },
        items: [wishlistItemSchema],
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

//  item count
wishlistSchema.virtual("itemCount").get(function () {
    return this.items.length;
});

wishlistSchema.methods.hasProduct = function (productId) {
    return this.items.some(
        (item) => item.product.toString() === productId.toString()
    );
};

wishlistSchema.index({ user: 1, "items.product": 1 });

const Wishlist = model("Wishlist", wishlistSchema);

export default Wishlist;