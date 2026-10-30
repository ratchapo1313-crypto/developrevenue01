import {
  RevenueCategory,
  DetailedTaxData,
  MarketContract,
  MarketSummary,
  DailyRecord,
  UserSession,
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
import { db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

const STORAGE_KEYS = {
  CATEGORIES: 'mk_revenue_categories_2570',
  LAND_TAX: 'mk_land_tax_data_2570',
  SIGN_TAX: 'mk_sign_tax_data_2570',
  TAXPAYERS: 'mk_taxpayer_records_2570',
  OLD_TAX_DEBTORS: 'mk_old_tax_debtors_2570',
  MARKET_SUMMARIES: 'mk_market_summaries_2570',
  MARKET_CONTRACTS: 'mk_market_contracts_2570',
  DAILY_RECORDS: 'mk_daily_records_2570',
  SESSION_TAB: 'mks_revenue_session_tab_2570',
};

export const SYNC_CHANNEL_NAME = 'mks_revenue_database_channel';

export type DatabaseSyncEventType =
  | 'CATEGORIES_UPDATED'
  | 'LAND_TAX_UPDATED'
  | 'SIGN_TAX_UPDATED'
  | 'TAXPAYERS_UPDATED'
  | 'OLD_TAX_DEBTORS_UPDATED'
  | 'MARKET_SUMMARIES_UPDATED'
  | 'MARKET_CONTRACTS_UPDATED'
  | 'DAILY_RECORDS_UPDATED'
  | 'ALL_DATA_RESET';

export interface DatabaseSyncMessage {
  type: DatabaseSyncEventType;
  timestamp: number;
  sourceTabId: string;
}

// Generate unique tab/device ID for this client instance
export const CURRENT_TAB_ID =
  typeof window !== 'undefined'
    ? `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    : 'server';

const serverUpdateTimers: Record<string, any> = {};
const pendingPayloads: Record<string, any> = {};

/**
 * Immediately flushes any pending mutation to the backend server
 */
export const flushPendingUpdatesToServer = (): void => {
  if (typeof window === 'undefined') return;

  const keys = Object.keys(pendingPayloads);
  if (keys.length === 0) return;

  for (const key of keys) {
    const data = pendingPayloads[key];
    if (serverUpdateTimers[key]) {
      clearTimeout(serverUpdateTimers[key]);
      delete serverUpdateTimers[key];
    }
    delete pendingPayloads[key];

    try {
      fetch('/api/database/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          data,
          sourceId: CURRENT_TAB_ID,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // ignore in unload
    }
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPendingUpdatesToServer);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPendingUpdatesToServer();
    }
  });
}

export const syncToFirestore = async (key: string, data: any): Promise<void> => {
  if (typeof window === 'undefined') return;
  try {
    const docRef = doc(db, 'app_state', 'active_database');
    await setDoc(
      docRef,
      {
        [key]: data,
        lastUpdatedBy: CURRENT_TAB_ID,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore write sync error (local storage still preserved):', err);
  }
};

/**
 * Subscribes to Cloud Firestore real-time snapshot events across all devices and users
 */
export const subscribeToFirestoreSync = (
  callback: (key: string, data: any) => void
): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  try {
    const docRef = doc(db, 'app_state', 'active_database');
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const docData = snapshot.data();
          if (docData.lastUpdatedBy !== CURRENT_TAB_ID) {
            const validKeys = [
              'categories',
              'landTax',
              'signTax',
              'taxpayers',
              'oldTaxDebtors',
              'dailyRecords',
              'marketContracts',
              'marketSummaries',
            ];
            for (const k of validKeys) {
              if (docData[k] !== undefined) {
                callback(k, docData[k]);
              }
            }
          }
        }
      },
      (error) => {
        console.warn('Firestore onSnapshot listener note:', error);
      }
    );
    return unsubscribe;
  } catch (e) {
    console.warn('Could not initialize Firestore onSnapshot listener:', e);
    return () => {};
  }
};

/**
 * Sends a mutation to both central backend server and Google Cloud Firestore so all devices save and sync
 * Debounced by 100ms per key to eliminate lag while ensuring instant durability
 */
export const pushUpdateToServer = (key: string, data: any): void => {
  if (typeof window === 'undefined') return;

  pendingPayloads[key] = data;

  if (serverUpdateTimers[key]) {
    clearTimeout(serverUpdateTimers[key]);
  }

  serverUpdateTimers[key] = setTimeout(async () => {
    delete serverUpdateTimers[key];
    delete pendingPayloads[key];
    try {
      await fetch('/api/database/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          data,
          sourceId: CURRENT_TAB_ID,
        }),
      });
    } catch (e) {
      console.warn('Central database server sync error (cached locally):', e);
    }

    // Also persist to Firebase Cloud Firestore
    syncToFirestore(key, data);
  }, 100);
};

/**
 * Broadcasts a change event to all other open tabs/windows on the current machine
 */
export const broadcastDatabaseChange = (type: DatabaseSyncEventType): void => {
  if (typeof window === 'undefined') return;

  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      const msg: DatabaseSyncMessage = {
        type,
        timestamp: Date.now(),
        sourceTabId: CURRENT_TAB_ID,
      };
      channel.postMessage(msg);
      channel.close();
    }
  } catch (e) {
    console.warn('BroadcastChannel error:', e);
  }
};

/**
 * Fetch full database from central server on startup (for any new computer/device)
 */
export interface ServerDatabaseResponse {
  categories?: RevenueCategory[];
  landTax?: DetailedTaxData;
  signTax?: DetailedTaxData;
  taxpayers?: TaxpayerRecord[];
  oldTaxDebtors?: OldTaxDebtorRecord[];
  marketSummaries?: Record<'night_market' | 'fresh_market', MarketSummary>;
  marketContracts?: MarketContract[];
  dailyRecords?: DailyRecord[];
  updatedAt?: string;
  version?: number;
}

export const fetchInitialServerDatabase = async (): Promise<ServerDatabaseResponse | null> => {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/database');
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.categories) localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(json.data.categories));
        if (json.data.landTax) localStorage.setItem(STORAGE_KEYS.LAND_TAX, JSON.stringify(json.data.landTax));
        if (json.data.signTax) localStorage.setItem(STORAGE_KEYS.SIGN_TAX, JSON.stringify(json.data.signTax));
        if (json.data.taxpayers) localStorage.setItem(STORAGE_KEYS.TAXPAYERS, JSON.stringify(json.data.taxpayers));
        if (json.data.oldTaxDebtors) localStorage.setItem(STORAGE_KEYS.OLD_TAX_DEBTORS, JSON.stringify(json.data.oldTaxDebtors));
        if (json.data.marketSummaries) localStorage.setItem(STORAGE_KEYS.MARKET_SUMMARIES, JSON.stringify(json.data.marketSummaries));
        if (json.data.marketContracts) localStorage.setItem(STORAGE_KEYS.MARKET_CONTRACTS, JSON.stringify(json.data.marketContracts));
        if (json.data.dailyRecords) localStorage.setItem(STORAGE_KEYS.DAILY_RECORDS, JSON.stringify(json.data.dailyRecords));
        return json.data;
      }
    }
  } catch (e) {
    console.warn('Could not fetch server database, fallback to local storage:', e);
  }
  return null;
};

/**
 * Subscribes to real-time events from the central backend server (across all devices/computers)
 */
export interface MultiDeviceSyncPayload {
  key: string;
  data: any;
  sourceId?: string;
  updatedAt?: string;
  version?: number;
}

export const subscribeToMultiDeviceSync = (
  callback: (payload: MultiDeviceSyncPayload) => void
): (() => void) => {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  let eventSource: EventSource | null = null;
  let isClosed = false;

  const connect = () => {
    if (isClosed) return;
    try {
      eventSource = new EventSource('/api/database/events');

      eventSource.addEventListener('database_updated', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.sourceId !== CURRENT_TAB_ID) {
            // Update local storage cache
            if (payload.key === 'categories') localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(payload.data));
            else if (payload.key === 'landTax') localStorage.setItem(STORAGE_KEYS.LAND_TAX, JSON.stringify(payload.data));
            else if (payload.key === 'signTax') localStorage.setItem(STORAGE_KEYS.SIGN_TAX, JSON.stringify(payload.data));
            else if (payload.key === 'taxpayers') localStorage.setItem(STORAGE_KEYS.TAXPAYERS, JSON.stringify(payload.data));
            else if (payload.key === 'oldTaxDebtors') localStorage.setItem(STORAGE_KEYS.OLD_TAX_DEBTORS, JSON.stringify(payload.data));
            else if (payload.key === 'marketSummaries') localStorage.setItem(STORAGE_KEYS.MARKET_SUMMARIES, JSON.stringify(payload.data));
            else if (payload.key === 'marketContracts') localStorage.setItem(STORAGE_KEYS.MARKET_CONTRACTS, JSON.stringify(payload.data));
            else if (payload.key === 'dailyRecords') localStorage.setItem(STORAGE_KEYS.DAILY_RECORDS, JSON.stringify(payload.data));

            callback(payload);
          }
        } catch (e) {
          console.error('Error handling database_updated SSE:', e);
        }
      });

      eventSource.addEventListener('database_reset', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          callback({ key: 'ALL_DATA_RESET', data: payload.data });
        } catch (e) {
          console.error('Error handling database_reset SSE:', e);
        }
      });

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!isClosed) {
          setTimeout(connect, 3000);
        }
      };
    } catch (e) {
      console.warn('SSE connection failed, will retry:', e);
      if (!isClosed) {
        setTimeout(connect, 5000);
      }
    }
  };

  connect();

  return () => {
    isClosed = true;
    if (eventSource) {
      eventSource.close();
    }
  };
};

/**
 * Subscribe to cross-tab database updates
 */
export const subscribeToDatabaseSync = (
  callback: (message: DatabaseSyncMessage) => void
): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  let bc: BroadcastChannel | null = null;
  if ('BroadcastChannel' in window) {
    try {
      bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event.data && event.data.sourceTabId !== CURRENT_TAB_ID) {
          callback(event.data);
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel subscription error:', e);
    }
  }

  // Also listen for storage events as fallback/complement
  const handleStorageEvent = (event: StorageEvent) => {
    if (!event.key) return;
    let type: DatabaseSyncEventType | null = null;

    if (event.key === STORAGE_KEYS.CATEGORIES) type = 'CATEGORIES_UPDATED';
    else if (event.key === STORAGE_KEYS.LAND_TAX) type = 'LAND_TAX_UPDATED';
    else if (event.key === STORAGE_KEYS.SIGN_TAX) type = 'SIGN_TAX_UPDATED';
    else if (event.key === STORAGE_KEYS.TAXPAYERS) type = 'TAXPAYERS_UPDATED';
    else if (event.key === STORAGE_KEYS.OLD_TAX_DEBTORS) type = 'OLD_TAX_DEBTORS_UPDATED';
    else if (event.key === STORAGE_KEYS.MARKET_SUMMARIES) type = 'MARKET_SUMMARIES_UPDATED';
    else if (event.key === STORAGE_KEYS.MARKET_CONTRACTS) type = 'MARKET_CONTRACTS_UPDATED';
    else if (event.key === STORAGE_KEYS.DAILY_RECORDS) type = 'DAILY_RECORDS_UPDATED';

    if (type) {
      callback({
        type,
        timestamp: Date.now(),
        sourceTabId: 'external_storage_event',
      });
    }
  };

  window.addEventListener('storage', handleStorageEvent);

  return () => {
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
    window.removeEventListener('storage', handleStorageEvent);
  };
};

export const loadStoredCategories = (): RevenueCategory[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (data) {
      const parsed: RevenueCategory[] = JSON.parse(data);
      const hasOldKey = parsed.some((c) => c.key === 'miscellaneous_capital');
      if (hasOldKey || parsed.length < 8) {
        return INITIAL_REVENUE_CATEGORIES;
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load categories from storage', e);
  }
  return INITIAL_REVENUE_CATEGORIES;
};

export const saveStoredCategories = (categories: RevenueCategory[], broadcast = true, pushServer = true): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    if (broadcast) broadcastDatabaseChange('CATEGORIES_UPDATED');
    if (pushServer) pushUpdateToServer('categories', categories);
  } catch (e) {
    console.error('Failed to save categories to storage', e);
  }
};

export const loadStoredLandTax = (): DetailedTaxData => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LAND_TAX);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load land tax data', e);
  }
  return INITIAL_LAND_TAX_DATA;
};

export const saveStoredLandTax = (data: DetailedTaxData, broadcast = true, pushServer = true): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.LAND_TAX, JSON.stringify(data));
    if (broadcast) broadcastDatabaseChange('LAND_TAX_UPDATED');
    if (pushServer) pushUpdateToServer('landTax', data);
  } catch (e) {
    console.error('Failed to save land tax data', e);
  }
};

export const loadStoredSignTax = (): DetailedTaxData => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SIGN_TAX);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load sign tax data', e);
  }
  return INITIAL_SIGN_TAX_DATA;
};

export const saveStoredSignTax = (data: DetailedTaxData, broadcast = true, pushServer = true): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SIGN_TAX, JSON.stringify(data));
    if (broadcast) broadcastDatabaseChange('SIGN_TAX_UPDATED');
    if (pushServer) pushUpdateToServer('signTax', data);
  } catch (e) {
    console.error('Failed to save sign tax data', e);
  }
};

export const loadStoredTaxpayers = (): TaxpayerRecord[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TAXPAYERS);
    if (data) {
      const list: TaxpayerRecord[] = JSON.parse(data);
      const totalAssessed = list.reduce((sum, item) => sum + (item.assessedAmount || 0), 0);
      if (totalAssessed === 0 && list.length > 0) {
        return INITIAL_TAXPAYER_RECORDS;
      }
      const hasIntegratedFields = list.some((t) => t.oldDebtAmount !== undefined || t.hasOldDebt !== undefined);
      if (!hasIntegratedFields) {
        return INITIAL_TAXPAYER_RECORDS;
      }
      return list;
    }
  } catch (e) {
    console.error('Failed to load taxpayers from storage', e);
  }
  return INITIAL_TAXPAYER_RECORDS;
};

export const saveStoredTaxpayers = (taxpayers: TaxpayerRecord[], broadcast = true, pushServer = true): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.TAXPAYERS, JSON.stringify(taxpayers));
    if (broadcast) broadcastDatabaseChange('TAXPAYERS_UPDATED');
    if (pushServer) pushUpdateToServer('taxpayers', taxpayers);
  } catch (e) {
    console.error('Failed to save taxpayers to storage', e);
  }
};

export const loadStoredOldTaxDebtors = (): OldTaxDebtorRecord[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.OLD_TAX_DEBTORS);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load old tax debtors from storage', e);
  }
  return INITIAL_OLD_TAX_DEBTORS;
};

export const saveStoredOldTaxDebtors = (debtors: OldTaxDebtorRecord[], broadcast = true, pushServer = true): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.OLD_TAX_DEBTORS, JSON.stringify(debtors));
    if (broadcast) broadcastDatabaseChange('OLD_TAX_DEBTORS_UPDATED');
    if (pushServer) pushUpdateToServer('oldTaxDebtors', debtors);
  } catch (e) {
    console.error('Failed to save old tax debtors to storage', e);
  }
};

export const loadStoredMarketSummaries = (): Record<'night_market' | 'fresh_market', MarketSummary> => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MARKET_SUMMARIES);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.night_market && parsed.night_market.name) {
        parsed.night_market.name = parsed.night_market.name.replace(/\s*\(ริมคลองสมถวิล\)/g, '').trim();
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load market summaries', e);
  }
  return INITIAL_MARKET_SUMMARIES;
};

export const saveStoredMarketSummaries = (
  data: Record<'night_market' | 'fresh_market', MarketSummary>,
  broadcast = true,
  pushServer = true
): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.MARKET_SUMMARIES, JSON.stringify(data));
    if (broadcast) broadcastDatabaseChange('MARKET_SUMMARIES_UPDATED');
    if (pushServer) pushUpdateToServer('marketSummaries', data);
  } catch (e) {
    console.error('Failed to save market summaries', e);
  }
};

export const loadStoredMarketContracts = (): MarketContract[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MARKET_CONTRACTS);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load market contracts', e);
  }
  return INITIAL_MARKET_CONTRACTS;
};

export const saveStoredMarketContracts = (contracts: MarketContract[], broadcast = true, pushServer = true): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.MARKET_CONTRACTS, JSON.stringify(contracts));
    if (broadcast) broadcastDatabaseChange('MARKET_CONTRACTS_UPDATED');
    if (pushServer) pushUpdateToServer('marketContracts', contracts);
  } catch (e) {
    console.error('Failed to save market contracts', e);
  }
};

export const loadStoredDailyRecords = (): DailyRecord[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DAILY_RECORDS);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load daily records', e);
  }
  return INITIAL_DAILY_RECORDS;
};

export const saveStoredDailyRecords = (records: DailyRecord[], broadcast = true, pushServer = true): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.DAILY_RECORDS, JSON.stringify(records));
    if (broadcast) broadcastDatabaseChange('DAILY_RECORDS_UPDATED');
    if (pushServer) pushUpdateToServer('dailyRecords', records);
  } catch (e) {
    console.error('Failed to save daily records', e);
  }
};

export const loadStoredSession = (): UserSession | null => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const data = sessionStorage.getItem(STORAGE_KEYS.SESSION_TAB);
      if (data) {
        return JSON.parse(data);
      }
    }
  } catch (e) {
    console.error('Failed to read tab session storage', e);
  }
  return null;
};

export const saveStoredSession = (session: UserSession | null): void => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (session) {
        sessionStorage.setItem(STORAGE_KEYS.SESSION_TAB, JSON.stringify(session));
      } else {
        sessionStorage.removeItem(STORAGE_KEYS.SESSION_TAB);
      }
    }
  } catch (e) {
    console.error('Failed to save tab session', e);
  }
};

export const resetToDefaultData = (): void => {
  localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
  localStorage.removeItem(STORAGE_KEYS.LAND_TAX);
  localStorage.removeItem(STORAGE_KEYS.SIGN_TAX);
  localStorage.removeItem(STORAGE_KEYS.TAXPAYERS);
  localStorage.removeItem(STORAGE_KEYS.OLD_TAX_DEBTORS);
  localStorage.removeItem(STORAGE_KEYS.MARKET_SUMMARIES);
  localStorage.removeItem(STORAGE_KEYS.MARKET_CONTRACTS);
  localStorage.removeItem(STORAGE_KEYS.DAILY_RECORDS);
  broadcastDatabaseChange('ALL_DATA_RESET');
  fetch('/api/database/reset', { method: 'POST' }).catch(() => {});
};
