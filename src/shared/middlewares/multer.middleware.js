

import multer from "multer";
import fs from "fs";
import path from "path";


const TEMP_DIR = "./public/temp";

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    // console.log(" Created temp upload folder:", TEMP_DIR);
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


const fileFilter = (req, file, cb) => {
    cb(null, true);
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
        console.warn(`[Multer] Could not delete temp file "${filePath}":`, err.message);
    }
};


export const cleanupTempFiles = (filePaths = []) => {
    filePaths.forEach((p) => cleanupTempFile(p));
};