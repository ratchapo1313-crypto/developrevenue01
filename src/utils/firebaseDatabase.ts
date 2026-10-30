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

    // 1. Central app_state/active_database document
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

    // 2. Seed revenue categories documents (all 8 categories)
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

    // 3. Seed tax summaries
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


    // 4. Seed initial taxpayer records
    INITIAL_TAXPAYER_RECORDS.slice(0, 30).forEach((tp) => {
      const tpRef = doc(db, 'taxpayers', tp.id);
      batch.set(tpRef, {
        ...tp,
        updatedAt: nowIso,
      });
    });

    // 5. Seed initial daily receipt records
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
 * Fetches the count of documents across Firestore collections for diagnostic stats
 */
export async function getFirestoreStats(): Promise<{
  connected: boolean;
  databaseId: string;
  taxpayersCount: number;
  dailyRecordsCount: number;
  categoriesCount: number;
  lastUpdated: string | null;
}> {
  try {
    const activeDocRef = doc(db, 'app_state', 'active_database');
    const snap = await getDoc(activeDocRef);

    let taxpayersCount = 0;
    let dailyRecordsCount = 0;
    let categoriesCount = 8;
    let lastUpdated: string | null = null;

    if (snap.exists()) {
      const data = snap.data();
      taxpayersCount = Array.isArray(data.taxpayers) ? data.taxpayers.length : 0;
      dailyRecordsCount = Array.isArray(data.dailyRecords) ? data.dailyRecords.length : 0;
      categoriesCount = Array.isArray(data.categories) ? data.categories.length : 8;
      lastUpdated = data.updatedAt || null;
    } else {
      const tpSnap = await getDocs(collection(db, 'taxpayers'));
      taxpayersCount = tpSnap.size;
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
      lastUpdated,
    };
  } catch {
    return {
      connected: false,
      databaseId: DATABASE_ID,
      taxpayersCount: 0,
      dailyRecordsCount: 0,
      categoriesCount: 0,
      lastUpdated: null,
    };
  }
}

