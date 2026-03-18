import ApiError from "../../utils/ApiError.js";
import ApiResponse from "../../utils/ApiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

import {
  updateVendorProfileService,
  getVendorDashboardService,
  getVendorProfileService,
  createVendorProfileService,
  VendorVerificationService
} from "../../services/vendor.service.js";

import { uploadOnCloudinary } from "../../utils/cloudinary.js"




// dashboard
const getVendorDashboard = asyncHandler(async (req, res) => {
  console.log(" Vendor Dashboard Request");
  console.log("User ID:", req.user.id);

  const dashboard = await getVendorDashboardService(req.user.id);

  if (!dashboard) {
    console.error(" Vendor dashboard not found for user:", req.user.id);
    throw new ApiError(404, "Vendor profile not found");
  }

  console.log(" Vendor dashboard loaded");

  return res
    .status(200)
    .json(new ApiResponse(200, dashboard, "Vendor dashboard loaded"));
});




const getVendorProfile = asyncHandler(async (req, res) => {
  console.log("Get Vendor Profile Request");
  console.log("User ID:", req.user.id);

  const profile = await getVendorProfileService(req.user.id);

  if (!profile) {
    console.error(" Vendor profile not found for user:", req.user.id);
    throw new ApiError(404, "Vendor profile not found");
  }

  console.log(" Vendor profile fetched");

  return res
    .status(200)
    .json(new ApiResponse(200, profile, "Vendor profile fetched"));
});


//  update-profile 
const updateVendorProfile = asyncHandler(async (req, res) => {

  const payload = req.body;
  const userId = req.user.id;
  


  const updatedProfile = await updateVendorProfileService(
    userId,
    payload
  );

  console.log(" Vendor profile updated");
  console.log(updatedProfile);
  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedProfile, "Vendor profile updated successfully")
    );
});


// create-profile
const createVendorProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const payload = req.body;


    if (req.files?.avatar?.[0]) {
      const avatarResult = await uploadOnCloudinary(req.files.avatar[0].path);
      payload.avatar = avatarResult.secure_url || avatarResult.url;
      console.log("Avatar Uploaded:", payload.avatar);
    }

   
    if (req.files?.coverImage?.[0]) {
      const coverResult = await uploadOnCloudinary(req.files.coverImage[0].path);
      payload.coverImage = coverResult.secure_url || coverResult.url;
      console.log("Cover Image Uploaded:", payload.coverImage);
    }


    
    const vendorProfile = await createVendorProfileService(
      userId,
      payload
    );

    res.status(201).json({
      success: true,
      message: "Vendor profile created successfully",
      data: vendorProfile
    });

  } catch (error) {
    next(error);
  }
};



const VendorVerification = async (req, res, next) => {
  try {
    const userId = req.user._id;

    
    if (!req.file) {
      throw new ApiError(400, "Verification file is required");
    }

   
    const uploadResult = await uploadOnCloudinary(req.file.path);

    if (!uploadResult?.secure_url) {
      throw new ApiError(500, "File upload failed");
    }

   
    const verificationDocuments = [
      {
        type: "verification",
        url: uploadResult.secure_url
      }
    ];

    
    const payload = {


      gstNumber: req.body.gstNumber,
      panNumber: req.body.panNumber,
      verificationDocuments, 
      contactInfo: req.body.contactInfo,
      businessName: req.body.businessName,
      businessType: req.body.businessType,
      description: req.body.description,
      website: req.body.website,
      bankDetails: req.body.bankDetails

    };

    const result = await VendorVerificationService(userId, payload);

    res.status(200).json({
      success: true,
      message: "Vendor verification file uploaded successfully",
      data: result
    });

  } catch (error) {
    next(error);
  }
};



export {
  updateVendorProfile,
  getVendorDashboard,
  getVendorProfile,
  createVendorProfile,
  VendorVerification,
}