import React, { useState, useEffect } from 'react';
import {
  Store,
  Plus,
  Minus,
  Edit2,
  Trash2,
  Search,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  Calculator,
  Building2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { MarketContract, MarketSummary, UserSession } from '../types/revenue';
import { formatCurrency, formatNumber } from '../utils/excel';

interface MarketAssetsSectionProps {
  marketSummaries: Record<'night_market' | 'fresh_market', MarketSummary>;
  marketContracts: MarketContract[];
  onUpdateSummaries: (summaries: Record<'night_market' | 'fresh_market', MarketSummary>) => void;
  onAddContract: (contract: MarketContract) => void;
  onUpdateContract: (contract: MarketContract) => void;
  onDeleteContract: (contractId: string) => void;
  session: UserSession | null;
}

// Helper to calculate end date from start date and duration
export function calculateContractEndDate(startDateStr: string, durationStr: string): string {
  if (!startDateStr) return '';

  let year = 0;
  let month = 0; // 1-12
  let day = 0;
  let isBE = false; // Buddhist Era (e.g. > 2400)

  if (startDateStr.includes('-')) {
    const parts = startDateStr.split('-').map(Number);
    if (parts.length === 3) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    }
  } else if (startDateStr.includes('/')) {
    const parts = startDateStr.split('/').map(Number);
    if (parts.length === 3) {
      if (parts[0] > 1000) {
        year = parts[0];
        month = parts[1];
        day = parts[2];
      } else {
        day = parts[0];
        month = parts[1];
        year = parts[2];
      }
    }
  }

  if (!year || !month || !day || isNaN(year) || isNaN(month) || isNaN(day)) {
    return '';
  }

  if (year > 2400) {
    isBE = true;
    year = year - 543;
  }

  let addYears = 0;
  let addMonths = 0;

  const yearMatch = durationStr.match(/(\d+)\s*ปี/);
  const monthMatch = durationStr.match(/(\d+)\s*เดือน/);

  if (yearMatch) {
    addYears += parseInt(yearMatch[1], 10);
  }
  if (monthMatch) {
    addMonths += parseInt(monthMatch[1], 10);
  }

  if (!yearMatch && !monthMatch) {
    const num = parseInt(durationStr, 10);
    if (!isNaN(num) && num > 0) {
      addYears = num;
    } else {
      addYears = 1; // default to 1 year
    }
  }

  // Calculate: Target end date is 1 day before the full anniversary
  // Example: 2569-10-01 with 1 year duration ends on 2570-09-30
  const targetDate = new Date(year, month - 1 + addMonths + addYears * 12, day);
  targetDate.setDate(targetDate.getDate() - 1);

  let endYear = targetDate.getFullYear();
  if (isBE) {
    endYear += 543;
  }

  const endMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
  const endDay = String(targetDate.getDate()).padStart(2, '0');

  return `${endYear}-${endMonth}-${endDay}`;
}

