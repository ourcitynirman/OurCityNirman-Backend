import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 15, // Increased slightly for usability
  message: "Too many login attempts, please try again later",
  validate: { xForwardedForHeader: false }
});

export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 5, // 5 requests per 15 mins
  message: "Too many OTP requests, please try again later",
  validate: { xForwardedForHeader: false }
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per hour
  message: "Too many password reset requests, please try again later",
  validate: { xForwardedForHeader: false }
});
