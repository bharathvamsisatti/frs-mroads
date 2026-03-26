import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Activity, Play, Pause, Filter, X, Eye, Camera, CheckCircle, XCircle, Clock, AlertTriangle, Calendar, Users, User } from "lucide-react";
import { LiveCamera, LiveCameraRef } from "../LiveCamera";
import { MultiCameraManager } from "../LiveCamera/MultiCameraManager";
import { CameraGridView } from "../LiveCamera/CameraGridView";
import ErrorBoundary from "../LiveCamera/ErrorBoundary";
import { getTransactions, createTransaction, Transaction, CreateTransactionRequest } from "../../services/api";
import { CAMERAS, getCameraDisplayName } from "../../config/cameras";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Helper function to format timestamp
function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch {
    return timestamp;
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-5 w-5 text-meta-3" />;
    case 'failure':
      return <XCircle className="h-5 w-5 text-meta-1" />;
    case 'in-progress':
      return <Clock className="h-5 w-5 text-primary" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-meta-6" />;
    default:
      return null;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'success':
      return (
        <span className="inline-flex rounded-full bg-meta-3 bg-opacity-10 px-3 py-1 text-sm font-medium text-meta-3">
          Success
        </span>
      );
    case 'failure':
      return (
        <span className="inline-flex rounded-full bg-meta-1 bg-opacity-10 px-3 py-1 text-sm font-medium text-meta-1">
          Failure
        </span>
      );
    case 'in-progress':
      return (
        <span className="inline-flex rounded-full bg-primary bg-opacity-10 px-3 py-1 text-sm font-medium text-primary">
          In Progress
        </span>
      );
    case 'warning':
      return (
        <span className="inline-flex rounded-full bg-meta-6 bg-opacity-10 px-3 py-1 text-sm font-medium text-meta-6">
          Warning
        </span>
      );
    default:
      return <span className="text-sm text-body">Unknown</span>;
  }
}

