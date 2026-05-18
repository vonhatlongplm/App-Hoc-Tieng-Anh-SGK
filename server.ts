import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import multer from "multer";
import fs from "fs";
import os from "os";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const upload = multer({ 
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB limit for PDFs
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "250mb" }));
  app.use(express.urlencoded({ limit: "250mb", extended: true }));

  app.post("/api/gemini/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Sanitize display name for Google GenAI Files API
      // Usually it prefers alphanumeric, dots, dashes, underscores
      let safeName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      if (!safeName || safeName.length < 3) safeName = `file_${Date.now()}`;

      const file = await ai.files.upload({
        file: req.file.path,
        config: {
          mimeType: req.file.mimetype,
          displayName: safeName.slice(0, 40), // Limit length
        }
      });
      
      // Cleanup temp file
      if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
      }
      
      res.json({
        fileUri: file.uri,
        mimeType: file.mimeType || req.file.mimetype,
        name: req.file.originalname
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ error: err.message || "Unknown upload error" });
    }
  });

  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { contents, systemInstruction } = req.body;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview", // Complex tutor tasks
        contents,
        config: {
          systemInstruction,
        }
      });

      res.json({ text: response.text });
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
