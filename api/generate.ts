import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

const getGenAI = () => {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not set. Please set it in your environment variables (e.g., Vercel Dashboard).");
    }
    genAI = new GoogleGenerativeAI(key);
  }
  return genAI;
};

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
    const { contents, systemInstruction } = req.body;
    
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-pro-preview",
      systemInstruction,
    });

    const result = await model.generateContent({
      contents
    });

    res.status(200).json({ text: result.response.text() });
  } catch (err: any) {
    console.error("Vercel Generate Error:", err);
    res.status(500).json({ error: err.message || "Generation failed" });
  }
}
