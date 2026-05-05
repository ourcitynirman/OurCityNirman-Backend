import mongoose from 'mongoose';
import Product from "../products/product.model.js";
import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from '../../shared/utils/api.utils.js';
import Category from "../category/category.model.js";
import Brand from "../brand/brand.model.js";
import { 
  resolveCategoryFilter, 
  resolveBrandFilter,
  populateCategoriesOnProducts, 
  populateBrandsOnProducts,
  buildPaginationMeta, 
  sanitizeSortParam 
} from "../../shared/utils/product.helpers.js";

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @desc    Get live search suggestions (brands, categories, products)
 * @route   GET /api/v1/products/search/suggestions
 * @access  Public
 */
export const getSearchSuggestions = asyncHandler(async (req, res) => {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
        return res.status(200).json(
            new ApiResponse(200, { products: [], brands: [], categories: [] }, 'Query too short')
        );
    }

    const keyword = q.trim();
    const limitNum = Math.min(Math.max(1, Number(limit)), 20);
    const regex = new RegExp(escapeRegex(keyword), 'i');

    const [productsRaw, brands, categoriesList] = await Promise.all([
        // 1. Match Products (by Name or SKU), weighting trending products higher
        Product.aggregate([
            { $match: { isActive: true, $or: [{ name: regex }, { sku: regex }] } },
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
            { $sort: { trendingScore: -1, rating: -1 } },
            { $limit: limitNum },
            { $project: { name: 1, slug: 1, images: 1, price: 1, brand: 1, category: 1, sku: 1 } }
        ]),

        // 2. Match Brands
        Brand.find({ isActive: true, $or: [{ name: regex }, { slug: regex }] }, { name: 1, slug: 1, logo: 1 }).limit(5).lean(),

        // 3. Match Categories
        Category.find({ isActive: true, name: regex }, { name: 1, slug: 1, path: 1 }).limit(10).lean()
    ]);

    const populatedProducts = await populateCategoriesOnProducts(productsRaw);
    const finalProducts = await populateBrandsOnProducts(populatedProducts);

    // Format results
    const formattedProducts = populatedProducts.map((p) => ({
        id: p._id,
        name: p.name,
        slug: p.slug,
        image: p.images?.find(i => i.isPrimary)?.url || p.images?.[0]?.url || null,
        price: p.price,
        brand: p.brand,
        sku: p.sku,
        category: p.category ? { name: p.category.name, slug: p.category.slug } : null,
        type: 'product'
    }));

    const formattedBrands = brands.map((b) => ({
        name: b.name,
        slug: b.slug,
        logo: b.logo,
        type: 'brand',
        query: `brand=${b.slug}`
    }));

    const formattedCategories = categoriesList.map((c) => ({
        name: c.path ? c.path.split('/').join(' > ') : c.name,
        slug: c.slug,
        type: 'category',
        query: `category=${c.slug}`
    }));

    return res.status(200).json(
        new ApiResponse(200, {
            query: keyword,
            products: formattedProducts,
            brands: formattedBrands,
            categories: formattedCategories,
            total: formattedProducts.length + formattedBrands.length + formattedCategories.length
        }, 'Suggestions fetched successfully')
    );
});

/**
 * @desc    Log a product as recently viewed
 * @route   POST /api/v1/products/recently-viewed
 * @access  Public
 */
export const logRecentlyViewed = asyncHandler(async (req, res) => {
    const { productId } = req.body;
    if (!productId) throw new ApiError(400, 'productId is required');

    const product = await Product.findOne(
        { _id: productId, isActive: true },
        { _id: 1, name: 1 }
    ).lean();

    if (!product) throw new ApiError(404, 'Product not found');

    return res.status(200).json(
        new ApiResponse(200, { logged: true, productId }, 'View logged')
    );
});

/**
 * @desc    Fetch product details for recently viewed IDs
 * @route   POST /api/v1/products/recently-viewed/fetch
 * @access  Public
 */
export const getRecentlyViewed = asyncHandler(async (req, res) => {
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(200).json(
            new ApiResponse(200, { products: [] }, 'No recently viewed products')
        );
    }

    const limitedIds = productIds.slice(0, 20);

    const productsRaw = await Product.find(
        {
            _id: { $in: limitedIds },
            isActive: true,
        },
        {
            name: 1, slug: 1, images: 1, price: 1, originalPrice: 1, discount: 1,
            brand: 1, category: 1, rating: 1, reviewCount: 1, inStock: 1,
            quantityAvailable: 1, featured: 1,
        }
    ).lean();

    const populatedProducts = await populateCategoriesOnProducts(productsRaw);

    const productMap = new Map(populatedProducts.map((p) => [p._id.toString(), p]));
    const orderedProducts = limitedIds
        .map((id) => productMap.get(id.toString()))
        .filter(Boolean);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                products: orderedProducts,
                count: orderedProducts.length,
                validIds: orderedProducts.map((p) => p._id.toString()),
            },
            'Recently viewed products fetched successfully'
        )
    );
});

