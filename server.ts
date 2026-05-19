import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from "fs";
import os from "os";
import multer from "multer";
import { GEMINI_MODEL } from "./constants";

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
      
      if (!contents || !Array.isArray(contents)) {
        return res.status(400).json({ error: "Invalid contents format" });
      }

      const ai = getGenAI();
      const model = ai.getGenerativeModel({ 
        model: GEMINI_MODEL.includes('gemini-') ? GEMINI_MODEL : 'gemini-1.5-flash',
        systemInstruction: systemInstruction || undefined
      });
      
      // Relax safety settings for educational purposes
      const safetySettings = [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ];

      const result = await model.generateContent({ 
        contents: contents.map((c: any) => ({
          role: c.role === 'model' ? 'model' : 'user',
          parts: c.parts.map((p: any) => {
            if (p.text) return { text: p.text };
            if (p.inlineData) return { inlineData: p.inlineData };
            if (p.fileData) return { fileData: p.fileData };
            return p;
          })
        })),
        safetySettings: safetySettings as any
      });
      
      const response = await result.response;
      
      // Handle safety or other finish reasons
      const candidate = response.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
         console.warn("AI Finish Reason:", candidate.finishReason);
         if (candidate.finishReason === 'SAFETY') {
            return res.json({ text: "⚠️ Nội dung này bị chặn bởi bộ lọc an toàn. Vui lòng thử lại với nội dung khác lành mạnh hơn." });
         }
      }

      const text = response.text();

      if (!text) {
        return res.json({ text: "Gia sư không thể đưa ra phản hồi lúc này. (Empty response)" });
      }

      res.json({ text });
    } catch (err: any) {
      console.error("Generate Error Detail:", err);
      res.status(500).json({ 
        error: err.message || "Unknown generate error",
        details: err.stack || ""
      });
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
