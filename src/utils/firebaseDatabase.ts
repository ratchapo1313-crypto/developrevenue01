import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  collection,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  RevenueCategory,
  DetailedTaxData,
  MarketContract,
  MarketSummary,
  DailyRecord,
  TaxpayerRecord,
  OldTaxDebtorRecord,
} from '../types/revenue';
import {
  INITIAL_REVENUE_CATEGORIES,
  INITIAL_LAND_TAX_DATA,
  INITIAL_SIGN_TAX_DATA,
  INITIAL_MARKET_SUMMARIES,
  INITIAL_MARKET_CONTRACTS,
  INITIAL_DAILY_RECORDS,
  INITIAL_TAXPAYER_RECORDS,
  INITIAL_OLD_TAX_DEBTORS,
} from '../data/initialData';
import { CURRENT_TAB_ID } from './storage';

export interface BootstrapResult {
  success: boolean;
  isNewlyCreated: boolean;
  databaseName: string;
  data?: {
    categories: RevenueCategory[];
    landTax: DetailedTaxData;
    signTax: DetailedTaxData;
    taxpayers: TaxpayerRecord[];
    oldTaxDebtors: OldTaxDebtorRecord[];
    marketSummaries: Record<'night_market' | 'fresh_market', MarketSummary>;
    marketContracts: MarketContract[];
    dailyRecords: DailyRecord[];
    updatedAt: string;
    version: number;
  };
  error?: string;
}

const DATABASE_ID = 'databaserevenuecollection';

/**
 * Automatically checks and initializes the Firebase Firestore database (databaserevenuecollection).
 * If collections/documents do not yet exist, creates them automatically with the full initial municipal dataset.
 * If data already exists, retrieves it to hydrate the app.
 */
