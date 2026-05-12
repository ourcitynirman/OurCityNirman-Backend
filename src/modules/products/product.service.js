import mongoose from 'mongoose';
import Product from "./product.model.js";
import Category from "../category/category.model.js";
import Brand from "../brand/brand.model.js";
import Shop from "../shop/shop.model.js";
import Review from "../review/review.model.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../../shared/utils/cloudinary.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { 
  resolveCategoryFilter, 
  resolveBrandFilter,
  populateCategoriesOnProducts, 
  populateBrandsOnProducts,
  buildPaginationMeta
} from "../../shared/utils/product.helpers.js";

class ProductService {
    static async getAllProducts(queryData, user) {
        const {
            page, limit, sort = '-createdAt',
            category, brand, minPrice, maxPrice,
            minRating, inStock, featured, trending,
            search, offer, bestFor, vendorId, sku,
            after
        } = queryData;

        const isAdminOrVendor = user && ['admin', 'vendor'].includes(user.role);
        const query = isAdminOrVendor ? {} : { isActive: true };

        const categoryFilter = await resolveCategoryFilter(category);
        Object.assign(query, categoryFilter);

        if (brand) {
            const brandFilter = await resolveBrandFilter(brand);
            Object.assign(query, brandFilter);
        }

        if (minPrice !== undefined || maxPrice !== undefined) {
            query.price = {};
            if (minPrice !== undefined) query.price.$gte = minPrice;
            if (maxPrice !== undefined) query.price.$lte = maxPrice;
        }

        if (minRating) query.rating = { $gte: minRating };
        if (inStock !== undefined) query.inStock = inStock === 'true';
        if (featured !== undefined) query.featured = featured === 'true';
        if (trending !== undefined) query.trending = trending === 'true';
        if (bestFor) query.bestFor = { $regex: bestFor, $options: 'i' };
        if (search) query.$text = { $search: search };
        if (offer === 'true') query.discount = { $gt: 0 };
        if (vendorId) query.vendorId = vendorId;
        if (sku) query.sku = sku.toUpperCase();

        const limitNum = limit;
        const sortMap = {
            '-createdAt': { createdAt: -1, _id: -1 },
            'createdAt': { createdAt: 1, _id: 1 },
            '-price': { price: -1, _id: -1 },
            'price': { price: 1, _id: 1 },
            '-rating': { rating: -1, _id: -1 }
        };
        const sortObj = sortMap[sort] || sortMap['-createdAt'];

        if (after) {
            query._id = sortObj._id === -1 ? { $lt: after } : { $gt: after };
        }
        
        const skip = after ? 0 : (page - 1) * limitNum;

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
        const productsWithBrands = await populateBrandsOnProducts(populatedCategories);
        
        if (productsWithBrands.length > 0) {
            const vendorIds = [...new Set(productsWithBrands.map(p => p.vendorId).filter(id => id))];
            const User = mongoose.model('User');
            const vendors = await User.find({ _id: { $in: vendorIds } }).select('fullName email phone').lean();
            const vendorMap = new Map(vendors.map(v => [v._id.toString(), v]));
            productsWithBrands.forEach(p => {
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

        return {
            count: productsWithBrands.length,
            pagination: buildPaginationMeta(page, limit, total),
            products: productsWithBrands,
            facets: {
                categories: results.categoryFacets.map(c => ({ _id: c._id, count: c.count })),
                brands: formattedBrandFacets
            }
        };
    }

    static async getProductById(id, user) {
        const isPrivileged = user && ['vendor', 'admin'].includes(user.role);
        const selectFields = isPrivileged ? '-__v' : '-__v -basePrice';

        const product = await Product.findById(id)
            .populate({ path: 'category', select: '_id name slug ancestors' })
            .populate({ path: 'brand', select: 'name slug logo' })
            .populate({ path: 'reviews', select: 'rating title comment createdAt user', populate: { path: 'user', select: 'fullName' } })
            .select(selectFields)
            .lean();

        if (!product) throw new ApiError(404, 'Product not found');
        if (!product.isActive && !isPrivileged) throw new ApiError(404, 'Product unavailable');

        return product;
    }

    static async getProductBySlug(slug, user) {
        const isPrivileged = user && ['vendor', 'admin'].includes(user.role);
        const selectFields = isPrivileged ? '-__v' : '-__v -basePrice';

        const product = await Product.findOne({ slug, isActive: true })
            .populate({ path: 'category', select: '_id name slug ancestors' })
            .populate({ path: 'brand', select: 'name slug logo' })
            .populate({ path: 'reviews', select: 'rating title comment createdAt user', populate: { path: 'user', select: 'fullName' } })
            .select(selectFields)
            .lean();

        if (!product) throw new ApiError(404, 'Product not found');
        return product;
    }

    static async getProductByIdentifier(identifier, user) {
        const isMongoId = mongoose.Types.ObjectId.isValid(identifier);
        const isPrivileged = user && ['vendor', 'admin'].includes(user.role);
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
        return product;
    }

    static async getProductsByVendor(vendorId, query, user) {
        const vId = vendorId || user?._id;
        if (!vId) throw new ApiError(400, 'Vendor ID required');

        const categoryFilter = await resolveCategoryFilter(query.category);
        
        const result = await Product.getVendorProducts(vId, {
            page: query.page || 1,
            limit: query.limit || 50,
            sort: query.sort || '-createdAt',
            brand: query.brand,
            inStock: query.inStock !== undefined ? query.inStock === 'true' : undefined,
            featured: query.featured !== undefined ? query.featured === 'true' : undefined,
            trending: query.trending !== undefined ? query.trending === 'true' : undefined,
            search: query.search,
            category: categoryFilter.categoryAncestors
        });

        return result;
    }

    static async getFeaturedProducts(query) {
        const limit = Math.min(Number(query.limit) || 10, 50);
        const matchQuery = { featured: true, isActive: true, inStock: true };
        Object.assign(matchQuery, await resolveCategoryFilter(query.category));
        
        const productsRaw = await Product.find(matchQuery).sort({ rating: -1, createdAt: -1 }).limit(limit).select('-__v -basePrice').lean();
        const products = await populateBrandsOnProducts(await populateCategoriesOnProducts(productsRaw));
        return products;
    }

    static async getTrendingProducts(query) {
        const limit = Math.min(Number(query.limit) || 10, 50);
        const matchStage = { isActive: true, inStock: true };
        Object.assign(matchStage, await resolveCategoryFilter(query.category));
        
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
        return products;
    }

    static async getLatestProducts(query) {
        const limit = Math.min(Number(query.limit) || 10, 50);
        const matchQuery = { isActive: true, inStock: true };
        Object.assign(matchQuery, await resolveCategoryFilter(query.category));
        
        const productsRaw = await Product.find(matchQuery).sort({ createdAt: -1 }).limit(limit).select('-__v -basePrice').lean();
        const products = await populateCategoriesOnProducts(productsRaw);
        return products;
    }

    static async getOfferProducts(query) {
        const limit = Math.min(Number(query.limit) || 20, 50);
        const page = Math.max(1, Number(query.page) || 1);
        const matchQuery = { isActive: true, inStock: true, discount: { $gt: 0 } };
        Object.assign(matchQuery, await resolveCategoryFilter(query.category));
        
        if (query.minDiscount) matchQuery.discount = { $gte: Number(query.minDiscount) };
        
        const [productsRaw, total] = await Promise.all([
            Product.find(matchQuery).sort({ discount: -1 }).skip((page - 1) * limit).limit(limit).select('-__v -basePrice').lean(),
            Product.countDocuments(matchQuery),
        ]);
        
        const products = await populateBrandsOnProducts(await populateCategoriesOnProducts(productsRaw));
        return {
            products,
            pagination: buildPaginationMeta(page, limit, total)
        };
    }

    static async createProduct(productData, user, files) {
        const vendorId = user._id;
        const isAdmin = user.role === 'admin';
        
        if (!isAdmin) {
            const shop = await Shop.findOne({ vendor: vendorId });
            if (!shop || (shop.verificationStatus !== 'approved' && !shop.isVerified)) 
                throw new ApiError(403, 'Shop not verified or not found');
        }
        
        const { name, brand, company, category, description, price, originalPrice, basePrice, quantityAvailable = 0, featured = false, trending = false, dimensions, bestFor, attributes, variants, offer, hsn, igstRate, images: imageBody } = productData;
        
        let brandId = brand;
        if (!mongoose.Types.ObjectId.isValid(brand)) {
            const foundBrand = await Brand.findOne({ $or: [{ name: brand }, { slug: brand.toLowerCase() }] }).select('_id').lean();
            brandId = foundBrand ? foundBrand._id : (await Brand.create({ name: brand }))._id;
        }
        
        const categoryDoc = await Category.findById(category).lean();
        if (!categoryDoc) throw new ApiError(400, 'Category not found');
        
        const categoryAncestors = [...(categoryDoc.ancestors?.map(a => a._id) || []), categoryDoc._id];

        let uploadedImages = [];
        if (files?.images) {
            const results = await Promise.all(files.images.map(f => uploadOnCloudinary(f.path)));
            uploadedImages = results.filter(r => r?.url).map((r, i) => ({ url: r.url, isPrimary: i === 0 }));
        } else if (Array.isArray(imageBody)) {
            uploadedImages = imageBody.map((img, i) => typeof img === 'string' ? { url: img, isPrimary: i === 0 } : { url: img.url, alt: img.alt || '', isPrimary: img.isPrimary || false });
        }
        if (!uploadedImages.length) throw new ApiError(400, 'At least one image required');

        const product = await Product.create({
            vendorId, name, brand: brandId, company, description, category, categoryAncestors,
            price, originalPrice, quantityAvailable, basePrice: basePrice ? Number(basePrice) : null,
            images: uploadedImages, variants: Array.isArray(variants) ? variants : [],
            attributes: Array.isArray(attributes) ? attributes : [],
            featured, trending, dimensions, bestFor, offer, hsn, igstRate
        });
        
        return await Product.findById(product._id).populate('category', 'name slug');
    }

    static async updateProduct(id, productData, user, files) {
        const existing = await Product.findById(id);
        if (!existing) throw new ApiError(404, 'Product not found');
        
        if (existing.vendorId.toString() !== user._id.toString() && user.role !== 'admin') 
            throw new ApiError(403, 'Unauthorized');

        const updateData = { ...productData };
        ['vendorId', 'reviews', 'rating', 'reviewCount'].forEach(f => delete updateData[f]);

        if (updateData.category && updateData.category !== existing.category.toString()) {
            const cat = await Category.findById(updateData.category).lean();
            if (!cat) throw new ApiError(400, 'Category not found');
            updateData.categoryAncestors = [...(cat.ancestors?.map(a => a._id) || []), cat._id];
        }

        if (files?.images) {
            const results = await Promise.all(files.images.map(f => uploadOnCloudinary(f.path)));
            updateData.images = results.filter(r => r?.url).map((r, i) => ({ url: r.url, isPrimary: i === 0 }));
        }

        return await Product.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true }).populate('category', 'name slug');
    }

    static async deleteProduct(id, user) {
        const product = await Product.findById(id);
        if (!product) throw new ApiError(404, 'Product not found');
        
        if (product.vendorId.toString() !== user._id.toString() && user.role !== 'admin') 
            throw new ApiError(403, 'Unauthorized');
            
        await Product.findByIdAndUpdate(id, { isActive: false });
    }

    static async permanentDeleteProduct(id, user) {
        if (user.role !== 'admin') throw new ApiError(403, 'Admin only');
        
        const product = await Product.findById(id);
        if (!product) throw new ApiError(404, 'Product not found');
        
        if (product.images?.length) {
            await Promise.all(product.images.map(img => {
                const urlParts = img.url.split("/");
                const filename = urlParts[urlParts.length - 1];
                const publicId = filename.split(".")[0];
                return deleteFromCloudinary(publicId);
            }));
        }
        
        await Review.deleteMany({ _id: { $in: product.reviews } });
        await Product.findByIdAndDelete(id);
    }

    static async bulkUpdateProducts(productIds, updates, user) {
        if (user.role !== 'admin') throw new ApiError(403, 'Admin only');
        
        const allowed = {};
        ['featured', 'trending', 'isActive', 'discount'].forEach(f => {
            if (updates[f] !== undefined) allowed[f] = updates[f];
        });
        
        const result = await Product.updateMany({ _id: { $in: productIds } }, { $set: allowed });
        return result.modifiedCount;
    }

    static async toggleProductStatus(id, user) {
        const product = await Product.findById(id);
        if (!product) throw new ApiError(404, 'Product not found');
        
        if (product.vendorId.toString() !== user._id.toString() && user.role !== 'admin') 
            throw new ApiError(403, 'Unauthorized');
            
        product.isActive = !product.isActive;
        await product.save();
        return product.isActive;
    }

    static async toggleFeatured(id, user) {
        if (user.role !== 'admin') throw new ApiError(403, 'Admin only');
        const product = await Product.findById(id);
        if (!product) throw new ApiError(404, 'Product not found');
        
        product.featured = !product.featured;
        await product.save();
        return product.featured;
    }

    static async toggleTrending(id, user) {
        if (user.role !== 'admin') throw new ApiError(403, 'Admin only');
        const product = await Product.findById(id);
        if (!product) throw new ApiError(404, 'Product not found');
        
        product.trending = !product.trending;
        await product.save();
        return product.trending;
    }

    static async updateBasePrice(id, basePrice, user) {
        const product = await Product.findById(id);
        if (!product) throw new ApiError(404, 'Product not found');
        
        if (product.vendorId.toString() !== user._id.toString() && user.role !== 'admin') 
            throw new ApiError(403, 'Unauthorized');
            
        product.basePrice = Number(basePrice);
        await product.save();
        return product.basePrice;
    }

    static async getProductStats(user) {
        const isAdmin = user.role === 'admin';
        const matchFilter = isAdmin ? { isActive: true } : { vendorId: new mongoose.Types.ObjectId(user._id), isActive: true };
        
        const [stats, categoryStats, brandStats, topPerformingProducts] = await Promise.all([
            Product.aggregate([
                { $match: matchFilter },
                {
                    $group: {
                        _id: null,
                        totalProducts: { $sum: 1 },
                        totalStock: { $sum: '$quantityAvailable' },
                        avgRating: { $avg: '$rating' },
                        totalValue: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantityAvailable', 0] }] } },
                        inStockProducts: { $sum: { $cond: ['$inStock', 1, 0] } },
                        outOfStockProducts: { $sum: { $cond: ['$inStock', 0, 1] } },
                        featuredProducts: { $sum: { $cond: ['$featured', 1, 0] } },
                        trendingProducts: { $sum: { $cond: ['$trending', 1, 0] } },
                        lowStockProducts: { $sum: { $cond: [{ $and: ['$inStock', { $lte: ['$quantityAvailable', 50] }] }, 1, 0] } },
                        // Margin Calculation: ((Price - BasePrice) / Price) * 100
                        avgMargin: {
                            $avg: {
                                $cond: [
                                    { $and: [{ $gt: ['$price', 0] }, { $gt: ['$basePrice', 0] }] },
                                    { $multiply: [{ $divide: [{ $subtract: ['$price', '$basePrice'] }, '$price'] }, 100] },
                                    null
                                ]
                            }
                        }
                    }
                }
            ]),
            Product.aggregate([
                { $match: matchFilter },
                { $group: { _id: '$category', count: { $sum: 1 } } },
                { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
                { $addFields: { name: { $ifNull: [{ $arrayElemAt: ['$cat.name', 0] }, 'Uncategorized'] } } },
                { $project: { cat: 0 } },
                { $sort: { count: -1 } }
            ]),
            Product.aggregate([
                { $match: matchFilter },
                { $group: { _id: '$brand', count: { $sum: 1 } } },
                { $lookup: { from: 'brands', localField: '_id', foreignField: '_id', as: 'br' } },
                { $addFields: { name: { $ifNull: [{ $arrayElemAt: ['$br.name', 0] }, 'Generic'] } } },
                { $project: { br: 0 } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),
            Product.aggregate([
                { $match: matchFilter },
                { $sort: { rating: -1 } },
                { $limit: 10 }
            ])
        ]);
        
        return {
            stats: stats[0] || {},
            categoryBreakdown: categoryStats,
            topBrands: brandStats,
            topProducts: topPerformingProducts
        };
    }

    static async getLowStockProducts(threshold = 50, user) {
        const query = { isActive: true, inStock: true, quantityAvailable: { $lte: threshold } };
        if (user.role !== 'admin') query.vendorId = user._id;
        
        const products = await Product.find(query).sort('quantityAvailable').lean();
        return products;
    }

    static async getAllBrands(categoryQuery) {
        const filter = { isActive: true };
        if (categoryQuery) {
            const categoryFilter = await resolveCategoryFilter(categoryQuery);
            Object.assign(filter, categoryFilter);
        }
        
        const brands = await Product.distinct('brand', filter);
        return brands.sort();
    }

    static async addProductReview(productId, reviewId) {
        const product = await Product.findById(productId);
        if (!product || !product.isActive) throw new ApiError(404, 'Product not found');
        if (product.reviews.includes(reviewId)) throw new ApiError(409, 'Review exists');
        
        product.reviews.push(reviewId);
        product.reviewCount = product.reviews.length;
        await product.save();
    }

    static async updateProductRating(productId, rating) {
        const product = await Product.findById(productId);
        if (!product) throw new ApiError(404, 'Product not found');
        
        await product.updateRating(Number(rating));
        return product.rating;
    }
}

export default ProductService;
