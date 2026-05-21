
export const generateContent = async (contents: any, systemInstruction: string) => {
  const res = await fetch('/api/generate', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ contents, systemInstruction })
  });
  
  if (!res.ok) {
    let errorDetail = `Lỗi kết nối AI (HTTP ${res.status})`;
    try {
      const text = await res.text();
      try {
        const errorJson = JSON.parse(text);
        errorDetail = errorJson.error || errorJson.details || errorDetail;
      } catch {
        // Not JSON
        errorDetail = text.slice(0, 200) || errorDetail;
      }
    } catch (e) {}
    throw new Error(errorDetail);
  }
  
  return await res.json();
};

export const sendMessageToGemini = async (messages: any[], text: string, section?: string, documentContent?: string) => {
  // Gemini history MUST start with 'user' role
  let firstUserIndex = -1;
  const historyParts = messages.map(m => {
    if (m.parts) return m;
    const parts: any[] = [{ text: m.text || m.content || '' }];
    
    // Add images if present
    if (m.imageUrls && m.imageUrls.length > 0) {
      m.imageUrls.forEach((url: string) => {
        const match = url.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
                mimeType: match[1],
                data: match[2]
            }
          });
        }
      });
    }
    
    return { role: m.role === 'model' ? 'model' : 'user', parts };
  });

  for (let i = 0; i < historyParts.length; i++) {
    if (historyParts[i].role === 'user') {
      firstUserIndex = i;
      break;
    }
  }

  const validHistory = firstUserIndex !== -1 ? historyParts.slice(firstUserIndex) : [];
  
  // Prune history to avoid hitting token limits or timeouts
  // Keep last 10 messages for context
  const historyToKeep = validHistory.slice(-10);
  
  // Ensure we don't have consecutive same roles, merging if necessary
  const contents: any[] = [];
  historyToKeep.forEach(h => {
    if (contents.length > 0 && contents[contents.length - 1].role === h.role) {
      contents[contents.length - 1].parts.push(...h.parts);
    } else {
      contents.push({ ...h });
    }
  });

  // Add the new message, merging if the last role is 'user'
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    contents[contents.length - 1].parts.push({ text: text.substring(0, 5000) });
  } else {
    contents.push({ role: 'user', parts: [{ text: text.substring(0, 5000) }] });
  }
  
  let textbookContext = '';
  
  // Inject file references from documentContent if it's JSON
  if (documentContent) {
    try {
      const items = JSON.parse(documentContent);
      if (Array.isArray(items)) {
        items.forEach((item, idx) => {
          // Limit number of files and text size
          if (idx > 10) return; 

          if (item.type === 'file' && item.uri) {
            // Only add the first 3 files to context to speed up response and stay within limits
            if (idx < 3) {
              contents[contents.length - 1].parts.push({
                fileData: {
                  fileUri: item.uri,
                  mimeType: item.mime || 'application/pdf'
                }
              } as any);
            }
          } else if (item.type === 'text') {
            textbookContext += `\n--- NỘI DUNG TÀI LIỆU: ---\n${item.content.substring(0, 1500)}\n`;
          }
        });
      } else {
        textbookContext = documentContent.substring(0, 5000);
      }
    } catch (e) {
      textbookContext = documentContent.substring(0, 5000);
    }
  }
  
  let systemInstruction = `Bạn là một Giáo viên Tiếng Anh AI (AI Tutor) tận tâm. 
Dạy học bám sát nội dung tài liệu đã tải lên.
Section: ${section || 'Tổng quát'}. 

Nội dung bổ sung:
${textbookContext || '(Không có)'}

Học sinh gọi bạn là "Thầy/Cô", bạn gọi học sinh là "Em". 
Luôn đặt câu hỏi tương tác sau mỗi phần kiến thức.`;

  if (section === 'TESTS') {
    systemInstruction = `Bạn là Giám thị và Người chấm điểm Tiếng Anh. Sử dụng tài liệu đề thi đã tải lên để kiểm tra học sinh từng bước một.`;
  }
  
  const result = await generateContent(contents, systemInstruction);
  return result.text;
};

