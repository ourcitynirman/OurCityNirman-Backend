import mongoose from 'mongoose';
import Category from '../../modules/category/category.model.js';
import Brand from '../../modules/brand/brand.model.js';

/**
 * Resolves a category input (name, slug, or ID) into a MongoDB query fragment
 * Supports single strings, comma-separated values, ObjectIds, and Names.
 * Uses categoryAncestors for tree-based filtering.
 * 
 * @param {string} categoryInput - Query parameter for category
 * @returns {object} Query fragment for MongoDB 
 */
export const resolveCategoryFilter = async (categoryInput) => {
  if (!categoryInput) return {};

  const terms = categoryInput.split(',').map(c => c.trim()).filter(Boolean);
  if (!terms.length) return {};

  const validIds = terms.filter(n => mongoose.Types.ObjectId.isValid(n));
  const textNames = terms.filter(n => !mongoose.Types.ObjectId.isValid(n));

  const orConditions = [];
  if (textNames.length > 0) {
    orConditions.push({ name: { $in: textNames } });
    orConditions.push({ slug: { $in: textNames } });
  }
  if (validIds.length > 0) {
    orConditions.push({ _id: { $in: validIds } });
  }

  if (orConditions.length === 0) return {};

  const foundCategories = await Category.find({ $or: orConditions }).select('_id').lean();
  const categoryIds = foundCategories.map(c => c._id);

  if (categoryIds.length === 0) {
    // Return a dummy ObjectId if no category matches to force empty results
    return { categoryAncestors: new mongoose.Types.ObjectId() };
  }

  return { categoryAncestors: categoryIds.length > 1 ? { $in: categoryIds } : categoryIds[0] };
};

/**
 * Resolves a brand input (name, slug, or ID) into a MongoDB query fragment
 * 
 * @param {string} brandInput - Query parameter for brand
 * @returns {object} Query fragment for MongoDB
 */
export const resolveBrandFilter = async (brandInput) => {
  if (!brandInput) return {};

  const terms = brandInput.split(',').map(b => b.trim()).filter(Boolean);
  if (!terms.length) return {};

  const validIds = terms.filter(n => mongoose.Types.ObjectId.isValid(n));
  const textNames = terms.filter(n => !mongoose.Types.ObjectId.isValid(n));

  const orConditions = [];
  if (textNames.length > 0) {
    orConditions.push({ name: { $in: textNames } });
    orConditions.push({ slug: { $in: textNames } });
  }
  if (validIds.length > 0) {
    orConditions.push({ _id: { $in: validIds } });
  }

  if (orConditions.length === 0) return {};

  const foundBrands = await Brand.find({ $or: orConditions }).select('_id').lean();
  const brandIds = foundBrands.map(b => b._id);

  if (brandIds.length === 0) {
    // Return a dummy ObjectId to force empty results
    return { brand: new mongoose.Types.ObjectId() };
  }

  return { brand: brandIds.length > 1 ? { $in: brandIds } : brandIds[0] };
};

/**
 * Populates the category field manually to avoid N+1 DB queries
 * 
 * @param {Array} productsRaw - Array of lean product documents
 * @returns {Array} Array of products with category populated
 */
export const populateCategoriesOnProducts = async (productsRaw) => {
  if (!productsRaw || !productsRaw.length) return [];

  const categoryIds = [...new Set(productsRaw.map(p => p.category).filter(c => c && mongoose.Types.ObjectId.isValid(c)))];
  
  if (!categoryIds.length) return productsRaw;

  const categories = await Category.find({ _id: { $in: categoryIds } }).select('name slug').lean();
  const catMap = new Map();
  categories.forEach(c => {
    catMap.set(c._id.toString(), c);
  });

  return productsRaw.map(p => {
    // If category is already an object with a name, it's already populated
    if (p.category && typeof p.category === 'object' && p.category.name) {
      return p;
    }

    const catId = p.category?.toString();
    if (catId && catMap.has(catId)) {
      p.category = catMap.get(catId);
    } 
    // Do NOT set to null if it couldn't be found in map but might be partially populated
    return p;
  });
};

/**
 * Populates the brand field manually to avoid N+1 DB queries
 * 
 * @param {Array} productsRaw - Array of lean product documents
 * @returns {Array} Array of products with brand populated
 */
export const populateBrandsOnProducts = async (productsRaw) => {
  if (!productsRaw || !productsRaw.length) return [];

  const brandIds = [...new Set(productsRaw.map(p => p.brand).filter(b => b && mongoose.Types.ObjectId.isValid(b)))];
  
  if (!brandIds.length) return productsRaw;

  const brands = await Brand.find({ _id: { $in: brandIds } }).select('name slug logo').lean();
  const brandMap = new Map();
  brands.forEach(b => {
    brandMap.set(b._id.toString(), b);
  });

  return productsRaw.map(p => {
    if (p.brand && typeof p.brand === 'object' && p.brand.name) {
      return p;
    }

    const brandId = p.brand?.toString();
    if (brandId && brandMap.has(brandId)) {
      p.brand = brandMap.get(brandId);
    } 
    return p;
  });
};

/**
 * Builds standard pagination metadata object
 * 
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {object} Pagination meta
 */
export const buildPaginationMeta = (page, limit, total) => {
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 10;
  const totalNum = Number(total) || 0;
  const pages = Math.ceil(totalNum / limitNum);

  return {
    page: pageNum,
    limit: limitNum,
    total: totalNum,
    pages,
    hasNextPage: pageNum < pages,
    hasPrevPage: pageNum > 1
  };
};

/**
 * Parses and sanitizes a sort string into a MongoDB sort object
 * 
 * @param {string} sort - Sort string (e.g. "price_low", "-createdAt")
 * @param {object} sortMap - Map of allowed sort keys to Mongo sort objects
 * @param {object} defaultSort - Default fallback sort object
 * @returns {object} MongoDB sort object
 */
export const sanitizeSortParam = (sort, sortMap, defaultSort = { createdAt: -1 }) => {
  if (!sort) return defaultSort;
  return sortMap[sort] || defaultSort;
};
