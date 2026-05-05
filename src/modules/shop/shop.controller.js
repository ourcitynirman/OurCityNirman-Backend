import mongoose from "mongoose";
import Shop from "./shop.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../../shared/utils/cloudinary.js";
import ApiError from "../../shared/utils/ApiError.js";
import ApiResponse from "../../shared/utils/ApiResponse.js";
import asyncHandler from "../../shared/utils/asyncHandler.js";
import { generateVendorId } from "../../shared/utils/generateVendorId.js";
import { ROLES } from "../../shared/constants/roles.js";




const extractPublicId = (url) => {
    if (!url) return null;
    try {
        const afterUpload = url.split("/upload/")[1];
        if (!afterUpload) return null;
        return afterUpload.replace(/^v\d+\//, "").replace(/\.[^/.]+$/, "");
    } catch { return null; }
};

const safeDelete = async (url) => {
    const publicId = extractPublicId(url);
    if (!publicId) return;
    try { await deleteFromCloudinary(publicId); }
    catch (err) { console.warn(`[Cloudinary] Delete failed for "${publicId}":`, err.message); }
};

const uploadFile = async (localPath, folder) => {
    const result = await uploadOnCloudinary(localPath, { folder });
    const url = result?.secure_url || result?.url;
    if (!url) throw new ApiError(500, "Image upload failed — please try again");
    return url;
};

const ADDRESS_FIELDS = ["village", "post", "policeStation", "block", "district", "landmark", "city", "pincode", "state", "notes", "country"];

const buildAddress = (body) => {
    const nested = typeof body.address === "object" && body.address !== null ? body.address : {};
    const result = {};
    ADDRESS_FIELDS.forEach((f) => {
        const val = nested[f] ?? body[`address[${f}]`];
        if (val !== undefined) result[f] = val?.trim() || null;
    });
    return result;
};

const parseArrayField = (value) => {
    if (!value) return null;
    if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
    if (typeof value === "string") return value.split(",").map((v) => v.trim()).filter(Boolean);
    return null;
};

const buildAvailability = (body) => {
    const nested = typeof body.availability === "object" && body.availability !== null ? body.availability : {};
    const result = {};
    const openTime = nested.openTime ?? body["availability[openTime]"];
    const closeTime = nested.closeTime ?? body["availability[closeTime]"];
    const daysOpen = nested.daysOpen ?? body["availability[daysOpen]"];
    if (openTime !== undefined) result.openTime = openTime?.trim() || null;
    if (closeTime !== undefined) result.closeTime = closeTime?.trim() || null;
    if (daysOpen !== undefined) result.daysOpen = parseArrayField(daysOpen) ?? [];
    return result;
};

const VENDOR_SCALAR_FIELDS = ["shopname", "category", "storeType", "description", "tagline", "phone", "alternativephone", "website"];

const assertOwnership = (shop, userId, role) => {
    if (role === ROLES.ADMIN) return;
    if (shop.vendor.toString() !== userId.toString())
        throw new ApiError(403, "You are not authorised to perform this action on this shop");
};


// VENDOR  Create shop

/**
 * @desc    Register a new shop (Vendor initial setup)
 * @route   POST /api/v1/shop/
 * @access  Private (Vendor)
 */
export const createShop = asyncHandler(async (req, res) => {
    const { _id: userId, role } = req.user;
    if (role !== ROLES.VENDOR) throw new ApiError(403, "Only vendors can create a shop");

    const alreadyExists = await Shop.existsForVendor(userId);
    if (alreadyExists) throw new ApiError(409, "You already have a shop. Use the update endpoint instead.");

    const { shopname, category } = req.body;
    if (!shopname?.trim()) throw new ApiError(400, "Shop name is required");
    if (!category?.trim()) throw new ApiError(400, "Shop category is required");

    const shopCode = await generateVendorId();

    let logoUrl = null;
    let bannerUrl = null;
    if (req.files?.logo?.[0]?.path) logoUrl = await uploadFile(req.files.logo[0].path, "shops/logos");
    if (req.files?.banner?.[0]?.path) bannerUrl = await uploadFile(req.files.banner[0].path, "shops/banners");

    const shop = await Shop.create({
        vendor: userId,
        shopCode,
        shopname: shopname.trim(),
        category: category.trim(),
        storeType: req.body.storeType?.trim() || null,
        description: req.body.description?.trim() || null,
        tagline: req.body.tagline?.trim() || null,
        phone: req.body.phone?.trim() || null,
        alternativephone: req.body.alternativephone?.trim() || null,
        email: req.body.email?.toLowerCase().trim() || null,
        website: req.body.website?.trim() || null,
        gstNumber: req.body.gstNumber?.toUpperCase().trim() || null,
        address: buildAddress(req.body),
        financeOptions: parseArrayField(req.body.financeOptions) ?? [],
        deliveryAreas: parseArrayField(req.body.deliveryAreas) ?? [],
        availability: buildAvailability(req.body),
        logo: logoUrl,
        banner: bannerUrl,
        verificationHistory: [{ action: "requested", performedByRole: "system", note: "Shop created — awaiting verification request from vendor" }],
    });

    return res.status(201).json(new ApiResponse(201, shop, "Shop created successfully. Please submit your documents to request verification."));
});



/**
 * @desc    Submit documents for shop verification
 * @route   POST /api/v1/shop/vendor/my/request-verification
 * @access  Private (Vendor)
 */
export const requestVerification = asyncHandler(async (req, res) => {
    const { _id: userId, role } = req.user;
    if (role !== ROLES.VENDOR) throw new ApiError(403, "Only vendors can request verification");

    const shop = await Shop.findByVendor(userId);
    if (!shop) throw new ApiError(404, "You have not created a shop yet");

    if (shop.verificationStatus === "pending") {
        return res.status(400).json(new ApiResponse(400, {
            verificationStatus: shop.verificationStatus,
            verificationRequestedAt: shop.verificationRequestedAt,
        }, "Your verification request is already pending. Please wait for admin review."));
    }

    if (shop.verificationStatus === "approved") {
        return res.status(400).json(new ApiResponse(400, {
            verificationStatus: shop.verificationStatus,
        }, "Your shop is already verified."));
    }

    const gstPath = req.files?.gstDocument?.[0]?.path;
    const panPath = req.files?.panDocument?.[0]?.path;
    const otherPath = req.files?.otherDocument?.[0]?.path;

    if (!gstPath && !panPath) {
        throw new ApiError(400, "Please upload at least one document (GST or PAN) to request verification");
    }

    let gstUrl = shop.verificationDocs?.gstDocument || null;
    let panUrl = shop.verificationDocs?.panDocument || null;
    let otherUrl = shop.verificationDocs?.otherDocument || null;

    if (gstPath) {
        if (gstUrl) await safeDelete(gstUrl);  
        gstUrl = await uploadFile(gstPath, "shops/verification/gst");
    }
    if (panPath) {
        if (panUrl) await safeDelete(panUrl);
        panUrl = await uploadFile(panPath, "shops/verification/pan");
    }
    if (otherPath) {
        if (otherUrl) await safeDelete(otherUrl);
        otherUrl = await uploadFile(otherPath, "shops/verification/other");
    }

    const isReRequest = shop.verificationStatus === "rejected";
    const action = isReRequest ? "re_requested" : "requested";

    // Update shop
    shop.verificationStatus = "pending";
    shop.verificationRequestedAt = new Date();
    shop.verificationResolvedAt = null;
    shop.verificationResolvedBy = null;
    shop.rejectionReason = null;
    shop.verificationAttempts = (shop.verificationAttempts || 0) + 1;
    shop.verificationDocs = { gstDocument: gstUrl, panDocument: panUrl, otherDocument: otherUrl, submittedAt: new Date() };

    shop.verificationHistory.push({
        action,
        performedBy: userId,
        performedByRole: ROLES.VENDOR,
        note: isReRequest
            ? `Re-submitted after rejection (attempt #${shop.verificationAttempts})`
            : `Initial verification request (attempt #${shop.verificationAttempts})`,
    });

    shop.markModified("verificationDocs");
    shop.markModified("verificationHistory");
    await shop.save();

    return res.status(200).json(new ApiResponse(200, {
        verificationStatus: shop.verificationStatus,
        verificationRequestedAt: shop.verificationRequestedAt,
        verificationAttempts: shop.verificationAttempts,
        docsSubmitted: {
            gstDocument: !!gstUrl,
            panDocument: !!panUrl,
            otherDocument: !!otherUrl,
        },
    }, isReRequest
        ? "Verification re-request submitted successfully. Admin will review your documents."
        : "Verification request submitted successfully. Admin will review your documents."
    ));
});



/**
 * @desc    Get current status of shop verification
 * @route   GET /api/v1/shop/vendor/my/verification-status
 * @access  Private (Vendor)
 */
export const getMyVerificationStatus = asyncHandler(async (req, res) => {
    const { _id: userId, role } = req.user;
    if (role !== ROLES.VENDOR) throw new ApiError(403, "Access denied");

    const shop = await Shop.findByVendor(userId).select(
        "shopname verificationStatus verificationRequestedAt verificationResolvedAt rejectionReason verificationAttempts verificationDocs.submittedAt canRequestVerification"
    );
    if (!shop) throw new ApiError(404, "You have not created a shop yet");

    const messages = {
        not_requested: "You have not submitted a verification request yet.",
        pending: "Your request is under review. Admin will respond soon.",
        approved: "Congratulations! Your shop is verified. You can now add products.",
        rejected: `Your request was rejected. Reason: "${shop.rejectionReason || 'Not specified'}". You can re-submit with updated documents.`,
    };

    return res.status(200).json(new ApiResponse(200, {
        shopname: shop.shopname,
        verificationStatus: shop.verificationStatus,
        canRequestVerification: shop.canRequestVerification,
        verificationAttempts: shop.verificationAttempts,
        verificationRequestedAt: shop.verificationRequestedAt,
        verificationResolvedAt: shop.verificationResolvedAt,
        rejectionReason: shop.rejectionReason,
        docsSubmittedAt: shop.verificationDocs?.submittedAt,
        message: messages[shop.verificationStatus],
    }, "Verification status fetched"));
});


// VENDOR 

/**
 * @desc    Update shop profile details
 * @route   PATCH /api/v1/shop/update/:shopId
 * @access  Private (Vendor/Admin)
 */
export const updateShop = asyncHandler(async (req, res) => {
    const { shopId } = req.params;
    const { _id: userId, role } = req.user;

    if (![ROLES.VENDOR, ROLES.ADMIN].includes(role)) throw new ApiError(403, "Access denied");
    if (!mongoose.isValidObjectId(shopId)) throw new ApiError(400, "Invalid shop ID");

    const shop = await Shop.findById(shopId);
    if (!shop) throw new ApiError(404, "Shop not found");
    assertOwnership(shop, userId, role);

    VENDOR_SCALAR_FIELDS.forEach((f) => { if (req.body[f] !== undefined) shop[f] = req.body[f]?.trim() || null; });
    if (req.body.email !== undefined) shop.email = req.body.email?.toLowerCase().trim() || null;
    if (req.body.gstNumber !== undefined) shop.gstNumber = req.body.gstNumber?.toUpperCase().trim() || null;

    const newAddress = buildAddress(req.body);
    if (Object.keys(newAddress).length > 0) { Object.assign(shop.address, newAddress); shop.markModified("address"); }

    const newFinance = parseArrayField(req.body.financeOptions);
    const newDelivery = parseArrayField(req.body.deliveryAreas);
    if (newFinance !== null) shop.financeOptions = newFinance;
    if (newDelivery !== null) shop.deliveryAreas = newDelivery;

    const newAvail = buildAvailability(req.body);
    if (Object.keys(newAvail).length > 0) { Object.assign(shop.availability, newAvail); shop.markModified("availability"); }

    if (req.files?.logo?.[0]?.path) { await safeDelete(shop.logo); shop.logo = await uploadFile(req.files.logo[0].path, "shops/logos"); }
    if (req.files?.banner?.[0]?.path) { await safeDelete(shop.banner); shop.banner = await uploadFile(req.files.banner[0].path, "shops/banners"); }

    await shop.save();
    return res.status(200).json(new ApiResponse(200, shop, "Shop updated successfully"));
});


// VENDOR 

/**
 * @desc    Permanently delete a shop and its assets
 * @route   DELETE /api/v1/shop/delete/:shopId
 * @access  Private (Vendor/Admin)
 */
export const deleteShop = asyncHandler(async (req, res) => {
    const { shopId } = req.params;
    const { _id: userId, role } = req.user;

    if (![ROLES.VENDOR, ROLES.ADMIN].includes(role)) throw new ApiError(403, "Access denied");
    if (!mongoose.isValidObjectId(shopId)) throw new ApiError(400, "Invalid shop ID");

    const shop = await Shop.findById(shopId);
    if (!shop) throw new ApiError(404, "Shop not found");
    assertOwnership(shop, userId, role);

    await Promise.allSettled([
        safeDelete(shop.logo), safeDelete(shop.banner),
        safeDelete(shop.verificationDocs?.gstDocument),
        safeDelete(shop.verificationDocs?.panDocument),
        safeDelete(shop.verificationDocs?.otherDocument),
    ]);
    await Shop.findByIdAndDelete(shopId);

    return res.status(200).json(new ApiResponse(200, {}, "Shop deleted successfully"));
});


// VENDOR 

/**
 * @desc    Remove shop logo image
 * @route   DELETE /api/v1/shop/:shopId/logo
 * @access  Private (Vendor/Admin)
 */
export const deleteShopLogo = asyncHandler(async (req, res) => {
    const shop = await Shop.findById(req.params.shopId);
    if (!shop) throw new ApiError(404, "Shop not found");
    assertOwnership(shop, req.user._id, req.user.role);
    if (!shop.logo) throw new ApiError(400, "This shop has no logo to remove");
    await safeDelete(shop.logo);
    shop.logo = null;
    await shop.save();
    return res.status(200).json(new ApiResponse(200, {}, "Logo removed successfully"));
});

/**
 * @desc    Remove shop banner image
 * @route   DELETE /api/v1/shop/:shopId/banner
 * @access  Private (Vendor/Admin)
 */
export const deleteShopBanner = asyncHandler(async (req, res) => {
    const shop = await Shop.findById(req.params.shopId);
    if (!shop) throw new ApiError(404, "Shop not found");
    assertOwnership(shop, req.user._id, req.user.role);
    if (!shop.banner) throw new ApiError(400, "This shop has no banner to remove");
    await safeDelete(shop.banner);
    shop.banner = null;
    await shop.save();
    return res.status(200).json(new ApiResponse(200, {}, "Banner removed successfully"));
});


// VENDOR 

/**
 * @desc    Toggle shop availability status
 * @route   PATCH /api/v1/shop/:shopId/toggle-status
 * @access  Private (Vendor)
 */
export const toggleShopStatus = asyncHandler(async (req, res) => {
    const { _id: userId, role } = req.user;
    if (role !== ROLES.VENDOR) throw new ApiError(403, "Access denied");

    const shop = await Shop.findById(req.params.shopId);
    if (!shop) throw new ApiError(404, "Shop not found");
    assertOwnership(shop, userId, role);

    shop.isActive = !shop.isActive;
    await shop.save();
    return res.status(200).json(new ApiResponse(200, { isActive: shop.isActive }, `Shop ${shop.isActive ? "activated" : "deactivated"} successfully`));
});


// VENDOR 

/**
 * @desc    Get currently logged-in vendor's shop details
 * @route   GET /api/v1/shop/vendor/my
 * @access  Private (Vendor)
 */
export const getMyShop = asyncHandler(async (req, res) => {
    const { _id: userId, role } = req.user;
    if (role !== "vendor") throw new ApiError(403, "Access denied");

    const shop = await Shop.findByVendor(userId).populate("vendor", "fullName email avatar");
    if (!shop) throw new ApiError(404, "You have not created a shop yet");

    return res.status(200).json(new ApiResponse(200, shop, "Shop fetched successfully"));
});


// PUBLIC 

/**
 * @desc    Get all active shops with filtering and search
 * @route   GET /api/v1/shop/
 * @access  Public
 */
export const getAllShops = asyncHandler(async (req, res) => {
    const { category, isVerified, search, city, state, page = 1, limit = 10, sortBy = "createdAt", order = "desc" } = req.query;

    const filter = { isActive: true };
    if (category) filter.category = category;
    if (isVerified !== undefined) filter.isVerified = isVerified === "true";
    if (city?.trim()) filter["address.city"] = { $regex: city.trim(), $options: "i" };
    if (state?.trim()) filter["address.state"] = { $regex: state.trim(), $options: "i" };
    if (search?.trim()) {
        filter.$or = [
            { shopname: { $regex: search.trim(), $options: "i" } },
            { description: { $regex: search.trim(), $options: "i" } },
            { tagline: { $regex: search.trim(), $options: "i" } },
        ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const ALLOWED_SORTS = ["createdAt", "rating.average", "totalOrders", "totalProducts"];
    const safeSortBy = ALLOWED_SORTS.includes(sortBy) ? sortBy : "createdAt";

    const [shops, total] = await Promise.all([
        Shop.find(filter).populate("vendor", "fullName email avatar")
            .sort({ [safeSortBy]: order === "asc" ? 1 : -1 })
            .skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
        Shop.countDocuments(filter),
    ]);

    return res.status(200).json(new ApiResponse(200, {
        shops,
        pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum), hasNext: pageNum < Math.ceil(total / limitNum), hasPrev: pageNum > 1 },
    }, "Shops fetched successfully"));
});


// PUBLIC 

/**
 * @desc    Get shop details by ID
 * @route   GET /api/v1/shop/:shopId
 * @access  Public
 */
export const getShopById = asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.shopId)) throw new ApiError(400, "Invalid shop ID");
    const shop = await Shop.findById(req.params.shopId).populate("vendor", "fullName email avatar");
    if (!shop) throw new ApiError(404, "Shop not found");
    if (!shop.isActive) throw new ApiError(403, "This shop is currently inactive");
    return res.status(200).json(new ApiResponse(200, shop, "Shop fetched successfully"));
});

