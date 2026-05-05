import HSN from './hsn.model.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import ApiError from '../../shared/utils/ApiError.js';
import ApiResponse from '../../shared/utils/ApiResponse.js';
import mongoose from 'mongoose';

/**
 * @desc    Create a new HSN record
 * @route   POST /api/v1/hsn
 * @access  Private (Admin)
 */
export const createHSN = asyncHandler(async (req, res) => {
    const { hsn_code, description, category, gst_rate, unit } = req.body;

    if (!hsn_code || !category || gst_rate === undefined || !unit) {
        throw new ApiError(400, "Missing required fields: hsn_code, category, gst_rate, and unit are required.");
    }

    const existingHSN = await HSN.findOne({ hsn_code: hsn_code.toUpperCase() });
    if (existingHSN) {
        throw new ApiError(409, `HSN code ${hsn_code} already exists.`);
    }

    const hsn = await HSN.create({
        hsn_code,
        description,
        category,
        gst_rate,
        unit
    });

    return res.status(201).json(
        new ApiResponse(201, hsn, "HSN record created successfully")
    );
});

/**
 * @desc    Get all HSN records with pagination, search, and filtering
 * @route   GET /api/v1/hsn
 * @access  Public
 */
export const getAllHSN = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, gst_rate, category, sort } = req.query;

    const query = { is_active: true };

    if (search) {
        query.hsn_code = { $regex: search, $options: 'i' };
    }

    if (gst_rate) {
        query.gst_rate = Number(gst_rate);
    }

    if (category) {
        query.category = category;
    }

    const sortOption = {};
    if (sort === 'gst_rate') {
        sortOption.gst_rate = 1;
    } else {
        sortOption.createdAt = -1;
    }

    const hsnRecords = await HSN.find(query)
        .populate('category', 'name slug')
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean();

    const total = await HSN.countDocuments(query);

    return res.status(200).json(
        new ApiResponse(200, {
            hsnRecords,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit)
            }
        }, "HSN records fetched successfully")
    );
});

/**
 * @desc    Get HSN by ID
 * @route   GET /api/v1/hsn/:id
 * @access  Public
 */
export const getHSNById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid HSN ID format");
    }

    const hsn = await HSN.findById(id).populate('category', 'name slug').lean();

    if (!hsn) {
        throw new ApiError(404, "HSN record not found");
    }

    return res.status(200).json(
        new ApiResponse(200, hsn, "HSN record fetched successfully")
    );
});

/**
 * @desc    Update HSN record
 * @route   PUT /api/v1/hsn/:id
 * @access  Private (Admin)
 */
export const updateHSN = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { hsn_code, description, category, gst_rate, unit, is_active } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid HSN ID format");
    }

    const hsn = await HSN.findById(id);
    if (!hsn) {
        throw new ApiError(404, "HSN record not found");
    }

    if (hsn_code && hsn_code.toUpperCase() !== hsn.hsn_code) {
        const existing = await HSN.findOne({ hsn_code: hsn_code.toUpperCase() });
        if (existing) {
            throw new ApiError(409, `HSN code ${hsn_code} already exists.`);
        }
        hsn.hsn_code = hsn_code;
    }

    if (description !== undefined) hsn.description = description;
    if (category) hsn.category = category;
    if (gst_rate !== undefined) hsn.gst_rate = gst_rate;
    if (unit) hsn.unit = unit;
    if (is_active !== undefined) hsn.is_active = is_active;

    await hsn.save();

    return res.status(200).json(
        new ApiResponse(200, hsn, "HSN record updated successfully")
    );
});

/**
 * @desc    Soft delete HSN record
 * @route   DELETE /api/v1/hsn/:id
 * @access  Private (Admin)
 */
export const deleteHSN = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid HSN ID format");
    }

    const hsn = await HSN.findByIdAndUpdate(
        id,
        { $set: { is_active: false } },
        { new: true }
    );

    if (!hsn) {
        throw new ApiError(404, "HSN record not found");
    }

    return res.status(200).json(
        new ApiResponse(200, null, "HSN record deactivated successfully")
    );
});

/**
 * @desc    Bulk insert HSN records
 * @route   POST /api/v1/hsn/bulk
 * @access  Private (Admin)
 */
export const bulkInsertHSN = asyncHandler(async (req, res) => {
    const { hsn_list } = req.body;

    if (!Array.isArray(hsn_list) || hsn_list.length === 0) {
        throw new ApiError(400, "Invalid input: hsn_list must be a non-empty array.");
    }

    // Basic validation for bulk insert
    for (const item of hsn_list) {
        if (!item.hsn_code || !item.category || item.gst_rate === undefined || !item.unit) {
            throw new ApiError(400, `Item with HSN code ${item.hsn_code || 'unknown'} is missing required fields.`);
        }
    }

    const result = await HSN.insertMany(hsn_list, { ordered: false });

    return res.status(201).json(
        new ApiResponse(201, result, `${result.length} HSN records inserted successfully`)
    );
});

/**
 * @desc    Toggle HSN active status
 * @route   PATCH /api/v1/hsn/:id/toggle-status
 * @access  Private (Admin)
 */
export const toggleHSNStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid HSN ID format");
    }

    const hsn = await HSN.findById(id);
    if (!hsn) {
        throw new ApiError(404, "HSN record not found");
    }

    hsn.is_active = !hsn.is_active;
    await hsn.save();

    return res.status(200).json(
        new ApiResponse(200, hsn, `HSN record ${hsn.is_active ? 'activated' : 'deactivated'} successfully`)
    );
});
