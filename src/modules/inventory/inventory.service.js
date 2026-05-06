import Inventory from "./inventory.model.js";
import Product from "../products/product.model.js";
import { ApiError } from "../../shared/utils/api.utils.js";

class InventoryService {
    static async updateStock(productId, updateData, user) {
        const { quantity, operation } = updateData;

        const product = await Product.findById(productId);
        if (!product) throw new ApiError(404, 'Product not found');

        if (product.vendorId.toString() !== user._id.toString() && user.role !== 'admin') {
            throw new ApiError(403, 'Unauthorized');
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

        return { product, inventory };
    }

    static async getInventoryByProduct(productId) {
        const inventory = await Inventory.findOne({ productId }).populate('productId', 'name slug sku');
        if (!inventory) {
            const product = await Product.findById(productId).select('name slug sku quantityAvailable inStock');
            if (!product) throw new ApiError(404, "Product/Inventory not found");
            return { product, inventory: null, message: "Inventory not initialized" };
        }
        return inventory;
    }
}

export default InventoryService;