/**
 * @desc    Get shop details by slug
 * @route   GET /api/v1/shop/slug/:slug
 * @access  Public
 */
export const getShopBySlug = asyncHandler(async (req, res) => {
    const shop = await Shop.findOne({ slug: req.params.slug }).populate("vendor", "fullName email avatar");
    if (!shop) throw new ApiError(404, "Shop not found");
    if (!shop.isActive) throw new ApiError(403, "This shop is currently inactive");
    return res.status(200).json(new ApiResponse(200, shop, "Shop fetched successfully"));
});

/**
 * @desc    Get shop details by shop code
 * @route   GET /api/v1/shop/code/:shopCode
 * @access  Public
 */
export const getShopByCode = asyncHandler(async (req, res) => {
    const shop = await Shop.findOne({ shopCode: req.params.shopCode.toUpperCase() }).populate("vendor", "fullName email avatar");
    if (!shop) throw new ApiError(404, "Shop not found");
    if (!shop.isActive) throw new ApiError(403, "This shop is currently inactive");
    return res.status(200).json(new ApiResponse(200, shop, "Shop fetched successfully"));
});



/**
 * @desc    Get pending shop verification requests
 * @route   GET /api/v1/shop/admin/verification-requests
 * @access  Private (Admin)
 */
export const adminGetVerificationRequests = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") throw new ApiError(403, "Access denied");

    const { status = "pending", page = 1, limit = 20 } = req.query;

    const ALLOWED_STATUSES = ["pending", "approved", "rejected", "not_requested"];
    if (!ALLOWED_STATUSES.includes(status)) throw new ApiError(400, `Invalid status filter. Allowed: ${ALLOWED_STATUSES.join(", ")}`);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const filter = { verificationStatus: status };

    const [shops, total] = await Promise.all([
        Shop.find(filter)
            .populate("vendor", "fullName email phone createdAt")
            .populate("verificationResolvedBy", "fullName email")
            .sort({ verificationRequestedAt: 1 }) 
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .select("shopname shopCode category storeType address gstNumber verificationStatus verificationDocs verificationAttempts verificationRequestedAt verificationResolvedAt rejectionReason verificationHistory vendor isActive isVerified createdAt")
            .lean(),
        Shop.countDocuments(filter),
    ]);

    return res.status(200).json(new ApiResponse(200, {
        shops,
        pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    }, `Verification requests (${status}) fetched successfully`));
});



