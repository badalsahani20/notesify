import crypto from "node:crypto";

/**
 * Uploads a base64 image (or data URL) to Cloudinary from the backend.
 * If the input is already a hosted URL (http/https), returns it as-is.
 * 
 * @param {string} base64OrUrl
 * @returns {Promise<string|null>} Cloudinary secure_url or original url
 */
export const uploadImageToCloudinary = async (base64OrUrl) => {
  if (!base64OrUrl || typeof base64OrUrl !== "string") return null;

  // Already a hosted web URL
  if (/^https?:\/\//i.test(base64OrUrl)) {
    return base64OrUrl;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName) {
    console.warn("⚠️ [Cloudinary] CLOUDINARY_CLOUD_NAME is not configured");
    return base64OrUrl;
  }

  const formData = new FormData();
  formData.append("file", base64OrUrl);

  if (apiSecret && apiKey) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHash("sha1")
      .update(`timestamp=${timestamp}${apiSecret}`)
      .digest("hex");

    formData.append("api_key", apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);
  } else if (preset) {
    formData.append("upload_preset", preset);
  }

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.warn(
        `⚠️ [Cloudinary] Backend upload returned status ${response.status}: ${errBody.slice(0, 200)}`,
      );
      return base64OrUrl;
    }

    const data = await response.json();
    if (data.secure_url) {
      console.log(`☁️ [Cloudinary] Successfully uploaded image to ${data.secure_url}`);
      return data.secure_url;
    }

    return base64OrUrl;
  } catch (error) {
    console.error("❌ [Cloudinary] Backend upload error:", error.message);
    return base64OrUrl;
  }
};
