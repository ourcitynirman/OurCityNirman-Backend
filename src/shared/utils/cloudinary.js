import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadOnCloudinary = async (localFilePath, debug = false) => {
    if (!localFilePath) {
        return null;
    }

    try {
        if (debug) console.log("Uploading file to Cloudinary:", localFilePath);

        const result = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        });

        if (debug) {
            console.log(" Upload successful!");
            console.log(" URL:", result.secure_url);
            console.log(" Public ID:", result.public_id);
        }

        deleteLocalFile(localFilePath, debug);

        return {
            success: true,
            url: result.secure_url,
            public_id: result.public_id,
            raw: result
        };

    } catch (error) {
        console.error("Cloudinary Upload Error:", error.message);

        deleteLocalFile(localFilePath, debug);

        return {
            success: false,
            error: error.message
        };
    }
};


// Delete local file helper function
const deleteLocalFile = (filePath, debug = false) => {
    if (!filePath) return;
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            if (debug) console.log("Local file deleted successfully:", filePath);
        } else if (debug) {
            console.log("File not found, skipping deletion:", filePath);
        }
    } catch (err) {
        console.warn("Failed to delete local file:", filePath, "| Error:", err.message);
    }
};


// Delete file from Cloudinary
const deleteFromCloudinary = async (publicId, debug = false) => {
    if (!publicId) {
        console.error(" Error: No public_id provided for deletion.");
        return {
            success: false,
            error: "No public_id provided"
        };
    }

    try {
        if (debug) console.log(" Deleting file from Cloudinary:", publicId);

        const result = await cloudinary.uploader.destroy(publicId);

        if (debug) {
            console.log(" Deletion result:", result.result);
        }

        if (result.result === "ok" || result.result === "not found") {
            return {
                success: true,
                result: result.result,
                message: result.result === "ok" ? "File deleted successfully" : "File not found (may already be deleted)"
            };
        }

        return {
            success: false,
            result: result.result,
            error: "Failed to delete file"
        };

    } catch (error) {
        console.error(" Cloudinary Delete Error:", error.message);

        return {
            success: false,
            error: error.message
        };
    }
};



const uploadStream = (fileBuffer, resourceType = "auto") => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: resourceType },
            (error, result) => {
                if (result) {
                    resolve({
                        success: true,
                        url: result.secure_url,
                        public_id: result.public_id,
                        raw: result
                    });
                } else {
                    reject({
                        success: false,
                        error: error.message
                    });
                }
            }
        );
        stream.end(fileBuffer);
    });
};

export {
    uploadOnCloudinary,
    deleteFromCloudinary,
    uploadStream
};
