"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const api_error_1 = require("../utils/api-error");
// Ensure base upload directory exists
const UPLOAD_ROOT = path_1.default.resolve(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(UPLOAD_ROOT)) {
    fs_1.default.mkdirSync(UPLOAD_ROOT, { recursive: true });
}
// Storage engine with tenant-isolated folders and randomized unique filenames
const storage = multer_1.default.diskStorage({
    destination: (req, _file, cb) => {
        const tenantId = req.tenantId || req.user?.schoolId || 'global';
        const tenantDir = path_1.default.join(UPLOAD_ROOT, tenantId);
        if (!fs_1.default.existsSync(tenantDir)) {
            fs_1.default.mkdirSync(tenantDir, { recursive: true });
        }
        cb(null, tenantDir);
    },
    filename: (_req, file, cb) => {
        const randomHex = crypto_1.default.randomBytes(16).toString('hex');
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${randomHex}${ext}`);
    },
});
// Allowed MIME types: images and PDF/documents
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const fileFilter = (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(api_error_1.ApiError.badRequest(`File format not allowed: ${file.mimetype}. Allowed formats: JPG, PNG, WEBP, PDF, DOCX`));
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 Megabytes limit
    },
    fileFilter,
});
