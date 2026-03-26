import React, { useEffect, useState, useMemo } from 'react';
import { Activity, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw, Users, Download, Filter } from 'lucide-react';
import { getTransactions, Transaction, getEnrolled } from '../../services/api';
import Pagination from '../../components/Pagination';

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
      return <CheckCircle className="h-4 w-4 text-meta-3" />;
    case 'failure':
      return <XCircle className="h-4 w-4 text-meta-1" />;
    case 'in-progress':
      return <Clock className="h-4 w-4 text-primary" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-meta-6" />;
    default:
      return null;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'success':
      return (
        <span className="inline-flex rounded-full bg-meta-3 bg-opacity-10 px-2 py-0.5 text-xs font-medium text-meta-3">
          Success
        </span>
      );
    case 'failure':
      return (
        <span className="inline-flex rounded-full bg-meta-1 bg-opacity-10 px-2 py-0.5 text-xs font-medium text-meta-1">
          Failure
        </span>
      );
    case 'in-progress':
      return (
        <span className="inline-flex rounded-full bg-primary bg-opacity-10 px-2 py-0.5 text-xs font-medium text-primary">
          In Progress
        </span>
      );
    case 'warning':
      return (
        <span className="inline-flex rounded-full bg-meta-6 bg-opacity-10 px-2 py-0.5 text-xs font-medium text-meta-6">
          Warning
        </span>
      );
    default:
      return <span className="text-xs text-body">Unknown</span>;
  }
}

const escapeCsv = (value: unknown): string => {
  const str = value == null ? '' : String(value);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
};

function formatAttendanceText(attendance: string) {
  if (!attendance || attendance === '-') {
    return <span className="text-bodydark2">-</span>;
  }
  
  // Handle both "IN: 09:10" and "IN 09:10" formats
  const parts = attendance.split(', ');
  return parts.map((part, index) => {
    // Try to split by colon first, then by space
    let [type, ...timeParts] = part.split(': ');
    if (timeParts.length === 0) {
      [type, ...timeParts] = part.split(' ');
    }
    const time = timeParts.join(': ');
    
    if (!type || !time) return part;
    
    return (
      <span key={index} className="inline-flex items-center gap-1">
        <span className="font-bold text-black dark:text-white">{type.toUpperCase()}</span>
        <span className="text-sm text-black dark:text-white">{time}</span>
        {index < parts.length - 1 && <span className="text-bodydark2 mx-1">,</span>}
      </span>
    );
  });
}

const AttendancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'live' | 'records'>('live');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const recordsPerPage = 20;

  // State for Records tab
  const [enrolledUsers, setEnrolledUsers] = useState<any[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsDateFilter, setRecordsDateFilter] = useState<string>('');
  const [recordsUserFilter, setRecordsUserFilter] = useState<string>('');
  const [recordsCurrentPage, setRecordsCurrentPage] = useState(1);
  const recordsPerPageForUsers = 10;

  // Generate random attendance data for demo
  const generateRandomAttendance = () => {
    const times = [];
    const hasIn = Math.random() > 0.2; // 80% chance of having IN time
    
    if (hasIn) {
      const inHour = 8 + Math.floor(Math.random() * 2); // 8-9 AM
      const inMin = Math.floor(Math.random() * 60);
      times.push(`IN: ${inHour.toString().padStart(2, '0')}:${inMin.toString().padStart(2, '0')}`);
      
      // 70% chance of having OUT time
      if (Math.random() > 0.3) {
        const outHour = 17 + Math.floor(Math.random() * 2); // 5-6 PM
        const outMin = Math.floor(Math.random() * 60);
        times.push(`OUT: ${outHour.toString().padStart(2, '0')}:${outMin.toString().padStart(2, '0')}`);
      }
    }
    
    return times.length > 0 ? times.join(', ') : '-';
  };

  // Generate random total time
  const generateRandomTotalTime = () => {
    const hours = 6 + Math.floor(Math.random() * 4); // 6-9 hours
    const mins = Math.floor(Math.random() * 60);
    return `${hours}h ${mins}m`;
  };

  // Load and continuously refresh transactions
  useEffect(() => {
    let isMounted = true;

    const fetchTransactions = async (initialLoad: boolean, isManualRefresh: boolean = false) => {
      try {
        if (initialLoad) {
          setLoading(true);
        } else if (isManualRefresh) {
          setRefreshing(true);
        }
        const response = await getTransactions(1000, 0);
        if (!isMounted) return;
        if (response && response.transactions) {
          setTransactions(response.transactions);
        } else {
          setTransactions([]);
        }
      } catch (err) {
        if (isMounted) {
          setTransactions([]);
          // We keep errors in console; attendance table just shows "No transactions" in UI.
          console.error('Failed to load attendance transactions', err);
        }
      } finally {
        if (initialLoad && isMounted) {
          setLoading(false);
        } else if (isManualRefresh && isMounted) {
          setRefreshing(false);
        }
      }
    };

    // Initial load
    fetchTransactions(true);

    // Load enrolled users for Records tab
    const loadEnrolledUsers = async () => {
      try {
        setRecordsLoading(true);
        const response = await getEnrolled();
        if (response && response.enrolled_names) {
          // Create dummy attendance data
          const dummyUsers = response.enrolled_names.map((name, index) => ({
            id: `USR${String(index + 1).padStart(3, '0')}`,
            userName: name,
            attendance: generateRandomAttendance(),
            totalTime: generateRandomTotalTime()
          }));
          setEnrolledUsers(dummyUsers);
        }
      } catch (err: any) {
        console.error('Failed to load enrolled users:', err);
      } finally {
        setRecordsLoading(false);
      }
    };

    loadEnrolledUsers();

    // Poll every 10 seconds for live updates
    const interval = setInterval(() => fetchTransactions(false, false), 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Filter enrolled users for Records tab
  const filteredEnrolledUsers = useMemo(() => {
    return enrolledUsers.filter(user => {
      const matchesUser = !recordsUserFilter || 
        user.userName.toLowerCase().includes(recordsUserFilter.toLowerCase()) ||
        user.id.toLowerCase().includes(recordsUserFilter.toLowerCase());
      
      const matchesDate = !recordsDateFilter || 
        user.attendance !== '-'; // For demo, show all if no date filter
      
      return matchesUser && matchesDate;
    });
  }, [enrolledUsers, recordsUserFilter, recordsDateFilter]);

  const recordsTotalPages = Math.ceil(filteredEnrolledUsers.length / recordsPerPageForUsers);
  const recordsStartIndex = (recordsCurrentPage - 1) * recordsPerPageForUsers;
  const recordsEndIndex = recordsStartIndex + recordsPerPageForUsers;
  const paginatedEnrolledUsers = filteredEnrolledUsers.slice(recordsStartIndex, recordsEndIndex);

  const totalPages = Math.ceil(transactions.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentTransactions = transactions.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleRecordsPageChange = (page: number) => {
    setRecordsCurrentPage(page);
  };

  const clearRecordsFilters = () => {
    setRecordsUserFilter('');
    setRecordsDateFilter('');
    setRecordsCurrentPage(1);
  };

  const handleManualRefresh = async () => {
    try {
      setRefreshing(true);
      const response = await getTransactions(1000, 0);
      if (response && response.transactions) {
        setTransactions(response.transactions);
        setCurrentPage(1); // Reset to first page on refresh
      } else {
        setTransactions([]);
      }
    } catch (err) {
      setTransactions([]);
      console.error('Failed to refresh attendance transactions', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportCsv = () => {
    if (transactions.length === 0) {
      return;
    }

    const header = [
      'Transaction ID',
      'User Name',
      'Person ID',
      'Camera',
      'Timestamp',
      'Status',
      'Captured Photo URL',
      'Registered Photo URL',
    ];

    const rows = transactions.map((txn) => [
      txn.id,
      txn.userName ?? '',
      txn.person_id ?? '',
      txn.cameraName ?? txn.cameraId ?? '',
      formatTimestamp(txn.timestamp),
      txn.status ?? '',
      txn.capturedPhotoUrl ?? '',
      txn.registeredPhotoUrl ?? '',
    ]);

    const csvLines = [
      header.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ];

    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `attendance-report-${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-screen-2xl h-full flex flex-col">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-title-md2 font-bold text-black dark:text-white">Attendance</h1>
          <p className="text-sm text-bodydark mt-2">
            Live view of attendance records as they are recognized and marked by the system.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'live' && (
            <>
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-2 dark:border-strokedark dark:bg-boxdark dark:text-white dark:hover:bg-meta-4 disabled:opacity-50 transition-colors"
                title="Refresh attendance data"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={loading || transactions.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === 'live'
              ? 'bg-white dark:bg-boxdark text-primary shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <RefreshCw className="h-4 w-4" />
          Live
        </button>
        <button
          onClick={() => setActiveTab('records')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === 'records'
              ? 'bg-white dark:bg-boxdark text-primary shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Users className="h-4 w-4" />
          Attendance
        </button>
      </div>

      {/* Live Tab Content */}
      {activeTab === 'live' && (
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark flex flex-col flex-1 min-h-0">
          <div className="border-b border-stroke px-4 py-4 dark:border-strokedark sm:px-6 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-black dark:text-white">Live Attendance Records</span>
          </div>

          <div className="px-4 py-4 sm:px-6 flex-1 min-h-0 overflow-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b border-stroke bg-gray-2 dark:border-strokedark dark:bg-meta-4">
                  <th className="px-4 py-4 text-left text-sm font-medium text-black dark:text-white">Transaction ID</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-black dark:text-white">User</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-black dark:text-white">Camera</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-black dark:text-white">Timestamp</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-black dark:text-white">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="border-b border-stroke px-4 py-5 text-center text-bodydark dark:border-strokedark"
                    >
                      Loading attendance...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="border-b border-stroke px-4 py-5 text-center text-bodydark dark:border-strokedark"
                    >
                      No attendance records found
                    </td>
                  </tr>
                ) : (
                  currentTransactions.map((txn) => (
                    <tr
                      key={txn.id}
                      className="border-b border-stroke hover:bg-gray-2 dark:border-strokedark dark:hover:bg-meta-4"
                    >
                      <td className="px-4 py-4 text-sm font-mono text-black dark:text-white">{txn.id}</td>
                      <td className="px-4 py-4 text-sm text-black dark:text-white flex items-center gap-2">
                        <span>{txn.userName || txn.person_id || 'Unknown'}</span>
                      </td>
                      <td className="px-4 py-4 text-sm text-black dark:text-white">
                        {txn.cameraName || txn.cameraId || 'Unknown Camera'}
                      </td>
                      <td className="px-4 py-4 text-sm text-black dark:text-white">
                        {formatTimestamp(txn.timestamp)}
                      </td>
                      <td className="px-4 py-4 text-sm text-black dark:text-white">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(txn.status)}
                          {getStatusBadge(txn.status)}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            recordsPerPage={recordsPerPage}
            totalRecords={transactions.length}
          />
        </div>
      )}

      {/* Records Tab Content */}
      {activeTab === 'records' && (
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark flex flex-col flex-1 min-h-0">
          <div className="border-b border-stroke px-4 py-4 dark:border-strokedark sm:px-6">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-bodydark2" />
                <span className="text-sm font-medium text-black dark:text-white">Filters</span>
              </div>
              {(recordsUserFilter !== '' || recordsDateFilter !== '') && (
                <button
                  type="button"
                  onClick={clearRecordsFilters}
                  className="text-xs font-medium text-bodydark2 hover:text-primary"
                >
                  Clear all
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap gap-3 items-end">
              <input
                type="text"
                placeholder="Filter by user or ID..."
                value={recordsUserFilter}
                onChange={(e) => setRecordsUserFilter(e.target.value)}
                className="relative inline-flex appearance-none rounded border border-stroke bg-transparent px-5 py-2 outline-none transition focus:border-primary active:border-primary dark:border-strokedark dark:bg-form-input dark:text-white placeholder:text-bodydark2"
              />

              <div className="space-y-1">
                <label htmlFor="records-date" className="text-xs text-bodydark2 block">
                  Date
                </label>
                <input
                  id="records-date"
                  type="date"
                  value={recordsDateFilter}
                  onChange={(e) => setRecordsDateFilter(e.target.value)}
                  className="relative z-20 appearance-none rounded border border-stroke bg-transparent px-5 py-2 outline-none transition focus:border-primary active:border-primary dark:border-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div className="px-4 py-4 sm:px-6 flex-1 min-h-0 overflow-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b border-stroke bg-gray-2 dark:border-strokedark dark:bg-meta-4">
                  <th className="px-4 py-4 text-left text-sm font-medium text-black dark:text-white">ID</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-black dark:text-white">User Name</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-black dark:text-white">Attendance</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-black dark:text-white">Total Time</th>
                </tr>
              </thead>
              <tbody>
                {recordsLoading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="border-b border-stroke px-4 py-5 text-center text-bodydark dark:border-strokedark"
                    >
                      Loading records...
                    </td>
                  </tr>
                ) : filteredEnrolledUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="border-b border-stroke px-4 py-5 text-center text-bodydark dark:border-strokedark"
                    >
                      No users found
                    </td>
                  </tr>
                ) : (
                  paginatedEnrolledUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-stroke hover:bg-gray-2 dark:border-strokedark dark:hover:bg-meta-4"
                    >
                      <td className="px-4 py-4 text-sm font-mono text-black dark:text-white">{user.id}</td>
                      <td className="px-4 py-4 text-sm text-black dark:text-white">{user.userName}</td>
                      <td className="px-4 py-4 text-sm text-black dark:text-white">{formatAttendanceText(user.attendance)}</td>
                      <td className="px-4 py-4 text-sm text-black dark:text-white">{user.totalTime}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <Pagination
            currentPage={recordsCurrentPage}
            totalPages={recordsTotalPages}
            onPageChange={handleRecordsPageChange}
            recordsPerPage={recordsPerPageForUsers}
            totalRecords={filteredEnrolledUsers.length}
          />
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
