import mongoose from 'mongoose';
import asyncHandler from "../../shared/utils/asyncHandler.js";
import ApiError from "../../shared/utils/ApiError.js";
import ApiResponse from '../../shared/utils/ApiResponse.js';
import Product from "./product.model.js";
import Category from "../category/category.model.js";
import Brand from "../brand/brand.model.js";
import Shop from "../shop/shop.model.js";
import Review from "../review/review.model.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../../shared/utils/cloudinary.js";
import { 
  resolveCategoryFilter, 
  resolveBrandFilter,
  populateCategoriesOnProducts, 
  populateBrandsOnProducts,
  buildPaginationMeta,
  sanitizeSortParam
} from "../../shared/utils/product.helpers.js";

// --- FETCHING CONTROLLERS (from product.fetch.js) ---

/**
 * @desc    Get all products with advanced filtering and pagination
 * @route   GET /api/v1/products
 * @access  Public
 */
export const getAllProducts = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 50, sort = '-createdAt',
    category, brand, minPrice, maxPrice,
    minRating, inStock, featured, trending,
    search, offer, bestFor, vendorId, sku,
    after
  } = req.query;

  const isAdminOrVendor = req.user && ['admin', 'vendor'].includes(req.user.role);
  const query = isAdminOrVendor ? {} : { isActive: true };

  // 1. Handle Category Filtering using shared helper
  const categoryFilter = await resolveCategoryFilter(category);
  Object.assign(query, categoryFilter);

  // 2. Generic Filters
  if (brand) {
    const brandFilter = await resolveBrandFilter(brand);
    Object.assign(query, brandFilter);
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    query.price = {};
    if (minPrice !== undefined) query.price.$gte = Number(minPrice);
    if (maxPrice !== undefined) query.price.$lte = Number(maxPrice);
  }

  if (minRating) query.rating = { $gte: Number(minRating) };
  if (inStock !== undefined) query.inStock = inStock === 'true';
  if (featured !== undefined) query.featured = featured === 'true';
  if (trending !== undefined) query.trending = trending === 'true';
  if (bestFor) query.bestFor = { $regex: bestFor, $options: 'i' };
  if (search) query.$text = { $search: search };
  if (offer === 'true') query.discount = { $gt: 0 };
  if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) query.vendorId = vendorId;
  if (sku) query.sku = sku.toUpperCase();

  // 3. Pagination & Cursor
  const limitNum = Number(limit);
  const sortMap = {
    '-createdAt': { createdAt: -1, _id: -1 },
    'createdAt': { createdAt: 1, _id: 1 },
    '-price': { price: -1, _id: -1 },
    'price': { price: 1, _id: 1 },
    '-rating': { rating: -1, _id: -1 }
  };
  const sortObj = sortMap[sort] || sortMap['-createdAt'];

  if (after && mongoose.Types.ObjectId.isValid(after)) {
    query._id = sortObj._id === -1 ? { $lt: after } : { $gt: after };
  }
  
  const skip = after ? 0 : (Number(page) - 1) * limitNum;

  const aggregatePipeline = [
    { $match: query },
    {
      $facet: {
        metadata: [{ $count: "total" }],
        products: [
          { $sort: sortObj },
          { $skip: skip },
          { $limit: limitNum },
          { $project: { __v: 0, basePrice: 0 } }
        ],
        categoryFacets: [
          { $group: { _id: "$category", count: { $sum: 1 } } }
        ],
        brandFacets: [
          { $group: { _id: "$brand", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 20 }
        ]
      }
    }
  ];

  const [results] = await Product.aggregate(aggregatePipeline);
  const total = results.metadata[0]?.total || 0;
  const productsRaw = results.products;
  
  const populatedCategories = await populateCategoriesOnProducts(productsRaw);
  const products = await populateBrandsOnProducts(populatedCategories);
  
  if (products.length > 0) {
    const vendorIds = [...new Set(products.map(p => p.vendorId).filter(id => id))];
    const User = mongoose.model('User');
    const vendors = await User.find({ _id: { $in: vendorIds } }).select('fullName email phone').lean();
    const vendorMap = new Map(vendors.map(v => [v._id.toString(), v]));
    products.forEach(p => {
      if (p.vendorId && vendorMap.has(p.vendorId.toString())) {
        p.vendorId = vendorMap.get(p.vendorId.toString());
      }
    });
  }

  const brandIds = results.brandFacets.map(b => b._id).filter(id => id);
  const resolvedBrands = brandIds.length > 0 
    ? await Brand.find({ _id: { $in: brandIds } }).select('name slug logo').lean()
    : [];
  const brandMap = new Map(resolvedBrands.map(b => [b._id.toString(), b]));
  
  const formattedBrandFacets = results.brandFacets.map(b => {
    const brandData = brandMap.get(b._id?.toString());
    return {
        id: b._id,
        name: brandData?.name || 'Unknown',
        slug: brandData?.slug,
        logo: brandData?.logo,
        count: b.count
    };
  });

  res.status(200).json({
    success: true,
    count: products.length,
    pagination: buildPaginationMeta(page, limit, total),
    products,
    facets: {
      categories: results.categoryFacets.map(c => ({ _id: c._id, count: c.count })),
      brands: formattedBrandFacets
    }
  });
});