export async function bootstrapFirestoreDatabase(forceRecreate = false): Promise<BootstrapResult> {
  try {
    const activeDocRef = doc(db, 'app_state', 'active_database');
    const activeSnap = await getDoc(activeDocRef);

    const needsCreation = forceRecreate || !activeSnap.exists() || !activeSnap.data()?.categories;

    if (!needsCreation) {
      const existing = activeSnap.data();
      const nowIso = new Date().toISOString();

      // Ensure tax_summaries collection (land and sign) exists in Firestore
      try {
        const landSnap = await getDoc(doc(db, 'tax_summaries', 'land'));
        const signSnap = await getDoc(doc(db, 'tax_summaries', 'sign'));
        if (!landSnap.exists()) {
          await setDoc(doc(db, 'tax_summaries', 'land'), {
            ...(existing?.landTax || INITIAL_LAND_TAX_DATA),
            id: 'land',
            taxType: 'land',
            updatedAt: nowIso,
          });
        }
        if (!signSnap.exists()) {
          await setDoc(doc(db, 'tax_summaries', 'sign'), {
            ...(existing?.signTax || INITIAL_SIGN_TAX_DATA),
            id: 'sign',
            taxType: 'sign',
            updatedAt: nowIso,
          });
        }
      } catch (e) {
        console.warn('Verifying tax_summaries note:', e);
      }

      return {
        success: true,
        isNewlyCreated: false,
        databaseName: DATABASE_ID,
        data: {
          categories: existing.categories || INITIAL_REVENUE_CATEGORIES,
          landTax: existing.landTax || INITIAL_LAND_TAX_DATA,
          signTax: existing.signTax || INITIAL_SIGN_TAX_DATA,
          taxpayers: existing.taxpayers || INITIAL_TAXPAYER_RECORDS,
          oldTaxDebtors: existing.oldTaxDebtors || INITIAL_OLD_TAX_DEBTORS,
          marketSummaries: existing.marketSummaries || INITIAL_MARKET_SUMMARIES,
          marketContracts: existing.marketContracts || INITIAL_MARKET_CONTRACTS,
          dailyRecords: existing.dailyRecords || INITIAL_DAILY_RECORDS,
          updatedAt: existing.updatedAt || new Date().toISOString(),
          version: existing.version || 1,
        },
      };
    }

    // Automatically create database and seed all collections
    const nowIso = new Date().toISOString();
    const batch = writeBatch(db);

    // 1. Central app_state/active_database document (บูรณาการทุกเมนู)
    const centralData = {
      databaseName: DATABASE_ID,
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastUpdatedBy: CURRENT_TAB_ID,
      status: 'active',
      categories: INITIAL_REVENUE_CATEGORIES,
      landTax: INITIAL_LAND_TAX_DATA,
      signTax: INITIAL_SIGN_TAX_DATA,
      taxpayers: INITIAL_TAXPAYER_RECORDS,
      oldTaxDebtors: INITIAL_OLD_TAX_DEBTORS,
      marketSummaries: INITIAL_MARKET_SUMMARIES,
      marketContracts: INITIAL_MARKET_CONTRACTS,
      dailyRecords: INITIAL_DAILY_RECORDS,
    };
    batch.set(activeDocRef, centralData);

    // 2. เมนูที่ 1: ภาพรวมรายได้ (Overview Dashboard) - overview_metrics
    const overviewRef = doc(db, 'overview_metrics', 'summary');
    const totalOverviewEstimate = INITIAL_REVENUE_CATEGORIES.reduce(
      (sum, c) => sum + c.items.reduce((iSum, item) => iSum + (item.estimate || 0), 0),
      0
    );
    const totalOverviewActual = INITIAL_REVENUE_CATEGORIES.reduce(
      (sum, c) => sum + c.items.reduce((iSum, item) => iSum + (item.actual || 0), 0),
      0
    );
    batch.set(overviewRef, {
      id: 'summary',
      fiscalYear: '2570',
      municipality: 'เทศบาลเมืองมหาสารคาม',
      division: 'ฝ่ายพัฒนารายได้ กองคลัง',
      totalEstimate: totalOverviewEstimate,
      totalActual: totalOverviewActual,
      percentage: totalOverviewEstimate > 0 ? Number(((totalOverviewActual / totalOverviewEstimate) * 100).toFixed(2)) : 0,
      updatedAt: nowIso,
      lastUpdatedBy: CURRENT_TAB_ID,
    });

    // 3. เมนูที่ 2: 8 หมวดรายได้ (8 Revenue Categories)
    INITIAL_REVENUE_CATEGORIES.forEach((cat) => {
      const catRef = doc(db, 'revenue_categories', cat.key);
      const totalEstimate = cat.items.reduce((sum, item) => sum + (item.estimate || 0), 0);
      const totalActual = cat.items.reduce((sum, item) => sum + (item.actual || 0), 0);
      const percentage = totalEstimate > 0 ? Number(((totalActual / totalEstimate) * 100).toFixed(2)) : 0;
      batch.set(catRef, {
        key: cat.key,
        title: cat.title,
        shortTitle: cat.shortTitle,
        description: cat.description || '',
        totalEstimate,
        totalActual,
        percentage,
        itemCount: cat.items.length,
        items: cat.items,
        updatedAt: nowIso,
        lastUpdatedBy: CURRENT_TAB_ID,
      });
    });

    // 4. เมนูที่ 3: ภาษีที่ดิน & ภาษีป้าย (Property & Sign Taxes) - สรุปภาษี
    const landSummaryRef = doc(db, 'tax_summaries', 'land');
    batch.set(landSummaryRef, {
      ...INITIAL_LAND_TAX_DATA,
      id: 'land',
      taxType: 'land',
      updatedAt: nowIso,
    });

    const signSummaryRef = doc(db, 'tax_summaries', 'sign');
    batch.set(signSummaryRef, {
      ...INITIAL_SIGN_TAX_DATA,
      id: 'sign',
      taxType: 'sign',
      updatedAt: nowIso,
    });

    // 5. เมนูที่ 3: บัญชีผู้เสียภาษี (Taxpayers)
    INITIAL_TAXPAYER_RECORDS.forEach((tp) => {
      const tpRef = doc(db, 'taxpayers', tp.id);
      batch.set(tpRef, {
        ...tp,
        updatedAt: nowIso,
      });
    });

    // 6. เมนูที่ 3: ลูกหนี้ภาษีค้างชำระปีก่อน (Old Tax Debtors)
    INITIAL_OLD_TAX_DEBTORS.forEach((debtor) => {
      const debtorRef = doc(db, 'old_tax_debtors', debtor.id);
      batch.set(debtorRef, {
        ...debtor,
        updatedAt: nowIso,
      });
    });

    // 7. เมนูที่ 4: บันทึกข้อความราชการ (Official Memorandum)
    const memoRef = doc(db, 'official_memorandums', 'memo_fiscal_2570');
    batch.set(memoRef, {
      id: 'memo_fiscal_2570',
      docNo: 'มค ๕๒๐๐๔/พิเศษ',
      docDate: '2026-10-24',
      subject: 'รายงานผลการจัดเก็บรายได้ ประจำปีงบประมาณ พ.ศ. ๒๕๗๐',
      department: 'ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม',
      fiscalYear: '2570',
      reporterName: 'นางสาวพิมพ์ใจ พัฒนารายได้',
      reporterPosition: 'เจ้าพนักงานจัดเก็บรายได้ชำนาญงาน',
      directorName: 'นางสาวกานดา วิริยะการคลัง',
      directorPosition: 'ผู้อำนวยการกองคลัง',
      executiveName: 'นายภาคภูมิ วัฒนพงษ์',
      executivePosition: 'นายกเทศมนตรีเมืองมหาสารคาม',
      updatedAt: nowIso,
      lastUpdatedBy: CURRENT_TAB_ID,
    });

    // 8. ระบบตลาดเทศบาล (Fresh Market & Night Market)
    const freshMarketRef = doc(db, 'market_summaries', 'fresh_market');
    batch.set(freshMarketRef, {
      id: 'fresh_market',
      marketType: 'fresh_market',
      ...INITIAL_MARKET_SUMMARIES.fresh_market,
      updatedAt: nowIso,
    });

    const nightMarketRef = doc(db, 'market_summaries', 'night_market');
    batch.set(nightMarketRef, {
      id: 'night_market',
      marketType: 'night_market',
      ...INITIAL_MARKET_SUMMARIES.night_market,
      updatedAt: nowIso,
    });

    // 9. สัญญาเช่าแผงตลาด (Market Contracts)
    INITIAL_MARKET_CONTRACTS.forEach((contract) => {
      const contractRef = doc(db, 'market_contracts', contract.id);
      batch.set(contractRef, {
        ...contract,
        updatedAt: nowIso,
      });
    });

    // 10. บันทึกรายรับประจำวัน (Daily Records)
    INITIAL_DAILY_RECORDS.forEach((rec) => {
      const recRef = doc(db, 'daily_records', rec.id);
      batch.set(recRef, {
        ...rec,
        recordedAt: rec.recordedAt || nowIso,
      });
    });

    // Commit atomic batch creation
    await batch.commit();

    return {
      success: true,
      isNewlyCreated: true,
      databaseName: DATABASE_ID,
      data: {
        categories: INITIAL_REVENUE_CATEGORIES,
        landTax: INITIAL_LAND_TAX_DATA,
        signTax: INITIAL_SIGN_TAX_DATA,
        taxpayers: INITIAL_TAXPAYER_RECORDS,
        oldTaxDebtors: INITIAL_OLD_TAX_DEBTORS,
        marketSummaries: INITIAL_MARKET_SUMMARIES,
        marketContracts: INITIAL_MARKET_CONTRACTS,
        dailyRecords: INITIAL_DAILY_RECORDS,
        updatedAt: nowIso,
        version: 1,
      },
    };
  } catch (error) {
    console.error('Error during automatic Firebase database creation/bootstrap:', error);
    try {
      handleFirestoreError(error, OperationType.WRITE, 'app_state/active_database');
    } catch {
      // handled
    }
    return {
      success: false,
      isNewlyCreated: false,
      databaseName: DATABASE_ID,
      error: error instanceof Error ? error.message : 'Unknown Firestore bootstrap error',
    };
  }
}

