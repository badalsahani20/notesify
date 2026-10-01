import crypto from "node:crypto";
import path from "node:path";
import mongoose from "mongoose";
import { PDFParse } from "pdf-parse";
import ChatAttachmentBundle from "../models/chatAttachmentBundle.model.js";

const MAX_FILES = 40;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_EXTRACTED_CHARS_PER_FILE = 100_000;
const MAX_MODEL_CONTEXT_CHARS = 12_000;

const getCloudinaryConfig = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    const error = new Error("Cloudinary server configuration is incomplete");
    error.statusCode = 503;
    throw error;
  }

  return { cloudName, apiKey, apiSecret };
};

const normalizeRelativePath = (value = "document.pdf") => {
  const normalized = String(value)
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120))
    .filter(Boolean)
    .join("/");

  return normalized || "document.pdf";
};

const isPdfFile = (file) => {
  const extension = path.extname(file.originalname || "").toLowerCase();
  return file.mimetype === "application/pdf" || extension === ".pdf";
};

const signCloudinaryParams = (params, apiSecret) => {
  const serialized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${serialized}${apiSecret}`)
    .digest("hex");
};

const uploadRawBufferToCloudinary = async ({
  buffer,
  filename,
  mimeType,
  folder,
  publicId,
  config,
}) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = { folder, public_id: publicId, timestamp };
  const formData = new FormData();

  formData.append("file", new Blob([buffer], { type: mimeType }), filename);
  formData.append("api_key", config.apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("folder", folder);
  formData.append("public_id", publicId);
  formData.append("signature", signCloudinaryParams(paramsToSign, config.apiSecret));

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/raw/upload`,
    { method: "POST", body: formData },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Cloudinary raw upload failed (${response.status}): ${body.slice(0, 240)}`);
  }

  const data = await response.json();
  if (!data.secure_url || !data.public_id) {
    throw new Error("Cloudinary raw upload returned incomplete metadata");
  }

  return {
    secureUrl: data.secure_url,
    publicId: data.public_id,
    resourceType: data.resource_type || "raw",
  };
};

const extractPdfText = async (buffer) => {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return String(result.text || "")
      .replace(/\u0000/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_EXTRACTED_CHARS_PER_FILE);
  } finally {
    await parser.destroy();
  }
};

const publicFile = (file) => ({
  originalName: file.originalName,
  relativePath: file.relativePath,
  mimeType: file.mimeType,
  bytes: file.bytes,
  cloudinaryUrl: file.cloudinaryUrl,
  extractedCharacters: file.extractedCharacters,
});

export const createChatAttachmentBundle = async ({
  files = [],
  userId,
  name = "Uploaded documents",
}) => {
  if (!Array.isArray(files) || files.length === 0) {
    const error = new Error("At least one PDF is required");
    error.statusCode = 400;
    throw error;
  }

  if (files.length > MAX_FILES) {
    const error = new Error(`You can upload up to ${MAX_FILES} PDFs at once`);
    error.statusCode = 400;
    throw error;
  }

  const totalBytes = files.reduce((total, file) => total + (file.size || 0), 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    const error = new Error("The selected folder is too large. Keep the total under 50 MB");
    error.statusCode = 413;
    throw error;
  }

  for (const file of files) {
    if (!isPdfFile(file)) {
      const error = new Error(`Only PDF files are supported: ${file.originalname}`);
      error.statusCode = 400;
      throw error;
    }
    if (file.size > MAX_FILE_BYTES) {
      const error = new Error(`PDF exceeds the 20 MB limit: ${file.originalname}`);
      error.statusCode = 413;
      throw error;
    }
  }

  const config = getCloudinaryConfig();
  const bundleId = new mongoose.Types.ObjectId();
  const cloudinaryFolder = `notesify/chat/${String(userId)}/${bundleId}`;
  const storedFiles = [];

  for (const [index, file] of files.entries()) {
    const relativePath = normalizeRelativePath(file.originalname);
    const extension = path.extname(relativePath).toLowerCase() || ".pdf";
    const baseName = path.basename(relativePath, extension).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "document";
    const publicId = `${String(index + 1).padStart(3, "0")}-${baseName}`;
    const extractedText = await extractPdfText(file.buffer);
    const uploaded = await uploadRawBufferToCloudinary({
      buffer: file.buffer,
      filename: path.basename(relativePath),
      mimeType: file.mimetype || "application/pdf",
      folder: cloudinaryFolder,
      publicId,
      config,
    });

    storedFiles.push({
      originalName: path.basename(relativePath),
      relativePath,
      mimeType: file.mimetype || "application/pdf",
      bytes: file.size,
      cloudinaryUrl: uploaded.secureUrl,
      cloudinaryPublicId: uploaded.publicId,
      resourceType: uploaded.resourceType,
      extractedText,
      extractedCharacters: extractedText.length,
    });
  }

  const bundle = await ChatAttachmentBundle.create({
    _id: bundleId,
    user: userId,
    name: String(name || "Uploaded documents").trim().slice(0, 120) || "Uploaded documents",
    kind: files.length === 1 ? "file" : "folder",
    files: storedFiles,
    totalBytes,
    extractedCharacters: storedFiles.reduce((total, file) => total + file.extractedCharacters, 0),
  });

  return {
    id: String(bundle._id),
    name: bundle.name,
    kind: bundle.kind,
    totalBytes: bundle.totalBytes,
    extractedCharacters: bundle.extractedCharacters,
    files: storedFiles.map(publicFile),
  };
};

export const buildChatAttachmentContext = async ({ bundleId, userId }) => {
  if (!bundleId) return "";

  if (!mongoose.isValidObjectId(bundleId)) {
    const error = new Error("Uploaded document folder was not found");
    error.statusCode = 404;
    throw error;
  }

  const bundle = await ChatAttachmentBundle.findOne({ _id: bundleId, user: userId }).lean();
  if (!bundle) {
    const error = new Error("Uploaded document folder was not found");
    error.statusCode = 404;
    throw error;
  }

  let remaining = MAX_MODEL_CONTEXT_CHARS;
  const sections = [`[ATTACHED DOCUMENT FOLDER: ${bundle.name}]`];

  for (const file of bundle.files || []) {
    if (remaining <= 0) break;
    const excerpt = String(file.extractedText || "").slice(0, Math.min(4_000, remaining));
    if (!excerpt) continue;

    sections.push(`\n--- ${file.relativePath} ---\n${excerpt}`);
    remaining -= excerpt.length;
  }

  if (sections.length === 1) {
    sections.push("\nNo extractable text was found. This may be a scanned/image-only PDF.");
  }

  return sections.join("\n").slice(0, MAX_MODEL_CONTEXT_CHARS);
};

export const getChatAttachmentBundleForUser = async ({ bundleId, userId }) => {
  if (!bundleId) return null;
  if (!mongoose.isValidObjectId(bundleId)) return null;

  const bundle = await ChatAttachmentBundle.findOne({ _id: bundleId, user: userId }).lean();
  if (!bundle) return null;

  return {
    id: String(bundle._id),
    name: bundle.name,
    kind: bundle.kind,
    totalBytes: bundle.totalBytes,
    extractedCharacters: bundle.extractedCharacters,
    files: (bundle.files || []).map(publicFile),
  };
};
