export type UserRole = 'User' | 'Director' | 'Executive';

export interface UserSession {
  username: string;
  role: UserRole;
  roleTitle: string;
  department: string;
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canAddDaily: boolean;
    canImportExport: boolean;
    canReview: boolean;
    canApprove: boolean;
  };
}

export interface RevenueItem {
  id: string;
  categoryKey: string;
  name: string;
  estimate: number; // ประมาณการ
  actual: number;   // รับจริง
  balance?: number; // คำนวณคงเหลือ (estimate - actual)
  percentage?: number; // %
}

export interface RevenueCategory {
  key: string;
  title: string;
  shortTitle: string;
  description?: string;
  items: RevenueItem[];
}

export interface DetailedTaxMetric {
  count: number;  // ราย
  amount: number; // บาท
}

export interface DetailedTaxData {
  estimateCount?: number;             // ประมาณการ จำนวนราย
  estimateAmount: number;             // ประมาณการ จำนวนเงิน
  collected: DetailedTaxMetric;       // จัดเก็บได้ / รับจริง (จำนวนราย และ จำนวนเงิน)
  taxpayers: DetailedTaxMetric;       // ผู้มีหน้าที่เสียภาษี (จำนวนราย และ จำนวนเงิน)
  debtors: DetailedTaxMetric;         // ตั้งลูกหนี้ (จำนวนราย และ จำนวนเงิน)
  pendingVerification: DetailedTaxMetric; // อยู่ระหว่างตรวจสอบข้อมูล (จำนวนราย และ จำนวนเงิน)
  updatedAt?: string;
}

export type TaxPaymentStatus = 0 | 1 | 2 | 3;

export interface TaxpayerRecord {
  id: string;
  name: string;                   // ชื่อผู้เสียภาษี (อ้างอิงชื่อเดียวกัน)
  taxType: 'land' | 'sign';       // ภาษีที่ดินและสิ่งปลูกสร้าง หรือ ภาษีป้าย

  // 1. ข้อมูลภาษีประจำปี 2570
  assessedAmount: number;         // ยอดประเมิน (ปี 2570)
  reliefAmount: number;           // ยอดบรรเทา
  afterReliefAmount: number;      // ยอดหลังบรรเทา (คำนวณจาก ยอดประเมิน ลบ ยอดบรรเทา)
  status: TaxPaymentStatus;       // 0=ยังไม่ชำระ (ตั้งลูกหนี้), 1=ชำระแล้ว, 2=ชำระงวดที่ 2, 3=ชำระงวดที่ 3
  payment1: number;               // จำนวนเงิน ครั้งที่ 1
  payment2: number;               // จำนวนเงิน ครั้งที่ 2
  payment3: number;               // จำนวนเงิน ครั้งที่ 3
  remainingBalance: number;       // ยอดเงินคงเหลือปี 2570 (ยอดหลังบรรเทา - ครั้งที่ 1 - 2 - 3)
  isFullyPaid: boolean;           // ชำระครบตามยอดหลังบรรเทาปี 2570
  isPendingVerification?: boolean;// อยู่ระหว่างตรวจสอบข้อมูล

  // 2. ข้อมูลลูกหนี้ภาษีเก่า (รวมอยู่ในชื่อเดียวกัน)
  hasOldDebt?: boolean;           // มีหนี้ภาษีเก่าหรือไม่
  oldDebtAmount?: number;         // ยอดลูกหนี้ภาษีเก่า (บาท)
  oldDebtStatus?: TaxPaymentStatus; // 0=ยังไม่ชำระ, 1=ชำระแล้ว, 2=ชำระบางส่วน
  oldDebtPaid?: number;           // ยอดรับชำระลูกหนี้เก่า (บาท)
  oldDebtRemaining?: number;      // ยอดลูกหนี้เก่าคงเหลือ (ยอดลูกหนี้ภาษีเก่า - ยอดรับชำระลูกหนี้เก่า)
  penaltyAmount?: number;         // เบี้ยปรับ (บาท) นำไปบวกเพิ่มในช่อง "รับจริง"
  surchargeAmount?: number;       // เงินเพิ่ม (บาท) นำไปบวกเพิ่มในช่อง "รับจริง"

