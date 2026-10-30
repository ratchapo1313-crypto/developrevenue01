import React, { useState, useDeferredValue, useMemo } from 'react';
import {
  TableProperties,
  Search,
  Edit2,
  Check,
  X,
  FileSpreadsheet,
  Download,
  Percent,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { RevenueCategory, RevenueItem, UserSession } from '../types/revenue';
import { formatCurrency, exportSingleCategory } from '../utils/excel';

interface RevenueCategoriesTableProps {
  categories: RevenueCategory[];
  onUpdateCategoryItem: (categoryId: string, itemId: string, estimate: number, actual: number) => void;
  session: UserSession | null;
}

export const RevenueCategoriesTable: React.FC<RevenueCategoriesTableProps> = ({
  categories,
  onUpdateCategoryItem,
  session,
}) => {
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [editingItem, setEditingItem] = useState<{
    categoryId: string;
    item: RevenueItem;
    tempEstimate: string;
    tempActual: string;
  } | null>(null);

  const canEdit = session?.permissions.canEdit ?? false;

  const startEditing = (categoryId: string, item: RevenueItem) => {
    if (!canEdit) return;
    setEditingItem({
      categoryId,
      item,
      tempEstimate: item.estimate.toString(),
      tempActual: item.actual.toString(),
    });
  };

  const saveEditing = () => {
    if (!editingItem) return;
    const est = parseFloat(editingItem.tempEstimate.replace(/,/g, '')) || 0;
    const act = parseFloat(editingItem.tempActual.replace(/,/g, '')) || 0;
    onUpdateCategoryItem(editingItem.categoryId, editingItem.item.id, est, act);
    setEditingItem(null);
  };

  const cancelEditing = () => {
    setEditingItem(null);
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
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <TableProperties className="w-5 h-5 text-blue-800" />
              <h2 className="text-xl font-bold text-slate-800">
                ตารางรายงานผลการดำเนินงาน 8 หมวดรายได้
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม ประจำปีงบประมาณ พ.ศ. 2570
            </p>
          </div>

          {/* Search bar */}
          <div className="relative min-w-[240px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหารายการรายได้ เช่น ภาษีป้าย, ตลาดสด..."
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

        {/* Category Filter Pills */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategoryKey('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategoryKey === 'all'
                ? 'bg-blue-800 text-white font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            แสดงทุกหมวด (8 หมวด)
          </button>
          {categories.map((c) => (
            <button
              key={c.key}
              onClick={() => setSelectedCategoryKey(c.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategoryKey === c.key
                  ? 'bg-blue-800 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c.shortTitle} ({c.items.length})
            </button>
          ))}
        </div>
      </div>

      {/* Categories Tables */}
      <div className="space-y-6">
        {filteredCategories.map((category, catIdx) => {
          // Filter items by deferred search query for smooth UI
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
                    <span className="w-6 h-6 rounded-md bg-blue-800 text-white flex items-center justify-center font-bold text-xs">
                      {catIdx + 1}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base">
                      {category.title}
                    </h3>
                  </div>
                  {category.description && (
                    <p className="text-xs text-slate-500 mt-1 pl-8">
                      {category.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <div className="text-right mr-2">
                    <div className="text-[11px] text-slate-500">ร้อยละรับจริงเทียบประมาณการ</div>
                    <div className="text-sm font-bold text-blue-700">{catPercentage.toFixed(2)}%</div>
                  </div>
                  <button
                    onClick={() => exportSingleCategory(category)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 text-xs font-medium transition-colors flex items-center space-x-1.5 shadow-2xs"
                    title="ดาวน์โหลดเฉพาะหมวดนี้เป็น Excel"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Excel หมวดนี้</span>
                  </button>
                </div>
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
                      {canEdit && <th className="py-2.5 px-3 w-16 text-center">แก้ไข</th>}
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
                                  className="p-1 text-emerald-600 hover:bg-emerald-100 rounded"
                                  title="บันทึก"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  className="p-1 text-rose-500 hover:bg-rose-100 rounded"
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
                          <td className={`py-2.5 px-4 text-right font-medium ${
                            diff >= 0 ? 'text-emerald-600' : 'text-amber-700'
                          }`}>
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
                              <button
                                onClick={() => startEditing(category.key, item)}
                                className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                title="แก้ไขประมาณการและรับจริง"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Category Summary Row */}
                  <tfoot className="bg-slate-100/90 font-bold border-t border-slate-300 text-slate-900 text-xs sm:text-sm">
                    <tr>
                      <td className="py-3 px-4 text-center">รวม</td>
                      <td className="py-3 px-4">
                        รวม{category.title}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-800">
                        ฿{formatCurrency(catTotalEst)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700">
                        ฿{formatCurrency(catTotalAct)}
                      </td>
                      <td className={`py-3 px-4 text-right ${
                        catTotalDiff >= 0 ? 'text-emerald-700' : 'text-amber-700'
                      }`}>
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
    </div>
  );
};
