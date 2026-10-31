import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  FileCheck,
  AlertTriangle,
  X,
  FileText,
  Layers,
  Building2,
  CheckCircle2,
  Receipt,
  Landmark,
  Coins,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Database,
  Cloud,
  Server,
  Zap,
} from 'lucide-react';
import { bootstrapFirestoreDatabase, getFirestoreStats } from '../utils/firebaseDatabase';

import {
  RevenueCategory,
  DetailedTaxData,
  MarketContract,
  MarketSummary,
  DailyRecord,
  TaxpayerRecord,
  UserSession,
} from '../types/revenue';
import {
  exportFullWorkbook,
  exportTaxTrackingWorkbook,
  exportTaxpayersToExcel,
  exportSingleCategory,
  downloadLandTaxpayersTemplate,
  downloadSignTaxpayersTemplate,
  downloadTaxpayersTemplate,
  downloadBudgetTemplate,
  downloadDailyRecordsTemplate,
  parseUploadedExcel,
  formatCurrency,
  formatNumber,
  ImportTargetCategory,
} from '../utils/excel';

interface ExcelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: RevenueCategory[];
  landTax: DetailedTaxData;
  signTax: DetailedTaxData;
  marketContracts?: MarketContract[];
  marketSummaries?: Record<'night_market' | 'fresh_market', MarketSummary>;
  taxpayers: TaxpayerRecord[];
  dailyRecords: DailyRecord[];
  onImportDailyRecords: (records: DailyRecord[], mode: 'append' | 'replace') => void;
  onImportBudgetUpdates: (updates: { id?: string; name?: string; estimate?: number; actual?: number }[]) => void;
  onImportTaxpayers?: (
    records: TaxpayerRecord[],
    mode: 'append' | 'replace',
    targetSubtype?: 'land' | 'sign' | 'both'
  ) => void;
  onImportMarketContracts?: (contracts: MarketContract[], mode: 'append' | 'replace') => void;
  session: UserSession | null;
}

