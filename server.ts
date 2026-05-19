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
    genAI = new GoogleGenerativeAI(key.trim());
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

  app.get("/api/health", (req, res) => {
    const key = process.env.GEMINI_API_KEY;
    res.json({ 
      status: "ok", 
      hasApiKey: !!key,
      keyPrefix: key ? key.substring(0, 6) : "none"
    });
  });

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
      
      // Wait for the file to be processed and become ACTIVE
      let fileStatus = uploadedFile;
      let attempts = 0;
      console.log(`File uploaded: ${uploadedFile.name}, status: ${uploadedFile.state}`);
      
      while ((fileStatus.state === 'PROCESSING' || fileStatus.state === 'STATE_UNSPECIFIED') && attempts < 15) {
        attempts++;
        const waitTime = Math.min(1000 * Math.pow(1.5, attempts), 5000); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, waitTime));
        fileStatus = await fileManager.getFile(uploadedFile.name);
        console.log(`Checking file status: ${fileStatus.name}, attempt ${attempts}, status: ${fileStatus.state}`);
      }

      if (fileStatus.state === 'FAILED') {
          throw new Error(`File processing failed: ${fileStatus.error?.message || "Unknown error"}`);
      }
      
      // Cleanup temp file
      if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
      }
      
      res.json({
        fileUri: fileStatus.uri,
        mimeType: fileStatus.mimeType || mimeType,
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
      console.log("Initializing Gemini model...");
      
      const model = ai.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        // In most SDK versions, systemInstruction works best as a simple string or a Content object
        systemInstruction: systemInstruction ? String(systemInstruction).substring(0, 30000) : undefined
      });
      
      const safetySettings = [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ] as any;

      console.log("Preparing contents for Gemini API...");
      const finalContents = contents.map((c: any) => ({
        role: c.role === 'model' ? 'model' : 'user',
        parts: (c.parts || []).filter((p: any) => p.text || p.inlineData || p.fileData).map((p: any) => {
          if (p.text !== undefined) return { text: String(p.text).trim() };
          if (p.inlineData) return { inlineData: p.inlineData };
          if (p.fileData) return { fileData: p.fileData };
          return p;
        })
      })).filter((c: any) => c.parts && c.parts.length > 0);

      if (finalContents.length === 0) {
        return res.status(400).json({ error: "No valid content to send to Gemini" });
      }

      console.log("Calling Gemini API generateContent...");
      const result = await model.generateContent({ 
        contents: finalContents,
        safetySettings
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
      // Try to extract a useful message for the client
      const errorMsg = err.response?.data?.error?.message || err.response?.error?.message || err.message || "Unknown generate error";
      res.status(500).json({ 
        error: errorMsg,
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
