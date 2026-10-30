/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { RevenueCategoriesTable } from './components/RevenueCategoriesTable';
import { PropertyTaxSection } from './components/PropertyTaxSection';
import { OfficialMemorandum } from './components/OfficialMemorandum';
import { LoginModal } from './components/LoginModal';
import { ExcelManagerModal } from './components/ExcelManagerModal';
import { Radio, CheckCircle, X } from 'lucide-react';

import {
  RevenueCategory,
  DetailedTaxData,
  MarketContract,
  MarketSummary,
  DailyRecord,
  UserSession,
  TaxpayerRecord,
  OldTaxDebtorRecord,
} from './types/revenue';

import {
  loadStoredCategories,
  saveStoredCategories,
  loadStoredLandTax,
  saveStoredLandTax,
  loadStoredSignTax,
  saveStoredSignTax,
  loadStoredTaxpayers,
  saveStoredTaxpayers,
  loadStoredOldTaxDebtors,
  saveStoredOldTaxDebtors,
  loadStoredMarketSummaries,
  saveStoredMarketSummaries,
  loadStoredMarketContracts,
  saveStoredMarketContracts,
  loadStoredDailyRecords,
  saveStoredDailyRecords,
  loadStoredSession,
  saveStoredSession,
  resetToDefaultData,
  subscribeToDatabaseSync,
  subscribeToMultiDeviceSync,
  subscribeToFirestoreSync,
  fetchInitialServerDatabase,
} from './utils/storage';
import { bootstrapFirestoreDatabase } from './utils/firebaseDatabase';


