import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../../modules/auth/user.model.js";
import { ApiError } from "../utils/api.utils.js";
import Product from "../../modules/products/product.model.js";
import { ROLES } from "../constants/roles.js";
import logger from "../utils/logger.js";

const extractToken = (req) => {
  if (req.cookies?.accessToken) return req.cookies.accessToken;
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    if (token && token.split(".").length === 3) return token;
  }
  return null;
};

const decodeToken = (token, secret) => {
  try { return jwt.verify(token, secret); } catch (error) { return null; }
};

const extractUserId = (decoded) => {
  return decoded?.id || decoded?._id || decoded?.userId || decoded?.sub || null;
};

// verifyJWT (Manual error handling for debugging)
const verifyJWT = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ success: false, message: "Unauthorized — no token provided" });

    const decoded = decodeToken(token, process.env.ACCESS_TOKEN_SECRET);
    if (!decoded) return res.status(401).json({ success: false, message: "Invalid or expired token" });

    const userId = extractUserId(decoded);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return res.status(401).json({ success: false, message: "Invalid token payload" });

    const user = await User.findById(userId).select("-password -refreshToken");
    if (!user) return res.status(401).json({ success: false, message: "User not found" });
    if (!user.isActive) return res.status(403).json({ success: false, message: "Account is deactivated" });

    req.user = user;
    if (typeof next === 'function') {
        next();
    } else {
        console.error("[CRITICAL] next is not a function in verifyJWT");
        // We can't call next, but we can return OK if it's the last middleware? No.
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: "Authentication failed: " + error.message });
  }
};

const optionalJWT = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return next();

    const decoded = decodeToken(token, process.env.ACCESS_TOKEN_SECRET);
    if (!decoded) return next();

    const userId = extractUserId(decoded);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return next();

    const user = await User.findById(userId).select("-password -refreshToken");
    if (!user || !user.isActive) return next();

    req.user = user;
    next();
  } catch (error) {
    next();
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
        if (!roles.includes(req.user.role)) return res.status(403).json({ success: false, message: `Access denied. Required role: ${roles.join(" or ")}` });
        if (typeof next === 'function') {
            next();
        } else {
            console.error("[CRITICAL] next is not a function in authorize");
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: "Authorization error: " + err.message });
    }
  };
};

const authenticate = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ success: false, message: "Authorization token missing" });

  const decoded = decodeToken(token, process.env.ACCESS_TOKEN_SECRET);
  if (!decoded) return res.status(401).json({ success: false, message: "Invalid or expired token" });

  const userId = extractUserId(decoded);
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return res.status(401).json({ success: false, message: "Invalid token payload" });

  const user = await User.findById(userId).select("-password -refreshToken");
  if (!user) return res.status(401).json({ success: false, message: "User not found" });
  if (!user.isActive) return res.status(403).json({ success: false, message: "Account is deactivated" });

  req.user = user;
  next();
};

const protect = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ success: false, message: "Not authorized — no token provided" });

  const decoded = decodeToken(token, process.env.ACCESS_TOKEN_SECRET);
  if (!decoded) return res.status(401).json({ success: false, message: "Not authorized — invalid or expired token" });

  const userId = extractUserId(decoded);
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return res.status(401).json({ success: false, message: "Not authorized — invalid token payload" });

  const user = await User.findById(userId).select("-password -refreshToken");
  if (!user) return res.status(401).json({ success: false, message: "User not found" });
  if (user.isActive === false) return res.status(403).json({ success: false, message: "Account is deactivated" });

  req.user = user;
  next();
};

const isVendor = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
  if (req.user.role !== ROLES.VENDOR) return res.status(403).json({ success: false, message: "Access denied — vendor account required" });
  next();
};

const requireVerification = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
  if (!req.user.isVerified) return res.status(403).json({ success: false, message: "Account verification required" });
  next();
};

const checkOwnership = (param = "id", source = "params") => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
    if (req.user.role === ROLES.ADMIN) return next();
    const resourceOwnerId = req[source]?.[param];
    if (!resourceOwnerId) return res.status(400).json({ success: false, message: `Missing ${param}` });
    if (req.user._id?.toString() !== resourceOwnerId.toString()) return res.status(403).json({ success: false, message: "Access denied — not owner" });
    next();
  };
};

const verifyRefreshToken = async (req, res, next) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken || null;
  if (!token) return res.status(401).json({ success: false, message: "Refresh token required" });
  const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
  const userId = extractUserId(decoded);
  const user = await User.findById(userId).select("refreshToken isActive");
  if (!user) return res.status(401).json({ success: false, message: "User not found" });
  if (user.refreshToken !== token) return res.status(401).json({ success: false, message: "Refresh token mismatch" });
  req.user = { id: userId, _id: userId };
  next();
};

const verifyProductOwner = async (req, res, next) => {
  const { productId } = req.params;
  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });
  if (req.user._id?.toString() !== product.vendorId?.toString()) return res.status(403).json({ success: false, message: "Access denied — not owner" });
  req.product = product;
  next();
};

export {
  authenticate,
  requireVerification,
  checkOwnership,
  verifyRefreshToken,
  isVendor,
  verifyProductOwner,
  verifyJWT,
  optionalJWT,
  authorize,
  protect,
};