export const getProductById = asyncHandler(async (req, res) => {
  const isPrivileged = req.user && ['vendor', 'admin'].includes(req.user.role);
  const selectFields = isPrivileged ? '-__v' : '-__v -basePrice';

  const product = await Product.findById(req.params.id)
    .populate({ path: 'category', select: '_id name slug ancestors' })
    .populate({ path: 'brand', select: 'name slug logo' })
    .populate({ path: 'reviews', select: 'rating title comment createdAt user', populate: { path: 'user', select: 'fullName' } })
    .select(selectFields)
    .lean();

  if (!product) throw new ApiError(404, 'Product not found');
  if (!product.isActive && !isPrivileged) throw new ApiError(404, 'Product unavailable');

  res.status(200).json({ success: true, product });
});

export const getProductBySlug = asyncHandler(async (req, res) => {
  const slug = req.params.slug?.trim();
  if (!slug) throw new ApiError(400, 'Slug required');

  const isPrivileged = req.user && ['vendor', 'admin'].includes(req.user.role);
  const selectFields = isPrivileged ? '-__v' : '-__v -basePrice';

  const product = await Product.findOne({ slug, isActive: true })
    .populate({ path: 'category', select: '_id name slug ancestors' })
    .populate({ path: 'brand', select: 'name slug logo' })
    .populate({ path: 'reviews', select: 'rating title comment createdAt user', populate: { path: 'user', select: 'fullName' } })
    .select(selectFields)
    .lean();

  if (!product) throw new ApiError(404, 'Product not found');
  res.status(200).json({ success: true, product });
});

export const getProductByIdentifier = asyncHandler(async (req, res) => {
  const { identifier } = req.params;
  const isMongoId = mongoose.Types.ObjectId.isValid(identifier);
  const isPrivileged = req.user && ['vendor', 'admin'].includes(req.user.role);
  const selectFields = isPrivileged ? '-__v' : '-__v -basePrice';

  const product = isMongoId
    ? await Product.findById(identifier)
        .populate({ path: 'category', select: '_id name slug ancestors' })
        .populate({ path: 'brand', select: 'name slug logo' })
        .populate({ path: 'reviews', select: 'rating title comment createdAt user', populate: { path: 'user', select: 'fullName' } })
        .select(selectFields).lean()
    : await Product.findOne({ slug: identifier, isActive: true })
        .populate({ path: 'category', select: '_id name slug ancestors' })
        .populate({ path: 'brand', select: 'name slug logo' })
        .populate({ path: 'reviews', select: 'rating title comment createdAt user', populate: { path: 'user', select: 'fullName' } })
        .select(selectFields).lean();

  if (!product) throw new ApiError(404, 'Product not found');
  res.status(200).json({ success: true, product });
});

