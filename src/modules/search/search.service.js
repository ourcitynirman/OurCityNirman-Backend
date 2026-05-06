import mongoose from 'mongoose';
import Product from "../products/product.model.js";
import Category from "../category/category.model.js";
import Brand from "../brand/brand.model.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { 
  resolveCategoryFilter, 
  resolveBrandFilter,
  populateCategoriesOnProducts, 
  populateBrandsOnProducts,
  buildPaginationMeta 
} from "../../shared/utils/product.helpers.js";

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

    const allAttributes = new Set();
    products.forEach(p => { if (p.attributes) { p.attributes.forEach(attr => allAttributes.add(attr.name)); } });

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
        priceRange: { min: minPrice, max: Math.max(...prices), diff: Math.max(...prices) - minPrice },
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
        if (idx === bestDiscountIdx && p.discount > 0) badges.push({ label: 'Best Deal', color: 'red' });
        if (p.featured) badges.push({ label: 'Featured', color: 'purple' });
        return { productId: p._id, badges };
    });
}

class SearchService {
    static async getSearchSuggestions(q, limit) {
        const keyword = q.trim();
        const regex = new RegExp(escapeRegex(keyword), 'i');

        const [productsRaw, brands, categoriesList] = await Promise.all([
            Product.aggregate([
                { $match: { isActive: true, $or: [{ name: regex }, { sku: regex }] } },
                { $addFields: { daysOld: { $divide: [{ $subtract: [new Date(), '$createdAt'] }, 86400000] } } },
                { $addFields: { freshnessScore: { $cond: [{ $lte: ['$daysOld', 7] }, 50, 0] } } },
                { $addFields: { trendingScore: { $add: [{ $multiply: [{ $ifNull: ['$totalOrders', 0] }, 5] }, { $multiply: ['$rating', 20] }, { $multiply: [{ $size: { $ifNull: ['$reviews', []] } }, 0.5] }, '$freshnessScore', { $cond: [{ $eq: ['$trending', true] }, 30, 0] }] } } },
                { $sort: { trendingScore: -1, rating: -1 } },
                { $limit: limit },
                { $project: { name: 1, slug: 1, images: 1, price: 1, brand: 1, category: 1, sku: 1 } }
            ]),
            Brand.find({ isActive: true, $or: [{ name: regex }, { slug: regex }] }, { name: 1, slug: 1, logo: 1 }).limit(5).lean(),
            Category.find({ isActive: true, name: regex }, { name: 1, slug: 1, path: 1 }).limit(10).lean()
        ]);

        const populatedProducts = await populateCategoriesOnProducts(productsRaw);
        const finalProducts = await populateBrandsOnProducts(populatedProducts);

        const formattedProducts = finalProducts.map((p) => ({
            id: p._id, name: p.name, slug: p.slug, image: p.images?.find(i => i.isPrimary)?.url || p.images?.[0]?.url || null,
            price: p.price, brand: p.brand, sku: p.sku, category: p.category ? { name: p.category.name, slug: p.category.slug } : null, type: 'product'
        }));

        const formattedBrands = brands.map((b) => ({ name: b.name, slug: b.slug, logo: b.logo, type: 'brand', query: `brand=${b.slug}` }));
        const formattedCategories = categoriesList.map((c) => ({ name: c.path ? c.path.split('/').join(' > ') : c.name, slug: c.slug, type: 'category', query: `category=${c.slug}` }));

        return { query: keyword, products: formattedProducts, brands: formattedBrands, categories: formattedCategories, total: formattedProducts.length + formattedBrands.length + formattedCategories.length };
    }

    static async getRecentlyViewed(productIds) {
        const limitedIds = productIds.slice(0, 20);
        const productsRaw = await Product.find({ _id: { $in: limitedIds }, isActive: true }).select('name slug images price originalPrice discount brand category rating reviewCount inStock quantityAvailable featured').lean();
        const populatedProducts = await populateCategoriesOnProducts(productsRaw);

        const productMap = new Map(populatedProducts.map((p) => [p._id.toString(), p]));
        const orderedProducts = limitedIds.map((id) => productMap.get(id.toString())).filter(Boolean);

        return { products: orderedProducts, count: orderedProducts.length, validIds: orderedProducts.map((p) => p._id.toString()) };
    }

    static async compareProducts(productIds) {
        const productsRaw = await Product.find({ _id: { $in: productIds }, isActive: true }).select('-__v').lean();
        if (productsRaw.length !== productIds.length) {
            const foundIds = new Set(productsRaw.map((p) => p._id.toString()));
            const missingIds = productIds.filter((id) => !foundIds.has(id.toString()));
            throw new ApiError(404, `Products not found: ${missingIds.join(', ')}`);
        }

        const populatedProducts = await populateCategoriesOnProducts(productsRaw);
        const productMap = new Map(populatedProducts.map((p) => [p._id.toString(), p]));
        const orderedProducts = productIds.map((id) => productMap.get(id.toString()));

        return { products: orderedProducts, count: orderedProducts.length, analysis: buildComparisonAnalysis(orderedProducts) };
    }

