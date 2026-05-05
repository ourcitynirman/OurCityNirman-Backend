import { asyncHandler } from "../../shared/utils/api.utils.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { ApiResponse } from '../../shared/utils/api.utils.js';
import Inventory from "./inventory.model.js";
import Product from "../products/product.model.js";

/**
 * @desc    Update stock quantity for a product (Legacy fallback & Direct Inventory)
 * @route   PATCH /api/v1/inventory/:productId
 * @access  Private/Owner/Admin
 */
export const updateStock = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { quantity, operation = 'set' } = req.body;

  if (quantity === undefined || isNaN(quantity)) {
    throw new ApiError(400, 'Valid quantity required');
  }

  // 1. Update Product Model (Legacy support)
  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found');

  // Authorization check
  if (product.vendorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to update stock for this product');
  }

  const qNum = Number(quantity);
  if (operation === 'set') {
    product.quantityAvailable = Math.max(0, qNum);
  } else if (operation === 'add') {
    product.quantityAvailable = Math.max(0, product.quantityAvailable + qNum);
  } else if (operation === 'subtract') {
    product.quantityAvailable = Math.max(0, product.quantityAvailable - qNum);
  }

  product.inStock = product.quantityAvailable > 0;
  await product.save();

  // 2. Sync with Inventory Model if exists
  let inventory = await Inventory.findOne({ productId });
  if (inventory) {
      if (operation === 'set') {
          inventory.availableQuantity = Math.max(0, qNum);
      } else {
          inventory.availableQuantity = Math.max(0, inventory.availableQuantity + (operation === 'add' ? qNum : -qNum));
      }
      inventory.lastStockUpdate = new Date();
      await inventory.save();
  }

  return res.status(200).json(
    new ApiResponse(200, { product, inventory }, "Stock updated successfully")
  );
});

/**
 * @desc    Get inventory details for a product
 * @route   GET /api/v1/inventory/:productId
 * @access  Private/Owner/Admin
 */
export const getInventoryByProduct = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const inventory = await Inventory.findOne({ productId }).populate('productId', 'name slug sku');
    
    if (!inventory) {
        // Fallback: check if product exists and return its base stock
        const product = await Product.findById(productId).select('name slug sku quantityAvailable inStock');
        if (!product) throw new ApiError(404, "Product/Inventory not found");
        return res.status(200).json(new ApiResponse(200, { product, inventory: null }, "Inventory not initialized for this product"));
    }

    return res.status(200).json(new ApiResponse(200, inventory, "Inventory fetched successfully"));
});
