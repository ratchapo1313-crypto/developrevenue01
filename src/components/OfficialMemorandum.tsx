import React, { useState } from 'react';
import {
  Printer,
  FileDown,
  Calendar,
  FileCheck2,
  CheckCircle2,
  Layers,
  Sparkles,
  Building2,
  FileSpreadsheet,
} from 'lucide-react';
import {
  RevenueCategory,
  DetailedTaxData,
  MarketContract,
  MarketSummary,
  TaxpayerRecord,
  UserSession,
} from '../types/revenue';
import { formatCurrency, formatNumber } from '../utils/excel';

interface OfficialMemorandumProps {
  categories: RevenueCategory[];
  landTax: DetailedTaxData;
  signTax: DetailedTaxData;
  marketSummaries?: Record<'night_market' | 'fresh_market', MarketSummary>;
  marketContracts?: MarketContract[];
  taxpayers?: TaxpayerRecord[];
  session: UserSession | null;
}

// Convert English numerals to Thai numerals for official Thai government style
const toThaiNumeral = (val: string | number): string => {
  const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  return val.toString().replace(/[0-9]/g, (d) => thaiDigits[parseInt(d, 10)]);
};

export const OfficialMemorandum: React.FC<OfficialMemorandumProps> = ({
  categories,
  landTax,
  signTax,
  taxpayers = [],
  session,
}) => {
  // Configurable memorandum meta with date picker
  const [reportDate, setReportDate] = useState<string>('2026-10-24');
  const [docNumber, setDocNumber] = useState<string>('มค ๕๒๐๐๔/พิเศษ');
  const [useThaiNumerals, setUseThaiNumerals] = useState<boolean>(false);
  const [showDetailedTaxpayers, setShowDetailedTaxpayers] = useState<boolean>(true);

  // 8 Categories Totals
  let totalEstimate = 0;
  let totalActual = 0;
  categories.forEach((cat) => {
    cat.items.forEach((item) => {
      totalEstimate += item.estimate || 0;
      totalActual += item.actual || 0;
    });
  });
  const totalBalance = totalActual - totalEstimate;
  const totalPercentage = totalEstimate > 0 ? (totalActual / totalEstimate) * 100 : 0;

  // Tax calculations
  const landDiff = landTax.collected.amount - landTax.estimateAmount;
  const signDiff = signTax.collected.amount - signTax.estimateAmount;
  const combinedTaxEst = landTax.estimateAmount + signTax.estimateAmount;
  const combinedTaxAct = landTax.collected.amount + signTax.collected.amount;
  const combinedTaxDiff = combinedTaxAct - combinedTaxEst;

  const landTaxpayers = taxpayers.filter((t) => t.taxType === 'land');
  const signTaxpayers = taxpayers.filter((t) => t.taxType === 'sign');

  // Format date in Thai long style
  const getThaiFormattedDate = (dateStr: string) => {
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
    ];
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10) + 543;
        const month = thaiMonths[parseInt(parts[1], 10) - 1];
        const day = parseInt(parts[2], 10);
        const result = `${day} ${month} พ.ศ. ${year}`;
        return useThaiNumerals ? toThaiNumeral(result) : result;
      }
    } catch (e) {
      // fallback
    }
    return dateStr;
  };

  const fmtNum = (val: number | string) => {
    return useThaiNumerals ? toThaiNumeral(val) : val.toString();
  };

  const fmtCurr = (val: number) => {
    const formatted = formatCurrency(val);
    return useThaiNumerals ? toThaiNumeral(formatted) : formatted;
  };

  const fmtDiff = (val: number) => {
    const prefix = val >= 0 ? '+' : '';
    const formatted = `${prefix}${formatCurrency(val)}`;
    return useThaiNumerals ? toThaiNumeral(formatted) : formatted;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadWord = () => {
    const element = document.getElementById('memorandum-printable-area');
    if (!element) return;

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>บันทึกข้อความรายงานผลการจัดเก็บรายได้ 2570 เทศบาลเมืองมหาสารคาม</title>
        <style>
          body {
            font-family: 'TH Sarabun New', 'Sarabun', Tahoma, sans-serif;
            font-size: 15pt;
            line-height: 1.35;
            color: #000;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 12px 0;
          }
          th, td {
            border: 1px solid #000;
            padding: 5px 7px;
            font-size: 13pt;
          }
          th {
            background-color: #f2f2f2;
            text-align: center;
            font-weight: bold;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .section-title {
            font-weight: bold;
            text-decoration: underline;
            margin-top: 16px;
            font-size: 16pt;
          }
        </style>
      </head>
      <body>
        ${element.innerHTML}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], {
      type: 'application/msword;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `บันทึกข้อความ_ฝ่ายพัฒนารายได้_เทศบาลเมืองมหาสารคาม_2570.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Control Panel (Hidden when printing) */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <FileCheck2 className="w-5 h-5 text-blue-800" />
              <h2 className="text-xl font-bold text-slate-800">
                แบบรายงานทางการราชการ (Official Memorandum)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              บันทึกข้อความราชการ เทศบาลเมืองมหาสารคาม รวม 8 หมวดรายได้, ระบบติดตามภาษีที่ดินและสิ่งปลูกสร้าง และภาษีป้าย
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleDownloadWord}
              className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-2xs"
            >
              <FileDown className="w-4 h-4 text-blue-700" />
              <span>บันทึกเป็น Word (.doc)</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-blue-800 hover:bg-blue-900 text-white text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์บันทึกข้อความ</span>
            </button>
          </div>
        </div>

        {/* Configurations Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-700">วันที่ในเอกสาร:</span>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-700">เลขที่หนังสือ:</span>
            <input
              type="text"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs w-36 bg-slate-50 focus:bg-white font-mono"
            />
          </div>

          <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-xl">
            <span className="font-semibold text-slate-700">รูปแบบตัวเลข:</span>
            <button
              type="button"
              onClick={() => setUseThaiNumerals(!useThaiNumerals)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                useThaiNumerals
                  ? 'bg-blue-800 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-300'
              }`}
            >
              {useThaiNumerals ? 'เลขไทย (๑ ๒ ๓)' : 'เลขอารบิก (1 2 3)'}
            </button>
          </div>

          <div className="flex items-center space-x-3 text-slate-600 ml-auto">
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showDetailedTaxpayers}
                onChange={(e) => setShowDetailedTaxpayers(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 text-xs"
              />
              <span>แสดงตารางรายชื่อผู้เสียภาษี</span>
            </label>
          </div>
        </div>
      </div>

      {/* Official Memorandum Paper Document Area */}
      <div
        id="memorandum-printable-area"
        className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 shadow-md max-w-5xl mx-auto print:border-none print:shadow-none print:p-0 print:max-w-none text-black"
        style={{ fontFamily: "'TH Sarabun New', 'Sarabun', 'Segoe UI', Tahoma, sans-serif" }}
      >
        {/* Header: บันทึกข้อความ (No Logo as strictly instructed) */}
        <div className="text-center relative pb-3 border-b-2 border-black">
          <h1 className="text-3xl font-black tracking-wider text-black">บันทึกข้อความ</h1>
        </div>

        {/* Government Meta Header Block */}
        <div className="mt-5 space-y-2 text-sm sm:text-base border-b border-black pb-4 leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <span className="font-bold">ส่วนราชการ: </span>
              <span>ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม โทร. ๐ ๔๓๗๑ ๑๒๔๔</span>
            </div>
            <div>
              <span className="font-bold">ที่: </span>
              <span>{useThaiNumerals ? toThaiNumeral(docNumber) : docNumber}</span>
              <span className="font-bold ml-6">วันที่: </span>
              <span>{getThaiFormattedDate(reportDate)}</span>
            </div>
          </div>

          <div>
            <span className="font-bold">เรื่อง: </span>
            <span className="font-semibold">
              รายงานผลการจัดเก็บรายได้ ประจำปีงบประมาณ พ.ศ. {useThaiNumerals ? '๒๕๗๐' : '2570'} (๘ หมวดรายได้, ภาษีที่ดินและสิ่งปลูกสร้าง และภาษีป้าย)
            </span>
          </div>

          <div className="pt-1">
            <span className="font-bold">เรียน: </span>
            <span>นายกเทศมนตรีเมืองมหาสารคาม (ผ่าน ผู้อำนวยการกองคลัง)</span>
          </div>
        </div>

        {/* Narrative Summary Body */}
        <div className="mt-6 text-justify text-sm sm:text-base space-y-5 leading-relaxed">
          <p className="indent-8">
            ตามที่ ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม ได้ดำเนินการจัดเก็บและเร่งรัดการจัดเก็บรายได้ตามเทศบัญญัติงบประมาณรายจ่าย ประจำปีงบประมาณ พ.ศ.{' '}
            {useThaiNumerals ? '๒๕๗๐' : '2570'} เพื่อนำมาใช้ในการบริหารและพัฒนาเทศบาลเมืองมหาสารคาม นั้น
          </p>

          <p className="indent-8">
            ฝ่ายพัฒนารายได้ กองคลัง ขอรายงานผลการดำเนินงานการจัดเก็บรายได้ ประจำปีงบประมาณ พ.ศ.{' '}
            {useThaiNumerals ? '๒๕๗๐' : '2570'} ประจำวันที่ {getThaiFormattedDate(reportDate)} โดยมีรายละเอียดสรุปผลการจัดเก็บรายได้ทั้ง {useThaiNumerals ? '๘' : '8'} หมวด และระบบติดตามผลการจัดเก็บภาษีที่ดินและสิ่งปลูกสร้างและภาษีป้าย ดังต่อไปนี้:
          </p>

          {/* ================= SECTION 1: 8 หมวดรายได้ ================= */}
          <div className="my-4">
            <h3 className="font-bold text-base sm:text-lg underline mb-2">
              ส่วนที่ ๑: รายงานผลการจัดเก็บรายได้ {useThaiNumerals ? '๘' : '8'} หมวดรายได้
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-black text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-black p-2 text-center w-12 font-bold">ลำดับ</th>
                    <th className="border border-black p-2 text-left font-bold">หมวดรายได้</th>
                    <th className="border border-black p-2 text-right font-bold">ประมาณการ (บาท)</th>
                    <th className="border border-black p-2 text-right font-bold">รับจริง (บาท)</th>
                    <th className="border border-black p-2 text-right font-bold">สูง/ต่ำกว่าประมาณการ</th>
                    <th className="border border-black p-2 text-right font-bold w-20">ร้อยละ (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat, idx) => {
                    const est = cat.items.reduce((s, i) => s + (i.estimate || 0), 0);
                    const act = cat.items.reduce((s, i) => s + (i.actual || 0), 0);
                    const diff = act - est;
                    const pct = est > 0 ? (act / est) * 100 : 0;
                    const rowNum = idx + 1;
                    return (
                      <tr key={cat.key}>
                        <td className="border border-black p-1.5 text-center">
                          {fmtNum(rowNum)}
                        </td>
                        <td className="border border-black p-1.5">{cat.title}</td>
                        <td className="border border-black p-1.5 text-right">
                          {fmtCurr(est)}
                        </td>
                        <td className="border border-black p-1.5 text-right font-bold">
                          {fmtCurr(act)}
                        </td>
                        <td className="border border-black p-1.5 text-right font-medium">
                          {fmtDiff(diff)}
                        </td>
                        <td className="border border-black p-1.5 text-right font-bold">
                          {fmtNum(pct.toFixed(2))}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-slate-100">
                    <td className="border border-black p-2 text-center" colSpan={2}>
                      รวมรายได้ทั้งสิ้น ({useThaiNumerals ? '๘' : '8'} หมวด)
                    </td>
                    <td className="border border-black p-2 text-right">
                      {fmtCurr(totalEstimate)}
                    </td>
                    <td className="border border-black p-2 text-right font-black">
                      {fmtCurr(totalActual)}
                    </td>
                    <td className="border border-black p-2 text-right">
                      {fmtDiff(totalBalance)}
                    </td>
                    <td className="border border-black p-2 text-right font-black">
                      {fmtNum(totalPercentage.toFixed(2))}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ================= SECTION 2: ภาษีที่ดินและสิ่งปลูกสร้าง และภาษีป้าย ================= */}
          <div className="mt-6 pt-4 border-t border-black/40">
            <h3 className="font-bold text-base sm:text-lg underline mb-2">
              ส่วนที่ ๒: ระบบติดตามผลการจัดเก็บภาษีที่ดินและสิ่งปลูกสร้าง และภาษีป้าย
            </h3>

            {/* ตารางสรุปภาพรวมภาษีที่ดินและภาษีป้าย */}
            <div className="overflow-x-auto my-3">
              <table className="w-full border-collapse border border-black text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-black p-2 text-left font-bold">ประเภทภาษี</th>
                    <th className="border border-black p-2 text-right font-bold">ประมาณการ (บาท)</th>
                    <th className="border border-black p-2 text-right font-bold">รับจริง (บาท)</th>
                    <th className="border border-black p-2 text-right font-bold">สูง/ต่ำกว่าประมาณการ</th>
                    <th className="border border-black p-2 text-right font-bold">ผู้มีหน้าที่เสียภาษี</th>
                    <th className="border border-black p-2 text-right font-bold">ตั้งลูกหนี้</th>
                    <th className="border border-black p-2 text-right font-bold">อยู่ระหว่างตรวจสอบ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black p-2 font-semibold">ภาษีที่ดินและสิ่งปลูกสร้าง</td>
                    <td className="border border-black p-2 text-right">{fmtCurr(landTax.estimateAmount)}</td>
                    <td className="border border-black p-2 text-right font-bold">{fmtCurr(landTax.collected.amount)}</td>
                    <td className="border border-black p-2 text-right font-medium">{fmtDiff(landDiff)}</td>
                    <td className="border border-black p-2 text-right">
                      {fmtNum(formatNumber(landTax.taxpayers.count))} ราย ({fmtCurr(landTax.taxpayers.amount)} บ.)
                    </td>
                    <td className="border border-black p-2 text-right text-rose-900">
                      {fmtNum(formatNumber(landTax.debtors.count))} ราย ({fmtCurr(landTax.debtors.amount)} บ.)
                    </td>
                    <td className="border border-black p-2 text-right">
                      {fmtNum(formatNumber(landTax.pendingVerification.count))} ราย ({fmtCurr(landTax.pendingVerification.amount)} บ.)
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 font-semibold">ภาษีป้าย</td>
                    <td className="border border-black p-2 text-right">{fmtCurr(signTax.estimateAmount)}</td>
                    <td className="border border-black p-2 text-right font-bold">{fmtCurr(signTax.collected.amount)}</td>
                    <td className="border border-black p-2 text-right font-medium">{fmtDiff(signDiff)}</td>
                    <td className="border border-black p-2 text-right">
                      {fmtNum(formatNumber(signTax.taxpayers.count))} ราย ({fmtCurr(signTax.taxpayers.amount)} บ.)
                    </td>
                    <td className="border border-black p-2 text-right text-rose-900">
                      {fmtNum(formatNumber(signTax.debtors.count))} ราย ({fmtCurr(signTax.debtors.amount)} บ.)
                    </td>
                    <td className="border border-black p-2 text-right">
                      {fmtNum(formatNumber(signTax.pendingVerification.count))} ราย ({fmtCurr(signTax.pendingVerification.amount)} บ.)
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-slate-100">
                    <td className="border border-black p-2">รวมภาษีทั้งสองประเภท</td>
                    <td className="border border-black p-2 text-right">{fmtCurr(combinedTaxEst)}</td>
                    <td className="border border-black p-2 text-right font-black">{fmtCurr(combinedTaxAct)}</td>
                    <td className="border border-black p-2 text-right">{fmtDiff(combinedTaxDiff)}</td>
                    <td className="border border-black p-2 text-right">
                      {fmtNum(formatNumber(landTax.taxpayers.count + signTax.taxpayers.count))} ราย ({fmtCurr(landTax.taxpayers.amount + signTax.taxpayers.amount)} บ.)
                    </td>
                    <td className="border border-black p-2 text-right">
                      {fmtNum(formatNumber(landTax.debtors.count + signTax.debtors.count))} ราย ({fmtCurr(landTax.debtors.amount + signTax.debtors.amount)} บ.)
                    </td>
                    <td className="border border-black p-2 text-right">
                      {fmtNum(formatNumber(landTax.pendingVerification.count + signTax.pendingVerification.count))} ราย ({fmtCurr(landTax.pendingVerification.amount + signTax.pendingVerification.amount)} บ.)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ตารางทะเบียนคุมรายชื่อผู้เสียภาษีและลูกหนี้ภาษีเก่า (ระบบรวม 2570 และลูกหนี้เก่า) */}
            {showDetailedTaxpayers && taxpayers.length > 0 && (
              <div className="mt-4">
                <h4 className="font-bold text-sm sm:text-base mb-1.5">
                  ทะเบียนคุมรายชื่อผู้เสียภาษีและลูกหนี้ภาษีเก่า (ภาษีประจำปี พ.ศ. {useThaiNumerals ? '๒๕๗๐' : '2570'} และลูกหนี้ภาษีเก่า) ({taxpayers.length} ราย)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-black text-[10px] sm:text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-center font-bold">
                        <th className="border border-black p-1 w-7" rowSpan={2}>ลำดับ</th>
                        <th className="border border-black p-1 text-left" rowSpan={2}>ชื่อผู้เสียภาษี / ลูกหนี้ภาษีเก่า</th>
                        <th className="border border-black p-1 w-12" rowSpan={2}>ประเภท</th>
                        <th className="border border-black p-1" colSpan={3}>ภาษีประจำปี พ.ศ. {useThaiNumerals ? '๒๕๗๐' : '2570'}</th>
                        <th className="border border-black p-1" colSpan={2}>ลูกหนี้ภาษีเก่า</th>
                        <th className="border border-black p-1 w-14" rowSpan={2}>เบี้ยปรับ+เงินเพิ่ม</th>
                        <th className="border border-black p-1 w-18 bg-emerald-50" rowSpan={2}>
                          รวมรับจริง (บาท)
                          <span className="block text-[8px] font-normal">(ไม่รวมหนี้เก่า)</span>
                        </th>
                        <th className="border border-black p-1 w-18 bg-rose-50" rowSpan={2}>รวมคงเหลือ (บาท)</th>
                      </tr>
                      <tr className="bg-slate-100 text-center font-bold">
                        <th className="border border-black p-1 text-right">ยอดประเมิน</th>
                        <th className="border border-black p-1 text-right">หลังบรรเทา</th>
                        <th className="border border-black p-1 text-right">ชำระ 2570</th>
                        <th className="border border-black p-1 text-right">หนี้เก่ารวม</th>
                        <th className="border border-black p-1 text-right" title="บวกเพิ่มเฉพาะในช่องนี้">ชำระหนี้เก่า</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxpayers.map((t, idx) => {
                        const assessed = t.assessedAmount || 0;
                        const relief = t.reliefAmount || 0;
                        const afterRelief = t.afterReliefAmount !== undefined ? t.afterReliefAmount : Math.max(0, assessed - relief);
                        const paid2570 = (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0);
                        const rem2570 = t.remainingBalance !== undefined ? t.remainingBalance : Math.max(0, afterRelief - paid2570);

                        const oldDebt = t.oldDebtAmount || 0;
                        const oldPaid = t.oldDebtPaid || 0;
                        const oldRem = t.oldDebtRemaining !== undefined ? t.oldDebtRemaining : Math.max(0, oldDebt - oldPaid);

                        const penSur = (t.penaltyAmount || 0) + (t.surchargeAmount || 0);
                        // ยอดชำระหนี้เก่าไม่นำไปบวกในช่องรับจริง (บวกเพิ่มเฉพาะในช่องรับชำระหนี้เก่า)
                        const actualPaid = paid2570 + penSur;
                        const totalRem = rem2570 + oldRem;

                        return (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="border border-black p-1 text-center">{fmtNum(idx + 1)}</td>
                            <td className="border border-black p-1 font-medium">{t.name}</td>
                            <td className="border border-black p-1 text-center">{t.taxType === 'land' ? 'ที่ดินฯ' : 'ป้าย'}</td>
                            <td className="border border-black p-1 text-right">{fmtCurr(assessed)}</td>
                            <td className="border border-black p-1 text-right">{fmtCurr(afterRelief)}</td>
                            <td className="border border-black p-1 text-right">{fmtCurr(paid2570)}</td>
                            <td className="border border-black p-1 text-right">{fmtCurr(oldDebt)}</td>
                            <td className="border border-black p-1 text-right font-medium text-blue-900">{fmtCurr(oldPaid)}</td>
                            <td className="border border-black p-1 text-right">{fmtCurr(penSur)}</td>
                            <td className="border border-black p-1 text-right font-bold text-emerald-900 bg-emerald-50/40">{fmtCurr(actualPaid)}</td>
                            <td className="border border-black p-1 text-right font-bold text-rose-900 bg-rose-50/40">{fmtCurr(totalRem)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const sumAssessed = taxpayers.reduce((s, t) => s + (t.assessedAmount || 0), 0);
                        const sumAfterRelief = taxpayers.reduce((s, t) => {
                          const assessed = t.assessedAmount || 0;
                          const relief = t.reliefAmount || 0;
                          return s + (t.afterReliefAmount !== undefined ? t.afterReliefAmount : Math.max(0, assessed - relief));
                        }, 0);
                        const sumPaid2570 = taxpayers.reduce((s, t) => s + (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0), 0);
                        const sumOldDebt = taxpayers.reduce((s, t) => s + (t.oldDebtAmount || 0), 0);
                        const sumOldPaid = taxpayers.reduce((s, t) => s + (t.oldDebtPaid || 0), 0);
                        const sumPenSur = taxpayers.reduce((s, t) => s + (t.penaltyAmount || 0) + (t.surchargeAmount || 0), 0);
                        // รวมรับจริงไม่รวมยอดชำระหนี้เก่า
                        const sumActualPaid = taxpayers.reduce((s, t) => {
                          const p2570 = (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0);
                          const ps = (t.penaltyAmount || 0) + (t.surchargeAmount || 0);
                          return s + p2570 + ps;
                        }, 0);
                        const sumTotalRem = taxpayers.reduce((s, t) => {
                          const assessed = t.assessedAmount || 0;
                          const relief = t.reliefAmount || 0;
                          const afterRelief = t.afterReliefAmount !== undefined ? t.afterReliefAmount : Math.max(0, assessed - relief);
                          const p2570 = (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0);
                          const rem2570 = t.remainingBalance !== undefined ? t.remainingBalance : Math.max(0, afterRelief - p2570);
                          const oldDebt = t.oldDebtAmount || 0;
                          const oldPaid = t.oldDebtPaid || 0;
                          const oldRem = t.oldDebtRemaining !== undefined ? t.oldDebtRemaining : Math.max(0, oldDebt - oldPaid);
                          return s + rem2570 + oldRem;
                        }, 0);

                        return (
                          <tr className="bg-slate-100 font-bold">
                            <td className="border border-black p-1.5 text-center" colSpan={3}>
                              รวมทั้งสิ้น ({taxpayers.length} ราย)
                            </td>
                            <td className="border border-black p-1 text-right">{fmtCurr(sumAssessed)}</td>
                            <td className="border border-black p-1 text-right">{fmtCurr(sumAfterRelief)}</td>
                            <td className="border border-black p-1 text-right">{fmtCurr(sumPaid2570)}</td>
                            <td className="border border-black p-1 text-right">{fmtCurr(sumOldDebt)}</td>
                            <td className="border border-black p-1 text-right text-blue-900 font-black">{fmtCurr(sumOldPaid)}</td>
                            <td className="border border-black p-1 text-right">{fmtCurr(sumPenSur)}</td>
                            <td className="border border-black p-1 text-right font-black text-emerald-950 bg-emerald-100/60">{fmtCurr(sumActualPaid)}</td>
                            <td className="border border-black p-1 text-right font-black text-rose-950 bg-rose-100/60">{fmtCurr(sumTotalRem)}</td>
                          </tr>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          <p className="indent-8 pt-4">
            จึงเรียนมาเพื่อโปรดทราบและพิจารณา
          </p>
        </div>

        {/* 3 Required Official Signature Blocks as specified */}
        {/* ผู้รายงาน (เจ้าหน้าที่ฝ่ายพัฒนารายได้) */}
        {/* ผู้ตรวจสอบ (ผู้อำนวยการกองคลัง) */}
        {/* ผู้พิจารณาอนุมัติ (นายกเทศมนตรีเมืองมหาสารคาม) */}
        <div className="mt-12 pt-6 border-t border-slate-300 grid grid-cols-1 md:grid-cols-3 gap-6 text-center text-xs sm:text-sm">
          {/* Position 1: Reporter */}
          <div className="flex flex-col items-center justify-between min-h-[160px] p-2">
            <div className="w-full">
              <p className="font-semibold text-slate-700 mb-10">(ลงชื่อ).......................................................</p>
              <p className="font-bold">( ....................................................... )</p>
              <p className="text-slate-600 mt-1">ผู้รายงาน</p>
              <p className="text-slate-500 text-xs">เจ้าหน้าที่ฝ่ายพัฒนารายได้</p>
            </div>
            <p className="text-slate-400 text-xs mt-3">วันที่ ......./......./.......</p>
          </div>

          {/* Position 2: Inspector */}
          <div className="flex flex-col items-center justify-between min-h-[160px] p-2 border-t md:border-t-0 md:border-l border-slate-200">
            <div className="w-full">
              <p className="font-semibold text-slate-700 mb-10">(ลงชื่อ).......................................................</p>
              <p className="font-bold">( ....................................................... )</p>
              <p className="text-slate-600 mt-1">ผู้ตรวจสอบ</p>
              <p className="text-slate-500 text-xs">ผู้อำนวยการกองคลัง</p>
            </div>
            <p className="text-slate-400 text-xs mt-3">วันที่ ......./......./.......</p>
          </div>

          {/* Position 3: Approver */}
          <div className="flex flex-col items-center justify-between min-h-[160px] p-2 border-t md:border-t-0 md:border-l border-slate-200">
            <div className="w-full">
              <p className="font-semibold text-slate-700 mb-10">(ลงชื่อ).......................................................</p>
              <p className="font-bold">( ....................................................... )</p>
              <p className="text-slate-600 mt-1">ผู้พิจารณาอนุมัติ</p>
              <p className="text-slate-500 text-xs">นายกเทศมนตรีเมืองมหาสารคาม</p>
            </div>
            <p className="text-slate-400 text-xs mt-3">วันที่ ......./......./.......</p>
          </div>
        </div>
      </div>
    </div>
  );
};
