import { Router } from "express";
const router = Router();
import { createPaymentOrder, verifyPayment, handleWebhook, initiateOrderRefund, retryPayment, getPaymentByOrder } from "../controllers/payment.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";


router.post("/webhook", (req, res, next) => {
   
    if (Buffer.isBuffer(req.body)) {
        req.rawBody = req.body;
        try {
            req.body = JSON.parse(req.body.toString());
        } catch (e) {
            return res.status(400).json({ message: "Invalid JSON in webhook" });
        }
    }
    next();
}, handleWebhook);


router.post(
    "/create-order",
    authenticate,
    authorize("user", "vendor", "homeowner", "Worker/Technician", "Other", "builder", "agent", "admin"),
    createPaymentOrder
);

router.post(
    "/verify",
    authenticate,
    authorize("user", "vendor", "homeowner", "Worker/Technician", "Other", "builder", "agent", "admin"),
    verifyPayment
);

router.post(
    "/retry",
    authenticate,
    authorize("user", "vendor", "homeowner", "Worker/Technician", "Other", "builder", "agent", "admin"),
    retryPayment
);

router.get(
    "/:orderId",
    authenticate,
    authorize("user", "vendor", "homeowner", "Worker/Technician", "Other", "builder", "agent", "admin"),
    getPaymentByOrder
);

router.post(
    "/:orderId/refund",
    authenticate,
    authorize("admin"),
    initiateOrderRefund
);

export default router;