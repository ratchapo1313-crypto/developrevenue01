import * as XLSX from 'xlsx';
import {
  RevenueCategory,
  DetailedTaxData,
  MarketContract,
  MarketSummary,
  DailyRecord,
  TaxpayerRecord,
  OldTaxDebtorRecord,
  OLD_TAX_YEARS,
} from '../types/revenue';

// Format Thai currency numbers
export const formatCurrency = (val: number | undefined): string => {
  if (val === undefined || isNaN(val)) return '0.00';
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatNumber = (val: number | undefined): string => {
  if (val === undefined || isNaN(val)) return '0';
  return val.toLocaleString('th-TH');
};

/**
 * Export full workbook containing 8 categories summary, each category sheet, land tax, and sign tax
 */
export const exportFullWorkbook = (
  categories: RevenueCategory[],
  landTax: DetailedTaxData,
  signTax: DetailedTaxData,
  _marketContracts?: MarketContract[],
  _marketSummaries?: Record<'night_market' | 'fresh_market', MarketSummary>,
  taxpayers: TaxpayerRecord[] = [],
  _dailyRecords?: DailyRecord[]
) => {
  const wb = XLSX.utils.book_new();

  // 1. Overall Summary Sheet (8 Categories)
  const summaryRows = [
    ['รายงานผลการดำเนินงานการจัดเก็บรายได้ ประจำปีงบประมาณ พ.ศ. 2570'],
    ['ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม'],
    ['วันที่ส่งออกข้อมูล:', new Date().toLocaleDateString('th-TH')],
    [],
    ['ลำดับ', 'หมวดรายได้', 'ประมาณการ (บาท)', 'รับจริง (บาท)', 'สูง/ต่ำกว่าประมาณการ', 'ร้อยละรับจริงเทียบประมาณการ (%)'],
  ];

  let totalEst = 0;
  let totalAct = 0;

  categories.forEach((cat, index) => {
    const est = cat.items.reduce((s, i) => s + (i.estimate || 0), 0);
    const act = cat.items.reduce((s, i) => s + (i.actual || 0), 0);
    const diff = act - est;
    const pct = est > 0 ? (act / est) * 100 : 0;
    totalEst += est;
    totalAct += act;

    summaryRows.push([
      (index + 1).toString(),
      cat.title,
      est.toString(),
      act.toString(),
      (diff >= 0 ? `+${diff}` : `${diff}`),
      pct.toFixed(2) + '%',
    ]);
  });

  const totalDiff = totalAct - totalEst;
  const totalPct = totalEst > 0 ? (totalAct / totalEst) * 100 : 0;
  summaryRows.push([
    '',
    'รวมรายได้ทั้งสิ้น',
    totalEst.toString(),
    totalAct.toString(),
    (totalDiff >= 0 ? `+${totalDiff}` : `${totalDiff}`),
    totalPct.toFixed(2) + '%',
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปภาพรวมรายได้');

  // 2. Each Category Sheet (8 Categories)
  categories.forEach((cat, idx) => {
    const catRows = [
      [`${cat.title} - ประจำปีงบประมาณ 2570 เทศบาลเมืองมหาสารคาม`],
      [],
      ['รหัสรายการ', 'รายการรายได้', 'ประมาณการ (บาท)', 'รับจริง (บาท)', 'สูง/ต่ำกว่าประมาณการ', 'ร้อยละ (%)'],
    ];

    let catEst = 0;
    let catAct = 0;

    cat.items.forEach((item) => {
      const est = item.estimate || 0;
      const act = item.actual || 0;
      const diff = act - est;
      const pct = est > 0 ? (act / est) * 100 : 0;
      catEst += est;
      catAct += act;

      catRows.push([
        item.id,
        item.name,
        est.toString(),
        act.toString(),
        (diff >= 0 ? `+${diff}` : `${diff}`),
        pct.toFixed(2) + '%',
      ]);
    });

    const catDiff = catAct - catEst;
    const catPct = catEst > 0 ? (catAct / catEst) * 100 : 0;
    catRows.push([
      'รวม',
      `รวม${cat.title}`,
      catEst.toString(),
      catAct.toString(),
      (catDiff >= 0 ? `+${catDiff}` : `${catDiff}`),
      catPct.toFixed(2) + '%',
    ]);

    const safeTitle = `${idx + 1}_${cat.shortTitle.substring(0, 20)}`;
    const wsCat = XLSX.utils.aoa_to_sheet(catRows);
    XLSX.utils.book_append_sheet(wb, wsCat, safeTitle);
  });

  // 3. Detailed Land & Building Tax Sheet
  const landTaxpayers = taxpayers.filter((t) => t.taxType === 'land');
  const landDiff = landTax.collected.amount - landTax.estimateAmount;
  const landRows = [
    ['ระบบติดตามผลการจัดเก็บภาษีที่ดินและสิ่งปลูกสร้าง ประจำปีงบประมาณ พ.ศ. 2570 เทศบาลเมืองมหาสารคาม'],
    ['วันที่ส่งออกข้อมูล:', new Date().toLocaleDateString('th-TH')],
    [],
    ['--- ข้อมูลสรุปภาพรวมการจัดเก็บภาษีที่ดินและสิ่งปลูกสร้าง ---'],
    ['รายการ', 'จำนวน (ราย)', 'จำนวนเงิน (บาท)', 'หมายเหตุ'],
    ['ประมาณการเงินรายรับ', '-', landTax.estimateAmount.toString(), 'แผนงบประมาณ'],
    ['รับจริง (จัดเก็บได้แล้ว)', landTax.collected.count.toString(), landTax.collected.amount.toString(), 'ชำระสะสม'],
    ['สูง/ต่ำกว่าประมาณการ', '-', (landDiff >= 0 ? `+${landDiff}` : `${landDiff}`), landDiff >= 0 ? 'สูงกว่าเป้าหมาย' : 'ต่ำกว่าเป้าหมาย'],
    ['ผู้มีหน้าที่เสียภาษี', landTax.taxpayers.count.toString(), landTax.taxpayers.amount.toString(), 'ฐานข้อมูลผู้เสียภาษี'],
    ['ตั้งลูกหนี้', landTax.debtors.count.toString(), landTax.debtors.amount.toString(), 'ค้างชำระ'],
    ['อยู่ระหว่างตรวจสอบข้อมูล', landTax.pendingVerification.count.toString(), landTax.pendingVerification.amount.toString(), 'คำร้องคัดค้าน/ตรวจสอบพื้นที่'],
    [],
    ['--- ทะเบียนคุมรายชื่อผู้เสียภาษีที่ดินและสิ่งปลูกสร้าง ---'],
    [
      'ลำดับ',
      'ชื่อผู้เสียภาษี (บอกชื่อ)',
      'ยอดประเมิน (บาท)',
      'ยอดบรรเทา (บาท)',
      'ยอดหลังบรรเทา (บาท)',
      'สถานะการชำระ',
      'จำนวนเงิน ครั้งที่ 1 (บาท)',
      'จำนวนเงิน ครั้งที่ 2 (บาท)',
      'จำนวนเงิน ครั้งที่ 3 (บาท)',
      'รวมรับชำระแล้ว (บาท)',
      'ยอดเงินคงเหลือ (บาท)',
      'สถานะรับจริง',
      'หมายเหตุ',
    ],
  ];

  let sumLandAssessed = 0;
  let sumLandRelief = 0;
  let sumLandAfterRelief = 0;
  let sumLandP1 = 0;
  let sumLandP2 = 0;
  let sumLandP3 = 0;
  let sumLandTotalPaid = 0;
  let sumLandRemaining = 0;

  landTaxpayers.forEach((t, idx) => {
    const totalPaid = (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0);
    const statusText =
      t.status === 0
        ? '0 = ยังไม่ชำระ'
        : t.status === 1
        ? '1 = ชำระแล้ว'
        : t.status === 2
        ? '2 = ชำระงวดที่ 2'
        : '3 = ชำระงวดที่ 3';

    sumLandAssessed += t.assessedAmount || 0;
    sumLandRelief += t.reliefAmount || 0;
    sumLandAfterRelief += t.afterReliefAmount || 0;
    sumLandP1 += t.payment1 || 0;
    sumLandP2 += t.payment2 || 0;
    sumLandP3 += t.payment3 || 0;
    sumLandTotalPaid += totalPaid;
    sumLandRemaining += t.remainingBalance || 0;

    landRows.push([
      (idx + 1).toString(),
      t.name,
      t.assessedAmount.toString(),
      t.reliefAmount.toString(),
      t.afterReliefAmount.toString(),
      statusText,
      (t.payment1 || 0).toString(),
      (t.payment2 || 0).toString(),
      (t.payment3 || 0).toString(),
      totalPaid.toString(),
      t.remainingBalance.toString(),
      t.isFullyPaid ? 'ชำระครบถ้วน' : (totalPaid > 0 ? 'ผ่อนชำระบางส่วน' : 'ยังไม่ชำระ'),
      t.notes || '',
    ]);
  });

  landRows.push([
    'รวม',
    `รวมทั้งสิ้น ${landTaxpayers.length} ราย`,
    sumLandAssessed.toString(),
    sumLandRelief.toString(),
    sumLandAfterRelief.toString(),
    '',
    sumLandP1.toString(),
    sumLandP2.toString(),
    sumLandP3.toString(),
    sumLandTotalPaid.toString(),
    sumLandRemaining.toString(),
    '',
    '',
  ]);

  const wsLand = XLSX.utils.aoa_to_sheet(landRows);
  XLSX.utils.book_append_sheet(wb, wsLand, 'ภาษีที่ดินและสิ่งปลูกสร้าง');

  // 4. Detailed Sign Tax Sheet
  const signTaxpayers = taxpayers.filter((t) => t.taxType === 'sign');
  const signDiff = signTax.collected.amount - signTax.estimateAmount;
  const signRows = [
    ['ระบบติดตามผลการจัดเก็บภาษีป้าย ประจำปีงบประมาณ พ.ศ. 2570 เทศบาลเมืองมหาสารคาม'],
    ['วันที่ส่งออกข้อมูล:', new Date().toLocaleDateString('th-TH')],
    [],
    ['--- ข้อมูลสรุปภาพรวมการจัดเก็บภาษีป้าย ---'],
    ['รายการ', 'จำนวน (ราย)', 'จำนวนเงิน (บาท)', 'หมายเหตุ'],
    ['ประมาณการเงินรายรับ', '-', signTax.estimateAmount.toString(), 'แผนงบประมาณ'],
    ['รับจริง (จัดเก็บได้แล้ว)', signTax.collected.count.toString(), signTax.collected.amount.toString(), 'ชำระสะสม'],
    ['สูง/ต่ำกว่าประมาณการ', '-', (signDiff >= 0 ? `+${signDiff}` : `${signDiff}`), signDiff >= 0 ? 'สูงกว่าเป้าหมาย' : 'ต่ำกว่าเป้าหมาย'],
    ['ผู้มีหน้าที่เสียภาษี', signTax.taxpayers.count.toString(), signTax.taxpayers.amount.toString(), 'ฐานข้อมูลผู้เสียภาษี'],
    ['ตั้งลูกหนี้', signTax.debtors.count.toString(), signTax.debtors.amount.toString(), 'ค้างชำระ'],
    ['อยู่ระหว่างตรวจสอบข้อมูล', signTax.pendingVerification.count.toString(), signTax.pendingVerification.amount.toString(), 'ตรวจสอบขนาดป้าย/คำร้อง'],
    [],
    ['--- ทะเบียนคุมรายชื่อผู้เสียภาษีป้าย ---'],
    [
      'ลำดับ',
      'ชื่อผู้เสียภาษี (บอกชื่อ)',
      'ยอดประเมิน (บาท)',
      'ยอดบรรเทา (บาท)',
      'ยอดหลังบรรเทา (บาท)',
      'สถานะการชำระ',
      'จำนวนเงิน ครั้งที่ 1 (บาท)',
      'จำนวนเงิน ครั้งที่ 2 (บาท)',
      'จำนวนเงิน ครั้งที่ 3 (บาท)',
      'รวมรับชำระแล้ว (บาท)',
      'ยอดเงินคงเหลือ (บาท)',
      'สถานะรับจริง',
      'หมายเหตุ',
    ],
  ];

  let sumSignAssessed = 0;
  let sumSignRelief = 0;
  let sumSignAfterRelief = 0;
  let sumSignP1 = 0;
  let sumSignP2 = 0;
  let sumSignP3 = 0;
  let sumSignTotalPaid = 0;
  let sumSignRemaining = 0;

  signTaxpayers.forEach((t, idx) => {
    const totalPaid = (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0);
    const statusText =
      t.status === 0
        ? '0 = ยังไม่ชำระ'
        : t.status === 1
        ? '1 = ชำระแล้ว'
        : t.status === 2
        ? '2 = ชำระงวดที่ 2'
        : '3 = ชำระงวดที่ 3';

    sumSignAssessed += t.assessedAmount || 0;
    sumSignRelief += t.reliefAmount || 0;
    sumSignAfterRelief += t.afterReliefAmount || 0;
    sumSignP1 += t.payment1 || 0;
    sumSignP2 += t.payment2 || 0;
    sumSignP3 += t.payment3 || 0;
    sumSignTotalPaid += totalPaid;
    sumSignRemaining += t.remainingBalance || 0;

    signRows.push([
      (idx + 1).toString(),
      t.name,
      t.assessedAmount.toString(),
      t.reliefAmount.toString(),
      t.afterReliefAmount.toString(),
      statusText,
      (t.payment1 || 0).toString(),
      (t.payment2 || 0).toString(),
      (t.payment3 || 0).toString(),
      totalPaid.toString(),
      t.remainingBalance.toString(),
      t.isFullyPaid ? 'ชำระครบถ้วน' : (totalPaid > 0 ? 'ผ่อนชำระบางส่วน' : 'ยังไม่ชำระ'),
      t.notes || '',
    ]);
  });

  signRows.push([
    'รวม',
    `รวมทั้งสิ้น ${signTaxpayers.length} ราย`,
    sumSignAssessed.toString(),
    sumSignRelief.toString(),
    sumSignAfterRelief.toString(),
    '',
    sumSignP1.toString(),
    sumSignP2.toString(),
    sumSignP3.toString(),
    sumSignTotalPaid.toString(),
    sumSignRemaining.toString(),
    '',
    '',
  ]);

  const wsSign = XLSX.utils.aoa_to_sheet(signRows);
  XLSX.utils.book_append_sheet(wb, wsSign, 'ภาษีป้าย');

  // Save workbook
  const fileName = `รายงานรายได้รวมทุกระบบ_เทศบาลเมืองมหาสารคาม_2570_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

/**
 * Export specifically Tax Tracking (Land & Building Tax + Sign Tax) to Excel
 */
export const exportTaxTrackingWorkbook = (
  landTax: DetailedTaxData,
  signTax: DetailedTaxData,
  taxpayers: TaxpayerRecord[]
) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary of both taxes
  const landDiff = landTax.collected.amount - landTax.estimateAmount;
  const signDiff = signTax.collected.amount - signTax.estimateAmount;
  const totalEst = landTax.estimateAmount + signTax.estimateAmount;
  const totalAct = landTax.collected.amount + signTax.collected.amount;
  const totalDiff = totalAct - totalEst;

  const summaryRows = [
    ['สรุปผลการจัดเก็บภาษีที่ดินและสิ่งปลูกสร้าง และภาษีป้าย ประจำปีงบประมาณ 2570'],
    ['ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม'],
    ['วันที่ส่งออกข้อมูล:', new Date().toLocaleDateString('th-TH')],
    [],
    [
      'ประเภทภาษี',
      'ประมาณการ (บาท)',
      'รับจริง (บาท)',
      'สูง/ต่ำกว่าประมาณการ (บาท)',
      'ร้อยละ (%)',
      'ผู้มีหน้าที่เสียภาษี (ราย)',
      'ผู้มีหน้าที่เสียภาษี (บาท)',
      'ตั้งลูกหนี้ (ราย)',
      'ตั้งลูกหนี้ (บาท)',
      'อยู่ระหว่างตรวจสอบ (ราย)',
      'อยู่ระหว่างตรวจสอบ (บาท)',
    ],
    [
      'ภาษีที่ดินและสิ่งปลูกสร้าง',
      landTax.estimateAmount.toString(),
      landTax.collected.amount.toString(),
      (landDiff >= 0 ? `+${landDiff}` : `${landDiff}`),
      (landTax.estimateAmount > 0 ? (landTax.collected.amount / landTax.estimateAmount) * 100 : 0).toFixed(2) + '%',
      landTax.taxpayers.count.toString(),
      landTax.taxpayers.amount.toString(),
      landTax.debtors.count.toString(),
      landTax.debtors.amount.toString(),
      landTax.pendingVerification.count.toString(),
      landTax.pendingVerification.amount.toString(),
    ],
    [
      'ภาษีป้าย',
      signTax.estimateAmount.toString(),
      signTax.collected.amount.toString(),
      (signDiff >= 0 ? `+${signDiff}` : `${signDiff}`),
      (signTax.estimateAmount > 0 ? (signTax.collected.amount / signTax.estimateAmount) * 100 : 0).toFixed(2) + '%',
      signTax.taxpayers.count.toString(),
      signTax.taxpayers.amount.toString(),
      signTax.debtors.count.toString(),
      signTax.debtors.amount.toString(),
      signTax.pendingVerification.count.toString(),
      signTax.pendingVerification.amount.toString(),
    ],
    [
      'รวมทั้งสิ้น',
      totalEst.toString(),
      totalAct.toString(),
      (totalDiff >= 0 ? `+${totalDiff}` : `${totalDiff}`),
      (totalEst > 0 ? (totalAct / totalEst) * 100 : 0).toFixed(2) + '%',
      (landTax.taxpayers.count + signTax.taxpayers.count).toString(),
      (landTax.taxpayers.amount + signTax.taxpayers.amount).toString(),
      (landTax.debtors.count + signTax.debtors.count).toString(),
      (landTax.debtors.amount + signTax.debtors.amount).toString(),
      (landTax.pendingVerification.count + signTax.pendingVerification.count).toString(),
      (landTax.pendingVerification.amount + signTax.pendingVerification.amount).toString(),
    ],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปภาพรวมภาษี');

  // Sheet 2: Land Taxpayers
  const landTaxpayers = taxpayers.filter((t) => t.taxType === 'land');
  const landRows = [
    ['ทะเบียนคุมรายชื่อผู้เสียภาษีที่ดินและสิ่งปลูกสร้าง ประจำปีงบประมาณ 2570'],
    ['เทศบาลเมืองมหาสารคาม'],
    [],
    [
      'ลำดับ',
      'ชื่อผู้เสียภาษี (บอกชื่อ)',
      'ยอดประเมิน (บาท)',
      'ยอดบรรเทา (บาท)',
      'ยอดหลังบรรเทา (บาท)',
      'สถานะการชำระ',
      'จำนวนเงิน ครั้งที่ 1 (บาท)',
      'จำนวนเงิน ครั้งที่ 2 (บาท)',
      'จำนวนเงิน ครั้งที่ 3 (บาท)',
      'รวมรับชำระแล้ว (บาท)',
      'ยอดเงินคงเหลือ (บาท)',
      'สถานะรับจริง',
      'หมายเหตุ',
    ],
  ];

  landTaxpayers.forEach((t, idx) => {
    const totalPaid = (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0);
    const statusText =
      t.status === 0
        ? '0 = ยังไม่ชำระ'
        : t.status === 1
        ? '1 = ชำระแล้ว'
        : t.status === 2
        ? '2 = ชำระงวดที่ 2'
        : '3 = ชำระงวดที่ 3';

    landRows.push([
      (idx + 1).toString(),
      t.name,
      t.assessedAmount.toString(),
      t.reliefAmount.toString(),
      t.afterReliefAmount.toString(),
      statusText,
      (t.payment1 || 0).toString(),
      (t.payment2 || 0).toString(),
      (t.payment3 || 0).toString(),
      totalPaid.toString(),
      t.remainingBalance.toString(),
      t.isFullyPaid ? 'ชำระครบถ้วน' : (totalPaid > 0 ? 'ผ่อนชำระบางส่วน' : 'ยังไม่ชำระ'),
      t.notes || '',
    ]);
  });
  const wsLand = XLSX.utils.aoa_to_sheet(landRows);
  XLSX.utils.book_append_sheet(wb, wsLand, 'รายชื่อภาษีที่ดินฯ');

  // Sheet 3: Sign Taxpayers
  const signTaxpayers = taxpayers.filter((t) => t.taxType === 'sign');
  const signRows = [
    ['ทะเบียนคุมรายชื่อผู้เสียภาษีป้าย ประจำปีงบประมาณ 2570'],
    ['เทศบาลเมืองมหาสารคาม'],
    [],
    [
      'ลำดับ',
      'ชื่อผู้เสียภาษี (บอกชื่อ)',
      'ยอดประเมิน (บาท)',
      'ยอดบรรเทา (บาท)',
      'ยอดหลังบรรเทา (บาท)',
      'สถานะการชำระ',
      'จำนวนเงิน ครั้งที่ 1 (บาท)',
      'จำนวนเงิน ครั้งที่ 2 (บาท)',
      'จำนวนเงิน ครั้งที่ 3 (บาท)',
      'รวมรับชำระแล้ว (บาท)',
      'ยอดเงินคงเหลือ (บาท)',
      'สถานะรับจริง',
      'หมายเหตุ',
    ],
  ];

  signTaxpayers.forEach((t, idx) => {
    const totalPaid = (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0);
    const statusText =
      t.status === 0
        ? '0 = ยังไม่ชำระ'
        : t.status === 1
        ? '1 = ชำระแล้ว'
        : t.status === 2
        ? '2 = ชำระงวดที่ 2'
        : '3 = ชำระงวดที่ 3';

    signRows.push([
      (idx + 1).toString(),
      t.name,
      t.assessedAmount.toString(),
      t.reliefAmount.toString(),
      t.afterReliefAmount.toString(),
      statusText,
      (t.payment1 || 0).toString(),
      (t.payment2 || 0).toString(),
      (t.payment3 || 0).toString(),
      totalPaid.toString(),
      t.remainingBalance.toString(),
      t.isFullyPaid ? 'ชำระครบถ้วน' : (totalPaid > 0 ? 'ผ่อนชำระบางส่วน' : 'ยังไม่ชำระ'),
      t.notes || '',
    ]);
  });
  const wsSign = XLSX.utils.aoa_to_sheet(signRows);
  XLSX.utils.book_append_sheet(wb, wsSign, 'รายชื่อภาษีป้าย');

  XLSX.writeFile(wb, `รายงานติดตามภาษีที่ดินและภาษีป้าย_เทศบาลเมืองมหาสารคาม_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/**
 * Export specifically Market Assets (Night market + Fresh market) to Excel
 */
export const exportMarketContractsWorkbook = (
  marketContracts: MarketContract[],
  marketSummaries: Record<'night_market' | 'fresh_market', MarketSummary>
) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Stalls Summary
  const nmSummary = marketSummaries.night_market;
  const fmSummary = marketSummaries.fresh_market;
  const nmContracts = marketContracts.filter((c) => c.marketType === 'night_market');
  const fmContracts = marketContracts.filter((c) => c.marketType === 'fresh_market');

  const nmRent = nmContracts.reduce((s, c) => s + (c.monthlyRent || 0), 0);
  const fmRent = fmContracts.reduce((s, c) => s + (c.monthlyRent || 0), 0);
  const nmDeposit = nmContracts.reduce((s, c) => s + (c.securityDeposit || 0), 0);
  const fmDeposit = fmContracts.reduce((s, c) => s + (c.securityDeposit || 0), 0);
  const nmFee = nmContracts.reduce((s, c) => s + (c.transactionFee || 0), 0);
  const fmFee = fmContracts.reduce((s, c) => s + (c.transactionFee || 0), 0);

  const summaryRows = [
    ['รายงานการจัดหาประโยชน์จากทรัพย์สิน (ตลาดโต้รุ่ง และตลาดสด) ประจำปีงบประมาณ 2570'],
    ['เทศบาลเมืองมหาสารคาม'],
    ['วันที่ส่งออกข้อมูล:', new Date().toLocaleDateString('th-TH')],
    [],
    [
      'ตลาดทรัพย์สิน',
      'จำนวนกี่ล็อคทั้งหมด',
      'มีสัญญาเช่าแล้ว (ล็อค)',
      'ล็อคคงเหลือว่าง (ล็อค)',
      'อัตราการจัดให้เช่า (%)',
      'ค่าเช่าต่อเดือนรวม (บาท)',
      'เงินประกันสัญญาเช่ารวม (บาท)',
      'ค่าธรรมเนียมธุรกรรมรวม (บาท)',
    ],
    [
      'ตลาดโต้รุ่ง',
      nmSummary.totalStalls.toString(),
      nmContracts.length.toString(),
      Math.max(0, nmSummary.totalStalls - nmContracts.length).toString(),
      (nmSummary.totalStalls > 0 ? (nmContracts.length / nmSummary.totalStalls) * 100 : 0).toFixed(1) + '%',
      nmRent.toString(),
      nmDeposit.toString(),
      nmFee.toString(),
    ],
    [
      'ตลาดสดเทศบาลเมืองมหาสารคาม',
      fmSummary.totalStalls.toString(),
      fmContracts.length.toString(),
      Math.max(0, fmSummary.totalStalls - fmContracts.length).toString(),
      (fmSummary.totalStalls > 0 ? (fmContracts.length / fmSummary.totalStalls) * 100 : 0).toFixed(1) + '%',
      fmRent.toString(),
      fmDeposit.toString(),
      fmFee.toString(),
    ],
    [
      'รวมทั้งสิ้น',
      (nmSummary.totalStalls + fmSummary.totalStalls).toString(),
      (nmContracts.length + fmContracts.length).toString(),
      (Math.max(0, nmSummary.totalStalls - nmContracts.length) + Math.max(0, fmSummary.totalStalls - fmContracts.length)).toString(),
      ((nmSummary.totalStalls + fmSummary.totalStalls) > 0 ? ((nmContracts.length + fmContracts.length) / (nmSummary.totalStalls + fmSummary.totalStalls)) * 100 : 0).toFixed(1) + '%',
      (nmRent + fmRent).toString(),
      (nmDeposit + fmDeposit).toString(),
      (nmFee + fmFee).toString(),
    ],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปภาพรวมตลาด');

  // Sheet 2: Night Market
  const nmRows = [
    ['ตารางสัญญาเช่าตลาดโต้รุ่ง เทศบาลเมืองมหาสารคาม (มีสัญญาเช่าแล้ว)'],
    [],
    [
      'ลำดับ',
      'รายการทรัพย์สิน (ชื่อล็อค/แผงค้า)',
      'เลขที่สัญญา',
      'ผู้เช่า / ผู้ทำสัญญา',
      'วันที่เริ่มสัญญา',
      'กำหนดระยะเวลาการเช่า',
      'วันที่สิ้นสุดสัญญา (คำนวณอัตโนมัติ)',
      'ค่าธรรมเนียมการทำธุรกรรม (บาท)',
      'จำนวนค่าเช่า/เดือน (บาท)',
      'เงินประกันสัญญาเช่า (บาท)',
    ],
  ];
  nmContracts.forEach((con, idx) => {
    nmRows.push([
      (idx + 1).toString(),
      con.propertyName,
      con.contractNumber,
      con.lesseeName || '-',
      con.startDate,
      con.leaseDuration || '1 ปี',
      con.endDate,
      con.transactionFee.toString(),
      con.monthlyRent.toString(),
      con.securityDeposit.toString(),
    ]);
  });
  const wsNM = XLSX.utils.aoa_to_sheet(nmRows);
  XLSX.utils.book_append_sheet(wb, wsNM, 'สัญญาตลาดโต้รุ่ง');

  // Sheet 3: Fresh Market
  const fmRows = [
    ['ตารางสัญญาเช่าตลาดสด เทศบาลเมืองมหาสารคาม (มีสัญญาเช่าแล้ว)'],
    [],
    [
      'ลำดับ',
      'รายการทรัพย์สิน (ชื่อล็อค/แผงค้า)',
      'เลขที่สัญญา',
      'ผู้เช่า / ผู้ทำสัญญา',
      'วันที่เริ่มสัญญา',
      'กำหนดระยะเวลาการเช่า',
      'วันที่สิ้นสุดสัญญา (คำนวณอัตโนมัติ)',
      'ค่าธรรมเนียมการทำธุรกรรม (บาท)',
      'จำนวนค่าเช่า/เดือน (บาท)',
      'เงินประกันสัญญาเช่า (บาท)',
    ],
  ];
  fmContracts.forEach((con, idx) => {
    fmRows.push([
      (idx + 1).toString(),
      con.propertyName,
      con.contractNumber,
      con.lesseeName || '-',
      con.startDate,
      con.leaseDuration || '1 ปี',
      con.endDate,
      con.transactionFee.toString(),
      con.monthlyRent.toString(),
      con.securityDeposit.toString(),
    ]);
  });
  const wsFM = XLSX.utils.aoa_to_sheet(fmRows);
  XLSX.utils.book_append_sheet(wb, wsFM, 'สัญญาตลาดสด');

  XLSX.writeFile(wb, `รายงานจัดหาประโยชน์จากทรัพย์สิน_ตลาดโต้รุ่งและตลาดสด_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/**
 * Export single category to Excel
 */
export const exportSingleCategory = (category: RevenueCategory) => {
  const wb = XLSX.utils.book_new();
  const rows = [
    [`รายงาน${category.title} ประจำปีงบประมาณ 2570`],
    ['ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม'],
    ['วันที่ส่งออกข้อมูล:', new Date().toLocaleDateString('th-TH')],
    [],
    ['รหัสรายการ', 'รายการรายได้', 'ประมาณการ (บาท)', 'รับจริง (บาท)', 'สูง/ต่ำกว่าประมาณการ', 'ร้อยละรับจริง (%)'],
  ];

  let totalEst = 0;
  let totalAct = 0;

  category.items.forEach((item) => {
    const est = item.estimate || 0;
    const act = item.actual || 0;
    const diff = act - est;
    const pct = est > 0 ? (act / est) * 100 : 0;
    totalEst += est;
    totalAct += act;

    rows.push([
      item.id,
      item.name,
      est.toString(),
      act.toString(),
      (diff >= 0 ? `+${diff}` : `${diff}`),
      pct.toFixed(2) + '%',
    ]);
  });

  const totalDiff = totalAct - totalEst;
  const totalPct = totalEst > 0 ? (totalAct / totalEst) * 100 : 0;
  rows.push([
    'รวม',
    `รวมทั้งสิ้นใน${category.title}`,
    totalEst.toString(),
    totalAct.toString(),
    (totalDiff >= 0 ? `+${totalDiff}` : `${totalDiff}`),
    totalPct.toFixed(2) + '%',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, category.shortTitle.substring(0, 25));
  XLSX.writeFile(wb, `รายงาน_${category.shortTitle}_2570.xlsx`);
};

/**
 * Export Taxpayers Registry to Excel (.xlsx)
 * Unified Registry: 2570 Annual Tax + Old Tax Debts under same taxpayer
 * Includes penalties, surcharges, and actual collection amount (+เข้ารับจริง)
 */
export const exportTaxpayersToExcel = (
  taxpayers: TaxpayerRecord[],
  taxType: 'land' | 'sign' | 'all'
) => {
  const filtered = taxpayers.filter((t) => taxType === 'all' || t.taxType === taxType);
  const typeLabel =
    taxType === 'land'
      ? 'ภาษีที่ดินและสิ่งปลูกสร้าง'
      : taxType === 'sign'
      ? 'ภาษีป้าย'
      : 'ภาษีที่ดินและภาษีป้าย';

  const wb = XLSX.utils.book_new();
  const rows = [
    [`ทะเบียนคุมรายชื่อผู้เสียภาษีและลูกหนี้ภาษีเก่า ${typeLabel} - เทศบาลเมืองมหาสารคาม`],
    ['ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม (รวมข้อมูลภาษีปี 2570 และลูกหนี้ภาษีเก่าอ้างอิงชื่อเดียวกัน)'],
    ['วันที่ส่งออกข้อมูล:', new Date().toLocaleDateString('th-TH')],
    ['คำนวณรับจริง:', 'ยอดชำระปี 2570 + เบี้ยปรับ + เงินเพิ่ม (ยอดชำระหนี้เก่าบวกเพิ่มในช่องรับชำระหนี้เก่าเท่านั้น ไม่นำไปบวกในช่องรับจริง)'],
    [],
    [
      'ลำดับ',
      'ชื่อผู้เสียภาษี / รายการ',
      'ประเภทภาษี',
      'ยอดประเมิน 2570 (บาท)',
      'ยอดบรรเทา (บาท)',
      'ยอดหลังบรรเทา (บาท)',
      'สถานะการชำระ 2570',
      'ชำระแล้ว 2570 (บาท)',
      'คงเหลือ 2570 (บาท)',
      'ยอดลูกหนี้ภาษีเก่ารวม (บาท)',
      'สถานะหนี้เก่า',
      'รับชำระหนี้เก่า (บาท)',
      'เบี้ยปรับ (บาท)',
      'เงินเพิ่ม (บาท)',
      'คงเหลือลูกหนี้เก่า (บาท)',
      'ยอดรับจริง (บาท)',
      'รวมหนี้คงเหลือทั้งสิ้น (บาท)',
      'หมายเหตุ',
    ],
  ];

  let sumAssessed = 0;
  let sumRelief = 0;
  let sumAfterRelief = 0;
  let sumPaid2570 = 0;
  let sumRem2570 = 0;
  let sumOldDebt = 0;
  let sumOldPaid = 0;
  let sumPenalties = 0;
  let sumSurcharges = 0;
  let sumOldRem = 0;
  let sumTotalCollected = 0;
  let sumTotalRemaining = 0;

  filtered.forEach((t, idx) => {
    const assessed = t.assessedAmount || 0;
    const relief = t.reliefAmount || 0;
    const afterRelief = t.afterReliefAmount || 0;
    const p2570 = (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0);
    const rem2570 = t.remainingBalance !== undefined ? t.remainingBalance : Math.max(0, afterRelief - p2570);

    const oldDebt = t.oldDebtAmount || 0;
    const oldPaid = t.oldDebtPaid || 0;
    const pen = t.penaltyAmount || 0;
    const sur = t.surchargeAmount || 0;
    const oldRem = t.oldDebtRemaining !== undefined ? t.oldDebtRemaining : Math.max(0, oldDebt - oldPaid);

    // ยอดชำระหนี้เก่าไม่นำไปบวกในช่องรับจริง (บวกเพิ่มเฉพาะในช่องรับชำระหนี้เก่า)
    const actualCollected = p2570 + pen + sur;
    const totalRemaining = rem2570 + oldRem;

    const statusText2570 =
      t.status === 0
        ? '0 = ยังไม่ชำระ'
        : t.status === 1
        ? '1 = ชำระแล้ว'
        : t.status === 2
        ? '2 = ผ่อนงวด 2'
        : '3 = ผ่อนงวด 3';

    const statusTextOld =
      (t.oldDebtStatus ?? 0) === 0
        ? '0 = ยังไม่ชำระ'
        : (t.oldDebtStatus ?? 0) === 1
        ? '1 = ชำระแล้ว'
        : '2 = ชำระบางส่วน';

    sumAssessed += assessed;
    sumRelief += relief;
    sumAfterRelief += afterRelief;
    sumPaid2570 += p2570;
    sumRem2570 += rem2570;
    sumOldDebt += oldDebt;
    sumOldPaid += oldPaid;
    sumPenalties += pen;
    sumSurcharges += sur;
    sumOldRem += oldRem;
    sumTotalCollected += actualCollected;
    sumTotalRemaining += totalRemaining;

    rows.push([
      (idx + 1).toString(),
      t.name,
      t.taxType === 'land' ? 'ภาษีที่ดินและสิ่งปลูกสร้าง' : 'ภาษีป้าย',
      assessed.toString(),
      relief.toString(),
      afterRelief.toString(),
      statusText2570,
      p2570.toString(),
      rem2570.toString(),
      oldDebt.toString(),
      oldDebt > 0 ? statusTextOld : '-',
      oldPaid.toString(),
      pen.toString(),
      sur.toString(),
      oldRem.toString(),
      actualCollected.toString(),
      totalRemaining.toString(),
      t.notes || '',
    ]);
  });

  rows.push([
    'รวม',
    `รวมทั้งหมด ${filtered.length} ราย`,
    '',
    sumAssessed.toString(),
    sumRelief.toString(),
    sumAfterRelief.toString(),
    '',
    sumPaid2570.toString(),
    sumRem2570.toString(),
    sumOldDebt.toString(),
    '',
    sumOldPaid.toString(),
    sumPenalties.toString(),
    sumSurcharges.toString(),
    sumOldRem.toString(),
    sumTotalCollected.toString(),
    sumTotalRemaining.toString(),
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'รายชื่อผู้เสียภาษีและลูกหนี้');
  XLSX.writeFile(wb, `รายชื่อผู้เสียภาษีและลูกหนี้ภาษีเก่า_${typeLabel}.xlsx`);
};

/**
 * Export Old Tax Debtors to Excel
 */
export const exportOldTaxDebtorsToExcel = (
  debtors: OldTaxDebtorRecord[],
  taxType: 'land' | 'sign'
) => {
  const filtered = debtors.filter((d) => d.taxType === taxType);
  const typeLabel = taxType === 'land' ? 'ภาษีที่ดินและสิ่งปลูกสร้าง' : 'ภาษีป้าย';
  const wb = XLSX.utils.book_new();

  const headers = [
    'ลำดับ',
    'ชื่อลูกหนี้ภาษีเก่า / ผู้มีหน้าที่เสียภาษี',
    'ยอดหนี้รวมทุกปี (2563-2569) (บาท)',
    'รับชำระลูกหนี้เก่ารวม (บาท)',
    'ผลต่างค้างชำระคงเหลือ (บาท)',
    'เบี้ยปรับรวม (บาท)',
    'เงินเพิ่มรวม (บาท)',
  ];
  OLD_TAX_YEARS.forEach((yr) => {
    headers.push(`ปี ${yr} - ยอดหนี้`);
    headers.push(`ปี ${yr} - สถานะ`);
    headers.push(`ปี ${yr} - ยอดชำระ`);
    headers.push(`ปี ${yr} - เบี้ยปรับ`);
    headers.push(`ปี ${yr} - เงินเพิ่ม`);
  });
  headers.push('หมายเหตุ');

  const rows: string[][] = [
    [`รายงานทะเบียนคุมลูกหนี้ภาษีเก่า (${typeLabel}) เทศบาลเมืองมหาสารคาม`],
    ['ประจำปีงบประมาณ พ.ศ. 2570 (ข้อมูลค้างชำระปี 2563 - 2569)'],
    ['วันที่ส่งออกข้อมูล:', new Date().toLocaleDateString('th-TH')],
    [],
    headers,
  ];

  let sumTotalDebt = 0;
  let sumTotalPaid = 0;
  let sumTotalRemaining = 0;
  let sumTotalPenalties = 0;
  let sumTotalSurcharges = 0;

  filtered.forEach((d, idx) => {
    let debtorTotalDebt = 0;
    let debtorTotalPaid = 0;
    let debtorPenalties = 0;
    let debtorSurcharges = 0;

    const yearCols: string[] = [];

    OLD_TAX_YEARS.forEach((yr) => {
      const yData = d.years?.[yr];
      const debt = Number(yData?.debtAmount) || 0;
      const st = yData?.status || 'unpaid';
      const paid = Number(yData?.paidAmount) || 0;
      const pen = Number(yData?.penaltyAmount) || 0;
      const sur = Number(yData?.surchargeAmount) || 0;

      debtorTotalDebt += debt;
      if (st === 'paid' || st === 'partial') {
        debtorTotalPaid += paid;
      }
      debtorPenalties += pen;
      debtorSurcharges += sur;

      const stLabel = st === 'paid' ? 'ชำระแล้ว' : st === 'partial' ? 'ชำระบางส่วน' : 'ยังไม่ชำระ';
      yearCols.push(debt.toString(), stLabel, paid.toString(), pen.toString(), sur.toString());
    });

    const debtorRemaining = Math.max(0, debtorTotalDebt - debtorTotalPaid);
    sumTotalDebt += debtorTotalDebt;
    sumTotalPaid += debtorTotalPaid;
    sumTotalRemaining += debtorRemaining;
    sumTotalPenalties += debtorPenalties;
    sumTotalSurcharges += debtorSurcharges;

    rows.push([
      (idx + 1).toString(),
      d.name,
      debtorTotalDebt.toString(),
      debtorTotalPaid.toString(),
      debtorRemaining.toString(),
      debtorPenalties.toString(),
      debtorSurcharges.toString(),
      ...yearCols,
      d.notes || '',
    ]);
  });

  // Summary row
  rows.push([
    'รวมทั้งสิ้น',
    `รวม ${filtered.length} ราย`,
    sumTotalDebt.toString(),
    sumTotalPaid.toString(),
    sumTotalRemaining.toString(),
    sumTotalPenalties.toString(),
    sumTotalSurcharges.toString(),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'ลูกหนี้ภาษีเก่า');
  XLSX.writeFile(wb, `รายงานลูกหนี้ภาษีเก่า_${typeLabel}_2563-2569.xlsx`);
};

/**
 * Generate Excel Template for importing Taxpayers and Old Debtors (Land and Building Tax)
 */
export const downloadLandTaxpayersTemplate = () => {
  const wb = XLSX.utils.book_new();
  const templateRows = [
    [
      'ชื่อผู้เสียภาษี (บอกชื่อ)*',
      'ประเภทภาษี',
      'ยอดประเมิน 2570 (บาท)*',
      'ยอดบรรเทา (บาท)',
      'สถานะ 2570 (0=ยังไม่ชำระ, 1=ชำระแล้ว, 2=ผ่อนงวด 2, 3=ผ่อนงวด 3)*',
      'จำนวนเงิน ครั้งที่ 1 (บาท)',
      'จำนวนเงิน ครั้งที่ 2 (บาท)',
      'จำนวนเงิน ครั้งที่ 3 (บาท)',
      'ยอดลูกหนี้ภาษีเก่ารวม (บาท)',
      'สถานะหนี้เก่า (0=ยังไม่ชำระ, 1=ชำระแล้ว, 2=ชำระบางส่วน)',
      'รับชำระหนี้เก่า (บาท)',
      'เบี้ยปรับ (บาท)',
      'เงินเพิ่ม (บาท)',
      'หมายเหตุ',
    ],
    [
      'นายสมหมาย ใจสู้ (บ้านและที่ดิน)',
      'ที่ดิน',
      '15000',
      '3000',
      '1',
      '12000',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      'ชำระเต็มยอดหลังบรรเทา ไม่มีหนี้เก่า',
    ],
    [
      'นางสมทรง ชัยมงคล (ที่ดินเพื่อการเกษตร)',
      'ที่ดิน',
      '8000',
      '1000',
      '0',
      '0',
      '0',
      '0',
      '12500',
      '2',
      '5000',
      '500',
      '250',
      'มีหนี้เก่าค้างชำระ ชำระหนี้เก่าบางส่วน',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(templateRows);
  XLSX.utils.book_append_sheet(wb, ws, 'ผู้เสียภาษีและลูกหนี้ที่ดิน');
  XLSX.writeFile(wb, 'Template_รายชื่อผู้เสียภาษีและลูกหนี้ภาษีเก่า_ภาษีที่ดินและสิ่งปลูกสร้าง.xlsx');
};

/**
 * Generate Excel Template for importing Taxpayers and Old Debtors (Sign Tax)
 */
export const downloadSignTaxpayersTemplate = () => {
  const wb = XLSX.utils.book_new();
  const templateRows = [
    [
      'ชื่อผู้เสียภาษี (บอกชื่อ)*',
      'ประเภทภาษี',
      'ยอดประเมิน 2570 (บาท)*',
      'ยอดบรรเทา (บาท)',
      'สถานะ 2570 (0=ยังไม่ชำระ, 1=ชำระแล้ว, 2=ผ่อนงวด 2, 3=ผ่อนงวด 3)*',
      'จำนวนเงิน ครั้งที่ 1 (บาท)',
      'จำนวนเงิน ครั้งที่ 2 (บาท)',
      'จำนวนเงิน ครั้งที่ 3 (บาท)',
      'ยอดลูกหนี้ภาษีเก่ารวม (บาท)',
      'สถานะหนี้เก่า (0=ยังไม่ชำระ, 1=ชำระแล้ว, 2=ชำระบางส่วน)',
      'รับชำระหนี้เก่า (บาท)',
      'เบี้ยปรับ (บาท)',
      'เงินเพิ่ม (บาท)',
      'หมายเหตุ',
    ],
    [
      'หจก. มหาสารคามพาณิชย์',
      'ป้าย',
      '6000',
      '1000',
      '2',
      '2500',
      '2500',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      'ผ่อนชำระ 2 งวด',
    ],
    [
      'ร้านสารคามการค้า (ป้ายโฆษณา)',
      'ป้าย',
      '4500',
      '0',
      '1',
      '4500',
      '0',
      '0',
      '3000',
      '1',
      '3000',
      '300',
      '150',
      'ชำระครบทั้งปี 2570 และหนี้เก่า',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(templateRows);
  XLSX.utils.book_append_sheet(wb, ws, 'ผู้เสียภาษีและลูกหนี้ป้าย');
  XLSX.writeFile(wb, 'Template_รายชื่อผู้เสียภาษีและลูกหนี้ภาษีเก่า_ภาษีป้าย.xlsx');
};

/**
 * Generate Excel Template for importing Taxpayers (Land and Sign tax)
 */
export const downloadTaxpayersTemplate = () => {
  const wb = XLSX.utils.book_new();
  const templateRows = [
    [
      'ชื่อผู้เสียภาษี (บอกชื่อ)*',
      'ประเภทภาษี (ที่ดิน/ป้าย)*',
      'ยอดประเมิน (บาท)*',
      'ยอดบรรเทา (บาท)',
      'สถานะ (0=ยังไม่ชำระ, 1=ชำระแล้ว, 2=ชำระงวดที่ 2, 3=ชำระงวดที่ 3)*',
      'จำนวนเงิน ครั้งที่ 1 (บาท)',
      'จำนวนเงิน ครั้งที่ 2 (บาท)',
      'จำนวนเงิน ครั้งที่ 3 (บาท)',
      'หมายเหตุ',
    ],
    ['นายสมหมาย ใจสู้ (บ้านและที่ดิน)', 'ที่ดิน', '15000', '3000', '1', '12000', '0', '0', 'ชำระเต็มยอดหลังบรรเทา'],
    ['หจก. มหาสารคามพาณิชย์', 'ป้าย', '6000', '1000', '2', '2500', '2500', '0', 'ผ่อนชำระ 2 งวด'],
    ['นางสมทรง ชัยมงคล', 'ที่ดิน', '8000', '1000', '0', '0', '0', '0', 'ยังไม่ชำระ ออกหนังสือเตือน'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(templateRows);
  XLSX.utils.book_append_sheet(wb, ws, 'แบบฟอร์มผู้เสียภาษี');
  XLSX.writeFile(wb, 'Template_นำเข้ารายชื่อผู้เสียภาษีที่ดินและภาษีป้าย_เทศบาลเมืองมหาสารคาม.xlsx');
};

/**
 * Generate Excel Template for importing Market Contracts
 */
export const downloadMarketContractsTemplate = () => {
  const wb = XLSX.utils.book_new();
  const templateRows = [
    [
      'ประเภทตลาด (ตลาดโต้รุ่ง/ตลาดสด)*',
      'รายการทรัพย์สิน (ชื่อล็อค/แผงค้า)*',
      'เลขที่สัญญา*',
      'ผู้เช่า / ผู้ทำสัญญา',
      'วันที่เริ่มสัญญา (YYYY-MM-DD)*',
      'กำหนดระยะเวลาการเช่า (เช่น 1 ปี, 6 เดือน)*',
      'วันที่สิ้นสุดสัญญา (YYYY-MM-DD หรือปล่อยว่างให้คำนวณอัตโนมัติ)',
      'ค่าธรรมเนียมการทำธุรกรรม (บาท)',
      'จำนวนค่าเช่า/เดือน (บาท)*',
      'เงินประกันสัญญาเช่า (บาท)',
    ],
    ['ตลาดโต้รุ่ง', 'ล็อคอาหารตามสั่ง A-10', 'ตน.ร. 70/010', 'ร้านป้าแดง สารคาม', '2569-10-01', '1 ปี', '2570-09-30', '500', '2500', '5000'],
    ['ตลาดสด', 'แผงจำหน่ายผักสด F-01', 'ตสด. 70/020', 'สวนผักแม่คำ', '2569-10-01', '1 ปี', '2570-09-30', '400', '2200', '4400'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(templateRows);
  XLSX.utils.book_append_sheet(wb, ws, 'แบบฟอร์มสัญญาเช่าตลาด');
  XLSX.writeFile(wb, 'Template_นำเข้าสัญญาเช่าตลาดโต้รุ่งและตลาดสด_เทศบาลเมืองมหาสารคาม.xlsx');
};

/**
 * Generate Excel Template for importing daily revenue records
 */
export const downloadDailyRecordsTemplate = () => {
  const wb = XLSX.utils.book_new();
  const templateRows = [
    ['วันที่ (YYYY-MM-DD)', 'หมวดรายได้', 'รายการรายได้', 'จำนวนเงิน (บาท)', 'เล่มที่ใบเสร็จ', 'เลขที่ใบเสร็จ', 'ผู้ชำระเงิน', 'หมายเหตุ'],
    ['2026-10-23', 'หมวดภาษีอากร', 'ภาษีที่ดินและสิ่งปลูกสร้าง', '50000', '025/70', '00125', 'นายสมชาย ใจดี', 'ชำระภาษีงวดที่ 1'],
    ['2026-10-23', 'หมวดภาษีอากร', 'ภาษีป้าย', '4500', '012/70', '00059', 'ห้างหุ้นส่วนจำกัด มหาสารคามโอสถ', 'ป้ายหน้าร้าน'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(templateRows);
  XLSX.utils.book_append_sheet(wb, ws, 'แบบฟอร์มนำเข้า');
  XLSX.writeFile(wb, 'Template_นำเข้าบันทึกรายรับประจำวัน_เทศบาลเมืองมหาสารคาม.xlsx');
};

/**
 * Generate Excel Template for updating estimates & actuals across categories
 */
export const downloadBudgetTemplate = (categories: RevenueCategory[]) => {
  const wb = XLSX.utils.book_new();
  const rows = [
    ['รหัสรายการ (ห้ามแก้ไข)', 'หมวดรายได้', 'ชื่อรายการรายได้', 'ประมาณการ (บาท)', 'รับจริง (บาท)'],
  ];

  categories.forEach((cat) => {
    cat.items.forEach((item) => {
      rows.push([
        item.id,
        cat.title,
        item.name,
        item.estimate.toString(),
        item.actual.toString(),
      ]);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'แบบฟอร์มงบประมาณ');
  XLSX.writeFile(wb, 'Template_ประมาณการและรับจริง_เทศบาลเมืองมหาสารคาม.xlsx');
};

/**
 * Helper to calculate contract end date from start date and duration
 */
export function calculateContractEndDateHelper(startDateStr: string, durationStr: string): string {
  if (!startDateStr) return '';
  let year = 0;
  let month = 0;
  let day = 0;
  let isBE = false;

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

  if (yearMatch) addYears += parseInt(yearMatch[1], 10);
  if (monthMatch) addMonths += parseInt(monthMatch[1], 10);
  if (!yearMatch && !monthMatch) {
    const num = parseInt(durationStr, 10);
    addYears = !isNaN(num) && num > 0 ? num : 1;
  }

  const targetDate = new Date(year, month - 1 + addMonths + addYears * 12, day);
  targetDate.setDate(targetDate.getDate() - 1);

  let endYear = targetDate.getFullYear();
  if (isBE) endYear += 543;

  const endMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
  const endDay = String(targetDate.getDate()).padStart(2, '0');

  return `${endYear}-${endMonth}-${endDay}`;
}

export type ImportTargetCategory =
  | 'auto'
  | 'land_taxpayers'
  | 'sign_taxpayers'
  | 'daily'
  | 'budget';

/**
 * Helper to parse taxpayer records from worksheet JSON rows
 */
function parseTaxpayersRows(json: any[][], forcedTaxType?: 'land' | 'sign'): TaxpayerRecord[] {
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(json.length, 5); i++) {
    const row = json[i];
    if (row && Array.isArray(row)) {
      const rowStr = row.map((c) => String(c || '').trim()).join(' ');
      if (
        rowStr.includes('ยอดประเมิน') ||
        rowStr.includes('ผู้เสียภาษี') ||
        rowStr.includes('ครั้งที่ 1') ||
        rowStr.includes('ลูกหนี้ภาษีเก่า')
      ) {
        headerRowIndex = i;
        break;
      }
    }
  }

  const headerRow = json[headerRowIndex] || [];
  const taxpayers: TaxpayerRecord[] = [];
  const hasIndexCol = headerRow[0] && String(headerRow[0]).trim() === 'ลำดับ';
  const offset = hasIndexCol ? 1 : 0;

  for (let i = headerRowIndex + 1; i < json.length; i++) {
    const row = json[i];
    if (!row || row.length < 2) continue;

    const nameVal = row[offset] ? String(row[offset]).trim() : '';
    if (!nameVal || nameVal === 'รวม' || nameVal.includes('รวมทั้งสิ้น') || nameVal.includes('รวมทั้งหมด')) continue;

    let taxType: 'land' | 'sign' = forcedTaxType || 'land';
    if (!forcedTaxType) {
      const taxTypeRaw = row[offset + 1] ? String(row[offset + 1]).trim().toLowerCase() : '';
      taxType = taxTypeRaw.includes('ป้าย') ? 'sign' : 'land';
    }

    const assessed = parseFloat(String(row[offset + 2] || '0').replace(/,/g, '')) || 0;
    const relief = parseFloat(String(row[offset + 3] || '0').replace(/,/g, '')) || 0;
    const afterRelief = Math.max(0, assessed - relief);

    const statusCell = String(row[offset + 4] || '0');
    let status: 0 | 1 | 2 | 3 = 0;
    if (statusCell.includes('1') || statusCell.includes('ชำระแล้ว')) status = 1;
    else if (statusCell.includes('2') || statusCell.includes('งวด 2') || statusCell.includes('งวดที่ 2')) status = 2;
    else if (statusCell.includes('3') || statusCell.includes('งวด 3') || statusCell.includes('งวดที่ 3')) status = 3;

    const p1 = parseFloat(String(row[offset + 5] || '0').replace(/,/g, '')) || 0;
    const p2 = parseFloat(String(row[offset + 6] || '0').replace(/,/g, '')) || 0;
    const p3 = parseFloat(String(row[offset + 7] || '0').replace(/,/g, '')) || 0;
    const totalPaid = p1 + p2 + p3;
    const rem = Math.max(0, afterRelief - totalPaid);

    // Old debts parsing if present
    let oldDebt = 0;
    let oldDebtStatus: 0 | 1 | 2 = 0;
    let oldDebtPaid = 0;
    let penalty = 0;
    let surcharge = 0;
    let note = '';

    if (hasIndexCol && row.length >= 15) {
      // From exportTaxpayersToExcel
      oldDebt = parseFloat(String(row[offset + 8] || '0').replace(/,/g, '')) || 0;
      const oldStCell = String(row[offset + 9] || '');
      if (oldStCell.includes('1') || oldStCell.includes('ชำระแล้ว')) oldDebtStatus = 1;
      else if (oldStCell.includes('2') || oldStCell.includes('บางส่วน')) oldDebtStatus = 2;
      oldDebtPaid = parseFloat(String(row[offset + 10] || '0').replace(/,/g, '')) || 0;
      penalty = parseFloat(String(row[offset + 11] || '0').replace(/,/g, '')) || 0;
      surcharge = parseFloat(String(row[offset + 12] || '0').replace(/,/g, '')) || 0;
      note = row[offset + 16] ? String(row[offset + 16]).trim() : (row[row.length - 1] ? String(row[row.length - 1]).trim() : '');
    } else if (row.length >= 13) {
      // From downloadLandTaxpayersTemplate / downloadSignTaxpayersTemplate
      oldDebt = parseFloat(String(row[8] || '0').replace(/,/g, '')) || 0;
      const oldStCell = String(row[9] || '');
      if (oldStCell.includes('1') || oldStCell.includes('ชำระแล้ว')) oldDebtStatus = 1;
      else if (oldStCell.includes('2') || oldStCell.includes('บางส่วน')) oldDebtStatus = 2;
      oldDebtPaid = parseFloat(String(row[10] || '0').replace(/,/g, '')) || 0;
      penalty = parseFloat(String(row[11] || '0').replace(/,/g, '')) || 0;
      surcharge = parseFloat(String(row[12] || '0').replace(/,/g, '')) || 0;
      note = row[13] ? String(row[13]).trim() : '';
    } else {
      note = row[8] ? String(row[8]).trim() : '';
    }

    const oldDebtRem = Math.max(0, oldDebt - oldDebtPaid);

    taxpayers.push({
      id: `tp-imp-${Date.now()}-${taxType}-${i}`,
      name: nameVal,
      taxType,
      assessedAmount: assessed,
      reliefAmount: relief,
      afterReliefAmount: afterRelief,
      status,
      payment1: p1,
      payment2: p2,
      payment3: p3,
      remainingBalance: rem,
      isFullyPaid: rem <= 0 && afterRelief > 0 && oldDebtRem <= 0,
      hasOldDebt: oldDebt > 0,
      oldDebtAmount: oldDebt,
      oldDebtStatus,
      oldDebtPaid,
      oldDebtRemaining: oldDebtRem,
      penaltyAmount: penalty,
      surchargeAmount: surcharge,
      notes: note,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  }

  return taxpayers;
}

/**
 * Helper to parse daily revenue records from worksheet JSON rows
 */
function parseDailyRecordsRows(json: any[][]): Partial<DailyRecord>[] {
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(json.length, 5); i++) {
    const row = json[i];
    if (row && Array.isArray(row)) {
      const rowStr = row.map((c) => String(c || '').trim()).join(' ');
      if (rowStr.includes('วันที่') || rowStr.includes('ใบเสร็จ') || rowStr.includes('ผู้ชำระ')) {
        headerRowIndex = i;
        break;
      }
    }
  }

  const dailyRecords: Partial<DailyRecord>[] = [];
  for (let i = headerRowIndex + 1; i < json.length; i++) {
    const row = json[i];
    if (!row || row.length < 3) continue;

    const dateVal = row[0] ? String(row[0]).trim() : '';
    const catName = row[1] ? String(row[1]).trim() : '';
    const itemName = row[2] ? String(row[2]).trim() : '';
    const amountVal = parseFloat(String(row[3]).replace(/,/g, '')) || 0;
    const receiptBook = row[4] ? String(row[4]).trim() : '';
    const receiptNo = row[5] ? String(row[5]).trim() : '';
    const payer = row[6] ? String(row[6]).trim() : '';
    const note = row[7] ? String(row[7]).trim() : '';

    if (itemName && amountVal > 0) {
      dailyRecords.push({
        date: dateVal || new Date().toISOString().slice(0, 10),
        categoryName: catName || 'หมวดรายได้',
        itemName: itemName,
        amount: amountVal,
        receiptBookNo: receiptBook,
        receiptNo: receiptNo,
        payerName: payer || 'ผู้ชำระทั่วไป',
        note: note,
      });
    }
  }
  return dailyRecords;
}

/**
 * Helper to parse budget estimates and actuals from worksheet JSON rows
 */
function parseBudgetRows(json: any[][]): { id?: string; name?: string; estimate?: number; actual?: number }[] {
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(json.length, 5); i++) {
    const row = json[i];
    if (row && Array.isArray(row)) {
      const rowStr = row.map((c) => String(c || '').trim()).join(' ');
      if (rowStr.includes('ประมาณการ') || rowStr.includes('รับจริง') || rowStr.includes('รหัสรายการ')) {
        headerRowIndex = i;
        break;
      }
    }
  }

  const budgetUpdates: { id?: string; name?: string; estimate?: number; actual?: number }[] = [];
  for (let i = headerRowIndex + 1; i < json.length; i++) {
    const row = json[i];
    if (!row || row.length < 2) continue;

    const idVal = row[0] ? String(row[0]).trim() : undefined;
    const nameVal = row[2] ? String(row[2]).trim() : (row[1] ? String(row[1]).trim() : undefined);
    const estVal = parseFloat(String(row[3] ?? row[2] ?? '0').replace(/,/g, '')) || 0;
    const actVal = parseFloat(String(row[4] ?? row[3] ?? '0').replace(/,/g, '')) || 0;

    if (idVal || nameVal) {
      budgetUpdates.push({
        id: idVal,
        name: nameVal,
        estimate: isNaN(estVal) ? 0 : estVal,
        actual: isNaN(actVal) ? 0 : actVal,
      });
    }
  }
  return budgetUpdates;
}

/**
 * Parse uploaded Excel or CSV file with category targeting and multi-sheet support
 */
export const parseUploadedExcel = async (
  file: File,
  targetCategory: ImportTargetCategory = 'auto'
): Promise<{
  type: 'taxpayers' | 'contracts' | 'daily' | 'budget' | 'unknown';
  targetSubtype?: 'land' | 'sign' | 'both';
  taxpayers?: TaxpayerRecord[];
  marketContracts?: MarketContract[];
  dailyRecords?: Partial<DailyRecord>[];
  budgetUpdates?: { id?: string; name?: string; estimate?: number; actual?: number }[];
  rawRows: any[];
}> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('ไฟล์ว่างเปล่า ไม่มีข้อมูลชีต');
  }

  // 1. SPECIFIC TARGET: Land Taxpayers
  if (targetCategory === 'land_taxpayers') {
    const matchedSheet =
      workbook.SheetNames.find((s) => s.includes('ที่ดิน') || s.toLowerCase().includes('land')) ||
      workbook.SheetNames[0];
    const ws = workbook.Sheets[matchedSheet];
    const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const taxpayers = parseTaxpayersRows(json, 'land');
    if (taxpayers.length > 0) {
      return {
        type: 'taxpayers',
        targetSubtype: 'land',
        taxpayers,
        rawRows: json,
      };
    }
  }

  // 2. SPECIFIC TARGET: Sign Taxpayers
  if (targetCategory === 'sign_taxpayers') {
    const matchedSheet =
      workbook.SheetNames.find((s) => s.includes('ป้าย') || s.toLowerCase().includes('sign')) ||
      workbook.SheetNames[0];
    const ws = workbook.Sheets[matchedSheet];
    const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const taxpayers = parseTaxpayersRows(json, 'sign');
    if (taxpayers.length > 0) {
      return {
        type: 'taxpayers',
        targetSubtype: 'sign',
        taxpayers,
        rawRows: json,
      };
    }
  }

  // 3. SPECIFIC TARGET: Daily Records
  if (targetCategory === 'daily') {
    const matchedSheet =
      workbook.SheetNames.find((s) => s.includes('รายรับ') || s.toLowerCase().includes('daily')) ||
      workbook.SheetNames[0];
    const ws = workbook.Sheets[matchedSheet];
    const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const dailyRecords = parseDailyRecordsRows(json);
    if (dailyRecords.length > 0) {
      return {
        type: 'daily',
        dailyRecords,
        rawRows: json,
      };
    }
  }

  // 4. SPECIFIC TARGET: Budget Estimates & Actuals
  if (targetCategory === 'budget') {
    const matchedSheet =
      workbook.SheetNames.find((s) => s.includes('งบประมาณ') || s.includes('หมวด') || s.toLowerCase().includes('budget')) ||
      workbook.SheetNames[0];
    const ws = workbook.Sheets[matchedSheet];
    const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const budgetUpdates = parseBudgetRows(json);
    if (budgetUpdates.length > 0) {
      return {
        type: 'budget',
        budgetUpdates,
        rawRows: json,
      };
    }
  }

  // 5. AUTO DETECT: Multi-sheet check (e.g. Workbook with both Land and Sign sheets)
  const landSheetName = workbook.SheetNames.find((s) => s.includes('ที่ดิน') || s.toLowerCase().includes('land'));
  const signSheetName = workbook.SheetNames.find((s) => s.includes('ป้าย') || s.toLowerCase().includes('sign'));

  if (landSheetName && signSheetName) {
    const wsLand = workbook.Sheets[landSheetName];
    const jsonLand: any[][] = XLSX.utils.sheet_to_json(wsLand, { header: 1 });
    const landTaxpayers = parseTaxpayersRows(jsonLand, 'land');

    const wsSign = workbook.Sheets[signSheetName];
    const jsonSign: any[][] = XLSX.utils.sheet_to_json(wsSign, { header: 1 });
    const signTaxpayers = parseTaxpayersRows(jsonSign, 'sign');

    const combined = [...landTaxpayers, ...signTaxpayers];
    if (combined.length > 0) {
      return {
        type: 'taxpayers',
        targetSubtype: 'both',
        taxpayers: combined,
        rawRows: jsonLand,
      };
    }
  }

  // 6. AUTO DETECT: Fallback to inspecting the first sheet
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (json.length === 0) {
    throw new Error('ไฟล์ว่างเปล่า ไม่มีข้อมูล');
  }

  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(json.length, 5); i++) {
    const row = json[i];
    if (row && Array.isArray(row)) {
      const rowStr = row.map((c) => String(c || '').trim()).join(' ');
      if (
        rowStr.includes('ยอดประเมิน') ||
        rowStr.includes('ผู้เสียภาษี') ||
        rowStr.includes('เลขที่สัญญา') ||
        rowStr.includes('รายการทรัพย์สิน') ||
        rowStr.includes('วันที่') ||
        rowStr.includes('ใบเสร็จ') ||
        rowStr.includes('รหัสรายการ') ||
        rowStr.includes('ประมาณการ')
      ) {
        headerRowIndex = i;
        break;
      }
    }
  }

  const headerRow = json[headerRowIndex] || [];
  const headerStr = headerRow.map((c) => String(c || '').trim()).join(' ');

  // Case A: Taxpayers
  if (
    headerStr.includes('ยอดประเมิน') ||
    (headerStr.includes('ผู้เสียภาษี') && headerStr.includes('ยอดบรรเทา')) ||
    headerStr.includes('ครั้งที่ 1') ||
    headerStr.includes('ลูกหนี้ภาษีเก่า')
  ) {
    const isSignSheet = firstSheetName.includes('ป้าย') || firstSheetName.toLowerCase().includes('sign');
    const isLandSheet = firstSheetName.includes('ที่ดิน') || firstSheetName.toLowerCase().includes('land');
    const forced = isSignSheet ? 'sign' : (isLandSheet ? 'land' : undefined);
    const taxpayers = parseTaxpayersRows(json, forced);
    return {
      type: 'taxpayers',
      targetSubtype: isSignSheet ? 'sign' : (isLandSheet ? 'land' : 'both'),
      taxpayers,
      rawRows: json,
    };
  }

  // Case B: Daily records
  if (headerStr.includes('วันที่') || headerStr.includes('ใบเสร็จ') || headerStr.includes('ผู้ชำระ')) {
    const dailyRecords = parseDailyRecordsRows(json);
    return {
      type: 'daily',
      dailyRecords,
      rawRows: json,
    };
  }

  // Case C: Budget
  if (headerStr.includes('ประมาณการ') || headerStr.includes('รับจริง') || headerStr.includes('รหัสรายการ')) {
    const budgetUpdates = parseBudgetRows(json);
    return {
      type: 'budget',
      budgetUpdates,
      rawRows: json,
    };
  }

  return {
    type: 'unknown',
    rawRows: json,
  };
};
