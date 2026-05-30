import mongoose from 'mongoose';
import Category from "./category.model.js";
import Product from "../products/product.model.js";
import { ApiError } from "../../shared/utils/api.utils.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../../shared/utils/cloudinary.js";

const getPublicId = (url) => {
    if (!url || !url.includes("cloudinary.com")) return null;
    return url.split("/").pop().split(".")[0];
};

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

const formatToTree = (list, parentId = null) => {
    const pId = parentId ? String(parentId) : null;
    return list
        .filter(cat => {
            const catPId = cat.parent ? String(cat.parent) : null;
            return catPId === pId;
        })
        .map(cat => ({
            ...cat,
            children: formatToTree(list, cat._id)
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder);
};

class CategoryService {
    static async getRootCategories(includeInactive) {
        const filter = { parent: null };
        if (includeInactive !== 'true') filter.isActive = true;

        const list = await Category.find(filter)
            .select('_id name slug image icon productCount isLeaf sortOrder isActive')
            .sort({ sortOrder: 1 }).lean();
        return list;
    }

    static async getAllCategories(includeInactive) {
        const filter = {};
        if (includeInactive !== 'true') filter.isActive = true;

        const list = await Category.find(filter)
            .select('_id name slug parent level isActive ancestors')
            .sort({ level: 1, sortOrder: 1 }).lean();
        return list;
    }

    static async getChildrenCategories(parentId, includeInactive) {
        const filter = { parent: parentId };
        if (includeInactive !== 'true') filter.isActive = true;

        const list = await Category.find(filter)
            .select('_id name slug image isLeaf productCount sortOrder isActive')
            .sort({ sortOrder: 1 }).lean();
        return list;
    }

    static async getCategoryTree(rootId, includeInactive) {
        const filter = {};
        if (includeInactive !== 'true') filter.isActive = true;
        if (rootId) filter['ancestors._id'] = rootId;

        const all = await Category.find(filter).lean();
        return formatToTree(all, rootId);
    }

    static async getCategoryBreadcrumb(categoryId) {
        return await Category.getBreadcrumb(categoryId);
    }

    static async createCategory(data, file) {
        const { name, description, image, icon, parent, sortOrder } = data;

        const existingCategory = await Category.findOne({ name: name.trim() });
        if (existingCategory) {
            throw new ApiError(400, `Category with name "${name}" already exists`);
        }

        // Handle files if available
        let imgUrl = typeof image === 'string' ? image : null;
        let iconUrl = typeof icon === 'string' ? icon : null;
        let bannerUrl = typeof data.banner === 'string' ? data.banner : null;
        
        if (file) {
            if (file.image && file.image[0]) {
                const upload = await uploadOnCloudinary(file.image[0].path);
                if (upload?.success) imgUrl = upload.url;
            }
            if (file.icon && file.icon[0]) {
                const upload = await uploadOnCloudinary(file.icon[0].path);
                if (upload?.success) iconUrl = upload.url;
            }
            if (file.banner && file.banner[0]) {
                const upload = await uploadOnCloudinary(file.banner[0].path);
                if (upload?.success) bannerUrl = upload.url;
            }
        }

        const category = await Category.create({
            name, description, image: imgUrl, icon: iconUrl,
            parent: parent || null,
            sortOrder: sortOrder || 0,
            featured: data.featured || false,
            banner: bannerUrl,
            seo: data.seo || {}
        });

        return category;
    }

    static async updateCategory(categoryId, body, file) {
        const category = await Category.findById(categoryId);
        if (!category) throw new ApiError(404, "Not found");

        const oldPath = category.path;
        const oldParent = category.parent;

        if (body.name && body.name !== category.name) {
            const existingCategory = await Category.findOne({ name: body.name.trim(), _id: { $ne: categoryId } });
            if (existingCategory) {
                throw new ApiError(400, `Category with name "${body.name}" already exists`);
            }
            category.name = body.name;
        }
        
        if (body.description !== undefined) category.description = body.description;
        if (body.isActive !== undefined) category.isActive = body.isActive;
        if (body.icon !== undefined && typeof body.icon === 'string') category.icon = body.icon;
        if (body.banner !== undefined && typeof body.banner === 'string') category.banner = body.banner;
        if (body.sortOrder !== undefined) category.sortOrder = body.sortOrder;
        if (body.featured !== undefined) category.featured = body.featured;
        if (body.seo !== undefined) category.seo = body.seo;

        let parentChanged = false;
        if (body.parent !== undefined) {
            const newParent = body.parent || null;
            if (String(oldParent) !== String(newParent)) {
                category.parent = newParent;
                parentChanged = true;
            }
        }

        if (file || (body.image !== undefined && typeof body.image === 'string') || (body.icon !== undefined && typeof body.icon === 'string') || (body.banner !== undefined && typeof body.banner === 'string')) {
            if (file?.image && file.image[0]) {
                const oldId = getPublicId(category.image);
                if (oldId) await deleteFromCloudinary(oldId);
                const upload = await uploadOnCloudinary(file.image[0].path);
                if (upload?.success) category.image = upload.url;
            } else if (typeof body.image === 'string') {
                category.image = body.image;
            }

            if (file?.icon && file.icon[0]) {
                const oldId = getPublicId(category.icon);
                if (oldId) await deleteFromCloudinary(oldId);
                const upload = await uploadOnCloudinary(file.icon[0].path);
                if (upload?.success) category.icon = upload.url;
            } else if (typeof body.icon === 'string') {
                category.icon = body.icon;
            }

            if (file?.banner && file.banner[0]) {
                const oldId = getPublicId(category.banner);
                if (oldId) await deleteFromCloudinary(oldId);
                const upload = await uploadOnCloudinary(file.banner[0].path);
                if (upload?.success) category.banner = upload.url;
            } else if (typeof body.banner === 'string') {
                category.banner = body.banner;
            }
        }

        await category.save();

        if (parentChanged) {
            if (oldParent) {
                const count = await Category.countDocuments({ parent: oldParent });
                if (count === 0) await Category.findByIdAndUpdate(oldParent, { isLeaf: true });
            }
            if (category.parent) {
                await Category.findByIdAndUpdate(category.parent, { isLeaf: false });
            }
        }

        if (category.path !== oldPath || parentChanged) {
            await syncChildren(category._id, category.path, category.ancestors);
        }

        return category;
    }

    static async toggleCategoryStatus(categoryId) {
        const category = await Category.findById(categoryId);
        if (!category) throw new ApiError(404, "Not found");

        category.isActive = !category.isActive;
        await category.save();

        return category;
    }

    static async deleteCategory(categoryId) {
        const category = await Category.findById(categoryId);
        if (!category) throw new ApiError(404, "Not found");

        const children = await Category.countDocuments({ parent: category._id });
        if (children > 0) throw new ApiError(400, "Cannot delete category with sub-categories. Delete children first.");

        const products = await Product.countDocuments({ category: category._id });
        if (products > 0) throw new ApiError(400, "Cannot delete category with products assigned to it.");

        const imageId = getPublicId(category.image);
        if (imageId) await deleteFromCloudinary(imageId);
        const iconId = getPublicId(category.icon);
        if (iconId) await deleteFromCloudinary(iconId);

        const parentId = category.parent;
        await category.deleteOne();

        if (parentId) {
            const remaining = await Category.countDocuments({ parent: parentId });
            if (remaining === 0) {
                await Category.findByIdAndUpdate(parentId, { isLeaf: true });
            }
        }

        return true;
    }

    static async getCategoryStats(categoryId) {
        const catId = new mongoose.Types.ObjectId(categoryId);
        const cat = await Category.findById(catId).select('_id path').lean();

        if (!cat) throw new ApiError(404, "Category not found");

        const subCats = await Category.countDocuments({
            path: new RegExp(`^${cat.path}/`)
        });

        // Use categoryAncestors for all stats to include nested products
        const [productStats, activeProductStats, shops] = await Promise.all([
            Product.countDocuments({ categoryAncestors: catId }),
            Product.countDocuments({ categoryAncestors: catId, isActive: true }),
            Product.distinct('vendorId', { categoryAncestors: catId })
        ]);

        return {
            totalProducts: productStats,
            activeProducts: activeProductStats,
            inactiveProducts: productStats - activeProductStats,
            totalSubCategories: subCats,
            totalShops: shops.length,
            totalViews: Math.floor(Math.random() * 5000) + 500 // Mock value since views aren't tracked
        };
    }
}

export default CategoryService;
