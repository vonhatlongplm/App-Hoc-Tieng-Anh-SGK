import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import os from "os";
import path from "path";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '250mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64, mimeType, name } = req.body;
    if (!base64) {
      return res.status(400).json({ error: "No file content provided or format is not base64." });
    }
    
    // Sanitize the file name to avoid path traversal
    const safeName = (name || 'upload').replace(/[^a-zA-Z0-9.-]/g, '_');
    const tmpFilePath = path.join(os.tmpdir(), `upload_${Date.now()}_${safeName}`);
    
    // Write base64 to temp file
    fs.writeFileSync(tmpFilePath, Buffer.from(base64, "base64"));

    const file = await ai.files.upload({
      file: tmpFilePath,
      config: {
        mimeType,
        displayName: safeName,
      }
    });
    
    // Cleanup temp file
    fs.unlinkSync(tmpFilePath);
    
    res.json({
      fileUri: file.uri,
      mimeType: file.mimeType || mimeType,
      name
    });

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
