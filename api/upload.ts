import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from "fs";
import os from "os";
import path from "path";

const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
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
    const { base64, mimeType, name } = req.body;
    if (!base64) return res.status(400).json({ error: "No file content" });
    
    // Sanitize the file name
    const safeName = (name || 'upload').replace(/[^a-zA-Z0-9.-]/g, '_');
    const tmpFilePath = path.join(os.tmpdir(), `up_${Date.now()}_${safeName.slice(-20)}`);
    
    fs.writeFileSync(tmpFilePath, Buffer.from(base64, "base64"));

    const uploadResult = await fileManager.uploadFile(tmpFilePath, {
      mimeType: mimeType || 'application/pdf',
      displayName: safeName.slice(0, 40),
    });
    
    const { file } = uploadResult;
    
    if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
    
    res.status(200).json({
      fileUri: file.uri,
      mimeType: file.mimeType || mimeType,
      name
    });

  } catch (err: any) {
    console.error("Vercel Upload Error:", err);
    res.status(500).json({ error: err.message || "Upload failed" });
  }
}