  // Backward compatibility
  isOldDebtor?: boolean;

  notes?: string;
  updatedAt?: string;
}

export interface MarketContract {
  id: string;
  marketType: 'night_market' | 'fresh_market'; // ตลาดโต้รุ่ง หรือ ตลาดสด
  propertyName: string;       // รายการทรัพย์สิน (ชื่อล็อค/แผงค้า)
  contractNumber: string;     // เลขที่สัญญา
  startDate: string;          // วันที่เริ่มสัญญา
  leaseDuration?: string;     // กำหนดระยะเวลาการเช่า (เช่น 1 ปี, 6 เดือน, 2 ปี)
  endDate: string;            // วันที่สิ้นสุดสัญญา (คำนวณจาก วันที่เริ่มสัญญา กับ กำหนดระยะเวลาการเช่า)
  transactionFee: number;     // ค่าธรรมเนียมการทำธุรกรรม
  monthlyRent: number;        // จำนวนค่าเช่า/เดือน
  securityDeposit: number;    // เงินประกันสัญญาเช่า
  lesseeName?: string;        // ผู้เช่า/ผู้ทำสัญญา
  status?: 'active' | 'expired' | 'pending';
}

export interface MarketSummary {
  name: string;
  totalStalls: number; // จำนวนกี่ล็อค
  occupiedStalls: number;
}

export interface DailyRecord {
  id: string;
  date: string;               // YYYY-MM-DD
  categoryId: string;         // หมวดรายได้
  categoryName: string;
  itemId: string;             // รายการย่อย
  itemName: string;
  amount: number;             // จำนวนเงิน
  receiptBookNo: string;      // เล่มที่
  receiptNo: string;          // เลขที่ใบเสร็จ
  payerName: string;          // ผู้ชำระเงิน
  note?: string;              // หมายเหตุ
  recordedAt: string;
}

export interface MemorandumMeta {
  docNumber: string;       // ที่ มค ๕๒๐๐๔/
  docDate: string;         // วันที่
  fiscalYear: string;      // ๒๕๗๐
  reporterTitle: string;   // เจ้าหน้าที่ฝ่ายพัฒนารายได้
  inspectorTitle: string;  // ผู้อำนวยการกองคลัง
  approverTitle: string;   // นายกเทศมนตรีเมืองมหาสารคาม
  reviewComment?: string;  // บันทึกความเห็นผู้อำนวยการกองคลัง
  approvalComment?: string;// บันทึกคำสั่งนายกเทศมนตรี
}

// ข้อมูลลูกหนี้ภาษีเก่า (ปี 2563 - 2569)
export const OLD_TAX_YEARS = [2563, 2564, 2565, 2566, 2567, 2568, 2569] as const;
export type OldTaxYear = (typeof OLD_TAX_YEARS)[number];

export type OldDebtPaymentStatus = 'unpaid' | 'partial' | 'paid'; // ยังไม่ชำระ | ชำระบางส่วน | ชำระแล้ว

export interface OldDebtYearRecord {
  debtAmount: number;            // ยอดลูกหนี้ภาษีเก่า (บาท)
  status: OldDebtPaymentStatus;  // สถานะ: 'paid'=ชำระแล้ว, 'partial'=ชำระบางส่วน, 'unpaid'=ยังไม่ชำระ
  paidAmount: number;            // ยอดชำระ (บาท)
  penaltyAmount: number;         // เบี้ยปรับ (บาท)
  surchargeAmount: number;       // เงินเพิ่ม (บาท)
}

export interface OldTaxDebtorRecord {
  id: string;
  name: string;                  // ชื่อลูกหนี้ภาษีเก่า / ผู้มีหน้าที่เสียภาษี
  taxType: 'land' | 'sign';      // ภาษีที่ดินและสิ่งปลูกสร้าง หรือ ภาษีป้าย
  years: Record<number, OldDebtYearRecord>; // ข้อมูลรายปี 2563 - 2569
  notes?: string;
  updatedAt?: string;
}