export const getProductsByVendor = asyncHandler(async (req, res) => {
  let { vendorId } = req.params;
  const vStr = String(vendorId || "").trim().toLowerCase();
  if (!vendorId || vStr === 'my-products' || vStr === 'undefined') vendorId = req.user?._id;

  if (!vendorId) throw new ApiError(400, 'Vendor ID required');
  const result = await Product.getVendorProducts(vendorId, {
    page: req.query.page || 1,
    limit: req.query.limit || 50,
    sort: req.query.sort || '-createdAt',
    brand: req.query.brand,
    inStock: req.query.inStock !== undefined ? req.query.inStock === 'true' : undefined,
    featured: req.query.featured !== undefined ? req.query.featured === 'true' : undefined,
    trending: req.query.trending !== undefined ? req.query.trending === 'true' : undefined,
    search: req.query.search,
    category: (await resolveCategoryFilter(req.query.category)).categoryAncestors
  });
  res.status(200).json({ success: true, count: result.products.length, ...result });
});

export const getFeaturedProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const query = { featured: true, isActive: true, inStock: true };
  Object.assign(query, await resolveCategoryFilter(req.query.category));
  const productsRaw = await Product.find(query).sort({ rating: -1, createdAt: -1 }).limit(limit).select('-__v -basePrice').lean();
  const products = await populateBrandsOnProducts(await populateCategoriesOnProducts(productsRaw));
  res.status(200).json({ success: true, count: products.length, products });
});

export const getTrendingProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const matchStage = { isActive: true, inStock: true };
  Object.assign(matchStage, await resolveCategoryFilter(req.query.category));
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

export const getLatestProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const query = { isActive: true, inStock: true };
  Object.assign(query, await resolveCategoryFilter(req.query.category));
  const productsRaw = await Product.find(query).sort({ createdAt: -1 }).limit(limit).select('-__v -basePrice').lean();
  const products = await populateCategoriesOnProducts(productsRaw);
  res.status(200).json({ success: true, count: products.length, products });
});

export const getOfferProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const page = Math.max(1, Number(req.query.page) || 1);
  const query = { isActive: true, inStock: true, discount: { $gt: 0 } };
  Object.assign(query, await resolveCategoryFilter(req.query.category));
  if (req.query.minDiscount) query.discount = { $gte: Number(req.query.minDiscount) };
  const [productsRaw, total] = await Promise.all([
    Product.find(query).sort({ discount: -1 }).skip((page - 1) * limit).limit(limit).select('-__v -basePrice').lean(),
    Product.countDocuments(query),
  ]);
  const products = await populateBrandsOnProducts(await populateCategoriesOnProducts(productsRaw));
  res.status(200).json({ success: true, count: products.length, pagination: buildPaginationMeta(page, limit, total), products });
});

// --- MANAGEMENT CONTROLLERS (from product.manage.js) ---

