import Brand from "./brand.model.js";
import Category from "../category/category.model.js";
import { ApiError } from "../../shared/utils/api.utils.js";

class BrandService {
    static async getAllBrands(queryData) {
        const { page, limit, search, isActive } = queryData;
        const query = {};

        if (search) {
            query.$text = { $search: search };
        }
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        const skip = (page - 1) * limit;

        const [brands, total] = await Promise.all([
            Brand.find(query)
                .sort({ popularityScore: -1, name: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Brand.countDocuments(query)
        ]);

        return {
            brands,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }

    static async getBrandsByCategory(categoryId) {
        const category = await Category.findById(categoryId).select('_id ancestors').lean();
        if (!category) {
            throw new ApiError(404, "Category not found");
        }

        const categoryIds = [
            category._id,
            ...(category.ancestors ? category.ancestors.map(a => a._id) : [])
        ];

        const brands = await Brand.find({
            categories: { $in: categoryIds },
            isActive: true
        })
            .select("name slug logo popularityScore")
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
