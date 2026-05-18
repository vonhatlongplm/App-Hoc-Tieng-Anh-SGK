import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from "fs";
import os from "os";
import multer from "multer";

let genAI: GoogleGenerativeAI | null = null;
let fileManager: GoogleAIFileManager | null = null;

const upload = multer({ dest: os.tmpdir() });

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

  app.post("/api/upload", upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      const { name, mimeType } = req.body;

      if (!file) {
        return res.status(400).json({ error: "No file content" });
      }
      
      const fileManager = getFileManager();
      const uploadResult = await fileManager.uploadFile(file.path, {
        mimeType: mimeType || file.mimetype || 'application/pdf',
        displayName: (name || file.originalname || 'upload').slice(0, 40),
      });
      
      const { file: uploadedFile } = uploadResult;
      
      // Cleanup temp file
      if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
      }
      
      res.json({
        fileUri: uploadedFile.uri,
        mimeType: uploadedFile.mimeType || mimeType,
        name: name || file.originalname
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
