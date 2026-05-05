import { Router } from 'express';
import {
    getAddresses,
    addAddress,
    addMultipleAddresses,
    getAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
} from './address.controller.js';
import { authenticate, authorize } from '../../shared/middlewares/auth.middleware.js';
import { ALL_ROLES } from '../../shared/constants/roles.js';

const Addressrouter = Router(); 

Addressrouter.use(authenticate, authorize(...ALL_ROLES));

/**
 * @desc    Get all saved addresses for the current user
 * @route   GET /api/v1/user/address/
 * @access  Private
 */
Addressrouter.get(
    '/',
    getAddresses
);


/**
 * @desc    Add a new address to user profile
 * @route   POST /api/v1/user/address/add
 * @access  Private
 */
Addressrouter.post(
    '/add',
    addAddress
);


/**
 * @desc    Add multiple addresses in bulk
 * @route   POST /api/v1/user/address/bulk
 * @access  Private
 */
Addressrouter.post(
    '/bulk',
    addMultipleAddresses
);

/**
 * @desc    Get details of a specific address by ID
 * @route   GET /api/v1/user/address/:id
 * @access  Private
 */
Addressrouter.get(
    '/:id',
    getAddress
);


/**
 * @desc    Update an existing address
 * @route   PUT /api/v1/user/address/:id
 * @access  Private
 */
Addressrouter.put(
    '/:id',
    updateAddress
);



/**
 * @desc    Delete an address
 * @route   DELETE /api/v1/user/address/:id
 * @access  Private
 */
Addressrouter.delete(
    '/:id',
    deleteAddress
);
  

/**
 * @desc    Set an address as default
 * @route   PATCH /api/v1/user/address/:id/set-default
 * @access  Private
 */
Addressrouter.patch( 
    '/:id/set-default',
    setDefaultAddress
);

export default Addressrouter;