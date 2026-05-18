import React from 'react';
import { LessonHistoryEntry } from '../types';
import { CheckCircle, History as HistoryIcon, Calendar } from 'lucide-react';

interface HistoryProps {
    history: LessonHistoryEntry[];
}

const History: React.FC<HistoryProps> = ({ history }) => {
    return (
        <div className="p-0 md:p-6 space-y-6 animate-in fade-in duration-500 h-full overflow-y-auto">
            <header className="mb-8 px-6 md:px-0">
                <h2 className="text-3xl font-bold text-slate-800 serif flex items-center gap-3">
                    <HistoryIcon className="text-teal-600"/>
                    Lịch sử Học tập
                </h2>
                <p className="text-slate-500 mt-2">Ghi nhận lại tất cả các cột mốc quan trọng trong hành trình chinh phục B2 của bạn.</p>
            </header>
            
            <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-slate-100 p-6">
                {history && history.length > 0 ? (
                    <div className="relative border-l-2 border-slate-200 ml-4">
                        {history.slice().sort((a,b) => b.completedOn - a.completedOn).map((entry, index) => (
                            <div key={index} className="mb-8 ml-8 relative">
                                <span className="absolute flex items-center justify-center w-8 h-8 bg-teal-100 rounded-full -left-12 ring-4 ring-white">
                                    <CheckCircle className="w-5 h-5 text-teal-600" />
                                </span>
                                <h3 className="flex items-center mb-1 text-lg font-semibold text-slate-900">
                                    {entry.section}
                                </h3>
                                <time className="block mb-2 text-sm font-normal leading-none text-slate-400 flex items-center gap-1.5">
                                    <Calendar size={14}/>
                                    Hoàn thành vào {new Date(entry.completedOn).toLocaleDateString('vi-VN')}
                                </time>
                                <p className="text-base font-normal text-slate-600">{entry.details}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 text-slate-500">
                        <HistoryIcon className="mx-auto mb-2 text-slate-400" size={32}/>
                        <p>Lịch sử học tập của bạn sẽ được ghi lại tại đây.</p>
                        <p className="text-sm">Hãy bắt đầu một bài học để tạo cột mốc đầu tiên!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default History;