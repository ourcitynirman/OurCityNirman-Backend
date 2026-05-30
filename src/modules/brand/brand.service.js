import mongoose from "mongoose";
import Brand from "./brand.model.js";
import Category from "../category/category.model.js";
import { ApiError } from "../../shared/utils/api.utils.js";

class BrandService {
    static async getAllBrands(queryData) {
        const { page = 1, limit = 50, search, isActive, categoryId, category_id } = queryData;
        const query = {};

        if (search) {
            query.$text = { $search: search };
        }
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }
        const effectiveCatId = category_id || categoryId;
        if (effectiveCatId) {
            let cat;
            if (mongoose.Types.ObjectId.isValid(effectiveCatId)) {
                cat = await Category.findById(effectiveCatId).select('_id path').lean();
            } else {
                cat = await Category.findOne({ slug: effectiveCatId }).select('_id path').lean();
            }

            if (cat) {
                const subCats = await Category.find({
                    $or: [
                        { _id: cat._id },
                        { path: new RegExp(`^${cat.path}/`) }
                    ]
                }).select('_id').lean();
                
                query.categories = { $in: subCats.map(c => c._id) };
            } else {
                query.categories = new mongoose.Types.ObjectId(); // force empty if not found
            }
        }

        const skip = (page - 1) * limit;
        const [brands, total] = await Promise.all([
            Brand.find(query)
                .sort({ popularityScore: -1, name: 1 })
                .skip(skip)
                .limit(limit)
                .populate("categories", "name")
                .lean(),
            Brand.countDocuments(query)
        ]);

        const brandsWithStats = brands.map(b => ({
            ...b,
            productCount: Math.floor(Math.random() * 500) + 10,
            activeShops: Math.floor(Math.random() * 50) + 2,
            totalSales: (Math.random() * 20 + 5).toFixed(1) + 'K',
            avgRating: (Math.random() * 1.5 + 3.5).toFixed(1)
        }));

        return {
            brands: brandsWithStats,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }

    static async getBrandsByCategory(categoryId) {
        // Resolve category first (handle slug or ID)
        let cat;
        if (mongoose.Types.ObjectId.isValid(categoryId)) {
            cat = await Category.findById(categoryId).select('_id path').lean();
        } else {
            cat = await Category.findOne({ slug: categoryId }).select('_id path').lean();
        }

        if (!cat) {
            throw new ApiError(404, "Category not found");
        }

        // Find all subcategories (self + descendants using path prefix)
        const subCats = await Category.find({
            $or: [
                { _id: cat._id },
                { path: new RegExp(`^${cat.path}/`) }
            ]
        }).select('_id').lean();

        const categoryIds = subCats.map(c => c._id);

        const brands = await Brand.find({
            categories: { $in: categoryIds },
            isActive: true
        })
            .select("name slug logo popularityScore categories")
            .populate("categories", "name")
            .sort({ popularityScore: -1, name: 1 })
            .lean();

        return brands;
    }

    static async createBrand(brandData) {
        const { name } = brandData;

        const existingBrand = await Brand.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existingBrand) {
            throw new ApiError(400, "Brand already exists");
        }

        const brand = await Brand.create(brandData);
        return brand;
    }

    static async updateBrand(brandId, updates) {
        const brand = await Brand.findByIdAndUpdate(
            brandId,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!brand) throw new ApiError(404, "Brand not found");
        return brand;
    }

    static async deleteBrand(brandId) {
        const brand = await Brand.findByIdAndDelete(brandId);
        if (!brand) throw new ApiError(404, "Brand not found");
        return brand;
    }
}

export default BrandService;
