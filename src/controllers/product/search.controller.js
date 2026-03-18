
import Product from "../../models/Product.js";
import asyncHandler from "../../utils/asyncHandler.js";
import ApiError from "../../utils/ApiError.js";
import ApiResponse from '../../utils/ApiResponse.js';


export const getSearchSuggestions = asyncHandler(async (req, res) => {
    const { q, limit = 8 } = req.query;

   
    if (!q || q.trim().length < 2) {
        return res.status(200).json(
            new ApiResponse(200, { suggestions: [], products: [], brands: [], categories: [] }, 'Query too short')
        );
    }

    const keyword = q.trim();
    const limitNum = Math.min(Math.max(1, Number(limit)), 15); 

   
    const startsWithRegex = new RegExp(`^${escapeRegex(keyword)}`, 'i');
    const containsRegex = new RegExp(escapeRegex(keyword), 'i');

    
    const [productSuggestions, brandSuggestions, categorySuggestions] = await Promise.all([

        Product.find(
            { isActive: true, name: containsRegex },
            { name: 1, slug: 1, images: 1, price: 1, brand: 1, category: 1 }
        )
            .sort({ name: startsWithRegex ? -1 : 1, salesCount: -1 }) 
            .limit(limitNum)
            .lean(),

       
        Product.distinct('brand', {
            isActive: true,
            brand: containsRegex,
        }),

        
        Product.distinct('category', {
            isActive: true,
            category: containsRegex,
        }),
    ]);

    
    const formattedProducts = productSuggestions.map((p) => ({
        _id: p._id,
        name: p.name,
        slug: p.slug,
        image: p.images?.[0] || null,
        price: p.price,
        brand: p.brand,
        category: p.category,
        type: 'product',
    }));


    const formattedBrands = brandSuggestions.slice(0, 4).map((b) => ({
        name: b,
        type: 'brand',
        query: `brand=${encodeURIComponent(b)}`,
    }));

    
    const formattedCategories = categorySuggestions.slice(0, 4).map((c) => ({
        name: c,
        type: 'category',
        query: `category=${encodeURIComponent(c)}`,
    }));

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                query: keyword,
                products: formattedProducts,
                brands: formattedBrands,
                categories: formattedCategories,
                total:
                    formattedProducts.length + formattedBrands.length + formattedCategories.length,
            },
            'Suggestions fetched successfully'
        )
    );
});


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



export const getRecentlyViewed = asyncHandler(async (req, res) => {
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(200).json(
            new ApiResponse(200, { products: [] }, 'No recently viewed products')
        );
    }

    
    const limitedIds = productIds.slice(0, 20);

   
    const products = await Product.find(
        {
            _id: { $in: limitedIds },
            isActive: true,
        },
        {
            name: 1,
            slug: 1,
            images: 1,
            price: 1,
            originalPrice: 1,
            discount: 1,
            brand: 1,
            category: 1,
            rating: 1,
            reviews: 1,
            inStock: 1,
            quantityAvailable: 1,
            featured: 1,
        }
    ).lean();

 
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
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

    
    const products = await Product.find(
        {
            _id: { $in: uniqueIds },
            isActive: true,
        },
        { __v: 0 } 
    ).lean();

  
    if (products.length !== uniqueIds.length) {
        const foundIds = new Set(products.map((p) => p._id.toString()));
        const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
        throw new ApiError(
            404,
            `Products not found: ${missingIds.join(', ')}`
        );
    }

    
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
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
        absolute: p - minPrice,
        percentage: minPrice > 0 ? Math.round(((p - minPrice) / minPrice) * 100) : 0,
    }));

    
    const COMPARE_FIELDS = [
        { key: 'brand', label: 'Brand' },
        { key: 'category', label: 'Category' },
        { key: 'rating', label: 'Rating' },
        { key: 'reviews', label: 'Reviews' },
        { key: 'inStock', label: 'Availability' },
        { key: 'quantityAvailable', label: 'Stock' },
        { key: 'discount', label: 'Discount (%)' },
        { key: 'weight', label: 'Weight' },
        { key: 'material', label: 'Material' },
        { key: 'warranty', label: 'Warranty' },
        { key: 'origin', label: 'Origin' },
        { key: 'minOrder', label: 'Min Order Qty' },
        { key: 'dimensions', label: 'Dimensions' },
        { key: 'featured', label: 'Featured' },
        { key: 'trending', label: 'Trending' },
    ];

    
    const availableFields = COMPARE_FIELDS.filter((field) =>
        products.some(
            (p) => p[field.key] !== undefined && p[field.key] !== null && p[field.key] !== ''
        )
    );

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
        badges: buildBadges(products, {
            bestValueIdx,
            cheapestIdx,
            topRatedIdx,
            bestDiscountIdx,
        }),
    };
}

// Per product badges
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


function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}