import AddressService from './address.service.js';
import { ApiError } from '../../shared/utils/api.utils.js';
import { addAddressSchema, updateAddressSchema, bulkAddressSchema } from './address.validation.js';

/**
 * @desc    Get all saved addresses for the current user
 * @route   GET /api/v1/user/address/
 * @access  Private
 */
export async function getAddresses(req, res, next) {
    try {
        const addresses = await AddressService.getUserAddresses(req.user._id);

        res.status(200).json({
            success: true,
            count: addresses.length,
            data: { addresses },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * @desc    Add a new address to user profile
 * @route   POST /api/v1/user/address/add
 * @access  Private
 */
export async function addAddress(req, res, next) {
    try {
        const validatedData = addAddressSchema.parse(req.body);

        const address = await AddressService.addAddress(req.user._id, validatedData);

        res.status(201).json({
            success: true,
            message: 'Address added successfully',
            data: { address },
        });
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
        next(err);
    }
}

/**
 * @desc    Add multiple addresses in bulk
 * @route   POST /api/v1/user/address/bulk
 * @access  Private
 */
export async function addMultipleAddresses(req, res, next) {
    try {
        const validatedData = bulkAddressSchema.parse(req.body);

        const created = await AddressService.addMultipleAddresses(req.user._id, validatedData.addresses);

        res.status(201).json({
            success: true,
            message: `${created.length} address(es) added successfully`,
            data: { addresses: created, count: created.length },
        });
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
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
        const address = await AddressService.findUserAddress(req.params.id, req.user._id);

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
        const validatedData = updateAddressSchema.parse(req.body);

        const address = await AddressService.updateAddress(req.params.id, req.user._id, validatedData);

        res.status(200).json({
            success: true,
            message: 'Address updated successfully',
            data: { address },
        });
    } catch (err) {
        if (err.name === 'ZodError') {
            return next(new ApiError('Validation Error: ' + err.errors.map(e => e.message).join(', '), 400));
        }
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
        const deletedId = await AddressService.deleteAddress(req.params.id, req.user._id);

        res.status(200).json({
            success: true,
            message: 'Address deleted successfully',
            data: { deletedId },
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
        const address = await AddressService.setDefaultAddress(req.params.id, req.user._id);

        res.status(200).json({
            success: true,
            message: address.isDefault ? 'Default address updated' : 'Address is already the default', // This ternary will always be true since we return the updated address
            data: { address },
        });
    } catch (err) {
        next(err);
    }
}