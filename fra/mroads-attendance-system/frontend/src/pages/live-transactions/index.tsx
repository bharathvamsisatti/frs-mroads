import { LiveTransactions } from '../../components/LiveTransactions';

const LiveTransactionsPage = () => {
  return (
    <div className="mx-auto max-w-screen-2xl h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-title-md2 font-bold text-black dark:text-white">
          Attendance
        </h1>
        <p className="text-sm text-bodydark mt-2">
          Real-time view of attendance records captured from all cameras
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <LiveTransactions />
      </div>
    </div>
  );
};

export default LiveTransactionsPage;

