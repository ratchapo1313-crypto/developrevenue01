import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  User,
  AlertCircle,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { UserSession } from '../types/revenue';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (session: UserSession) => void;
  isGate?: boolean;
}

interface RolePreset {
  id: 'User' | 'Director' | 'Executive';
  displayRole: string;
  username: string;
  aliases: string[];
  pass: string;
  title: string;
  dept: string;
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canAddDaily: boolean;
    canImportExport: boolean;
    canReview: boolean;
    canApprove: boolean;
  };
}

const PRESET_ROLES: RolePreset[] = [
  {
    id: 'User',
    displayRole: 'เจ้าหน้าที่',
    username: 'User',
    aliases: ['user', 'เจ้าหน้าที่', 'เจ้าหน้าที่ฝ่ายพัฒนารายได้', 'user1'],
    pass: '1234',
    title: 'เจ้าหน้าที่ฝ่ายพัฒนารายได้',
    dept: 'ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม',
    permissions: {
      canEdit: true,
      canDelete: true,
      canAddDaily: true,
      canImportExport: true,
      canReview: true,
      canApprove: false,
    },
  },
  {
    id: 'Director',
    displayRole: 'กองคลัง',
    username: 'Director',
    aliases: ['director', 'กองคลัง', 'ผู้อำนวยการกองคลัง', 'director1'],
    pass: '1234',
    title: 'ผู้อำนวยการกองคลัง',
    dept: 'กองคลัง เทศบาลเมืองมหาสารคาม',
    permissions: {
      canEdit: false,
      canDelete: false,
      canAddDaily: false,
      canImportExport: true,
      canReview: true,
      canApprove: false,
    },
  },
  {
    id: 'Executive',
    displayRole: 'ผู้บริหาร',
    username: 'ผู้บริหาร',
    aliases: ['ผู้บริหาร', 'executive', 'admin', 'นายกเทศมนตรี'],
    pass: '1234',
    title: 'ผู้บริหาร / นายกเทศมนตรีเมืองมหาสารคาม',
    dept: 'สำนักงานเทศบาลเมืองมหาสารคาม',
    permissions: {
      canEdit: false,
      canDelete: false,
      canAddDaily: false,
      canImportExport: true,
      canReview: true,
      canApprove: true,
    },
  },
];

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  isGate = false,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const performLogin = (preset: RolePreset) => {
    onLoginSuccess({
      username: preset.username,
      role: preset.id,
      roleTitle: preset.title,
      department: preset.dept,
      permissions: preset.permissions,
    });
    if (onClose) onClose();
  };

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedUser = username.trim().toLowerCase();
    const trimmedPass = password.trim();

    const matched = PRESET_ROLES.find((r) => {
      const matchName =
        r.username.toLowerCase() === trimmedUser ||
        r.displayRole.toLowerCase() === trimmedUser ||
        r.aliases.some((a) => a.toLowerCase() === trimmedUser);
      return matchName && r.pass === trimmedPass;
    });

    if (matched) {
      performLogin(matched);
    } else {
      setErrorMsg('ชื่อผู้ใช้งาน หรือ รหัสผ่านไม่ถูกต้อง! กรุณาตรวจสอบและลองใหม่อีกครั้ง');
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto ${
        isGate
          ? 'bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 min-h-screen py-8'
          : 'bg-black/70 backdrop-blur-xs'
      }`}
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white p-6 sm:p-7 relative border-b border-blue-800/40">
          <div className="flex flex-col sm:flex-row items-center text-center sm:text-left space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-400/20 shrink-0 border border-amber-300">
              <Building2 className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  เทศบาลเมืองมหาสารคาม
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-400 text-slate-950 rounded-full shadow-xs">
                  ปีงบประมาณ 2570
                </span>
              </div>
              <p className="text-xs sm:text-sm text-blue-200 mt-1 font-medium">
                ฝ่ายพัฒนารายได้ กองคลัง
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-5">
          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-rose-700 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1">
                <span className="font-semibold block">เข้าสู่ระบบไม่สำเร็จ</span>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                ชื่อผู้ใช้งาน (Username)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="กรอกชื่อผู้ใช้งาน"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm text-slate-800 placeholder-slate-400 bg-slate-50 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm text-slate-800 placeholder-slate-400 bg-slate-50 focus:bg-white transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-blue-700 focus:outline-none"
                  title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>เข้าสู่ระบบการทำงาน</span>
              </button>
            </div>
          </form>

          {!isGate && onClose && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
