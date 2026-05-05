import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
      maxlength: [100, "Category name cannot exceed 100 characters"]
    },
    slug: {
      type: String,
      unique: true,
      index: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"]
    },
    image: {
      type: String
    },
    icon: {
      type: String
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true
    },
    ancestors: [{
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
      name: String,
      slug: String
    }],
    level: {
      type: Number,
      default: 0
    },
    path: {
      type: String,
      index: true
    },
    isLeaf: {
      type: Boolean,
      default: true,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    sortOrder: {
      type: Number,
      default: 0
    },
    productCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Search indexes
categorySchema.index({ parent: 1, isActive: 1 });
categorySchema.index({ level: 1, isActive: 1 });
categorySchema.index({ name: 'text' });

// Auto-run this before saving any category
categorySchema.pre("save", async function () {
  try {
    const CategoryModel = mongoose.models.Category || mongoose.model("Category");

    // 1. Generate unique slug from name
    if (this.isModified("name")) {
      const baseSlug = this.name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
        
      let finalSlug = baseSlug;
      let counter = 1;
      
      const existsQuery = this.isNew ? { slug: finalSlug } : { slug: finalSlug, _id: { $ne: this._id } };
      while (await CategoryModel.exists(existsQuery)) {
        finalSlug = `${baseSlug}-${counter}`;
        existsQuery.slug = finalSlug;
        counter++;
      }
      this.slug = finalSlug;
    }

    // 2. Handle Hierarchy Changes (Ancestors and Paths)
    if (this.isModified("parent")) {
      if (this.parent) {
        if (this.parent.equals(this._id)) throw new Error("Category cannot be its own parent");

        const parentCategory = await CategoryModel.findById(this.parent);
        if (!parentCategory) throw new Error("Selected parent category not found");

        // Prevent loops
        const isDescendant = parentCategory.ancestors.some(anc => anc._id.equals(this._id));
        if (isDescendant) throw new Error("Circular reference: cannot set a descendant as parent");

        // Copy ancestors from parent and add parent itself
        this.ancestors = [...parentCategory.ancestors, { 
          _id: parentCategory._id, 
          name: parentCategory.name, 
          slug: parentCategory.slug 
        }];
        
        // Parent is no longer a leaf node
        if (parentCategory.isLeaf) {
          parentCategory.isLeaf = false;
          await parentCategory.save();
        }
      } else {
        this.ancestors = [];
      }
    }

    // 3. Update metadata
    this.level = this.ancestors.length;
    const pathSlugs = [...this.ancestors.map(a => a.slug), this.slug];
    this.path = pathSlugs.join("/");

  } catch (error) {
    throw error;
  }
});

// Helper: Get full tree
categorySchema.statics.getTree = async function (rootId = null) {
  const filter = rootId ? { 'ancestors._id': rootId } : {};
  return this.find(filter).sort({ path: 1 }).lean();
};

// Helper: Get breadcrumb path
categorySchema.statics.getBreadcrumb = async function (id) {
  const category = await this.findById(id).select("ancestors name slug").lean();
  if (!category) return [];
  return [
    ...category.ancestors.map(a => ({ name: a.name, slug: a.slug })), 
    { name: category.name, slug: category.slug }
  ];
};

const Category = mongoose.models.Category || mongoose.model("Category", categorySchema);
export default Category;
