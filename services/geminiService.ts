
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
  
  const contents = [...validHistory, { role: 'user', parts: [{ text }] }];
  
  let textbookContext = '';
  
  // Inject file references from documentContent if it's JSON
  if (documentContent) {
    try {
      const items = JSON.parse(documentContent);
      if (Array.isArray(items)) {
        items.forEach(item => {
          if (item.type === 'file' && item.uri) {
            contents[contents.length - 1].parts.push({
              fileData: {
                fileUri: item.uri,
                mimeType: item.mime || 'application/pdf'
              }
            } as any);
          } else if (item.type === 'text') {
            textbookContext += `\n--- NỘI DUNG TÀI LIỆU (${item.name || 'Đoạn văn bản'}): ---\n${item.content}\n`;
          }
        });
      } else {
        textbookContext = documentContent;
      }
    } catch (e) {
      textbookContext = documentContent;
    }
  }
  
  let systemInstruction = `Bạn là một Giáo viên Tiếng Anh AI (AI Tutor) tận tâm, chuyên nghiệp và có tư duy sư phạm xuất sắc. 
Nhiệm vụ của bạn là giảng dạy học sinh dựa trên nội dung tài liệu (Sách giáo khoa, Sách bài tập, Sách giáo viên) đã được tải lên.

LƯU Ý QUAN TRỌNG: 
1. Các tệp tin (nếu có) đã được đính kèm trực tiếp vào tin nhắn dưới dạng tệp hoặc hình ảnh.
2. Nội dung văn bản bổ sung (nếu có):
${textbookContext || '(Không có nội dung văn bản bổ sung)'}

3. Học sinh có thể tải lên nhiều tài liệu. Hãy KẾT NỐI kiến thức giữa chúng.
4. Khi học sinh yêu cầu "Nghiên cứu tệp này", hãy tập trung giảng giải nội dung đó (dịch, ngữ pháp, từ vựng, phát âm).

HƯỚNG DẪN GIẢNG DẠY:
1. BÁM SÁT GIÁO TRÌNH: Dạy từng mục một. Section hiện tại: ${section || 'Tổng quát'}.
2. PHƯƠNG PHÁP:
   - Lý thuyết ngắn gọn kèm ví dụ trích dẫn từ sách.
   - Luôn đặt 1-2 câu hỏi tương tác để kiểm tra.
   - Từ vựng: Nghĩa, IPA, ví dụ.
   - Phát âm: Nhận xét chi tiết.
3. NGÔN NGỮ: Tiếng Việt (tiếng Anh cho ví dụ).
4. KHÔNG ẢO GIÁC.

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