export const ExcelManagerModal: React.FC<ExcelManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  landTax,
  signTax,
  taxpayers,
  dailyRecords,
  onImportDailyRecords,
  onImportBudgetUpdates,
  onImportTaxpayers,
  session,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'templates' | 'firebase'>('export');
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string>(categories[0]?.key || 'taxes');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');

  // Specific category chosen by user for importing
  const [selectedImportCategory, setSelectedImportCategory] =
    useState<ImportTargetCategory>('land_taxpayers');

  // Firebase Database State
  const [isFirebaseSyncing, setIsFirebaseSyncing] = useState<boolean>(false);
  const [firebaseMessage, setFirebaseMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [firebaseStats, setFirebaseStats] = useState<{
    connected: boolean;
    databaseId: string;
    taxpayersCount: number;
    dailyRecordsCount: number;
    categoriesCount: number;
    lastUpdated: string | null;
  }>({
    connected: true,
    databaseId: 'databaserevenuecollection',
    taxpayersCount: taxpayers.length,
    dailyRecordsCount: dailyRecords.length,
    categoriesCount: categories.length,
    lastUpdated: null,
  });

  // Refresh stats when opening modal or changing tab to firebase
  useEffect(() => {
    if (isOpen) {
      getFirestoreStats().then((stats) => {
        setFirebaseStats(stats);
      });
    }
  }, [isOpen, activeTab, taxpayers.length, dailyRecords.length, categories.length]);

  const handleTriggerFirebaseBootstrap = async (force = false) => {
    setIsFirebaseSyncing(true);
    setFirebaseMessage(null);
    try {
      const res = await bootstrapFirestoreDatabase(force);
      if (res.success) {
        setFirebaseMessage({
          type: 'success',
          text: force
            ? 'สร้างและจัดเก็บฐานข้อมูล databaserevenuecollection บน Firebase สำเร็จเรียบร้อยแล้ว'
            : 'เชื่อมต่อและซิงค์ฐานข้อมูล databaserevenuecollection บน Firebase พร้อมใช้งาน',
        });
        const freshStats = await getFirestoreStats();
        setFirebaseStats(freshStats);
      } else {
        setFirebaseMessage({
          type: 'error',
          text: `เกิดข้อผิดพลาด: ${res.error || 'ไม่สามารถสร้างฐานข้อมูลบน Firebase ได้'}`,
        });
      }
    } catch (e: any) {
      setFirebaseMessage({
        type: 'error',
        text: `เกิดข้อผิดพลาด: ${e.message || String(e)}`,
      });
    } finally {
      setIsFirebaseSyncing(false);
    }
  };

  // Upload & preview state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isReadingFile, setIsReadingFile] = useState<boolean>(false);
  const [parsedData, setParsedData] = useState<{
    type: 'taxpayers' | 'contracts' | 'daily' | 'budget' | 'unknown';
    targetSubtype?: 'land' | 'sign' | 'both';
    taxpayers?: TaxpayerRecord[];
    marketContracts?: MarketContract[];
    dailyRecords?: Partial<DailyRecord>[];
    budgetUpdates?: { id?: string; name?: string; estimate?: number; actual?: number }[];
    rawRows: any[];
  } | null>(null);

  const [uploadError, setUploadError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);


  // -------------------------------------------------------------
  // DYNAMIC LIVE STATS - Matching precisely with on-screen data
  // -------------------------------------------------------------
  const landTaxpayers = useMemo(
    () => taxpayers.filter((t) => t.taxType === 'land'),
    [taxpayers]
  );
  const signTaxpayers = useMemo(
    () => taxpayers.filter((t) => t.taxType === 'sign'),
    [taxpayers]
  );

  // Land Tax live numbers
  const landCount = landTaxpayers.length;
  const landAssessedTotal = useMemo(
    () => landTaxpayers.reduce((s, t) => s + (t.assessedAmount || 0), 0),
    [landTaxpayers]
  );
  const landReliefTotal = useMemo(
    () => landTaxpayers.reduce((s, t) => s + (t.reliefAmount || 0), 0),
    [landTaxpayers]
  );
  const landAfterReliefTotal = useMemo(
    () => landTaxpayers.reduce((s, t) => s + (t.afterReliefAmount || 0), 0),
    [landTaxpayers]
  );
  const landPaidTotal = useMemo(
    () =>
      landTaxpayers.reduce(
        (s, t) =>
          s +
          (t.payment1 || 0) +
          (t.payment2 || 0) +
          (t.payment3 || 0) +
          (t.penaltyAmount || 0) +
          (t.surchargeAmount || 0),
        0
      ),
    [landTaxpayers]
  );
  const landRemaining2570 = useMemo(
    () =>
      landTaxpayers.reduce((s, t) => {
        const rem =
          t.remainingBalance !== undefined
            ? t.remainingBalance
            : Math.max(
                0,
                (t.afterReliefAmount || 0) -
                  ((t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0))
              );
        return s + rem;
      }, 0),
    [landTaxpayers]
  );
  const landOldDebtors = useMemo(
    () => landTaxpayers.filter((t) => (t.oldDebtAmount || 0) > 0),
    [landTaxpayers]
  );
  const landOldDebtTotal = useMemo(
    () => landTaxpayers.reduce((s, t) => s + (t.oldDebtAmount || 0), 0),
    [landTaxpayers]
  );
  const landOldDebtPaid = useMemo(
    () => landTaxpayers.reduce((s, t) => s + (t.oldDebtPaid || 0), 0),
    [landTaxpayers]
  );
  const landOldDebtRemaining = useMemo(
    () =>
      landTaxpayers.reduce(
        (s, t) =>
          s +
          (t.oldDebtRemaining !== undefined
            ? t.oldDebtRemaining
            : Math.max(0, (t.oldDebtAmount || 0) - (t.oldDebtPaid || 0))),
        0
      ),
    [landTaxpayers]
  );
  const landDebtorsCombinedAmount = landRemaining2570 + landOldDebtRemaining;

  // Sign Tax live numbers
  const signCount = signTaxpayers.length;
  const signAssessedTotal = useMemo(
    () => signTaxpayers.reduce((s, t) => s + (t.assessedAmount || 0), 0),
    [signTaxpayers]
  );
  const signReliefTotal = useMemo(
    () => signTaxpayers.reduce((s, t) => s + (t.reliefAmount || 0), 0),
    [signTaxpayers]
  );
  const signAfterReliefTotal = useMemo(
    () => signTaxpayers.reduce((s, t) => s + (t.afterReliefAmount || 0), 0),
    [signTaxpayers]
  );
  const signPaidTotal = useMemo(
    () =>
      signTaxpayers.reduce(
        (s, t) =>
          s +
          (t.payment1 || 0) +
          (t.payment2 || 0) +
          (t.payment3 || 0) +
          (t.penaltyAmount || 0) +
          (t.surchargeAmount || 0),
        0
      ),
    [signTaxpayers]
  );
  const signRemaining2570 = useMemo(
    () =>
      signTaxpayers.reduce((s, t) => {
        const rem =
          t.remainingBalance !== undefined
            ? t.remainingBalance
            : Math.max(
                0,
                (t.afterReliefAmount || 0) -
                  ((t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0))
              );
        return s + rem;
      }, 0),
    [signTaxpayers]
  );
  const signOldDebtors = useMemo(
    () => signTaxpayers.filter((t) => (t.oldDebtAmount || 0) > 0),
    [signTaxpayers]
  );
  const signOldDebtTotal = useMemo(
    () => signTaxpayers.reduce((s, t) => s + (t.oldDebtAmount || 0), 0),
    [signTaxpayers]
  );
  const signOldDebtPaid = useMemo(
    () => signTaxpayers.reduce((s, t) => s + (t.oldDebtPaid || 0), 0),
    [signTaxpayers]
  );
  const signOldDebtRemaining = useMemo(
    () =>
      signTaxpayers.reduce(
        (s, t) =>
          s +
          (t.oldDebtRemaining !== undefined
            ? t.oldDebtRemaining
            : Math.max(0, (t.oldDebtAmount || 0) - (t.oldDebtPaid || 0))),
        0
      ),
    [signTaxpayers]
  );
  const signDebtorsCombinedAmount = signRemaining2570 + signOldDebtRemaining;

  // 8 Categories Budget totals
  const totalBudgetEstimate = useMemo(
    () =>
      categories.reduce(
        (sum, cat) =>
          sum + cat.items.reduce((s, item) => s + (item.estimate || 0), 0),
        0
      ),
    [categories]
  );
  const totalBudgetActual = useMemo(
    () =>
      categories.reduce(
        (sum, cat) =>
          sum + cat.items.reduce((s, item) => s + (item.actual || 0), 0),
        0
      ),
    [categories]
  );
  const totalBudgetPercent =
    totalBudgetEstimate > 0
      ? (totalBudgetActual / totalBudgetEstimate) * 100
      : 0;

  // Daily records totals
  const dailyTotalAmount = useMemo(
    () => dailyRecords.reduce((sum, r) => sum + (r.amount || 0), 0),
    [dailyRecords]
  );

  const selectedCategoryObj = categories.find((c) => c.key === selectedCategoryKey);
  const selectedCategoryEstimate = useMemo(
    () =>
      selectedCategoryObj?.items.reduce((s, it) => s + (it.estimate || 0), 0) ||
      0,
    [selectedCategoryObj]
  );
  const selectedCategoryActual = useMemo(
    () =>
      selectedCategoryObj?.items.reduce((s, it) => s + (it.actual || 0), 0) || 0,
    [selectedCategoryObj]
  );

  if (!isOpen) return null;

  const canImport = session?.permissions.canImportExport ?? false;

  // Export handlers
  const handleExportFull = () => {
    exportFullWorkbook(
      categories,
      landTax,
      signTax,
      [],
      {} as any,
      taxpayers,
      dailyRecords
    );
  };

  const handleExportTaxes = () => {
    exportTaxTrackingWorkbook(landTax, signTax, taxpayers);
  };

  const handleExportLandTaxpayers = () => {
    exportTaxpayersToExcel(taxpayers, 'land');
  };

  const handleExportSignTaxpayers = () => {
    exportTaxpayersToExcel(taxpayers, 'sign');
  };

  const handleExportCategory = () => {
    if (selectedCategoryObj) {
      exportSingleCategory(selectedCategoryObj);
    }
  };

  // Process file upload with category targeting
  const processFile = async (file: File, categoryTarget: ImportTargetCategory) => {
    setSelectedFile(file);
    setUploadError('');
    setSuccessMessage('');
    setIsReadingFile(true);

    try {
      const parsed = await parseUploadedExcel(file, categoryTarget);
      setParsedData(parsed);

      if (parsed.type === 'unknown') {
        setUploadError(
          'ไม่สามารถจำแนกรูปแบบตารางในไฟล์ได้ กรุณาตรวจสอบว่าเลือกหมวดข้อมูลตรงกับไฟล์ หรือดาวน์โหลดแบบฟอร์ม Template ที่ระบบจัดเตรียมไว้'
        );
      }
    } catch (err: any) {
      setUploadError(err.message || 'เกิดข้อผิดพลาดในการอ่านไฟล์');
      setParsedData(null);
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file, selectedImportCategory);
  };

  const handleCategorySelectionChange = async (cat: ImportTargetCategory) => {
    setSelectedImportCategory(cat);
    setUploadError('');
    setSuccessMessage('');
    if (selectedFile) {
      await processFile(selectedFile, cat);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedData) return;

    if (parsedData.type === 'taxpayers' && parsedData.taxpayers) {
      if (onImportTaxpayers) {
        onImportTaxpayers(
          parsedData.taxpayers,
          importMode,
          parsedData.targetSubtype ||
            (selectedImportCategory === 'land_taxpayers'
              ? 'land'
              : selectedImportCategory === 'sign_taxpayers'
              ? 'sign'
              : 'both')
        );

        const categoryLabel =
          parsedData.targetSubtype === 'land' ||
          selectedImportCategory === 'land_taxpayers'
            ? 'ภาษีที่ดินและสิ่งปลูกสร้าง'
            : parsedData.targetSubtype === 'sign' ||
              selectedImportCategory === 'sign_taxpayers'
            ? 'ภาษีป้าย'
            : 'ผู้เสียภาษีรวม (ภาษีที่ดินและภาษีป้าย)';

        setSuccessMessage(
          `นำเข้าข้อมูล "${categoryLabel}" สำเร็จจำนวน ${
            parsedData.taxpayers.length
          } รายการ (แบบ: ${
            importMode === 'append' ? 'เพิ่มต่อท้าย' : 'แทนที่ข้อมูลเดิม'
          }) หน้าจอและฐานข้อมูลได้รับการอัปเดตเป็นข้อมูลล่าสุดทันที`
        );
      }
      setParsedData(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else if (parsedData.type === 'daily' && parsedData.dailyRecords) {
      const formattedRecords: DailyRecord[] = parsedData.dailyRecords.map(
        (r, i) => ({
          id: `rec-imp-${Date.now()}-${i}`,
          date: r.date || new Date().toISOString().slice(0, 10),
          categoryId: r.categoryId || 'taxes',
          categoryName: r.categoryName || 'หมวดรายได้',
          itemId: r.itemId || 'general',
          itemName: r.itemName || 'รายการรายได้',
          amount: r.amount || 0,
          receiptBookNo: r.receiptBookNo || '-',
          receiptNo: r.receiptNo || '-',
          payerName: r.payerName || '-',
          note: r.note || 'นำเข้าจากไฟล์ Excel',
          recordedAt: new Date().toISOString(),
        })
      );

      onImportDailyRecords(formattedRecords, importMode);
      setSuccessMessage(
        `นำเข้าข้อมูล "บันทึกรายรับประจำวัน" สำเร็จจำนวน ${
          formattedRecords.length
        } รายการ (แบบ: ${
          importMode === 'append' ? 'เพิ่มต่อท้าย' : 'แทนที่ข้อมูลเดิม'
        }) ยอดเงินรับจริงได้รับการอัปเดตตรงกับหน้าจอทันที`
      );
      setParsedData(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else if (parsedData.type === 'budget' && parsedData.budgetUpdates) {
      onImportBudgetUpdates(parsedData.budgetUpdates);
      setSuccessMessage(
        `นำเข้าและปรับปรุงข้อมูล "ประมาณการและรับจริง 8 หมวดรายได้" สำเร็จจำนวน ${parsedData.budgetUpdates.length} รายการ ข้อมูลหน้าจอตารางงบประมาณอัปเดตเรียบร้อยแล้ว`
      );
      setParsedData(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-950 text-white p-5 flex items-center justify-between border-b border-emerald-800/40">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md shrink-0 border border-amber-300">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-lg text-white">
                  ระบบนำเข้าและดาวน์โหลด Excel (.xlsx)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-semibold">
                  ปีงบประมาณ 2570
                </span>
              </div>
              <p className="text-xs text-emerald-200/90 mt-0.5">
                ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Data Status Bar - Guarantees data displayed directly matches the active system state */}
        <div className="bg-slate-900 text-white px-5 py-3 border-b border-slate-800 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="font-bold text-emerald-300">
                สถานะข้อมูลล่าสุดในระบบ (ตรงกับการแสดงผลจริง):
              </span>
            </div>
            <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
              <RefreshCw className="w-3 h-3 text-slate-400" />
              <span>อัปเดตอัตโนมัติแบบเรียลไทม์</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2.5 pt-2.5 border-t border-slate-800 text-[11px]">
            {/* Land tax summary */}
            <div className="bg-slate-800/80 p-2 rounded-xl border border-blue-500/30">
              <div className="text-blue-300 font-bold flex items-center space-x-1">
                <Landmark className="w-3 h-3" />
                <span>ภาษีที่ดินฯ</span>
              </div>
              <div className="mt-1 text-slate-200">
                ผู้เสียภาษี: <span className="font-semibold text-white">{formatNumber(landCount)}</span> ราย
              </div>
              <div className="text-emerald-400 font-medium">
                รับจริง: {formatCurrency(landPaidTotal)} บ.
              </div>
              <div className="text-rose-300">
                หนี้ค้างรวม: {formatCurrency(landDebtorsCombinedAmount)} บ.
              </div>
            </div>

            {/* Sign tax summary */}
            <div className="bg-slate-800/80 p-2 rounded-xl border border-amber-500/30">
              <div className="text-amber-300 font-bold flex items-center space-x-1">
                <Receipt className="w-3 h-3" />
                <span>ภาษีป้าย</span>
              </div>
              <div className="mt-1 text-slate-200">
                ผู้เสียภาษี: <span className="font-semibold text-white">{formatNumber(signCount)}</span> ราย
              </div>
              <div className="text-emerald-400 font-medium">
                รับจริง: {formatCurrency(signPaidTotal)} บ.
              </div>
              <div className="text-rose-300">
                หนี้ค้างรวม: {formatCurrency(signDebtorsCombinedAmount)} บ.
              </div>
            </div>

            {/* 8 Budget Categories summary */}
            <div className="bg-slate-800/80 p-2 rounded-xl border border-indigo-500/30">
              <div className="text-indigo-300 font-bold flex items-center space-x-1">
                <Layers className="w-3 h-3" />
                <span>8 หมวดรายได้</span>
              </div>
              <div className="mt-1 text-slate-200">
                ประมาณการ: {formatCurrency(totalBudgetEstimate)} บ.
              </div>
              <div className="text-emerald-400 font-medium">
                รับจริง: {formatCurrency(totalBudgetActual)} บ.
              </div>
              <div className="text-amber-300 font-semibold">
                จัดเก็บได้: {totalBudgetPercent.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="bg-slate-100 p-2 flex border-b border-slate-200 text-xs font-semibold gap-1.5">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'export'
                ? 'bg-white text-emerald-800 shadow-sm border border-emerald-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>ดาวน์โหลดเป็น Excel (.xlsx)</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'import'
                ? 'bg-white text-emerald-800 shadow-sm border border-emerald-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4 text-emerald-700" />
            <span>นำเข้าข้อมูล Excel (เลือกหมวดข้อมูล)</span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'templates'
                ? 'bg-white text-emerald-800 shadow-sm border border-emerald-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-700" />
            <span>ดาวน์โหลด Template</span>
          </button>
          <button
            onClick={() => setActiveTab('firebase')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'firebase'
                ? 'bg-white text-indigo-900 shadow-sm border border-indigo-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4 text-indigo-600" />
            <span>ฐานข้อมูล Firebase</span>
          </button>
        </div>


        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs sm:text-sm flex items-start space-x-3 shadow-xs animate-in fade-in duration-150">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successMessage}</div>
            </div>
          )}

          {/* TAB 1: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              {/* Option 1: Full Workbook */}
              <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 hover:border-emerald-300 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-700 text-white font-bold text-[10px]">
                        แนะนำ
                      </span>
                      <h4 className="font-bold text-emerald-950 text-sm">
                        1. ดาวน์โหลดรายงานรวมทุกระบบทั้งเล่ม (.xlsx)
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      ครบถ้วนทุกชีต: สรุปภาพรวมรายได้ 8 หมวด, ภาษีที่ดินและสิ่งปลูกสร้าง ({formatNumber(landCount)} ราย) และภาษีป้าย ({formatNumber(signCount)} ราย)
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span className="bg-white border border-emerald-200 px-2 py-0.5 rounded-md text-emerald-800 font-medium">
                        ภาษีที่ดิน: {formatNumber(landCount)} ราย (รับจริง {formatCurrency(landPaidTotal)} บ.)
                      </span>
                      <span className="bg-white border border-emerald-200 px-2 py-0.5 rounded-md text-emerald-800 font-medium">
                        ภาษีป้าย: {formatNumber(signCount)} ราย (รับจริง {formatCurrency(signPaidTotal)} บ.)
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleExportFull}
                    className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>ดาวน์โหลดทั้งเล่ม</span>
                  </button>
                </div>
              </div>

              {/* Option 2: Land Taxpayers and Old Debtors */}
              <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-200 hover:border-blue-300 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-blue-950 text-sm flex items-center space-x-1.5">
                      <Landmark className="w-4 h-4 text-blue-800" />
                      <span>2. รายชื่อผู้เสียภาษีและลูกหนี้ภาษีเก่า (ภาษีที่ดินและสิ่งปลูกสร้าง) (.xlsx)</span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      ทะเบียนคุมรายชื่อผู้เสียภาษีที่ดินฯ ปี 2570 พร้อมข้อมูลลูกหนี้ภาษีเก่า (ยอดประเมิน, บรรเทา, หลังบรรเทา, ชำระ 2570, คงเหลือ 2570, ยอดหนี้เก่า, ชำระหนี้เก่า, เบี้ยปรับ+เงินเพิ่ม, คงเหลือหนี้เก่า, ยอดรับจริง และรวมคงเหลือทั้งสิ้น)
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span className="bg-white border border-blue-200 px-2 py-0.5 rounded-md text-blue-900 font-semibold">
                        ปัจจุบันมี: {formatNumber(landCount)} ราย
                      </span>
                      <span className="bg-white border border-blue-200 px-2 py-0.5 rounded-md text-emerald-700 font-semibold">
                        รับชำระจริง: {formatCurrency(landPaidTotal)} บ.
                      </span>
                      <span className="bg-white border border-blue-200 px-2 py-0.5 rounded-md text-rose-700 font-semibold">
                        หนี้คงค้างรวม: {formatCurrency(landDebtorsCombinedAmount)} บ.
                      </span>
                      <span className="bg-white border border-blue-200 px-2 py-0.5 rounded-md text-slate-700">
                        ลูกหนี้เก่า: {formatNumber(landOldDebtors.length)} ราย
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleExportLandTaxpayers}
                    className="px-4 py-2.5 bg-blue-800 hover:bg-blue-900 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>ดาวน์โหลดภาษีที่ดิน</span>
                  </button>
                </div>
              </div>

              {/* Option 3: Sign Taxpayers and Old Debtors */}
              <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 hover:border-amber-300 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-amber-950 text-sm flex items-center space-x-1.5">
                      <Receipt className="w-4 h-4 text-amber-800" />
                      <span>3. รายชื่อผู้เสียภาษีและลูกหนี้ภาษีเก่า (ภาษีป้าย) (.xlsx)</span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      ทะเบียนคุมรายชื่อผู้เสียภาษีป้าย ปี 2570 พร้อมข้อมูลลูกหนี้ภาษีเก่า (ยอดประเมิน, บรรเทา, หลังบรรเทา, ชำระ 2570, คงเหลือ 2570, ยอดหนี้เก่า, ชำระหนี้เก่า, เบี้ยปรับ+เงินเพิ่ม, คงเหลือหนี้เก่า, ยอดรับจริง และรวมคงเหลือทั้งสิ้น)
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span className="bg-white border border-amber-200 px-2 py-0.5 rounded-md text-amber-900 font-semibold">
                        ปัจจุบันมี: {formatNumber(signCount)} ราย
                      </span>
                      <span className="bg-white border border-amber-200 px-2 py-0.5 rounded-md text-emerald-700 font-semibold">
                        รับชำระจริง: {formatCurrency(signPaidTotal)} บ.
                      </span>
                      <span className="bg-white border border-amber-200 px-2 py-0.5 rounded-md text-rose-700 font-semibold">
                        หนี้คงค้างรวม: {formatCurrency(signDebtorsCombinedAmount)} บ.
                      </span>
                      <span className="bg-white border border-amber-200 px-2 py-0.5 rounded-md text-slate-700">
                        ลูกหนี้เก่า: {formatNumber(signOldDebtors.length)} ราย
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleExportSignTaxpayers}
                    className="px-4 py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>ดาวน์โหลดภาษีป้าย</span>
                  </button>
                </div>
              </div>

              {/* Option 4: Summary of both taxes */}
              <div className="p-4 bg-indigo-50/80 rounded-2xl border border-indigo-200 hover:border-indigo-300 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-indigo-950 text-sm flex items-center space-x-1.5">
                      <Building2 className="w-4 h-4 text-indigo-700" />
                      <span>4. ดาวน์โหลดระบบติดตามภาพรวมภาษีที่ดินและสิ่งปลูกสร้าง และภาษีป้าย (.xlsx)</span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      ประกอบด้วยสรุปภาพรวมเปรียบเทียบประมาณการ/รับจริง/ลูกหนี้ และทะเบียนคุมรายชื่อผู้เสียภาษีของทั้ง 2 ภาษี (รวม {formatNumber(landCount + signCount)} ราย)
                    </p>
                    <div className="mt-2 text-[11px] text-indigo-900 font-medium">
                      รวมยอดจัดเก็บได้จริงทั้งสองภาษี: {formatCurrency(landPaidTotal + signPaidTotal)} บาท
                    </div>
                  </div>
                  <button
                    onClick={handleExportTaxes}
                    className="px-4 py-2.5 bg-indigo-800 hover:bg-indigo-900 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>ดาวน์โหลดทั้งสองภาษี</span>
                  </button>
                </div>
              </div>

              {/* Option 5: Single Category */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-slate-900 text-sm mb-2">
                  5. เลือกดาวน์โหลดแยกตารางตามหมวดหมู่รายได้
                </h4>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <select
                    value={selectedCategoryKey}
                    onChange={(e) => setSelectedCategoryKey(e.target.value)}
                    className="flex-1 p-2.5 text-xs rounded-xl border border-slate-300 bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.title} ({c.items.length} รายการ)
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleExportCategory}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>ดาวน์โหลดหมวดนี้</span>
                  </button>
                </div>
                {selectedCategoryObj && (
                  <div className="mt-2.5 text-[11px] text-slate-600 flex flex-wrap gap-3">
                    <span>
                      ประมาณการ:{' '}
                      <strong className="text-slate-900">
                        {formatCurrency(selectedCategoryEstimate)}
                      </strong>{' '}
                      บาท
                    </span>
                    <span>
                      รับจริง:{' '}
                      <strong className="text-emerald-700">
                        {formatCurrency(selectedCategoryActual)}
                      </strong>{' '}
                      บาท
                    </span>
                    <span>
                      จำนวนรายการ:{' '}
                      <strong className="text-slate-900">
                        {selectedCategoryObj.items.length}
                      </strong>{' '}
                      รายการ
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT WITH CATEGORY SELECTION */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {!canImport && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  หมายเหตุ: ผู้ใช้งานในระดับสิทธิ์ปัจจุบันสามารถนำเข้าข้อมูลได้
                </div>
              )}

              {/* 1. Category Selection for Import (User Requirement) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-700 text-white inline-flex items-center justify-center text-[11px]">
                    1
                  </span>
                  <span>เลือกหมวดข้อมูลที่ต้องการนำเข้า:</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Category 1: Land Tax */}
                  <div
                    onClick={() => handleCategorySelectionChange('land_taxpayers')}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                      selectedImportCategory === 'land_taxpayers'
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                          <Landmark className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-xs text-slate-900">
                          ภาษีที่ดินและสิ่งปลูกสร้าง
                        </span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 font-semibold">
                        {landCount} ราย
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      รายชื่อผู้เสียภาษีที่ดินฯ ปี 2570 และลูกหนี้ภาษีเก่า
                    </p>
                  </div>

                  {/* Category 2: Sign Tax */}
                  <div
                    onClick={() => handleCategorySelectionChange('sign_taxpayers')}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                      selectedImportCategory === 'sign_taxpayers'
                        ? 'border-amber-600 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-xs text-slate-900">
                          ภาษีป้าย
                        </span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold">
                        {signCount} ราย
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      รายชื่อผู้เสียภาษีป้าย ปี 2570 และลูกหนี้ภาษีเก่า
                    </p>
                  </div>

                  {/* Category 3: Budget 8 Categories */}
                  <div
                    onClick={() => handleCategorySelectionChange('budget')}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                      selectedImportCategory === 'budget'
                        ? 'border-purple-600 bg-purple-50/70 ring-2 ring-purple-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                          <Layers className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-xs text-slate-900">
                          8 หมวดรายได้ (งบประมาณ)
                        </span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 font-semibold">
                        8 หมวด
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      ปรับปรุงยอดประมาณการและรับจริงทั้ง 8 หมวด
                    </p>
                  </div>

                  {/* Category 4: Auto-detect */}
                  <div
                    onClick={() => handleCategorySelectionChange('auto')}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between sm:col-span-3 ${
                      selectedImportCategory === 'auto'
                        ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center shrink-0">
                          <FileCheck className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-xs text-slate-900">
                          ตรวจจับหมวดข้อมูลอัตโนมัติ (รองรับหลายชีต/ไฟล์รวมทั้งเล่ม)
                        </span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 font-semibold">
                        ระบบตรวจจับให้
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      เหมาะสำหรับไฟล์ Excel ที่มีหลายชีต ระบบจะอ่านชีตภาษีที่ดิน ภาษีป้าย หรือ 8 หมวดรายได้ให้โดยอัตโนมัติ
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Mode Selection: Append vs Replace */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-700 text-white inline-flex items-center justify-center text-[11px]">
                    2
                  </span>
                  <span>เลือกรูปแบบการนำเข้าข้อมูล:</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start space-x-2.5 ${
                      importMode === 'append'
                        ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">
                        เพิ่มต่อท้าย (Append)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        เก็บข้อมูลเดิมที่มีอยู่ และเพิ่มข้อมูลใหม่จากไฟล์ต่อท้าย
                      </span>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start space-x-2.5 ${
                      importMode === 'replace'
                        ? 'border-rose-600 bg-rose-50/50 ring-2 ring-rose-600/20 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-xs text-rose-900 block">
                        แทนที่ข้อมูลเดิม (Replace)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        ล้างข้อมูลเดิมเฉพาะหมวดที่เลือก และแทนที่ด้วยข้อมูลใหม่ทั้งหมด
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* 3. File upload drag/select */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-700 text-white inline-flex items-center justify-center text-[11px]">
                    3
                  </span>
                  <span>เลือกไฟล์ Excel (.xlsx, .xls) หรือ CSV:</span>
                </label>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-3xl p-6 text-center cursor-pointer bg-slate-50 hover:bg-emerald-50/20 transition-all group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Upload className="w-9 h-9 text-slate-400 group-hover:text-emerald-600 mx-auto mb-2 transition-colors" />
                  <div className="text-xs sm:text-sm font-semibold text-slate-800">
                    {selectedFile
                      ? selectedFile.name
                      : 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    รองรับไฟล์ Excel (.xlsx, .xls) หรือ CSV • หมวดที่เลือกนำเข้า: <span className="font-bold text-emerald-800">{
                      selectedImportCategory === 'land_taxpayers'
                        ? 'ภาษีที่ดินและสิ่งปลูกสร้าง'
                        : selectedImportCategory === 'sign_taxpayers'
                        ? 'ภาษีป้าย'
                        : selectedImportCategory === 'daily'
                        ? 'บันทึกรายรับประจำวัน'
                        : selectedImportCategory === 'budget'
                        ? '8 หมวดรายได้ (งบประมาณ)'
                        : 'ตรวจจับอัตโนมัติ'
                    }</span>
                  </div>
                </div>
              </div>

              {isReadingFile && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs flex items-center justify-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>กำลังอ่านและจำแนกข้อมูลในไฟล์ Excel...</span>
                </div>
              )}

              {uploadError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-start space-x-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">เกิดข้อผิดพลาดในการตรวจสอบไฟล์:</span>
                    <span>{uploadError}</span>
                  </div>
                </div>
              )}

              {/* 4. Preview of Parsed Data with Current vs After Import Comparison */}
              {parsedData && parsedData.type !== 'unknown' && (
                <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3.5 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        ผลการตรวจสอบไฟล์: {
                          parsedData.type === 'taxpayers'
                            ? (parsedData.targetSubtype === 'land'
                                ? 'รายชื่อผู้เสียภาษีและลูกหนี้ภาษีเก่า (ภาษีที่ดินและสิ่งปลูกสร้าง)'
                                : parsedData.targetSubtype === 'sign'
                                ? 'รายชื่อผู้เสียภาษีและลูกหนี้ภาษีเก่า (ภาษีป้าย)'
                                : 'รายชื่อผู้เสียภาษีรวม (ภาษีที่ดินและภาษีป้าย)')
                            : parsedData.type === 'daily'
                            ? 'บันทึกรายรับประจำวัน'
                            : 'ประมาณการและรับจริง 8 หมวดรายได้'
                        }
                      </span>
                      <span className="text-[11px] text-slate-500">
                        พร้อมนำเข้าในรูปแบบ: <strong className="text-emerald-800">{importMode === 'append' ? 'เพิ่มต่อท้าย' : 'แทนที่ข้อมูลเดิม'}</strong>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-xl">
                        พบข้อมูลในไฟล์: {
                          parsedData.type === 'taxpayers'
                            ? `${parsedData.taxpayers?.length || 0} ราย`
                            : parsedData.type === 'daily'
                            ? `${parsedData.dailyRecords?.length || 0} รายการ`
                            : `${parsedData.budgetUpdates?.length || 0} รายการ`
                        }
                      </span>
                    </div>
                  </div>

                  {/* Impact Calculation Preview */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-700">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500">สถานะหลังนำเข้า:</span>
                      {parsedData.type === 'taxpayers' && (
                        <span className="font-semibold text-slate-900">
                          {selectedImportCategory === 'land_taxpayers' || parsedData.targetSubtype === 'land'
                            ? `ภาษีที่ดิน (เดิมมี ${landCount} ราย → ${importMode === 'append' ? landCount + (parsedData.taxpayers?.length || 0) : parsedData.taxpayers?.length || 0} ราย)`
                            : selectedImportCategory === 'sign_taxpayers' || parsedData.targetSubtype === 'sign'
                            ? `ภาษีป้าย (เดิมมี ${signCount} ราย → ${importMode === 'append' ? signCount + (parsedData.taxpayers?.length || 0) : parsedData.taxpayers?.length || 0} ราย)`
                            : `รวมทุกภาษี (${importMode === 'append' ? taxpayers.length + (parsedData.taxpayers?.length || 0) : parsedData.taxpayers?.length || 0} ราย)`}
                        </span>
                      )}
                      {parsedData.type === 'daily' && (
                        <span className="font-semibold text-slate-900">
                          บันทึกรายรับ (เดิมมี {dailyRecords.length} รายการ → {importMode === 'append' ? dailyRecords.length + (parsedData.dailyRecords?.length || 0) : parsedData.dailyRecords?.length || 0} รายการ)
                        </span>
                      )}
                      {parsedData.type === 'budget' && (
                        <span className="font-semibold text-slate-900">
                          ปรับปรุงยอดเงินใน {parsedData.budgetUpdates?.length || 0} รายการหมวดงบประมาณ
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-emerald-700 font-medium">
                      ✓ ข้อมูลจะบันทึกสู่ฐานข้อมูลถาวรทันที
                    </div>
                  </div>

                  {/* Sample Rows Preview (first 3 rows) */}
                  {parsedData.type === 'taxpayers' && parsedData.taxpayers && parsedData.taxpayers.length > 0 && (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white max-h-40 text-[11px]">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 sticky top-0">
                          <tr>
                            <th className="p-1.5">ชื่อผู้เสียภาษี</th>
                            <th className="p-1.5">ประเภท</th>
                            <th className="p-1.5 text-right">ยอดประเมิน</th>
                            <th className="p-1.5 text-right">ชำระ 2570</th>
                            <th className="p-1.5 text-right">หนี้เก่า</th>
                            <th className="p-1.5 text-right">ชำระหนี้เก่า</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedData.taxpayers.slice(0, 4).map((t, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="p-1.5 font-medium text-slate-800">{t.name}</td>
                              <td className="p-1.5">
                                <span className={`px-1.5 py-0.2 rounded text-[10px] ${t.taxType === 'land' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {t.taxType === 'land' ? 'ที่ดิน' : 'ป้าย'}
                                </span>
                              </td>
                              <td className="p-1.5 text-right">{formatCurrency(t.assessedAmount)}</td>
                              <td className="p-1.5 text-right text-emerald-600 font-medium">
                                {formatCurrency((t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0))}
                              </td>
                              <td className="p-1.5 text-right text-rose-600">{formatCurrency(t.oldDebtAmount || 0)}</td>
                              <td className="p-1.5 text-right text-emerald-600">{formatCurrency(t.oldDebtPaid || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <button
                    onClick={handleConfirmImport}
                    className="w-full py-3 bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg flex items-center justify-center space-x-2 transition-all cursor-pointer"
                  >
                    <FileCheck className="w-4 h-4 text-emerald-300" />
                    <span>
                      ยืนยันนำเข้าข้อมูลเข้าสู่ระบบ ({importMode === 'append' ? 'เพิ่มต่อท้าย' : 'แทนที่ข้อมูลเดิม'})
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TEMPLATES (Market contracts removed as requested) */}
          {activeTab === 'templates' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                ดาวน์โหลดแบบฟอร์มเปล่าเพื่อนำไปกรอกข้อมูล และนำเข้ากลับสู่ระบบได้อย่างถูกต้อง แม่นยำ:
              </p>

              {/* Template 1: Land Taxpayers & Old Debtors */}
              <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-blue-900 text-xs sm:text-sm flex items-center space-x-1.5">
                    <Landmark className="w-4 h-4 text-blue-700" />
                    <span>แบบฟอร์มนำเข้ารายชื่อผู้เสียภาษีและลูกหนี้ภาษีเก่า (ภาษีที่ดินและสิ่งปลูกสร้าง)</span>
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-1">
                    คอลัมน์: ชื่อผู้เสียภาษี, ประเภทภาษี (ที่ดิน), ยอดประเมิน 2570, บรรเทา, สถานะ (0-3), ครั้งที่ 1-3, ยอดลูกหนี้เก่ารวม, สถานะหนี้เก่า (0-2), รับชำระหนี้เก่า, เบี้ยปรับ, เงินเพิ่ม, หมายเหตุ
                  </p>
                </div>
                <button
                  onClick={downloadLandTaxpayersTemplate}
                  className="px-3.5 py-2 bg-blue-800 hover:bg-blue-900 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ดาวน์โหลด Template ที่ดิน</span>
                </button>
              </div>

              {/* Template 2: Sign Taxpayers & Old Debtors */}
              <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-amber-900 text-xs sm:text-sm flex items-center space-x-1.5">
                    <Receipt className="w-4 h-4 text-amber-700" />
                    <span>แบบฟอร์มนำเข้ารายชื่อผู้เสียภาษีและลูกหนี้ภาษีเก่า (ภาษีป้าย)</span>
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-1">
                    คอลัมน์: ชื่อผู้เสียภาษี, ประเภทภาษี (ป้าย), ยอดประเมิน 2570, บรรเทา, สถานะ (0-3), ครั้งที่ 1-3, ยอดลูกหนี้เก่ารวม, สถานะหนี้เก่า (0-2), รับชำระหนี้เก่า, เบี้ยปรับ, เงินเพิ่ม, หมายเหตุ
                  </p>
                </div>
                <button
                  onClick={downloadSignTaxpayersTemplate}
                  className="px-3.5 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ดาวน์โหลด Template ป้าย</span>
                </button>
              </div>

              {/* Template 3: Basic Taxpayers */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center space-x-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-slate-600" />
                    <span>แบบฟอร์มนำเข้ารายชื่อผู้เสียภาษีที่ดินและภาษีป้าย (แบบพื้นฐาน)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    คอลัมน์: ชื่อ, ประเภทภาษี (ที่ดิน/ป้าย), ยอดประเมิน, ยอดบรรเทา, สถานะ (0-3), ครั้งที่ 1, ครั้งที่ 2, ครั้งที่ 3, หมายเหตุ
                  </p>
                </div>
                <button
                  onClick={downloadTaxpayersTemplate}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ดาวน์โหลด Template พื้นฐาน</span>
                </button>
              </div>

              {/* Template 4: 8 Categories Budget */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center space-x-1.5">
                    <Layers className="w-4 h-4 text-indigo-700" />
                    <span>แบบฟอร์มประมาณการและรับจริง 8 หมวดรายได้</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    คอลัมน์: รหัสรายการ (ห้ามแก้ไข), หมวดรายได้, ชื่อรายการรายได้, ประมาณการ (บาท), รับจริง (บาท)
                  </p>
                </div>
                <button
                  onClick={() => downloadBudgetTemplate(categories)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ดาวน์โหลด Template งบประมาณ</span>
                </button>
              </div>
            </div>
          )}
          {/* Tab 4: Firebase Database Management */}

          {activeTab === 'firebase' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Firebase Message Notification */}
              {firebaseMessage && (
                <div
                  className={`p-4 rounded-2xl text-xs sm:text-sm flex items-start space-x-3 shadow-xs animate-in fade-in ${
                    firebaseMessage.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border border-rose-300 text-rose-900'
                  }`}
                >
                  {firebaseMessage.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 font-medium">{firebaseMessage.text}</div>
                </div>
              )}

              {/* Status Banner */}
              <div className="p-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-blue-950 text-white rounded-2xl border border-indigo-700/50 shadow-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shrink-0">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-white">
                          Cloud Firestore Database
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-semibold flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>ออนไลน์ (Connected)</span>
                        </span>
                      </div>
                      <p className="text-xs text-indigo-200 mt-0.5">
                        ระบบจัดเก็บข้อมูลลงฐานข้อมูล Firebase อัตโนมัติทุกครั้งที่มีการบันทึกหรือนำเข้า
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      disabled={isFirebaseSyncing}
                      onClick={() => handleTriggerFirebaseBootstrap(true)}
                      className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Zap className={`w-3.5 h-3.5 ${isFirebaseSyncing ? 'animate-spin' : ''}`} />
                      <span>{isFirebaseSyncing ? 'กำลังสร้าง/จัดเก็บ...' : 'สร้าง/ซิงค์ฐานข้อมูลอัตโนมัติ'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isFirebaseSyncing}
                      onClick={() => handleTriggerFirebaseBootstrap(false)}
                      className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-xl border border-white/20 transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isFirebaseSyncing ? 'animate-spin' : ''}`} />
                      <span>รีเฟรชสถานะ</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-indigo-800/60 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Database ID:</span>
                    <span className="font-mono font-bold text-amber-300">databaserevenuecollection</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Firebase Project:</span>
                    <span className="font-mono text-slate-200">logical-cache-2w2pc</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">โหมดการซิงค์:</span>
                    <span className="text-emerald-400 font-semibold">อัตโนมัติแบบเรียลไทม์ (2-Way)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">ผู้ดูแลระบบ / สิทธิ์:</span>
                    <span className="text-slate-200 truncate font-mono text-[10px]">collectsarakham@gmail.com</span>
                  </div>
                </div>
              </div>

              {/* Collections Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. App State Collection */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Server className="w-4 h-4 text-blue-600" />
                      <span className="font-bold text-xs text-slate-900 font-mono">app_state / active_database</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-semibold">
                      ฐานข้อมูลส่วนกลาง
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    จัดเก็บสถานะรวม 8 หมวดรายได้, ภาษีที่ดิน/ป้าย, สัญญาตลาด และประวัติรับเงิน สำหรับซิงค์สดระหว่างเครื่อง
                  </p>
                  <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200">
                    <span>สถานะ: พร้อมใช้งาน</span>
                    <span className="text-emerald-600 font-semibold">ซิงค์อัตโนมัติ</span>
                  </div>
                </div>

                {/* 2. Taxpayers Collection */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Landmark className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-xs text-slate-900 font-mono">taxpayers</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      {firebaseStats.taxpayersCount} รายการ
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    ตารางทะเบียนผู้เสียภาษีที่ดิน สิ่งปลูกสร้าง และภาษีป้าย พร้อมยอดประเมิน หนี้เก่า และงวดการผ่อนชำระ
                  </p>
                  <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200">
                    <span>ภาษีที่ดิน ({taxpayers.filter(t => t.taxType === 'land').length}) • ภาษีป้าย ({taxpayers.filter(t => t.taxType === 'sign').length})</span>
                    <span className="text-emerald-600 font-semibold">จัดเก็บแล้ว</span>
                  </div>
                </div>

                {/* 3. Revenue Categories Collection */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-purple-600" />
                      <span className="font-bold text-xs text-slate-900 font-mono">revenue_categories</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold">
                      8 หมวดงบประมาณ
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    ตารางโครงสร้าง 8 หมวดรายได้ของเทศบาลเมืองมหาสารคาม พร้อมยอดประมาณการและยอดรับจริง
                  </p>
                  <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200">
                    <span>หมวดภาษี, ค่าธรรมเนียม, ทรัพย์สิน, สาธารณูปโภค ฯลฯ</span>
                    <span className="text-emerald-600 font-semibold">จัดเก็บแล้ว</span>
                  </div>
                </div>
              </div>

              {/* Instructions Callout */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  <strong className="font-semibold">ระบบจัดเก็บอัตโนมัติ:</strong> ข้อมูลทั้งหมดที่ท่านบันทึก แก้ไข หรือนำเข้าผ่านระบบ Excel จะถูกส่งไปจัดเก็บลงในฐานข้อมูล Firebase <span className="font-mono font-semibold">databaserevenuecollection</span> โดยอัตโนมัติในทันที ทำให้ทุกเครื่องในเครือข่ายเทศบาลมองเห็นข้อมูลที่ตรงกันเสมอ
                </p>
              </div>
            </div>
          )}
        </div>


        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            ระบบนำเข้า-ส่งออก Excel • ฝ่ายพัฒนารายได้ กองคลัง
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs rounded-xl hover:bg-slate-100 font-semibold cursor-pointer transition-colors shadow-xs"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
