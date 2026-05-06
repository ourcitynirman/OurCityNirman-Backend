import { z } from 'zod';

const addressTypeEnum = z.enum(['home', 'office', 'other']);

export const addAddressSchema = z.object({
    addressType: addressTypeEnum.optional().default('home'),
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100, 'Full name cannot exceed 100 characters').optional(),
    phone: z.string().trim().regex(/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number'),
    alternatePhone: z.string().trim().optional(),
    email: z.string().trim().email('Please provide a valid email address').optional().or(z.literal('')),
    line1: z.string().trim().max(200, 'Address line 1 cannot exceed 200 characters').optional(),
    line2: z.string().trim().max(200, 'Address line 2 cannot exceed 200 characters').optional().nullable(),
    landmark: z.string().trim().max(200, 'Landmark cannot exceed 200 characters').optional().nullable(),
    village: z.string().trim().max(100, 'Village cannot exceed 100 characters').optional().nullable(),
    city: z.string().trim().max(100, 'City name cannot exceed 100 characters').optional(),
    state: z.string().trim().max(100, 'State name cannot exceed 100 characters').optional(),
    pincode: z.string().trim().regex(/^[A-Z0-9\s\-]{3,10}$/i, 'Please provide a valid pincode').optional(),
    country: z.string().trim().max(100, 'Country name cannot exceed 100 characters').optional().default('India'),
    isDefault: z.boolean().optional(),
});

export const updateAddressSchema = addAddressSchema.partial();

export const bulkAddressSchema = z.object({
    addresses: z.array(addAddressSchema).min(1, 'addresses must be a non-empty array'),
});