export const createProduct = asyncHandler(async (req, res) => {
  const vendorId = req.user._id;
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin) {
    const shop = await Shop.findOne({ vendor: vendorId });
    if (!shop || (shop.verificationStatus !== 'approved' && !shop.isVerified)) throw new ApiError(403, 'Shop not verified or not found');
  }
  const { name, brand, company, category, description, price, originalPrice, basePrice, quantityAvailable = 0, featured = false, trending = false, dimensions, bestFor, attributes, variants, offer, hsn, igstRate, images: imageBody } = req.body;
  
  let brandId = brand;
  if (!mongoose.Types.ObjectId.isValid(brand)) {
    const foundBrand = await Brand.findOne({ $or: [{ name: brand }, { slug: brand.toLowerCase() }] }).select('_id').lean();
    brandId = foundBrand ? foundBrand._id : (await Brand.create({ name: brand }))._id;
  }
  const categoryDoc = await Category.findById(category).lean();
  if (!categoryDoc?.isLeaf) throw new ApiError(400, 'Specific leaf category required');
  const categoryAncestors = [...(categoryDoc.ancestors?.map(a => a._id) || []), categoryDoc._id];

  let uploadedImages = [];
  if (req.files?.images) {
    const results = await Promise.all(req.files.images.map(f => uploadOnCloudinary(f.path)));
    uploadedImages = results.filter(r => r?.url).map((r, i) => ({ url: r.url, isPrimary: i === 0 }));
  } else if (Array.isArray(imageBody)) {
    uploadedImages = imageBody.map((img, i) => typeof img === 'string' ? { url: img, isPrimary: i === 0 } : { url: img.url, alt: img.alt || '', isPrimary: img.isPrimary || false });
  }
  if (!uploadedImages.length) throw new ApiError(400, 'At least one image required');

  const product = await Product.create({ vendorId, name, brand: brandId, company, description, category, categoryAncestors, price, originalPrice, quantityAvailable, basePrice: basePrice ? Number(basePrice) : null, images: uploadedImages, variants: Array.isArray(variants) ? variants : [], attributes: Array.isArray(attributes) ? attributes : [], featured, trending, dimensions, bestFor, offer, hsn, igstRate });
  res.status(201).json({ success: true, message: 'Product created', product: await Product.findById(product._id).populate('category', 'name slug') });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const existing = await Product.findById(req.params.id);
  if (!existing) throw new ApiError(404, 'Product not found');
  if (existing.vendorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') throw new ApiError(403, 'Unauthorized');

  const updateData = { ...req.body };
  ['vendorId', 'reviews', 'rating', 'reviewCount'].forEach(f => delete updateData[f]);

  if (updateData.category && updateData.category !== existing.category.toString()) {
    const cat = await Category.findById(updateData.category).lean();
    if (!cat?.isLeaf) throw new ApiError(400, 'Leaf category required');
    updateData.categoryAncestors = [...(cat.ancestors?.map(a => a._id) || []), cat._id];
  }

  if (req.files?.images) {
    const results = await Promise.all(req.files.images.map(f => uploadOnCloudinary(f.path)));
    updateData.images = results.filter(r => r?.url).map((r, i) => ({ url: r.url, isPrimary: i === 0 }));
  }

  const updated = await Product.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true, runValidators: true }).populate('category', 'name slug');
  res.status(200).json({ success: true, message: 'Product updated', product: updated });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  if (product.vendorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') throw new ApiError(403, 'Unauthorized');
  await Product.findByIdAndUpdate(req.params.id, { isActive: false });
  res.status(200).json({ success: true, message: 'Product deactivated' });
});

export const permanentDeleteProduct = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new ApiError(403, 'Admin only');
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  if (product.images?.length) await Promise.all(product.images.map(img => deleteFromCloudinary(img.url)));
  await Review.deleteMany({ _id: { $in: product.reviews } });
  await Product.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Permanently deleted' });
});

export const bulkUpdateProducts = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new ApiError(403, 'Admin only');
  const { productIds, updates } = req.body;
  const allowed = {};
  ['featured', 'trending', 'isActive', 'discount'].forEach(f => { if (updates[f] !== undefined) allowed[f] = updates[f]; });
  const result = await Product.updateMany({ _id: { $in: productIds } }, { $set: allowed });
  res.status(200).json({ success: true, message: `${result.modifiedCount} products updated` });
});

export const toggleProductStatus = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  if (product.vendorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') throw new ApiError(403, 'Unauthorized');
  product.isActive = !product.isActive;
  await product.save();
  res.status(200).json({ success: true, isActive: product.isActive });
});

export const toggleFeatured = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new ApiError(403, 'Admin only');
  const product = await Product.findById(req.params.id);
  product.featured = !product.featured;
  await product.save();
  res.status(200).json({ success: true, featured: product.featured });
});

