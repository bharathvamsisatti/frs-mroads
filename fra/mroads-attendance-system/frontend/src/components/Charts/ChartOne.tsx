import { ApexOptions } from 'apexcharts';
import React, { useState, useMemo, useEffect } from 'react';
import ReactApexChart from 'react-apexcharts';
import { Transaction } from '../../services/api';

const getOptions = (timeRange: 'day' | 'week' | 'month'): ApexOptions => {
  const getCategories = () => {
    if (timeRange === 'day') {
      return Array.from({ length: 24 }, (_, i) => `${i}:00`);
    } else if (timeRange === 'week') {
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    } else {
      return ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    }
  };

  return {
  legend: {
    show: false,
    position: 'top',
    horizontalAlign: 'left',
  },
  colors: ['#3C50E0', '#80CAEE'],
  chart: {
    fontFamily: 'Mroads, sans-serif',
    height: 335,
    type: 'area',
    dropShadow: {
      enabled: true,
      color: '#623CEA14',
      top: 10,
      blur: 4,
      left: 0,
      opacity: 0.1,
    },

    toolbar: {
      show: false,
    },
  },
  responsive: [
    {
      breakpoint: 1024,
      options: {
        chart: {
          height: 300,
        },
      },
    },
    {
      breakpoint: 1366,
      options: {
        chart: {
          height: 350,
        },
      },
    },
  ],
  stroke: {
    width: [2, 2],
    curve: 'straight',
  },
  // labels: {
  //   show: false,
  //   position: "top",
  // },
  grid: {
    xaxis: {
      lines: {
        show: true,
      },
    },
    yaxis: {
      lines: {
        show: true,
      },
    },
  },
  dataLabels: {
    enabled: false,
  },
  markers: {
    size: 4,
    colors: '#fff',
    strokeColors: ['#3056D3', '#80CAEE'],
    strokeWidth: 3,
    strokeOpacity: 0.9,
    strokeDashArray: 0,
    fillOpacity: 1,
    discrete: [],
    hover: {
      size: undefined,
      sizeOffset: 5,
    },
  },
    xaxis: {
      type: 'category',
      categories: getCategories(),
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    tooltip: {
      y: {
        formatter: function (val: number) {
          return val + ' users';
        },
      },
    },
    yaxis: {
      title: {
        style: {
          fontSize: '0px',
        },
      },
      min: 0,
      max: timeRange === 'day' ? 30 : timeRange === 'week' ? 30 : 100,
    },
  };
};

interface ChartOneState {
  series: {
    name: string;
    data: number[];
  }[];
}

interface ChartOneProps {
  transactions: Transaction[];
}

const ChartOne: React.FC<ChartOneProps> = ({ transactions }) => {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('month');
  
  const [state, setState] = useState<ChartOneState>({
    series: [
      {
        name: 'Valid',
        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        name: 'Invalid',
        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ],
  });

  // Process transaction data based on time range
  useEffect(() => {
    const processData = () => {
      const now = new Date();
      let validData: number[] = [];
      let invalidData: number[] = [];
      
      if (timeRange === 'day') {
        // Hourly data for today (24 hours)
        validData = Array.from({ length: 24 }, () => 0);
        invalidData = Array.from({ length: 24 }, () => 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        transactions.forEach(txn => {
          const txnDate = new Date(txn.timestamp);
          if (txnDate >= today) {
            const hour = txnDate.getHours();
            if (txn.status === 'success') {
              validData[hour]++;
            } else if (txn.status === 'failure') {
              invalidData[hour]++;
            }
          }
        });
      } else if (timeRange === 'week') {
        // Daily data for this week (7 days)
        validData = Array.from({ length: 7 }, () => 0);
        invalidData = Array.from({ length: 7 }, () => 0);
        
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        transactions.forEach(txn => {
          const txnDate = new Date(txn.timestamp);
          if (txnDate >= weekStart) {
            const dayOfWeek = txnDate.getDay();
            if (txn.status === 'success') {
              validData[dayOfWeek]++;
            } else if (txn.status === 'failure') {
              invalidData[dayOfWeek]++;
            }
          }
        });
      } else {
        // Monthly data for last 12 months
        validData = Array.from({ length: 12 }, () => 0);
        invalidData = Array.from({ length: 12 }, () => 0);
        
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
        twelveMonthsAgo.setDate(1);
        twelveMonthsAgo.setHours(0, 0, 0, 0);
        
        transactions.forEach(txn => {
          const txnDate = new Date(txn.timestamp);
          if (txnDate >= twelveMonthsAgo) {
            const monthIndex = (txnDate.getMonth() - now.getMonth() + 12) % 12;
            if (txn.status === 'success') {
              validData[monthIndex]++;
            } else if (txn.status === 'failure') {
              invalidData[monthIndex]++;
            }
          }
        });
      }
      
      setState({
        series: [
          { name: 'Valid', data: validData },
          { name: 'Invalid', data: invalidData }
        ]
      });
    };
    
    processData();
  }, [transactions, timeRange]);

  const handleTimeRangeChange = (range: 'day' | 'week' | 'month') => {
    setTimeRange(range);
  };

  const chartOptions = useMemo(() => getOptions(timeRange), [timeRange]);

  const handleReset = () => {
    setState((prevState) => ({
      ...prevState,
    }));
  };
  handleReset;

  return (
    <div className="col-span-12 rounded-sm border border-stroke bg-white px-5 pt-7.5 pb-5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:col-span-8">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
        <div className="flex w-full flex-wrap gap-3 sm:gap-5">
          <div className="flex min-w-47.5">
            <span className="mt-1 mr-2 flex h-4 w-full max-w-4 items-center justify-center rounded-full border border-primary">
              <span className="block h-2.5 w-full max-w-2.5 rounded-full bg-primary"></span>
            </span>
            <div className="w-full">
              <p className="font-semibold text-primary">Valid</p>
              <p className="text-sm font-medium">Last {timeRange === 'day' ? '24 hours' : timeRange === 'week' ? '7 days' : '12 months'}</p>
            </div>
          </div>
          <div className="flex min-w-47.5">
            <span className="mt-1 mr-2 flex h-4 w-full max-w-4 items-center justify-center rounded-full border border-secondary">
              <span className="block h-2.5 w-full max-w-2.5 rounded-full bg-secondary"></span>
            </span>
            <div className="w-full">
              <p className="font-semibold text-secondary">Invalid</p>
              <p className="text-sm font-medium">Last {timeRange === 'day' ? '24 hours' : timeRange === 'week' ? '7 days' : '12 months'}</p>
            </div>
          </div>
        </div>
        <div className="flex w-full max-w-45 justify-end">
          <div className="inline-flex items-center rounded-md bg-whiter p-1.5 dark:bg-meta-4">
            <button
              onClick={() => handleTimeRangeChange('day')}
              className={`rounded py-1 px-3 text-xs font-medium transition ${
                timeRange === 'day'
                  ? 'bg-white text-black shadow-card dark:bg-boxdark dark:text-white'
                  : 'text-black hover:bg-white hover:shadow-card dark:text-white dark:hover:bg-boxdark'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => handleTimeRangeChange('week')}
              className={`rounded py-1 px-3 text-xs font-medium transition ${
                timeRange === 'week'
                  ? 'bg-white text-black shadow-card dark:bg-boxdark dark:text-white'
                  : 'text-black hover:bg-white hover:shadow-card dark:text-white dark:hover:bg-boxdark'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => handleTimeRangeChange('month')}
              className={`rounded py-1 px-3 text-xs font-medium transition ${
                timeRange === 'month'
                  ? 'bg-white text-black shadow-card dark:bg-boxdark dark:text-white'
                  : 'text-black hover:bg-white hover:shadow-card dark:text-white dark:hover:bg-boxdark'
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      <div>
        <div id="chartOne" className="-ml-5">
          <ReactApexChart
            options={chartOptions}
            series={state.series}
            type="area"
            height={350}
          />
        </div>
      </div>
    </div>
  );
};

export default ChartOne;
