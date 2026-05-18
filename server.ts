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

const upload = multer({ dest: os.tmpdir() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "250mb" }));
  app.use(express.urlencoded({ limit: "250mb", extended: true }));

  app.post("/api/gemini/upload", async (req, res) => {
    try {
      const { base64, mimeType, name } = req.body;
      if (!base64) {
        return res.status(400).json({ error: "No file content" });
      }
      
      const tmpFilePath = path.join(os.tmpdir(), `upload_${Date.now()}_${name}`);
      fs.writeFileSync(tmpFilePath, Buffer.from(base64, "base64"));

      const file = await ai.files.upload({
        file: tmpFilePath,
        config: {
          mimeType,
          displayName: name,
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