export function LiveTransactions() {
  const cameraRef = useRef<LiveCameraRef>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLiveActive, setIsLiveActive] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cameraFilter, setCameraFilter] = useState<string>("all");
  // Default to first enabled local camera (laptop-camera) so stream shows immediately
  const [selectedCamera, setSelectedCamera] = useState<string>(() => {
    const firstLocalCamera = CAMERAS.find(c => c.enabled && c.type === 'local');
    return firstLocalCamera?.id || CAMERAS.find(c => c.enabled)?.id || "all";
  });
  const [matchingModeFilter, setMatchingModeFilter] = useState<string>("all");
  const [dateFromFilter, setDateFromFilter] = useState<string>("");
  const [dateToFilter, setDateToFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const sanitizeTransaction = (txn) => {
    const cameraNameMap = {
      'laptop-camera': 'Camera 1',
      'reception-area': 'Camera 2',
      'workstation-exit': 'Camera 3',
      'Camera-001': 'Camera 1',
      'Main Camera': 'Camera 1',
      'Reception Area (Camera 1)': 'Camera 2',
      'Workstation Exit (Camera 2)': 'Camera 3',
    };

    const sanitizedCameraName = cameraNameMap[txn.cameraId || txn.cameraName || ''] || txn.cameraName || 'Unknown Camera';

    return {
      ...txn,
      cameraName: sanitizedCameraName,
      confidence: Math.min(Math.max(txn.confidence || 0, 0), 100), // Clamp confidence between 0 and 100
      timestamp: txn.timestamp || new Date().toISOString(), // Ensure timestamp exists
    };
  };

  // Fetch transactions from API (poll only while live view is active)
  useEffect(() => {
    if (!isLiveActive) {
      return;
    }

    const fetchTransactions = async (initialLoad = false) => {
      try {
        if (initialLoad) {
          setLoading(true);
        }
        
        const response = await getTransactions(100, 0);
        
        if (response && response.transactions) {
          setTransactions((prev) => {
            // Only update if there are actual changes to prevent unnecessary re-renders
            const newTransactions = response.transactions.map(sanitizeTransaction);
            
            // If no previous transactions, just return the new ones
            if (prev.length === 0) return newTransactions;
            
            // Check if there are any new or updated transactions
            const hasChanges = newTransactions.some(newTxn => {
              const existingTxn = prev.find(t => t.id === newTxn.id);
              return !existingTxn || 
                     existingTxn.status !== newTxn.status || 
                     existingTxn.confidence !== newTxn.confidence;
            });
            
            // Only update if there are actual changes
            if (hasChanges) {
              const transactionMap = new Map(prev.map(txn => [txn.id, txn]));
              newTransactions.forEach(txn => {
                transactionMap.set(txn.id, txn);
              });
              return Array.from(transactionMap.values());
            }
            
            return prev; // No changes, return previous state to prevent re-render
          });
        } else if (response && response.error) {
          console.error("Transactions API error:", response.error);
          if (transactions.length === 0) {
            console.warn("No transactions found. Error:", response.error);
          }
        }
      } catch (error) {
        console.error("Error fetching transactions:", error);
        if (transactions.length === 0) {
          console.error("Failed to fetch transactions:", error);
        }
      } finally {
        if (initialLoad) {
          setLoading(false);
        }
      }
    };

    // Initial load
    fetchTransactions(true);

    // Refresh transactions every 10 seconds while live
    const interval = setInterval(() => fetchTransactions(false), 10000);
    return () => clearInterval(interval);
  }, [isLiveActive]);

  // Handle recognition results from LiveCamera
  const handleMatchResult = useCallback(async (result: { matched: boolean; confidence?: number; identity?: string; person?: any }) => {
    try {
      if (!result.matched || !result.person) {
        return;
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");

      const transactionId = `TXN-${year}-${month}${day}${hours}${minutes}${seconds}`;
      const timestamp = now.toISOString();
      
      // Map camera ID to standardized name
      const cameraNameMap: { [key: string]: string } = {
        'laptop-camera': 'Camera 1',
        'reception-area': 'Camera 2',
        'workstation-exit': 'Camera 3',
      };
      const cameraName = cameraNameMap[selectedCamera || 'laptop-camera'] || 'Camera 1';

      const confidenceScore = (result.confidence ?? 0.95) * 100;

      const payload: CreateTransactionRequest = {
        transaction_id: transactionId,
        person_id: result.person.id,
        user_name: result.person.name,
        camera_id: cameraName,
        camera_name: cameraName,
        timestamp,
        status: "success",
        confidence: confidenceScore,
        matching_mode: "1:N",
        registered_photo_url: result.person.image_url || "",
        processing_time: 0,
      };

      // Save to backend
      const response = await createTransaction(payload);
      
      if (!response || response.error) {
        console.error('Failed to save transaction:', response?.error);
        return;
      }

      // Get the complete transaction from the response if available
      const savedTransaction = response.transaction || response;

      // Update UI with the new transaction
      setTransactions(prev => {
        // Check if transaction already exists to avoid duplicates
        const exists = prev.some(t => t.id === savedTransaction.id);
        if (exists) return prev;
        
        // Add new transaction to the beginning of the list
        return [sanitizeTransaction(savedTransaction), ...prev];
      });

      // Optimistically update UI
      const newTxn: Transaction = {
        id: transactionId,
        person_id: result.person.id,
        userName: result.person.name,
        cameraId: cameraName,
        cameraName,
        timestamp,
        status: "success",
        confidence: confidenceScore,
        matchingMode: "1:N",
        registeredPhotoUrl: result.person.image_url || "",
        processingTime: 0,
      };

      setTransactions((prev) => [newTxn, ...prev]);
      setSelectedTransaction(newTxn);
    } catch (error) {
      console.error("Error creating transaction from recognition result:", error);
    }
  }, [selectedCamera]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(txn => {
      const matchesStatus = statusFilter === "all" || txn.status === statusFilter;
      const cameraId = txn.cameraId || txn.cameraName || "";
      const matchesCamera = cameraFilter === "all" || cameraId === cameraFilter;
      const matchesMatchingMode = matchingModeFilter === "all" || txn.matchingMode === matchingModeFilter;
      
      // Date filtering
      let matchesDateFrom = true;
      let matchesDateTo = true;
      
      if (dateFromFilter) {
        const txnDate = new Date(txn.timestamp);
        const filterDate = new Date(dateFromFilter);
        matchesDateFrom = txnDate >= filterDate;
      }
      
      if (dateToFilter) {
        const txnDate = new Date(txn.timestamp);
        const filterDate = new Date(dateToFilter);
        // Set to end of day for "to" filter
        filterDate.setHours(23, 59, 59, 999);
        matchesDateTo = txnDate <= filterDate;
      }
      
      return matchesStatus && matchesCamera && matchesMatchingMode && matchesDateFrom && matchesDateTo;
    });
  }, [transactions, statusFilter, cameraFilter, matchingModeFilter, dateFromFilter, dateToFilter]);

  // Get unique camera IDs/names for filter dropdown
  const uniqueCameras = Array.from(new Set(
    transactions
      .map(txn => txn.cameraName || txn.cameraId || "")
      .filter(c => c !== "")
  )).sort();

  const hasActiveFilters = statusFilter !== "all" || cameraFilter !== "all" || selectedCamera !== "all" || matchingModeFilter !== "all" || dateFromFilter !== "" || dateToFilter !== "";

  const clearFilters = () => {
    setStatusFilter("all");
    setCameraFilter("all");
    setSelectedCamera("all");
    setMatchingModeFilter("all");
    setDateFromFilter("");
    setDateToFilter("");
  };

  const toggleCamera = () => {
    if (isCameraActive) {
      cameraRef.current?.stopCamera();
      setIsCameraActive(false);
      setIsLiveActive(false);
    } else {
      cameraRef.current?.startCamera();
      setIsCameraActive(true);
      setIsLiveActive(true);
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, placeholder: string) => {
    const target = e.target as HTMLImageElement;
    target.src = placeholder;
  };

  const TransactionRow = React.memo(({ transaction, onClick }) => {
    return (
      <tr
        key={transaction.id}
        className="border-b border-stroke hover:bg-gray-2 dark:border-strokedark dark:hover:bg-meta-4 cursor-pointer"
        onClick={() => onClick(transaction)}
      >
        <td className="px-4 py-5">
          <p className="font-mono text-sm text-black dark:text-white">
            {transaction.id}
          </p>
        </td>
        <td className="px-4 py-5">
          <p className="text-sm text-black dark:text-white">
            {transaction.userName || transaction.person_id || "Unknown"}
          </p>
        </td>
        <td className="px-4 py-5">
          <p className="text-black dark:text-white">
            {transaction.cameraName}
          </p>
        </td>
        <td className="px-4 py-5">
          <div className="flex items-center gap-2">
            {transaction.matchingMode === '1:1' ? (
              <>
                <User className="h-4 w-4 text-primary" />
                <span className="inline-flex rounded-full border border-stroke bg-white px-2 py-1 text-xs font-medium text-black dark:border-strokedark dark:bg-meta-4 dark:text-white">
                  1:1
                </span>
              </>
            ) : (
              <>
                <Users className="h-4 w-4 text-meta-5" />
                <span className="inline-flex rounded-full border border-stroke bg-white px-2 py-1 text-xs font-medium text-black dark:border-strokedark dark:bg-meta-4 dark:text-white">
                  1:N
                </span>
              </>
            )}
          </div>
        </td>
        <td className="px-4 py-5">
          <p className="text-sm text-black dark:text-white">
            {formatTimestamp(transaction.timestamp)}
          </p>
        </td>
        <td className="px-4 py-5">
          <div className="flex items-center gap-2">
            {getStatusIcon(transaction.status)}
            {getStatusBadge(transaction.status)}
          </div>
        </td>
        <td className="px-4 py-5">
          {transaction.status === 'in-progress' ? (
            <span className="text-sm text-bodydark">Processing...</span>
          ) : (
            <span className={`text-sm font-medium ${
              transaction.confidence >= 90 ? 'text-meta-3' :
              transaction.confidence >= 80 ? 'text-meta-6' : 'text-meta-1'
            }`}>
              {transaction.confidence.toFixed(1)}%
            </span>
          )}
        </td>
        <td className="px-4 py-5">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClick(transaction);
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-center font-medium text-white hover:bg-opacity-90"
          >
            <Eye className="h-4 w-4" />
          </button>
        </td>
      </tr>
    );
  });

  return (
    <div className="space-y-6">
      {/* Live Camera Feed Section */}
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-4 py-4 dark:border-strokedark sm:px-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-black dark:text-white">
                Live Camera Feed
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Camera Selection Dropdown */}
              <select
                value={selectedCamera}
                onChange={(e) => {
                  const newCameraId = e.target.value;
                  setSelectedCamera(newCameraId);
                  setCameraFilter(newCameraId === "all" ? "all" : getCameraDisplayName(newCameraId));
                }}
                className="relative inline-flex appearance-none rounded border border-stroke bg-transparent px-4 py-2 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                title="Select camera to filter transactions"
              >
                <option value="all">All Cameras</option>
                {CAMERAS.filter(c => c.enabled).map(camera => (
                  <option key={camera.id} value={camera.id}>
                    {camera.name}
                  </option>
                ))}
              </select>
              <button
                onClick={toggleCamera}
                className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-center font-medium transition ${
                  isCameraActive
                    ? 'bg-primary text-white hover:bg-opacity-90'
                    : 'border border-stroke bg-gray text-body dark:border-strokedark dark:bg-meta-4 dark:text-bodydark'
                }`}
              >
                {isCameraActive ? (
                  <>
                    <Pause className="h-4 w-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Resume
                  </>
                )}
              </button>
              {isCameraActive && (
                <div className="flex items-center gap-2 text-sm text-bodydark">
                  <div className="w-2 h-2 bg-meta-3 rounded-full animate-pulse"></div>
                  LIVE
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <ErrorBoundary>
            <CameraGridView
              mode="recognize"
              autoStart={isCameraActive}
              isPaused={!isCameraActive}
              onMatchResult={handleMatchResult}
            />
          </ErrorBoundary>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transactions Table */}
        <div className="lg:col-span-2 rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark flex flex-col h-full">
          <div className="border-b border-stroke px-4 py-6 dark:border-strokedark sm:px-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h3 className="flex items-center gap-2 text-xl font-semibold text-black dark:text-white">
                <Activity className="h-5 w-5 text-primary" />
                Live Transactions
              </h3>
              {isLiveActive && (
                <div className="flex items-center gap-2 text-sm text-bodydark">
                  <div className="w-2 h-2 bg-meta-3 rounded-full animate-pulse"></div>
                  LIVE
                </div>
              )}
            </div>
          </div>

          <div className="px-4 py-6 sm:px-6 flex flex-col flex-1 min-h-0">
            {/* Filters Section */}
            <div className="mb-6 space-y-4 flex-shrink-0">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="h-4 w-4 text-bodydark2" />
                <span className="text-sm font-medium text-black dark:text-white">Filters:</span>
              </div>

              {/* First Row - Dropdowns */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="relative inline-flex appearance-none rounded border border-stroke bg-transparent px-5 py-2 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                  <option value="in-progress">In Progress</option>
                  <option value="warning">Warning</option>
                </select>

                <select
                  value={selectedCamera}
                  onChange={(e) => {
                    setSelectedCamera(e.target.value);
                    setCameraFilter(e.target.value === "all" ? "all" : getCameraDisplayName(e.target.value));
                  }}
                  className="relative inline-flex appearance-none rounded border border-stroke bg-transparent px-5 py-2 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  title="Select camera to view live feed and filter transactions"
                >
                  <option value="all">All Cameras</option>
                  {CAMERAS.map(camera => (
                    <option key={camera.id} value={camera.id}>
                      {camera.name}
                    </option>
                  ))}
                </select>

                <select
                  value={cameraFilter}
                  onChange={(e) => setCameraFilter(e.target.value)}
                  className="relative inline-flex appearance-none rounded border border-stroke bg-transparent px-5 py-2 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                >
                  <option value="all">All Cameras (Legacy)</option>
                  {uniqueCameras.map(camera => (
                    <option key={camera} value={camera}>
                      {camera}
                    </option>
                  ))}
                </select>

                <select
                  value={matchingModeFilter}
                  onChange={(e) => setMatchingModeFilter(e.target.value)}
                  className="relative inline-flex appearance-none rounded border border-stroke bg-transparent px-5 py-2 outline-none transition focus:border-primary active:border-primary dark:border-strokedark dark:bg-form-input dark:text-white"
                >
                  <option value="all">All Modes</option>
                  <option value="1:1">1:1</option>
                  <option value="1:N">1:N</option>
                </select>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center justify-center gap-1 rounded-md border border-stroke bg-gray px-3 py-2 text-center font-medium text-body transition hover:shadow-1 dark:border-strokedark dark:bg-meta-4 dark:text-bodydark"
                  >
                    <X className="h-4 w-4" />
                    Clear All
                  </button>
                )}
              </div>

              {/* Second Row - Date Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="date-from-filter" className="text-xs text-bodydark2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    From Date
                  </label>
                  <input
                    id="date-from-filter"
                    type="datetime-local"
                    value={dateFromFilter}
                    onChange={(e) => setDateFromFilter(e.target.value)}
                    className="relative z-20 w-full appearance-none rounded border border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="date-to-filter" className="text-xs text-bodydark2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    To Date
                  </label>
                  <input
                    id="date-to-filter"
                    type="datetime-local"
                    value={dateToFilter}
                    onChange={(e) => setDateToFilter(e.target.value)}
                    className="relative z-20 w-full appearance-none rounded border border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex items-center gap-2 text-sm text-bodydark pt-1">
                  Showing {filteredTransactions.length} of {transactions.length} transactions
                </div>
              )}
            </div>

            <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
              <table className="w-full table-auto">
                <thead>
                  <tr className="border-b border-stroke bg-gray-2 dark:border-strokedark dark:bg-meta-4">
                    <th className="px-4 py-4 font-medium text-black dark:text-white">
                      Transaction ID
                    </th>
                    <th className="px-4 py-4 font-medium text-black dark:text-white">
                      User Name
                    </th>
                    <th className="px-4 py-4 font-medium text-black dark:text-white">
                      Camera
                    </th>
                    <th className="px-4 py-4 font-medium text-black dark:text-white">
                      Mode
                    </th>
                    <th className="px-4 py-4 font-medium text-black dark:text-white">
                      Timestamp
                    </th>
                    <th className="px-4 py-4 font-medium text-black dark:text-white">
                      Status
                    </th>
                    <th className="px-4 py-4 font-medium text-black dark:text-white">
                      Confidence
                    </th>
                    <th className="px-4 py-4 font-medium text-black dark:text-white">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="border-b border-stroke px-4 py-5 text-center text-bodydark dark:border-strokedark">
                        Loading transactions...
                      </td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="border-b border-stroke px-4 py-5 text-center text-bodydark dark:border-strokedark">
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((transaction) => (
                        <TransactionRow key={transaction.id} transaction={transaction} onClick={setSelectedTransaction} />
                      ))
                  )}
                </tbody>
              </table>
              
              {/* Pagination Controls */}
              {filteredTransactions.length > itemsPerPage && (
                <div className="flex items-center justify-between border-t border-stroke px-4 py-3 sm:px-6 dark:border-strokedark">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-md border border-stroke bg-white px-4 py-2 text-sm font-medium text-bodydark hover:bg-gray-50 dark:border-strokedark dark:bg-boxdark dark:text-white dark:hover:bg-meta-4 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredTransactions.length / itemsPerPage), p + 1))}
                      disabled={currentPage >= Math.ceil(filteredTransactions.length / itemsPerPage)}
                      className="relative ml-3 inline-flex items-center rounded-md border border-stroke bg-white px-4 py-2 text-sm font-medium text-bodydark hover:bg-gray-50 dark:border-strokedark dark:bg-boxdark dark:text-white dark:hover:bg-meta-4 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-bodydark dark:text-bodydark2">
                        Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                        <span className="font-medium">
                          {Math.min(currentPage * itemsPerPage, filteredTransactions.length)}
                        </span>{' '}
                        of <span className="font-medium">{filteredTransactions.length}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center rounded-l-md px-2 py-2 text-bodydark ring-1 ring-inset ring-stroke hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-strokedark dark:hover:bg-meta-4 disabled:opacity-50"
                        >
                          <span className="sr-only">Previous</span>
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                          </svg>
                        </button>
                        {Array.from({ length: Math.min(5, Math.ceil(filteredTransactions.length / itemsPerPage)) }, (_, i) => {
                          // Always show first page, last page, current page, and one page before/after current
                          if (
                            i === 0 || // First page
                            i === Math.ceil(filteredTransactions.length / itemsPerPage) - 1 || // Last page
                            (i >= currentPage - 2 && i <= currentPage) // Current page and one before/after
                          ) {
                            return (
                              <button
                                key={i}
                                onClick={() => setCurrentPage(i + 1)}
                                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                                  currentPage === i + 1
                                    ? 'z-10 bg-primary text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                                    : 'text-bodydark ring-1 ring-inset ring-stroke hover:bg-gray-50 focus:outline-offset-0 dark:ring-strokedark dark:hover:bg-meta-4'
                                }`}
                              >
                                {i + 1}
                              </button>
                            );
                          }
                          // Show ellipsis if needed
                          if (i === 1 && currentPage > 3) {
                            return <span key={i} className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-bodydark">...</span>;
                          }
                          if (i === Math.ceil(filteredTransactions.length / itemsPerPage) - 2 && currentPage < Math.ceil(filteredTransactions.length / itemsPerPage) - 2) {
                            return <span key={i} className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-bodydark">...</span>;
                          }
                          return null;
                        })}
                        <button
                          onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredTransactions.length / itemsPerPage), p + 1))}
                          disabled={currentPage >= Math.ceil(filteredTransactions.length / itemsPerPage)}
                          className="relative inline-flex items-center rounded-r-md px-2 py-2 text-bodydark ring-1 ring-inset ring-stroke hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-strokedark dark:hover:bg-meta-4 disabled:opacity-50"
                        >
                          <span className="sr-only">Next</span>
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transaction Detail Panel */}
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark flex flex-col h-full">
          <div className="border-b border-stroke px-4 py-6 dark:border-strokedark sm:px-6">
            <h3 className="flex items-center gap-2 text-xl font-semibold text-black dark:text-white">
              <Camera className="h-5 w-5 text-primary" />
              Transaction Details
            </h3>
          </div>

          <div className="px-4 py-6 sm:px-6 flex flex-col flex-1 min-h-0 overflow-y-auto">
            {selectedTransaction ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm text-bodydark2">Transaction ID</p>
                  <p className="font-mono text-sm font-medium text-black dark:text-white">
                    {selectedTransaction.id}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-bodydark2 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    User Name
                  </p>
                  <p className="font-medium text-black dark:text-white">
                    {selectedTransaction.userName || selectedTransaction.person_id || "Unknown"}
                  </p>
                </div>


                <div className="space-y-2">
                  <p className="text-sm text-bodydark2">Status</p>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedTransaction.status)}
                    {getStatusBadge(selectedTransaction.status)}
                  </div>
                </div>

                {selectedTransaction.status !== 'in-progress' && (
                  <>

                    {/* Images Section */}
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-bodydark2">Images</p>
                      
                      {/* Captured Photo (Snapshot) */}
                      <div className="space-y-2">
                        <p className="text-xs text-bodydark2">Snapshot (Captured Photo)</p>
                        <div className="flex justify-center">
                          {selectedTransaction.capturedPhotoUrl ? (
                            <div className="relative w-full max-w-xs rounded-lg overflow-hidden border-2 border-primary bg-gray-2 dark:bg-meta-4">
                              <img 
                                src={selectedTransaction.capturedPhotoUrl}
                                alt="Captured Snapshot"
                                className="w-full h-auto object-contain"
                                onError={(e) => handleImageError(e, 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect fill="%23ddd" width="300" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3ENo Image Available%3C/text%3E%3C/svg%3E')}
                              />
                            </div>
                          ) : (
                            <div className="w-full max-w-xs h-32 rounded-lg border-2 border-dashed border-stroke flex items-center justify-center bg-gray-2 dark:bg-meta-4">
                              <p className="text-xs text-bodydark2">No snapshot available</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Registered Photo (Enrolled Image) */}
                      <div className="space-y-2">
                        <p className="text-xs text-bodydark2">Enrolled Photo</p>
                        <div className="flex justify-center">
                          {selectedTransaction.registeredPhotoUrl ? (
                            <div className="relative w-full max-w-xs rounded-lg overflow-hidden border-2 border-meta-3 bg-gray-2 dark:bg-meta-4">
                              <img 
                                src={selectedTransaction.registeredPhotoUrl.startsWith('http') 
                                  ? selectedTransaction.registeredPhotoUrl 
                                  : `${API_BASE_URL}${selectedTransaction.registeredPhotoUrl}`} 
                                alt="Enrolled Photo" 
                                className="w-full h-auto object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect fill="%23ddd" width="300" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3ENo Image Available%3C/text%3E%3C/svg%3E';
                                }}
                              />
                            </div>
                          ) : (
                            <div className="w-full max-w-xs h-32 rounded-lg border-2 border-dashed border-stroke flex items-center justify-center bg-gray-2 dark:bg-meta-4">
                              <p className="text-xs text-bodydark2">No enrolled image available</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Attendance Information */}
                    {selectedTransaction.status === 'success' && (
                      <div className="space-y-2 p-4 rounded-lg bg-meta-3 bg-opacity-10 border border-meta-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-meta-3" />
                          <p className="text-sm font-medium text-black dark:text-white">Attendance Recorded</p>
                        </div>
                        <p className="text-xs text-bodydark2 ml-7">
                          This transaction represents an attendance entry for {selectedTransaction.userName || selectedTransaction.person_id || "Unknown"} 
                          at {formatTimestamp(selectedTransaction.timestamp)}
                        </p>
                      </div>
                    )}
                  </>
                )}


                <div className="space-y-2">
                  <p className="text-sm text-bodydark2 flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Camera
                  </p>
                  <p className="font-medium text-black dark:text-white">
                    {(() => {
                      // Standardize camera names to Camera 1, 2, 3
                      const cameraId = selectedTransaction.cameraId || selectedTransaction.cameraName || "";
                      const cameraNameMap: { [key: string]: string } = {
                        'laptop-camera': 'Camera 1',
                        'reception-area': 'Camera 2',
                        'workstation-exit': 'Camera 3',
                        'Camera-001': 'Camera 1',
                        'Main Camera': 'Camera 1',
                        'Reception Area (Camera 1)': 'Camera 2',
                        'Workstation Exit (Camera 2)': 'Camera 3',
                      };
                      if (cameraNameMap[cameraId]) {
                        return cameraNameMap[cameraId];
                      }
                      if (cameraId.match(/^Camera [123]$/)) {
                        return cameraId;
                      }
                      const match = cameraId.match(/Camera[ -]?(\d+)/i);
                      if (match) {
                        return `Camera ${match[1]}`;
                      }
                      return cameraId || "N/A";
                    })()}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-bodydark2">Timestamp</p>
                  <p className="text-sm text-black dark:text-white">
                    {formatTimestamp(selectedTransaction.timestamp)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-bodydark">
                <Camera className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-center">Select a transaction to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