    static async SearchProducts(queryData) {
        const { q, search, page, limit, sort, category, brand, minPrice, maxPrice, inStock, featured, trending, minRating, minDiscount } = queryData;
        const queryStr = q || search;
        const keyword = queryStr.trim();
        const skip = (page - 1) * limit;

        const textSearch = { $text: { $search: keyword } };
        const regexSearch = { $or: [{ name: { $regex: escapeRegex(keyword), $options: 'i' } }, { searchKeywords: { $regex: escapeRegex(keyword), $options: 'i' } }] };
        const searchMatch = (sort === 'relevant') ? textSearch : regexSearch;
        const matchFilter = { isActive: true, ...searchMatch };

        if (category) Object.assign(matchFilter, await resolveCategoryFilter(category));
        if (brand) Object.assign(matchFilter, await resolveBrandFilter(brand));
        if (minPrice !== undefined || maxPrice !== undefined) {
            matchFilter.price = {};
            if (minPrice !== undefined) matchFilter.price.$gte = minPrice;
            if (maxPrice !== undefined) matchFilter.price.$lte = maxPrice;
        }
        if (inStock !== undefined) matchFilter.inStock = inStock === 'true';
        if (featured !== undefined) matchFilter.featured = featured === 'true';
        if (trending !== undefined) matchFilter.trending = trending === 'true';
        if (minRating !== undefined) matchFilter.rating = { $gte: minRating };
        if (minDiscount !== undefined) matchFilter.discount = { $gte: minDiscount };

        const sortMap = { relevant: { score: { $meta: 'textScore' } }, newest: { createdAt: -1 }, price_low: { price: 1 }, price_high: { price: -1 }, rating: { rating: -1 }, discount: { discount: -1 } };
        let sortObj = sortMap[sort] || (sort.startsWith('-') ? { [sort.substring(1)]: -1 } : { [sort]: 1 }) || ((searchMatch === textSearch) ? sortMap.relevant : { rating: -1, createdAt: -1 });
        if (sortObj?.score?.$meta === 'textScore' && searchMatch !== textSearch) sortObj = { rating: -1, createdAt: -1 };

        const pipeline = [{ $match: matchFilter }];
        const productPipeline = [];
        if (searchMatch === textSearch) productPipeline.push({ $addFields: { score: { $meta: "textScore" } } });
        productPipeline.push({ $sort: sortObj }, { $skip: skip }, { $limit: limit }, { $project: { __v: 0, basePrice: 0 } });

        const results = await Product.aggregate([...pipeline, { $facet: { products: productPipeline, totalCount: [{ $count: "count" }], brandFacets: [{ $group: { _id: "$brand", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 15 }], categoryFacets: [{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }], priceRange: [{ $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } }], ratingStats: [{ $group: { _id: { $floor: "$rating" }, count: { $sum: 1 } } }, { $sort: { "_id": -1 } }], availability: [{ $group: { _id: "$inStock", count: { $sum: 1 } } }] } }]);

        const resultData = results[0];
        let productsRaw = resultData.products;
        let total = resultData.totalCount[0]?.count || 0;

        if (total === 0 && searchMatch === textSearch) {
            const regexMatchFilter = { ...matchFilter, ...regexSearch };
            delete regexMatchFilter.$text;
            const retryResults = await Product.aggregate([{ $match: regexMatchFilter }, { $facet: { products: [{ $sort: { rating: -1 } }, { $skip: skip }, { $limit: limit }], totalCount: [{ $count: "count" }] } }]);
            if (retryResults[0].totalCount[0]) {
                return { query: keyword, products: await populateBrandsOnProducts(await populateCategoriesOnProducts(retryResults[0].products)), total: retryResults[0].totalCount[0].count, pagination: buildPaginationMeta(page, limit, retryResults[0].totalCount[0].count), facets: {} };
            }
        }

        const products = await populateBrandsOnProducts(await populateCategoriesOnProducts(productsRaw));

        const brandIds = resultData.brandFacets.map(b => b._id);
        const resolvedBrands = brandIds.length > 0 ? await Brand.find({ _id: { $in: brandIds } }).select('name slug logo').lean() : [];
        const brandMap = new Map(resolvedBrands.map(b => [b._id.toString(), b]));
        const formattedBrandFacets = resultData.brandFacets.map(b => ({ id: b._id, name: brandMap.get(b._id?.toString())?.name || 'Unknown', slug: brandMap.get(b._id?.toString())?.slug, logo: brandMap.get(b._id?.toString())?.logo, count: b.count }));

        const facets = { brands: formattedBrandFacets, categories: resultData.categoryFacets.map(c => ({ id: c._id, count: c.count })), priceRange: resultData.priceRange[0] || { min: 0, max: 0 }, ratings: resultData.ratingStats.map(r => ({ rating: r._id, count: r.count })), availability: { inStock: resultData.availability.find(a => a._id === true)?.count || 0, outOfStock: resultData.availability.find(a => a._id === false)?.count || 0 } };

        if (facets.priceRange.max > 0) {
            const min = facets.priceRange.min;
            const max = facets.priceRange.max;
            const step = (max - min) / 4;
            facets.priceBuckets = [{ label: `Below ₹${Math.round(min + step)}`, min: 0, max: Math.round(min + step) }, { label: `₹${Math.round(min + step)} - ₹${Math.round(min + 2 * step)}`, min: Math.round(min + step), max: Math.round(min + 2 * step) }, { label: `₹${Math.round(min + 2 * step)} - ₹${Math.round(min + 3 * step)}`, min: Math.round(min + 2 * step), max: Math.round(min + 3 * step) }, { label: `Above ₹${Math.round(min + 3 * step)}`, min: Math.round(min + 3 * step), max: 10000000 }];
        }

        return { query: keyword, count: products.length, total, pagination: buildPaginationMeta(page, limit, total), products, facets };
    }
}

export default SearchService;