/**
 * @desc    Get full details of a specific verification request
 * @route   GET /api/v1/shop/admin/verification-requests/:shopId
 * @access  Private (Admin)
 */
export const adminGetVerificationDetail = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") throw new ApiError(403, "Access denied");

    const { shopId } = req.params;
    if (!mongoose.isValidObjectId(shopId)) throw new ApiError(400, "Invalid shop ID");

    const shop = await Shop.findById(shopId)
        .populate("vendor", "fullName email phone avatar createdAt")
        .populate("verificationResolvedBy", "fullName email")
        .lean();

    if (!shop) throw new ApiError(404, "Shop not found");

    return res.status(200).json(new ApiResponse(200, {
        _id: shop._id,
        shopname: shop.shopname,
        shopCode: shop.shopCode,
        category: shop.category,
        storeType: shop.storeType,
        description: shop.description,
        tagline: shop.tagline,
        gstNumber: shop.gstNumber,
        address: shop.address,
        fullAddress: shop.fullAddress,
        phone: shop.phone,
        email: shop.email,
        website: shop.website,
        logo: shop.logo,
        banner: shop.banner,

        vendor: shop.vendor,

        verificationStatus: shop.verificationStatus,
        verificationDocs: shop.verificationDocs,   
        verificationAttempts: shop.verificationAttempts,
        verificationRequestedAt: shop.verificationRequestedAt,
        verificationResolvedAt: shop.verificationResolvedAt,
        verificationResolvedBy: shop.verificationResolvedBy,
        rejectionReason: shop.rejectionReason,
        verificationHistory: shop.verificationHistory,

        isActive: shop.isActive,
        isVerified: shop.isVerified,
        createdAt: shop.createdAt,
    }, "Shop verification details fetched"));
});



