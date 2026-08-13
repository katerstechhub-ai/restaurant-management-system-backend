const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// @route  GET /api/uploads/signature
// Admin only — hands the frontend a short-lived signature so it can upload
// directly to Cloudinary without the API secret ever touching the client.
const getUploadSignature = async (req, res) => {
    try {
        const timestamp = Math.round(Date.now() / 1000);
        const folder = 'restaurant-menu';

        const signature = cloudinary.utils.api_sign_request(
            { timestamp, folder },
            process.env.CLOUDINARY_API_SECRET
        );

        res.status(200).json({
            signature,
            timestamp,
            folder,
            apiKey: process.env.CLOUDINARY_API_KEY,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error generating upload signature', error: err.message });
    }
};

module.exports = { getUploadSignature };