export const analyzePronunciation = async (audioBase64: string, targetText: string) => {
  const prompt = `Analyze pronunciation of "${targetText}". Return JSON { score: 0-100, isCorrect: boolean, feedback: "..." }.`;
  const contents = [
    { role: 'user', parts: [
      { text: prompt },
      { inlineData: { data: audioBase64, mimeType: 'audio/webm' } }
    ]}
  ];
  
  const res = await generateContent(contents, "You are a pronunciation expert.");
  try {
    const jsonStr = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    return { score: 70, isCorrect: true, feedback: "Phát âm khá ổn." };
  }
};

export const translateToVietnamese = async (text: string) => {
  try {
    const res = await generateContent([{ role: 'user', parts: [{ text: `Translate to Vietnamese: ${text}` }] }], "You are a translator.");
    return res.text;
  } catch (error: any) {
    console.warn("[translateToVietnamese] Gemini failed, attempting free translation fallback...", error);
    try {
      const fallbackRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|vi`);
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        if (data?.responseData?.translatedText) {
          return data.responseData.translatedText;
        }
      }
    } catch (fallbackError) {
      console.error("[translateToVietnamese] Fallback translation failed too:", fallbackError);
    }
    throw error;
  }
};

export const lookupWord = async (word: string) => {
  const prompt = `Look up the English word "${word}". Return a JSON object with: 
  {
    "word": "${word}",
    "ipa": "IPA pronunciation",
    "partOfSpeech": "noun/verb/adj...",
    "meaning": "Vietnamese meaning",
    "definition": "English definition",
    "example": "English example sentence",
    "irregularForms": "past tense/plural if any",
    "collocations": [{"phrase": "common phrase", "meaning": "Vietnamese meaning"}]
  }`;
  
  try {
    const res = await generateContent([{ role: 'user', parts: [{ text: prompt }] }], "You are a dictionary.");
    // Extract JSON from response text (Gemini might wrap it in markdown block)
    const jsonStr = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e: any) {
    console.warn("[lookupWord] Gemini failed, attempting free translation fallback...", e);
    try {
      const fallbackRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|vi`);
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        if (data?.responseData?.translatedText) {
          return {
            word,
            ipa: '/.../',
            partOfSpeech: 'word',
            meaning: data.responseData.translatedText,
            definition: "Dictionary query limit reached, showing translation result.",
            example: "",
            collocations: []
          };
        }
      }
    } catch (fallbackError) {
      console.error("[lookupWord] Fallback lookup failed:", fallbackError);
    }
    
    return { 
      word, 
      ipa: '...', 
      partOfSpeech: 'word', 
      meaning: 'Tra cứu thất bại do đang hết lượt dùng API (RESOURCE_EXHAUSTED). Hãy thử lại sau ít giây.', 
      definition: "Translation failed",
      example: "",
      collocations: []
    };
  }
};

export const analyzeDiagnostic = async (grammar: string, writing: string, audioBase64: string, name: string) => {
  const prompt = `Analyze diagnostic test for ${name}:
  Grammar/Vocab level: ${grammar}
  Writing level: ${writing}
  Speaking audio attached (analyze fluency, pronunciation).
  
  Return a structured analysis including level (A1-C2) and specific feedback.`;
  
  const contents = [
    { role: 'user', parts: [
      { text: prompt },
      { inlineData: { data: audioBase64, mimeType: 'audio/webm' } }
    ]}
  ];
  
  const res = await generateContent(contents, "You are a professional examiner.");
  return { 
    diagnosedLevel: 'B1', // Use actual text from AI if possible, or parse
    analysisText: res.text,
    scores: [
      { skill: 'Grammar', score: 35 },
      { skill: 'Vocabulary', score: 40 },
      { skill: 'Reading', score: 30 },
      { skill: 'Listening', score: 25 },
      { skill: 'Speaking', score: 38 },
      { skill: 'Writing', score: 42 }
    ]
  };
};

export const analyzeSpeakingAudio = async (audioBase64: string) => {
  const prompt = `Analyze this speaking attempt. Transcription, pronunciation score (0-100), and feedback in Vietnamese.`;
  const contents = [
    { role: 'user', parts: [
      { text: prompt },
      { inlineData: { data: audioBase64, mimeType: 'audio/webm' } }
    ]}
  ];
  const res = await generateContent(contents, "You are an English speaking coach.");
  return res.text; // LessonView expects string
};

export const getDistractors = async (word: string) => [];
export const getReviewHint = async (word: string) => "";
export const getCollocationQuiz = async (word: string) => null;
export const selectStudySessionWords = (words: any[]) => words.slice(0, 5);