/**
 * @desc    Approve or reject a shop verification request
 * @route   PATCH /api/v1/shop/:shopId/verify
 * @access  Private (Admin)
 */
export const verifyShop = asyncHandler(async (req, res) => {
    if (req.user.role !== ROLES.ADMIN) throw new ApiError(403, "Only admins can verify shops");

    const { shopId } = req.params;
    if (!mongoose.isValidObjectId(shopId)) throw new ApiError(400, "Invalid shop ID");

    const { action, reason } = req.body;
    if (!action) throw new ApiError(400, "action is required: 'approve' or 'reject'");
    if (!["approve", "reject"].includes(action)) throw new ApiError(400, "action must be 'approve' or 'reject'");
    if (action === "reject" && !reason?.trim()) throw new ApiError(400, "A rejection reason is required");

    const shop = await Shop.findById(shopId);
    if (!shop) throw new ApiError(404, "Shop not found");

    if (shop.verificationStatus !== "pending") {
        throw new ApiError(400, `Cannot ${action} — shop verification status is currently "${shop.verificationStatus}". Only "pending" requests can be actioned.`);
    }

    if (action === "approve") {
        shop.verificationStatus = "approved";
        shop.isVerified = true;
        shop.rejectionReason = null;
        shop.verificationResolvedAt = new Date();
        shop.verificationResolvedBy = req.user._id;

        shop.verificationHistory.push({
            action: "approved",
            performedBy: req.user._id,
            performedByRole: ROLES.ADMIN,
            note: reason?.trim() || "Approved by admin",
        });

        shop.markModified("verificationHistory");
        await shop.save();

        return res.status(200).json(new ApiResponse(200, {
            shopId: shop._id,
            shopname: shop.shopname,
            isVerified: shop.isVerified,
            verificationStatus: shop.verificationStatus,
        }, "Shop verified successfully! Vendor can now add products."));
    }

    shop.verificationStatus = "rejected";
    shop.isVerified = false;
    shop.rejectionReason = reason.trim();
    shop.verificationResolvedAt = new Date();
    shop.verificationResolvedBy = req.user._id;

    shop.verificationHistory.push({
        action: "rejected",
        performedBy: req.user._id,
        performedByRole: ROLES.ADMIN,
        note: reason.trim(),
    });

    shop.markModified("verificationHistory");
    await shop.save();

    return res.status(200).json(new ApiResponse(200, {
        shopId: shop._id,
        shopname: shop.shopname,
        isVerified: shop.isVerified,
        verificationStatus: shop.verificationStatus,
        rejectionReason: shop.rejectionReason,
    }, "Shop verification rejected. Vendor will be notified to re-submit."));
});


