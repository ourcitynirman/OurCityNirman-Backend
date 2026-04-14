import asyncHandler from "../../utils/asyncHandler.js";
import Product from "../../models/Product.js";
import Shop from "../../models/shop.model.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../../utils/cloudinary.js";
import ApiError from "../../utils/ApiError.js";
import mongoose from 'mongoose';

const getAllProducts = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 50, sort = '-createdAt',
    category, brand, minPrice, maxPrice,
    minRating, inStock, featured, trending,
    search, offer, bestFor, vendorId, sku
  } = req.query;

  const isAdminOrVendor = req.user && ['admin', 'vendor'].includes(req.user.role);
  const query = isAdminOrVendor ? {} : { isActive: true };

  if (category) { const arr = category.split(',').map(c => c.trim()); query.category = arr.length > 1 ? { $in: arr } : arr[0]; }
  if (brand) { const arr = brand.split(',').map(b => b.trim()); query.brand = arr.length > 1 ? { $in: arr } : arr[0]; }
  if (minPrice !== undefined || maxPrice !== undefined) { query.price = {}; if (minPrice !== undefined) query.price.$gte = Number(minPrice); if (maxPrice !== undefined) query.price.$lte = Number(maxPrice); }
  if (minRating) query.rating = { $gte: Number(minRating) };
  if (inStock !== undefined) query.inStock = inStock === 'true';
  if (featured !== undefined) query.featured = featured === 'true';
  if (trending !== undefined) query.trending = trending === 'true';
  if (bestFor) query.bestFor = { $regex: bestFor, $options: 'i' };
  if (search) query.$text = { $search: search };
  if (offer === 'true') query.discount = { $gt: 0 };
  if (vendorId) query.vendorId = vendorId;
  if (sku) query.sku = sku.toUpperCase();

  const skip = (Number(page) - 1) * Number(limit);
  const [products, total] = await Promise.all([
    Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .populate('vendorId', 'fullName email phone')
      .select('-__v -basePrice')
      .lean(),
    Product.countDocuments(query),
  ]);

  res.status(200).json({ success: true, count: products.length, total, pagination: { page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) }, products });
});

const getProductById = asyncHandler(async (req, res) => {
  const isPrivileged = req.user && ['vendor', 'admin'].includes(req.user.role);
  const selectFields = isPrivileged ? '-__v' : '-__v -basePrice';
  const product = await Product.findById(req.params.id).populate('reviews').select(selectFields).lean();
  if (!product) throw new ApiError(404, 'Product not found');
  if (!product.isActive) throw new ApiError(404, 'Product unavailable');
  res.status(200).json({ success: true, product });
});

const getProductBySlug = asyncHandler(async (req, res) => {
  const slug = req.params.slug?.trim();
  if (!slug) throw new ApiError(400, 'Slug required');
  const isPrivileged = req.user && ['vendor', 'admin'].includes(req.user.role);
  const selectFields = isPrivileged ? '-__v' : '-__v -basePrice';
  const product = await Product.findOne({ slug, isActive: true }).populate('reviews').select(selectFields).lean();
  if (!product) throw new ApiError(404, 'Product not found');
  res.status(200).json({ success: true, product });
});

const getProductByIdentifier = asyncHandler(async (req, res) => {
  const { identifier } = req.params;
  if (!identifier) throw new ApiError(400, 'Identifier required');
  const isMongoId = mongoose.Types.ObjectId.isValid(identifier);
  const isPrivileged = req.user && ['vendor', 'admin'].includes(req.user.role);
  const selectFields = isPrivileged ? '-__v' : '-__v -basePrice';
  const product = isMongoId
    ? await Product.findById(identifier).populate('reviews').select(selectFields).lean()
    : await Product.findOne({ slug: identifier, isActive: true }).populate('reviews').select(selectFields).lean();
  if (!product) throw new ApiError(404, 'Product not found');
  if (!product.isActive) throw new ApiError(404, 'Product unavailable');
  res.status(200).json({ success: true, product });
});

