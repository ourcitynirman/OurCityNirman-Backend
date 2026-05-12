import { Router } from "express";
import {
  getRootCategories,
  getAllCategories,
  getChildrenCategories,
  getCategoryTree,
  getCategoryBreadcrumb,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  getCategoryStats
} from "./category.controller.js";
import { verifyJWT, authorize } from "../../shared/middlewares/auth.middleware.js";
import { upload } from "../../shared/middlewares/multer.middleware.js";

const router = Router();

// =============================================================================
//                              PUBLIC ROUTES

/**
 * @desc    Get all categories in a flat list
 * @route   GET /api/v1/categories
 * @access  Public
 */
router.get("/", getAllCategories);

/**
 * @desc    Get all root-level categories (top of the hierarchy)
 * @route   GET /api/v1/categories/root
 * @access  Public
 */
router.get("/root", getRootCategories);

/**
 * @desc    Return the full nested category tree structure
 * @route   GET /api/v1/categories/tree
 * @access  Public
 */
router.get("/tree", getCategoryTree);

/**
 * @desc    Get all direct children categories for a specific parent
 * @route   GET /api/v1/categories/:parentId/children
 * @access  Public
 */
router.get("/:parentId/children", getChildrenCategories);

/**
 * @desc    Return full hierarchical path (breadcrumb) for a category
 * @route   GET /api/v1/categories/:id/breadcrumb
 * @access  Public
 */
router.get("/:id/breadcrumb", getCategoryBreadcrumb);


// =============================================================================
//                           ADMIN MANAGEMENT ROUTES
// =============================================================================

/**
 * @desc    Create a new category with optional image upload
 * @route   POST /api/v1/categories
 * @access  Private (Admin)
 */
router.post("/", verifyJWT, authorize("admin"), upload.single("image"), createCategory);

/**
 * @desc    Update existing category details or replace image
 * @route   PATCH /api/v1/categories/:id
 * @access  Private (Admin)
 */
router.patch("/:id", verifyJWT, authorize("admin"), upload.single("image"), updateCategory);

/**
 * @desc    Toggle category active/inactive status (affects storefront visibility)
 * @route   PATCH /api/v1/categories/:id/toggle
 * @access  Private (Admin)
 */
router.patch("/:id/toggle", verifyJWT, authorize("admin"), toggleCategoryStatus);

/**
 * @desc    Delete a category and handle its children recursively
 * @route   DELETE /api/v1/categories/:id
 * @access  Private (Admin)
 */
router.delete("/:id", verifyJWT, authorize("admin"), deleteCategory);

/**
 * @desc    Get performance and inventory statistics for a specific category
 * @route   GET /api/v1/categories/:id/stats
 * @access  Private (Admin)
 */
router.get("/:id/stats", verifyJWT, authorize("admin"), getCategoryStats);

export default router;