export default function App() {
  // Navigation State
  const [currentTab, setCurrentTab] = useState<string>('overview');

  // Core Data States
  const [categories, setCategories] = useState<RevenueCategory[]>(loadStoredCategories);
  const [landTax, setLandTax] = useState<DetailedTaxData>(loadStoredLandTax);
  const [signTax, setSignTax] = useState<DetailedTaxData>(loadStoredSignTax);
  const [taxpayers, setTaxpayers] = useState<TaxpayerRecord[]>(loadStoredTaxpayers);
  const [oldTaxDebtors, setOldTaxDebtors] = useState<OldTaxDebtorRecord[]>(loadStoredOldTaxDebtors);
  const [marketSummaries, setMarketSummaries] = useState<Record<'night_market' | 'fresh_market', MarketSummary>>(
    loadStoredMarketSummaries
  );
  const [marketContracts, setMarketContracts] = useState<MarketContract[]>(loadStoredMarketContracts);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>(loadStoredDailyRecords);

  // Authentication State: Loaded from tab session storage
  const [session, setSession] = useState<UserSession | null>(loadStoredSession);

  // Modals & Notifications
  const [isExcelModalOpen, setIsExcelModalOpen] = useState<boolean>(false);
  const [syncNotification, setSyncNotification] = useState<string | null>(null);

  // Ref to suppress re-broadcasting when receiving remote updates
  const isSyncingFromRemoteRef = useRef<boolean>(false);
  // Guard to prevent initial mount from overwriting central server database with client defaults
  const hasLoadedInitialServerDataRef = useRef<boolean>(false);

  // Initial load from central database and automatic Firebase Firestore bootstrap
  useEffect(() => {
    // 1. Fetch initial server database cache
    fetchInitialServerDatabase()
      .then((serverData) => {
        if (serverData) {
          isSyncingFromRemoteRef.current = true;
          if (serverData.categories) setCategories(serverData.categories);
          if (serverData.landTax) setLandTax(serverData.landTax);
          if (serverData.signTax) setSignTax(serverData.signTax);
          if (serverData.taxpayers) setTaxpayers(serverData.taxpayers);
          if (serverData.oldTaxDebtors) setOldTaxDebtors(serverData.oldTaxDebtors);
          if (serverData.marketSummaries) setMarketSummaries(serverData.marketSummaries);
          if (serverData.marketContracts) setMarketContracts(serverData.marketContracts);
          if (serverData.dailyRecords) setDailyRecords(serverData.dailyRecords);
        }
      })
      .catch((err) => {
        console.warn('Initial server database fetch completed with fallback:', err);
      })
      .finally(() => {
        hasLoadedInitialServerDataRef.current = true;
        setTimeout(() => {
          isSyncingFromRemoteRef.current = false;
        }, 150);
      });

    // 2. Automatically verify, create, and bootstrap Firebase Firestore (databaserevenuecollection)
    bootstrapFirestoreDatabase()
      .then((fbRes) => {
        if (fbRes.success) {
          if (fbRes.isNewlyCreated) {
            setSyncNotification('เชื่อมต่อ Firebase และสร้างฐานข้อมูล databaserevenuecollection สำหรับจัดเก็บข้อมูลอัตโนมัติแล้ว');
          }
          // If serverData was not present, hydrate from cloud Firestore
          if (fbRes.data && !hasLoadedInitialServerDataRef.current) {
            isSyncingFromRemoteRef.current = true;
            if (fbRes.data.categories) setCategories(fbRes.data.categories);
            if (fbRes.data.landTax) setLandTax(fbRes.data.landTax);
            if (fbRes.data.signTax) setSignTax(fbRes.data.signTax);
            if (fbRes.data.taxpayers) setTaxpayers(fbRes.data.taxpayers);
            if (fbRes.data.oldTaxDebtors) setOldTaxDebtors(fbRes.data.oldTaxDebtors);
            if (fbRes.data.marketSummaries) setMarketSummaries(fbRes.data.marketSummaries);
            if (fbRes.data.marketContracts) setMarketContracts(fbRes.data.marketContracts);
            if (fbRes.data.dailyRecords) setDailyRecords(fbRes.data.dailyRecords);
            hasLoadedInitialServerDataRef.current = true;
            setTimeout(() => {
              isSyncingFromRemoteRef.current = false;
            }, 150);
          }
        }
      })
      .catch((fbErr) => {
        console.warn('Firebase bootstrap initial check note:', fbErr);
      });
  }, []);


  // Multi-device real-time Server-Sent Events subscription (cross-machine live sync)
  useEffect(() => {
    const unsubscribeServer = subscribeToMultiDeviceSync((payload) => {
      isSyncingFromRemoteRef.current = true;
      const timeStr = new Date().toLocaleTimeString('th-TH');

      switch (payload.key) {
        case 'categories':
          setCategories(payload.data);
          setSyncNotification(`ข้อมูล 8 หมวดรายได้ ได้รับการซิงค์จากเครื่องอื่นแล้ว (${timeStr})`);
          break;
        case 'landTax':
          setLandTax(payload.data);
          setSyncNotification(`ข้อมูลภาษีที่ดิน ได้รับการซิงค์จากเครื่องอื่นแล้ว (${timeStr})`);
          break;
        case 'signTax':
          setSignTax(payload.data);
          setSyncNotification(`ข้อมูลภาษีป้าย ได้รับการซิงค์จากเครื่องอื่นแล้ว (${timeStr})`);
          break;
        case 'taxpayers':
          setTaxpayers(payload.data);
          setSyncNotification(`ข้อมูลผู้เสียภาษี/ลูกหนี้ ได้รับการซิงค์จากเครื่องอื่นแล้ว (${timeStr})`);
          break;
        case 'oldTaxDebtors':
          setOldTaxDebtors(payload.data);
          setSyncNotification(`ข้อมูลลูกหนี้ภาษีเก่า ได้รับการซิงค์จากเครื่องอื่นแล้ว (${timeStr})`);
          break;
        case 'marketSummaries':
          setMarketSummaries(payload.data);
          break;
        case 'marketContracts':
          setMarketContracts(payload.data);
          break;
        case 'dailyRecords':
          setDailyRecords(payload.data);
          setSyncNotification(`ข้อมูลการรับเงินประจำวัน ได้รับการซิงค์จากเครื่องอื่นแล้ว (${timeStr})`);
          break;
        case 'ALL_DATA_RESET':
          if (payload.data) {
            setCategories(payload.data.categories);
            setLandTax(payload.data.landTax);
            setSignTax(payload.data.signTax);
            setTaxpayers(payload.data.taxpayers);
            setOldTaxDebtors(payload.data.oldTaxDebtors);
            setMarketSummaries(payload.data.marketSummaries);
            setMarketContracts(payload.data.marketContracts);
            setDailyRecords(payload.data.dailyRecords);
          }
          setSyncNotification(`ฐานข้อมูลได้รับการรีเซ็ตแล้ว (${timeStr})`);
          break;
      }

      setTimeout(() => {
        isSyncingFromRemoteRef.current = false;
      }, 150);
    });

    return () => {
      unsubscribeServer();
    };
  }, []);

  // Firebase Cloud Firestore real-time listener (cross-device cloud sync)
  useEffect(() => {
    const unsubscribeFirestore = subscribeToFirestoreSync((key, data) => {
      isSyncingFromRemoteRef.current = true;
      const timeStr = new Date().toLocaleTimeString('th-TH');

      switch (key) {
        case 'categories':
          setCategories(data);
          setSyncNotification(`ข้อมูล 8 หมวดรายได้ ซิงค์จาก Firebase แล้ว (${timeStr})`);
          break;
        case 'landTax':
          setLandTax(data);
          setSyncNotification(`ข้อมูลภาษีที่ดิน ซิงค์จาก Firebase แล้ว (${timeStr})`);
          break;
        case 'signTax':
          setSignTax(data);
          setSyncNotification(`ข้อมูลภาษีป้าย ซิงค์จาก Firebase แล้ว (${timeStr})`);
          break;
        case 'taxpayers':
          setTaxpayers(data);
          setSyncNotification(`ข้อมูลผู้เสียภาษี ซิงค์จาก Firebase แล้ว (${timeStr})`);
          break;
        case 'oldTaxDebtors':
          setOldTaxDebtors(data);
          break;
        case 'dailyRecords':
          setDailyRecords(data);
          setSyncNotification(`บันทึกรายรับประจำวัน ซิงค์จาก Firebase แล้ว (${timeStr})`);
          break;
      }

      setTimeout(() => {
        isSyncingFromRemoteRef.current = false;
      }, 150);
    });

    return () => {
      unsubscribeFirestore();
    };
  }, []);

  // Cross-tab real-time database subscription (same device)
  useEffect(() => {
    const unsubscribe = subscribeToDatabaseSync((msg) => {
      isSyncingFromRemoteRef.current = true;
      const timeStr = new Date(msg.timestamp).toLocaleTimeString('th-TH');

      switch (msg.type) {
        case 'CATEGORIES_UPDATED':
          setCategories(loadStoredCategories());
          setSyncNotification(`ข้อมูล 8 หมวดรายได้ ได้รับการซิงค์อัตโนมัติแล้ว (${timeStr})`);
          break;
        case 'LAND_TAX_UPDATED':
          setLandTax(loadStoredLandTax());
          setSyncNotification(`ข้อมูลภาษีที่ดิน ได้รับการซิงค์อัตโนมัติแล้ว (${timeStr})`);
          break;
        case 'SIGN_TAX_UPDATED':
          setSignTax(loadStoredSignTax());
          setSyncNotification(`ข้อมูลภาษีป้าย ได้รับการซิงค์อัตโนมัติแล้ว (${timeStr})`);
          break;
        case 'TAXPAYERS_UPDATED':
          setTaxpayers(loadStoredTaxpayers());
          setSyncNotification(`ข้อมูลผู้เสียภาษี/ลูกหนี้ ได้รับการซิงค์อัตโนมัติแล้ว (${timeStr})`);
          break;
        case 'OLD_TAX_DEBTORS_UPDATED':
          setOldTaxDebtors(loadStoredOldTaxDebtors());
          setSyncNotification(`ข้อมูลลูกหนี้ภาษีเก่า ได้รับการซิงค์อัตโนมัติแล้ว (${timeStr})`);
          break;
        case 'MARKET_SUMMARIES_UPDATED':
          setMarketSummaries(loadStoredMarketSummaries());
          break;
        case 'MARKET_CONTRACTS_UPDATED':
          setMarketContracts(loadStoredMarketContracts());
          break;
        case 'DAILY_RECORDS_UPDATED':
          setDailyRecords(loadStoredDailyRecords());
          setSyncNotification(`ข้อมูลการรับเงินประจำวัน ได้รับการซิงค์อัตโนมัติแล้ว (${timeStr})`);
          break;
        case 'ALL_DATA_RESET':
          setCategories(loadStoredCategories());
          setLandTax(loadStoredLandTax());
          setSignTax(loadStoredSignTax());
          setTaxpayers(loadStoredTaxpayers());
          setOldTaxDebtors(loadStoredOldTaxDebtors());
          setMarketSummaries(loadStoredMarketSummaries());
          setMarketContracts(loadStoredMarketContracts());
          setDailyRecords(loadStoredDailyRecords());
          setSyncNotification(`ข้อมูลทั้งหมดได้รับการรีเซ็ตแล้ว (${timeStr})`);
          break;
      }

      setTimeout(() => {
        isSyncingFromRemoteRef.current = false;
      }, 100);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Dismiss notification toast after 4.5 seconds
  useEffect(() => {
    if (syncNotification) {
      const timer = setTimeout(() => {
        setSyncNotification(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [syncNotification]);

  // Persistence Effects (Only save to server & broadcast if loaded from server and not triggered by remote sync)
  useEffect(() => {
    if (!hasLoadedInitialServerDataRef.current || isSyncingFromRemoteRef.current) return;
    saveStoredCategories(categories, true);
  }, [categories]);

  useEffect(() => {
    if (!hasLoadedInitialServerDataRef.current || isSyncingFromRemoteRef.current) return;
    saveStoredLandTax(landTax, true);
  }, [landTax]);

  useEffect(() => {
    if (!hasLoadedInitialServerDataRef.current || isSyncingFromRemoteRef.current) return;
    saveStoredSignTax(signTax, true);
  }, [signTax]);

  useEffect(() => {
    if (!hasLoadedInitialServerDataRef.current || isSyncingFromRemoteRef.current) return;
    saveStoredTaxpayers(taxpayers, true);
  }, [taxpayers]);

  useEffect(() => {
    if (!hasLoadedInitialServerDataRef.current || isSyncingFromRemoteRef.current) return;
    saveStoredOldTaxDebtors(oldTaxDebtors, true);
  }, [oldTaxDebtors]);

  useEffect(() => {
    if (!hasLoadedInitialServerDataRef.current || isSyncingFromRemoteRef.current) return;
    saveStoredMarketSummaries(marketSummaries, true);
  }, [marketSummaries]);

  useEffect(() => {
    if (!hasLoadedInitialServerDataRef.current || isSyncingFromRemoteRef.current) return;
    saveStoredMarketContracts(marketContracts, true);
  }, [marketContracts]);

  useEffect(() => {
    if (!hasLoadedInitialServerDataRef.current || isSyncingFromRemoteRef.current) return;
    saveStoredDailyRecords(dailyRecords, true);
  }, [dailyRecords]);

  useEffect(() => {
    saveStoredSession(session);
  }, [session]);

  // Handlers for Categories
  const handleUpdateCategoryItem = (
    categoryId: string,
    itemId: string,
    estimate: number,
    actual: number
  ) => {
    const updated = categories.map((cat) => {
      if (cat.key !== categoryId) return cat;
      const updatedItems = cat.items.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          estimate,
          actual,
        };
      });
      return {
        ...cat,
        items: updatedItems,
      };
    });
    setCategories(updated);
  };

  // Handlers for Taxes
  const handleUpdateLandTax = (data: DetailedTaxData) => {
    setLandTax(data);
    // Also reflect into category item
    const taxCat = categories.find((c) => c.key === 'taxes');
    if (taxCat) {
      handleUpdateCategoryItem('taxes', 'tax-1', data.estimateAmount, data.collected.amount);
    }
  };

  const handleUpdateSignTax = (data: DetailedTaxData) => {
    setSignTax(data);
    // Also reflect into category item
    const taxCat = categories.find((c) => c.key === 'taxes');
    if (taxCat) {
      handleUpdateCategoryItem('taxes', 'tax-2', data.estimateAmount, data.collected.amount);
    }
  };

  // Handlers for Market Contracts
  const handleAddMarketContract = (contract: MarketContract) => {
    const updated = [contract, ...marketContracts];
    setMarketContracts(updated);
    // Update occupied count
    const occupied = updated.filter((c) => c.marketType === contract.marketType).length;
    setMarketSummaries((prev) => ({
      ...prev,
      [contract.marketType]: {
        ...prev[contract.marketType],
        occupiedStalls: occupied,
      },
    }));
  };

  const handleUpdateMarketContract = (contract: MarketContract) => {
    setMarketContracts((prev) =>
      prev.map((c) => (c.id === contract.id ? contract : c))
    );
  };

  const handleDeleteMarketContract = (contractId: string) => {
    const target = marketContracts.find((c) => c.id === contractId);
    const updated = marketContracts.filter((c) => c.id !== contractId);
    setMarketContracts(updated);
    if (target) {
      const occupied = updated.filter((c) => c.marketType === target.marketType).length;
      setMarketSummaries((prev) => ({
        ...prev,
        [target.marketType]: {
          ...prev[target.marketType],
          occupiedStalls: occupied,
        },
      }));
    }
  };

  // Handlers for Daily Records
  const handleAddDailyRecord = (record: DailyRecord) => {
    setDailyRecords((prev) => [record, ...prev]);

    // Automatically accumulate into category item actual amount
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.key !== record.categoryId) return cat;
        return {
          ...cat,
          items: cat.items.map((item) => {
            if (item.id !== record.itemId) return item;
            return {
              ...item,
              actual: (item.actual || 0) + record.amount,
            };
          }),
        };
      })
    );
  };

  const handleUpdateDailyRecord = (record: DailyRecord) => {
    setDailyRecords((prev) =>
      prev.map((r) => (r.id === record.id ? record : r))
    );
  };

  const handleDeleteDailyRecord = (id: string) => {
    setDailyRecords((prev) => prev.filter((r) => r.id !== id));
  };

  // Sync Daily Records sum to Categories actuals
  const handleSyncDailyToCategories = () => {
    const sumMap: Record<string, number> = {};
    dailyRecords.forEach((rec) => {
      sumMap[rec.itemId] = (sumMap[rec.itemId] || 0) + rec.amount;
    });

    let syncCount = 0;
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        items: cat.items.map((item) => {
          if (sumMap[item.id] !== undefined) {
            syncCount++;
            return {
              ...item,
              actual: (item.actual || 0) + sumMap[item.id],
            };
          }
          return item;
        }),
      }))
    );

    alert(`ปรับปรุงยอดรับจริงเข้าหมวดงบประมาณเรียบร้อยแล้ว (${syncCount} รายการที่มีการรับเงินประจำวัน)`);
  };

  // Excel Import Handlers
  const handleImportDailyRecords = (records: DailyRecord[], mode: 'append' | 'replace') => {
    if (mode === 'append') {
      setDailyRecords((prev) => [...records, ...prev]);
    } else {
      setDailyRecords(records);
    }
  };

  const handleImportTaxpayers = (
    records: TaxpayerRecord[],
    mode: 'append' | 'replace',
    targetSubtype?: 'land' | 'sign' | 'both'
  ) => {
    const isOnlyLand = targetSubtype === 'land' || (records.length > 0 && records.every((t) => t.taxType === 'land'));
    const isOnlySign = targetSubtype === 'sign' || (records.length > 0 && records.every((t) => t.taxType === 'sign'));

    let nextList: TaxpayerRecord[];
    if (mode === 'append') {
      nextList = [...taxpayers, ...records];
    } else {
      if (isOnlyLand) {
        nextList = [...taxpayers.filter((t) => t.taxType !== 'land'), ...records];
      } else if (isOnlySign) {
        nextList = [...taxpayers.filter((t) => t.taxType !== 'sign'), ...records];
      } else {
        nextList = records;
      }
    }
    setTaxpayers(nextList);

    // Update landTax and signTax numbers
    const landList = nextList.filter((t) => t.taxType === 'land');
    const signList = nextList.filter((t) => t.taxType === 'sign');

    const landPaid = landList.reduce(
      (s, t) => s + (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0) + (t.penaltyAmount || 0) + (t.surchargeAmount || 0),
      0
    );
    const landPaidCount = landList.filter(
      (t) => (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0) + (t.penaltyAmount || 0) + (t.surchargeAmount || 0) > 0
    ).length;
    const landDebtors = landList.filter(
      (t) => ((t.remainingBalance || 0) + ((t.oldDebtAmount || 0) - (t.oldDebtPaid || 0))) > 0 && !t.isPendingVerification
    );
    const landDebtorsAmount = landList.reduce(
      (s, t) => s + (t.remainingBalance || 0) + Math.max(0, (t.oldDebtAmount || 0) - (t.oldDebtPaid || 0)),
      0
    );
    const landPending = landList.filter((t) => t.isPendingVerification);

    setLandTax((prev) => ({
      ...prev,
      collected: { count: landPaidCount, amount: landPaid },
      taxpayers: { count: landList.length, amount: landList.reduce((s, t) => s + t.afterReliefAmount, 0) },
      debtors: { count: landDebtors.length, amount: landDebtorsAmount },
      pendingVerification: { count: landPending.length, amount: landPending.reduce((s, t) => s + t.remainingBalance, 0) },
      updatedAt: new Date().toISOString().slice(0, 10),
    }));

    handleUpdateCategoryItem('taxes', 'tax-1', landTax.estimateAmount, landPaid);

    const signPaid = signList.reduce(
      (s, t) => s + (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0) + (t.penaltyAmount || 0) + (t.surchargeAmount || 0),
      0
    );
    const signPaidCount = signList.filter(
      (t) => (t.payment1 || 0) + (t.payment2 || 0) + (t.payment3 || 0) + (t.penaltyAmount || 0) + (t.surchargeAmount || 0) > 0
    ).length;
    const signDebtors = signList.filter(
      (t) => ((t.remainingBalance || 0) + ((t.oldDebtAmount || 0) - (t.oldDebtPaid || 0))) > 0 && !t.isPendingVerification
    );
    const signDebtorsAmount = signList.reduce(
      (s, t) => s + (t.remainingBalance || 0) + Math.max(0, (t.oldDebtAmount || 0) - (t.oldDebtPaid || 0)),
      0
    );
    const signPending = signList.filter((t) => t.isPendingVerification);

    setSignTax((prev) => ({
      ...prev,
      collected: { count: signPaidCount, amount: signPaid },
      taxpayers: { count: signList.length, amount: signList.reduce((s, t) => s + t.afterReliefAmount, 0) },
      debtors: { count: signDebtors.length, amount: signDebtorsAmount },
      pendingVerification: { count: signPending.length, amount: signPending.reduce((s, t) => s + t.remainingBalance, 0) },
      updatedAt: new Date().toISOString().slice(0, 10),
    }));

    handleUpdateCategoryItem('taxes', 'tax-2', signTax.estimateAmount, signPaid);
  };

  const handleImportMarketContracts = (contracts: MarketContract[], mode: 'append' | 'replace') => {
    let nextList: MarketContract[];
    if (mode === 'append') {
      nextList = [...marketContracts, ...contracts];
    } else {
      nextList = contracts;
    }
    setMarketContracts(nextList);

    const nmCount = nextList.filter((c) => c.marketType === 'night_market').length;
    const fmCount = nextList.filter((c) => c.marketType === 'fresh_market').length;

    setMarketSummaries((prev) => ({
      ...prev,
      night_market: {
        ...prev.night_market,
        totalStalls: Math.max(prev.night_market.totalStalls, nmCount),
        occupiedStalls: nmCount,
      },
      fresh_market: {
        ...prev.fresh_market,
        totalStalls: Math.max(prev.fresh_market.totalStalls, fmCount),
        occupiedStalls: fmCount,
      },
    }));
  };

  const handleImportBudgetUpdates = (
    updates: { id?: string; name?: string; estimate?: number; actual?: number }[]
  ) => {
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        items: cat.items.map((item) => {
          const match = updates.find(
            (u) =>
              (u.id && u.id === item.id) ||
              (u.name && u.name.trim().toLowerCase() === item.name.trim().toLowerCase())
          );
          if (match) {
            return {
              ...item,
              estimate: match.estimate !== undefined ? match.estimate : item.estimate,
              actual: match.actual !== undefined ? match.actual : item.actual,
            };
          }
          return item;
        }),
      }))
    );
  };

  // Reset to initial factory data
  const handleResetData = () => {
    if (
      confirm(
        'ต้องการรีเซ็ตข้อมูลทั้งหมดกลับสู่ค่าเริ่มต้นของเทศบาลเมืองมหาสารคาม ปีงบประมาณ 2570 หรือไม่?'
      )
    ) {
      resetToDefaultData();
      window.location.reload();
    }
  };

  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    saveStoredSession(newSession);
  };

  const handleSwitchRole = (newRole: 'User' | 'Director' | 'Executive') => {
    const ROLE_MAP: Record<'User' | 'Director' | 'Executive', UserSession> = {
      User: {
        username: 'User',
        role: 'User',
        roleTitle: 'เจ้าหน้าที่ฝ่ายพัฒนารายได้',
        department: 'ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม',
        permissions: {
          canEdit: true,
          canDelete: true,
          canAddDaily: true,
          canImportExport: true,
          canReview: true,
          canApprove: false,
        },
      },
      Director: {
        username: 'Director',
        role: 'Director',
        roleTitle: 'ผู้อำนวยการกองคลัง',
        department: 'กองคลัง เทศบาลเมืองมหาสารคาม',
        permissions: {
          canEdit: false,
          canDelete: false,
          canAddDaily: false,
          canImportExport: true,
          canReview: true,
          canApprove: false,
        },
      },
      Executive: {
        username: 'ผู้บริหาร',
        role: 'Executive',
        roleTitle: 'ผู้บริหาร / นายกเทศมนตรีเมืองมหาสารคาม',
        department: 'สำนักงานเทศบาลเมืองมหาสารคาม',
        permissions: {
          canEdit: false,
          canDelete: false,
          canAddDaily: false,
          canImportExport: true,
          canReview: true,
          canApprove: true,
        },
      },
    };

    const targetSession = ROLE_MAP[newRole];
    setSession(targetSession);
    saveStoredSession(targetSession);
  };

  const handleLogout = () => {
    setSession(null);
    saveStoredSession(null);
  };

  // If not authenticated, require login first!
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-between font-sans">
        <LoginModal
          isOpen={true}
          onLoginSuccess={handleLoginSuccess}
          isGate={true}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans relative">
      {/* Real-time synchronization toast */}
      {syncNotification && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-3 duration-200">
          <div className="bg-slate-900/95 backdrop-blur-md text-white border border-emerald-500/50 shadow-2xl rounded-2xl p-3 sm:px-4 sm:py-3 flex items-center space-x-3 text-xs sm:text-sm">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
            <div className="flex-1 font-medium pr-2">
              <span className="text-emerald-400 font-bold block text-[10px] uppercase tracking-wide">
                ซิงค์ฐานข้อมูลอัตโนมัติ (Live Sync)
              </span>
              <span>{syncNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncNotification(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              title="ปิดการแจ้งเตือน"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        session={session}
        onLogout={handleLogout}
        onOpenExcel={() => setIsExcelModalOpen(true)}
        onResetData={handleResetData}
        onSwitchRole={handleSwitchRole}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {currentTab === 'overview' && (
          <OverviewDashboard
            categories={categories}
            landTax={landTax}
            signTax={signTax}
            marketSummaries={marketSummaries}
            taxpayers={taxpayers}
            onNavigateTab={setCurrentTab}
            onOpenExcel={() => setIsExcelModalOpen(true)}
          />
        )}

        {currentTab === 'categories' && (
          <RevenueCategoriesTable
            categories={categories}
            onUpdateCategoryItem={handleUpdateCategoryItem}
            session={session}
          />
        )}

        {currentTab === 'taxes' && (
          <PropertyTaxSection
            landTax={landTax}
            signTax={signTax}
            onUpdateLandTax={handleUpdateLandTax}
            onUpdateSignTax={handleUpdateSignTax}
            taxpayers={taxpayers}
            onUpdateTaxpayers={setTaxpayers}
            oldTaxDebtors={oldTaxDebtors}
            onUpdateOldTaxDebtors={setOldTaxDebtors}
            session={session}
          />
        )}

        {currentTab === 'memorandum' && (
          <OfficialMemorandum
            categories={categories}
            landTax={landTax}
            signTax={signTax}
            marketSummaries={marketSummaries}
            marketContracts={marketContracts}
            taxpayers={taxpayers}
            session={session}
          />
        )}
      </main>

      {/* Footer (Hidden when printing) */}
      <footer className="no-print bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p className="font-semibold text-slate-700">
            ระบบรายงานผลการดำเนินงาน ฝ่ายพัฒนารายได้ กองคลัง เทศบาลเมืองมหาสารคาม
          </p>
          <p>
            ประจำปีงบประมาณ พ.ศ. 2570 | รองรับการดาวน์โหลดและนำเข้า Excel (.xlsx) และบันทึกข้อความราชการมาตรฐาน
          </p>
        </div>
      </footer>

      {/* Excel Manager Modal */}
      <ExcelManagerModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        categories={categories}
        landTax={landTax}
        signTax={signTax}
        marketContracts={marketContracts}
        marketSummaries={marketSummaries}
        taxpayers={taxpayers}
        dailyRecords={dailyRecords}
        onImportDailyRecords={handleImportDailyRecords}
        onImportBudgetUpdates={handleImportBudgetUpdates}
        onImportTaxpayers={handleImportTaxpayers}
        onImportMarketContracts={handleImportMarketContracts}
        session={session}
      />
    </div>
  );
}