/**
 * Persists an individual taxpayer record to Firestore collection and updates active_database
 */
export async function persistTaxpayerToFirestore(taxpayer: TaxpayerRecord): Promise<void> {
  try {
    const tpRef = doc(db, 'taxpayers', taxpayer.id);
    await setDoc(tpRef, {
      ...taxpayer,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Persist taxpayer to Firestore failed (cached locally):', error);
  }
}

/**
 * Deletes a taxpayer record from Firestore
 */
export async function deleteTaxpayerFromFirestore(taxpayerId: string): Promise<void> {
  try {
    const tpRef = doc(db, 'taxpayers', taxpayerId);
    await deleteDoc(tpRef);
  } catch (error) {
    console.warn('Delete taxpayer from Firestore failed:', error);
  }
}

/**
 * Persists an individual daily record receipt to Firestore collection
 */
export async function persistDailyRecordToFirestore(record: DailyRecord): Promise<void> {
  try {
    const recRef = doc(db, 'daily_records', record.id);
    await setDoc(recRef, {
      ...record,
      recordedAt: record.recordedAt || new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Persist daily record to Firestore failed (cached locally):', error);
  }
}

/**
 * Deletes a daily receipt record from Firestore
 */
export async function deleteDailyRecordFromFirestore(recordId: string): Promise<void> {
  try {
    const recRef = doc(db, 'daily_records', recordId);
    await deleteDoc(recRef);
  } catch (error) {
    console.warn('Delete daily record from Firestore failed:', error);
  }
}

/**
 * Persists an individual revenue category (one of 8 categories) and its items to Firestore
 */
export async function persistRevenueCategoryToFirestore(category: RevenueCategory): Promise<boolean> {
  try {
    const totalEstimate = category.items.reduce((sum, item) => sum + (item.estimate || 0), 0);
    const totalActual = category.items.reduce((sum, item) => sum + (item.actual || 0), 0);
    const percentage = totalEstimate > 0 ? Number(((totalActual / totalEstimate) * 100).toFixed(2)) : 0;
    const nowIso = new Date().toISOString();

    const catRef = doc(db, 'revenue_categories', category.key);
    await setDoc(catRef, {
      key: category.key,
      title: category.title,
      shortTitle: category.shortTitle,
      description: category.description || '',
      totalEstimate,
      totalActual,
      percentage,
      itemCount: category.items.length,
      items: category.items,
      updatedAt: nowIso,
      lastUpdatedBy: CURRENT_TAB_ID,
    });
    return true;
  } catch (error) {
    console.warn(`Persist revenue category ${category.key} to Firestore failed:`, error);
    return false;
  }
}

/**
 * Persists all 8 municipal revenue categories to Firebase Firestore in a single batch
 */
export async function persistAllRevenueCategoriesToFirestore(
  categories: RevenueCategory[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();

    categories.forEach((cat) => {
      const catRef = doc(db, 'revenue_categories', cat.key);
      const totalEstimate = cat.items.reduce((sum, item) => sum + (item.estimate || 0), 0);
      const totalActual = cat.items.reduce((sum, item) => sum + (item.actual || 0), 0);
      const percentage = totalEstimate > 0 ? Number(((totalActual / totalEstimate) * 100).toFixed(2)) : 0;

      batch.set(catRef, {
        key: cat.key,
        title: cat.title,
        shortTitle: cat.shortTitle,
        description: cat.description || '',
        totalEstimate,
        totalActual,
        percentage,
        itemCount: cat.items.length,
        items: cat.items,
        updatedAt: nowIso,
        lastUpdatedBy: CURRENT_TAB_ID,
      });
    });

    // Also update central app_state/active_database
    const activeDocRef = doc(db, 'app_state', 'active_database');
    batch.set(
      activeDocRef,
      {
        categories,
        databaseName: DATABASE_ID,
        updatedAt: nowIso,
        lastUpdatedBy: CURRENT_TAB_ID,
      },
      { merge: true }
    );

    await batch.commit();
    return { success: true, count: categories.length };
  } catch (error) {
    console.error('Batch persist 8 revenue categories to Firestore failed:', error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown Firestore batch error',
    };
  }
}

/**
 * Fetches all 8 revenue categories directly from the Firestore collection
 */
export async function fetchRevenueCategoriesFromFirestore(): Promise<RevenueCategory[] | null> {
  try {
    const snap = await getDocs(collection(db, 'revenue_categories'));
    if (snap.empty) {
      return null;
    }

    const categoryOrder = [
      'taxes',
      'fees_fines_licenses',
      'property_revenues',
      'utilities_commercial',
      'miscellaneous_revenues',
      'capital_revenues',
      'allocated_taxes',
      'grants_subsidies',
    ];

    const fetchedList: RevenueCategory[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data && data.key && data.title && Array.isArray(data.items)) {
        fetchedList.push({
          key: data.key,
          title: data.title,
          shortTitle: data.shortTitle || data.title,
          description: data.description || '',
          items: data.items,
        });
      }
    });

    if (fetchedList.length === 0) return null;

    // Sort to maintain standard 8 category government order
    fetchedList.sort((a, b) => {
      const idxA = categoryOrder.indexOf(a.key);
      const idxB = categoryOrder.indexOf(b.key);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });

    return fetchedList;
  } catch (error) {
    console.warn('Fetch revenue categories from Firestore failed:', error);
    return null;
  }
}

/**
 * Real-time listener for the 8 revenue categories Firestore collection
 */
export function subscribeToRevenueCategoriesFromFirestore(
  callback: (categories: RevenueCategory[]) => void
): () => void {
  try {
    const colRef = collection(db, 'revenue_categories');
    const categoryOrder = [
      'taxes',
      'fees_fines_licenses',
      'property_revenues',
      'utilities_commercial',
      'miscellaneous_revenues',
      'capital_revenues',
      'allocated_taxes',
      'grants_subsidies',
    ];

    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: RevenueCategory[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            if (data && data.key && data.title && Array.isArray(data.items)) {
              list.push({
                key: data.key,
                title: data.title,
                shortTitle: data.shortTitle || data.title,
                description: data.description || '',
                items: data.items,
              });
            }
          });

          if (list.length > 0) {
            list.sort((a, b) => {
              const idxA = categoryOrder.indexOf(a.key);
              const idxB = categoryOrder.indexOf(b.key);
              return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
            });
            callback(list);
          }
        }
      },
      (error) => {
        console.warn('Revenue categories Firestore snapshot listener note:', error);
      }
    );

    return unsubscribe;
  } catch (e) {
    console.warn('Could not initialize revenue_categories Firestore listener:', e);
    return () => {};
  }
}