export const MarketAssetsSection: React.FC<MarketAssetsSectionProps> = ({
  marketSummaries,
  marketContracts,
  onUpdateSummaries,
  onAddContract,
  onUpdateContract,
  onDeleteContract,
  session,
}) => {
  const [activeMarket, setActiveMarket] = useState<'night_market' | 'fresh_market'>('night_market');
  const [searchQuery, setSearchQuery] = useState('');
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<MarketContract | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<MarketContract>>({
    marketType: 'night_market',
    propertyName: '',
    contractNumber: '',
    startDate: '2569-10-01',
    leaseDuration: '1 ปี',
    endDate: '2570-09-30',
    transactionFee: 500,
    monthlyRent: 2500,
    securityDeposit: 5000,
    lesseeName: '',
  });

  const canEdit = session?.permissions.canEdit ?? false;
  const canDelete = session?.permissions.canDelete ?? false;

  const currentSummary = marketSummaries[activeMarket];
  const contractsInMarket = marketContracts.filter((c) => c.marketType === activeMarket);
  const occupiedCount = contractsInMarket.length;

  const filteredContracts = contractsInMarket.filter(
    (c) =>
      c.propertyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.lesseeName && c.lesseeName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Totals for this market
  const totalMonthlyRent = contractsInMarket.reduce((s, c) => s + (c.monthlyRent || 0), 0);
  const totalSecurityDeposit = contractsInMarket.reduce((s, c) => s + (c.securityDeposit || 0), 0);
  const totalFees = contractsInMarket.reduce((s, c) => s + (c.transactionFee || 0), 0);

  // Quick adjust total stalls
  const handleAdjustTotalStalls = (delta: number) => {
    if (!canEdit) return;
    const newTotal = Math.max(0, (currentSummary.totalStalls || 0) + delta);
    onUpdateSummaries({
      ...marketSummaries,
      [activeMarket]: {
        ...currentSummary,
        totalStalls: newTotal,
        occupiedStalls: occupiedCount,
      },
    });
  };

  const handleSetTotalStalls = (val: number) => {
    if (!canEdit) return;
    const newTotal = Math.max(0, val);
    onUpdateSummaries({
      ...marketSummaries,
      [activeMarket]: {
        ...currentSummary,
        totalStalls: newTotal,
        occupiedStalls: occupiedCount,
      },
    });
  };

  // Recalculate end date automatically when start date or duration changes
  const handleStartDateChange = (newStartDate: string) => {
    const duration = formData.leaseDuration || '1 ปี';
    const computedEnd = calculateContractEndDate(newStartDate, duration);
    setFormData((prev) => ({
      ...prev,
      startDate: newStartDate,
      endDate: computedEnd || prev.endDate,
    }));
  };

  const handleDurationChange = (newDuration: string) => {
    const startDate = formData.startDate || '2569-10-01';
    const computedEnd = calculateContractEndDate(startDate, newDuration);
    setFormData((prev) => ({
      ...prev,
      leaseDuration: newDuration,
      endDate: computedEnd || prev.endDate,
    }));
  };

  const handleAutoCalcEndDate = () => {
    const computed = calculateContractEndDate(
      formData.startDate || '2569-10-01',
      formData.leaseDuration || '1 ปี'
    );
    if (computed) {
      setFormData((prev) => ({ ...prev, endDate: computed }));
    }
  };

  const openNewContractModal = () => {
    if (!canEdit) return;
    setEditingContract(null);
    const defaultStart = '2569-10-01';
    const defaultDuration = '1 ปี';
    const defaultEnd = calculateContractEndDate(defaultStart, defaultDuration) || '2570-09-30';

    setFormData({
      marketType: activeMarket,
      propertyName:
        activeMarket === 'night_market'
          ? `ล็อคแผงค้าโต้รุ่ง ล็อค ${contractsInMarket.length + 1}`
          : `แผงจำหน่ายสินค้าสด ล็อค ${contractsInMarket.length + 1}`,
      contractNumber: `ตน.${activeMarket === 'night_market' ? 'ร' : 'สด'}. 70/0${contractsInMarket.length + 1}`,
      startDate: defaultStart,
      leaseDuration: defaultDuration,
      endDate: defaultEnd,
      transactionFee: activeMarket === 'night_market' ? 500 : 600,
      monthlyRent: activeMarket === 'night_market' ? 2500 : 3000,
      securityDeposit: activeMarket === 'night_market' ? 5000 : 6000,
      lesseeName: '',
    });
    setIsContractModalOpen(true);
  };

  const openEditContractModal = (contract: MarketContract) => {
    if (!canEdit) return;
    setEditingContract(contract);
    setFormData({
      ...contract,
      leaseDuration: contract.leaseDuration || '1 ปี',
    });
    setIsContractModalOpen(true);
  };

  const handleSubmitContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.propertyName || !formData.contractNumber) return;

    if (editingContract) {
      onUpdateContract({
        ...editingContract,
        ...formData,
        marketType: formData.marketType || activeMarket,
        leaseDuration: formData.leaseDuration || '1 ปี',
        transactionFee: Number(formData.transactionFee) || 0,
        monthlyRent: Number(formData.monthlyRent) || 0,
        securityDeposit: Number(formData.securityDeposit) || 0,
      } as MarketContract);
    } else {
      const newContract: MarketContract = {
        id: `con-${Date.now()}`,
        marketType: formData.marketType || activeMarket,
        propertyName: formData.propertyName || 'แผงค้าใหม่',
        contractNumber: formData.contractNumber || 'รอออกเลข',
        startDate: formData.startDate || '2569-10-01',
        leaseDuration: formData.leaseDuration || '1 ปี',
        endDate: formData.endDate || '2570-09-30',
        transactionFee: Number(formData.transactionFee) || 0,
        monthlyRent: Number(formData.monthlyRent) || 0,
        securityDeposit: Number(formData.securityDeposit) || 0,
        lesseeName: formData.lesseeName || 'ไม่ระบุ',
        status: 'active',
      };
      onAddContract(newContract);

      // Keep occupied count synchronized
      onUpdateSummaries({
        ...marketSummaries,
        [newContract.marketType]: {
          ...marketSummaries[newContract.marketType],
          occupiedStalls: marketSummaries[newContract.marketType].occupiedStalls + 1,
        },
      });
    }

    setIsContractModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!canDelete) return;
    if (confirm('ยืนยันที่จะลบข้อมูลสัญญาเช่านี้ออกจากระบบหรือไม่?')) {
      onDeleteContract(id);
      // Synchronize occupiedStalls
      onUpdateSummaries({
        ...marketSummaries,
        [activeMarket]: {
          ...currentSummary,
          occupiedStalls: Math.max(0, (currentSummary.occupiedStalls || 1) - 1),
        },
      });
    }
  };

  const vacantStalls = Math.max(0, (currentSummary.totalStalls || 0) - occupiedCount);
  const occupancyRate =
    currentSummary.totalStalls > 0
      ? ((occupiedCount / currentSummary.totalStalls) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      {/* Header & Market Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Store className="w-5 h-5 text-blue-800" />
              <h2 className="text-xl font-bold text-slate-800">
                รายงานการจัดหาประโยชน์จากทรัพย์สิน (ตลาดโต้รุ่ง และตลาดสด)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม ควบคุมสัญญาเช่าและค่าธรรมเนียม
            </p>
          </div>

          {/* Market Tab Selector */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setActiveMarket('night_market')}
              className={`px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 ${
                activeMarket === 'night_market'
                  ? 'bg-blue-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>ตลาดโต้รุ่ง</span>
              <span
                className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeMarket === 'night_market'
                    ? 'bg-blue-900 text-blue-100'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {marketSummaries.night_market.totalStalls} ล็อค
              </span>
            </button>
            <button
              onClick={() => setActiveMarket('fresh_market')}
              className={`px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 ${
                activeMarket === 'fresh_market'
                  ? 'bg-blue-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>ตลาดสด</span>
              <span
                className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeMarket === 'fresh_market'
                    ? 'bg-blue-900 text-blue-100'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {marketSummaries.fresh_market.totalStalls} ล็อค
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Control Box: กรอกจำนวนกี่ล็อคทั้งหมด มีเพิ่ม/ลด ได้ (สำหรับตลาดที่เลือก) */}
      <div className="bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-blue-800/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-md">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/30">
              <Store className="w-3.5 h-3.5" />
              <span>{activeMarket === 'night_market' ? 'ตลาดโต้รุ่ง เทศบาลเมืองมหาสารคาม' : 'ตลาดสดเทศบาลเมืองมหาสารคาม'}</span>
            </div>
            <h3 className="text-2xl font-black text-white">
              {currentSummary.name}
            </h3>
            <p className="text-xs text-slate-300">
              เมนูกรอกจำนวนกี่ล็อคทั้งหมด สามารถกดปุ่มเพิ่ม/ลด (+ / -) หรือพิมพ์ระบุจำนวนได้โดยตรง
            </p>
          </div>

          {/* Stepper & Counter: จำนวนกี่ล็อคทั้งหมด มีเพิ่ม/ลด ได้ */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-inner flex flex-col sm:flex-row items-center gap-4">
            <div>
              <span className="text-xs font-semibold text-blue-200 block text-center sm:text-left mb-1">
                จำนวนกี่ล็อคทั้งหมด (มีเพิ่ม/ลด ได้)
              </span>
              <div className="flex items-center space-x-2">
                {/* Minus buttons */}
                <button
                  type="button"
                  onClick={() => handleAdjustTotalStalls(-5)}
                  disabled={!canEdit || currentSummary.totalStalls <= 0}
                  className="px-2.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 disabled:opacity-40 text-xs font-bold text-white transition-all border border-white/10"
                  title="ลด 5 ล็อค"
                >
                  -5
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustTotalStalls(-1)}
                  disabled={!canEdit || currentSummary.totalStalls <= 0}
                  className="p-2 rounded-xl bg-rose-500/80 hover:bg-rose-500 active:scale-95 disabled:opacity-40 text-white transition-all shadow-xs"
                  title="ลด 1 ล็อค"
                >
                  <Minus className="w-4 h-4" />
                </button>

                {/* Direct Number Input */}
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={currentSummary.totalStalls}
                    onChange={(e) => handleSetTotalStalls(parseInt(e.target.value, 10) || 0)}
                    disabled={!canEdit}
                    className="w-24 text-center py-2 px-2 text-xl font-black text-amber-300 bg-black/40 rounded-xl border border-white/30 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-75"
                  />
                  <span className="absolute -bottom-4 left-0 right-0 text-[10px] text-center text-slate-300 font-medium">
                    ล็อค
                  </span>
                </div>

                {/* Plus buttons */}
                <button
                  type="button"
                  onClick={() => handleAdjustTotalStalls(1)}
                  disabled={!canEdit}
                  className="p-2 rounded-xl bg-emerald-500/90 hover:bg-emerald-500 active:scale-95 disabled:opacity-40 text-white transition-all shadow-xs"
                  title="เพิ่ม 1 ล็อค"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustTotalStalls(5)}
                  disabled={!canEdit}
                  className="px-2.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 disabled:opacity-40 text-xs font-bold text-white transition-all border border-white/10"
                  title="เพิ่ม 5 ล็อค"
                >
                  +5
                </button>
              </div>
            </div>

            {/* Quick Summary Pill Badges */}
            <div className="grid grid-cols-2 gap-2 text-center pl-0 sm:pl-4 sm:border-l sm:border-white/20 pt-2 sm:pt-0 w-full sm:w-auto">
              <div className="p-2.5 bg-black/30 rounded-xl">
                <span className="text-[10px] text-emerald-300 block">มีสัญญาเช่าแล้ว</span>
                <span className="text-base font-bold text-emerald-400">
                  {occupiedCount} ล็อค
                </span>
              </div>
              <div className="p-2.5 bg-black/30 rounded-xl">
                <span className="text-[10px] text-slate-300 block">ล็อคคงเหลือว่าง</span>
                <span className="text-base font-bold text-slate-200">
                  {vacantStalls} ล็อค
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/15">
          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <span className="text-[11px] text-slate-300 block">จำนวนกี่ล็อคทั้งหมด</span>
            <span className="text-lg font-bold text-amber-300">
              {currentSummary.totalStalls} ล็อค
            </span>
          </div>

          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <span className="text-[11px] text-slate-300 block">มีสัญญาเช่าแล้ว (ใช้งาน)</span>
            <span className="text-lg font-bold text-emerald-400">
              {occupiedCount} สัญญา ({occupancyRate}%)
            </span>
          </div>

          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <span className="text-[11px] text-slate-300 block">จำนวนค่าเช่า/เดือนรวม</span>
            <span className="text-lg font-bold text-white">
              ฿{formatCurrency(totalMonthlyRent)}
            </span>
          </div>

          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <span className="text-[11px] text-slate-300 block">เงินประกันสัญญาเช่ารวม</span>
            <span className="text-lg font-bold text-indigo-300">
              ฿{formatCurrency(totalSecurityDeposit)}
            </span>
          </div>
        </div>
      </div>

      {/* Contracts Table Section: แสดงตารางสัญญาเช่า มีสัญญาเช่าแล้ว */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-lg">
                มีสัญญาเช่าแล้ว
              </span>
              <h4 className="font-bold text-slate-800 text-base">
                ตารางสัญญาเช่า ({contractsInMarket.length} ฉบับ) - {activeMarket === 'night_market' ? 'ตลาดโต้รุ่ง' : 'ตลาดสด'}
              </h4>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              แสดงข้อมูลรายการทรัพย์สิน (ชื่อล็อค/แผงค้า), เลขที่สัญญา, วันที่เริ่มสัญญา, กำหนดระยะเวลาการเช่า, วันที่สิ้นสุดสัญญา (คำนวณอัตโนมัติ), ค่าธรรมเนียมการทำธุรกรรม, จำนวนค่าเช่า/เดือน, เงินประกันสัญญาเช่า
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อล็อค/แผงค้า, เลขที่สัญญา..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50 focus:bg-white"
              />
            </div>

            {canEdit && (
              <button
                onClick={openNewContractModal}
                className="px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center space-x-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มสัญญาใหม่</span>
              </button>
            )}
          </div>
        </div>

        {/* Table: ตารางสัญญาเช่า มีสัญญาเช่าแล้ว */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3 w-12 text-center">ลำดับ</th>
                <th className="py-3 px-4">รายการทรัพย์สิน (ชื่อล็อค/แผงค้า)</th>
                <th className="py-3 px-4">เลขที่สัญญา</th>
                <th className="py-3 px-4">วันที่เริ่มสัญญา</th>
                <th className="py-3 px-4 text-center">กำหนดระยะเวลาการเช่า</th>
                <th className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <span>วันที่สิ้นสุดสัญญา</span>
                    <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 font-normal">
                      คำนวณ
                    </span>
                  </div>
                </th>
                <th className="py-3 px-4 text-right">ค่าธรรมเนียมการทำธุรกรรม</th>
                <th className="py-3 px-4 text-right">จำนวนค่าเช่า/เดือน</th>
                <th className="py-3 px-4 text-right">เงินประกันสัญญาเช่า</th>
                {(canEdit || canDelete) && <th className="py-3 px-3 text-center w-24">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400 text-xs">
                    {searchQuery
                      ? 'ไม่พบข้อมูลสัญญาที่ค้นหา'
                      : `ยังไม่มีสัญญาเช่าใน ${activeMarket === 'night_market' ? 'ตลาดโต้รุ่ง' : 'ตลาดสด'} สามารถคลิกปุ่ม "+ เพิ่มสัญญาใหม่" เพื่อบันทึกสัญญา`}
                  </td>
                </tr>
              ) : (
                filteredContracts.map((con, idx) => (
                  <tr key={con.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3 px-3 text-center text-slate-400 font-medium">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      <div>{con.propertyName}</div>
                      {con.lesseeName && (
                        <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                          ผู้เช่า: {con.lesseeName}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700 text-xs">
                      {con.contractNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs whitespace-nowrap">
                      {con.startDate}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {con.leaseDuration || '1 ปี'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-700 font-medium text-xs whitespace-nowrap">
                      <span className="text-blue-900 bg-blue-50/80 px-2 py-0.5 rounded border border-blue-100 font-mono">
                        {con.endDate}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">
                      ฿{formatCurrency(con.transactionFee)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700">
                      ฿{formatCurrency(con.monthlyRent)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-indigo-700">
                      ฿{formatCurrency(con.securityDeposit)}
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          {canEdit && (
                            <button
                              onClick={() => openEditContractModal(con)}
                              className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-100/70 rounded-lg transition-colors"
                              title="แก้ไขข้อมูลสัญญา"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(con.id)}
                              className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-100/70 rounded-lg transition-colors"
                              title="ลบสัญญา"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Footer with Totals */}
            <tfoot className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-900 text-xs sm:text-sm">
              <tr>
                <td className="py-3 px-3 text-center">รวม</td>
                <td className="py-3 px-4" colSpan={5}>
                  รวมทั้งสิ้น {contractsInMarket.length} สัญญาเช่า (จากจำนวนทั้งหมด {currentSummary.totalStalls} ล็อค)
                </td>
                <td className="py-3 px-4 text-right text-slate-800">
                  ฿{formatCurrency(totalFees)}
                </td>
                <td className="py-3 px-4 text-right text-emerald-700">
                  ฿{formatCurrency(totalMonthlyRent)}
                </td>
                <td className="py-3 px-4 text-right text-indigo-800">
                  ฿{formatCurrency(totalSecurityDeposit)}
                </td>
                {(canEdit || canDelete) && <td className="py-3 px-3"></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Contract Add/Edit Modal (สามารถเพิ่มสัญญาใหม่ แก้ไข และลบได้) */}
      {isContractModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">
                  {editingContract ? 'แก้ไขสัญญาเช่าทรัพย์สิน' : 'เพิ่มสัญญาเช่าทรัพย์สินใหม่'}
                </h3>
                <p className="text-xs text-blue-200 mt-0.5">
                  {formData.marketType === 'night_market' ? 'ตลาดโต้รุ่ง' : 'ตลาดสด'} - เทศบาลเมืองมหาสารคาม
                </p>
              </div>
              <button
                onClick={() => setIsContractModalOpen(false)}
                className="text-slate-300 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitContract} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ประเภทตลาด *
                  </label>
                  <select
                    value={formData.marketType}
                    onChange={(e) =>
                      setFormData({ ...formData, marketType: e.target.value as any })
                    }
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-slate-50 font-medium"
                  >
                    <option value="night_market">ตลาดโต้รุ่ง</option>
                    <option value="fresh_market">ตลาดสด</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    เลขที่สัญญา *
                  </label>
                  <input
                    type="text"
                    value={formData.contractNumber}
                    onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                    placeholder="เช่น ตน.ร. 70/001"
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  รายการทรัพย์สิน (ชื่อล็อค/แผงค้า) *
                </label>
                <input
                  type="text"
                  value={formData.propertyName}
                  onChange={(e) => setFormData({ ...formData, propertyName: e.target.value })}
                  placeholder="เช่น ล็อคจำหน่ายอาหารสำเร็จรูป A-01"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ผู้เช่า / ผู้ทำสัญญา (ร้านค้าหรือบุคคล)
                </label>
                <input
                  type="text"
                  value={formData.lesseeName}
                  onChange={(e) => setFormData({ ...formData, lesseeName: e.target.value })}
                  placeholder="เช่น ร้านป้าทอง ส้มตำไก่ย่าง หรือ นายสมชาย ใจดี"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              {/* Lease Dates and Duration with Auto-Calculation */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-blue-700" />
                    <span>ระยะเวลาสัญญาเช่าและการคำนวณ</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAutoCalcEndDate}
                    className="text-[11px] text-blue-700 hover:text-blue-900 font-semibold flex items-center space-x-1 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200"
                  >
                    <Calculator className="w-3 h-3" />
                    <span>คำนวณวันสิ้นสุดใหม่</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      วันที่เริ่มสัญญา *
                    </label>
                    <input
                      type="text"
                      value={formData.startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      placeholder="เช่น 2569-10-01"
                      className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white font-mono"
                      required
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">รูปแบบ: 2569-10-01</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      กำหนดระยะเวลาการเช่า *
                    </label>
                    <input
                      type="text"
                      value={formData.leaseDuration}
                      onChange={(e) => handleDurationChange(e.target.value)}
                      placeholder="เช่น 1 ปี, 6 เดือน"
                      className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white font-medium"
                      required
                    />
                    <div className="flex flex-wrap gap-1 mt-1">
                      {['1 ปี', '2 ปี', '3 ปี', '6 เดือน'].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleDurationChange(d)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            formData.leaseDuration === d
                              ? 'bg-blue-700 text-white border-blue-700'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      วันที่สิ้นสุดสัญญา (คำนวณอัตโนมัติ) *
                    </label>
                    <input
                      type="text"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      placeholder="เช่น 2570-09-30"
                      className="w-full p-2 text-xs border border-blue-300 rounded-xl bg-blue-50/50 font-mono font-bold text-blue-900"
                      required
                    />
                    <span className="text-[10px] text-emerald-600 mt-0.5 block font-medium">
                      ✓ คำนวณจาก วันที่เริ่มสัญญา + กำหนดระยะเวลา
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Fields */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ค่าธรรมเนียมการทำธุรกรรม (บาท)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.transactionFee}
                    onChange={(e) =>
                      setFormData({ ...formData, transactionFee: Number(e.target.value) })
                    }
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    จำนวนค่าเช่า/เดือน (บาท) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.monthlyRent}
                    onChange={(e) =>
                      setFormData({ ...formData, monthlyRent: Number(e.target.value) })
                    }
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl font-bold text-emerald-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    เงินประกันสัญญาเช่า (บาท)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.securityDeposit}
                    onChange={(e) =>
                      setFormData({ ...formData, securityDeposit: Number(e.target.value) })
                    }
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl font-bold text-indigo-700"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsContractModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs rounded-xl hover:bg-slate-100 font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-800 hover:bg-blue-900 text-white text-xs rounded-xl font-bold shadow-md flex items-center space-x-1.5 transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingContract ? 'บันทึกการแก้ไข' : 'บันทึกสัญญา'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
