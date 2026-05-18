
import React, { useState, useEffect } from 'react';
import { StudentProfile as StudentProfileData } from '../services/storageService';
import { Loader2, Users, ArrowLeft, BookOpen, Star, Lightbulb, RefreshCw, MessageSquareWarning, ChevronRight } from 'lucide-react';
import { Section, LessonProgress, UserProgress, VocabularyWord, CorrectionEntry } from '../types';
import { createInitialDetailedProgress } from '../constants';
import { supabase } from '../services/supabaseClient';

// The dashboard now works with a more detailed profile type after processing.
export interface ProcessedStudentProfile {
    id: string;
    name: string;
    email: string;
    level: 'A2' | 'B1' | 'B2' | 'C' | 'Undiagnosed';
    masteredWords: number;
    lastActivityTimestamp: number;
    detailedProgress: UserProgress['detailedProgress'];
    hintUsageCount: number;
    vocabulary: VocabularyWord[];
    errorLog: CorrectionEntry[];
}


const SkillProgressCard: React.FC<{ section: Section, progress: ProcessedStudentProfile['detailedProgress'], totalLessons: number }> = ({ section, progress, totalLessons }) => {
    const sectionProgress = progress[section];
    if (!sectionProgress) return null;

    const percentage = Math.round((sectionProgress.completedLessons.length / totalLessons) * 100);
    const color = percentage > 66 ? 'bg-green-500' : percentage > 33 ? 'bg-blue-500' : 'bg-amber-500';

    return (
        <div className="bg-slate-50 p-4 rounded-lg">
            <h5 className="font-bold text-slate-800">{section}</h5>
            <p className="text-sm text-slate-500 mb-2">Bài học gần nhất: <span className="font-semibold text-teal-700">{sectionProgress.currentLesson}</span></p>
            <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">Tiến độ</span>
                <span className="text-sm font-medium text-slate-500">{sectionProgress.completedLessons.length}/{totalLessons} ({percentage}%)</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5">
                <div className={`${color} h-2.5 rounded-full`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const StudentDetailView: React.FC<{ profile: ProcessedStudentProfile, onBack: () => void }> = ({ profile, onBack }) => {
    const sectionsWithLessons = [Section.GRAMMAR, Section.VOCABULARY, Section.LISTENING, Section.READING, Section.WRITING, Section.SPEAKING];

    return (
        <div className="p-6 animate-in fade-in duration-300 h-full overflow-y-auto">
            <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 font-semibold mb-6">
                <ArrowLeft size={16} /> Quay lại Danh sách Lớp
            </button>
            <header className="mb-8 flex justify-between items-start">
                <div>
                    <h3 className="text-2xl font-bold text-slate-800 serif">{profile.name}</h3>
                    <p className="text-slate-500">{profile.email}</p>
                </div>
                <div className="text-right">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Trình độ hiện tại</span>
                    <div className="text-3xl font-black text-teal-600">{profile.level}</div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Progress Area */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h4 className="text-lg font-semibold mb-4 text-slate-700 flex items-center gap-2"><BookOpen size={20}/> Tiến độ Giáo trình</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {sectionsWithLessons.map(section => (
                               <SkillProgressCard key={section} section={section} progress={profile.detailedProgress} totalLessons={30} />
                           ))}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h4 className="text-lg font-semibold mb-4 text-slate-700 flex items-center gap-2"><MessageSquareWarning size={20}/> Phân tích Lỗi sai & Nâng cấp (Sổ tay Sửa lỗi)</h4>
                        {profile.errorLog && profile.errorLog.length > 0 ? (
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                                {profile.errorLog.map(log => (
                                    <div key={log.id} className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                        <div className="flex justify-between mb-2">
                                            <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded">{log.section}</span>
                                            <span className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleDateString('vi-VN')}</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <p className="text-xs font-bold text-red-500 uppercase mb-1">Lỗi của HS:</p>
                                                <p className="text-slate-600 italic">"{log.original}"</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-green-600 uppercase mb-1">Gợi ý nâng cấp:</p>
                                                <p className="font-semibold text-slate-800">"{log.upgraded}"</p>
                                            </div>
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-slate-200">
                                             <p className="text-xs text-slate-500"><span className="font-bold">Giải thích:</span> {log.explanation}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-slate-500 text-sm text-center py-6">Học sinh chưa có bản ghi sửa lỗi nào.</p>
                        )}
                    </div>
                </div>

                {/* Sidebar Stats Area */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h4 className="text-lg font-semibold mb-4 text-slate-700 flex items-center gap-2"><Star size={20}/> Từ vựng đã lưu ({profile.vocabulary.length})</h4>
                        {profile.vocabulary.length > 0 ? (
                            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                                {profile.vocabulary.map(word => (
                                    <span key={word.word} className="px-3 py-1 text-sm rounded-full bg-slate-100 text-slate-800 font-medium ring-1 ring-slate-200">
                                        {word.word}
                                    </span>
                                ))}
                            </div>
                        ) : (<p className="text-slate-500 text-sm text-center py-2">Học sinh chưa lưu từ vựng nào.</p>)}
                    </div>
                     <div className="bg-blue-50 p-6 rounded-xl shadow-sm border border-blue-100">
                        <h4 className="text-lg font-semibold mb-2 text-blue-800 flex items-center gap-2"><Lightbulb size={20}/> Số lần dùng Gợi ý</h4>
                        <p className="text-3xl font-bold text-blue-900">{profile.hintUsageCount}</p>
                        <p className="text-xs text-blue-600 mt-1">Chỉ số này phản ánh mức độ tự lực của HS.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};


const AdminDashboard: React.FC = () => {
    const [profiles, setProfiles] = useState<ProcessedStudentProfile[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<ProcessedStudentProfile | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const processStudentData = (data: any[]): ProcessedStudentProfile[] => {
        return data.map(item => {
            const profile = item.profile_data as StudentProfileData;
            
            // Safety check: if profile data is missing or malformed, return a default structure
            if (!profile || typeof profile !== 'object') {
                return {
                    id: item.user_id,
                    name: item.user_id.split('@')[0],
                    email: item.user_id,
                    level: 'Undiagnosed' as const,
                    masteredWords: 0,
                    lastActivityTimestamp: new Date(item.updated_at).getTime(),
                    detailedProgress: createInitialDetailedProgress(),
                    hintUsageCount: 0,
                    vocabulary: [],
                    errorLog: [],
                };
            }

            return {
                id: item.user_id,
                name: profile.progress?.userName || item.user_id.split('@')[0],
                email: item.user_id,
                level: (profile.progress?.diagnosedLevel as ProcessedStudentProfile['level']) || ('Undiagnosed' as const),
                masteredWords: profile.vocabulary?.filter((v: VocabularyWord) => v.masteryLevel === 3).length || 0,
                lastActivityTimestamp: new Date(item.updated_at).getTime(),
                detailedProgress: profile.progress?.detailedProgress || createInitialDetailedProgress(),
                hintUsageCount: profile.progress?.hintUsageCount || 0,
                vocabulary: profile.vocabulary || [],
                errorLog: profile.progress?.errorLog || [],
            };
        }).sort((a, b) => b.lastActivityTimestamp - a.lastActivityTimestamp);
    };
    
    const fetchStudentData = async () => {
        if (!supabase) {
            setError("Chức năng quản lý lớp học yêu cầu kết nối đám mây. Vui lòng cấu hình Supabase.");
            return;
        }
        setIsSyncing(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('user_id, profile_data, updated_at');
            
            if (error) {
                console.error("Supabase fetch error:", error);
                setError("Không thể tải dữ liệu lớp học. " + error.message);
            } else if (data) {
                setProfiles(processStudentData(data));
            }
        } catch (err: any) {
            setError("Lỗi kết nối đám mây: " + err.message);
        } finally {
            setIsSyncing(false);
        }
    };
    
    useEffect(() => {
        fetchStudentData();
    }, []);
    
    const getLevelBadge = (level: string) => {
        switch (level) {
            case 'C': return 'bg-purple-100 text-purple-800';
            case 'B2': return 'bg-green-100 text-green-800';
            case 'B1': return 'bg-blue-100 text-blue-800';
            case 'A2': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-slate-100 text-slate-800';
        }
    };
    
    if (selectedProfile) {
        return <StudentDetailView profile={selectedProfile} onBack={() => setSelectedProfile(null)} />;
    }

    return (
        <div className="p-0 md:p-6 space-y-6 animate-in fade-in duration-500 h-full overflow-y-auto relative">
            <header className="mb-8 px-6 md:px-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 serif">Bảng Quản lý Lớp học</h2>
                    <p className="text-slate-500 mt-2">Dữ liệu được đồng bộ hóa trực tiếp từ đám mây Supabase.</p>
                </div>
                 <button 
                    onClick={fetchStudentData}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors disabled:bg-slate-400"
                    title="Làm mới dữ liệu từ Supabase"
                >
                    {isSyncing ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16} />}
                    {isSyncing ? "Đang tải..." : "Làm mới Dữ liệu"}
                </button>
            </header>
            
            <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-slate-100 overflow-hidden mx-6 md:mx-0">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Họ tên & Email</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Trình độ</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Bài đã học (Tổng)</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Lỗi ghi nhận</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {profiles.map(profile => {
                                const totalCompleted = Object.values(profile.detailedProgress).reduce((acc: number, curr: LessonProgress) => acc + (curr.completedLessons?.length || 0), 0);
                                return (
                                <tr key={profile.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap align-top">
                                        <div className="text-sm font-bold text-slate-900">{profile.name}</div>
                                        <div className="text-xs text-slate-500">{profile.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap align-top">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getLevelBadge(profile.level)}`}>
                                            {profile.level}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap align-top text-center"><div className="text-sm text-slate-900 font-semibold">{totalCompleted}</div></td>
                                    <td className="px-6 py-4 whitespace-nowrap align-top text-center"><div className="text-sm text-red-600 font-bold">{profile.errorLog.length}</div></td>
                                    <td className="px-6 py-4 whitespace-nowrap align-top text-right">
                                        <button onClick={() => setSelectedProfile(profile)} className="text-teal-600 hover:text-teal-900 text-sm font-bold flex items-center justify-end gap-1 ml-auto">
                                            Xem chi tiết <ChevronRight size={16} />
                                        </button>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
                 {profiles.length === 0 && !isSyncing && (
                    <div className="text-center py-20 text-slate-500">
                        <Users className="mx-auto mb-2 text-slate-400" size={48}/>
                        <p className="font-semibold text-lg">{error ? "Lỗi kết nối" : "Chưa có dữ liệu học sinh"}</p>
                        <p className="text-sm mt-1 max-w-xs mx-auto">{error || "Khi học sinh đăng nhập và học tập, tiến độ của các em sẽ được tự động đồng bộ lên bảng này."}</p>
                    </div>
                )}
                 {isSyncing && (
                    <div className="text-center py-20 text-slate-500">
                        <Loader2 className="mx-auto animate-spin mb-2" size={32}/>
                        <p className="text-sm">Đang đồng bộ dữ liệu lớp học...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