/**
 * @desc    Compare multiple products (2-4 products)
 * @route   POST /api/v1/products/compare
 * @access  Public
 */
export const compareProducts = asyncHandler(async (req, res) => {
    const { productIds } = req.body;

    if (!Array.isArray(productIds)) {
        throw new ApiError(400, 'productIds must be an array');
    }
    if (productIds.length < 2) {
        throw new ApiError(400, 'At least 2 products required for comparison');
    }
    if (productIds.length > 4) {
        throw new ApiError(400, 'Maximum 4 products can be compared at once');
    }

    const uniqueIds = [...new Set(productIds.map(String))];
    if (uniqueIds.length !== productIds.length) {
        throw new ApiError(400, 'Duplicate product IDs not allowed');
    }

    const productsRaw = await Product.find(
        { _id: { $in: uniqueIds }, isActive: true },
        { __v: 0 } 
    ).lean();

    if (productsRaw.length !== uniqueIds.length) {
        const foundIds = new Set(productsRaw.map((p) => p._id.toString()));
        const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
        throw new ApiError(
            404,
            `Products not found: ${missingIds.join(', ')}`
        );
    }

    const populatedProducts = await populateCategoriesOnProducts(productsRaw);

    const productMap = new Map(populatedProducts.map((p) => [p._id.toString(), p]));
    const orderedProducts = uniqueIds.map((id) => productMap.get(id));

    const analysis = buildComparisonAnalysis(orderedProducts);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                products: orderedProducts,
                count: orderedProducts.length,
                analysis,
            },
            'Comparison data fetched successfully'
        )
    );
});

function buildComparisonAnalysis(products) {
    const prices = products.map((p) => p.price);
    const ratings = products.map((p) => p.rating || 0);
    const discounts = products.map((p) => p.discount || 0);

    const valueScores = products.map((p) => (p.rating || 0) / (p.price || 1));
    const bestValueIdx = valueScores.indexOf(Math.max(...valueScores));

    const cheapestIdx = prices.indexOf(Math.min(...prices));
    const topRatedIdx = ratings.indexOf(Math.max(...ratings));
    const bestDiscountIdx = discounts.indexOf(Math.max(...discounts));

    const minPrice = Math.min(...prices);
    const priceDiffs = prices.map((p) => ({
        absolute: p.price - minPrice,
        percentage: minPrice > 0 ? Math.round(((p.price - minPrice) / minPrice) * 100) : 0,
    }));

    const COMPARE_FIELDS = [
        { key: 'brand', label: 'Brand' },
        { key: 'category', label: 'Category', isObject: true },
        { key: 'rating', label: 'Rating' },
        { key: 'reviewCount', label: 'Reviews' },
        { key: 'inStock', label: 'Availability' },
        { key: 'quantityAvailable', label: 'Stock' },
        { key: 'discount', label: 'Discount (%)' },
        { key: 'weight', label: 'Weight' },
        { key: 'material', label: 'Material' },
        { key: 'warranty', label: 'Warranty' },
        { key: 'origin', label: 'Origin' },
        { key: 'minOrder', label: 'Min Order Qty' },
        { key: 'dimensions', label: 'Dimensions' },
    ];

    const availableFields = COMPARE_FIELDS.filter((field) =>
        products.some((p) => p[field.key] !== undefined && p[field.key] !== null && p[field.key] !== '')
    );

    // Extract all dynamic attributes for comparison
    const allAttributes = new Set();
    products.forEach(p => {
        if (p.attributes) {
            p.attributes.forEach(attr => allAttributes.add(attr.name));
        }
    });

    const attributeComparison = Array.from(allAttributes).map(attrName => {
        return {
            name: attrName,
            values: products.map(p => {
                const found = (p.attributes || []).find(a => a.name === attrName);
                return found ? found.value : 'N/A';
            })
        };
    });

    return {
        bestValueProductId: products[bestValueIdx]?._id,
        cheapestProductId: products[cheapestIdx]?._id,
        topRatedProductId: products[topRatedIdx]?._id,
        bestDiscountProductId: products[bestDiscountIdx]?._id,
        priceRange: {
            min: minPrice,
            max: Math.max(...prices),
            diff: Math.max(...prices) - minPrice,
        },
        priceDiffs, 
        compareFields: availableFields,
        attributeComparison,
        badges: buildBadges(products, { bestValueIdx, cheapestIdx, topRatedIdx, bestDiscountIdx }),
    };
}

