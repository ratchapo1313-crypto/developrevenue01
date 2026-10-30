import React, { useState } from 'react';
import {
  Building2,
  FileSpreadsheet,
  LogOut,
  LayoutDashboard,
  TableProperties,
  Landmark,
  FileText,
  RotateCcw,
  Radio,
  ExternalLink,
  ChevronDown,
  UserCheck,
  ShieldCheck,
  FileCheck,
  Award,
} from 'lucide-react';
import { UserSession } from '../types/revenue';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  session: UserSession | null;
  onLogout: () => void;
  onOpenExcel: () => void;
  onResetData: () => void;
  onSwitchRole?: (role: 'User' | 'Director' | 'Executive') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  session,
  onLogout,
  onOpenExcel,
  onResetData,
  onSwitchRole,
}) => {
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  const navTabs = [
    { id: 'overview', label: 'ภาพรวมรายได้', icon: LayoutDashboard },
    { id: 'categories', label: '8 หมวดรายได้', icon: TableProperties },
    { id: 'taxes', label: 'ภาษีที่ดิน & ภาษีป้าย', icon: Landmark },
    { id: 'memorandum', label: 'บันทึกข้อความราชการ', icon: FileText },
  ];

  const getRoleInfo = () => {
    if (!session) {
      return {
        label: 'ยังไม่เข้าสู่ระบบ',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        icon: UserCheck,
      };
    }
    switch (session.role) {
      case 'User':
        return {
          label: 'เจ้าหน้าที่ : User (บันทึกข้อมูล/อัปเดตอัตโนมัติ)',
          shortLabel: 'เจ้าหน้าที่ (User)',
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
          icon: ShieldCheck,
        };
      case 'Director':
        return {
          label: 'กองคลัง : Director (ตรวจสอบรายงาน)',
          shortLabel: 'กองคลัง (Director)',
          badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
          icon: FileCheck,
        };
      case 'Executive':
        return {
          label: 'ผู้บริหาร : Executive (สรุปผลทั้งเทศบาล)',
          shortLabel: 'ผู้บริหาร (Executive)',
          badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
          icon: Award,
        };
      default:
        return {
          label: 'ผู้ใช้งาน',
          shortLabel: 'ผู้ใช้',
          badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-400/40',
          icon: UserCheck,
        };
    }
  };

  const roleInfo = getRoleInfo();
  const RoleIcon = roleInfo.icon;

  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-950 text-white px-4 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Brand & Titles */}
          <div className="flex items-center space-x-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md shrink-0 border border-amber-300">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base sm:text-lg font-bold tracking-tight">
                  เทศบาลเมืองมหาสารคาม
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-md">
                  ปีงบประมาณ 2570
                </span>
                {/* Live Real-Time Database Sync Indicator */}
                <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 text-[11px]" title="เชื่อมต่อฐานข้อมูล Firebase Firestore: databaserevenuecollection">
                  <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span>Firebase: <span className="font-mono font-semibold text-amber-300">databaserevenuecollection</span> • ออนไลน์</span>
                </div>
              </div>
              <p className="text-xs text-blue-200/90">
                ระบบติดตามและรายงานผลการจัดเก็บรายได้ ฝ่ายพัฒนารายได้ กองคลัง
              </p>
            </div>
          </div>

          {/* Right Role Status & Actions */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            {/* Live Database Sync Badge (Mobile/Tablet) */}
            <div className="flex lg:hidden items-center space-x-1 px-2 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 text-[11px]" title="เชื่อมต่อฐานข้อมูล: databaserevenuecollection">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span className="font-mono text-[10px] text-amber-300">databaserevenuecollection</span>
            </div>

            {/* Role Switcher Dropdown */}
            {session && onSwitchRole ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer shadow-xs transition-all ${roleInfo.badgeClass} hover:brightness-110`}
                  title="คลิกเพื่อสลับบทบาทผู้ใช้งาน (User / Director / Executive)"
                >
                  <RoleIcon className="w-3.5 h-3.5" />
                  <span>{roleInfo.shortLabel}</span>
                  <ChevronDown className="w-3 h-3 opacity-70 ml-0.5" />
                </button>

                {isRoleDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 text-slate-800 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] text-slate-400 font-semibold uppercase">
                      สลับบทบาทผู้ใช้งาน (สิทธิ์เข้าพร้อมกัน)
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSwitchRole('User');
                        setIsRoleDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-start space-x-2 text-xs hover:bg-slate-50 transition-colors ${
                        session.role === 'User' ? 'bg-emerald-50 font-bold text-emerald-800' : ''
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-900">เจ้าหน้าที่ (User)</div>
                        <div className="text-[10px] text-slate-500 leading-tight">
                          สิทธิ์บันทึกข้อมูลประจำวัน, อัปเดตอัตโนมัติ, นำเข้า-ส่งออก
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSwitchRole('Director');
                        setIsRoleDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-start space-x-2 text-xs hover:bg-slate-50 transition-colors ${
                        session.role === 'Director' ? 'bg-blue-50 font-bold text-blue-800' : ''
                      }`}
                    >
                      <FileCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-900">กองคลัง (Director)</div>
                        <div className="text-[10px] text-slate-500 leading-tight">
                          ตรวจสอบรายงาน 8 หมวด, ภาษีที่ดิน/ป้าย, ลูกหนี้เก่า
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSwitchRole('Executive');
                        setIsRoleDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-start space-x-2 text-xs hover:bg-slate-50 transition-colors ${
                        session.role === 'Executive' ? 'bg-purple-50 font-bold text-purple-800' : ''
                      }`}
                    >
                      <Award className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-900">ผู้บริหาร (Executive)</div>
                        <div className="text-[10px] text-slate-500 leading-tight">
                          สิทธิ์ดูสรุปผลทั้งเทศบาล, พิจารณาอนุมัติบันทึกข้อความ
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold bg-white/10 text-white border-white/20">
                <RoleIcon className="w-3.5 h-3.5" />
                <span>{roleInfo.shortLabel}</span>
              </div>
            )}

            {/* Open New Window for Concurrent Multi-user Test */}
            <button
              type="button"
              onClick={() => window.open(window.location.href, '_blank')}
              className="px-2.5 py-1.5 rounded-xl bg-blue-800/80 hover:bg-blue-700 border border-blue-600/50 text-white font-medium transition-colors flex items-center space-x-1 shadow-xs"
              title="เปิดแท็บ/หน้าต่างใหม่ เพื่อทดสอบเข้าสู่ระบบพร้อมกันหลายคน"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">เปิดแท็บใหม่</span>
            </button>

            {/* Excel Manager */}
            <button
              type="button"
              onClick={onOpenExcel}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-500/50 text-white font-medium transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel (นำเข้า/ส่งออก)</span>
            </button>

            {/* Logout button */}
            {session && (
              <button
                type="button"
                onClick={onLogout}
                className="px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white transition-colors flex items-center space-x-1.5 font-medium shadow-xs cursor-pointer"
                title="ออกจากระบบ"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>ออกจากระบบ</span>
              </button>
            )}

            {/* Reset data */}
            <button
              type="button"
              onClick={onResetData}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
              title="รีเซ็ตข้อมูลทั้งหมดเป็นค่าเริ่มต้น"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Bar Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <nav className="flex space-x-1 overflow-x-auto py-2 scrollbar-none" aria-label="Tabs">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center space-x-2 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-800 text-white shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
