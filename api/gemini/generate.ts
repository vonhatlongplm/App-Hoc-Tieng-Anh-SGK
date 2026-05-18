import { GoogleGenAI } from "@google/genai";

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
      sizeLimit: '50mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { contents, systemInstruction } = req.body;
    
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
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
}
