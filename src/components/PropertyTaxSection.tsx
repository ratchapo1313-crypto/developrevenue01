import React, { useState, useMemo, useDeferredValue, useEffect } from 'react';
import {
  Landmark,
  Edit3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck,
  TrendingUp,
  Save,
  X,
  PlusCircle,
  Search,
  Filter,
  Trash2,
  Receipt,
  FileSpreadsheet,
  Coins,
  History,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import {
  DetailedTaxData,
  UserSession,
  TaxpayerRecord,
  TaxPaymentStatus,
  OldTaxDebtorRecord,
} from '../types/revenue';
import {
  formatCurrency,
  formatNumber,
  exportTaxpayersToExcel,
} from '../utils/excel';

interface PropertyTaxSectionProps {
  landTax: DetailedTaxData;
  signTax: DetailedTaxData;
  onUpdateLandTax: (data: DetailedTaxData) => void;
  onUpdateSignTax: (data: DetailedTaxData) => void;
  taxpayers: TaxpayerRecord[];
  onUpdateTaxpayers: (taxpayers: TaxpayerRecord[]) => void;
  oldTaxDebtors?: OldTaxDebtorRecord[];
  onUpdateOldTaxDebtors?: (debtors: OldTaxDebtorRecord[]) => void;
  session: UserSession | null;
}

export const PropertyTaxSection: React.FC<PropertyTaxSectionProps> = ({
  landTax,
  signTax,
  onUpdateLandTax,
  onUpdateSignTax,
  taxpayers,
  onUpdateTaxpayers,
  session,
}) => {
  const canEdit = session?.permissions.canEdit ?? false;

  // Active Tax Sub-tab: 'land' (ที่ดินและสิ่งปลูกสร้าง) or 'sign' (ภาษีป้าย)
  const [activeTab, setActiveTab] = useState<'land' | 'sign'>('land');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal: Add / Edit Taxpayer Record (Unified for both 2570 Tax and Old Debt by same name)
  const [isTaxpayerModalOpen, setIsTaxpayerModalOpen] = useState(false);
  const [editingTaxpayer, setEditingTaxpayer] = useState<TaxpayerRecord | null>(null);

  // Form State for Taxpayer Modal (Unified for both 2570 Tax and Old Debt under same name)
  const [taxpayerForm, setTaxpayerForm] = useState<{
    name: string;
    assessedAmount: number | '';
    reliefAmount: number | '';
    status: TaxPaymentStatus;
    payment1: number | '';
    payment2: number | '';
    payment3: number | '';
    isPendingVerification: boolean;
    hasOldDebt: boolean;
    oldDebtAmount: number | '';
    oldDebtStatus: TaxPaymentStatus;
    oldDebtPaid: number | '';
    penaltyAmount: number | '';
    surchargeAmount: number | '';
    notes: string;
  }>({
    name: '',
    assessedAmount: '',
    reliefAmount: 0,
    status: 0,
    payment1: 0,
    payment2: 0,
    payment3: 0,
    isPendingVerification: false,
    hasOldDebt: false,
    oldDebtAmount: 0,
    oldDebtStatus: 0,
    oldDebtPaid: 0,
    penaltyAmount: 0,
    surchargeAmount: 0,
    notes: '',
  });

  // Modal: Edit Global Estimate & Aggregates
  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
  const [estimateFormData, setEstimateFormData] = useState<{
    estimateCount: number;
    estimateAmount: number;
    collectedCount: number;
    collectedAmount: number;
    taxpayersCount: number;
    taxpayersAmount: number;
    debtorsCount: number;
    debtorsAmount: number;
    pendingCount: number;
    pendingAmount: number;
  }>({
    estimateCount: 0,
    estimateAmount: 0,
    collectedCount: 0,
    collectedAmount: 0,
    taxpayersCount: 0,
    taxpayersAmount: 0,
    debtorsCount: 0,
    debtorsAmount: 0,
    pendingCount: 0,
    pendingAmount: 0,
  });

  // Active dataset
  const currentTaxData = activeTab === 'land' ? landTax : signTax;
  const currentTaxTitle = activeTab === 'land' ? 'ภาษีที่ดินและสิ่งปลูกสร้าง' : 'ภาษีป้าย';

  // Filter taxpayers by active tax type
  const currentTaxpayers = useMemo(() => {
    return taxpayers.filter((t) => t.taxType === activeTab);
  }, [taxpayers, activeTab]);

  // Statistics derived directly from the taxpayers list
  const listStats = useMemo(() => {
    let assessedTotal = 0;
    let reliefTotal = 0;
    let afterReliefTotal = 0;
    let payments2570Total = 0;
    let remaining2570Total = 0;
    let oldDebtorsCount = 0;
    let oldDebtTotal = 0;
    let oldDebtPaidTotal = 0;
    let oldDebtRemainingTotal = 0;
    let penaltiesTotal = 0;
    let surchargesTotal = 0;
    let totalCollectedAmount = 0;
    let totalRemainingAll = 0;
    let paidCount = 0;
    let fullyPaidCount = 0;
    let debtorsCount = 0;
    let pendingCount = 0;
    let pendingAmount = 0;

    currentTaxpayers.forEach((t) => {
      assessedTotal += t.assessedAmount || 0;
      reliefTotal += t.reliefAmount || 0;
      afterReliefTotal += t.afterReliefAmount || 0;

      const p2570 = (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0);
      payments2570Total += p2570;

      const rem2570 = t.remainingBalance !== undefined ? t.remainingBalance : Math.max(0, (t.afterReliefAmount || 0) - p2570);
      remaining2570Total += rem2570;

      const oldDebt = t.oldDebtAmount || 0;
      const oldPaid = t.oldDebtPaid || 0;
      const pen = t.penaltyAmount || 0;
      const sur = t.surchargeAmount || 0;
      const oldRem = t.oldDebtRemaining !== undefined ? t.oldDebtRemaining : Math.max(0, oldDebt - oldPaid);

      if (oldDebt > 0 || oldPaid > 0) {
        if (oldDebt > 0) oldDebtorsCount += 1;
        oldDebtTotal += oldDebt;
        oldDebtPaidTotal += oldPaid;
        oldDebtRemainingTotal += oldRem;
      }
      penaltiesTotal += pen;
      surchargesTotal += sur;

      // ยอดชำระหนี้เก่าไม่นำไปบวกในช่องรับจริง (บวกเพิ่มเฉพาะในช่องรับชำระหนี้เก่า)
      const thisCollected = p2570 + pen + sur;
      const thisRemaining = rem2570 + oldRem;

      totalCollectedAmount += thisCollected;
      totalRemainingAll += thisRemaining;

      if (thisCollected > 0 || oldPaid > 0) {
        paidCount += 1;
      }
      if (thisRemaining === 0 && ((t.afterReliefAmount || 0) > 0 || oldDebt > 0)) {
        fullyPaidCount += 1;
      }
      if (thisRemaining > 0) {
        debtorsCount += 1;
      }
      if (t.isPendingVerification) {
        pendingCount += 1;
        pendingAmount += t.afterReliefAmount || 0;
      }
    });

    return {
      totalCount: currentTaxpayers.length,
      assessedTotal,
      reliefTotal,
      afterReliefTotal,
      payments2570Total,
      remaining2570Total,
      oldDebtorsCount,
      oldDebtTotal,
      oldDebtPaidTotal,
      oldDebtRemainingTotal,
      penaltiesTotal,
      surchargesTotal,
      totalCollectedAmount,
      totalRemainingAll,
      paidCount,
      fullyPaidCount,
      debtorsCount,
      pendingCount,
      pendingAmount,
    };
  }, [currentTaxpayers]);

  // Calculations for Summary Cards
  const estCount = currentTaxData.estimateCount || 0;
  const estAmount = currentTaxData.estimateAmount || 0;
  const actAmount = currentTaxData.collected.amount || 0;
  const actCount = currentTaxData.collected.count || 0;

  const diffCount = actCount - estCount;
  const diffAmount = actAmount - estAmount;
  const percentCollected = estAmount > 0 ? (actAmount / estAmount) * 100 : 0;

  // Smooth search without input stutter or dropped frames
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Pagination State for 60fps smooth rendering
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Filtered taxpayers for table display
  const filteredTaxpayers = useMemo(() => {
    return currentTaxpayers.filter((t) => {
      // Search
      const matchSearch =
        deferredSearchQuery.trim() === '' ||
        t.name.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
        (t.notes && t.notes.toLowerCase().includes(deferredSearchQuery.toLowerCase()));

      if (!matchSearch) return false;

      // Filter
      if (statusFilter === 'all') return true;
      if (statusFilter === 'has_old_debt') return (t.oldDebtAmount || 0) > 0;
      if (statusFilter === 'no_old_debt') return !t.oldDebtAmount || t.oldDebtAmount === 0;

      const p2570 = (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0);
      const rem2570 = t.remainingBalance !== undefined ? t.remainingBalance : Math.max(0, (t.afterReliefAmount || 0) - p2570);
      const oldDebt = t.oldDebtAmount || 0;
      const oldPaid = t.oldDebtPaid || 0;
      const oldRem = t.oldDebtRemaining !== undefined ? t.oldDebtRemaining : Math.max(0, oldDebt - oldPaid);
      const totalPaid = p2570 + oldPaid + (t.penaltyAmount || 0) + (t.surchargeAmount || 0);
      const totalRemaining = rem2570 + oldRem;

      if (statusFilter === 'has_paid') return totalPaid > 0;
      if (statusFilter === 'fully_paid') return totalRemaining === 0 && ((t.afterReliefAmount || 0) > 0 || oldDebt > 0);
      if (statusFilter === 'unpaid') return totalRemaining > 0;
      if (statusFilter === 'pending_verify') return !!t.isPendingVerification;

      return true;
    });
  }, [currentTaxpayers, deferredSearchQuery, statusFilter]);

  // Reset to first page when search, filter, or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, deferredSearchQuery, statusFilter, pageSize]);

  // Total pages and safe current page
  const totalPages = Math.max(1, Math.ceil(filteredTaxpayers.length / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // Paginated slice: only 25-50 rows in DOM at any time for zero lag
  const paginatedTaxpayers = useMemo(() => {
    if (pageSize >= 99999) return filteredTaxpayers;
    const startIndex = (validCurrentPage - 1) * pageSize;
    return filteredTaxpayers.slice(startIndex, startIndex + pageSize);
  }, [filteredTaxpayers, validCurrentPage, pageSize]);

  // Centralized sync function for tax data
  const syncTaxData = (taxpayersList: TaxpayerRecord[], taxType: 'land' | 'sign') => {
    const tabList = taxpayersList.filter((item) => item.taxType === taxType);
    const baseData = taxType === 'land' ? landTax : signTax;

    const listPayments2570 = tabList.reduce(
      (sum, item) => sum + (item.payment1 || 0) + (item.payment2 || 0) + (item.payment3 || 0),
      0
    );
    const listPenalties = tabList.reduce((sum, item) => sum + (item.penaltyAmount || 0), 0);
    const listSurcharges = tabList.reduce((sum, item) => sum + (item.surchargeAmount || 0), 0);
    // ยอดชำระหนี้เก่าบวกเพิ่มในช่องรับชำระหนี้เก่าเท่านั้น ไม่นำไปบวกในช่องรับจริง
    const totalCollectedFromList = listPayments2570 + listPenalties + listSurcharges;

    const totalRemainingDebt = tabList.reduce((sum, item) => {
      const rem2570 = item.remainingBalance !== undefined ? item.remainingBalance : Math.max(0, (item.afterReliefAmount || 0) - ((item.payment1 || 0) + (item.payment2 || 0) + (item.payment3 || 0)));
      const oldRem = item.oldDebtRemaining !== undefined ? item.oldDebtRemaining : Math.max(0, (item.oldDebtAmount || 0) - (item.oldDebtPaid || 0));
      return sum + rem2570 + oldRem;
    }, 0);

    const debtorsCount = tabList.filter((item) => {
      const rem2570 = item.remainingBalance !== undefined ? item.remainingBalance : Math.max(0, (item.afterReliefAmount || 0) - ((item.payment1 || 0) + (item.payment2 || 0) + (item.payment3 || 0)));
      const oldRem = item.oldDebtRemaining !== undefined ? item.oldDebtRemaining : Math.max(0, (item.oldDebtAmount || 0) - (item.oldDebtPaid || 0));
      return (rem2570 + oldRem) > 0;
    }).length;

    const updatedTaxData: DetailedTaxData = {
      ...baseData,
      collected: {
        count: tabList.filter((item) => {
          const p = (item.payment1 || 0) + (item.payment2 || 0) + (item.payment3 || 0) + (item.penaltyAmount || 0) + (item.surchargeAmount || 0);
          return p > 0;
        }).length,
        amount: totalCollectedFromList > 0 ? totalCollectedFromList : baseData.collected.amount,
      },
      debtors: {
        count: debtorsCount,
        amount: totalRemainingDebt,
      },
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    if (taxType === 'land') {
      onUpdateLandTax(updatedTaxData);
    } else {
      onUpdateSignTax(updatedTaxData);
    }
  };

  // Open Add Modal
  const handleOpenAddTaxpayer = () => {
    if (!canEdit) return;
    setEditingTaxpayer(null);
    setTaxpayerForm({
      name: '',
      assessedAmount: '',
      reliefAmount: 0,
      status: 0,
      payment1: 0,
      payment2: 0,
      payment3: 0,
      isPendingVerification: false,
      hasOldDebt: false,
      oldDebtAmount: 0,
      oldDebtStatus: 0,
      oldDebtPaid: 0,
      penaltyAmount: 0,
      surchargeAmount: 0,
      notes: '',
    });
    setIsTaxpayerModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditTaxpayer = (record: TaxpayerRecord) => {
    if (!canEdit) return;
    setEditingTaxpayer(record);
    setTaxpayerForm({
      name: record.name,
      assessedAmount: record.assessedAmount ?? '',
      reliefAmount: record.reliefAmount ?? 0,
      status: record.status ?? 0,
      payment1: record.payment1 ?? 0,
      payment2: record.payment2 ?? 0,
      payment3: record.payment3 ?? 0,
      isPendingVerification: record.isPendingVerification ?? false,
      hasOldDebt: record.hasOldDebt ?? ((record.oldDebtAmount || 0) > 0),
      oldDebtAmount: record.oldDebtAmount ?? 0,
      oldDebtStatus: record.oldDebtStatus ?? 0,
      oldDebtPaid: record.oldDebtPaid ?? 0,
      penaltyAmount: record.penaltyAmount ?? 0,
      surchargeAmount: record.surchargeAmount ?? 0,
      notes: record.notes || '',
    });
    setIsTaxpayerModalOpen(true);
  };

  // Handle Save
  const handleSaveTaxpayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    const assessed = Number(taxpayerForm.assessedAmount) || 0;
    const relief = Number(taxpayerForm.reliefAmount) || 0;
    const afterRelief = Math.max(0, assessed - relief);

    const st = taxpayerForm.status;
    const p1 = st === 0 ? 0 : (Number(taxpayerForm.payment1) || 0);
    const p2 = (st === 2 || st === 3) ? (Number(taxpayerForm.payment2) || 0) : 0;
    const p3 = st === 3 ? (Number(taxpayerForm.payment3) || 0) : 0;
    const totalPaid2570 = p1 + p2 + p3;
    const rem2570 = Math.max(0, afterRelief - totalPaid2570);

    const hasOld = taxpayerForm.hasOldDebt;
    const oldDebt = hasOld ? (Number(taxpayerForm.oldDebtAmount) || 0) : 0;
    const oldSt = hasOld ? taxpayerForm.oldDebtStatus : 0;
    const oldPaid = hasOld && (oldSt === 1 || oldSt === 2) ? (Number(taxpayerForm.oldDebtPaid) || 0) : 0;
    const oldRem = Math.max(0, oldDebt - oldPaid);
    const pen = hasOld ? (Number(taxpayerForm.penaltyAmount) || 0) : 0;
    const sur = hasOld ? (Number(taxpayerForm.surchargeAmount) || 0) : 0;

    const totalRemaining = rem2570 + oldRem;
    const isFully = (afterRelief > 0 || oldDebt > 0) && totalRemaining === 0;

    let updatedList: TaxpayerRecord[];

    if (editingTaxpayer) {
      updatedList = taxpayers.map((item) => {
        if (item.id === editingTaxpayer.id) {
          return {
            ...item,
            name: taxpayerForm.name.trim(),
            assessedAmount: assessed,
            reliefAmount: relief,
            afterReliefAmount: afterRelief,
            status: st,
            payment1: p1,
            payment2: p2,
            payment3: p3,
            remainingBalance: rem2570,
            isFullyPaid: isFully,
            isPendingVerification: taxpayerForm.isPendingVerification,
            hasOldDebt: hasOld,
            oldDebtAmount: oldDebt,
            oldDebtStatus: oldSt,
            oldDebtPaid: oldPaid,
            oldDebtRemaining: oldRem,
            penaltyAmount: pen,
            surchargeAmount: sur,
            notes: taxpayerForm.notes.trim(),
            isOldDebtor: false,
            updatedAt: new Date().toISOString().slice(0, 10),
          };
        }
        return item;
      });
    } else {
      const newRecord: TaxpayerRecord = {
        id: `tp-${activeTab}-${Date.now()}`,
        taxType: activeTab,
        name: taxpayerForm.name.trim(),
        assessedAmount: assessed,
        reliefAmount: relief,
        afterReliefAmount: afterRelief,
        status: st,
        payment1: p1,
        payment2: p2,
        payment3: p3,
        remainingBalance: rem2570,
        isFullyPaid: isFully,
        isPendingVerification: taxpayerForm.isPendingVerification,
        hasOldDebt: hasOld,
        oldDebtAmount: oldDebt,
        oldDebtStatus: oldSt,
        oldDebtPaid: oldPaid,
        oldDebtRemaining: oldRem,
        penaltyAmount: pen,
        surchargeAmount: sur,
        notes: taxpayerForm.notes.trim(),
        isOldDebtor: false,
        updatedAt: new Date().toISOString().slice(0, 10),
      };
      updatedList = [newRecord, ...taxpayers];
    }

    onUpdateTaxpayers(updatedList);
    syncTaxData(updatedList, activeTab);
    setIsTaxpayerModalOpen(false);
  };

  // Delete Record
  const handleDeleteTaxpayer = (id: string, name: string) => {
    if (!canEdit) return;
    if (confirm(`คุณต้องการลบรายชื่อ "${name}" ออกจากระบบหรือไม่?`)) {
      const updatedList = taxpayers.filter((t) => t.id !== id);
      onUpdateTaxpayers(updatedList);
      syncTaxData(updatedList, activeTab);
    }
  };

  // Open Global Estimate & Aggregates Modal
  const handleOpenEstimateModal = () => {
    if (!canEdit) return;
    setEstimateFormData({
      estimateCount: currentTaxData.estimateCount || currentTaxData.taxpayers.count,
      estimateAmount: currentTaxData.estimateAmount,
      collectedCount: currentTaxData.collected.count,
      collectedAmount: currentTaxData.collected.amount,
      taxpayersCount: currentTaxData.taxpayers.count,
      taxpayersAmount: currentTaxData.taxpayers.amount,
      debtorsCount: currentTaxData.debtors.count,
      debtorsAmount: currentTaxData.debtors.amount,
      pendingCount: currentTaxData.pendingVerification.count,
      pendingAmount: currentTaxData.pendingVerification.amount,
    });
    setIsEstimateModalOpen(true);
  };

  // Save Global Estimate & Aggregates Modal
  const handleSaveEstimate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    const updated: DetailedTaxData = {
      ...currentTaxData,
      estimateCount: Number(estimateFormData.estimateCount) || 0,
      estimateAmount: Number(estimateFormData.estimateAmount) || 0,
      collected: {
        count: Number(estimateFormData.collectedCount) || 0,
        amount: Number(estimateFormData.collectedAmount) || 0,
      },
      taxpayers: {
        count: Number(estimateFormData.taxpayersCount) || 0,
        amount: Number(estimateFormData.taxpayersAmount) || 0,
      },
      debtors: {
        count: Number(estimateFormData.debtorsCount) || 0,
        amount: Number(estimateFormData.debtorsAmount) || 0,
      },
      pendingVerification: {
        count: Number(estimateFormData.pendingCount) || 0,
        amount: Number(estimateFormData.pendingAmount) || 0,
      },
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    if (activeTab === 'land') {
      onUpdateLandTax(updated);
    } else {
      onUpdateSignTax(updated);
    }
    setIsEstimateModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Tab Switcher & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <Landmark className="w-6 h-6 text-blue-900" />
            <h2 className="text-xl font-bold text-slate-900">
              ระบบติดตามผลการจัดเก็บภาษีที่ดินและสิ่งปลูกสร้าง และภาษีป้าย
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            ทะเบียนคุมรวมรายชื่อผู้เสียภาษีประจำปี 2570 และลูกหนี้ภาษีเก่าเข้าด้วยกันตามชื่อผู้เสียภาษี เทศบาลเมืองมหาสารคาม
          </p>
        </div>

        {/* Tab Buttons (Land vs Sign) */}
        <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('land')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'land'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <span>ภาษีที่ดินและสิ่งปลูกสร้าง</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                activeTab === 'land'
                  ? 'bg-blue-800 text-blue-100'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {taxpayers.filter((t) => t.taxType === 'land').length} ราย
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sign')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'sign'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <span>ภาษีป้าย</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                activeTab === 'sign'
                  ? 'bg-blue-800 text-blue-100'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {taxpayers.filter((t) => t.taxType === 'sign').length} ราย
            </span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Summary Cards Grid (6 KPI Metrics) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: ประมาณการ */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              ประมาณการ
            </span>
            {canEdit && (
              <button
                onClick={handleOpenEstimateModal}
                className="text-xs text-blue-800 hover:text-blue-900 font-semibold flex items-center space-x-1"
                title="ปรับปรุงยอดประมาณการ"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>ปรับยอด</span>
              </button>
            )}
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">จำนวน:</span>
              <span className="font-extrabold text-slate-800 text-sm">
                {formatNumber(estCount)} ราย
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">เป็นเงิน:</span>
              <span className="font-black text-slate-900 text-lg sm:text-xl">
                ฿{formatCurrency(estAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: รับจริง (ยอดจัดเก็บจริง ไม่รวมยอดชำระหนี้เก่า) */}
        <div className="bg-emerald-50/40 rounded-2xl p-4 sm:p-5 border border-emerald-200/90 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>รับจริง</span>
            </span>
            <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
              {percentCollected.toFixed(2)}%
            </span>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">จำนวน:</span>
              <span className="font-extrabold text-slate-800 text-sm">
                {formatNumber(actCount)} ราย
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">เป็นเงิน:</span>
              <span className="font-black text-emerald-800 text-lg sm:text-xl">
                ฿{formatCurrency(actAmount)}
              </span>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-emerald-700 font-medium bg-emerald-100/60 p-1.5 rounded-lg text-center">
            คำนวณจาก: ยอดชำระปี 2570 + เบี้ยปรับ + เงินเพิ่ม (ไม่นำยอดชำระหนี้เก่าไปบวกในช่องรับจริง)
          </div>
        </div>

        {/* Card 3: ผลต่าง */}
        <div
          className={`rounded-2xl p-4 sm:p-5 border shadow-xs relative overflow-hidden ${
            diffAmount >= 0
              ? 'bg-teal-50/40 border-teal-200'
              : 'bg-rose-50/30 border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
              <TrendingUp className="w-4 h-4 text-slate-600" />
              <span>ผลต่าง (สูง/ต่ำกว่าเป้า)</span>
            </span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                diffAmount >= 0
                  ? 'bg-teal-100 text-teal-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {diffAmount >= 0 ? 'สูงกว่าเป้า' : 'ต่ำกว่าเป้า'}
            </span>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">จำนวน:</span>
              <span className="font-extrabold text-slate-800 text-sm">
                {diffCount >= 0 ? `+${formatNumber(diffCount)}` : formatNumber(diffCount)} ราย
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">เป็นเงิน:</span>
              <span
                className={`font-black text-lg sm:text-xl ${
                  diffAmount >= 0 ? 'text-teal-700' : 'text-rose-600'
                }`}
              >
                {diffAmount >= 0 ? `+฿${formatCurrency(diffAmount)}` : `-฿${formatCurrency(Math.abs(diffAmount))}`
                }
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: ผู้มีหน้าที่เสียภาษี */}
        <div className="bg-blue-50/40 rounded-2xl p-4 sm:p-5 border border-blue-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-950 flex items-center space-x-1.5">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span>ผู้มีหน้าที่เสียภาษี</span>
            </span>
            <span className="text-[11px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">
              ยอดประเมิน 2570
            </span>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">จำนวน:</span>
              <span className="font-extrabold text-slate-800 text-sm">
                {formatNumber(listStats.totalCount)} ราย
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">เป็นเงิน:</span>
              <span className="font-black text-blue-950 text-lg sm:text-xl">
                ฿{formatCurrency(listStats.assessedTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 5: ตั้งลูกหนี้ (ค้างชำระ) */}
        <div className="bg-amber-50/40 rounded-2xl p-4 sm:p-5 border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-950 flex items-center space-x-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>ตั้งลูกหนี้ (ค้างชำระ)</span>
            </span>
            <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
              หนี้ค้างชำระรวม
            </span>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">จำนวน:</span>
              <span className="font-extrabold text-slate-800 text-sm">
                {formatNumber(listStats.debtorsCount)} ราย
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">เป็นเงิน:</span>
              <span className="font-black text-amber-950 text-lg sm:text-xl">
                ฿{formatCurrency(listStats.totalRemainingAll)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 6: อยู่ระหว่างตรวจสอบข้อมูล */}
        <div className="bg-purple-50/40 rounded-2xl p-4 sm:p-5 border border-purple-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-950 flex items-center space-x-1.5">
              <AlertTriangle className="w-4 h-4 text-purple-600" />
              <span>อยู่ระหว่างตรวจสอบข้อมูล</span>
            </span>
            <span className="text-[11px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-md">
              รอตรวจสอบ
            </span>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">จำนวน:</span>
              <span className="font-extrabold text-slate-800 text-sm">
                {formatNumber(listStats.pendingCount)} ราย
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500">เป็นเงิน:</span>
              <span className="font-black text-purple-900 text-lg sm:text-xl">
                ฿{formatCurrency(listStats.pendingAmount)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: ทะเบียนคุมรายชื่อผู้เสียภาษีและลูกหนี้ภาษีเก่า (รวมอ้างอิงชื่อเดียวกัน) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header & Action Controls */}
        <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">
                  เมนูรายชื่อผู้เสียภาษีและลูกหนี้ภาษีเก่า ({currentTaxTitle})
                </h3>
                <p className="text-xs text-indigo-200 mt-0.5">
                  รวมข้อมูลผู้เสียภาษีประจำปี 2570 และลูกหนี้ภาษีเก่าเข้าด้วยกัน โดยยอดชำระหนี้เก่าบวกเพิ่มเฉพาะในช่องรับชำระหนี้เก่า (ไม่บวกในช่องรับจริง)
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => exportTaxpayersToExcel(taxpayers, activeTab)}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-xs"
              title="ดาวน์โหลดทะเบียนคุมรายชื่อเป็น Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
              <span>ดาวน์โหลด Excel</span>
            </button>

            {canEdit && (
              <button
                onClick={handleOpenAddTaxpayer}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-xs"
                title="เพิ่มรายชื่อผู้เสียภาษี"
              >
                <PlusCircle className="w-4 h-4" />
                <span>เพิ่มรายชื่อผู้เสียภาษี</span>
              </button>
            )}
          </div>
        </div>

        {/* 4-Box Summary Strip */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Box 1: ภาษีประจำปี 2570 */}
            <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200">
              <span className="text-[11px] font-bold text-blue-900 block">1. ภาษีประจำปี 2570</span>
              <div className="mt-1.5 space-y-0.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>ประเมินสุทธิ:</span>
                  <span className="font-bold text-slate-800">฿{formatCurrency(listStats.afterReliefTotal)}</span>
                </div>
                <div className="flex justify-between text-blue-800 font-semibold">
                  <span>รับชำระแล้ว:</span>
                  <span>฿{formatCurrency(listStats.payments2570Total)}</span>
                </div>
                <div className="flex justify-between text-rose-700 font-semibold">
                  <span>คงเหลือ 2570:</span>
                  <span>฿{formatCurrency(listStats.remaining2570Total)}</span>
                </div>
              </div>
            </div>

            {/* Box 2: ลูกหนี้ภาษีเก่า */}
            <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
              <span className="text-[11px] font-bold text-amber-900 block">
                2. ลูกหนี้ภาษีเก่า ({listStats.oldDebtorsCount} ราย)
              </span>
              <div className="mt-1.5 space-y-0.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>หนี้เก่ารวม:</span>
                  <span className="font-bold text-slate-800">฿{formatCurrency(listStats.oldDebtTotal)}</span>
                </div>
                <div className="flex justify-between text-blue-900 font-bold bg-blue-100/60 px-1 py-0.5 rounded">
                  <span>รับชำระหนี้เก่า:</span>
                  <span>฿{formatCurrency(listStats.oldDebtPaidTotal)}</span>
                </div>
                <div className="text-[10px] text-blue-700 font-medium">
                  *บวกเพิ่มเฉพาะช่องนี้ (ไม่บวกในช่องรับจริง)
                </div>
                <div className="flex justify-between text-rose-700 font-semibold pt-0.5">
                  <span>คงเหลือหนี้เก่า:</span>
                  <span>฿{formatCurrency(listStats.oldDebtRemainingTotal)}</span>
                </div>
              </div>
            </div>

            {/* Box 3: เบี้ยปรับ + เงินเพิ่ม */}
            <div className="bg-purple-50/60 p-3.5 rounded-xl border border-purple-200">
              <span className="text-[11px] font-bold text-purple-900 block">3. เบี้ยปรับ + เงินเพิ่ม</span>
              <div className="mt-1.5 space-y-0.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>เบี้ยปรับ:</span>
                  <span className="font-bold text-slate-800">฿{formatCurrency(listStats.penaltiesTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>เงินเพิ่ม:</span>
                  <span className="font-bold text-slate-800">฿{formatCurrency(listStats.surchargesTotal)}</span>
                </div>
                <div className="flex justify-between text-purple-900 font-bold border-t border-purple-200 pt-0.5">
                  <span>รวมเบี้ยปรับ+เงินเพิ่ม:</span>
                  <span>฿{formatCurrency(listStats.penaltiesTotal + listStats.surchargesTotal)}</span>
                </div>
              </div>
            </div>

            {/* Box 4: รวมผลการจัดเก็บ (รับจริง) */}
            <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-900 block">4. รวมผลการจัดเก็บ (รับจริง)</span>
              <div className="mt-1.5 space-y-0.5 text-xs">
                <div className="flex justify-between text-emerald-900 font-extrabold">
                  <span>รับจริง (ไม่รวมหนี้เก่า):</span>
                  <span className="text-emerald-800 text-sm">฿{formatCurrency(listStats.totalCollectedAmount)}</span>
                </div>
                <div className="flex justify-between text-blue-900 font-semibold">
                  <span>รับชำระหนี้เก่า:</span>
                  <span>฿{formatCurrency(listStats.oldDebtPaidTotal)}</span>
                </div>
                <div className="flex justify-between text-rose-800 font-semibold">
                  <span>หนี้ค้างชำระคงเหลือ:</span>
                  <span>฿{formatCurrency(listStats.totalRemainingAll)}</span>
                </div>
                <div className="text-[10px] text-slate-500 pt-0.5">
                  ชำระครบถ้วน {listStats.fullyPaidCount} ราย / ค้าง {listStats.debtorsCount} ราย
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อผู้เสียภาษี / ลูกหนี้ภาษีเก่า / หมายเหตุ..."
              className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium text-slate-700"
            >
              <option value="all">รายชื่อทั้งหมด ({currentTaxpayers.length} ราย)</option>
              <option value="has_old_debt">มีลูกหนี้ภาษีเก่า ({listStats.oldDebtorsCount} ราย)</option>
              <option value="no_old_debt">ไม่มีลูกหนี้ภาษีเก่า</option>
              <option value="has_paid">มีการชำระเงินแล้ว ({listStats.paidCount} ราย)</option>
              <option value="fully_paid">ชำระครบถ้วนทั้งหมด ({listStats.fullyPaidCount} ราย)</option>
              <option value="unpaid">ยังคงค้างชำระ ({listStats.debtorsCount} ราย)</option>
              <option value="pending_verify">อยู่ระหว่างตรวจสอบ ({listStats.pendingCount} ราย)</option>
            </select>
          </div>
        </div>

        {/* Note Banner */}
        <div className="px-5 py-2.5 bg-blue-50/70 border-b border-blue-100 text-xs text-blue-900 flex items-center space-x-2">
          <span>📌</span>
          <span className="font-medium">
            <span className="font-bold">รวมข้อมูลอ้างอิงชื่อเดียวกัน:</span> ผู้เสียภาษีแต่ละรายจะแสดงทั้งยอดภาษีประจำปี 2570 และยอดลูกหนี้ภาษีเก่าในแถวเดียวกัน โดยยอดรับชำระทั้งหมด พร้อมเบี้ยปรับและเงินเพิ่ม จะถูกคำนวณบวกเพิ่มในช่อง &quot;รับจริง&quot; ของระบบอัตโนมัติ
          </span>
        </div>

        {/* Multi-column Table: Unified 2570 + Old Debt */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              {/* Row 1: Group Headers */}
              <tr className="bg-slate-200 text-slate-800 text-[11px] font-black uppercase tracking-wider border-b border-slate-300">
                <th rowSpan={2} className="py-3 px-3 text-center w-12 border-r border-slate-300">ลำดับ</th>
                <th rowSpan={2} className="py-3 px-4 min-w-[200px] border-r border-slate-300">ชื่อผู้เสียภาษี / รายการ</th>
                <th colSpan={6} className="py-2 px-3 text-center bg-blue-900/10 text-blue-950 border-r border-blue-200">
                  ข้อมูลภาษีประจำปี พ.ศ. 2570
                </th>
                <th colSpan={4} className="py-2 px-3 text-center bg-amber-500/15 text-amber-950 border-r border-amber-300">
                  ข้อมูลลูกหนี้ภาษีเก่า
                </th>
                <th colSpan={2} className="py-2 px-3 text-center bg-emerald-600/15 text-emerald-950 border-r border-emerald-300">
                  รวมผลการจัดเก็บและรับจริง
                </th>
                <th rowSpan={2} className="py-3 px-3 min-w-[150px] border-r border-slate-300">หมายเหตุ</th>
                {canEdit && <th rowSpan={2} className="py-3 px-3 text-center w-20">จัดการ</th>}
              </tr>

              {/* Row 2: Sub Headers */}
              <tr className="bg-slate-100 text-slate-700 text-[10px] font-bold border-b border-slate-300">
                {/* 2570 Columns */}
                <th className="py-2 px-2.5 text-right min-w-[95px] bg-blue-50/50 border-r border-blue-100">ยอดประเมิน</th>
                <th className="py-2 px-2 text-right min-w-[80px] bg-blue-50/50 border-r border-blue-100">บรรเทา</th>
                <th className="py-2 px-2.5 text-right min-w-[95px] bg-blue-50/50 border-r border-blue-100 font-black">หลังบรรเทา</th>
                <th className="py-2 px-2 text-center min-w-[95px] bg-blue-50/50 border-r border-blue-100">สถานะ 2570</th>
                <th className="py-2 px-2.5 text-right min-w-[95px] bg-blue-100/60 text-blue-950 border-r border-blue-200 font-black">ชำระแล้ว 2570</th>
                <th className="py-2 px-2.5 text-right min-w-[95px] bg-rose-50/40 text-rose-900 border-r border-blue-200">คงเหลือ 2570</th>

                {/* Old Debt Columns */}
                <th className="py-2 px-2.5 text-right min-w-[95px] bg-amber-50/60 text-amber-950 border-r border-amber-200 font-bold">ยอดหนี้เก่า</th>
                <th className="py-2 px-2.5 text-right min-w-[95px] bg-blue-50/60 text-blue-950 border-r border-amber-200 font-bold" title="บวกเพิ่มในช่องรับชำระหนี้เก่าเท่านั้น ไม่นำไปบวกในช่องรับจริง">ชำระหนี้เก่า</th>
                <th className="py-2 px-2 text-right min-w-[90px] bg-purple-50/50 text-purple-950 border-r border-amber-200">เบี้ยปรับ+เงินเพิ่ม</th>
                <th className="py-2 px-2.5 text-right min-w-[95px] bg-rose-50/60 text-rose-950 border-r border-amber-300 font-bold">คงเหลือหนี้เก่า</th>

                {/* Combined Columns */}
                <th className="py-2 px-3 text-right min-w-[110px] bg-emerald-100/70 text-emerald-950 border-r border-emerald-200 font-black">
                  รับจริง (บาท)
                  <span className="block text-[9px] font-normal text-emerald-800">(ไม่รวมหนี้เก่า)</span>
                </th>
                <th className="py-2 px-3 text-right min-w-[100px] bg-slate-100 text-slate-900 border-r border-emerald-300 font-black">รวมคงเหลือ</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredTaxpayers.length === 0 ? (
                <tr>
                  <td
                    colSpan={canEdit ? 16 : 15}
                    className="py-10 text-center text-slate-400 text-xs"
                  >
                    ไม่พบรายชื่อผู้เสียภาษีตามเงื่อนไขที่ค้นหา
                  </td>
                </tr>
              ) : (
                paginatedTaxpayers.map((t, idx) => {
                  const p2570 = (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0);
                  const rem2570 = t.remainingBalance !== undefined ? t.remainingBalance : Math.max(0, (t.afterReliefAmount || 0) - p2570);
                  const oldDebt = t.oldDebtAmount || 0;
                  const oldPaid = t.oldDebtPaid || 0;
                  const pen = t.penaltyAmount || 0;
                  const sur = t.surchargeAmount || 0;
                  const oldRem = t.oldDebtRemaining !== undefined ? t.oldDebtRemaining : Math.max(0, oldDebt - oldPaid);
                  // ยอดชำระหนี้เก่าไม่นำไปบวกในช่องรับจริง (บวกเพิ่มเฉพาะในช่องรับชำระหนี้เก่า)
                  const actualCollectedThisRow = p2570 + pen + sur;
                  const totalRemThisRow = rem2570 + oldRem;
                  const rowNumber = (validCurrentPage - 1) * (pageSize >= 99999 ? 0 : pageSize) + idx + 1;

                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        totalRemThisRow === 0 && ((t.afterReliefAmount || 0) > 0 || oldDebt > 0)
                          ? 'bg-emerald-50/20'
                          : totalRemThisRow > 0
                          ? 'bg-amber-50/10'
                          : ''
                      }`}
                    >
                      {/* 1. ลำดับ */}
                      <td className="py-3 px-3 text-center font-medium text-slate-400 border-r border-slate-100">
                        {rowNumber}
                      </td>

                      {/* 2. ชื่อผู้เสียภาษี */}
                      <td className="py-3 px-4 border-r border-slate-100">
                        <div className="font-bold text-slate-900">
                          {t.name}
                        </div>
                        {t.isPendingVerification && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-semibold">
                            อยู่ระหว่างตรวจสอบข้อมูล
                          </span>
                        )}
                        {oldDebt > 0 && (
                          <span className="inline-block mt-1 ml-1 px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded text-[9px] font-bold">
                            มีหนี้ภาษีเก่า
                          </span>
                        )}
                      </td>

                      {/* 3. ยอดประเมิน 2570 */}
                      <td className="py-3 px-2.5 text-right text-slate-700 bg-blue-50/10 border-r border-slate-100">
                        ฿{formatCurrency(t.assessedAmount)}
                      </td>

                      {/* 4. ยอดบรรเทา */}
                      <td className="py-3 px-2 text-right text-slate-500 bg-blue-50/10 border-r border-slate-100">
                        {t.reliefAmount && t.reliefAmount > 0 ? `฿${formatCurrency(t.reliefAmount)}` : '-'}
                      </td>

                      {/* 5. ยอดหลังบรรเทา */}
                      <td className="py-3 px-2.5 text-right font-bold text-slate-900 bg-blue-50/20 border-r border-slate-100">
                        ฿{formatCurrency(t.afterReliefAmount)}
                      </td>

                      {/* 6. สถานะ 2570 */}
                      <td className="py-3 px-2 text-center border-r border-slate-100">
                        {t.status === 0 && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            0=ยังไม่ชำระ
                          </span>
                        )}
                        {t.status === 1 && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            1=ชำระแล้ว
                          </span>
                        )}
                        {t.status === 2 && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            2=งวดที่ 2
                          </span>
                        )}
                        {t.status === 3 && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                            3=งวดที่ 3
                          </span>
                        )}
                      </td>

                      {/* 7. ชำระแล้ว 2570 */}
                      <td className="py-3 px-2.5 text-right font-bold text-blue-900 bg-blue-50/30 border-r border-blue-100">
                        {p2570 > 0 ? `฿${formatCurrency(p2570)}` : '-'}
                      </td>

                      {/* 8. คงเหลือ 2570 */}
                      <td
                        className={`py-3 px-2.5 text-right font-bold border-r border-blue-200 ${
                          rem2570 === 0 ? 'text-slate-400' : 'text-rose-700'
                        }`}
                      >
                        {rem2570 > 0 ? `฿${formatCurrency(rem2570)}` : '฿0.00'}
                      </td>

                      {/* 9. ยอดหนี้เก่า */}
                      <td className="py-3 px-2.5 text-right font-bold text-amber-950 bg-amber-50/20 border-r border-amber-100">
                        {oldDebt > 0 ? `฿${formatCurrency(oldDebt)}` : '-'}
                      </td>

                      {/* 10. ชำระหนี้เก่า */}
                      <td className="py-3 px-2.5 text-right font-bold text-blue-900 bg-blue-50/20 border-r border-amber-100">
                        {oldPaid > 0 ? `฿${formatCurrency(oldPaid)}` : '-'}
                      </td>

                      {/* 11. เบี้ยปรับ+เงินเพิ่ม */}
                      <td className="py-3 px-2 text-right font-medium text-purple-900 bg-purple-50/15 border-r border-amber-100">
                        {(pen + sur) > 0 ? `฿${formatCurrency(pen + sur)}` : '-'}
                      </td>

                      {/* 12. คงเหลือหนี้เก่า */}
                      <td
                        className={`py-3 px-2.5 text-right font-bold border-r border-amber-300 ${
                          oldRem === 0 && oldDebt > 0 ? 'text-slate-400' : oldRem > 0 ? 'text-rose-700 bg-rose-50/20' : 'text-slate-400'
                        }`}
                      >
                        {oldDebt > 0 ? (oldRem > 0 ? `฿${formatCurrency(oldRem)}` : '฿0.00') : '-'}
                      </td>

                      {/* 13. รับจริง (2570 + เบี้ยปรับ + เงินเพิ่ม ไม่รวมหนี้เก่า) */}
                      <td className="py-3 px-3 text-right font-black text-emerald-800 bg-emerald-50/40 border-r border-emerald-100" title="ยอดชำระปี 2570 + เบี้ยปรับ + เงินเพิ่ม (ไม่นำยอดชำระหนี้เก่าไปบวกในช่องรับจริง)">
                        {actualCollectedThisRow > 0 ? `฿${formatCurrency(actualCollectedThisRow)}` : '฿0.00'}
                      </td>

                      {/* 14. รวมคงเหลือทั้งสิ้น */}
                      <td
                        className={`py-3 px-3 text-right font-black border-r border-emerald-200 ${
                          totalRemThisRow === 0 ? 'text-emerald-700 bg-emerald-50/20' : 'text-rose-700 bg-rose-50/20'
                        }`}
                      >
                        {totalRemThisRow > 0 ? `฿${formatCurrency(totalRemThisRow)}` : '฿0.00'}
                      </td>

                      {/* 15. หมายเหตุ */}
                      <td className="py-3 px-3 text-slate-600 text-xs border-r border-slate-100">
                        {t.notes || '-'}
                      </td>

                      {/* 16. จัดการ */}
                      {canEdit && (
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => handleOpenEditTaxpayer(t)}
                              className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                              title="แก้ไขข้อมูลผู้เสียภาษี"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTaxpayer(t.id, t.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                              title="ลบรายชื่อนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer Summary */}
            <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300 text-xs">
              <tr>
                <td className="py-3.5 px-3 text-center">#</td>
                <td className="py-3.5 px-4 font-black">
                  รวม {filteredTaxpayers.length} ราย
                </td>

                {/* 2570 ยอดประเมิน */}
                <td className="py-3.5 px-2.5 text-right font-black text-slate-900">
                  ฿{formatCurrency(filteredTaxpayers.reduce((s, t) => s + (t.assessedAmount || 0), 0))}
                </td>

                {/* 2570 ยอดบรรเทา */}
                <td className="py-3.5 px-2 text-right font-bold text-slate-600">
                  ฿{formatCurrency(filteredTaxpayers.reduce((s, t) => s + (t.reliefAmount || 0), 0))}
                </td>

                {/* 2570 ยอดหลังบรรเทา */}
                <td className="py-3.5 px-2.5 text-right font-black text-blue-950">
                  ฿{formatCurrency(filteredTaxpayers.reduce((s, t) => s + (t.afterReliefAmount || 0), 0))}
                </td>

                <td className="py-3.5 px-2 text-center text-slate-400">-</td>

                {/* 2570 ชำระแล้ว */}
                <td className="py-3.5 px-2.5 text-right font-black text-blue-900 bg-blue-100/50">
                  ฿{formatCurrency(
                    filteredTaxpayers.reduce(
                      (s, t) => s + (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0),
                      0
                    )
                  )}
                </td>

                {/* 2570 คงเหลือ */}
                <td className="py-3.5 px-2.5 text-right font-black text-rose-700 bg-rose-100/40">
                  ฿{formatCurrency(
                    filteredTaxpayers.reduce((s, t) => {
                      const p = (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0);
                      const rem = t.remainingBalance !== undefined ? t.remainingBalance : Math.max(0, (t.afterReliefAmount || 0) - p);
                      return s + rem;
                    }, 0)
                  )}
                </td>

                {/* หนี้เก่ารวม */}
                <td className="py-3.5 px-2.5 text-right font-black text-amber-950 bg-amber-100/50">
                  ฿{formatCurrency(filteredTaxpayers.reduce((s, t) => s + (t.oldDebtAmount || 0), 0))}
                </td>

                {/* ชำระหนี้เก่า */}
                <td className="py-3.5 px-2.5 text-right font-black text-blue-900 bg-blue-100/50">
                  ฿{formatCurrency(filteredTaxpayers.reduce((s, t) => s + (t.oldDebtPaid || 0), 0))}
                </td>

                {/* เบี้ยปรับ + เงินเพิ่ม */}
                <td className="py-3.5 px-2 text-right font-black text-purple-900 bg-purple-100/40">
                  ฿{formatCurrency(
                    filteredTaxpayers.reduce(
                      (s, t) => s + (t.penaltyAmount || 0) + (t.surchargeAmount || 0),
                      0
                    )
                  )}
                </td>

                {/* คงเหลือหนี้เก่า */}
                <td className="py-3.5 px-2.5 text-right font-black text-rose-700 bg-rose-100/50">
                  ฿{formatCurrency(
                    filteredTaxpayers.reduce((s, t) => {
                      const rem = t.oldDebtRemaining !== undefined ? t.oldDebtRemaining : Math.max(0, (t.oldDebtAmount || 0) - (t.oldDebtPaid || 0));
                      return s + rem;
                    }, 0)
                  )}
                </td>

                {/* รับจริง */}
                <td className="py-3.5 px-3 text-right font-black text-emerald-900 bg-emerald-100/60" title="ยอดรับจริงไม่รวมยอดชำระหนี้เก่า (ยอดชำระหนี้เก่าบวกเพิ่มเฉพาะในช่องรับชำระหนี้เก่า)">
                  ฿{formatCurrency(
                    filteredTaxpayers.reduce((s, t) => {
                      const p2570 = (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0);
                      return s + p2570 + (t.penaltyAmount || 0) + (t.surchargeAmount || 0);
                    }, 0)
                  )}
                </td>

                {/* รวมคงเหลือทั้งสิ้น */}
                <td className="py-3.5 px-3 text-right font-black text-rose-800 bg-rose-100/60">
                  ฿{formatCurrency(
                    filteredTaxpayers.reduce((s, t) => {
                      const rem2570 = t.remainingBalance !== undefined ? t.remainingBalance : Math.max(0, (t.afterReliefAmount || 0) - ((t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0)));
                      const oldRem = t.oldDebtRemaining !== undefined ? t.oldDebtRemaining : Math.max(0, (t.oldDebtAmount || 0) - (t.oldDebtPaid || 0));
                      return s + rem2570 + oldRem;
                    }, 0)
                  )}
                </td>

                <td className="py-3.5 px-3 text-slate-500 text-center">-</td>
                {canEdit && <td className="py-3.5 px-3"></td>}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination Toolbar for zero lag */}
        {filteredTaxpayers.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-slate-50/90 border-t border-slate-200 text-xs text-slate-600">
            <div className="flex items-center space-x-2">
              <span>
                แสดงรายการที่{' '}
                <strong className="text-slate-900">
                  {formatNumber((validCurrentPage - 1) * (pageSize >= 99999 ? 0 : pageSize) + 1)}
                </strong>{' '}
                -{' '}
                <strong className="text-slate-900">
                  {formatNumber(
                    pageSize >= 99999
                      ? filteredTaxpayers.length
                      : Math.min(validCurrentPage * pageSize, filteredTaxpayers.length)
                  )}
                </strong>{' '}
                จากทั้งหมด{' '}
                <strong className="text-slate-900">{formatNumber(filteredTaxpayers.length)}</strong> รายการ
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500">แสดงหน้าละ:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value={25}>25 รายการ</option>
                  <option value={50}>50 รายการ</option>
                  <option value={100}>100 รายการ</option>
                  <option value={999999}>ทั้งหมด</option>
                </select>
              </div>

              {pageSize < 99999 && totalPages > 1 && (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={validCurrentPage <= 1}
                    title="หน้าแรก"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={validCurrentPage <= 1}
                    title="ก่อนหน้า"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg">
                    {validCurrentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={validCurrentPage >= totalPages}
                    title="ถัดไป"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={validCurrentPage >= totalPages}
                    title="หน้าสุดท้าย"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: เพิ่ม / แก้ไข รายชื่อผู้เสียภาษีและลูกหนี้ภาษีเก่า (รวมอ้างอิงชื่อเดียวกัน) */}
      {isTaxpayerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">
                  {editingTaxpayer ? 'แก้ไขข้อมูลผู้เสียภาษีและลูกหนี้ภาษีเก่า' : 'เพิ่มรายชื่อผู้เสียภาษีและลูกหนี้ภาษีเก่า'}{' '}
                  ({currentTaxTitle})
                </h3>
              </div>
              <button
                onClick={() => setIsTaxpayerModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveTaxpayer} className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
              {/* SECTION A: ข้อมูลผู้เสียภาษี */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-blue-900" />
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    1. ข้อมูลผู้เสียภาษี (อ้างอิงชื่อเดียวกัน)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    ชื่อผู้เสียภาษี / รายการทรัพย์สิน <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={taxpayerForm.name}
                    onChange={(e) => setTaxpayerForm({ ...taxpayerForm, name: e.target.value })}
                    placeholder="เช่น นายสมชาย บุญมีสุข (อาคารพาณิชย์ ถนนรมย์วิเชียร)"
                    className="w-full p-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium bg-white"
                    required
                  />
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="isPendingVerification"
                    checked={taxpayerForm.isPendingVerification}
                    onChange={(e) =>
                      setTaxpayerForm({
                        ...taxpayerForm,
                        isPendingVerification: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="isPendingVerification" className="text-xs text-slate-700 font-medium cursor-pointer">
                    อยู่ระหว่างตรวจสอบข้อมูล (ยื่นคำร้องคัดค้าน ภ.ด.ส. ๑๐ / ตรวจสอบขนาดหรือพื้นที่)
                  </label>
                </div>
              </div>

              {/* SECTION B: ข้อมูลภาษีประจำปี พ.ศ. 2570 */}
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-3">
                <div className="flex items-center space-x-2">
                  <Coins className="w-4 h-4 text-blue-800" />
                  <span className="text-xs font-black text-blue-950 uppercase tracking-wide">
                    2. ข้อมูลภาษีประจำปี พ.ศ. 2570
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ยอดประเมิน 2570 (บาท)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={taxpayerForm.assessedAmount}
                      onChange={(e) =>
                        setTaxpayerForm({
                          ...taxpayerForm,
                          assessedAmount: e.target.value === '' ? '' : Number(e.target.value),
                        })
                      }
                      placeholder="0.00"
                      className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ยอดบรรเทา (บาท)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={taxpayerForm.reliefAmount}
                      onChange={(e) =>
                        setTaxpayerForm({
                          ...taxpayerForm,
                          reliefAmount: e.target.value === '' ? '' : Number(e.target.value),
                        })
                      }
                      placeholder="0.00"
                      className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-blue-900 mb-1">
                      ยอดหลังบรรเทา (คำนวณอัตโนมัติ)
                    </label>
                    <div className="p-2 text-xs border border-blue-200 rounded-xl bg-blue-100/60 font-black text-blue-950">
                      ฿{formatCurrency(
                        Math.max(
                          0,
                          (Number(taxpayerForm.assessedAmount) || 0) - (Number(taxpayerForm.reliefAmount) || 0)
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* สถานะการชำระปี 2570 */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    สถานะการชำระปี 2570
                  </label>
                  <select
                    value={taxpayerForm.status}
                    onChange={(e) => {
                      const newStatus = Number(e.target.value) as TaxPaymentStatus;
                      const calculatedAfterRelief = Math.max(
                        0,
                        (Number(taxpayerForm.assessedAmount) || 0) - (Number(taxpayerForm.reliefAmount) || 0)
                      );
                      setTaxpayerForm({
                        ...taxpayerForm,
                        status: newStatus,
                        payment1:
                          newStatus === 1 && (!taxpayerForm.payment1 || taxpayerForm.payment1 === 0)
                            ? calculatedAfterRelief
                            : newStatus === 0
                            ? 0
                            : taxpayerForm.payment1,
                        payment2: newStatus < 2 ? 0 : taxpayerForm.payment2,
                        payment3: newStatus < 3 ? 0 : taxpayerForm.payment3,
                      });
                    }}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white font-semibold text-slate-800"
                  >
                    <option value={0}>0 = ยังไม่ชำระ (ตั้งลูกหนี้)</option>
                    <option value={1}>1 = ชำระแล้ว (ครั้งเดียว / งวดที่ 1)</option>
                    <option value={2}>2 = ผ่อนชำระ งวดที่ 2</option>
                    <option value={3}>3 = ผ่อนชำระ งวดที่ 3 (ครบถ้วน)</option>
                  </select>
                </div>

                {/* งวดที่ 1, 2, 3 */}
                {taxpayerForm.status > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-blue-900 mb-1">
                        งวดที่ 1 (บาท)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={taxpayerForm.payment1}
                        onChange={(e) =>
                          setTaxpayerForm({
                            ...taxpayerForm,
                            payment1: e.target.value === '' ? '' : Number(e.target.value),
                          })
                        }
                        className="w-full p-2 text-xs border border-blue-200 rounded-xl bg-white font-bold text-blue-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-blue-900 mb-1">
                        งวดที่ 2 (บาท)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={taxpayerForm.status < 2}
                        value={taxpayerForm.payment2}
                        onChange={(e) =>
                          setTaxpayerForm({
                            ...taxpayerForm,
                            payment2: e.target.value === '' ? '' : Number(e.target.value),
                          })
                        }
                        className="w-full p-2 text-xs border border-blue-200 rounded-xl bg-white font-bold text-blue-900 disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-blue-900 mb-1">
                        งวดที่ 3 (บาท)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={taxpayerForm.status < 3}
                        value={taxpayerForm.payment3}
                        onChange={(e) =>
                          setTaxpayerForm({
                            ...taxpayerForm,
                            payment3: e.target.value === '' ? '' : Number(e.target.value),
                          })
                        }
                        className="w-full p-2 text-xs border border-blue-200 rounded-xl bg-white font-bold text-blue-900 disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION C: ข้อมูลลูกหนี้ภาษีเก่า (รวมอยู่ในชื่อเดียวกัน) */}
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <History className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-black text-amber-950 uppercase tracking-wide">
                      3. ข้อมูลลูกหนี้ภาษีเก่า (รวมอยู่ในชื่อเดียวกัน)
                    </span>
                  </div>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={taxpayerForm.hasOldDebt}
                      onChange={(e) =>
                        setTaxpayerForm({
                          ...taxpayerForm,
                          hasOldDebt: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-amber-900">มีหนี้ภาษีเก่าค้างชำระ</span>
                  </label>
                </div>

                {taxpayerForm.hasOldDebt && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-amber-950 mb-1">
                          ยอดลูกหนี้ภาษีเก่ารวม (บาท)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={taxpayerForm.oldDebtAmount}
                          onChange={(e) =>
                            setTaxpayerForm({
                              ...taxpayerForm,
                              oldDebtAmount: e.target.value === '' ? '' : Number(e.target.value),
                            })
                          }
                          placeholder="0.00"
                          className="w-full p-2 text-xs border border-amber-300 rounded-xl bg-white font-bold text-amber-950"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          สถานะการรับชำระหนี้เก่า
                        </label>
                        <select
                          value={taxpayerForm.oldDebtStatus}
                          onChange={(e) => {
                            const newStatus = Number(e.target.value) as TaxPaymentStatus;
                            setTaxpayerForm({
                              ...taxpayerForm,
                              oldDebtStatus: newStatus,
                              oldDebtPaid:
                                newStatus === 1 && (!taxpayerForm.oldDebtPaid || taxpayerForm.oldDebtPaid === 0)
                                  ? (taxpayerForm.oldDebtAmount || 0)
                                  : newStatus === 0
                                  ? 0
                                  : taxpayerForm.oldDebtPaid,
                            });
                          }}
                          className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white font-semibold text-slate-800"
                        >
                          <option value={0}>0 = ยังไม่ชำระ (ตั้งลูกหนี้)</option>
                          <option value={1}>1 = ชำระแล้ว</option>
                          <option value={2}>2 = ชำระบางส่วน</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-blue-900 mb-1">
                          ยอดรับชำระหนี้เก่า (บาท)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={taxpayerForm.oldDebtStatus === 0}
                          value={taxpayerForm.oldDebtPaid}
                          onChange={(e) =>
                            setTaxpayerForm({
                              ...taxpayerForm,
                              oldDebtPaid: e.target.value === '' ? '' : Number(e.target.value),
                            })
                          }
                          placeholder="0.00"
                          className="w-full p-2 text-xs border border-blue-200 rounded-xl bg-white font-bold text-blue-900 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-purple-900 mb-1">
                          เบี้ยปรับ (บาท)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={taxpayerForm.penaltyAmount}
                          onChange={(e) =>
                            setTaxpayerForm({
                              ...taxpayerForm,
                              penaltyAmount: e.target.value === '' ? '' : Number(e.target.value),
                            })
                          }
                          placeholder="0.00"
                          className="w-full p-2 text-xs border border-purple-200 rounded-xl bg-white font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-purple-900 mb-1">
                          เงินเพิ่ม (บาท)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={taxpayerForm.surchargeAmount}
                          onChange={(e) =>
                            setTaxpayerForm({
                              ...taxpayerForm,
                              surchargeAmount: e.target.value === '' ? '' : Number(e.target.value),
                            })
                          }
                          placeholder="0.00"
                          className="w-full p-2 text-xs border border-purple-200 rounded-xl bg-white font-medium"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION D: สรุปภาพรวมรายนี้ */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
                <span className="text-[11px] font-extrabold text-emerald-950 uppercase tracking-wide block">
                  4. รวมผลการจัดเก็บรายนี้:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-300 shadow-2xs">
                    <span className="text-[10px] text-emerald-800 font-bold block">
                      ยอดรับจริง (ปี 2570 + เบี้ยปรับ + เงินเพิ่ม)
                    </span>
                    <span className="text-base sm:text-lg font-black text-emerald-900">
                      ฿{formatCurrency(
                        (Number(taxpayerForm.payment1) || 0) +
                        (Number(taxpayerForm.payment2) || 0) +
                        (Number(taxpayerForm.payment3) || 0) +
                        (taxpayerForm.hasOldDebt ? (Number(taxpayerForm.penaltyAmount) || 0) : 0) +
                        (taxpayerForm.hasOldDebt ? (Number(taxpayerForm.surchargeAmount) || 0) : 0)
                      )}
                    </span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">
                      *ไม่นำยอดชำระหนี้เก่ามารวม
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-blue-300 shadow-2xs">
                    <span className="text-[10px] text-blue-800 font-bold block">
                      รับชำระหนี้เก่า (บวกเฉพาะช่องนี้)
                    </span>
                    <span className="text-base sm:text-lg font-black text-blue-900">
                      ฿{formatCurrency(
                        taxpayerForm.hasOldDebt ? (Number(taxpayerForm.oldDebtPaid) || 0) : 0
                      )}
                    </span>
                    <span className="text-[9px] text-blue-600 block mt-0.5">
                      *บวกเพิ่มในช่องนี้เท่านั้น
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-rose-300 shadow-2xs">
                    <span className="text-[10px] text-rose-800 font-bold block">
                      รวมหนี้คงเหลือทั้งสิ้น
                    </span>
                    <span className="text-base sm:text-lg font-black text-rose-700">
                      ฿{formatCurrency(
                        Math.max(
                          0,
                          Math.max(
                            0,
                            (Number(taxpayerForm.assessedAmount) || 0) - (Number(taxpayerForm.reliefAmount) || 0)
                          ) -
                          ((Number(taxpayerForm.payment1) || 0) +
                           (Number(taxpayerForm.payment2) || 0) +
                           (Number(taxpayerForm.payment3) || 0))
                        ) +
                        (taxpayerForm.hasOldDebt
                          ? Math.max(
                              0,
                              (Number(taxpayerForm.oldDebtAmount) || 0) - (Number(taxpayerForm.oldDebtPaid) || 0)
                            )
                          : 0)
                      )}
                    </span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">
                      คงเหลือ 2570 + คงเหลือหนี้เก่า
                    </span>
                  </div>
                </div>
              </div>

              {/* หมายเหตุ */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หมายเหตุ / รายละเอียดทรัพย์สิน
                </label>
                <input
                  type="text"
                  value={taxpayerForm.notes}
                  onChange={(e) => setTaxpayerForm({ ...taxpayerForm, notes: e.target.value })}
                  placeholder="เช่น โฉนดเลขที่ 4891 ถ.ผดุงวิถี หรือ รายละเอียดการผ่อนชำระ"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsTaxpayerModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs bg-blue-900 hover:bg-blue-950 text-white rounded-xl font-bold shadow-md flex items-center space-x-1.5"
                >
                  <Save className="w-3.5 h-3.5 text-amber-300" />
                  <span>บันทึกข้อมูล</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ปรับยอดประมาณการ */}
      {isEstimateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">
                  ปรับยอดประมาณการ ({currentTaxTitle})
                </h3>
              </div>
              <button
                onClick={() => setIsEstimateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEstimate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  จำนวน (ราย) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={estimateFormData.estimateCount}
                  onChange={(e) =>
                    setEstimateFormData({
                      ...estimateFormData,
                      estimateCount: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full p-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  จำนวนเงิน (บาท) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={estimateFormData.estimateAmount}
                  onChange={(e) =>
                    setEstimateFormData({
                      ...estimateFormData,
                      estimateAmount: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full p-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-black text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEstimateModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white text-xs rounded-xl font-bold shadow-md flex items-center space-x-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>บันทึกการแก้ไข</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
