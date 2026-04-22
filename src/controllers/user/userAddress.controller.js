import Address from '../../models/Address.model.js';
import AppError from '../../utils/ApiError.js';

const MAX_ADDRESSES = 10;

const ALLOWED_UPDATE_FIELDS = [
    'addressType', 'fullName', 'phone',
    'line1', 'line2', 'landmark', 'village',
    'city', 'state', 'pincode', 'country', 'isDefault',
];


async function findUserAddress(addressId, userId) {
    const address = await Address.findOne({ _id: addressId, user: userId });
    if (!address) throw new AppError('Address not found', 404);
    return address;
}


// addresses
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
export async function addAddress(req, res, next) {
    try {
        const count = await Address.countUserAddresses(req.user._id);

        if (count >= MAX_ADDRESSES) {
            return next(new AppError(`You can only save up to ${MAX_ADDRESSES} addresses`, 400));
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
export async function addMultipleAddresses(req, res, next) {
    try {
        const { addresses } = req.body;

        if (!Array.isArray(addresses) || addresses.length === 0) {
            return next(new AppError('addresses must be a non-empty array', 400));
        }

        const existing = await Address.countUserAddresses(req.user._id);

        if (existing + addresses.length > MAX_ADDRESSES) {
            return next(
                new AppError(
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


export async function deleteAddress(req, res, next) {
    try {
        const address = await Address.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!address) return next(new AppError('Address not found', 404));


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