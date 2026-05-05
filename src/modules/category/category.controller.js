import Category from "./category.model.js";
import Product from "../products/product.model.js";
import ApiError from "../../shared/utils/ApiError.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";
import asyncHandler from "../../shared/utils/asyncHandler.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../../shared/utils/cloudinary.js";
import mongoose from 'mongoose';

// Helper: Extract Cloudinary Public ID from URL
const getPublicId = (url) => {
  if (!url || !url.includes("cloudinary.com")) return null;
  return url.split("/").pop().split(".")[0];
};

// Helper: Recursive update of children's paths and ancestors
const syncChildren = async (parentId, parentPath, parentAncestors) => {
  const children = await Category.find({ parent: parentId });
  for (const child of children) {
    child.path = `${parentPath}/${child.slug}`;
    child.ancestors = [...parentAncestors, { _id: parentId, name: child.name, slug: child.slug }];
    child.level = parentAncestors.length + 1;
    await child.save();
    await syncChildren(child._id, child.path, child.ancestors);
  }
};

// Helper: Build a nested tree structure from a flat array
const formatToTree = (list, parentId = null) => {
  return list
    .filter(cat => String(cat.parent) === String(parentId))
    .map(cat => ({
      ...cat,
      children: formatToTree(list, cat._id)
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
};

/**
 * @desc Get all root categories (top level)
 */
export const getRootCategories = asyncHandler(async (req, res) => {
  const { includeInactive } = req.query;
  const filter = { parent: null };
  if (includeInactive !== 'true') filter.isActive = true;

  const list = await Category.find(filter)
    .select('_id name slug image icon productCount isLeaf sortOrder isActive')
    .sort({ sortOrder: 1 }).lean();
  res.status(200).json(new ApiResponse(200, list, "Roots fetched"));
});

/**
 * @desc Get direct sub-categories of a parent
 */
export const getChildrenCategories = asyncHandler(async (req, res) => {
  const { parentId } = req.params;
  const { includeInactive } = req.query;
  const filter = { parent: parentId };
  if (includeInactive !== 'true') filter.isActive = true;

  const list = await Category.find(filter)
    .select('_id name slug image isLeaf productCount sortOrder isActive')
    .sort({ sortOrder: 1 }).lean();
  res.status(200).json(new ApiResponse(200, list, "Children fetched"));
});

/**
 * @desc Get full category tree (nested)
 */
export const getCategoryTree = asyncHandler(async (req, res) => {
  const { rootId = null, includeInactive } = req.query;
  const filter = {};
  if (includeInactive !== 'true') filter.isActive = true;
  if (rootId) filter['ancestors._id'] = rootId;

  const all = await Category.find(filter).lean();
  const tree = formatToTree(all, rootId);
  res.status(200).json(new ApiResponse(200, tree, "Tree fetched"));
});

/**
 * @desc Get path (breadcrumb) for a category
 */
export const getCategoryBreadcrumb = asyncHandler(async (req, res) => {
  const path = await Category.getBreadcrumb(req.params.id);
  res.status(200).json(new ApiResponse(200, path, "Breadcrumb fetched"));
});

/**
 * @desc Create new category
 */
export const createCategory = asyncHandler(async (req, res) => {
  const { name, description, image, icon, parent, sortOrder } = req.body;
  if (!name) throw new ApiError(400, "Name is required");

  const existingCategory = await Category.findOne({ name: name.trim() });
  if (existingCategory) {
    throw new ApiError(400, `Category with name "${name}" already exists`);
  }

  let imgUrl = image || null;
  if (req.file) {
    const upload = await uploadOnCloudinary(req.file.path);
    if (upload?.success) imgUrl = upload.url;
  }

  const category = await Category.create({
    name, description, image: imgUrl, icon,
    parent: parent || null,
    sortOrder: sortOrder || 0
  });

  res.status(201).json(new ApiResponse(201, category, "Created successfully"));
});

/**
 * @desc Update existing category
 */
export const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  const category = await Category.findById(id);
  if (!category) throw new ApiError(404, "Not found");

  const oldPath = category.path;
  const oldParent = category.parent;
  
  // Simple field updates
  if (body.name && body.name !== category.name) {
    const existingCategory = await Category.findOne({ name: body.name.trim(), _id: { $ne: id } });
    if (existingCategory) {
      throw new ApiError(400, `Category with name "${body.name}" already exists`);
    }
    category.name = body.name;
  }
  if (body.description !== undefined) category.description = body.description;
  if (body.isActive !== undefined) category.isActive = body.isActive;
  if (body.icon !== undefined) category.icon = body.icon;
  if (body.sortOrder !== undefined) category.sortOrder = body.sortOrder;

  // Handle parent change
  let parentChanged = false;
  if (body.parent !== undefined) {
    const newParent = body.parent || null;
    if (String(oldParent) !== String(newParent)) {
      category.parent = newParent;
      parentChanged = true;
    }
  }

  // Handle image update
  if (req.file || body.image) {
    const oldId = getPublicId(category.image);
    if (oldId) await deleteFromCloudinary(oldId);

    if (req.file) {
      const upload = await uploadOnCloudinary(req.file.path);
      if (upload?.success) category.image = upload.url;
    } else {
      category.image = body.image;
    }
  }

  await category.save();

  // If parent changed, update leaf status of old and new parents
  if (parentChanged) {
    if (oldParent) {
      const count = await Category.countDocuments({ parent: oldParent });
      if (count === 0) await Category.findByIdAndUpdate(oldParent, { isLeaf: true });
    }
    if (category.parent) {
      await Category.findByIdAndUpdate(category.parent, { isLeaf: false });
    }
  }

  // If path changed, sync all children recursively
  if (category.path !== oldPath || parentChanged) {
    await syncChildren(category._id, category.path, category.ancestors);
  }

  res.status(200).json(new ApiResponse(200, category, "Updated successfully"));
});

/**
 * @desc Toggle Category activation status
 */
export const toggleCategoryStatus = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, "Not found");

  category.isActive = !category.isActive;
  await category.save();

  res.status(200).json(new ApiResponse(200, category, `Category ${category.isActive ? 'activated' : 'deactivated'}`));
});

