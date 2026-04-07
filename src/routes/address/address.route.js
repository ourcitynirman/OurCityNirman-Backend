import { Router } from 'express';
import {
    getAddresses,
    addAddress,
    addMultipleAddresses,
    getAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
} from '../../controllers/user/userAddress.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

const Addressrouter = Router(); 

Addressrouter.get(
    '/',
    authenticate,
    authorize('user', 'vendor', 'homeowner', 'Worker/Technician', 'Other', 'builder', 'agent', 'admin'),
    getAddresses
);


Addressrouter.post(
    '/add',
    authenticate,
    authorize('user', 'vendor', 'homeowner', 'Worker/Technician', 'Other', 'builder', 'agent', 'admin'),
    addAddress
);


Addressrouter.post(
    '/bulk',
    authenticate,
    authorize('user', 'vendor', 'homeowner', 'Worker/Technician', 'Other', 'builder', 'agent', 'admin'),
    addMultipleAddresses
);

Addressrouter.get(
    '/:id',
    authenticate,
    authorize('user', 'vendor', 'homeowner', 'Worker/Technician', 'Other', 'builder', 'agent', 'admin'),
    getAddress
);


Addressrouter.put(
    '/:id',
    authenticate,
    authorize('user', 'vendor', 'homeowner', 'Worker/Technician', 'Other', 'builder', 'agent', 'admin'),
    updateAddress
);



Addressrouter.delete(
    '/:id',
    authenticate,
    authorize('user', 'vendor', 'homeowner', 'Worker/Technician', 'Other', 'builder', 'agent', 'admin'),
    deleteAddress
);
  

Addressrouter.patch( 
    '/:id/set-default',
    authenticate,
    authorize('user', 'vendor', 'homeowner', 'Worker/Technician', 'Other', 'builder', 'agent', 'admin'),
    setDefaultAddress
);

export default Addressrouter;