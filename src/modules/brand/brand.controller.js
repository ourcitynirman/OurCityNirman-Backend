import Brand from "./brand.model.js";
import Category from "../category/category.model.js";
import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from "../../shared/utils/api.utils.js";

/**
 * @desc    Get all brands (with pagination and search)
 * @route   GET /api/v1/brands
 * @access  Public
 */
export const getAllBrands = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, isActive } = req.query;
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
      .limit(Number(limit))
      .lean(),
    Brand.countDocuments(query)
  ]);

  return res.status(200).json(
    new ApiResponse(200, {
      brands,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    }, "Brands fetched successfully")
  );
});

/**
 * @desc    Get brands by category (Amazon Style)
 * @route   GET /api/v1/brands/by-category/:categoryId
 * @access  Public
 */
export const getBrandsByCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;

  // 1. Verify category exists
  const category = await Category.findById(categoryId).select('_id ancestors').lean();
  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  /* 
     Optionally, we can also include brands from parent/ancestor categories 
     to provide a broader filter (like Amazon/Flipkart does in sub-categories).
  */
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

  return res.status(200).json(
    new ApiResponse(200, brands, "Brands for category fetched successfully")
  );
});

/**
 * @desc    Create new brand (Admin)
 * @route   POST /api/v1/brands
 * @access  Private/Admin
 */
export const createBrand = asyncHandler(async (req, res) => {
  const { name, logo, description, categories } = req.body;

  if (!name) throw new ApiError(400, "Brand name is required");

  const existingBrand = await Brand.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
  if (existingBrand) throw new ApiError(400, "Brand already exists");

  const brand = await Brand.create({
    name,
    logo,
    description,
    categories: categories || []
  });

  return res.status(201).json(
    new ApiResponse(201, brand, "Brand created successfully")
  );
});

/**
 * @desc    Update brand (Admin)
 * @route   PATCH /api/v1/brands/:id
 * @access  Private/Admin
 */
export const updateBrand = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const brand = await Brand.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!brand) throw new ApiError(404, "Brand not found");

  return res.status(200).json(
    new ApiResponse(200, brand, "Brand updated successfully")
  );
});

/**
 * @desc    Delete brand (Admin)
 * @route   DELETE /api/v1/brands/:id
 * @access  Private/Admin
 */
export const deleteBrand = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const brand = await Brand.findByIdAndDelete(id);
  if (!brand) throw new ApiError(404, "Brand not found");

  return res.status(200).json(
    new ApiResponse(200, null, "Brand deleted successfully")
  );
});
