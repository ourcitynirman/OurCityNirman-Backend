import { Router } from "express";
import { upload } from "../../middlewares/multer.middleware.js";
import { verifyJWT } from "../../middlewares/auth.middleware.js";
import {
    createShop,
    updateShop,
    deleteShop,
    deleteShopLogo,
    deleteShopBanner,
    toggleShopStatus,
    getMyShop,
    getAllShops,
    getShopById,
    getShopBySlug,
    getShopByCode,
    verifyShop,
    adminGetAllShops,
    adminGetShopStats,
    adminDeactivateShop,
   
    requestVerification,
    getMyVerificationStatus,
    adminGetVerificationRequests,
    adminGetVerificationDetail,
} from "../../controllers/shop.controller.js";

const ShopRouter = Router();

// ── Upload configs
const shopUpload = upload.fields([
    { name: "logo",   maxCount: 1 },
    { name: "banner", maxCount: 1 },
]);

//  Upload config for verification documents
const verificationUpload = upload.fields([
    { name: "gstDocument",   maxCount: 1 },
    { name: "panDocument",   maxCount: 1 },
    { name: "otherDocument", maxCount: 1 },
]);


// PUBLIC  

ShopRouter.get("/",               getAllShops);
ShopRouter.get("/slug/:slug",     getShopBySlug);
ShopRouter.get("/code/:shopCode", getShopByCode);



ShopRouter.use(verifyJWT);


ShopRouter.get  ("/admin/stats",                           adminGetShopStats);
ShopRouter.get  ("/admin/all",                             adminGetAllShops);


ShopRouter.get  ("/admin/verification-requests",           adminGetVerificationRequests);


ShopRouter.get  ("/admin/verification-requests/:shopId",   adminGetVerificationDetail);

ShopRouter.patch("/admin/:shopId/deactivate",              adminDeactivateShop);


ShopRouter.patch("/:shopId/verify",                        verifyShop);


ShopRouter.get ("/vendor/my",                              getMyShop);


ShopRouter.get ("/vendor/my/verification-status",          getMyVerificationStatus);


ShopRouter.post("/vendor/my/request-verification",         verificationUpload, requestVerification);

ShopRouter.post  ("/",                                     shopUpload, createShop);
ShopRouter.patch ("/update/:shopId",                       shopUpload, updateShop);
ShopRouter.delete("/delete/:shopId",                       deleteShop);
ShopRouter.delete("/:shopId/logo",                         deleteShopLogo);
ShopRouter.delete("/:shopId/banner",                       deleteShopBanner);
ShopRouter.patch ("/:shopId/toggle-status",                toggleShopStatus);


ShopRouter.get("/:shopId",                                 getShopById);

export default ShopRouter;