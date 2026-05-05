import Address from './address.model.js';
import { ApiError } from '../../shared/utils/api.utils.js';

const MAX_ADDRESSES = 10;

const ALLOWED_UPDATE_FIELDS = [
    'addressType', 'fullName', 'phone',
    'line1', 'line2', 'landmark', 'village',
    'city', 'state', 'pincode', 'country', 'isDefault',
];


async function findUserAddress(addressId, userId) {
    const address = await Address.findOne({ _id: addressId, user: userId });
    if (!address) throw new ApiError('Address not found', 404);
    return address;
}


// addresses
/**
 * @desc    Get all saved addresses for the current user
 * @route   GET /api/v1/user/address/
 * @access  Private
 */
export async function getAddresses(req, res, next) {
    try {
        const addresses = await Address.getUserAddresses(req.user._id);

        res.status(200).json({
            success: true,
            count: addresses.length,
            data: { addresses },
        });
    } catch (err) {
        next(err);
    }
}


// addresses 
const ALLOWED_CREATE_FIELDS = [
    'addressType', 'fullName', 'phone', 'alternatePhone', 'email',
    'line1', 'line2', 'landmark', 'village',
    'city', 'state', 'pincode', 'country', 'isDefault',
];
/**
 * @desc    Add a new address to user profile
 * @route   POST /api/v1/user/address/add
 * @access  Private
 */
export async function addAddress(req, res, next) {
    try {
        const count = await Address.countUserAddresses(req.user._id);

        if (count >= MAX_ADDRESSES) {
            return next(new ApiError(`You can only save up to ${MAX_ADDRESSES} addresses`, 400));
        }

                const filtered = {};
        ALLOWED_CREATE_FIELDS.forEach((field) => {
            if (req.body[field] !== undefined) filtered[field] = req.body[field];
        });

        const address = await Address.create({
            ...filtered,
            user: req.user._id,                     
            isDefault: filtered.isDefault ?? count === 0,
        });

        res.status(201).json({
            success: true,
            message: 'Address added successfully',
            data: { address },
        });
    } catch (err) {
        next(err);
    }
}

// addresses 
/**
 * @desc    Add multiple addresses in bulk
 * @route   POST /api/v1/user/address/bulk
 * @access  Private
 */
export async function addMultipleAddresses(req, res, next) {
    try {
        const { addresses } = req.body;

        if (!Array.isArray(addresses) || addresses.length === 0) {
            return next(new ApiError('addresses must be a non-empty array', 400));
        }

        const existing = await Address.countUserAddresses(req.user._id);

        if (existing + addresses.length > MAX_ADDRESSES) {
            return next(
                new ApiError(
                    `Adding ${addresses.length} address(es) would exceed the limit of ${MAX_ADDRESSES}. You currently have ${existing}.`,
                    400
                )
            );
        }

        const payload = addresses.map((addr, i) => ({
            ...addr,
            user: req.user._id,
            isDefault: existing === 0 && i === 0,
        }));


        const created = await Address.insertMany(payload, { ordered: false });

        res.status(201).json({
            success: true,
            message: `${created.length} address(es) added successfully`,
            data: { addresses: created, count: created.length },
        });
    } catch (err) {
        next(err);
    }
}



/**
 * @desc    Get details of a specific address by ID
 * @route   GET /api/v1/user/address/:id
 * @access  Private
 */
export async function getAddress(req, res, next) {
    try {
        const address = await findUserAddress(req.params.id, req.user._id);

        res.status(200).json({
            success: true,
            data: { address },
        });
    } catch (err) {
        next(err);
    }
}



/**
 * @desc    Update an existing address
 * @route   PUT /api/v1/user/address/:id
 * @access  Private
 */
export async function updateAddress(req, res, next) {
    try {
        const address = await findUserAddress(req.params.id, req.user._id);

        ALLOWED_UPDATE_FIELDS.forEach((field) => {
            if (req.body[field] !== undefined) address[field] = req.body[field];
        });


        await address.save();

        res.status(200).json({
            success: true,
            message: 'Address updated successfully',
            data: { address },
        });
    } catch (err) {
        next(err);
    }
}


/**
 * @desc    Delete an address
 * @route   DELETE /api/v1/user/address/:id
 * @access  Private
 */
export async function deleteAddress(req, res, next) {
    try {
        const address = await Address.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!address) return next(new ApiError('Address not found', 404));


        if (address.isDefault) {
            const next_ = await Address.findOne({ user: req.user._id }).sort({ createdAt: -1 });
            if (next_) await next_.setAsDefault();
        }

        res.status(200).json({
            success: true,
            message: 'Address deleted successfully',
            data: { deletedId: req.params.id },
        });
    } catch (err) {
        next(err);
    }
}



/**
 * @desc    Set an address as default
 * @route   PATCH /api/v1/user/address/:id/set-default
 * @access  Private
 */
export async function setDefaultAddress(req, res, next) {
    try {
        const address = await findUserAddress(req.params.id, req.user._id);

        if (address.isDefault) {
            return res.status(200).json({
                success: true,
                message: 'Address is already the default',
                data: { address },
            });
        }


        await address.setAsDefault();

        res.status(200).json({
            success: true,
            message: 'Default address updated',
            data: { address },
        });
    } catch (err) {
        next(err);
    }
}