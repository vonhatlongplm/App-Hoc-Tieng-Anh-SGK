import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from "fs";
import os from "os";
import path from "path";
import multer from "multer";

let fileManager: GoogleAIFileManager | null = null;

const upload = multer({ dest: os.tmpdir() });

// Helper to run middleware
function runMiddleware(req: any, res: any, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

const getFileManager = () => {
  if (!fileManager) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not set. Please set it in your environment variables (e.g., Vercel Dashboard).");
    }
    fileManager = new GoogleAIFileManager(key);
  }
  return fileManager;
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Run multer middleware
    await runMiddleware(req, res, upload.single('file'));
    
    const file = req.file;
    const { name, mimeType } = req.body;
    
    if (!file) return res.status(400).json({ error: "No file content" });
    
    const fileManager = getFileManager();
    const uploadResult = await fileManager.uploadFile(file.path, {
      mimeType: mimeType || file.mimetype || 'application/pdf',
      displayName: (name || file.originalname || 'upload').slice(0, 40),
    });
    
    const { file: uploadedFile } = uploadResult;
    
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    
    res.status(200).json({
      fileUri: uploadedFile.uri,
      mimeType: uploadedFile.mimeType || mimeType,
      name: name || file.originalname
    });

  } catch (err: any) {
    console.error("Vercel Upload Error:", err);
    res.status(500).json({ error: err.message || "Upload failed" });
  }
}
