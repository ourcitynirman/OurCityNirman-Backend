/**
 * System roles enumeration
 */
export const ROLES = {
    USER: "user",
    VENDOR: "vendor",
    HOMEOWNER: "homeowner",
    WORKER: "Worker/Technician",
    OTHER: "Other",
    BUILDER: "builder",
    AGENT: "agent",
    ADMIN: "admin",
};

/**
 * Array of all valid roles for quick authorization
 */
export const ALL_ROLES = Object.values(ROLES);

/**
 * Common role groups
 */
export const STAFF_ROLES = [ROLES.ADMIN];
export const BUSINESS_ROLES = [ROLES.VENDOR, ROLES.BUILDER, ROLES.AGENT];