/**
 * Persists land tax metrics to Firestore tax_summaries/land and syncs with central active_database
 */
export async function persistLandTaxToFirestore(landTax: DetailedTaxData): Promise<boolean> {
  try {
    const nowIso = new Date().toISOString();
    const landRef = doc(db, 'tax_summaries', 'land');
    await setDoc(landRef, {
      ...landTax,
      id: 'land',
      taxType: 'land',
      updatedAt: nowIso,
      lastUpdatedBy: CURRENT_TAB_ID,
    });

    const activeDocRef = doc(db, 'app_state', 'active_database');
    await setDoc(
      activeDocRef,
      {
        landTax,
        updatedAt: nowIso,
        lastUpdatedBy: CURRENT_TAB_ID,
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.warn('Persist landTax to Firestore failed:', error);
    return false;
  }
}

/**
 * Persists sign tax metrics to Firestore tax_summaries/sign and syncs with central active_database
 */
export async function persistSignTaxToFirestore(signTax: DetailedTaxData): Promise<boolean> {
  try {
    const nowIso = new Date().toISOString();
    const signRef = doc(db, 'tax_summaries', 'sign');
    await setDoc(signRef, {
      ...signTax,
      id: 'sign',
      taxType: 'sign',
      updatedAt: nowIso,
      lastUpdatedBy: CURRENT_TAB_ID,
    });

    const activeDocRef = doc(db, 'app_state', 'active_database');
    await setDoc(
      activeDocRef,
      {
        signTax,
        updatedAt: nowIso,
        lastUpdatedBy: CURRENT_TAB_ID,
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.warn('Persist signTax to Firestore failed:', error);
    return false;
  }
}

/**
 * Persists both landTax and signTax tracking metrics to Firestore in a single batch
 */
export async function persistTaxSummariesToFirestore(
  landTax: DetailedTaxData,
  signTax: DetailedTaxData
): Promise<boolean> {
  try {
    const nowIso = new Date().toISOString();
    const batch = writeBatch(db);

    const landRef = doc(db, 'tax_summaries', 'land');
    batch.set(landRef, {
      ...landTax,
      id: 'land',
      taxType: 'land',
      updatedAt: nowIso,
      lastUpdatedBy: CURRENT_TAB_ID,
    });

    const signRef = doc(db, 'tax_summaries', 'sign');
    batch.set(signRef, {
      ...signTax,
      id: 'sign',
      taxType: 'sign',
      updatedAt: nowIso,
      lastUpdatedBy: CURRENT_TAB_ID,
    });

    const activeDocRef = doc(db, 'app_state', 'active_database');
    batch.set(
      activeDocRef,
      {
        landTax,
        signTax,
        updatedAt: nowIso,
        lastUpdatedBy: CURRENT_TAB_ID,
      },
      { merge: true }
    );

    await batch.commit();
    return true;
  } catch (error) {
    console.error('Persist tax summaries to Firestore failed:', error);
    return false;
  }
}

/**
 * Persists all taxpayer records to Firestore taxpayers collection in batches of 400
 */
export async function persistAllTaxpayersToFirestore(
  taxpayers: TaxpayerRecord[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const nowIso = new Date().toISOString();
    const CHUNK_SIZE = 400; // Firestore limit per batch is 500

    for (let i = 0; i < taxpayers.length; i += CHUNK_SIZE) {
      const chunk = taxpayers.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const tp of chunk) {
        if (!tp.id) continue;
        const tpRef = doc(db, 'taxpayers', tp.id);
        batch.set(tpRef, {
          ...tp,
          updatedAt: tp.updatedAt || nowIso,
        });
      }
      await batch.commit();
    }

    // Also update central active_database
    const activeDocRef = doc(db, 'app_state', 'active_database');
    await setDoc(
      activeDocRef,
      {
        taxpayers,
        updatedAt: nowIso,
        lastUpdatedBy: CURRENT_TAB_ID,
      },
      { merge: true }
    );

    return { success: true, count: taxpayers.length };
  } catch (error) {
    console.error('Batch persist taxpayers to Firestore failed:', error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown Firestore taxpayer batch error',
    };
  }
}

/**
 * Fetches tax summaries (land & sign) directly from Firestore
 */
export async function fetchTaxSummariesFromFirestore(): Promise<{
  landTax?: DetailedTaxData;
  signTax?: DetailedTaxData;
} | null> {
  try {
    const landSnap = await getDoc(doc(db, 'tax_summaries', 'land'));
    const signSnap = await getDoc(doc(db, 'tax_summaries', 'sign'));

    const result: { landTax?: DetailedTaxData; signTax?: DetailedTaxData } = {};
    if (landSnap.exists()) {
      result.landTax = landSnap.data() as DetailedTaxData;
    }
    if (signSnap.exists()) {
      result.signTax = signSnap.data() as DetailedTaxData;
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.warn('Fetch tax summaries from Firestore failed:', error);
    return null;
  }
}

/**
 * Real-time listener for the tax_summaries Firestore collection
 */
export function subscribeToTaxSummariesFromFirestore(
  callback: (data: { landTax?: DetailedTaxData; signTax?: DetailedTaxData }) => void
): () => void {
  try {
    const colRef = collection(db, 'tax_summaries');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        let landTax: DetailedTaxData | undefined;
        let signTax: DetailedTaxData | undefined;

        snapshot.forEach((d) => {
          const docData = d.data();
          if (d.id === 'land' || docData.taxType === 'land') {
            landTax = {
              estimateCount: docData.estimateCount,
              estimateAmount: docData.estimateAmount,
              collected: docData.collected,
              taxpayers: docData.taxpayers,
              debtors: docData.debtors,
              pendingVerification: docData.pendingVerification,
              updatedAt: docData.updatedAt,
            };
          } else if (d.id === 'sign' || docData.taxType === 'sign') {
            signTax = {
              estimateCount: docData.estimateCount,
              estimateAmount: docData.estimateAmount,
              collected: docData.collected,
              taxpayers: docData.taxpayers,
              debtors: docData.debtors,
              pendingVerification: docData.pendingVerification,
              updatedAt: docData.updatedAt,
            };
          }
        });

        if (landTax || signTax) {
          callback({ landTax, signTax });
        }
      },
      (error) => {
        console.warn('Tax summaries Firestore listener note:', error);
      }
    );
    return unsubscribe;
  } catch (e) {
    console.warn('Could not initialize tax_summaries Firestore listener:', e);
    return () => {};
  }
}

/**
 * Real-time listener for taxpayers collection
 */
export function subscribeToTaxpayersCollectionFromFirestore(
  callback: (taxpayers: TaxpayerRecord[]) => void
): () => void {
  try {
    const colRef = collection(db, 'taxpayers');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: TaxpayerRecord[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            if (data && data.name && data.taxType) {
              list.push({
                id: d.id,
                name: data.name,
                taxType: data.taxType,
                assessedAmount: data.assessedAmount ?? 0,
                reliefAmount: data.reliefAmount ?? 0,
                afterReliefAmount: data.afterReliefAmount ?? 0,
                status: data.status ?? 0,
                payment1: data.payment1 ?? 0,
                payment2: data.payment2 ?? 0,
                payment3: data.payment3 ?? 0,
                remainingBalance: data.remainingBalance ?? 0,
                isFullyPaid: Boolean(data.isFullyPaid),
                isPendingVerification: Boolean(data.isPendingVerification),
                hasOldDebt: Boolean(data.hasOldDebt),
                oldDebtAmount: data.oldDebtAmount ?? 0,
                oldDebtStatus: data.oldDebtStatus ?? 0,
                oldDebtPaid: data.oldDebtPaid ?? 0,
                oldDebtRemaining: data.oldDebtRemaining ?? 0,
                penaltyAmount: data.penaltyAmount ?? 0,
                surchargeAmount: data.surchargeAmount ?? 0,
                notes: data.notes ?? '',
                updatedAt: data.updatedAt,
              });
            }
          });

          if (list.length > 0) {
            callback(list);
          }
        }
      },
      (error) => {
        console.warn('Taxpayers collection Firestore snapshot note:', error);
      }
    );
    return unsubscribe;
  } catch (e) {
    console.warn('Could not initialize taxpayers Firestore listener:', e);
    return () => {};
  }
}

