import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from "fs";
import os from "os";

let genAI: GoogleGenerativeAI | null = null;
let fileManager: GoogleAIFileManager | null = null;

const getGenAI = () => {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is missing");
    genAI = new GoogleGenerativeAI(key);
  }
  return genAI;
};

const getFileManager = () => {
  if (!fileManager) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is missing");
    fileManager = new GoogleAIFileManager(key);
  }
  return fileManager;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "500mb" }));
  app.use(express.urlencoded({ limit: "500mb", extended: true }));

  app.post("/api/upload", async (req, res) => {
    try {
      const { base64, mimeType, name } = req.body;
      if (!base64) {
        return res.status(400).json({ error: "No file content" });
      }
      
      const safeName = (name || 'upload').replace(/[^a-zA-Z0-9.-]/g, '_');
      const tmpFilePath = path.join(os.tmpdir(), `upload_${Date.now()}_${safeName}`);
      fs.writeFileSync(tmpFilePath, Buffer.from(base64, "base64"));

      const fileManager = getFileManager();
      const uploadResult = await fileManager.uploadFile(tmpFilePath, {
        mimeType: mimeType || 'application/pdf',
        displayName: safeName.slice(0, 40),
      });
      
      const { file } = uploadResult;
      
      // Cleanup temp file
      if (fs.existsSync(tmpFilePath)) {
          fs.unlinkSync(tmpFilePath);
      }
      
      res.json({
        fileUri: file.uri,
        mimeType: file.mimeType || mimeType,
        name
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ error: err.message || "Unknown upload error" });
    }
  });

  app.post("/api/generate", async (req, res) => {
    try {
      const { contents, systemInstruction } = req.body;
      
      const genAI = getGenAI();
      const model = genAI.getGenerativeModel({
        model: "gemini-3.1-pro-preview",
        systemInstruction,
      });

      const result = await model.generateContent({
          contents
      });

      res.json({ text: result.response.text() });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