function buildBadges(products, { bestValueIdx, cheapestIdx, topRatedIdx, bestDiscountIdx }) {
    return products.map((p, idx) => {
        const badges = [];
        if (idx === bestValueIdx) badges.push({ label: 'Best Value', color: 'green' });
        if (idx === cheapestIdx) badges.push({ label: 'Lowest Price', color: 'blue' });
        if (idx === topRatedIdx) badges.push({ label: 'Top Rated', color: 'yellow' });
        if (idx === bestDiscountIdx && p.discount > 0)
            badges.push({ label: 'Best Deal', color: 'red' });
        if (p.featured) badges.push({ label: 'Featured', color: 'purple' });
        return {
            productId: p._id,
            badges,
        };
    });
}

/**
 * @desc    Full-text search for products with filters and sorting (FACETED SEARCH)
 * @route   GET /api/v1/products/search
 * @access  Public
 */
export const SearchProducts = asyncHandler(async (req, res) => {
    const {
        q, search, page = 1, limit = 12, sort = 'relevant',
        category, brand, minPrice, maxPrice,
        inStock, featured, trending, minRating, minDiscount
    } = req.query;

    const queryStr = q || search;
    if (!queryStr?.trim()) throw new ApiError(400, 'Search query required');

    const keyword = queryStr.trim();
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(Math.max(1, Number(limit)), 50);
    const skip = (pageNum - 1) * limitNum;

    // 1. Build Search Match Filter
    // We use $text for relevance score, but also add a regex fallback for partial matches
    const textSearch = { $text: { $search: keyword } };
    const regexSearch = {
        $or: [
            { name: { $regex: escapeRegex(keyword), $options: 'i' } },
            { searchKeywords: { $regex: escapeRegex(keyword), $options: 'i' } }
        ]
    };

    // Use text search if possible, else fallback to regex
    // Note: In a production environment, we'd use $or with both if we want to combine them,
    // but here we prioritize text score if the user specifically asked for "relevant" sort.
    const searchMatch = (sort === 'relevant') ? textSearch : regexSearch;

    const matchFilter = { isActive: true, ...searchMatch };

    // 2. Apply Filters
    // Categories
    if (category) {
        const categoryFilter = await resolveCategoryFilter(category);
        Object.assign(matchFilter, categoryFilter);
    }

    // Brands
    if (brand) {
        const brandFilter = await resolveBrandFilter(brand);
        Object.assign(matchFilter, brandFilter);
    }

    // Price
    if (minPrice !== undefined || maxPrice !== undefined) {
        matchFilter.price = {};
        if (minPrice !== undefined) matchFilter.price.$gte = Number(minPrice);
        if (maxPrice !== undefined) matchFilter.price.$lte = Number(maxPrice);
    }

    // Ratings & Stocks
    if (inStock !== undefined) matchFilter.inStock = inStock === 'true';
    if (featured !== undefined) matchFilter.featured = featured === 'true';
    if (trending !== undefined) matchFilter.trending = trending === 'true';
    if (minRating !== undefined) matchFilter.rating = { $gte: Number(minRating) };
    if (minDiscount !== undefined) matchFilter.discount = { $gte: Number(minDiscount) };

    // Sort Logic
    const sortMap = {
        relevant: { score: { $meta: 'textScore' } },
        newest: { createdAt: -1 },
        price_low: { price: 1 },
        price_high: { price: -1 },
        rating: { rating: -1 },
        discount: { discount: -1 },
    };
    
    // Determine the actual sort object
    let sortObj = sortMap[sort];
    
    // If sort not in map, check if it's a field name (e.g., -featured)
    if (!sortObj && sort) {
        if (sort.startsWith('-')) {
            sortObj = { [sort.substring(1)]: -1 };
        } else {
            sortObj = { [sort]: 1 };
        }
    }

    // Default sort if none provided or invalid
    if (!sortObj) {
        sortObj = (searchMatch === textSearch) ? sortMap.relevant : { rating: -1, createdAt: -1 };
    }

    // Double check: If sortObj uses textScore but we didn't use textSearch, fallback
    const isUsingTextScore = sortObj?.score?.$meta === 'textScore';
    if (isUsingTextScore && searchMatch !== textSearch) {
        sortObj = { rating: -1, createdAt: -1 };
    }

    // 3. Execute Aggregation with Facets
    const pipeline = [
        { $match: matchFilter },
    ];

    // Only add textScore field if we are using textSearch
    const productPipeline = [];
    if (searchMatch === textSearch) {
        productPipeline.push({ $addFields: { score: { $meta: "textScore" } } });
    }
    
    productPipeline.push(
        { $sort: sortObj },
        { $skip: skip },
        { $limit: limitNum },
        { $project: { __v: 0, basePrice: 0 } }
    );

    const results = await Product.aggregate([
        ...pipeline,
        {
            $facet: {
                products: productPipeline,
                totalCount: [{ $count: "count" }],
                brandFacets: [
                    { $group: { _id: "$brand", count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 15 }
                ],
                categoryFacets: [
                    { $group: { _id: "$category", count: { $sum: 1 } } },
                    { $sort: { count: -1 } }
                ],
                priceRange: [
                    { $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } }
                ],
                ratingStats: [
                    {
                        $group: {
                            _id: { $floor: "$rating" },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { "_id": -1 } }
                ],
                availability: [
                    { $group: { _id: "$inStock", count: { $sum: 1 } } }
                ]
            }
        }
    ]);

    const resultData = results[0];
    let productsRaw = resultData.products;
    const total = resultData.totalCount[0]?.count || 0;

    // Resolve Brand Facets (Get names/logos from IDs)
    const brandIds = resultData.brandFacets.map(b => b._id);
    const resolvedBrands = brandIds.length > 0 
        ? await Brand.find({ _id: { $in: brandIds } }).select('name slug logo').lean()
        : [];
    const brandMap = new Map(resolvedBrands.map(b => [b._id.toString(), b]));
    
    const formattedBrandFacets = resultData.brandFacets.map(b => {
        const brandData = brandMap.get(b._id?.toString());
        return {
            id: b._id,
            name: brandData?.name || 'Unknown',
            slug: brandData?.slug,
            logo: brandData?.logo,
            count: b.count
        };
    });

    // Fallback if Text Search yielded 0 results but Regex might find something
    if (total === 0 && searchMatch === textSearch) {
        // Retry with Regex
        const regexMatchFilter = { ...matchFilter, ...regexSearch };
        delete regexMatchFilter.$text;
        
        const retryResults = await Product.aggregate([
            { $match: regexMatchFilter },
            {
                $facet: {
                    products: [{ $sort: { rating: -1 } }, { $skip: skip }, { $limit: limitNum }],
                    totalCount: [{ $count: "count" }]
                }
            }
        ]);
        
        if (retryResults[0].totalCount[0]) {
            return res.status(200).json(new ApiResponse(200, {
                query: keyword,
                count: retryResults[0].products.length,
                total: retryResults[0].totalCount[0].count,
                pagination: buildPaginationMeta(pageNum, limitNum, retryResults[0].totalCount[0].count),
                products: await populateBrandsOnProducts(await populateCategoriesOnProducts(retryResults[0].products)),
                facets: {} // Facets skipped on fallback for performance
            }, "Regex fallback results"));
        }
    }

    const populatedProducts = await populateCategoriesOnProducts(productsRaw);
    const products = await populateBrandsOnProducts(populatedProducts);

    // Format Facets
    const facets = {
        brands: formattedBrandFacets,
        categories: resultData.categoryFacets.map(c => ({ id: c._id, count: c.count })),
        priceRange: resultData.priceRange[0] || { min: 0, max: 0 },
        ratings: resultData.ratingStats.map(r => ({ rating: r._id, count: r.count })),
        availability: {
            inStock: resultData.availability.find(a => a._id === true)?.count || 0,
            outOfStock: resultData.availability.find(a => a._id === false)?.count || 0
        }
    };

    // Calculate Dynamic Price Buckets (Flipkart style)
    if (facets.priceRange.max > 0) {
        const min = facets.priceRange.min;
        const max = facets.priceRange.max;
        const step = (max - min) / 4;
        facets.priceBuckets = [
            { label: `Below ₹${Math.round(min + step)}`, min: 0, max: Math.round(min + step) },
            { label: `₹${Math.round(min + step)} - ₹${Math.round(min + 2 * step)}`, min: Math.round(min + step), max: Math.round(min + 2 * step) },
            { label: `₹${Math.round(min + 2 * step)} - ₹${Math.round(min + 3 * step)}`, min: Math.round(min + 2 * step), max: Math.round(min + 3 * step) },
            { label: `Above ₹${Math.round(min + 3 * step)}`, min: Math.round(min + 3 * step), max: 10000000 }
        ];
    }

    res.status(200).json(new ApiResponse(200, {
        query: keyword,
        count: products.length,
        total,
        pagination: buildPaginationMeta(pageNum, limitNum, total),
        products,
        facets
    }));
});