import React, { useState, useRef } from 'react';
import { Mic, Loader2 } from 'lucide-react';

interface AudioRecorderProps {
  onAudioRecorded: (blob: Blob) => void;
  isProcessing: boolean;
  disabled?: boolean;
}

const getRecordingMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/aac',
    'audio/wav'
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
};

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onAudioRecorded, isProcessing, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const toggleRecording = async () => {
    if (disabled || isProcessing) return;

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getRecordingMimeType();
      const recorderOptions = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const recordedMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: recordedMimeType });
        onAudioRecorded(blob);
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isProcessing ? (
        <button disabled className="p-3 rounded-full bg-slate-200 text-slate-500 cursor-not-allowed">
          <Loader2 className="w-5 h-5 animate-spin" />
        </button>
      ) : (
        <button 
          onClick={toggleRecording}
          disabled={disabled}
          className={`p-3 rounded-full transition-all duration-300 shadow-md flex items-center justify-center ${
            isRecording 
              ? 'bg-red-500 text-white ring-4 ring-red-200 animate-pulse' 
              : disabled
              ? 'bg-slate-300 text-white cursor-not-allowed'
              : 'bg-teal-600 text-white hover:bg-teal-700'
          }`}
          title={isRecording ? "Nhấn để dừng và gửi" : disabled ? "Chức năng ghi âm không khả dụng cho bài tập này" : "Nhấn để bắt đầu ghi âm"}
        >
          <Mic className={`w-5 h-5 ${isRecording ? 'animate-bounce' : ''}`} />
        </button>
      )}
    </div>
  );
};

export default AudioRecorder;