// ADMIN 

/**
 * @desc    Get list of all shops for administration
 * @route   GET /api/v1/shop/admin/all
 * @access  Private (Admin)
 */
export const adminGetAllShops = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") throw new ApiError(403, "Access denied");

    const { isActive, isVerified, category, verificationStatus, search, page = 1, limit = 20, sortBy = "createdAt", order = "desc" } = req.query;

    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (isVerified !== undefined) filter.isVerified = isVerified === "true";
    if (verificationStatus) filter.verificationStatus = verificationStatus;
    if (category) filter.category = category;
    if (search?.trim()) {
        filter.$or = [
            { shopname: { $regex: search.trim(), $options: "i" } },
            { shopCode: { $regex: search.trim(), $options: "i" } },
        ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const ALLOWED_SORTS = ["createdAt", "shopname", "totalOrders", "totalProducts", "rating.average"];
    const safeSortBy = ALLOWED_SORTS.includes(sortBy) ? sortBy : "createdAt";

    const [shops, total] = await Promise.all([
        Shop.find(filter)
            .populate("vendor", "fullName email phone avatar")
            .sort({ [safeSortBy]: order === "asc" ? 1 : -1 })
            .skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
        Shop.countDocuments(filter),
    ]);

    return res.status(200).json(new ApiResponse(200, {
        shops,
        pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    }, "Shops fetched successfully"));
});


