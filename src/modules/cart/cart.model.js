import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: [true, 'Product reference is required'],
        },
        quantity: {
            type: Number,
            required: [true, 'Quantity is required'],
            min: [1, 'Quantity must be at least 1'],
            max: [100, 'Quantity cannot exceed 100'],
            default: 1,
        },
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [0, 'Price cannot be negative'],
        },
    },
    { _id: false }
);

const cartSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User is required'],
            unique: true,
            index: true,
        },
        items: {
            type: [cartItemSchema],
            default: [],
        },
        totalPrice: {
            type: Number,
            default: 0,
            min: [0, 'Total price cannot be negative'],
        },
        totalItems: {
            type: Number,
            default: 0,
            min: [0, 'Total items cannot be negative'],
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

cartSchema.pre('save', function () {
    this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
    this.totalPrice =
        Math.round(
            this.items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100
        ) / 100;
});

const PRODUCT_FIELDS =
    'name brand price originalPrice discount rating reviews quantityAvailable images inStock isActive slug category';

const POPULATE_PRODUCT = {
    path: 'items.product',
    select: PRODUCT_FIELDS,
    populate: [
        { path: 'brand', select: 'name slug' },
        { path: 'category', select: 'name slug' }
    ]
};

const getProductId = (productRef) => {
    if (!productRef) return null;
    if (productRef._id) return productRef._id.toString();
    return productRef.toString();
};

cartSchema.statics.getOrCreate = async function (userId) {
    let cart = await this.findOne({ user: userId }).populate(POPULATE_PRODUCT);
    if (!cart) {
        cart = await this.create({ user: userId, items: [] });
        cart = await this.findById(cart._id).populate(POPULATE_PRODUCT);
    }
    return cart;
};

cartSchema.methods.addItem = async function (productId, price, quantity = 1) {
    const pid = productId.toString();

    const existing = this.items.find((item) => getProductId(item.product) === pid);

    if (existing) {
        existing.quantity = Math.min(existing.quantity + quantity, 100);
    } else {
        this.items.push({ product: productId, price, quantity });
    }

    await this.save();

    return this.constructor
        .findById(this._id)
        .populate(POPULATE_PRODUCT);
};

cartSchema.methods.updateItem = async function (productId, quantity) {
    const pid = productId.toString();
    const item = this.items.find((i) => getProductId(i.product) === pid);
    if (!item) return null;

    const Product = mongoose.model('Product');
    const product = await Product.findById(productId).select('price isActive');

    if (!product || !product.isActive) {
        throw new Error('Product is no longer available');
    }

    item.quantity = quantity;
    item.price = product.price;

    await this.save();
    return this.constructor.findById(this._id).populate(POPULATE_PRODUCT);
};

cartSchema.methods.removeItem = async function (productId) {
    const pid = productId.toString();

    
    this.items = this.items.filter((i) => getProductId(i.product) !== pid);
    await this.save();

    return this.constructor
        .findById(this._id)
        .populate(POPULATE_PRODUCT);
};

cartSchema.methods.clearCart = async function () {
    this.items = [];
    return this.save();
};

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;