import { addDays, format, startOfMonth, endOfMonth, isBefore, isAfter, isWithinInterval, parseISO } from 'date-fns';

/**
 * Get pay periods for a given month
 * Returns both periods with their date ranges
 */
export const getPayPeriodsForMonth = (year, month) => {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = endOfMonth(monthStart);
  
  return [
    {
      period: 1,
      startDate: new Date(year, month - 1, 1),
      endDate: new Date(year, month - 1, 15),
      label: `${format(monthStart, 'MMMM')} 1-15`
    },
    {
      period: 2,
      startDate: new Date(year, month - 1, 16),
      endDate: monthEnd,
      label: `${format(monthStart, 'MMMM')} 16-${format(monthEnd, 'd')}`
    }
  ];
};

/**
 * Calculate all paychecks for a person within a date range
 */
export const calculatePaychecks = (startDate, endDate, nextPayDate, payDayOfWeek, amount) => {
  const paychecks = [];
  let currentPayDate = parseISO(nextPayDate);
  
  // Day mapping
  const dayMap = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6
  };
  
  const targetDay = dayMap[payDayOfWeek];
  
  // Ensure we start from or before the range start
  while (isAfter(currentPayDate, endDate)) {
    currentPayDate = addDays(currentPayDate, -14);
  }
  
  while (isBefore(currentPayDate, startDate)) {
    currentPayDate = addDays(currentPayDate, 14);
  }
  
  // Collect all paychecks in range
  while (isBefore(currentPayDate, endDate) || currentPayDate.getTime() === endDate.getTime()) {
    if (isWithinInterval(currentPayDate, { start: startDate, end: endDate })) {
      paychecks.push({
        date: format(currentPayDate, 'yyyy-MM-dd'),
        amount: parseFloat(amount),
        displayDate: format(currentPayDate, 'MMM d')
      });
    }
    currentPayDate = addDays(currentPayDate, 14);
  }
  
  return paychecks;
};

/**
 * Calculate total income for a pay period
 */
export const calculatePeriodIncome = (period, incomeSources) => {
  let jorgeTotal = 0;
  let jorgePaychecks = [];
  let anseliTotal = 0;
  let anseliPaychecks = [];
  
  incomeSources.forEach(source => {
    const paychecks = calculatePaychecks(
      period.startDate,
      period.endDate,
      source.next_pay_date,
      source.pay_day_of_week,
      source.amount
    );
    
    const total = paychecks.reduce((sum, check) => sum + check.amount, 0);
    
    if (source.person === 'Jorge') {
      jorgeTotal = total;
      jorgePaychecks = paychecks;
    } else {
      anseliTotal = total;
      anseliPaychecks = paychecks;
    }
  });
  
  return {
    jorgeTotal,
    jorgePaychecks,
    anseliTotal,
    anseliPaychecks,
    totalIncome: jorgeTotal + anseliTotal
  };
};

/**
 * Assign bills to period based on due date
 */
export const assignBillsToPeriod = (bills, period) => {
  return bills.filter(bill => {
    if (period.period === 1) {
      return bill.due_date <= 15;
    } else {
      return bill.due_date > 15;
    }
  });
};

/**
 * Calculate transfer amount needed
 */
export const calculateTransfer = (periodIncome, billsAssigned) => {
  const jorgeBills = billsAssigned
    .filter(b => b.paid_by === 'Jorge')
    .reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
    
  const anseliBills = billsAssigned
    .filter(b => b.paid_by === 'Anseli')
    .reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
  
  const jorgeBalance = periodIncome.jorgeTotal - jorgeBills;
  const anseliBalance = periodIncome.anseliTotal - anseliBills;
  
  let transferAmount = 0;
  let transferDirection = '';
  
  if (anseliBalance < 0) {
    transferAmount = Math.abs(anseliBalance);
    transferDirection = 'Jorge → Anseli';
  } else if (jorgeBalance < 0) {
    transferAmount = Math.abs(jorgeBalance);
    transferDirection = 'Anseli → Jorge';
  }
  
  return {
    jorgeBills,
    anseliBills,
    jorgeBalance,
    anseliBalance,
    transferAmount,
    transferDirection,
    totalBills: jorgeBills + anseliBills,
    leftover: periodIncome.totalIncome - (jorgeBills + anseliBills)
  };
};

/**
 * Get current pay period
 */
export const getCurrentPayPeriod = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  
  const periods = getPayPeriodsForMonth(year, month);
  return day <= 15 ? periods[0] : periods[1];
};

/**
 * Format currency
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
};
