import React, { useState } from 'react';
import { BookOpen, User, ArrowRight } from 'lucide-react';
import { simpleEmailLogin } from '../services/firebase';

interface LoginProps {
  onLogin: (user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Vui lòng nhập một email hợp lệ.');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      const user = await simpleEmailLogin(email.trim());
      onLogin(user);
    } catch (err: any) {
      console.error(err);
      setError('Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden text-center p-8">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center">
            <BookOpen className="w-8 h-8" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Omni English Tutor</h2>
        <p className="text-slate-600 mb-8">Đăng nhập bằng email để lưu trữ tiến trình học tập của bạn trên hệ thống.</p>

        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6 text-left">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email học viên</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="email"
                required
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition outline-none"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl px-6 py-3.5 font-semibold text-lg hover:bg-slate-800 transition transform active:scale-95 shadow-lg shadow-slate-900/20 disabled:opacity-50"
          >
            {loading ? 'Đang kết nối...' : <>Vào Học <ArrowRight className="w-5 h-5" /></>}
          </button>
        </form>
      </div>
    </div>
  );
};
