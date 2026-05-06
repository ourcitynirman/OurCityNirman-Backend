import Address from './address.model.js';
import { ApiError } from '../../shared/utils/api.utils.js';

const MAX_ADDRESSES = 10;

class AddressService {
    /**
     * Get all saved addresses for a user
     */
    static async getUserAddresses(userId) {
        return await Address.getUserAddresses(userId);
    }

    /**
     * Add a single address for a user
     */
    static async addAddress(userId, addressData) {
        const count = await Address.countUserAddresses(userId);

        if (count >= MAX_ADDRESSES) {
            throw new ApiError(`You can only save up to ${MAX_ADDRESSES} addresses`, 400);
        }

        const address = await Address.create({
            ...addressData,
            user: userId,
            isDefault: addressData.isDefault ?? count === 0,
        });

        return address;
    }

    /**
     * Bulk add multiple addresses
     */
    static async addMultipleAddresses(userId, addressesData) {
        const existing = await Address.countUserAddresses(userId);

        if (existing + addressesData.length > MAX_ADDRESSES) {
            throw new ApiError(
                `Adding ${addressesData.length} address(es) would exceed the limit of ${MAX_ADDRESSES}. You currently have ${existing}.`,
                400
            );
        }

        const payload = addressesData.map((addr, i) => ({
            ...addr,
            user: userId,
            isDefault: existing === 0 && i === 0,
        }));

        const created = await Address.insertMany(payload, { ordered: false });
        return created;
    }

    /**
     * Find a user address by ID
     */
    static async findUserAddress(addressId, userId) {
        const address = await Address.findOne({ _id: addressId, user: userId });
        if (!address) throw new ApiError('Address not found', 404);
        return address;
    }

    /**
     * Update an existing address
     */
    static async updateAddress(addressId, userId, updateData) {
        const address = await this.findUserAddress(addressId, userId);

        Object.keys(updateData).forEach((key) => {
            if (updateData[key] !== undefined) {
                address[key] = updateData[key];
            }
        });

        await address.save();
        return address;
    }

    /**
     * Delete an address and automatically set a new default if the deleted one was default
     */
    static async deleteAddress(addressId, userId) {
        const address = await Address.findOneAndDelete({
            _id: addressId,
            user: userId,
        });

        if (!address) throw new ApiError('Address not found', 404);

        if (address.isDefault) {
            const next_ = await Address.findOne({ user: userId }).sort({ createdAt: -1 });
            if (next_) await next_.setAsDefault();
        }

        return addressId;
    }

    /**
     * Set a specific address as default
     */
    static async setDefaultAddress(addressId, userId) {
        const address = await this.findUserAddress(addressId, userId);

        if (address.isDefault) {
            return address; // Already default
        }

        await address.setAsDefault();
        return address;
    }
}

export default AddressService;
