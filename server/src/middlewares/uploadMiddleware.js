/**
 * @file uploadMiddleware.js
 * @description Multer configuration for local file uploads.
 *
 * Why this file exists
 * --------------------
 * Centralises all file upload configuration so that storage backends can be swapped
 * (local disk → Cloudinary/S3) in a single place without touching route handlers.
 *
 * Current implementation: disk storage under /uploads/profile-pictures.
 * Future: swap `storage` for a multer-s3 or multer-cloudinary adapter.
 *
 * Security decisions
 * ------------------
 * - Strict MIME-type allowlist: only images are permitted.
 * - 2 MB file size limit prevents abuse.
 * - Files are renamed to <employeeId>-<timestamp>.<ext> to avoid collisions and
 *   path traversal attacks from user-supplied filenames.
 */

import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { AppError } from '../errors/AppError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Upload directory (relative to project root, not this file) ─────────────
const UPLOADS_ROOT = path.resolve(__dirname, '../../../uploads');
const PROFILE_PICTURES_DIR = path.join(UPLOADS_ROOT, 'profile-pictures');
const KNOWLEDGE_DOCUMENTS_DIR = path.join(UPLOADS_ROOT, 'documents');

// Ensure directories exist on startup
if (!fs.existsSync(PROFILE_PICTURES_DIR)) {
  fs.mkdirSync(PROFILE_PICTURES_DIR, { recursive: true });
}
if (!fs.existsSync(KNOWLEDGE_DOCUMENTS_DIR)) {
  fs.mkdirSync(KNOWLEDGE_DOCUMENTS_DIR, { recursive: true });
}

// ─── Allowed MIME types ──────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

// ─── Storage engine ──────────────────────────────────────────────────────────
const diskStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, PROFILE_PICTURES_DIR);
  },
  filename(req, file, cb) {
    const employeeId = req.params.employeeId || 'unknown';
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${employeeId}-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

// ─── File filter ──────────────────────────────────────────────────────────────
function imageFileFilter(_req, file, cb) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        400,
        'INVALID_FILE_TYPE',
        'Only JPEG, PNG, WebP, and GIF images are allowed.',
      ),
      false,
    );
  }
}

// ─── Configured multer instance ───────────────────────────────────────────────
export const uploadProfilePicture = multer({
  storage: diskStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
}).single('profilePicture');

/**
 * Express middleware wrapper that converts multer errors into AppErrors.
 */
export function handleProfilePictureUpload(req, res, next) {
  uploadProfilePicture(req, res, (err) => {
    if (!err) return next();
    if (err instanceof AppError) return next(err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(400, 'FILE_TOO_LARGE', 'Profile picture must be under 2 MB.'));
    }
    return next(new AppError(400, 'UPLOAD_ERROR', err.message || 'File upload failed.'));
  });
}

/**
 * Returns the public URL path for a saved profile picture.
 * @param {string} filename - The stored filename (from req.file.filename)
 * @returns {string} Public-facing URL path
 */
export function getProfilePictureUrl(filename) {
  return `/uploads/profile-pictures/${filename}`;
}

// ─── Knowledge document uploads (RAG sprint) ────────────────────────────────
//
// Same disk-storage-with-safe-filename pattern as profile pictures, but for
// HR policy documents. The AI service only ever receives a server-controlled
// absolute path built from this directory — never a client-supplied path —
// which is what closes the arbitrary-directory-read issue on the FastAPI
// side (see ai-service/app/rag/loaders/document_loader.py).

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/plain',
  'text/markdown',
]);
const ALLOWED_DOCUMENT_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md']);

/**
 * Generates a fresh Mongo ObjectId for the incoming document BEFORE multer
 * runs, so the physical filename can be tied to it (and so the controller
 * knows the documentId without a second round-trip).
 */
export function assignKnowledgeDocumentId(req, _res, next) {
  req.knowledgeDocumentId = new mongoose.Types.ObjectId();
  next();
}

const documentStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, KNOWLEDGE_DOCUMENTS_DIR);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${req.knowledgeDocumentId}${ext}`);
  },
});

function documentFileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype) && ALLOWED_DOCUMENT_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(
      new AppError(400, 'INVALID_FILE_TYPE', 'Only PDF, DOCX, TXT, and Markdown files are allowed.'),
      false,
    );
  }
}

export const uploadKnowledgeDocument = multer({
  storage: documentStorage,
  fileFilter: documentFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB — policy PDFs can be large
}).single('document');

export function handleKnowledgeDocumentUpload(req, res, next) {
  uploadKnowledgeDocument(req, res, (err) => {
    if (!err) return next();
    if (err instanceof AppError) return next(err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(400, 'FILE_TOO_LARGE', 'Document must be under 20 MB.'));
    }
    return next(new AppError(400, 'UPLOAD_ERROR', err.message || 'File upload failed.'));
  });
}

/** Absolute path on disk for a stored knowledge document (server-controlled, never client input). */
export function getKnowledgeDocumentAbsolutePath(relativeFilePath) {
  return path.join(UPLOADS_ROOT, relativeFilePath);
}

export { PROFILE_PICTURES_DIR, KNOWLEDGE_DOCUMENTS_DIR };
