

import multer from "multer";
import fs from "fs";
import path from "path";
import logger from "../utils/logger.js";


const TEMP_DIR = "./public/temp";

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}


const MAX_FILE_SIZE_MB = 20; // Increased to 20MB for small videos/PDFs
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
        const ext        = path.extname(file.originalname).toLowerCase();
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, uniqueName);
    },
});


const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "video/mp4",
];

const fileFilter = (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, WEBP, GIF, PDF, and MP4 are allowed.`), false);
    }
};


export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE_BYTES
    }
});



export const cleanupTempFile = (filePath) => {
    if (!filePath) return;
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        logger.warn(`[Multer] Could not delete temp file "${filePath}":`, { error: err.message });
    }
};


export const cleanupTempFiles = (filePaths = []) => {
    filePaths.forEach((p) => cleanupTempFile(p));
};