const getProductsByVendor = asyncHandler(async (req, res) => {
  const vendorId = req.params.vendorId || req.user?._id;
  if (!vendorId || vendorId === 'undefined') throw new ApiError(400, 'Vendor ID required');
  if (!mongoose.Types.ObjectId.isValid(vendorId)) throw new ApiError(400, `Invalid vendor ID: ${vendorId}`);

  const options = {
    page: req.query.page || 1,
    limit: req.query.limit || 50,
    sort: req.query.sort || '-createdAt',
    category: req.query.category,
    brand: req.query.brand,
    inStock: req.query.inStock !== undefined ? req.query.inStock === 'true' : undefined,
    featured: req.query.featured !== undefined ? req.query.featured === 'true' : undefined,
    trending: req.query.trending !== undefined ? req.query.trending === 'true' : undefined,
    search: req.query.search,
  };

  const result = await Product.getVendorProducts(vendorId, options);
  res.status(200).json({ success: true, count: result.products.length, ...result });
});

const createProduct = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new ApiError(401, 'Unauthorized');
  const vendorId = req.user._id;
  const isAdmin = req.user.role === 'admin';

  if (!isAdmin) {
    const shop = await Shop.findOne({ vendor: vendorId });
    if (!shop) throw new ApiError(403, 'Create a shop first');
    if (shop.verificationStatus === 'not_requested') throw new ApiError(403, 'Submit verification documents first');
    if (shop.verificationStatus === 'pending') throw new ApiError(403, 'Verification under review, wait for approval');
    if (shop.verificationStatus === 'rejected') throw new ApiError(403, `Verification rejected: "${shop.rejectionReason || 'Not specified'}". Re-submit documents`);
    if (!shop.isVerified) throw new ApiError(403, 'Shop not verified. Contact support');
  }

  const {
    name, brand, company, category, description,
    price, originalPrice, basePrice, quantityAvailable = 0,
    featured = false, trending = false,
    dimensions, bestFor, weight, material,
    warranty, origin, minOrder,
  } = req.body;

  if ([name, brand, company, category, description].some(f => !f?.trim()) || price === undefined || originalPrice === undefined) {
    throw new ApiError(400, 'All required fields must be provided');
  }

  if (basePrice !== undefined && Number(basePrice) > Number(price)) {
    throw new ApiError(400, 'basePrice cannot be greater than selling price');
  }

  const imageLocalPaths = req.files?.images?.map(f => f.path);
  if (!imageLocalPaths?.length) throw new ApiError(400, 'At least one image required');

  const results = await Promise.all(imageLocalPaths.map(p => uploadOnCloudinary(p)));
  const uploadedImages = results.filter(r => r?.url).map(r => r.url);
  if (!uploadedImages.length) throw new ApiError(400, 'Image upload failed');

  const product = await Product.create({
    name, brand, company, category, description,
    price, originalPrice, quantityAvailable,
    basePrice: basePrice !== undefined ? Number(basePrice) : null,
    images: uploadedImages,
    featured, trending, vendorId,
    dimensions: dimensions?.trim() || null,
    bestFor: bestFor?.trim() || null,
    weight: weight || null,
    material: material?.trim() || null,
    warranty: warranty?.trim() || null,
    origin: origin?.trim() || null,
    minOrder: minOrder || null,
  });

  res.status(201).json({ success: true, message: 'Product created', product });
});

