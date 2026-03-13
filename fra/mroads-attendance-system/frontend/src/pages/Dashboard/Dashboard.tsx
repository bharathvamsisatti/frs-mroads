import React, { useEffect, useState, useCallback } from 'react';
import CardDataStats from '../../components/CardDataStats';
import ChartOne from '../../components/Charts/ChartOne';
import ChartThree from '../../components/Charts/ChartThree';
import ChartTwo from '../../components/Charts/ChartTwo';
import TableOne from '../../components/Tables/TableOne';
import { getEnrolled, getTransactions, Transaction } from '../../services/api';

const Dashboard: React.FC = () => {
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [todayValidCount, setTodayValidCount] = useState(0);
  const [todayInvalidCount, setTodayInvalidCount] = useState(0);

  const loadData = useCallback(async () => {
    try {
      setBackendError(false);
      
      // Load enrolled users
      const enrolledResponse = await getEnrolled();
      if (enrolledResponse && enrolledResponse.enrolled_names && Array.isArray(enrolledResponse.enrolled_names)) {
        setEnrolledCount(enrolledResponse.enrolled_names.length);
        console.log(`✅ Loaded ${enrolledResponse.enrolled_names.length} enrolled users`);
      } else {
        console.warn('⚠️ Invalid response format from /enrolled endpoint');
        setEnrolledCount(0);
      }
      
      // Load transactions for live data
      const transactionsResponse = await getTransactions(1000, 0);
      if (transactionsResponse && transactionsResponse.transactions) {
        setTransactions(transactionsResponse.transactions);
        setTotalRecords(transactionsResponse.count || transactionsResponse.transactions.length);
        console.log(`✅ Loaded ${transactionsResponse.count || transactionsResponse.transactions.length} total attendance records`);
        
        // Calculate today's valid and invalid counts
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayTransactions = transactionsResponse.transactions.filter(txn => {
          const txnDate = new Date(txn.timestamp);
          return txnDate >= today;
        });
        
        const validCount = todayTransactions.filter(txn => txn.status === 'success').length;
        const invalidCount = todayTransactions.filter(txn => txn.status === 'failure' || txn.status === 'warning').length;
        
        setTodayValidCount(validCount);
        setTodayInvalidCount(invalidCount);
      }
      
      setLastUpdate(new Date());
    } catch (err: any) {
      console.error('❌ Failed to load dashboard data:', err);
      setEnrolledCount(0);
      setTransactions([]);
      setTotalRecords(0);
      setTodayValidCount(0);
      setTodayInvalidCount(0);
      
      // Check if it's a network error (backend not running)
      if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError') || err?.name === 'TypeError') {
        setBackendError(true);
        console.error('⚠️ Backend server appears to be down. Make sure the FastAPI server is running on http://localhost:8000');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and auto-refresh every 5 seconds
  useEffect(() => {
    // Load immediately
    loadData();
    
    // Set up auto-refresh interval
    const intervalId = setInterval(() => {
      loadData();
    }, 5000); // Refresh every 5 seconds

    // Cleanup interval on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [loadData]);


  return (
    <>
      {backendError && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Backend server is not running
              </p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                Please start the FastAPI backend server: <code className="bg-red-100 dark:bg-red-900/40 px-1 py-0.5 rounded">uvicorn main:app --reload</code>
              </p>
            </div>
            <button
              onClick={loadData}
              className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      {lastUpdate && !backendError && (
        <div className="mb-2 flex items-center justify-end gap-2 text-xs text-bodydark2">
          <div className="h-2 w-2 rounded-full bg-meta-3 animate-pulse"></div>
          <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4 2xl:gap-7.5">
        <CardDataStats title="Enrolled Users" total={loading ? "..." : enrolledCount.toString()} rate="From Dev Server" levelUp>
          <svg
            className="fill-primary dark:fill-white"
            width="22"
            height="16"
            viewBox="0 0 22 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M11 15.1156C4.19376 15.1156 0.825012 8.61876 0.687512 8.34376C0.584387 8.13751 0.584387 7.86251 0.687512 7.65626C0.825012 7.38126 4.19376 0.918762 11 0.918762C17.8063 0.918762 21.175 7.38126 21.3125 7.65626C21.4156 7.86251 21.4156 8.13751 21.3125 8.34376C21.175 8.61876 17.8063 15.1156 11 15.1156ZM2.26876 8.00001C3.02501 9.27189 5.98126 13.5688 11 13.5688C16.0188 13.5688 18.975 9.27189 19.7313 8.00001C18.975 6.72814 16.0188 2.43126 11 2.43126C5.98126 2.43126 3.02501 6.72814 2.26876 8.00001Z"
              fill=""
            />
            <path
              d="M11 10.9219C9.38438 10.9219 8.07812 9.61562 8.07812 8C8.07812 6.38438 9.38438 5.07812 11 5.07812C12.6156 5.07812 13.9219 6.38438 13.9219 8C13.9219 9.61562 12.6156 10.9219 11 10.9219ZM11 6.625C10.2437 6.625 9.625 7.24375 9.625 8C9.625 8.75625 10.2437 9.375 11 9.375C11.7563 9.375 12.375 8.75625 12.375 8C12.375 7.24375 11.7563 6.625 11 6.625Z"
              fill=""
            />
          </svg>
        </CardDataStats>
        <CardDataStats title="Total Attendance" total={loading ? "..." : totalRecords.toString()} rate="Records" levelUp>
          <svg
            className="fill-primary dark:fill-white"
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21.1063 18.0469L19.3875 3.23126C19.2157 1.71876 17.9438 0.584381 16.3969 0.584381H5.56878C4.05628 0.584381 2.78441 1.71876 2.57815 3.23126L0.859406 18.0469C0.756281 18.9063 0.478156 19.2875 0.585938 20.1094C0.75628 21.1719 1.65941 22 2.77065 22H19.2157C20.3438 22 21.2625 21.1719 21.3938 20.1094C21.5313 19.2875 21.2532 18.9063 21.1063 18.0469ZM5.67065 2.75626H16.4313C16.9157 2.75626 17.3625 3.03751 17.4844 3.51564L19.1157 18.0313H2.80627L4.43441 3.51564C4.55628 3.03126 5.01878 2.75626 5.67065 2.75626Z"
              fill=""
            />
            <path
              d="M14.3345 5.29375C13.922 5.39688 13.647 5.80938 13.7501 6.22188C13.8532 6.62813 14.2657 6.90625 14.6782 6.80312C15.2157 6.70625 15.7532 6.70625 16.2907 6.80312C16.703 6.90625 17.0782 6.62813 17.1813 6.22188C17.2845 5.80938 17.0095 5.39688 16.597 5.29375C15.8282 5.11563 15.0407 5.11563 14.3345 5.29375Z"
              fill=""
            />
            <path
              d="M5.57841 5.29375C4.87222 5.11563 4.08472 5.11563 3.31597 5.29375C2.90347 5.39688 2.62847 5.80938 2.73159 6.22188C2.8347 6.62813 3.24034 6.90625 3.65284 6.80312C4.19034 6.70625 4.72784 6.70625 5.26534 6.80312C5.67784 6.90625 6.05284 6.62813 6.1559 6.22188C6.2591 5.80938 5.98409 5.39688 5.57841 5.29375Z"
              fill=""
            />
          </svg>
        </CardDataStats>
        <CardDataStats title="Valid Attempts" total={loading ? "..." : todayValidCount.toString()} rate="Today" levelUp>
          <svg
            className="fill-primary dark:fill-white"
            width="20"
            height="22"
            viewBox="0 0 20 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM8 15L3 10L4.41 8.59L8 12.17L15.59 4.58L17 6L8 15Z"
              fill=""
            />
          </svg>
        </CardDataStats>
        <CardDataStats title="Invalid Attempts" total={loading ? "..." : todayInvalidCount.toString()} rate="Today" levelUp>
          <svg
            className="fill-primary dark:fill-white"
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M11 0C4.925 0 0 4.925 0 11C0 17.075 4.925 22 11 22C17.075 22 22 17.075 22 11C22 4.925 17.075 0 11 0ZM11 20C6.037 20 2 15.963 2 11C2 6.037 6.037 2 11 2C15.963 2 20 6.037 20 11C20 15.963 15.963 20 11 20ZM12 6H10V12H16V10H12V6Z"
              fill=""
            />
          </svg>
        </CardDataStats>
        <CardDataStats title="Success Rate" total={loading ? "..." : (todayValidCount + todayInvalidCount > 0 ? Math.round((todayValidCount / (todayValidCount + todayInvalidCount)) * 100) + '%' : '0%')} rate="Today" levelUp>
          <svg
            className="fill-primary dark:fill-white"
            width="22"
            height="18"
            viewBox="0 0 22 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7.18418 8.03751C9.31543 8.03751 11.0686 6.35313 11.0686 4.25626C11.0686 2.15938 9.31543 0.475006 7.18418 0.475006C5.05293 0.475006 3.2998 2.15938 3.2998 4.25626C3.2998 6.35313 5.05293 8.03751 7.18418 8.03751ZM7.18418 2.05626C8.45605 2.05626 9.52168 3.05313 9.52168 4.29063C9.52168 5.52813 8.49043 6.52501 7.18418 6.52501C5.87793 6.52501 4.84668 5.52813 4.84668 4.29063C4.84668 3.05313 5.9123 2.05626 7.18418 2.05626Z"
              fill=""
            />
            <path
              d="M15.8124 9.6875C17.6687 9.6875 19.1468 8.24375 19.1468 6.42188C19.1468 4.6 17.6343 3.15625 15.8124 3.15625C13.9905 3.15625 12.478 4.6 12.478 6.42188C12.478 8.24375 13.9905 9.6875 15.8124 9.6875ZM15.8124 4.7375C16.8093 4.7375 17.5999 5.49375 17.5999 6.45625C17.5999 7.41875 16.8093 8.175 15.8124 8.175C14.8155 8.175 14.0249 7.41875 14.0249 6.45625C14.0249 5.49375 14.8155 4.7375 15.8124 4.7375Z"
              fill=""
            />
            <path
              d="M15.9843 10.0313H15.6749C14.6437 10.0313 13.6468 10.3406 12.7874 10.8563C11.8593 9.61876 10.3812 8.79376 8.73115 8.79376H5.67178C2.85303 8.82814 0.618652 11.0625 0.618652 13.8469V16.3219C0.618652 16.975 1.13428 17.4906 1.7874 17.4906H20.2468C20.8999 17.4906 21.4499 16.9406 21.4499 16.2875V15.4625C21.4155 12.4719 18.9749 10.0313 15.9843 10.0313ZM2.16553 15.9438V13.8469C2.16553 11.9219 3.74678 10.3406 5.67178 10.3406H8.73115C10.6562 10.3406 12.2374 11.9219 12.2374 13.8469V15.9438H2.16553V15.9438ZM19.8687 15.9438H13.7499V13.8469C13.7499 13.2969 13.6468 12.7469 13.4749 12.2313C14.0937 11.7844 14.8499 11.5781 15.6405 11.5781H15.9499C18.0812 11.5781 19.8343 13.3313 19.8343 15.4625V15.9438H19.8687Z"
              fill=""
            />
          </svg>
        </CardDataStats>
      </div>

      <div className="mt-4 grid grid-cols-12 gap-4 md:mt-6 md:gap-6 2xl:mt-7.5 2xl:gap-7.5">
        <ChartOne transactions={transactions} />
        <ChartTwo transactions={transactions} />
        <div className="col-span-12 xl:col-span-5">
          <ChartThree />
        </div>
        <div className="col-span-12 xl:col-span-7">
          <TableOne />
        </div>
      </div>
    </>
  );
};

export default Dashboard;
