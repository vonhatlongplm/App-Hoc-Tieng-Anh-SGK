import React from 'react';
import { Section, LessonProgress } from '../types';
import { LESSON_DATA } from '../constants';
import { CheckCircle, PlayCircle, Eye } from 'lucide-react';

interface SyllabusViewProps {
  section: Section;
  progress: LessonProgress;
  onStartLesson: (lessonNumber: number) => void;
  onReviewLesson: (lessonNumber: number) => void;
}

const SyllabusView: React.FC<SyllabusViewProps> = ({ section, progress, onStartLesson, onReviewLesson }) => {
  const lessons = (LESSON_DATA as any)[section] || [];
  const totalLessons = lessons.length;
  const completedCount = Array.isArray(progress?.completedLessonNumbers) ? progress.completedLessonNumbers.length : 0;
  const progressPercentage = totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0;

  const getLessonStatus = (lessonNumber: number): 'completed' | 'not_started' => {
    return Array.isArray(progress?.completedLessonNumbers) && progress.completedLessonNumbers.includes(lessonNumber) ? 'completed' : 'not_started';
  };

  return (
    <div className="p-0 md:p-6 space-y-6 animate-in fade-in duration-500 h-full overflow-y-auto">
      <header className="mb-8 px-6 md:px-0">
        <h2 className="text-3xl font-bold text-slate-800 serif">{section}</h2>
        <p className="text-slate-500 mt-2">Chọn một bài học để bắt đầu hành trình chinh phục B2 của bạn.</p>
      </header>

      {/* Progress Bar */}
      <div className="px-6 md:px-0">
        <div className="flex justify-between mb-1">
            <span className="text-base font-medium text-teal-700">Tiến độ</span>
            <span className="text-sm font-medium text-teal-700">{completedCount} / {totalLessons} bài học</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2.5">
            <div className="bg-teal-600 h-2.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div>
        </div>
      </div>

      {/* Lesson List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-6 px-6 md:px-0">
        {lessons.map((lesson, index) => {
          const lessonNumber = index + 1;
          const status = getLessonStatus(lessonNumber);
          
          const isCompleted = status === 'completed';
          const Icon = isCompleted ? CheckCircle : PlayCircle;
          const iconColor = isCompleted ? 'text-green-500' : 'text-blue-500';
          
          const buttonText = isCompleted ? 'Ôn lại' : 'Bắt đầu';
          const ButtonIcon = isCompleted ? Eye : PlayCircle;
          const buttonClass = isCompleted ? 'bg-slate-600 text-white hover:bg-slate-700' : 'bg-blue-600 text-white hover:bg-blue-700';
          
          const borderColor = progress?.currentLesson === lessonNumber && !isCompleted ? 'border-blue-500 shadow-blue-100' : 'border-slate-200';


          return (
            <div key={lessonNumber} className={`bg-white rounded-xl border-2 p-5 flex flex-col justify-between shadow-sm transition-all duration-200 ${borderColor}`}>
              <div>
                <div className="flex items-center gap-3 mb-2">
                    <Icon className={iconColor} size={20} />
                    <span className="text-sm font-semibold text-slate-800">Bài {lessonNumber}</span>
                </div>
                <h4 className="font-bold text-slate-900">{lesson.title}</h4>
              </div>
              <button
                onClick={() => isCompleted ? onReviewLesson(lessonNumber) : onStartLesson(lessonNumber)}
                className={`w-full mt-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${buttonClass}`}
              >
                <ButtonIcon size={16} />
                {buttonText}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SyllabusView;