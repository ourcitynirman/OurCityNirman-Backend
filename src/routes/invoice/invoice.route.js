import { Router } from "express";
import { 
    getMyInvoices, 
    getInvoiceByOrder, 
    downloadInvoice, 
    viewInvoice,
    resendInvoiceEmail
} from "../../controllers/invoice/invoice.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get("/my-invoices", getMyInvoices);
router.get("/order/:orderId", getInvoiceByOrder);
router.get("/:invoiceId/view", viewInvoice);
router.get("/:invoiceId/download", downloadInvoice);
router.post("/:invoiceId/resend-email", resendInvoiceEmail);

export default router;
