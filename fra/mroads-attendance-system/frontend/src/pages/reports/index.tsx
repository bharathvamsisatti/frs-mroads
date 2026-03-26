import React, { useEffect, useMemo, useState } from 'react';
import { Download, Filter, RefreshCw, Eye, CheckCircle, XCircle, Clock, AlertTriangle, ChevronDown } from 'lucide-react';
import { getTransactions, Transaction } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import Pagination from '../../components/Pagination';

const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch {
    return timestamp;
  }
};

const escapeCsv = (value: unknown): string => {
  const str = value == null ? '' : String(value);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failure':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'in-progress':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    default:
      return null;
  }
};

const ReportsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cameraFilter, setCameraFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('');
  const [dateFromFilter, setDateFromFilter] = useState<string>('');
  const [dateToFilter, setDateToFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const recordsPerPage = 15;
  const navigate = useNavigate();
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getTransactions(1000, 0);
        if (response && response.transactions) {
          setTransactions(response.transactions);
        } else {
          setTransactions([]);
          if (response && response.error) {
            setError(response.error);
          }
        }
      } catch (err: any) {
        setTransactions([]);
        setError(err?.message || 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showExportMenu && event.target instanceof Element) {
        const exportButton = event.target.closest('[data-export-button]');
        if (!exportButton) {
          setShowExportMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  const handleManualRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const response = await getTransactions(1000, 0);
      if (response && response.transactions) {
        setTransactions(response.transactions);
        setCurrentPage(1); // Reset to first page on refresh
      } else {
        setTransactions([]);
        if (response && response.error) {
          setError(response.error);
        }
      }
    } catch (err: any) {
      setTransactions([]);
      setError(err?.message || 'Failed to refresh reports');
    } finally {
      setRefreshing(false);
    }
  };

  const uniqueCameras = useMemo(
    () =>
      Array.from(
        new Set(
          transactions
            .map((txn) => txn.cameraName || txn.cameraId || '')
            .filter((c) => c !== ''),
        ),
      ).sort(),
    [transactions],
  );

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((txn) => {
        const matchesStatus = statusFilter === 'all' || txn.status === statusFilter;
        const cameraId = txn.cameraName || txn.cameraId || '';
        const matchesCamera = cameraFilter === 'all' || cameraId === cameraFilter;
        const userName = txn.userName || txn.person_id || '';
        const matchesUser = !userFilter || userName.toLowerCase().includes(userFilter.toLowerCase());

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
          filterDate.setHours(23, 59, 59, 999);
          matchesDateTo = txnDate <= filterDate;
        }

        return matchesStatus && matchesCamera && matchesUser && matchesDateFrom && matchesDateTo;
      }),
    [transactions, statusFilter, cameraFilter, userFilter, dateFromFilter, dateToFilter],
  );

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
  }, [statusFilter, cameraFilter, userFilter, dateFromFilter, dateToFilter]);

  const hasActiveFilters =
    statusFilter !== 'all' ||
    cameraFilter !== 'all' ||
    userFilter !== '' ||
    dateFromFilter !== '' ||
    dateToFilter !== '';

  const clearFilters = () => {
    setStatusFilter('all');
    setCameraFilter('all');
    setUserFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setCurrentPage(1); // Reset to first page when clearing filters
  };

  const totalPages = Math.ceil(filteredTransactions.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleViewDetails = (transaction: Transaction) => {
    navigate(`/reports/${transaction.id}`, { state: { transaction } });
  };

  const handleExportCsv = () => {
    console.log('CSV export called');
    if (filteredTransactions.length === 0) {
      alert('No data to export');
      return;
    }

    const header = [
      'Transaction ID',
      'User Name',
      'Camera',
      'Timestamp',
      'Status',
      'Captured Photo URL',
      'Registered Photo URL',
    ];

    const rows = filteredTransactions.map((txn) => [
      txn.id,
      txn.userName ?? '',
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
    console.log('Creating CSV blob...');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    console.log('Creating download link...');
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `attendance-report-${dateStr}.csv`;
    document.body.appendChild(link);
    console.log('Triggering download...');
    link.click();
    console.log('Cleaning up...');
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('CSV export completed');
    setShowExportMenu(false);
  };

  const handleExportExcel = () => {
    console.log('Excel export called');
    if (filteredTransactions.length === 0) {
      alert('No data to export');
      return;
    }

    const header = [
      'Transaction ID',
      'User Name',
      'Camera',
      'Timestamp',
      'Status',
      'Captured Photo URL',
      'Registered Photo URL',
    ];

    const rows = filteredTransactions.map((txn) => [
      txn.id,
      txn.userName ?? '',
      txn.cameraName ?? txn.cameraId ?? '',
      formatTimestamp(txn.timestamp),
      txn.status ?? '',
      txn.capturedPhotoUrl ?? '',
      txn.registeredPhotoUrl ?? '',
    ]);

    // Create tab-separated content that Excel opens properly
    const excelContent = [
      header.join('\t'),
      ...rows.map((row) => row.map(cell => cell.toString().replace(/\t/g, ' ')).join('\t')),
    ].join('\n');

    console.log('Creating Excel blob...');
    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    console.log('Creating Excel download link...');
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `attendance-report-${dateStr}.xls`;
    document.body.appendChild(link);
    console.log('Triggering Excel download...');
    link.click();
    console.log('Cleaning up Excel...');
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('Excel export completed');
    setShowExportMenu(false);
  };

  const handleExportPdf = () => {
    console.log('PDF export called');
    if (filteredTransactions.length === 0) {
      alert('No data to export');
      return;
    }

    const rows = filteredTransactions.map((txn) => [
      txn.id,
      txn.userName ?? '',
      txn.cameraName ?? txn.cameraId ?? '',
      formatTimestamp(txn.timestamp),
      txn.status ?? '',
    ]);

    let pdfContent = 'ATTENDANCE REPORT\n';
    pdfContent += '================\n\n';
    pdfContent += `Generated: ${new Date().toLocaleString()}\n`;
    pdfContent += `Total Records: ${filteredTransactions.length}\n\n`;
    
    // Add column headers
    pdfContent += 'Transaction ID\tUser Name\tCamera\tTimestamp\tStatus\n';
    pdfContent += '-------------\t---------\t------\t---------\t------\n';
    
    // Add data rows
    rows.forEach((row) => {
      pdfContent += row.join('\t') + '\n';
    });

    console.log('Creating PDF blob...');
    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    console.log('Creating PDF download link...');
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `attendance-report-${dateStr}.pdf`;
    document.body.appendChild(link);
    console.log('Triggering PDF download...');
    link.click();
    console.log('Cleaning up PDF...');
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('PDF export completed');
    setShowExportMenu(false);
  };

  const handleExportDoc = () => {
    console.log('Word export called');
    if (filteredTransactions.length === 0) {
      alert('No data to export');
      return;
    }

    const rows = filteredTransactions.map((txn) => [
      txn.id,
      txn.userName ?? '',
      txn.cameraName ?? txn.cameraId ?? '',
      formatTimestamp(txn.timestamp),
      txn.status ?? '',
    ]);

    let docContent = 'ATTENDANCE REPORT\r\n';
    docContent += '================\r\n\r\n';
    docContent += `Generated: ${new Date().toLocaleString()}\r\n`;
    docContent += `Total Records: ${filteredTransactions.length}\r\n\r\n`;
    
    // Add column headers
    docContent += 'Transaction ID\tUser Name\tCamera\tTimestamp\tStatus\r\n';
    docContent += '-------------\t---------\t------\t---------\t------\r\n';
    
    // Add data rows
    rows.forEach((row) => {
      docContent += row.join('\t') + '\r\n';
    });

    console.log('Creating Word blob...');
    const blob = new Blob([docContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    console.log('Creating Word download link...');
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `attendance-report-${dateStr}.doc`;
    document.body.appendChild(link);
    console.log('Triggering Word download...');
    link.click();
    console.log('Cleaning up Word...');
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('Word export completed');
    setShowExportMenu(false);
  };

  return (
    <div className="mx-auto max-w-screen-2xl h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-title-md2 font-bold text-black dark:text-white">Reports</h1>
          <p className="text-sm text-bodydark mt-2">
            Detailed attendance and transaction history with filtering and export options.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-2 dark:border-strokedark dark:bg-boxdark dark:text-white dark:hover:bg-meta-4 disabled:opacity-50 transition-colors"
            title="Refresh reports data"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={loading || filteredTransactions.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
              data-export-button
            >
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-4 w-4" />
            </button>
            
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-lg shadow-lg z-50">
                <div className="py-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('CSV export button clicked');
                      setTimeout(() => {
                        handleExportCsv();
                      }, 100);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Export as CSV
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Excel export button clicked');
                      setTimeout(() => {
                        handleExportExcel();
                      }, 100);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Export as Excel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('PDF export button clicked');
                      setTimeout(() => {
                        handleExportPdf();
                      }, 100);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Export as PDF
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Word export button clicked');
                      setTimeout(() => {
                        handleExportDoc();
                      }, 100);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Export as Word
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-meta-1 bg-meta-1/10 px-4 py-3 text-sm text-meta-1">
          {error}
        </div>
      )}

      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark flex flex-col flex-1 min-h-0">
        <div className="border-b border-stroke px-4 py-4 dark:border-strokedark sm:px-6">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-bodydark2" />
              <span className="text-sm font-medium text-black dark:text-white">Filters</span>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-medium text-bodydark2 hover:text-primary"
              >
                Clear all
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-3 items-end">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="relative inline-flex appearance-none rounded border border-stroke bg-transparent px-5 py-2 outline-none transition focus:border-primary active:border-primary dark:border-strokedark dark:bg-form-input dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="in-progress">In Progress</option>
              <option value="warning">Warning</option>
            </select>

            <select
              value={cameraFilter}
              onChange={(e) => setCameraFilter(e.target.value)}
              className="relative inline-flex appearance-none rounded border border-stroke bg-transparent px-5 py-2 outline-none transition focus:border-primary active:border-primary dark:border-strokedark dark:bg-form-input dark:text-white"
            >
              <option value="all">All Cameras</option>
              {uniqueCameras.map((camera) => (
                <option key={camera} value={camera}>
                  {camera}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Filter by user..."
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="relative inline-flex appearance-none rounded border border-stroke bg-transparent px-5 py-2 outline-none transition focus:border-primary active:border-primary dark:border-strokedark dark:bg-form-input dark:text-white placeholder:text-bodydark2"
            />

            <div className="flex gap-3">
              <div className="space-y-1">
                <label htmlFor="reports-date-from" className="text-xs text-bodydark2 block">
                  From Date
                </label>
                <input
                  id="reports-date-from"
                  type="datetime-local"
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                  className="relative z-20 appearance-none rounded border border-stroke bg-transparent px-5 py-2 outline-none transition focus:border-primary active:border-primary dark:border-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="reports-date-to" className="text-xs text-bodydark2 block">
                  To Date
                </label>
                <input
                  id="reports-date-to"
                  type="datetime-local"
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                  className="relative z-20 appearance-none rounded border border-stroke bg-transparent px-5 py-2 outline-none transition focus:border-primary active:border-primary dark:border-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
                />
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="text-xs text-bodydark2">
              Showing {filteredTransactions.length} of {transactions.length} records
            </div>
          )}
        </div>

        <div className="px-4 py-4 sm:px-6 flex-1 min-h-0 overflow-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b border-stroke bg-gray-2 dark:border-strokedark dark:bg-meta-4">
                <th className="px-4 py-4 text-left text-sm font-medium text-black dark:text-white">Transaction ID</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-black dark:text-white">User Name</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-black dark:text-white">Camera</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-black dark:text-white">Timestamp</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-black dark:text-white">Status</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-black dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="border-b border-stroke px-4 py-5 text-center text-bodydark dark:border-strokedark"
                  >
                    Loading reports...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="border-b border-stroke px-4 py-5 text-center text-bodydark dark:border-strokedark"
                  >
                    No transactions found
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((txn) => (
                  <tr
                    key={txn.id}
                    className="border-b border-stroke hover:bg-gray-2 dark:border-strokedark dark:hover:bg-meta-4"
                  >
                    <td className="px-4 py-4 text-sm font-mono text-black dark:text-white">{txn.id}</td>
                    <td className="px-4 py-4 text-sm text-black dark:text-white">
                      {txn.userName || txn.person_id || 'Unknown'}
                    </td>
                    <td className="px-4 py-4 text-sm text-black dark:text-white">
                      <div className="flex flex-col gap-2">
                        <div className="text-xs">
                          {txn.cameraName || txn.cameraId || 'Unknown Camera'}
                        </div>
                        {(txn as any).captured_image_url && (
                          <img
                            src={`http://localhost:8000${(txn as any).captured_image_url}`}
                            alt="Captured face"
                            className="h-16 w-16 object-cover rounded border border-stroke dark:border-strokedark cursor-pointer hover:opacity-80 transition-opacity"
                            title="Click to view details"
                            onError={(e) => {
                              console.error('Failed to load thumbnail:', (txn as any).captured_image_url);
                              e.currentTarget.style.display = 'none';
                            }}
                            onClick={() => handleViewDetails(txn)}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-black dark:text-white">
                      {formatTimestamp(txn.timestamp)}
                    </td>
                    <td className="px-4 py-4 text-sm text-black dark:text-white">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(txn.status)}
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          txn.status === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          txn.status === 'failure' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          txn.status === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }`}>
                          {txn.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-black dark:text-white">
                      <button
                        onClick={() => handleViewDetails(txn)}
                        className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-opacity-90 transition-colors"
                        title="View details"
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </button>
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
          totalRecords={filteredTransactions.length}
        />
      </div>
    </div>
  );
};

export default ReportsPage;