/**
 * Fetches the count of documents across Firestore collections for diagnostic stats
 */
export async function getFirestoreStats(): Promise<{
  connected: boolean;
  databaseId: string;
  taxpayersCount: number;
  dailyRecordsCount: number;
  categoriesCount: number;
  taxSummariesCount: number;
  landTaxpayersCount: number;
  signTaxpayersCount: number;
  oldTaxDebtorsCount: number;
  marketContractsCount: number;
  marketSummariesCount: number;
  memorandumsCount: number;
  overviewMetricsCount: number;
  lastUpdated: string | null;
}> {
  try {
    const activeDocRef = doc(db, 'app_state', 'active_database');
    const snap = await getDoc(activeDocRef);

    let taxpayersCount = 0;
    let landTaxpayersCount = 0;
    let signTaxpayersCount = 0;
    let dailyRecordsCount = 0;
    let categoriesCount = 8;
    let taxSummariesCount = 2;
    let lastUpdated: string | null = null;

    let oldTaxDebtorsCount = 0;
    let marketContractsCount = 0;
    let marketSummariesCount = 2;
    let memorandumsCount = 1;
    let overviewMetricsCount = 1;

    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.taxpayers)) {
        taxpayersCount = data.taxpayers.length;
        landTaxpayersCount = data.taxpayers.filter((t: any) => t.taxType === 'land').length;
        signTaxpayersCount = data.taxpayers.filter((t: any) => t.taxType === 'sign').length;
      }
      if (Array.isArray(data.oldTaxDebtors)) {
        oldTaxDebtorsCount = data.oldTaxDebtors.length;
      }
      if (Array.isArray(data.marketContracts)) {
        marketContractsCount = data.marketContracts.length;
      }
      dailyRecordsCount = Array.isArray(data.dailyRecords) ? data.dailyRecords.length : 0;
      categoriesCount = Array.isArray(data.categories) ? data.categories.length : 8;
      lastUpdated = data.updatedAt || null;
    } else {
      const tpSnap = await getDocs(collection(db, 'taxpayers'));
      taxpayersCount = tpSnap.size;
    }

    try {
      const taxSumSnap = await getDocs(collection(db, 'tax_summaries'));
      if (!taxSumSnap.empty) {
        taxSummariesCount = taxSumSnap.size;
      }
    } catch {
      // fallback
    }

    try {
      const catSnap = await getDocs(collection(db, 'revenue_categories'));
      if (!catSnap.empty) {
        categoriesCount = catSnap.size;
      }
    } catch {
      // fallback to activeDoc
    }

    return {
      connected: true,
      databaseId: DATABASE_ID,
      taxpayersCount,
      dailyRecordsCount,
      categoriesCount,
      taxSummariesCount,
      landTaxpayersCount,
      signTaxpayersCount,
      oldTaxDebtorsCount,
      marketContractsCount,
      marketSummariesCount,
      memorandumsCount,
      overviewMetricsCount,
      lastUpdated,
    };
  } catch {
    return {
      connected: false,
      databaseId: DATABASE_ID,
      taxpayersCount: 0,
      dailyRecordsCount: 0,
      categoriesCount: 0,
      taxSummariesCount: 0,
      landTaxpayersCount: 0,
      signTaxpayersCount: 0,
      oldTaxDebtorsCount: 0,
      marketContractsCount: 0,
      marketSummariesCount: 0,
      memorandumsCount: 0,
      overviewMetricsCount: 0,
      lastUpdated: null,
    };
  }
}

