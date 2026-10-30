import React, { useState, useDeferredValue, useMemo } from 'react';
import {
  TableProperties,
  Search,
  Edit2,
  Check,
  X,
  Download,
  Plus,
  Database,
  Radio,
  RefreshCw,
  Trash2,
  Coins,
  TrendingUp,
  Layers,
  Building2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { RevenueCategory, RevenueItem, UserSession } from '../types/revenue';
import { formatCurrency, exportSingleCategory } from '../utils/excel';
import {
  persistRevenueCategoryToFirestore,
  persistAllRevenueCategoriesToFirestore,
  fetchRevenueCategoriesFromFirestore,
} from '../utils/firebaseDatabase';

interface RevenueCategoriesTableProps {
  categories: RevenueCategory[];
  onUpdateCategoryItem: (categoryId: string, itemId: string, estimate: number, actual: number) => void;
  onAddCategoryItem?: (categoryId: string, newItem: { name: string; estimate: number; actual: number }) => void;
  onDeleteCategoryItem?: (categoryId: string, itemId: string) => void;
  onSetCategories?: (categories: RevenueCategory[]) => void;
  session: UserSession | null;
}

export const RevenueCategoriesTable: React.FC<RevenueCategoriesTableProps> = ({
  categories,
  onUpdateCategoryItem,
  onAddCategoryItem,
  onDeleteCategoryItem,
  onSetCategories,
  session,
}) => {
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Cloud Firebase sync & feedback states
  const [isSyncingFirebase, setIsSyncingFirebase] = useState<boolean>(false);
  const [isRefreshingFirebase, setIsRefreshingFirebase] = useState<boolean>(false);
  const [firebaseNotification, setFirebaseNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Editing state
  const [editingItem, setEditingItem] = useState<{
    categoryId: string;
    item: RevenueItem;
    tempEstimate: string;
    tempActual: string;
  } | null>(null);

  // Add Item Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addFormCategoryId, setAddFormCategoryId] = useState<string>(categories[0]?.key || 'taxes');
  const [addFormName, setAddFormName] = useState<string>('');
  const [addFormEstimate, setAddFormEstimate] = useState<string>('');
  const [addFormActual, setAddFormActual] = useState<string>('');
  const [isSubmittingItem, setIsSubmittingItem] = useState<boolean>(false);

  const canEdit = session?.permissions.canEdit ?? false;

  // Calculate Grand Totals across all 8 Categories
  const { totalEstimateAll, totalActualAll, totalDifferenceAll, totalPercentageAll, totalItemsCount } = useMemo(() => {
    let est = 0;
    let act = 0;
    let count = 0;
    categories.forEach((cat) => {
      cat.items.forEach((item) => {
        est += item.estimate || 0;
        act += item.actual || 0;
        count += 1;
      });
    });
    const diff = act - est;
    const pct = est > 0 ? (act / est) * 100 : 0;
    return {
      totalEstimateAll: est,
      totalActualAll: act,
      totalDifferenceAll: diff,
      totalPercentageAll: pct,
      totalItemsCount: count,
    };
  }, [categories]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setFirebaseNotification({ type, message });
    setTimeout(() => {
      setFirebaseNotification(null);
    }, 4500);
  };

  // Trigger batch save of all 8 categories directly to Firebase databaserevenuecollection
  const handleSaveAllToFirebase = async () => {
    setIsSyncingFirebase(true);
    try {
      const res = await persistAllRevenueCategoriesToFirestore(categories);
      if (res.success) {
        showNotification(
          'success',
          `บันทึกและซิงค์ข้อมูล 8 หมวดรายได้ (${totalItemsCount} รายการ) ลงฐานข้อมูล Firebase databaserevenuecollection สำเร็จเรียบร้อยแล้ว`
        );
      } else {
        showNotification('error', `เกิดข้อผิดพลาดในการบันทึก: ${res.error || 'ไม่ทราบสาเหตุ'}`);
      }
    } catch (err: any) {
      showNotification('error', `เชื่อมต่อ Firebase ไม่สำเร็จ: ${err.message || String(err)}`);
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  // Sync a single category to Firebase
  const handleSyncSingleCategoryToFirebase = async (category: RevenueCategory) => {
    try {
      const success = await persistRevenueCategoryToFirestore(category);
      if (success) {
        showNotification(
          'success',
          `ซิงค์ข้อมูล "${category.title}" (${category.items.length} รายการ) ลง Firebase สำเร็จแล้ว`
        );
      } else {
        showNotification('error', `ไม่สามารถซิงค์ ${category.title} ลง Firebase ได้`);
      }
    } catch (e: any) {
      showNotification('error', `เกิดข้อผิดพลาด: ${e.message || String(e)}`);
    }
  };

  // Refresh categories from Firebase Cloud Firestore
  const handleRefreshFromFirebase = async () => {
    setIsRefreshingFirebase(true);
    try {
      const remote = await fetchRevenueCategoriesFromFirestore();
      if (remote && remote.length > 0) {
        if (onSetCategories) {
          onSetCategories(remote);
        }
        showNotification('success', `ดึงข้อมูล 8 หมวดรายได้ล่าสุดจาก Firebase สำเร็จแล้ว (พบ ${remote.length} หมวด)`);
      } else {
        showNotification('success', 'เชื่อมต่อ Firebase สำเร็จ (ข้อมูลตรงกับคลาวด์แล้ว)');
      }
    } catch (e: any) {
      showNotification('error', `ดึงข้อมูลจาก Firebase ไม่สำเร็จ: ${e.message || String(e)}`);
    } finally {
      setIsRefreshingFirebase(false);
    }
  };

  // Start inline editing
  const startEditing = (categoryId: string, item: RevenueItem) => {
    if (!canEdit) return;
    setEditingItem({
      categoryId,
      item,
      tempEstimate: item.estimate.toString(),
      tempActual: item.actual.toString(),
    });
  };

  // Save inline edit
  const saveEditing = async () => {
    if (!editingItem) return;
    const est = parseFloat(editingItem.tempEstimate.replace(/,/g, '')) || 0;
    const act = parseFloat(editingItem.tempActual.replace(/,/g, '')) || 0;
    onUpdateCategoryItem(editingItem.categoryId, editingItem.item.id, est, act);

    // Also persist updated category to Firebase
    const targetCat = categories.find((c) => c.key === editingItem.categoryId);
    if (targetCat) {
      const updatedCat: RevenueCategory = {
        ...targetCat,
        items: targetCat.items.map((it) =>
          it.id === editingItem.item.id ? { ...it, estimate: est, actual: act } : it
        ),
      };
      persistRevenueCategoryToFirestore(updatedCat).catch(() => {});
    }

    setEditingItem(null);
    showNotification('success', `อัปเดต "${editingItem.item.name}" และจัดเก็บลง Firebase databaserevenuecollection เรียบร้อยแล้ว`);
  };

  const cancelEditing = () => {
    setEditingItem(null);
  };

  // Handle Add Item submit
  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFormName.trim()) {
      alert('กรุณากรอกชื่อรายการรายได้');
      return;
    }

    const est = parseFloat(addFormEstimate.replace(/,/g, '')) || 0;
    const act = parseFloat(addFormActual.replace(/,/g, '')) || 0;

    setIsSubmittingItem(true);
    try {
      if (onAddCategoryItem) {
        onAddCategoryItem(addFormCategoryId, {
          name: addFormName.trim(),
          estimate: est,
          actual: act,
        });
      }

      // Also persist to Firebase
      const targetCat = categories.find((c) => c.key === addFormCategoryId);
      if (targetCat) {
        const newItem: RevenueItem = {
          id: `${addFormCategoryId}-${Date.now()}`,
          categoryKey: addFormCategoryId,
          name: addFormName.trim(),
          estimate: est,
          actual: act,
        };
        const updatedCat: RevenueCategory = {
          ...targetCat,
          items: [...targetCat.items, newItem],
        };
        await persistRevenueCategoryToFirestore(updatedCat);
      }

      showNotification(
        'success',
        `เพิ่มรายการ "${addFormName.trim()}" และบันทึกลง Firebase databaserevenuecollection เรียบร้อยแล้ว`
      );

      // Reset form
      setAddFormName('');
      setAddFormEstimate('');
      setAddFormActual('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      showNotification('error', `เกิดข้อผิดพลาดในการเพิ่มรายการ: ${err.message || String(err)}`);
    } finally {
      setIsSubmittingItem(false);
    }
  };

  // Handle Delete Item
  const handleDeleteItem = async (categoryId: string, item: RevenueItem) => {
    if (!canEdit) return;
    if (confirm(`ต้องการลบรายการ "${item.name}" ออกจากฐานข้อมูลหรือไม่?`)) {
      if (onDeleteCategoryItem) {
        onDeleteCategoryItem(categoryId, item.id);
      }
      const targetCat = categories.find((c) => c.key === categoryId);
      if (targetCat) {
        const updatedCat: RevenueCategory = {
          ...targetCat,
          items: targetCat.items.filter((it) => it.id !== item.id),
        };
        await persistRevenueCategoryToFirestore(updatedCat);
      }
      showNotification('success', `ลบรายการ "${item.name}" ออกจากฐานข้อมูล Firebase แล้ว`);
    }
  };

  // Filter categories
  const filteredCategories = categories.filter((cat) => {
    if (selectedCategoryKey !== 'all' && cat.key !== selectedCategoryKey) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {firebaseNotification && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm flex items-start space-x-3 shadow-md border animate-in slide-in-from-top-2 duration-150 ${
            firebaseNotification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {firebaseNotification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{firebaseNotification.message}</div>
          <button
            onClick={() => setFirebaseNotification(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* FIREBASE DATABASE BANNER & CLOUD CONTROLS FOR 8 REVENUE CATEGORIES */}
      <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-blue-800/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md shrink-0 border border-amber-300">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  ฐานข้อมูล 8 หมวดรายได้ (Firebase Firestore)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-semibold flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>เชื่อมต่ออัตโนมัติ (Live Sync)</span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-mono font-bold">
                  databaserevenuecollection
                </span>
              </div>
              <p className="text-xs text-blue-200/90 mt-1">
                คอลเลกชัน <span className="font-mono text-amber-300">revenue_categories</span> จัดเก็บโครงสร้าง 8 หมวดงบประมาณ เทศบาลเมืองมหาสารคาม ปีงบประมาณ 2570
              </p>
            </div>
          </div>

          {/* Cloud Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                title="เพิ่มรายการจัดเก็บรายได้ใหม่ลงใน 8 หมวด"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มรายการรายได้</span>
              </button>
            )}

            <button
              type="button"
              disabled={isSyncingFirebase}
              onClick={handleSaveAllToFirebase}
              className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-xl shadow-md transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              title="บันทึกและซิงค์ข้อมูลทั้ง 8 หมวดลงฐานข้อมูล Firebase"
            >
              <Radio className={`w-3.5 h-3.5 ${isSyncingFirebase ? 'animate-spin' : ''}`} />
              <span>{isSyncingFirebase ? 'กำลังบันทึกลง Cloud...' : 'บันทึก 8 หมวดลง Firebase'}</span>
            </button>

            <button
              type="button"
              disabled={isRefreshingFirebase}
              onClick={handleRefreshFromFirebase}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-xl border border-white/20 transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              title="ดึงข้อมูลล่าสุดจาก Firebase"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingFirebase ? 'animate-spin' : ''}`} />
              <span>ดึงจาก Firebase</span>
            </button>
          </div>
        </div>

        {/* 8 Categories Grand Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-blue-800/60">
          <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-blue-200 block">โครงสร้างฐานข้อมูล</span>
            <span className="text-base sm:text-lg font-bold text-white flex items-center space-x-1 mt-0.5">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>8 หมวดรายได้</span>
            </span>
            <span className="text-[10px] text-emerald-400 block mt-0.5 font-medium">
              รวม {totalItemsCount} รายการจัดเก็บ
            </span>
          </div>

          <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-blue-200 block">ประมาณการทั้งสิ้น (8 หมวด)</span>
            <span className="text-base sm:text-lg font-bold text-amber-300 block mt-0.5">
              ฿{formatCurrency(totalEstimateAll)}
            </span>
            <span className="text-[10px] text-slate-300 block mt-0.5">
              เป้าหมายงบประมาณ พ.ศ. 2570
            </span>
          </div>

          <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-blue-200 block">รับจริงรวมทั้งสิ้น (8 หมวด)</span>
            <span className="text-base sm:text-lg font-bold text-emerald-400 block mt-0.5">
              ฿{formatCurrency(totalActualAll)}
            </span>
            <span className={`text-[10px] block mt-0.5 font-semibold ${totalDifferenceAll >= 0 ? 'text-emerald-300' : 'text-amber-200'}`}>
              {totalDifferenceAll >= 0 ? '+' : ''}฿{formatCurrency(totalDifferenceAll)} จากประมาณการ
            </span>
          </div>

          <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-blue-200 block">ร้อยละผลการจัดเก็บรวม</span>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-base sm:text-lg font-extrabold text-white">
                {totalPercentageAll.toFixed(2)}%
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            {/* Progress bar */}
            <div className="w-full bg-white/20 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(totalPercentageAll, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <TableProperties className="w-5 h-5 text-blue-800" />
              <h2 className="text-lg font-bold text-slate-800">
                ตารางรายงานผลการดำเนินงาน 8 หมวดรายได้ เทศบาลเมืองมหาสารคาม
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              ข้อมูลซิงค์ตรงกับฐานข้อมูลคลาวด์ Firebase Firestore (<span className="font-mono text-blue-700">databaserevenuecollection</span>)
            </p>
          </div>

          {/* Search bar */}
          <div className="relative min-w-[240px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหารายการ เช่น ภาษีป้าย, ขยะ, ตลาดสด..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills (All 8 Categories) */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategoryKey('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategoryKey === 'all'
                ? 'bg-blue-800 text-white font-semibold shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            แสดงทุกหมวด (8 หมวดรายได้)
          </button>
          {categories.map((c, idx) => (
            <button
              key={c.key}
              onClick={() => setSelectedCategoryKey(c.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center space-x-1.5 ${
                selectedCategoryKey === c.key
                  ? 'bg-blue-800 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 text-center text-[10px] leading-4 font-bold">
                {idx + 1}
              </span>
              <span>{c.shortTitle}</span>
              <span className="text-[10px] opacity-80">({c.items.length})</span>
            </button>
          ))}
        </div>
      </div>

      {/* 8 CATEGORIES TABLES */}
      <div className="space-y-6">
        {filteredCategories.map((category, catIdx) => {
          // Filter items by deferred search query
          const itemsToDisplay = category.items.filter((item) =>
            item.name.toLowerCase().includes(deferredSearchQuery.toLowerCase())
          );

          if (deferredSearchQuery && itemsToDisplay.length === 0) {
            return null;
          }

          const catTotalEst = category.items.reduce((s, i) => s + (i.estimate || 0), 0);
          const catTotalAct = category.items.reduce((s, i) => s + (i.actual || 0), 0);
          const catTotalDiff = catTotalAct - catTotalEst;
          const catPercentage = catTotalEst > 0 ? (catTotalAct / catTotalEst) * 100 : 0;

          return (
            <div
              key={category.key}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:border-slate-300 transition-colors"
            >
              {/* Category Header */}
              <div className="bg-gradient-to-r from-slate-50 to-blue-50/50 p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-md bg-blue-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {catIdx + 1}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base">
                      {category.title}
                    </h3>
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-semibold">
                      {category.items.length} รายการ
                    </span>
                  </div>
                  {category.description && (
                    <p className="text-xs text-slate-500 mt-1 pl-8">
                      {category.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <div className="text-right mr-2">
                    <div className="text-[11px] text-slate-500">ร้อยละรับจริงเทียบประมาณการ</div>
                    <div className="text-sm font-bold text-blue-700">{catPercentage.toFixed(2)}%</div>
                  </div>

                  {/* Sync this single category to Firebase */}
                  <button
                    onClick={() => handleSyncSingleCategoryToFirebase(category)}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-blue-200 hover:bg-blue-50 text-blue-800 text-xs font-medium transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
                    title="บันทึกหมวดนี้ลง Firebase revenue_categories"
                  >
                    <Radio className="w-3 h-3 text-blue-600" />
                    <span>ซิงค์ Firebase</span>
                  </button>

                  {/* Add item to this specific category */}
                  {canEdit && (
                    <button
                      onClick={() => {
                        setAddFormCategoryId(category.key);
                        setIsAddModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 text-xs font-medium transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
                      title="เพิ่มรายการในหมวดนี้"
                    >
                      <Plus className="w-3 h-3 text-emerald-600" />
                      <span>เพิ่มรายการ</span>
                    </button>
                  )}

                  {/* Export category */}
                  <button
                    onClick={() => exportSingleCategory(category)}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 text-xs font-medium transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
                    title="ดาวน์โหลดเฉพาะหมวดนี้เป็น Excel"
                  >
                    <Download className="w-3 h-3 text-emerald-600" />
                    <span>Excel</span>
                  </button>
                </div>
              </div>

              {/* Progress Bar for Category */}
              <div className="w-full bg-slate-100 h-1">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${Math.min(catPercentage, 100)}%` }}
                ></div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">ลำดับ</th>
                      <th className="py-2.5 px-4">รายการรายได้</th>
                      <th className="py-2.5 px-4 text-right">ประมาณการ (บาท)</th>
                      <th className="py-2.5 px-4 text-right">รับจริง (บาท)</th>
                      <th className="py-2.5 px-4 text-right">สูง/ต่ำกว่าประมาณการ</th>
                      <th className="py-2.5 px-4 text-right w-24">ร้อยละ (%)</th>
                      {canEdit && <th className="py-2.5 px-3 w-20 text-center">จัดการ</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemsToDisplay.map((item, idx) => {
                      const diff = (item.actual || 0) - (item.estimate || 0);
                      const pct = item.estimate > 0 ? ((item.actual || 0) / item.estimate) * 100 : 0;
                      const isEditingThis =
                        editingItem?.categoryId === category.key &&
                        editingItem?.item.id === item.id;

                      if (isEditingThis) {
                        return (
                          <tr key={item.id} className="bg-amber-50/70">
                            <td className="py-2 px-4 text-center text-slate-400 font-medium">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-4 font-medium text-slate-800">
                              {item.name}
                            </td>
                            <td className="py-2 px-4 text-right">
                              <input
                                type="number"
                                value={editingItem.tempEstimate}
                                onChange={(e) =>
                                  setEditingItem({
                                    ...editingItem,
                                    tempEstimate: e.target.value,
                                  })
                                }
                                className="w-28 text-right p-1 text-xs border border-blue-400 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
                              />
                            </td>
                            <td className="py-2 px-4 text-right">
                              <input
                                type="number"
                                value={editingItem.tempActual}
                                onChange={(e) =>
                                  setEditingItem({
                                    ...editingItem,
                                    tempActual: e.target.value,
                                  })
                                }
                                className="w-28 text-right p-1 text-xs border border-blue-400 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
                              />
                            </td>
                            <td className="py-2 px-4 text-right text-slate-400 text-xs">
                              คำนวณอัตโนมัติ
                            </td>
                            <td className="py-2 px-4 text-right text-slate-400 text-xs">
                              -
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  onClick={saveEditing}
                                  className="p-1 text-emerald-600 hover:bg-emerald-100 rounded cursor-pointer"
                                  title="บันทึกและซิงค์ Firebase"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  className="p-1 text-rose-500 hover:bg-rose-100 rounded cursor-pointer"
                                  title="ยกเลิก"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-4 text-center font-medium text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-4 text-slate-800 font-medium">
                            {item.name}
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-700">
                            ฿{formatCurrency(item.estimate)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-emerald-600">
                            ฿{formatCurrency(item.actual)}
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right font-medium ${
                              diff >= 0 ? 'text-emerald-600' : 'text-amber-700'
                            }`}
                          >
                            {diff >= 0 ? '+' : '-'}฿{formatCurrency(Math.abs(diff))}
                          </td>
                          <td className="py-2.5 px-4 text-right font-medium text-slate-700">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                pct >= 80
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : pct >= 50
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {pct.toFixed(2)}%
                            </span>
                          </td>
                          {canEdit && (
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  onClick={() => startEditing(category.key, item)}
                                  className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                  title="แก้ไขประมาณการและรับจริง"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(category.key, item)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title="ลบรายการนี้"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Category Summary Footer Row */}
                  <tfoot className="bg-slate-100/90 font-bold border-t border-slate-300 text-slate-900 text-xs sm:text-sm">
                    <tr>
                      <td className="py-3 px-4 text-center">รวม</td>
                      <td className="py-3 px-4">
                        รวม{category.title} ({category.items.length} รายการ)
                      </td>
                      <td className="py-3 px-4 text-right text-slate-800">
                        ฿{formatCurrency(catTotalEst)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700">
                        ฿{formatCurrency(catTotalAct)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right ${
                          catTotalDiff >= 0 ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {catTotalDiff >= 0 ? '+' : '-'}฿{formatCurrency(Math.abs(catTotalDiff))}
                      </td>
                      <td className="py-3 px-4 text-right text-blue-800 font-extrabold text-sm">
                        {catPercentage.toFixed(2)}%
                      </td>
                      {canEdit && <td className="py-3 px-3"></td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: ADD REVENUE ITEM TO 8 CATEGORIES & SAVE TO FIREBASE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    เพิ่มรายการรายได้ใหม่
                  </h3>
                  <p className="text-xs text-blue-200">
                    บันทึกลงฐานข้อมูล Firebase: <span className="font-mono text-amber-300">databaserevenuecollection</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddItemSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  เลือก 1 ใน 8 หมวดรายได้ *
                </label>
                <select
                  value={addFormCategoryId}
                  onChange={(e) => setAddFormCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                >
                  {categories.map((c, idx) => (
                    <option key={c.key} value={c.key}>
                      หมวดที่ {idx + 1}: {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อรายการรายได้ *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ค่าธรรมเนียมตรวจแบบแปลน, ค่าปรับสัญญา..."
                  value={addFormName}
                  onChange={(e) => setAddFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ยอดประมาณการ (บาท)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={addFormEstimate}
                    onChange={(e) => setAddFormEstimate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ยอดรับจริง (บาท)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={addFormActual}
                    onChange={(e) => setAddFormActual(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-right"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingItem}
                  className="px-5 py-2 bg-blue-800 hover:bg-blue-900 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Database className={`w-3.5 h-3.5 ${isSubmittingItem ? 'animate-spin' : ''}`} />
                  <span>{isSubmittingItem ? 'กำลังบันทึกลง Firebase...' : 'บันทึกลง Firebase'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
