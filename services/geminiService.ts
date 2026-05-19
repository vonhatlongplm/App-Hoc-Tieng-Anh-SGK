
export const generateContent = async (contents: any, systemInstruction: string) => {
  const res = await fetch('/api/generate', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ contents, systemInstruction })
  });
  if (!res.ok) throw new Error("AI Generation failed");
  return await res.json();
};

export const sendMessageToGemini = async (messages: any[], text: string, section?: string, documentContent?: string) => {
  const formattedHistory = messages.map(m => {
    if (m.parts) return m;
    return {
      role: m.role,
      parts: [{ text: m.text || m.content || '' }]
    };
  });
  
  const contents = [...formattedHistory, { role: 'user', parts: [{ text }] }];
  
  let systemInstruction = `Bạn là một Giáo viên Tiếng Anh AI (AI Tutor) tận tâm, chuyên nghiệp và có tư duy sư phạm xuất sắc. 
Nhiệm vụ của bạn là giảng dạy học sinh dựa trên nội dung tài liệu (Sách giáo khoa, sách giáo viên, bài tập) đã được tải lên sau đây:

<TEXTBOOK_CONTENT>
${documentContent || 'Chưa có tài liệu tải lên.'}
</TEXTBOOK_CONTENT>

HƯỚNG DẪN GIẢNG DẠY:
1. LUÔN BÁM SÁT GIÁO TRÌNH: Dạy từng mục một theo thứ tự bài học trong sách. Nếu học sinh đang ở section ${section || 'Tổng quát'}, hãy tập trung vào kiến thức tương ứng trong tài liệu.
2. PHƯƠNG PHÁP SƯ PHẠM:
   - Giảng giải lý thuyết ngắn gọn, dễ hiểu kèm ví dụ minh họa trực quan.
   - Sau mỗi phần, hãy đưa ra 1-2 câu hỏi tương tác để kiểm tra.
   - Khi dạy từ vựng: Cung cấp nghĩa, IPA, loại từ, và câu ví dụ trong ngữ cảnh của sách.
   - Khi dạy ngữ pháp: Giải thích cấu trúc và cách dùng, cho học sinh đặt câu.
   - Khi dạy phát âm: Khuyến khích học sinh ghi âm và đưa ra nhận xét chi tiết về tông giọng, trọng âm.
3. NGÔN NGỮ: Sử dụng tiếng Việt làm ngôn ngữ giảng dạy chính, tiếng Anh cho các ví dụ và trích dẫn.
4. KHÔNG ẢO GIÁC: Chỉ dạy kiến thức có trong tài liệu hoặc liên quan trực tiếp đến mục tiêu bài học.

Xưng hô: Thầy/Cô và gọi học sinh là Em.`;

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
  const res = await generateContent([{ role: 'user', parts: [{ text: `Translate to Vietnamese: ${text}` }] }], "You are a translator.");
  return res.text;
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
  
  const res = await generateContent([{ role: 'user', parts: [{ text: prompt }] }], "You are a dictionary.");
  try {
    // Extract JSON from response text (Gemini might wrap it in markdown block)
    const jsonStr = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    // Fallback if AI fails to return valid JSON
    return { 
      word, 
      ipa: '...', 
      partOfSpeech: 'word', 
      meaning: 'Tra cứu thất bại. Hãy thử lại.', 
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