// ADMIN Shop stats dashboard

/**
 * @desc    Get comprehensive shop statistics (Admin dashboard)
 * @route   GET /api/v1/shop/admin/stats
 * @access  Private (Admin)
 */
export const adminGetShopStats = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") throw new ApiError(403, "Access denied");

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [result] = await Shop.aggregate([
        {
            $facet: {
                totals: [
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            active: { $sum: { $cond: ["$isActive", 1, 0] } },
                            inactive: { $sum: { $cond: ["$isActive", 0, 1] } },
                            verified: { $sum: { $cond: ["$isVerified", 1, 0] } },
                            unverified: { $sum: { $cond: ["$isVerified", 0, 1] } },
                            pendingRequests: { $sum: { $cond: [{ $eq: ["$verificationStatus", "pending"] }, 1, 0] } },
                            approvedRequests: { $sum: { $cond: [{ $eq: ["$verificationStatus", "approved"] }, 1, 0] } },
                            rejectedRequests: { $sum: { $cond: [{ $eq: ["$verificationStatus", "rejected"] }, 1, 0] } },
                            notRequested: { $sum: { $cond: [{ $eq: ["$verificationStatus", "not_requested"] }, 1, 0] } },
                            totalOrders: { $sum: "$totalOrders" },
                            totalProducts: { $sum: "$totalProducts" },
                            avgRating: { $avg: "$rating.average" },
                        },
                    },
                    { $project: { _id: 0, total: 1, active: 1, inactive: 1, verified: 1, unverified: 1, pendingRequests: 1, approvedRequests: 1, rejectedRequests: 1, notRequested: 1, totalOrders: 1, totalProducts: 1, avgRating: { $round: ["$avgRating", 2] } } },
                ],
                byCategory: [{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $project: { _id: 0, category: "$_id", count: 1 } }],
                byStoreType: [{ $group: { _id: "$storeType", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $project: { _id: 0, storeType: "$_id", count: 1 } }],
                topByOrders: [{ $sort: { totalOrders: -1 } }, { $limit: 5 }, { $project: { shopname: 1, shopCode: 1, category: 1, totalOrders: 1, rating: 1 } }],
                topByRating: [{ $match: { "rating.count": { $gte: 1 } } }, { $sort: { "rating.average": -1 } }, { $limit: 5 }, { $project: { shopname: 1, shopCode: 1, category: 1, rating: 1 } }],
                recentShops: [{ $sort: { createdAt: -1 } }, { $limit: 5 }, { $project: { shopname: 1, shopCode: 1, category: 1, isVerified: 1, verificationStatus: 1, isActive: 1, createdAt: 1 } }],
                recentPending: [{ $match: { verificationStatus: "pending" } }, { $sort: { verificationRequestedAt: 1 } }, { $limit: 5 }, { $project: { shopname: 1, shopCode: 1, category: 1, verificationRequestedAt: 1, verificationAttempts: 1 } }],
                monthlyRegistrations: [
                    { $match: { createdAt: { $gte: sixMonthsAgo } } },
                    { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
                    { $sort: { "_id.year": 1, "_id.month": 1 } },
                    { $project: { _id: 0, year: "$_id.year", month: "$_id.month", count: 1 } },
                ],
            },
        },
    ]);

    return res.status(200).json(new ApiResponse(200, {
        totals: result.totals[0] ?? {},
        byCategory: result.byCategory,
        byStoreType: result.byStoreType,
        topByOrders: result.topByOrders,
        topByRating: result.topByRating,
        recentShops: result.recentShops,
        recentPending: result.recentPending,
        monthlyRegistrations: result.monthlyRegistrations,
    }, "Shop stats fetched successfully"));
});


// ADMIN  Force-deactivate a shop

/**
 * @desc    Force deactivate a shop (Soft delete)
 * @route   PATCH /api/v1/shop/admin/:shopId/deactivate
 * @access  Private (Admin)
 */
export const adminDeactivateShop = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") throw new ApiError(403, "Access denied");

    const shop = await Shop.findById(req.params.shopId);
    if (!shop) throw new ApiError(404, "Shop not found");
    if (!shop.isActive) throw new ApiError(400, "Shop is already inactive");

    shop.isActive = false;
    await shop.save();
    return res.status(200).json(new ApiResponse(200, { isActive: false }, "Shop deactivated successfully"));
});