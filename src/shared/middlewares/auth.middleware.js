import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../../modules/auth/user.model.js";
import { ApiError, asyncHandler } from "../utils/api.utils.js";
import Product from "../../modules/products/product.model.js";
import { ROLES } from "../constants/roles.js";

const extractToken = (req) => {
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    if (token && token.split(".").length === 3) {
      return token;
    }
  }

  return null;
};

const decodeToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
};

const extractUserId = (decoded) => {
  return decoded?.id || decoded?._id || decoded?.userId || decoded?.sub || null;
};

// verifyJWT 
const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized — no token provided" });
    }

    const decoded = decodeToken(token, process.env.ACCESS_TOKEN_SECRET);

    if (!decoded) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired token" });
    }

    const userId = extractUserId(decoded);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid token payload" });
    }

    const user = await User.findById(userId).select("-password -refreshToken");

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json({ success: false, message: "Account is deactivated" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("verifyJWT error:", error.message);
    return res
      .status(401)
      .json({ success: false, message: "Authentication failed" });
  }
});

const optionalJWT = asyncHandler(async (req, res, next) => {
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
});

// authenticate 
const authenticate = asyncHandler(async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return next(new ApiError(401, "Authorization token missing"));
    }

    const decoded = decodeToken(token, process.env.ACCESS_TOKEN_SECRET);

    if (!decoded) {
      return next(new ApiError(401, "Invalid or expired token"));
    }

    const userId = extractUserId(decoded);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return next(new ApiError(401, "Invalid token payload — userId missing"));
    }

    const user = await User.findById(userId).select("-password -refreshToken");

    if (!user) {
      return next(new ApiError(401, "User not found"));
    }

    if (!user.isActive) {
      return next(new ApiError(403, "Account is deactivated"));
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("authenticate error:", error.message);
    return next(new ApiError(401, "Authentication failed"));
  }
  
});

// protect 
const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    throw new ApiError(401, "Not authorized — no token provided");
  }

  const decoded = decodeToken(token, process.env.ACCESS_TOKEN_SECRET);

  if (!decoded) {
    throw new ApiError(401, "Not authorized — invalid or expired token");
  }

  const userId = extractUserId(decoded);

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(401, "Not authorized — invalid token payload");
  }

  const user = await User.findById(userId).select("-password -refreshToken");

  if (!user) throw new ApiError(401, "User not found");
  if (user.isActive === false) throw new ApiError(403, "Account is deactivated");

  req.user = user;
  next();
});

// authorize 
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `Access denied. Required role: ${roles.join(" or ")}`));
    }
    next();
  };
};

// isVendor
const isVendor = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, "Authentication required"));
  }
  if (req.user.role !== ROLES.VENDOR) {
    return next(new ApiError(403, "Access denied — vendor account required"));
  }
  next();
};

// requireVerification
const requireVerification = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, "Authentication required"));
  }
  if (!req.user.isVerified) {
    return next(
      new ApiError(
        403,
        "Account verification required. Please verify your email or phone first."
      )
    );
  }
  next();
};

// checkOwnership 
const checkOwnership = (param = "id", source = "params") => {
  const allowedSources = ["params", "body", "query"];

  if (!allowedSources.includes(source)) {
    throw new Error(`Invalid source. Use: ${allowedSources.join(", ")}`);
  }

  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }

    if (req.user.role === ROLES.ADMIN) return next();

    const resourceOwnerId = req[source]?.[param];

    if (!resourceOwnerId) {
      return next(new ApiError(400, `Missing ${param} in ${source}`));
    }

    if (!mongoose.Types.ObjectId.isValid(resourceOwnerId)) {
      return next(new ApiError(400, "Invalid resource owner ID format"));
    }

    const reqUserId = req.user._id?.toString() || req.user.id?.toString();

    if (reqUserId !== resourceOwnerId.toString()) {
      return next(
        new ApiError(403, "Access denied — you can only access your own resources")
      );
    }

    next();
  };
};

// verifyRefreshToken 
const verifyRefreshToken = asyncHandler(async (req, res, next) => {
  try {
    const token =
      req.cookies?.refreshToken || req.body?.refreshToken || null;

    if (!token) {
      return next(new ApiError(401, "Refresh token required"));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return next(new ApiError(401, "Refresh token expired, please login again"));
      }
      return next(new ApiError(401, "Invalid refresh token"));
    }

    const userId = extractUserId(decoded);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return next(new ApiError(401, "Invalid refresh token payload"));
    }

    const user = await User.findById(userId).select("refreshToken isActive");

    if (!user) return next(new ApiError(401, "User not found"));
    if (!user.isActive) return next(new ApiError(403, "Account is deactivated"));

    if (user.refreshToken !== token) {
      return next(new ApiError(401, "Refresh token mismatch — please login again"));
    }

    req.user = { id: userId, _id: userId };
    next();
  } catch (error) {
    console.error("verifyRefreshToken error:", error.message);
    return next(new ApiError(500, "Token verification failed"));
  }
});

// verifyProductOwner 
const verifyProductOwner = asyncHandler(async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return next(new ApiError(400, "Invalid product ID format"));
    }

    const product = await Product.findById(productId);
    if (!product) return next(new ApiError(404, "Product not found"));

    const reqUserId = req.user._id?.toString() || req.user.id?.toString();
    const productOwnerId = product.vendorId?.toString();

    if (reqUserId !== productOwnerId) {
      return next(new ApiError(403, "Access denied — you are not the owner of this product"));
    }

    req.product = product;
    next();
  } catch (err) {
    console.error("verifyProductOwner error:", err.message);
    return next(new ApiError(500, "Internal Server Error"));
  }
});


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