/**
 * @desc Permanent Delete category
 */
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, "Not found");

  // Safety checks
  const children = await Category.countDocuments({ parent: category._id });
  if (children > 0) throw new ApiError(400, "Cannot delete category with sub-categories. Delete children first.");

  const products = await Product.countDocuments({ category: category._id });
  if (products > 0) throw new ApiError(400, "Cannot delete category with products assigned to it.");

  // Handle Cloudinary image cleanup
  const imageId = getPublicId(category.image);
  if (imageId) await deleteFromCloudinary(imageId);
  const iconId = getPublicId(category.icon);
  if (iconId) await deleteFromCloudinary(iconId);

  const parentId = category.parent;
  await category.deleteOne();

  // If parent has no more children, set it back to leaf
  if (parentId) {
    const remaining = await Category.countDocuments({ parent: parentId });
    if (remaining === 0) {
      await Category.findByIdAndUpdate(parentId, { isLeaf: true });
    }
  }

  res.status(200).json(new ApiResponse(200, {}, "Category permanently deleted"));
});

/**
 * @desc Get analytics for a category
 */
export const getCategoryStats = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const catId = new mongoose.Types.ObjectId(id);

  const [productStats, brands] = await Promise.all([
    Product.aggregate([
      { $match: { categoryAncestors: catId, isActive: true } },
      { $group: { _id: null, count: { $sum: 1 }, price: { $avg: '$price' } } }
    ]),
    Product.aggregate([
      { $match: { categoryAncestors: catId, isActive: true } },
      { $group: { _id: '$brand', count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 5 }
    ])
  ]);

  res.status(200).json(new ApiResponse(200, {
    productCount: productStats[0]?.count || 0,
    avgPrice: Math.round(productStats[0]?.price || 0),
    topBrands: brands.map(b => ({ name: b._id, count: b.count }))
  }, "Stats fetched"));
});