const updateProduct = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new ApiError(401, 'Unauthorized');

  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');

  const isAdmin = req.user.role === 'admin';
  const isOwner = product.vendorId.toString() === req.user._id.toString();
  if (!isAdmin && !isOwner) throw new ApiError(403, 'Not authorized');

  delete req.body.vendorId;

  const vendorAllowedFields = [
    'name', 'brand', 'company', 'category', 'price', 'originalPrice', 'basePrice',
    'quantityAvailable', 'description', 'inStock', 'dimensions',
    'bestFor', 'weight', 'material', 'warranty', 'origin', 'minOrder',
  ];
  const adminOnlyFields = ['featured', 'trending', 'isActive', 'rating', 'reviews', 'discount'];
  const allowedFields = isAdmin ? [...vendorAllowedFields, ...adminOnlyFields] : vendorAllowedFields;

  allowedFields.forEach(field => { if (req.body[field] !== undefined) product[field] = req.body[field]; });

  if (req.body.basePrice !== undefined) {
    const bp = Number(req.body.basePrice);
    const sp = req.body.price !== undefined ? Number(req.body.price) : product.price;
    if (bp > sp) throw new ApiError(400, 'basePrice cannot be greater than selling price');
    product.basePrice = bp;
  }

  const finalPrice = req.body.price !== undefined ? req.body.price : product.price;
  const finalOriginalPrice = req.body.originalPrice !== undefined ? req.body.originalPrice : product.originalPrice;
  if (finalOriginalPrice > 0) {
    const discount = Math.round(((finalOriginalPrice - finalPrice) / finalOriginalPrice) * 100);
    product.discount = discount > 0 ? discount : 0;
  }

  const imageLocalPaths = req.files?.images?.map(f => f.path);
  if (imageLocalPaths?.length) {
    await Promise.all(product.images.map(url => deleteFromCloudinary(url)));
    const results = await Promise.all(imageLocalPaths.map(p => uploadOnCloudinary(p)));
    const newImages = results.filter(r => r?.url).map(r => r.url);
    if (!newImages.length) throw new ApiError(400, 'Image upload failed');
    product.images = newImages;
  }

  product.inStock = product.quantityAvailable > 0;
  const updatedProduct = await product.save();
  res.status(200).json({ success: true, message: 'Product updated', product: updatedProduct });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');

  if (product.vendorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized');
  }

  product.isActive = false;
  await product.save();
  res.status(200).json({ success: true, message: 'Product deleted' });
});

const permanentDeleteProduct = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new ApiError(401, 'Unauthorized');

  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');

  if (product.vendorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized');
  }

  if (product.images?.length) await Promise.all(product.images.map(url => deleteFromCloudinary(url)));
  await product.deleteOne();
  res.status(200).json({ success: true, message: 'Product permanently deleted' });
});

const updateProductStock = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  if (quantity === undefined) throw new ApiError(400, 'Quantity required');

  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');

  if (product.vendorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized');
  }

  const updatedProduct = await product.updateStock(Number(quantity));
  res.status(200).json({ success: true, message: 'Stock updated', product: updatedProduct });
});

const getProductStats = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new ApiError(401, 'Authentication required');
  const isAdmin = req.user.role === 'admin';
  const matchFilter = isAdmin ? { isActive: true } : { vendorId: new mongoose.Types.ObjectId(req.user._id), isActive: true };

  const [stats, categoryStats, brandStats] = await Promise.all([
    Product.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStock: { $sum: '$quantityAvailable' },
          avgRating: { $avg: '$rating' },
          totalValue: { $sum: { $multiply: ['$price', '$quantityAvailable'] } },
          inStockProducts: { $sum: { $cond: [{ $eq: ['$inStock', true] }, 1, 0] } },
          outOfStockProducts: { $sum: { $cond: [{ $eq: ['$inStock', false] }, 1, 0] } },
          featuredProducts: { $sum: { $cond: [{ $eq: ['$featured', true] }, 1, 0] } },
          trendingProducts: { $sum: { $cond: [{ $eq: ['$trending', true] }, 1, 0] } },
          lowStockProducts: { $sum: { $cond: [{ $and: [{ $eq: ['$inStock', true] }, { $lte: ['$quantityAvailable', 50] }] }, 1, 0] } },
          avgDiscount: { $avg: '$discount' },
          totalSavingsValue: { $sum: { $multiply: [{ $subtract: ['$originalPrice', '$price'] }, '$quantityAvailable'] } },
          totalBaseCostValue: { $sum: { $multiply: [{ $ifNull: ['$basePrice', 0] }, '$quantityAvailable'] } },
          avgMargin: {
            $avg: {
              $cond: [
                { $and: [{ $gt: ['$basePrice', 0] }, { $gt: ['$price', 0] }] },
                { $multiply: [{ $divide: [{ $subtract: ['$price', '$basePrice'] }, '$price'] }, 100] },
                null,
              ]
            }
          },
        }
      },
    ]),

    Product.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$category', count: { $sum: 1 }, totalStock: { $sum: '$quantityAvailable' }, avgPrice: { $avg: '$price' } } },
      { $sort: { count: -1 } },
    ]),

    Product.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$brand', count: { $sum: 1 }, totalStock: { $sum: '$quantityAvailable' }, avgRating: { $avg: '$rating' } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  res.status(200).json({ success: true, stats: stats[0] || {}, categoryBreakdown: categoryStats, topBrands: brandStats });
});

const getFeaturedProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const query = { featured: true, isActive: true, inStock: true };
  if (req.query.category) query.category = req.query.category;

  const products = await Product.find(query)
    .sort({ rating: -1, createdAt: -1 })
    .limit(limit)
    .select('-__v -basePrice')
    .lean();

  res.status(200).json({ success: true, count: products.length, products });
});

const getTrendingProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const matchStage = { isActive: true, inStock: true };
  if (req.query.category) matchStage.category = req.query.category;

  const products = await Product.aggregate([
    { $match: matchStage },
    { $addFields: { daysOld: { $divide: [{ $subtract: [new Date(), '$createdAt'] }, 86400000] } } },
    { $addFields: { freshnessScore: { $cond: [{ $lte: ['$daysOld', 7] }, 50, 0] } } },
    {
      $addFields: {
        trendingScore: {
          $add: [
            { $multiply: [{ $ifNull: ['$totalOrders', 0] }, 5] },
            { $multiply: ['$rating', 20] },
            { $multiply: [{ $size: { $ifNull: ['$reviews', []] } }, 0.5] },
            '$freshnessScore',
            { $cond: [{ $eq: ['$trending', true] }, 30, 0] },
          ]
        }
      }
    },
    { $sort: { trendingScore: -1 } },
    { $limit: limit },
    { $project: { __v: 0, trendingScore: 0, daysOld: 0, freshnessScore: 0, basePrice: 0 } },
  ]);

  res.status(200).json({ success: true, count: products.length, products });
});

const getLowStockProducts = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new ApiError(401, 'Authentication required');
  const threshold = Number(req.query.threshold) || 50;

  const isAdmin = req.user.role === 'admin';
  const query = {
    isActive: true,
    inStock: true,
    quantityAvailable: { $lte: threshold },
  };
  if (!isAdmin) query.vendorId = req.user._id;

  const products = await Product.find(query)
    .sort('quantityAvailable')
    .select('-__v')
    .lean();

  res.status(200).json({ success: true, count: products.length, products });
});

const getAllBrands = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.category) filter.category = req.query.category;
  const brands = await Product.distinct('brand', filter);
  res.status(200).json({ success: true, count: brands.length, brands: brands.sort() });
});

const getAllCategories = asyncHandler(async (req, res) => {
  const categories = Product.getCategories();
  res.status(200).json({ success: true, count: categories.length, categories });
});

const bulkUpdateProducts = asyncHandler(async (req, res) => {
  const { productIds, updates } = req.body;
  if (!productIds?.length) throw new ApiError(400, 'Product IDs required');
  if (!updates || !Object.keys(updates).length) throw new ApiError(400, 'Updates required');

  delete updates.vendorId;
  delete updates.slug;

  const isAdmin = req.user.role === 'admin';
  const filter = { _id: { $in: productIds }, isActive: true };
  if (!isAdmin) filter.vendorId = req.user._id;

  const result = await Product.updateMany(
    filter,
    updates
  );

  res.status(200).json({ success: true, message: `${result.modifiedCount} products updated`, modifiedCount: result.modifiedCount });
});

const SearchProducts = asyncHandler(async (req, res) => {
  const {
    q, page = 1, limit = 12,
    category, brand, minPrice, maxPrice,
    inStock, sort = 'relevant', trending, featured,
  } = req.query;

  if (!q?.trim()) throw new ApiError(400, 'Search query "q" required');

  const keyword = q.trim();
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(Math.max(1, Number(limit)), 50);

  const filter = { isActive: true, $text: { $search: keyword } };

  if (category) filter.category = { $regex: category, $options: 'i' };
  if (brand) filter.brand = { $regex: brand, $options: 'i' };
  if (inStock !== undefined) filter.inStock = inStock === 'true';
  if (trending !== undefined) filter.trending = trending === 'true';
  if (featured !== undefined) filter.featured = featured === 'true';
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
    if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
  }

  const sortMap = {
    relevant: { score: { $meta: 'textScore' } },
    newest: { createdAt: -1 },
    price_low: { price: 1 },
    price_high: { price: -1 },
    rating: { rating: -1 },
    discount: { discount: -1 },
  };

  const [products, total] = await Promise.all([
    Product.find(filter, { score: { $meta: 'textScore' }, __v: 0, basePrice: 0 })
      .sort(sortMap[sort] ?? sortMap.relevant)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Product.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true, query: keyword, count: products.length, total,
    pagination: { page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    products,
  });
});

const getLatestProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const query = { isActive: true, inStock: true };
  if (req.query.category) query.category = req.query.category;

  const products = await Product.find(query).sort({ createdAt: -1 }).limit(limit).select('-__v -basePrice').lean();
  res.status(200).json({ success: true, count: products.length, products });
});

const getOfferProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const page = Math.max(1, Number(req.query.page) || 1);
  const skip = (page - 1) * limit;

  const query = { isActive: true, inStock: true, discount: { $gt: 0 } };
  if (req.query.category) query.category = req.query.category;
  if (req.query.minDiscount) query.discount = { $gte: Number(req.query.minDiscount) };

  const [products, total] = await Promise.all([
    Product.find(query).sort({ discount: -1 }).skip(skip).limit(limit).select('-__v -basePrice').lean(),
    Product.countDocuments(query),
  ]);

  res.status(200).json({ success: true, count: products.length, total, pagination: { page, limit, pages: Math.ceil(total / limit) }, products });
});

const addProductReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.body;
  if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) throw new ApiError(400, 'Valid review ID required');

  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  if (!product.isActive) throw new ApiError(404, 'Product unavailable');

  if (product.reviews.some(r => r.toString() === reviewId)) throw new ApiError(409, 'Review already exists');

  product.reviews.push(reviewId);
  await product.save();
  res.status(200).json({ success: true, message: 'Review added' });
});

const updateProductRating = asyncHandler(async (req, res) => {
  const { rating } = req.body;
  if (rating === undefined || rating < 0 || rating > 5) throw new ApiError(400, 'Rating must be between 0-5');

  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');

  const updated = await product.updateRating(Number(rating));
  res.status(200).json({ success: true, message: 'Rating updated', rating: updated.rating });
});

const toggleProductStatus = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new ApiError(401, 'Unauthorized');

  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');

  const isAdmin = req.user.role === 'admin';
  const isOwner = product.vendorId.toString() === req.user._id.toString();
  if (!isAdmin && !isOwner) throw new ApiError(403, 'Not authorized');

  product.isActive = !product.isActive;
  await product.save();
  res.status(200).json({ success: true, message: `Product ${product.isActive ? 'activated' : 'deactivated'}`, isActive: product.isActive });
});

const toggleFeatured = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');

  product.featured = !product.featured;
  await product.save();
  res.status(200).json({ success: true, message: `Product ${product.featured ? 'featured' : 'unfeatured'}`, featured: product.featured });
});

const toggleTrending = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');

  product.trending = !product.trending;
  await product.save();
  res.status(200).json({ success: true, message: `Product ${product.trending ? 'marked trending' : 'removed from trending'}`, trending: product.trending });
});

const updateBasePrice = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new ApiError(401, 'Unauthorized');

  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');

  const isAdmin = req.user.role === 'admin';
  const isOwner = product.vendorId.toString() === req.user._id.toString();
  if (!isAdmin && !isOwner) throw new ApiError(403, 'Not authorized');

  const { basePrice } = req.body;
  if (basePrice === undefined || basePrice === null) throw new ApiError(400, 'basePrice required');

  const bp = Number(basePrice);
  if (isNaN(bp) || bp < 0) throw new ApiError(400, 'basePrice must be a non-negative number');
  if (bp > product.price) throw new ApiError(400, `basePrice (${bp}) cannot exceed selling price (${product.price})`);

  product.basePrice = bp;
  await product.save();

  res.status(200).json({ success: true, message: 'Base price updated', basePrice: product.basePrice });
});

export {
  getAllProducts,
  getProductById,
  getProductBySlug,
  getProductByIdentifier,
  getProductsByVendor,
  createProduct,
  updateProduct,
  deleteProduct,
  permanentDeleteProduct,
  updateProductStock,
  updateBasePrice,
  getProductStats,
  getFeaturedProducts,
  getTrendingProducts,
  getLowStockProducts,
  getAllBrands,
  getAllCategories,
  bulkUpdateProducts,
  SearchProducts,
  getLatestProducts,
  getOfferProducts,
  addProductReview,
  updateProductRating,
  toggleProductStatus,
  toggleFeatured,
  toggleTrending,
};