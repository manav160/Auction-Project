const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage configuration for Auction Item Uploads
const auctionStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "auction-items",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    resource_type: "image",
    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
  }),
});

// Storage configuration for Profile Photo Uploads
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "profile-photos",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    resource_type: "image",
    transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
  }),
});

// File Filter
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, JPEG, PNG and WEBP images are allowed."), false);
  }
};

// Multer Middleware for Auction Items (Default export)
const uploadAuctionImage = multer({
  storage: auctionStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter,
});

// Multer Middleware for User Profile Photos
const uploadAvatarImage = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter,
});

module.exports = uploadAuctionImage;
module.exports.uploadAuctionImage = uploadAuctionImage;
module.exports.uploadAvatarImage = uploadAvatarImage;
module.exports.cloudinary = cloudinary;