export const toggleTrending = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new ApiError(403, 'Admin only');
  const product = await Product.findById(req.params.id);
  product.trending = !product.trending;
  await product.save();
  res.status(200).json({ success: true, trending: product.trending });
});

export const updateBasePrice = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  if (product.vendorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') throw new ApiError(403, 'Unauthorized');
  product.basePrice = Number(req.body.basePrice);
  await product.save();
  res.status(200).json({ success: true, basePrice: product.basePrice });
});

// --- STATS CONTROLLERS (from product.stats.js) ---

export const getProductStats = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const matchFilter = isAdmin ? { isActive: true } : { vendorId: new mongoose.Types.ObjectId(req.user._id), isActive: true };
  const [stats, categoryStats, brandStats, topPerformingProducts, revenueByCategory] = await Promise.all([
    Product.aggregate([{ $match: matchFilter }, { $group: { _id: null, totalProducts: { $sum: 1 }, totalStock: { $sum: '$quantityAvailable' }, avgRating: { $avg: '$rating' }, totalValue: { $sum: { $multiply: ['$price', '$quantityAvailable'] } }, inStockProducts: { $sum: { $cond: ['$inStock', 1, 0] } }, outOfStockProducts: { $sum: { $cond: ['$inStock', 0, 1] } }, featuredProducts: { $sum: { $cond: ['$featured', 1, 0] } }, trendingProducts: { $sum: { $cond: ['$trending', 1, 0] } }, lowStockProducts: { $sum: { $cond: [{ $and: ['$inStock', { $lte: ['$quantityAvailable', 50] }] }, 1, 0] } } } }]),
    Product.aggregate([{ $match: matchFilter }, { $group: { _id: '$category', count: { $sum: 1 }, totalStock: { $sum: '$quantityAvailable' } } }, { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } }, { $addFields: { categoryName: { $ifNull: [{ $arrayElemAt: ['$cat.name', 0] }, 'Uncategorized'] } } }, { $project: { cat: 0 } }]),
    Product.aggregate([{ $match: matchFilter }, { $group: { _id: '$brand', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    Product.aggregate([{ $match: matchFilter }, { $sort: { rating: -1 }, }, { $limit: 10 }]),
    Product.aggregate([{ $match: matchFilter }, { $group: { _id: '$category', totalRevenue: { $sum: { $multiply: ['$price', '$quantityAvailable'] } } } }])
  ]);
  res.status(200).json({ success: true, stats: stats[0] || {}, categoryBreakdown: categoryStats, topBrands: brandStats, topPerformingProducts, revenueByCategory });
});

export const getLowStockProducts = asyncHandler(async (req, res) => {
  const threshold = Number(req.query.threshold) || 50;
  const query = { isActive: true, inStock: true, quantityAvailable: { $lte: threshold } };
  if (req.user.role !== 'admin') query.vendorId = req.user._id;
  const products = await Product.find(query).sort('quantityAvailable').lean();
  res.status(200).json({ success: true, count: products.length, products });
});

export const getAllBrands = asyncHandler(async (req, res) => {
  const brands = await Product.distinct('brand', { isActive: true, ...(await resolveCategoryFilter(req.query.category)) });
  res.status(200).json({ success: true, count: brands.length, brands: brands.sort() });
});

// --- REVIEW CONTROLLERS (from product.review.js) ---

export const addProductReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.body;
  const product = await Product.findById(req.params.id);
  if (!product || !product.isActive) throw new ApiError(404, 'Product not found');
  if (product.reviews.includes(reviewId)) throw new ApiError(409, 'Review exists');
  product.reviews.push(reviewId);
  product.reviewCount = product.reviews.length;
  await product.save();
  res.status(200).json({ success: true, message: 'Review added' });
});

export const updateProductRating = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  await product.updateRating(Number(req.body.rating));
  res.status(200).json({ success: true, rating: product.rating });
});

// --- SEARCH CONTROLLER RE-EXPORT ---
export { SearchProducts } from '../search/search.controller.js';