import { Router } from 'express';
import {

    // Users
    getUsers,
    getUserById,
    blockUnblockUser,
    deleteUser,

    // Vendors
    getVendors,
    verifyVendor,
    blockVendor,

    // Products
    getAdminProducts,
    approveProduct,
    blockProduct,

    // Orders
    getAdminOrders,
    getAdminOrderById,
    overrideOrderStatus,

    // Dashboard
    getDashboardStats,
} from '../../controllers/admin/admin.controller.js';

import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

const AdminRouter = Router();


AdminRouter.use(authenticate);
AdminRouter.use(authorize('admin'));

//   Dashboard          
AdminRouter.get('/stats', getDashboardStats);

//   Users       
AdminRouter.get('/users', getUsers);
AdminRouter.get('/users/:id', getUserById);
AdminRouter.patch('/users/:id/block', blockUnblockUser);
AdminRouter.delete('/users/:id', deleteUser);

//   Vendors         
AdminRouter.get('/vendors', getVendors);
AdminRouter.patch('/vendors/:id/verify', verifyVendor);
AdminRouter.patch('/vendors/:id/block', blockVendor);

//   Products            
AdminRouter.get('/products', getAdminProducts);
AdminRouter.patch('/products/:id/approve', approveProduct);
AdminRouter.patch('/products/:id/block', blockProduct);

//   Orders        
AdminRouter.get('/orders', getAdminOrders);
AdminRouter.get('/orders/:id', getAdminOrderById);
AdminRouter.patch('/orders/:id/status', overrideOrderStatus);

export default AdminRouter;