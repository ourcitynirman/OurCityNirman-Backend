
import express from "express";
import {
    addReview,
    updateReview,
    deleteReview,
    getProductReviews,
    getMyReviews,
    markHelpful,
    adminGetAllReviews,
    adminUpdateStatus,
} from "../controllers/review.Controller.js";

import { verifyJWT, authorize } from "../middlewares/auth.middleware.js";

import { upload } from "../middlewares/multer.middleware.js";

const reviewRouter = express.Router();

//  PUBLIC routes

reviewRouter.get("/product/:productId", getProductReviews);



reviewRouter.get("/my-reviews", verifyJWT, getMyReviews);

reviewRouter.get("/admin/all", verifyJWT, authorize("admin"), adminGetAllReviews);

reviewRouter.patch(
    "/admin/:reviewId/status",
    verifyJWT,
    authorize("admin"),
    adminUpdateStatus
);



reviewRouter.post(
    "/add",
    verifyJWT,
    upload.array("images", 5),
    addReview
);

reviewRouter.put(
    "/:reviewId",
    verifyJWT,
    upload.array("images", 5),
    updateReview
);

reviewRouter.delete("/:reviewId", verifyJWT, deleteReview);

reviewRouter.post("/:reviewId/helpful", verifyJWT, markHelpful);


export default reviewRouter;