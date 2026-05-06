import HSN from './hsn.model.js';
import { ApiError } from '../../shared/utils/api.utils.js';

class HSNService {
    static async createHSN(data) {
        const { hsn_code, description, category, gst_rate, unit } = data;
        const existingHSN = await HSN.findOne({ hsn_code: hsn_code.toUpperCase() });
        if (existingHSN) throw new ApiError(409, `HSN code ${hsn_code} already exists.`);

        return await HSN.create({ hsn_code, description, category, gst_rate, unit });
    }

    static async getAllHSN(queryData) {
        const { page, limit, search, gst_rate, category, sort } = queryData;
        const filter = { is_active: true };
        if (search) filter.hsn_code = { $regex: search, $options: 'i' };
        if (gst_rate) filter.gst_rate = Number(gst_rate);
        if (category) filter.category = category;

        const sortOption = sort === 'gst_rate' ? { gst_rate: 1 } : { createdAt: -1 };

        const [hsnRecords, total] = await Promise.all([
            HSN.find(filter).populate('category', 'name slug').sort(sortOption).skip((page - 1) * limit).limit(limit).lean(),
            HSN.countDocuments(filter),
        ]);

        return { hsnRecords, total, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }

    static async getHSNById(id) {
        const hsn = await HSN.findById(id).populate('category', 'name slug').lean();
        if (!hsn) throw new ApiError(404, "HSN record not found");
        return hsn;
    }

    static async updateHSN(id, data) {
        const hsn = await HSN.findById(id);
        if (!hsn) throw new ApiError(404, "HSN record not found");

        const { hsn_code, description, category, gst_rate, unit, is_active } = data;
        if (hsn_code && hsn_code.toUpperCase() !== hsn.hsn_code) {
            const existing = await HSN.findOne({ hsn_code: hsn_code.toUpperCase() });
            if (existing) throw new ApiError(409, `HSN code ${hsn_code} already exists.`);
            hsn.hsn_code = hsn_code;
        }

        if (description !== undefined) hsn.description = description;
        if (category) hsn.category = category;
        if (gst_rate !== undefined) hsn.gst_rate = gst_rate;
        if (unit) hsn.unit = unit;
        if (is_active !== undefined) hsn.is_active = is_active;

        return await hsn.save();
    }

    static async deleteHSN(id) {
        const hsn = await HSN.findByIdAndUpdate(id, { $set: { is_active: false } }, { new: true });
        if (!hsn) throw new ApiError(404, "HSN record not found");
        return hsn;
    }

    static async bulkInsertHSN(hsn_list) {
        return await HSN.insertMany(hsn_list, { ordered: false });
    }

    static async toggleHSNStatus(id) {
        const hsn = await HSN.findById(id);
        if (!hsn) throw new ApiError(404, "HSN record not found");
        hsn.is_active = !hsn.is_active;
        return await hsn.save();
    }
}

export default HSNService;
