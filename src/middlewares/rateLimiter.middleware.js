import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 15, // Increased slightly for usability
  message: "Too many login attempts, please try again later",
  validate: { xForwardedForHeader: false }
});