/**
 * Persists official memorandum to Firestore official_memorandums collection
 */
export async function persistOfficialMemorandumToFirestore(memo: {
  id?: string;
  docNo: string;
  docDate: string;
  subject: string;
  department?: string;
  fiscalYear?: string;
  reporterName?: string;
  reporterPosition?: string;
  directorName?: string;
  directorPosition?: string;
  executiveName?: string;
  executivePosition?: string;
  summary?: any;
}): Promise<boolean> {
  try {
    const memoId = memo.id || 'memo_fiscal_2570';
    const memoRef = doc(db, 'official_memorandums', memoId);
    await setDoc(memoRef, {
      ...memo,
      id: memoId,
      updatedAt: new Date().toISOString(),
      lastUpdatedBy: CURRENT_TAB_ID,
    });
    return true;
  } catch (error) {
    console.warn('Persist official memorandum to Firestore failed:', error);
    return false;
  }
}

/**
 * Persists executive overview metrics to Firestore overview_metrics collection
 */
export async function persistOverviewMetricsToFirestore(metrics: {
  totalEstimate: number;
  totalActual: number;
  fiscalYear?: string;
}): Promise<boolean> {
  try {
    const overviewRef = doc(db, 'overview_metrics', 'summary');
    await setDoc(overviewRef, {
      id: 'summary',
      fiscalYear: metrics.fiscalYear || '2570',
      municipality: 'เทศบาลเมืองมหาสารคาม',
      division: 'ฝ่ายพัฒนารายได้ กองคลัง',
      totalEstimate: metrics.totalEstimate,
      totalActual: metrics.totalActual,
      percentage: metrics.totalEstimate > 0
        ? Number(((metrics.totalActual / metrics.totalEstimate) * 100).toFixed(2))
        : 0,
      updatedAt: new Date().toISOString(),
      lastUpdatedBy: CURRENT_TAB_ID,
    });
    return true;
  } catch (error) {
    console.warn('Persist overview metrics to Firestore failed:', error);
    return false;
  }
}


