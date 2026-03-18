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
    authorize('user',  'admin'),
    getAddresses
);


Addressrouter.post(
    '/add',
    authenticate,
    authorize('user', 'admin'),
    addAddress
);


Addressrouter.post(
    '/bulk',
    authenticate,
    authorize('user', 'admin'),
    addMultipleAddresses
);

Addressrouter.get(
    '/:id',
    authenticate,
    authorize('user', 'admin'),
    getAddress
);


Addressrouter.put(
    '/:id',
    authenticate,
    authorize('user', 'admin'),
    updateAddress
);



Addressrouter.delete(
    '/:id',
    authenticate,
    authorize('user',  'admin'),
    deleteAddress
);
  

Addressrouter.patch( 
    '/:id/set-default',
    authenticate,
    authorize('user',  'admin'),
    setDefaultAddress
);

export default Addressrouter;