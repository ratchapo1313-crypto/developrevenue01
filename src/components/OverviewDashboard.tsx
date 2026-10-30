import React from 'react';
import {
  Landmark,
  PiggyBank,
  ArrowUpRight,
  FileSpreadsheet,
  TableProperties,
  Layers,
  Percent,
  History,
  Receipt,
} from 'lucide-react';
import {
  RevenueCategory,
  DetailedTaxData,
  MarketSummary,
  TaxpayerRecord,
} from '../types/revenue';
import { formatCurrency, formatNumber } from '../utils/excel';

interface OverviewDashboardProps {
  categories: RevenueCategory[];
  landTax: DetailedTaxData;
  signTax: DetailedTaxData;
  marketSummaries?: Record<'night_market' | 'fresh_market', MarketSummary>;
  taxpayers?: TaxpayerRecord[];
  onNavigateTab: (tab: string) => void;
  onOpenExcel: () => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  categories,
  landTax,
  signTax,
  taxpayers = [],
  onNavigateTab,
  onOpenExcel,
}) => {
  // Calculate General Revenue Totals (8 Categories)
  let totalEstimate = 0;
  let totalActual = 0;

  categories.forEach((cat) => {
    cat.items.forEach((item) => {
      totalEstimate += item.estimate || 0;
      totalActual += item.actual || 0;
    });
  });

  const totalPercentage = totalEstimate > 0 ? (totalActual / totalEstimate) * 100 : 0;

  // Aggregate Old Tax Debt Stats for Land Tax and Sign Tax
  const oldDebtorsList = (taxpayers || []).filter(
    (t) => (t.oldDebtAmount && t.oldDebtAmount > 0) || t.hasOldDebt
  );

  let landCount = 0;
  let landDebt = 0;
  let landPaid = 0;
  let landRem = 0;
  let landPenSur = 0;
  let landPaidCount = 0;

  let signCount = 0;
  let signDebt = 0;
  let signPaid = 0;
  let signRem = 0;
  let signPenSur = 0;
  let signPaidCount = 0;

  oldDebtorsList.forEach((t) => {
    const debt = t.oldDebtAmount || 0;
    const paid = t.oldDebtPaid || 0;
    const rem = t.oldDebtRemaining !== undefined ? t.oldDebtRemaining : Math.max(0, debt - paid);
    const penSur = (t.penaltyAmount || 0) + (t.surchargeAmount || 0);

    if (t.taxType === 'land') {
      landCount += 1;
      landDebt += debt;
      landPaid += paid;
      landRem += rem;
      landPenSur += penSur;
      if (paid > 0) landPaidCount += 1;
    } else {
      signCount += 1;
      signDebt += debt;
      signPaid += paid;
      signRem += rem;
      signPenSur += penSur;
      if (paid > 0) signPaidCount += 1;
    }
  });

  return (
    <div className="space-y-6">
      {/* Welcome & Overview Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-800 to-blue-950 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-semibold mb-2 border border-white/15">
              <span>เทศบาลเมืองมหาสารคาม</span>
              <span>•</span>
              <span>ปีงบประมาณ พ.ศ. 2570</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              ภาพรวมผลการจัดเก็บรายได้ เทศบาลเมืองมหาสารคาม
            </h1>
            <p className="text-sm text-blue-100/90 mt-1 max-w-2xl">
              ฝ่ายพัฒนารายได้ กองคลัง ติดตามผลการดำเนินงาน 8 หมวดรายได้ ตรวจสอบสถานะภาษีที่ดินและสิ่งปลูกสร้าง และภาษีป้าย
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => onNavigateTab('categories')}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-semibold shadow-md transition-all flex items-center space-x-2 cursor-pointer"
            >
              <TableProperties className="w-4 h-4" />
              <span>ดู 8 หมวดรายได้</span>
            </button>
            <button
              onClick={() => onNavigateTab('taxes')}
              className="px-4 py-2.5 rounded-xl bg-blue-700/80 hover:bg-blue-600 text-white border border-blue-400/40 text-xs sm:text-sm font-semibold shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Landmark className="w-4 h-4 text-amber-300" />
              <span>ภาษีที่ดิน & ภาษีป้าย</span>
            </button>
            <button
              onClick={onOpenExcel}
              className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs sm:text-sm font-medium transition-all flex items-center space-x-2 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>ส่งออก Excel</span>
            </button>
          </div>
        </div>

        {/* Decorative background shapes */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-blue-600/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-40 -top-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
      </div>

      {/* 4 Main Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Estimated Budget */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">ประมาณการรวมทั้งสิ้น</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <PiggyBank className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              ฿{formatCurrency(totalEstimate)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              เป้าหมายตามเทศบัญญัติงบประมาณ 2570
            </p>
          </div>
        </div>

        {/* Actual Revenue */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">จัดเก็บได้จริง (รับจริง)</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600 tracking-tight">
              ฿{formatCurrency(totalActual)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              ยอดรับจริง 8 หมวดรายได้
            </p>
          </div>
        </div>

        {/* Balance Difference */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">สูง/ต่ำกว่าประมาณการ</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              totalActual >= totalEstimate ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-bold tracking-tight ${
              totalActual >= totalEstimate ? 'text-emerald-600' : 'text-amber-600'
            }`}>
              {totalActual >= totalEstimate ? '+' : '-'}฿{formatCurrency(Math.abs(totalActual - totalEstimate))}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {totalActual >= totalEstimate
                ? `สูงกว่าประมาณการ (+${(totalPercentage - 100).toFixed(2)}%)`
                : `ต่ำกว่าประมาณการ (ยังขาดอีก ${(100 - totalPercentage).toFixed(2)}%)`}
            </p>
          </div>
        </div>

        {/* % Accomplished */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-700">ร้อยละความสำเร็จ</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-indigo-700 tracking-tight">
              {totalPercentage.toFixed(2)}%
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(totalPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Specific Focus: Property & Sign Tax Quickcards (ปี 2570) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Land & Building Tax Quickcard */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                  <Landmark className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">ภาษีที่ดินและสิ่งปลูกสร้าง (ปี 2570)</h3>
              </div>
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                {((landTax.collected.amount / (landTax.estimateAmount || 1)) * 100).toFixed(1)}%
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">ประมาณการ:</span>
                <span className="font-semibold text-slate-800">฿{formatCurrency(landTax.estimateAmount)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">จัดเก็บได้จริง ({formatNumber(landTax.collected.count)} ราย):</span>
                <span className="font-bold text-emerald-600">฿{formatCurrency(landTax.collected.amount)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">ผู้มีหน้าที่เสียภาษี ({formatNumber(landTax.taxpayers.count)} ราย):</span>
                <span className="font-semibold text-slate-700">฿{formatCurrency(landTax.taxpayers.amount)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">ตั้งลูกหนี้ ({formatNumber(landTax.debtors.count)} ราย):</span>
                <span className="font-semibold text-rose-600">฿{formatCurrency(landTax.debtors.amount)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('taxes')}
            className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center justify-between group cursor-pointer"
          >
            <span>ดูรายละเอียดและแก้ไขข้อมูลภาษีที่ดิน</span>
            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>

        {/* Sign Tax Quickcard */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Landmark className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">ภาษีป้าย (ปี 2570)</h3>
              </div>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                {((signTax.collected.amount / (signTax.estimateAmount || 1)) * 100).toFixed(1)}%
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">ประมาณการ:</span>
                <span className="font-semibold text-slate-800">฿{formatCurrency(signTax.estimateAmount)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">จัดเก็บได้จริง ({formatNumber(signTax.collected.count)} ราย):</span>
                <span className="font-bold text-emerald-600">฿{formatCurrency(signTax.collected.amount)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">ผู้มีหน้าที่เสียภาษี ({formatNumber(signTax.taxpayers.count)} ราย):</span>
                <span className="font-semibold text-slate-700">฿{formatCurrency(signTax.taxpayers.amount)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">ตั้งลูกหนี้ ({formatNumber(signTax.debtors.count)} ราย):</span>
                <span className="font-semibold text-rose-600">฿{formatCurrency(signTax.debtors.amount)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('taxes')}
            className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center justify-between group cursor-pointer"
          >
            <span>ดูรายละเอียดและแก้ไขข้อมูลภาษีป้าย</span>
            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* ส่วนแสดงข้อมูล: ลูกหนี้ภาษีเก่าภาษีที่ดินและสิ่งปลูกสร้าง และ ลูกหนี้ภาษีเก่าภาษีป้าย (แสดงเฉพาะสรุปยอด ไม่แสดงรายชื่อ) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <History className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg flex items-center space-x-2">
                <span>ลูกหนี้ภาษีเก่า (ภาษีที่ดินและสิ่งปลูกสร้าง และภาษีป้าย)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                สรุปยอดหนี้ภาษีค้างชำระสะสมปีก่อนหน้า (2563 - 2569) และสถานะการรับชำระ (สรุปยอดรวม ไม่แสดงรายชื่อบุคคล)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3.5 py-1.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs">
              <span className="text-amber-800 mr-1.5 font-medium">ยอดหนี้เก่ารวม 2 ภาษี:</span>
              <span className="font-black text-amber-950">฿{formatCurrency(landDebt + signDebt)}</span>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-blue-50/90 border border-blue-200 text-xs">
              <span className="text-blue-800 mr-1.5 font-medium">รับชำระแล้วรวม:</span>
              <span className="font-black text-blue-900">฿{formatCurrency(landPaid + signPaid)}</span>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-rose-50/90 border border-rose-200 text-xs">
              <span className="text-rose-800 mr-1.5 font-medium">คงเหลือหนี้เก่ารวม:</span>
              <span className="font-black text-rose-700">฿{formatCurrency(landRem + signRem)}</span>
            </div>
          </div>
        </div>

        {/* 2 Focused Summary Cards (Land Tax Debtors & Sign Tax Debtors) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Card 1: ลูกหนี้ภาษีเก่า ภาษีที่ดินและสิ่งปลูกสร้าง */}
          <div className="bg-gradient-to-br from-amber-50/30 via-white to-blue-50/20 rounded-2xl p-5 border border-amber-200/90 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-xs">
                    <Landmark className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                      ลูกหนี้ภาษีเก่าภาษีที่ดินและสิ่งปลูกสร้าง
                    </h4>
                    <span className="text-[11px] text-slate-500">ยอดค้างชำระสะสมปีก่อนหน้า</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-950 font-black text-xs">
                  {formatNumber(landCount)} ราย
                </span>
              </div>

              {/* 4 Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[11px] font-medium text-slate-500 block">ยอดหนี้เก่ารวม</span>
                  <span className="text-base sm:text-lg font-black text-amber-950">
                    ฿{formatCurrency(landDebt)}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[11px] font-medium text-slate-500 block">รับชำระหนี้เก่าแล้ว</span>
                  <span className="text-base sm:text-lg font-black text-blue-700">
                    ฿{formatCurrency(landPaid)}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    ({landPaidCount} ราย)
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[11px] font-medium text-slate-500 block">คงเหลือหนี้เก่า</span>
                  <span className="text-base sm:text-lg font-black text-rose-600">
                    ฿{formatCurrency(landRem)}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[11px] font-medium text-slate-500 block">เบี้ยปรับ + เงินเพิ่ม</span>
                  <span className="text-base sm:text-lg font-black text-purple-700">
                    ฿{formatCurrency(landPenSur)}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-600 font-medium">ร้อยละการรับชำระหนี้เก่า:</span>
                  <span className="font-extrabold text-blue-800">
                    {landDebt > 0 ? ((landPaid / landDebt) * 100).toFixed(2) : '0.00'}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(landDebt > 0 ? (landPaid / landDebt) * 100 : 0, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: ลูกหนี้ภาษีเก่า ภาษีป้าย */}
          <div className="bg-gradient-to-br from-amber-50/30 via-white to-amber-50/20 rounded-2xl p-5 border border-amber-200/90 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
                    <Receipt className="w-5 h-5 text-amber-100" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                      ลูกหนี้ภาษีเก่าภาษีป้าย
                    </h4>
                    <span className="text-[11px] text-slate-500">ยอดค้างชำระสะสมปีก่อนหน้า</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-950 font-black text-xs">
                  {formatNumber(signCount)} ราย
                </span>
              </div>

              {/* 4 Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[11px] font-medium text-slate-500 block">ยอดหนี้เก่ารวม</span>
                  <span className="text-base sm:text-lg font-black text-amber-950">
                    ฿{formatCurrency(signDebt)}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[11px] font-medium text-slate-500 block">รับชำระหนี้เก่าแล้ว</span>
                  <span className="text-base sm:text-lg font-black text-blue-700">
                    ฿{formatCurrency(signPaid)}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    ({signPaidCount} ราย)
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[11px] font-medium text-slate-500 block">คงเหลือหนี้เก่า</span>
                  <span className="text-base sm:text-lg font-black text-rose-600">
                    ฿{formatCurrency(signRem)}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[11px] font-medium text-slate-500 block">เบี้ยปรับ + เงินเพิ่ม</span>
                  <span className="text-base sm:text-lg font-black text-purple-700">
                    ฿{formatCurrency(signPenSur)}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-600 font-medium">ร้อยละการรับชำระหนี้เก่า:</span>
                  <span className="font-extrabold text-amber-800">
                    {signDebt > 0 ? ((signPaid / signDebt) * 100).toFixed(2) : '0.00'}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-amber-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(signDebt > 0 ? (signPaid / signDebt) * 100 : 0, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 8 Revenue Categories Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-blue-800" />
            <h3 className="font-bold text-slate-800 text-base">
              สรุปความคืบหน้า 8 หมวดรายได้ (ประจำปีงบประมาณ 2570)
            </h3>
          </div>
          <button
            onClick={() => onNavigateTab('categories')}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline flex items-center space-x-1 cursor-pointer"
          >
            <span>ดูรายการย่อยทุกหมวดทั้งหมด</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">ลำดับ</th>
                <th className="py-3 px-4">หมวดรายได้</th>
                <th className="py-3 px-4 text-right">ประมาณการ (บาท)</th>
                <th className="py-3 px-4 text-right">รับจริง (บาท)</th>
                <th className="py-3 px-4 text-right">สูง/ต่ำกว่าประมาณการ</th>
                <th className="py-3 px-4 text-center w-36">ความคืบหน้า</th>
                <th className="py-3 px-4 text-right w-24">ร้อยละ (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((cat, idx) => {
                const est = cat.items.reduce((s, i) => s + (i.estimate || 0), 0);
                const act = cat.items.reduce((s, i) => s + (i.actual || 0), 0);
                const diff = act - est;
                const pct = est > 0 ? (act / est) * 100 : 0;

                return (
                  <tr key={cat.key} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 text-center font-medium text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{cat.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{cat.items.length} รายการ</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                      ฿{formatCurrency(est)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                      ฿{formatCurrency(act)}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-medium ${
                      diff >= 0 ? 'text-emerald-600' : 'text-amber-600'
                    }`}>
                      {diff >= 0 ? '+' : '-'}฿{formatCurrency(Math.abs(diff))}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${
                            pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-800">
                      {pct.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100/80 font-bold border-t-2 border-slate-300 text-slate-900">
              <tr>
                <td className="py-4 px-4 text-center">#</td>
                <td className="py-4 px-4">รวมรายได้ทั้งสิ้น</td>
                <td className="py-4 px-4 text-right text-slate-800">฿{formatCurrency(totalEstimate)}</td>
                <td className="py-4 px-4 text-right text-emerald-700">฿{formatCurrency(totalActual)}</td>
                <td className={`py-4 px-4 text-right ${
                  totalActual >= totalEstimate ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  {totalActual >= totalEstimate ? '+' : '-'}฿{formatCurrency(Math.abs(totalActual - totalEstimate))}
                </td>
                <td className="py-4 px-4 text-center text-xs text-slate-500">
                  {totalPercentage.toFixed(2)}% ของเป้าหมาย
                </td>
                <td className="py-4 px-4 text-right text-indigo-700 text-base">
                  {totalPercentage.toFixed(2)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
