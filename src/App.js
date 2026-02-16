import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wgjbslvpvgymdmlucpyh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnamJzbHZwdmd5bWRtbHVjcHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxODc5NzIsImV4cCI6MjA4Mjc2Mzk3Mn0.NKUxsGVOau6NpUaIsU1MgatvpdvQ8uSMHXeeb0UC4JI'
);

const fmt = (n) => `$${Math.round(n || 0).toLocaleString()}`;
const MONTHLY_CHECKS_TABLE = 'monthly_bill_checks';
const MONTHLY_CHECKS_STORAGE_KEY = 'monthlyBillChecks';

export default function MedinaBudget() {
  const [page, setPage] = useState('dashboard');
  const [data, setData] = useState({ income: [], bills: [], cards: [], loans: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [inc, bills, cards, loans, subs, notes] = await Promise.all([
      supabase.from('income_sources').select('*'),
      supabase.from('bills').select('*').eq('active', true),
      supabase.from('credit_cards').select('*').eq('active', true),
      supabase.from('loans').select('*').eq('active', true),
      supabase.from('subscriptions').select('*').eq('active', true).order('frequency', { ascending: true }).order('due_date', { ascending: true }),
      supabase.from('budget_notes').select('*').order('created_at', { ascending: false })
    ]);
    setData({ 
      income: inc.data || [], 
      bills: bills.data || [], 
      cards: cards.data || [], 
      loans: loans.data || [],
      subscriptions: subs.data || [],
      notes: notes.data || []
    });
    setLoading(false);
  };

  if (loading) return <div style={s.app}><div style={s.loading}>Loading MEDINA BUDGET...</div></div>;

  return (
    <div style={s.app}>
      <nav style={s.nav}>
        <h1 style={s.title}>📊 MEDINA BUDGET</h1>
        <div style={s.links}>
          {['Dashboard', 'Monthly', 'Bills', 'Subscriptions', 'Debt', 'Settings'].map(p => (
            <button key={p} onClick={() => setPage(p.toLowerCase())} 
              style={{ ...s.navBtn, ...(page === p.toLowerCase() && s.navBtnActive) }}>
              {p}
            </button>
          ))}
        </div>
      </nav>
      <main style={s.main}>
        {page === 'dashboard' && <Dashboard data={data} reload={loadData} />}
        {page === 'monthly' && <Monthly data={data} reload={loadData} />}
        {page === 'bills' && <Bills data={data} reload={loadData} />}
        {page === 'subscriptions' && <Subscriptions data={data} reload={loadData} />}
        {page === 'debt' && <Debt data={data} reload={loadData} />}
        {page === 'settings' && <Settings data={data} reload={loadData} />}
      </main>
    </div>
  );
}

function Dashboard({ data }) {
  const totalIncome = data.income.reduce((s, i) => s + +i.amount, 0) * 2;
  const totalDebt = data.cards.reduce((s, c) => s + +c.balance, 0) + data.loans.reduce((s, l) => s + +l.balance, 0);
  
  // Calculate all monthly expenses (including investments and credit cards from Debt page)
  const creditCardTotal = data.cards.filter(c => c.min_payment > 0).reduce((sum, c) => sum + +c.min_payment, 0) + 
                          data.loans.filter(l => l.monthly_payment > 0).reduce((sum, l) => sum + +l.monthly_payment, 0);
  const rentTotal = data.bills.filter(b => b.category === 'Rent').reduce((s, b) => s + (b.default_amount || 0), 0);
  const monthlyExpensesTotal = data.bills.filter(b => ['Utility', 'Personal'].includes(b.category) && b.name !== 'Fundrise').reduce((s, b) => s + (b.default_amount || 0), 0);
  const investmentTotal = data.bills.filter(b => b.category === 'Investment' || b.name === 'Fundrise').reduce((s, b) => s + (b.default_amount || 0), 0);
  
  const totalExpenses = creditCardTotal + rentTotal + monthlyExpensesTotal + investmentTotal;
  const monthlyLeftover = totalIncome - totalExpenses;
  
  // Credit Utilization
  const totalBalance = data.cards.reduce((sum, c) => sum + +c.balance, 0);
  const totalLimit = data.cards.reduce((sum, c) => sum + +(c.credit_limit || 0), 0);
  const utilization = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;
  const utilizationColor = utilization < 30 ? '#4ade80' : utilization < 70 ? '#fbbf24' : '#ef4444';
  
  // Split bills by period - exclude duplicates (credit cards are in both data.cards and data.bills)
  const allBillsWithPayments = [
    ...data.cards.filter(c => c.min_payment > 0).map(c => ({
      id: `card-${c.id}`,
      name: c.name,
      amount: +c.min_payment,
      due_date: +c.due_date
    })),
    ...data.loans.filter(l => l.monthly_payment > 0).map(l => ({
      id: `loan-${l.id}`,
      name: l.name,
      amount: +l.monthly_payment,
      due_date: +l.due_date
    })),
    // Exclude Credit Card and Loan categories from bills to avoid duplicates
    ...data.bills.filter(b => b.default_amount > 0 && !['Credit Card', 'Loan'].includes(b.category)).map(b => ({
      id: b.id,
      name: b.name,
      amount: +b.default_amount,
      due_date: +b.due_date
    }))
  ];
  
  // Calculate current month paycheck counts
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  
  const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);
  const currentMonthEnd = new Date(currentYear, currentMonth - 1, daysInMonth);
  
  const jorge = data.income.find(s => s.person === 'Jorge') || {};
  const anseli = data.income.find(s => s.person === 'Anseli') || {};
  
  // Calculate paychecks for current month
  const calcCurrentMonthPaychecks = (nextPay, amount) => {
    const checks = [];
    if (!nextPay) return checks;
    
    const payDate = new Date(nextPay + 'T00:00:00');
    const daysDiff = Math.floor((currentMonthStart - payDate) / (1000 * 60 * 60 * 24));
    const periodsPassed = Math.max(0, Math.floor(daysDiff / 14));
    
    let currentPay = new Date(payDate);
    currentPay.setDate(currentPay.getDate() + (periodsPassed * 14));
    
    if (currentPay < currentMonthStart) {
      currentPay.setDate(currentPay.getDate() + 14);
    }
    
    let iterations = 0;
    while (currentPay <= currentMonthEnd && iterations < 10) {
      checks.push({ date: currentPay, amount: +amount });
      currentPay = new Date(currentPay);
      currentPay.setDate(currentPay.getDate() + 14);
      iterations++;
    }
    
    return checks;
  };
  
  const jorgePaychecks = calcCurrentMonthPaychecks(jorge.next_pay_date, jorge.amount);
  const anseliPaychecks = calcCurrentMonthPaychecks(anseli.next_pay_date, anseli.amount);
  const hasThirdPaycheck = jorgePaychecks.length === 3 || anseliPaychecks.length === 3;
  
  // Filter by period
  const period1Bills = allBillsWithPayments.filter(b => +b.due_date <= 14).sort((a, b) => a.due_date - b.due_date);
  const period2Bills = allBillsWithPayments.filter(b => +b.due_date >= 15).sort((a, b) => a.due_date - b.due_date);
  const period1Total = period1Bills.reduce((sum, b) => sum + +b.amount, 0);
  const period2Total = period2Bills.reduce((sum, b) => sum + +b.amount, 0);
  
  return (
    <div>
      <h1 style={s.h1}>Dashboard</h1>
      
      <div style={s.grid}>
        <StatCard l="💰 Monthly Income" v={fmt(totalIncome)} g />
        <StatCard 
          l="💸 Monthly Leftover" 
          v={fmt(monthlyLeftover)} 
          g={monthlyLeftover >= 0}
          sub={monthlyLeftover >= 0 ? 'Positive cash flow' : 'Overspending'}
        />
        <StatCard l="💳 Total Debt" v={fmt(totalDebt)} />
        <StatCard 
          l="📊 Money Flow" 
          v={`${fmt(totalExpenses)}`}
          sub={`${((totalExpenses / totalIncome) * 100).toFixed(1)}% of income`}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Credit Utilization Card */}
        <Card t="💳 Credit Utilization">
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.5rem' }}>Total Balance</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>{fmt(totalBalance)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.5rem' }}>Total Limit</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totalLimit > 0 ? fmt(totalLimit) : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.5rem' }}>Utilization</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: utilizationColor }}>
                  {totalLimit > 0 ? `${utilization.toFixed(1)}%` : '—'}
                </div>
              </div>
            </div>
            {totalLimit > 0 && (
              <div>
                {/* Utilization Bar */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>Credit Used</div>
                  <div style={{ height: '12px', background: '#1a1a1a', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${Math.min(utilization, 100)}%`, 
                      background: utilizationColor,
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                    {fmt(totalBalance)} of {fmt(totalLimit)}
                  </div>
                </div>
                
                {/* Total Available Bar */}
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>Total Credit Available</div>
                  <div style={{ height: '12px', background: '#1a1a1a', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: '100%', 
                      background: 'linear-gradient(90deg, #4ade80, #22c55e)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                    {fmt(totalLimit - totalBalance)} remaining
                  </div>
                </div>
              </div>
            )}
            {totalLimit === 0 && (
              <div style={{ padding: '1rem', background: '#1a1a1a', borderRadius: '6px', textAlign: 'center', color: '#999' }}>
                Add credit limits on the Debt page
              </div>
            )}
          </div>
        </Card>

        {/* Enhanced Monthly Breakdown */}
        <Card t="💰 Monthly Breakdown">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Credit Cards */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#999' }}>💳 Credit Cards</span>
                <span style={{ fontSize: '0.85rem', color: '#999' }}>
                  {((creditCardTotal / totalExpenses) * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ height: '8px', background: '#1a1a1a', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.25rem' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${(creditCardTotal / totalExpenses) * 100}%`, 
                  background: '#4ade80'
                }} />
              </div>
              <div style={{ fontWeight: 600, color: '#4ade80' }}>{fmt(creditCardTotal)}</div>
            </div>

            {/* Rent */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#999' }}>🏠 Rent</span>
                <span style={{ fontSize: '0.85rem', color: '#999' }}>
                  {((rentTotal / totalExpenses) * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ height: '8px', background: '#1a1a1a', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.25rem' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${(rentTotal / totalExpenses) * 100}%`, 
                  background: '#4ade80'
                }} />
              </div>
              <div style={{ fontWeight: 600, color: '#4ade80' }}>{fmt(rentTotal)}</div>
            </div>

            {/* Monthly Expenses */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#999' }}>🛒 Monthly Expenses</span>
                <span style={{ fontSize: '0.85rem', color: '#999' }}>
                  {((monthlyExpensesTotal / totalExpenses) * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ height: '8px', background: '#1a1a1a', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.25rem' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${(monthlyExpensesTotal / totalExpenses) * 100}%`, 
                  background: '#4ade80'
                }} />
              </div>
              <div style={{ fontWeight: 600, color: '#4ade80' }}>{fmt(monthlyExpensesTotal)}</div>
            </div>

            {/* Investments */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#999' }}>📈 Investments</span>
                <span style={{ fontSize: '0.85rem', color: '#999' }}>
                  {((investmentTotal / totalExpenses) * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ height: '8px', background: '#1a1a1a', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.25rem' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${(investmentTotal / totalExpenses) * 100}%`, 
                  background: '#4ade80'
                }} />
              </div>
              <div style={{ fontWeight: 600, color: '#4ade80' }}>{fmt(investmentTotal)}</div>
            </div>

            <div style={{ borderTop: '2px solid #2d2d2d', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem' }}>
                <span>Total</span>
                <span style={{ color: '#4ade80' }}>{fmt(totalExpenses)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* This Month Summary */}
        <Card t="📅 This Month">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* 3rd Paycheck Notification */}
            {hasThirdPaycheck && (
              <div style={{ 
                padding: '1rem',
                background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🎉</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#000' }}>Bonus Paycheck Month!</div>
                <div style={{ fontSize: '0.85rem', color: '#1a1a1a', marginTop: '0.25rem' }}>
                  {jorgePaychecks.length === 3 && anseliPaychecks.length === 3 ? 'Both getting 3 paychecks this month' :
                   jorgePaychecks.length === 3 ? 'Jorge gets 3 paychecks this month' :
                   'Anseli gets 3 paychecks this month'}
                </div>
              </div>
            )}

            {/* Period 1: 1st-15th */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '1rem',
              background: '#0a0a0a',
              borderRadius: '8px'
            }}>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Bills Due 1st - 15th</div>
                <div style={{ fontSize: '0.85rem', color: '#999' }}>
                  {period1Bills.length} bills
                </div>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4ade80' }}>
                {fmt(period1Total)}
              </div>
            </div>

            {/* Period 2: 16th-31st */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '1rem',
              background: '#0a0a0a',
              borderRadius: '8px'
            }}>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Bills Due 16th - 31st</div>
                <div style={{ fontSize: '0.85rem', color: '#999' }}>
                  {period2Bills.length} bills
                </div>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4ade80' }}>
                {fmt(period2Total)}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Monthly({ data, reload }) {
  const [date, setDate] = useState(new Date());
  const [periods, setPeriods] = useState([]);
  const [paidBillsByPeriod, setPaidBillsByPeriod] = useState({});
  const [useLocalChecksFallback, setUseLocalChecksFallback] = useState(false);

  useEffect(() => {
    loadMonth();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    loadChecks(year, month);
  }, [date, data]);

  useEffect(() => {
    const syncChecks = () => {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      loadChecks(year, month);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncChecks();
      }
    };

    const intervalId = setInterval(syncChecks, 10000);
    window.addEventListener('focus', syncChecks);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', syncChecks);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [date, useLocalChecksFallback]);

  const getPeriodKey = (year, month, period) => `${year}-${month}-${period}`;

  const saveChecksToLocalStorage = (checks) => {
    localStorage.setItem(MONTHLY_CHECKS_STORAGE_KEY, JSON.stringify(checks));
  };

  const loadChecksFromLocalStorage = () => {
    const saved = localStorage.getItem(MONTHLY_CHECKS_STORAGE_KEY);
    if (!saved) {
      setPaidBillsByPeriod({});
      return;
    }

    try {
      setPaidBillsByPeriod(JSON.parse(saved));
    } catch (error) {
      console.error('Error loading saved checks from local storage:', error);
      setPaidBillsByPeriod({});
    }
  };

  const mergeChecksIntoState = (year, month, rows) => {
    const periodOneKey = getPeriodKey(year, month, 1);
    const periodTwoKey = getPeriodKey(year, month, 2);

    setPaidBillsByPeriod(prevChecks => {
      const nextChecks = { ...prevChecks };
      delete nextChecks[periodOneKey];
      delete nextChecks[periodTwoKey];

      (rows || []).forEach(row => {
        const key = getPeriodKey(year, month, row.period);
        nextChecks[key] = nextChecks[key] || {};
        nextChecks[key][row.bill_key] = true;
      });

      saveChecksToLocalStorage(nextChecks);
      return nextChecks;
    });
  };

  const loadChecks = async (year, month) => {
    try {
      const { data: cloudChecks, error } = await supabase
        .from(MONTHLY_CHECKS_TABLE)
        .select('period, bill_key')
        .eq('year', year)
        .eq('month', month);

      if (error) throw error;

      setUseLocalChecksFallback(false);
      mergeChecksIntoState(year, month, cloudChecks);
    } catch (error) {
      console.error('Error loading monthly checks from Supabase, using local storage fallback:', error);
      setUseLocalChecksFallback(true);
      loadChecksFromLocalStorage();
    }
  };

  const getChecksForPeriod = (year, month, period) => {
    const key = getPeriodKey(year, month, period);
    return paidBillsByPeriod[key] || {};
  };

  const updateLocalCheckState = (billId, year, month, period, isPaid) => {
    setPaidBillsByPeriod(prevChecks => {
      const key = getPeriodKey(year, month, period);
      const periodChecks = { ...(prevChecks[key] || {}) };

      if (isPaid) {
        periodChecks[billId] = true;
      } else {
        delete periodChecks[billId];
      }

      const nextChecks = { ...prevChecks };
      if (Object.keys(periodChecks).length === 0) {
        delete nextChecks[key];
      } else {
        nextChecks[key] = periodChecks;
      }

      saveChecksToLocalStorage(nextChecks);
      return nextChecks;
    });
  };

  const togglePaid = async (billId, year, month, period, currentStatus) => {
    const nextStatus = !currentStatus;
    updateLocalCheckState(billId, year, month, period, nextStatus);

    try {
      if (nextStatus) {
        const { error } = await supabase
          .from(MONTHLY_CHECKS_TABLE)
          .upsert(
            {
              year,
              month,
              period,
              bill_key: billId
            },
            { onConflict: 'year,month,period,bill_key' }
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(MONTHLY_CHECKS_TABLE)
          .delete()
          .eq('year', year)
          .eq('month', month)
          .eq('period', period)
          .eq('bill_key', billId);
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving monthly checks to Supabase, switching to local storage fallback:', error);
      setUseLocalChecksFallback(true);
    }
  };

  const getPayPeriods = (y, m) => {
    const days = new Date(y, m, 0).getDate();
    const monthName = new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long' });
    return [
      { p: 1, s: new Date(y, m - 1, 1), e: new Date(y, m - 1, 15), l: `${monthName} 1-15` },
      { p: 2, s: new Date(y, m - 1, 16), e: new Date(y, m - 1, days), l: `${monthName} 16-${days}` }
    ];
  };

  const calcPaychecks = (start, end, nextPay, amount) => {
    const checks = [];
    if (!nextPay) return checks;
    
    const payDate = new Date(nextPay + 'T00:00:00'); // Ensure proper date parsing
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    // Calculate how many 14-day periods from nextPay to start
    const daysDiff = Math.floor((startDate - payDate) / (1000 * 60 * 60 * 24));
    const periodsPassed = Math.max(0, Math.floor(daysDiff / 14));
    
    // Start from the first paycheck on or after the start date
    let currentPay = new Date(payDate);
    currentPay.setDate(currentPay.getDate() + (periodsPassed * 14));
    
    // If we're still before the start, add one more period
    if (currentPay < startDate) {
      currentPay.setDate(currentPay.getDate() + 14);
    }
    
    // Collect all paychecks within the period (max 10 to prevent infinite loops)
    let iterations = 0;
    while (currentPay <= endDate && iterations < 10) {
      checks.push({ 
        date: currentPay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
        amount: +amount 
      });
      currentPay = new Date(currentPay);
      currentPay.setDate(currentPay.getDate() + 14);
      iterations++;
    }
    
    return checks;
  };

  const calcIncome = (period, sources) => {
    const jorge = sources.find(s => s.person === 'Jorge') || {};
    const anseli = sources.find(s => s.person === 'Anseli') || {};
    const jChecks = calcPaychecks(period.s, period.e, jorge.next_pay_date, jorge.amount);
    const aChecks = calcPaychecks(period.s, period.e, anseli.next_pay_date, anseli.amount);
    const jTotal = jChecks.reduce((sum, c) => sum + c.amount, 0);
    const aTotal = aChecks.reduce((sum, c) => sum + c.amount, 0);
    return { jTotal, aTotal, total: jTotal + aTotal, jChecks, aChecks };
  };

  const assignBills = (bills, period) => bills.filter(b => period.p === 1 ? b.due_date <= 14 : b.due_date >= 15);

  const calcTransfer = (income, allBills) => {
    const total = allBills.reduce((s, b) => s + +(b.amount || 0), 0);
    const leftover = income.total - total;
    return { total, leftover };
  };

  const loadMonth = () => {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const ps = getPayPeriods(y, m);

    setPeriods(ps.map(p => {
      const income = calcIncome(p, data.income);
      
      // Get bills from bills table
      const regularBills = assignBills(data.bills, p);
      
      // Get credit cards from Debt page (all credit cards due each period)
      const creditCards = (data.cards || []).map(c => ({
        id: `card-${c.id}`,
        name: c.name,
        amount: c.min_payment,
        category: 'Credit Card',
        due_date: c.due_date
      }));
      
      // Get loans from Debt page
      const loans = (data.loans || []).map(l => ({
        id: `loan-${l.id}`,
        name: l.name,
        amount: l.monthly_payment,
        category: 'Credit Card',
        due_date: l.due_date
      }));
      
      // Filter credit cards and loans by period AND exclude $0 amounts
      const periodCreditCards = [...creditCards, ...loans].filter(c => 
        (p.p === 1 ? c.due_date <= 14 : c.due_date >= 15) && c.amount > 0
      );
      
      // Categorize regular bills - exclude $0 amounts
      const rentBills = regularBills.filter(b => b.category === 'Rent' && b.default_amount > 0).map(b => ({ 
        ...b, 
        amount: b.default_amount,
        category: 'Rent' 
      }));
      
      const monthlyBills = regularBills.filter(b => 
        ['Utility', 'Personal'].includes(b.category) && b.name !== 'Fundrise' && b.default_amount > 0
      ).map(b => ({ 
        ...b, 
        amount: b.default_amount,
        category: 'Monthly' 
      }));
      
      const investmentBills = regularBills.filter(b => 
        (b.category === 'Investment' || b.name === 'Fundrise') && b.default_amount > 0
      ).map(b => ({ 
        ...b, 
        amount: b.default_amount,
        category: 'Investment' 
      }));
      
      const otherBills = regularBills.filter(b =>
        !['Credit Card', 'Loan', 'Rent', 'Utility', 'Personal', 'Investment'].includes(b.category) && 
        b.name !== 'Fundrise' && 
        b.default_amount > 0
      ).map(b => ({
        ...b,
        amount: b.default_amount,
        category: 'Other'
      }));
      
      // Combine all bills in order: Credit Cards, Rent, Monthly, Investments, Other
      const allBills = [
        ...periodCreditCards,
        ...rentBills,
        ...monthlyBills,
        ...investmentBills,
        ...otherBills
      ];
      
      const transfer = calcTransfer(income, allBills);
      
      return { ...p, income, allBills, creditCards: periodCreditCards, rentBills, monthlyBills, investmentBills, otherBills, transfer, year: y, month: m };
    }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={s.h1}>{date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => setDate(new Date(date.setMonth(date.getMonth() - 1)))}
            style={{
              padding: '0.5rem 0.75rem',
              background: '#4ade80',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
          >
            ← Prev
          </button>
          <button 
            onClick={() => setDate(new Date())}
            style={{
              padding: '0.5rem 0.75rem',
              background: '#4ade80',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
          >
            Today
          </button>
          <button 
            onClick={() => setDate(new Date(date.setMonth(date.getMonth() + 1)))}
            style={{
              padding: '0.5rem 0.75rem',
              background: '#4ade80',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
          >
            Next →
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        {periods.map(p => {
          // Get the checks for this specific period
          const periodChecks = getChecksForPeriod(p.year, p.month, p.p);
          
          return (
          <Card key={p.p}>
            <h2 style={s.h2}>{p.l}</h2>
            
            <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: '#0a0a0a', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ ...s.h3, margin: 0 }}>INCOME</h3>
                {(p.income.jChecks.length === 3 || p.income.aChecks.length === 3) && (
                  <span style={{ fontSize: '0.85rem', color: '#4ade80', fontWeight: 600 }}>🎉 Bonus Month!</span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>Jorge:</span>
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>
                    ({p.income.jChecks.length} {p.income.jChecks.length === 1 ? 'paycheck' : 'paychecks'})
                  </span>
                </div>
                <span style={{ color: '#4ade80', fontWeight: 600 }}>{fmt(p.income.jTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>Anseli:</span>
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>
                    ({p.income.aChecks.length} {p.income.aChecks.length === 1 ? 'paycheck' : 'paychecks'})
                  </span>
                </div>
                <span style={{ color: '#4ade80', fontWeight: 600 }}>{fmt(p.income.aTotal)}</span>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={s.h3}>BILLS DUE ({p.allBills.length})</h3>
              
              {/* Credit Cards */}
              {p.creditCards.length > 0 && (
                <>
                  {p.creditCards.map(b => (
                    <div key={b.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '0.4rem 0.5rem',
                      marginBottom: '0.25rem',
                      opacity: periodChecks[b.id] ? 0.5 : 1,
                      textDecoration: periodChecks[b.id] ? 'line-through' : 'none'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                        <input 
                          type="checkbox" 
                          checked={periodChecks[b.id] || false}
                          onChange={() => togglePaid(b.id, p.year, p.month, p.p, periodChecks[b.id] || false)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.9rem' }}>{b.name}</span>
                      </div>
                      <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '0.9rem' }}>
                        {fmt(b.amount)}
                      </span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid #2d2d2d', marginTop: '0.5rem', marginBottom: '0.5rem' }} />
                </>
              )}

              {/* Rent */}
              {p.rentBills.length > 0 && (
                <>
                  {p.rentBills.map(b => (
                    <div key={b.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '0.4rem 0.5rem',
                      marginBottom: '0.25rem',
                      opacity: periodChecks[b.id] ? 0.5 : 1,
                      textDecoration: periodChecks[b.id] ? 'line-through' : 'none'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                        <input 
                          type="checkbox" 
                          checked={periodChecks[b.id] || false}
                          onChange={() => togglePaid(b.id, p.year, p.month, p.p, periodChecks[b.id] || false)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.9rem' }}>{b.name}</span>
                      </div>
                      <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '0.9rem' }}>
                        {b.amount ? fmt(b.amount) : '—'}
                      </span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid #2d2d2d', marginTop: '0.5rem', marginBottom: '0.5rem' }} />
                </>
              )}

              {/* Monthly Expenses */}
              {p.monthlyBills.length > 0 && (
                <>
                  {p.monthlyBills.map(b => (
                    <div key={b.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '0.4rem 0.5rem',
                      marginBottom: '0.25rem',
                      opacity: periodChecks[b.id] ? 0.5 : 1,
                      textDecoration: periodChecks[b.id] ? 'line-through' : 'none'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                        <input 
                          type="checkbox" 
                          checked={periodChecks[b.id] || false}
                          onChange={() => togglePaid(b.id, p.year, p.month, p.p, periodChecks[b.id] || false)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.9rem' }}>{b.name}</span>
                      </div>
                      <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '0.9rem' }}>
                        {b.amount ? fmt(b.amount) : '—'}
                      </span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid #2d2d2d', marginTop: '0.5rem', marginBottom: '0.5rem' }} />
                </>
              )}

              {/* Investments */}
              {p.investmentBills.length > 0 && (
                <>
                  {p.investmentBills.map(b => (
                    <div key={b.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '0.4rem 0.5rem',
                      marginBottom: '0.25rem',
                      opacity: periodChecks[b.id] ? 0.5 : 1,
                      textDecoration: periodChecks[b.id] ? 'line-through' : 'none'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                        <input 
                          type="checkbox" 
                          checked={periodChecks[b.id] || false}
                          onChange={() => togglePaid(b.id, p.year, p.month, p.p, periodChecks[b.id] || false)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.9rem' }}>{b.name}</span>
                      </div>
                      <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '0.9rem' }}>
                        {b.amount ? fmt(b.amount) : '—'}
                      </span>
                    </div>
                  ))}
                  {p.otherBills && p.otherBills.length > 0 && <div style={{ borderTop: '1px solid #2d2d2d', marginTop: '0.5rem', marginBottom: '0.5rem' }} />}
                </>
              )}

              {/* Other Bills */}
              {p.otherBills && p.otherBills.length > 0 && (
                <>
                  {p.otherBills.map(b => (
                    <div key={b.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '0.4rem 0.5rem',
                      marginBottom: '0.25rem',
                      opacity: periodChecks[b.id] ? 0.5 : 1,
                      textDecoration: periodChecks[b.id] ? 'line-through' : 'none'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                        <input 
                          type="checkbox" 
                          checked={periodChecks[b.id] || false}
                          onChange={() => togglePaid(b.id, p.year, p.month, p.p, periodChecks[b.id] || false)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.9rem' }}>{b.name}</span>
                      </div>
                      <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '0.9rem' }}>
                        {b.amount ? fmt(b.amount) : '—'}
                      </span>
                    </div>
                  ))}
                </>
              )}

              {p.allBills.length === 0 && (
                <div style={{ color: '#999', textAlign: 'center', padding: '1rem', fontSize: '0.9rem' }}>No bills due this period</div>
              )}
            </div>

            <div style={{ borderTop: '2px solid #4ade80', paddingTop: '1rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Total Bills:</span>
                <span style={{ fontWeight: 600 }}>{fmt(p.transfer.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Total Income:</span>
                <span style={{ fontWeight: 600, color: '#4ade80' }}>{fmt(p.income.total)}</span>
              </div>
              <div style={{ borderTop: '2px solid #2d2d2d', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>Money Leftover:</span>
                  <span style={{ color: p.transfer.leftover >= 0 ? '#4ade80' : '#ef4444', fontSize: '1.1rem' }}>
                    {fmt(p.transfer.leftover)}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )})}
      </div>
    </div>
  );
}
function Bills({ data, reload }) {
  const [expanded, setExpanded] = useState({});
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [paidBills, setPaidBills] = useState({});

  const toggle = (cat) => setExpanded({ ...expanded, [cat]: !expanded[cat] });
  const togglePaid = (billId) => setPaidBills({ ...paidBills, [billId]: !paidBills[billId] });

  const categories = {
    'Credit Card': { icon: '💳', label: 'Credit Cards', bills: data.bills.filter(b => b.category === 'Credit Card' || b.category === 'Loan') },
    'Rent': { icon: '🏠', label: 'Rent', bills: data.bills.filter(b => b.category === 'Rent') },
    'Monthly': { icon: '🛒', label: 'Monthly Expenses', bills: data.bills.filter(b => ['Utility', 'Personal'].includes(b.category) && b.name !== 'Fundrise') },
    'Investment': { icon: '📈', label: 'Investments', bills: data.bills.filter(b => b.category === 'Investment' || b.name === 'Fundrise') }
  };

  // Split bills into 1st (1-14) and 15th (15-31) periods
  const splitBillsByPeriod = (bills) => {
    const first = bills.filter(b => b.due_date <= 14);
    const fifteenth = bills.filter(b => b.due_date >= 15);
    return { first, fifteenth };
  };

  const startEdit = (bill) => {
    setEditing(bill.id);
    setEditForm({
      id: bill.id,
      name: bill.name || '',
      default_amount: bill.default_amount || '',
      due_date: bill.due_date || 1,
      paid_by: bill.paid_by || 'Anseli',
      payment_method: bill.payment_method || '',
      varies: bill.varies || false
    });
  };

  const saveEdit = async () => {
    try {
      const updates = {
        name: editForm.name,
        default_amount: +editForm.default_amount || null,
        due_date: +editForm.due_date,
        paid_by: editForm.paid_by,
        payment_method: editForm.payment_method
      };
      
      await supabase.from('bills').update(updates).eq('id', editing);
      
      setEditing(null);
      setEditForm({});
      reload();
    } catch (error) {
      console.error('Error updating bill:', error);
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditForm({});
  };

  const deleteBill = async (id, name) => {
    if (window.confirm(`Delete "${name}"?`)) {
      await supabase.from('bills').delete().eq('id', id);
      reload();
    }
  };

  const addBill = async (category) => {
    const name = prompt('Bill name:');
    if (!name) return;
    
    const amount = prompt('Amount (leave empty if varies):');
    const paymentMethod = category === 'Monthly' ? prompt('Payment method (AMEX, Anseli Checking, etc.):') : null;
    
    await supabase.from('bills').insert([{
      name,
      default_amount: amount ? +amount : null,
      due_date: 1,
      category: category === 'Monthly' ? 'Personal' : category,
      paid_by: 'Anseli',
      payment_method: paymentMethod,
      varies: !amount,
      active: true
    }]);
    
    reload();
  };

  return (
    <div>
      <h1 style={s.h1}>Bills Management</h1>
      
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Credit Utilization Card */}
        {(() => {
          const totalBalance = data.cards.reduce((sum, c) => sum + +c.balance, 0);
          const totalLimit = data.cards.reduce((sum, c) => sum + (+c.credit_limit || 0), 0);
          const utilization = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;
          const utilizationColor = utilization < 30 ? '#4ade80' : utilization < 70 ? '#fbbf24' : '#ef4444';
          
          return (
            <Card t="💳 Credit Utilization">
              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.5rem' }}>Total Balance</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>{fmt(totalBalance)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.5rem' }}>Total Limit</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totalLimit > 0 ? fmt(totalLimit) : '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.5rem' }}>Utilization</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: utilizationColor }}>
                      {totalLimit > 0 ? `${utilization.toFixed(1)}%` : '—'}
                    </div>
                  </div>
                </div>
                {totalLimit > 0 && (
                  <div>
                    {/* Utilization Bar - Shows used credit */}
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>Credit Used</div>
                      <div style={{ height: '12px', background: '#1a1a1a', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${Math.min(utilization, 100)}%`, 
                          background: utilizationColor,
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                        {fmt(totalBalance)} of {fmt(totalLimit)}
                      </div>
                    </div>
                    
                    {/* Total Available Credit Bar - Always 100% */}
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>Total Credit Available</div>
                      <div style={{ height: '12px', background: '#1a1a1a', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          width: '100%', 
                          background: 'linear-gradient(90deg, #4ade80, #22c55e)',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                        {fmt(totalLimit - totalBalance)} remaining
                      </div>
                    </div>
                  </div>
                )}
                {totalLimit === 0 && (
                  <div style={{ padding: '1rem', background: '#1a1a1a', borderRadius: '6px', textAlign: 'center', color: '#999' }}>
                    Add credit limits on the Debt page to track utilization
                  </div>
                )}
              </div>
            </Card>
          );
        })()}

        {/* Monthly Overview Card */}
        {(() => {
          const creditCardTotal = data.cards.filter(c => c.min_payment > 0).reduce((sum, c) => sum + +c.min_payment, 0) + 
                                  data.loans.filter(l => l.monthly_payment > 0).reduce((sum, l) => sum + +l.monthly_payment, 0);
          const rentTotal = data.bills.filter(b => b.category === 'Rent').reduce((sum, b) => sum + (b.default_amount || 0), 0);
          const monthlyTotal = data.bills.filter(b => ['Utility', 'Personal'].includes(b.category) && b.name !== 'Fundrise').reduce((sum, b) => sum + (b.default_amount || 0), 0);
          const investmentTotal = data.bills.filter(b => b.category === 'Investment' || b.name === 'Fundrise').reduce((sum, b) => sum + (b.default_amount || 0), 0);
          const grandTotal = creditCardTotal + rentTotal + monthlyTotal + investmentTotal;
          
          return (
            <Card t="💰 Monthly Overview">
              <div style={{ padding: '1rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#4ade80', marginBottom: '1.5rem', textAlign: 'center' }}>
                  {fmt(grandTotal)}
                  <div style={{ fontSize: '0.85rem', color: '#999', fontWeight: 400, marginTop: '0.25rem' }}>Total Monthly Bills</div>
                </div>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#0a0a0a', borderRadius: '6px' }}>
                    <span style={{ color: '#999' }}>💳 Credit Cards</span>
                    <span style={{ fontWeight: 600 }}>{fmt(creditCardTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#0a0a0a', borderRadius: '6px' }}>
                    <span style={{ color: '#999' }}>🏠 Rent</span>
                    <span style={{ fontWeight: 600 }}>{fmt(rentTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#0a0a0a', borderRadius: '6px' }}>
                    <span style={{ color: '#999' }}>🛒 Monthly Expenses</span>
                    <span style={{ fontWeight: 600 }}>{fmt(monthlyTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#0a0a0a', borderRadius: '6px' }}>
                    <span style={{ color: '#999' }}>📈 Investments</span>
                    <span style={{ fontWeight: 600 }}>{fmt(investmentTotal)}</span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })()}
      </div>
      
      {Object.entries(categories).map(([key, { icon, label, bills }]) => {
        // For Credit Cards, calculate total from Debt page data (only non-zero)
        const total = key === 'Credit Card' 
          ? data.cards.filter(c => c.min_payment > 0).reduce((sum, c) => sum + +c.min_payment, 0) + 
            data.loans.filter(l => l.monthly_payment > 0).reduce((sum, l) => sum + +l.monthly_payment, 0)
          : bills.reduce((sum, b) => sum + (b.default_amount || 0), 0);
        
        const itemCount = key === 'Credit Card' 
          ? data.cards.filter(c => c.min_payment > 0).length + data.loans.filter(l => l.monthly_payment > 0).length
          : bills.length;
        
        const isExpanded = expanded[key];
        
        return (
          <div key={key} style={s.expCard}>
            <div style={s.expHeader} onClick={() => toggle(key)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{icon}</span>
                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: '0.9rem', color: '#999' }}>
                    {itemCount} {itemCount === 1 ? 'item' : 'items'} • {fmt(total)}/month
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '1.5rem', color: '#4ade80' }}>{isExpanded ? '−' : '+'}</span>
            </div>

            {isExpanded && (
              <div style={s.expBody}>
                {key === 'Credit Card' ? (
                  /* Credit Cards - Simple List */
                  <div style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {data.cards.filter(card => card.min_payment > 0).map(card => (
                        <div key={card.id} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.75rem', 
                          background: '#0a0a0a', 
                          borderRadius: '6px'
                        }}>
                          <div style={{ fontWeight: 500 }}>{card.name}</div>
                          <div style={{ fontWeight: 600, color: '#4ade80' }}>
                            {fmt(card.min_payment)}
                          </div>
                        </div>
                      ))}
                      {data.loans.filter(loan => loan.monthly_payment > 0).map(loan => (
                        <div key={loan.id} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.75rem', 
                          background: '#0a0a0a', 
                          borderRadius: '6px'
                        }}>
                          <div style={{ fontWeight: 500 }}>{loan.name}</div>
                          <div style={{ fontWeight: 600, color: '#4ade80' }}>
                            {fmt(loan.monthly_payment)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Rent, Monthly, Investments - Table Format like Debt Page */
                  <>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={s.th}>Name</th>
                          <th style={s.th}>Amount</th>
                          <th style={s.th}>Pay Period</th>
                          <th style={s.th}>Paid By</th>
                          {key === 'Monthly' && <th style={s.th}>Payment Method</th>}
                          <th style={s.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bills.map(bill => {
                          const isEditing = editing === bill.id;
                          return (
                            <tr key={bill.id}>
                              <td style={s.td}>
                                {isEditing ? (
                                  <input 
                                    value={editForm.name} 
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} 
                                    style={s.editInput} 
                                  />
                                ) : bill.name}
                              </td>
                              <td style={{ ...s.td, fontWeight: 600 }}>
                                {isEditing ? (
                                  <input 
                                    type="number" 
                                    step="0.01" 
                                    value={editForm.default_amount} 
                                    onChange={(e) => setEditForm({ ...editForm, default_amount: e.target.value })} 
                                    style={s.editInput} 
                                  />
                                ) : (bill.default_amount ? fmt(bill.default_amount) : '—')}
                              </td>
                              <td style={s.td}>
                                {isEditing ? (
                                  <select 
                                    value={editForm.due_date <= 14 ? '1st' : '15th'} 
                                    onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value === '1st' ? 1 : 15 })}
                                    style={s.editInput}
                                  >
                                    <option value="1st">1st</option>
                                    <option value="15th">15th</option>
                                  </select>
                                ) : (bill.due_date <= 14 ? '1st' : '15th')}
                              </td>
                              <td style={s.td}>
                                {isEditing ? (
                                  <select 
                                    value={editForm.paid_by} 
                                    onChange={(e) => setEditForm({ ...editForm, paid_by: e.target.value })}
                                    style={s.editInput}
                                  >
                                    <option value="Jorge">Jorge</option>
                                    <option value="Anseli">Anseli</option>
                                  </select>
                                ) : <Bdg g={bill.paid_by === 'Anseli'}>{bill.paid_by}</Bdg>}
                              </td>
                              {key === 'Monthly' && (
                                <td style={s.td}>
                                  {isEditing ? (
                                    <select 
                                      value={editForm.payment_method || ''} 
                                      onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}
                                      style={s.editInput}
                                    >
                                      <option value="">Select...</option>
                                      <option value="AMEX">AMEX</option>
                                      <option value="Jorge Visa">Jorge Visa</option>
                                      <option value="Anseli Visa">Anseli Visa</option>
                                      <option value="Jorge Checking">Jorge Checking</option>
                                      <option value="Anseli Checking">Anseli Checking</option>
                                      <option value="Anseli Bank Account">Anseli Bank Account</option>
                                    </select>
                                  ) : (
                                    <span style={{ fontSize: '0.85rem', color: '#999' }}>{bill.payment_method || '—'}</span>
                                  )}
                                </td>
                              )}
                              <td style={s.td}>
                                {isEditing ? (
                                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <Btn sm onClick={saveEdit}>Save</Btn>
                                    <Btn sm sec onClick={cancelEdit}>Cancel</Btn>
                                    <button onClick={() => deleteBill(editForm.id, editForm.name)} style={{...s.iconBtn, color: '#ef4444'}} title="Delete">🗑️</button>
                                  </div>
                                ) : (
                                  <button onClick={() => startEdit(bill)} style={s.iconBtn} title="Edit">✏️</button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div style={{ padding: '1rem', borderTop: '1px solid #2d2d2d' }}>
                      <Btn onClick={() => addBill(key)}>
                        + Add {key === 'Rent' ? 'Rent' : label === 'Monthly Expenses' ? 'Expense' : 'Investment'}
                      </Btn>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Budget Planning Notes Section */}
      <BudgetPlanning data={data} reload={reload} />
    </div>
  );
}

function BudgetPlanning({ data, reload }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [saving, setSaving] = useState(false);

  const notes = data.notes || [];

  const startEdit = (note) => {
    setEditing(note.id);
    setForm({ title: note.title, content: note.content });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({ title: '', content: '' });
  };

  const saveEdit = async (note) => {
    if (!form.title.trim()) {
      alert('Please enter a title');
      return;
    }
    setSaving(true);
    await supabase.from('budget_notes').update({
      title: form.title,
      content: form.content,
      updated_at: new Date().toISOString()
    }).eq('id', note.id);
    setEditing(null);
    setSaving(false);
    reload();
  };

  const deleteNote = async (id, title) => {
    if (!window.confirm(`Delete note "${title}"?`)) return;
    await supabase.from('budget_notes').delete().eq('id', id);
    reload();
  };

  const addNote = async () => {
    if (!newNote.title.trim()) {
      alert('Please enter a title');
      return;
    }
    await supabase.from('budget_notes').insert({
      title: newNote.title,
      content: newNote.content
    });
    setAdding(false);
    setNewNote({ title: '', content: '' });
    reload();
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div style={{ 
      background: '#1a1a1a', 
      border: '1px solid #2d2d2d', 
      borderRadius: '12px', 
      overflow: 'hidden',
      marginTop: '1.5rem'
    }}>
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ 
          padding: '1.5rem', 
          cursor: 'pointer', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: expanded ? '1px solid #2d2d2d' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.5rem' }}>📝</span>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>Budget Planning</h3>
            <p style={{ fontSize: '0.9rem', color: '#999', margin: 0 }}>{notes.length} notes</p>
          </div>
        </div>
        <span style={{ fontSize: '1.5rem', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>
          ▼
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '1.5rem' }}>
          {/* Add Note Button */}
          <div style={{ marginBottom: '1.5rem' }}>
            <Btn onClick={() => setAdding(!adding)}>
              {adding ? 'Cancel' : '+ Add Note'}
            </Btn>
          </div>

          {/* Add Note Form */}
          {adding && (
            <div style={{ 
              background: '#0a0a0a', 
              border: '1px solid #2d2d2d', 
              borderRadius: '8px', 
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                  Title
                </label>
                <input
                  type="text"
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  style={s.input}
                  placeholder="Budget review, savings goals, etc."
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                  Notes
                </label>
                <textarea
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  style={{ ...s.input, minHeight: '120px', resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="Add your budget planning notes here..."
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Btn onClick={addNote}>Save Note</Btn>
                <Btn sec onClick={() => { setAdding(false); setNewNote({ title: '', content: '' }); }}>
                  Cancel
                </Btn>
              </div>
            </div>
          )}

          {/* Notes List */}
          {notes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
              No budget planning notes yet. Click "Add Note" to get started.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {notes.map(note => (
                <div 
                  key={note.id}
                  style={{ 
                    background: '#0a0a0a', 
                    border: '1px solid #2d2d2d', 
                    borderRadius: '8px', 
                    padding: '1.5rem'
                  }}
                >
                  {editing === note.id ? (
                    <>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                          Title
                        </label>
                        <input
                          type="text"
                          value={form.title}
                          onChange={(e) => setForm({ ...form, title: e.target.value })}
                          style={s.input}
                        />
                      </div>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                          Notes
                        </label>
                        <textarea
                          value={form.content}
                          onChange={(e) => setForm({ ...form, content: e.target.value })}
                          style={{ ...s.input, minHeight: '120px', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Btn sm onClick={() => saveEdit(note)} disabled={saving}>
                          {saving ? 'Saving...' : 'Save'}
                        </Btn>
                        <Btn sm sec onClick={cancelEdit}>Cancel</Btn>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                            {note.title}
                          </h4>
                          <p style={{ fontSize: '0.85rem', color: '#999', margin: 0 }}>
                            {note.updated_at !== note.created_at && 'Updated '}
                            {formatTimestamp(note.updated_at || note.created_at)}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => startEdit(note)} style={s.iconBtn} title="Edit">✏️</button>
                          <button onClick={() => deleteNote(note.id, note.title)} style={{...s.iconBtn, color: '#ef4444'}} title="Delete">🗑️</button>
                        </div>
                      </div>
                      {note.content && (
                        <p style={{ 
                          color: '#e0e0e0', 
                          lineHeight: '1.6', 
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordWrap: 'break-word'
                        }}>
                          {note.content}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Subscriptions({ data, reload }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [adding, setAdding] = useState(false);
  const [newSub, setNewSub] = useState({ name: '', amount: '', due_date: '', frequency: 'Monthly' });
  const [filter, setFilter] = useState('All');
  const [saving, setSaving] = useState(false);

  const subscriptions = data.subscriptions || [];
  
  // Calculate totals by frequency
  const monthlyTotal = subscriptions.filter(s => s.frequency === 'Monthly').reduce((sum, s) => sum + +s.amount, 0);
  const quarterlyTotal = subscriptions.filter(s => s.frequency === 'Quarterly').reduce((sum, s) => sum + +s.amount, 0);
  const sixMonthsTotal = subscriptions.filter(s => s.frequency === '6 Months').reduce((sum, s) => sum + +s.amount, 0);
  const yearlyTotal = subscriptions.filter(s => s.frequency === 'Yearly').reduce((sum, s) => sum + +s.amount, 0);
  
  // Calculate annual cost (convert all to yearly)
  const annualCost = (monthlyTotal * 12) + (quarterlyTotal * 4) + (sixMonthsTotal * 2) + yearlyTotal;
  const monthlyAverage = annualCost / 12;
  
  // Filter and sort subscriptions by due date
  const filtered = (filter === 'All' ? subscriptions : subscriptions.filter(s => s.frequency === filter))
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const startEdit = (sub) => {
    setEditing(sub.id);
    setForm({ ...sub });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({});
  };

  const save = async (sub) => {
    setSaving(true);
    await supabase.from('subscriptions').update({
      name: form.name,
      amount: +form.amount,
      due_date: form.due_date,
      frequency: form.frequency,
      updated_at: new Date().toISOString()
    }).eq('id', sub.id);
    setEditing(null);
    setSaving(false);
    reload();
  };

  const deleteSub = async (id) => {
    if (!window.confirm('Delete this subscription?')) return;
    await supabase.from('subscriptions').update({ active: false }).eq('id', id);
    reload();
  };

  const addNew = async () => {
    if (!newSub.name || !newSub.amount || !newSub.due_date) {
      alert('Please fill in all fields');
      return;
    }
    await supabase.from('subscriptions').insert({
      name: newSub.name,
      amount: +newSub.amount,
      due_date: newSub.due_date,
      frequency: newSub.frequency,
      active: true
    });
    setAdding(false);
    setNewSub({ name: '', amount: '', due_date: '', frequency: 'Monthly' });
    reload();
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div>
      <h1 style={s.h1}>Subscriptions</h1>

      {/* Annual Total Hero Card */}
      <Card>
        <div style={{ textAlign: 'center', padding: '1.5rem' }}>
          <div style={{ fontSize: '0.9rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            💰 Total Annual Subscription Cost
          </div>
          <div style={{ fontSize: '3.5rem', fontWeight: 700, color: '#4ade80', marginBottom: '1rem' }}>
            {fmt(annualCost)}
          </div>
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap', color: '#999', fontSize: '0.9rem' }}>
            <div>
              <div style={{ color: '#666', fontSize: '0.85rem' }}>Monthly Average</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#4ade80' }}>{fmt(monthlyAverage)}</div>
            </div>
            <div>
              <div style={{ color: '#666', fontSize: '0.85rem' }}>Total Subscriptions</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#4ade80' }}>{subscriptions.length}</div>
            </div>
          </div>
          
          {/* Breakdown */}
          <div style={{ 
            marginTop: '1.5rem', 
            paddingTop: '1.5rem', 
            borderTop: '1px solid #2d2d2d',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem',
            fontSize: '0.85rem'
          }}>
            <div>
              <div style={{ color: '#666', marginBottom: '0.25rem' }}>Monthly × 12</div>
              <div style={{ color: '#e0e0e0', fontWeight: 500 }}>
                {fmt(monthlyTotal)} × 12 = {fmt(monthlyTotal * 12)}
              </div>
            </div>
            <div>
              <div style={{ color: '#666', marginBottom: '0.25rem' }}>Quarterly × 4</div>
              <div style={{ color: '#e0e0e0', fontWeight: 500 }}>
                {fmt(quarterlyTotal)} × 4 = {fmt(quarterlyTotal * 4)}
              </div>
            </div>
            <div>
              <div style={{ color: '#666', marginBottom: '0.25rem' }}>6 Months × 2</div>
              <div style={{ color: '#e0e0e0', fontWeight: 500 }}>
                {fmt(sixMonthsTotal)} × 2 = {fmt(sixMonthsTotal * 2)}
              </div>
            </div>
            <div>
              <div style={{ color: '#666', marginBottom: '0.25rem' }}>Yearly × 1</div>
              <div style={{ color: '#e0e0e0', fontWeight: 500 }}>
                {fmt(yearlyTotal)} × 1 = {fmt(yearlyTotal)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Frequency Breakdown Cards */}
      <div style={s.grid}>
        <Card t="💰 Monthly">
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#4ade80', marginBottom: '0.5rem' }}>
              {fmt(monthlyTotal)}
            </div>
            <div style={{ color: '#999', fontSize: '0.9rem' }}>
              {subscriptions.filter(s => s.frequency === 'Monthly').length} subscriptions
            </div>
          </div>
        </Card>

        <Card t="📅 Quarterly">
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#4ade80', marginBottom: '0.5rem' }}>
              {fmt(quarterlyTotal)}
            </div>
            <div style={{ color: '#999', fontSize: '0.9rem' }}>
              {subscriptions.filter(s => s.frequency === 'Quarterly').length} subscriptions
            </div>
          </div>
        </Card>

        <Card t="📆 6 Months">
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#4ade80', marginBottom: '0.5rem' }}>
              {fmt(sixMonthsTotal)}
            </div>
            <div style={{ color: '#999', fontSize: '0.9rem' }}>
              {subscriptions.filter(s => s.frequency === '6 Months').length} subscriptions
            </div>
          </div>
        </Card>

        <Card t="🗓️ Yearly">
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#4ade80', marginBottom: '0.5rem' }}>
              {fmt(yearlyTotal)}
            </div>
            <div style={{ color: '#999', fontSize: '0.9rem' }}>
              {subscriptions.filter(s => s.frequency === 'Yearly').length} subscriptions
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {['All', 'Monthly', 'Quarterly', '6 Months', 'Yearly'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.5rem 1rem',
              background: filter === f ? '#4ade80' : '#1a1a1a',
              color: filter === f ? '#000' : '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: filter === f ? 600 : 400,
              fontSize: '0.9rem'
            }}
          >
            {f}
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <Btn onClick={() => setAdding(!adding)}>
            {adding ? 'Cancel' : '+ Add Subscription'}
          </Btn>
        </div>
      </div>

      {/* Add New Subscription Form */}
      {adding && (
        <Card t="Add New Subscription">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                Name
              </label>
              <input
                type="text"
                value={newSub.name}
                onChange={(e) => setNewSub({ ...newSub, name: e.target.value })}
                style={s.input}
                placeholder="Netflix, Spotify, etc."
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={newSub.amount}
                onChange={(e) => setNewSub({ ...newSub, amount: e.target.value })}
                style={s.input}
                placeholder="15.99"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                Due Date
              </label>
              <input
                type="date"
                value={newSub.due_date}
                onChange={(e) => setNewSub({ ...newSub, due_date: e.target.value })}
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                style={{ 
                  ...s.input,
                  cursor: 'pointer'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                Frequency
              </label>
              <select
                value={newSub.frequency}
                onChange={(e) => setNewSub({ ...newSub, frequency: e.target.value })}
                style={s.input}
              >
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="6 Months">6 Months</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Btn onClick={addNew}>Add Subscription</Btn>
            <Btn sec onClick={() => { setAdding(false); setNewSub({ name: '', amount: '', due_date: '', frequency: 'Monthly' }); }}>
              Cancel
            </Btn>
          </div>
        </Card>
      )}

      {/* Subscriptions Table */}
      <Card t={`${filter} Subscriptions (${filtered.length})`}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
            No {filter !== 'All' ? filter.toLowerCase() : ''} subscriptions yet. Click "Add Subscription" to get started.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #2d2d2d' }}>
                  <th style={{ ...s.th, textAlign: 'left' }}>Name</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Due Date</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Amount</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Frequency</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(sub => (
                  <tr key={sub.id} style={{ borderBottom: '1px solid #2d2d2d' }}>
                    {editing === sub.id ? (
                      <>
                        <td style={s.td}>
                          <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            style={{ ...s.input, width: '100%' }}
                          />
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          <input
                            type="date"
                            value={form.due_date}
                            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                            onClick={(e) => e.target.showPicker && e.target.showPicker()}
                            style={{ 
                              ...s.input, 
                              width: '150px', 
                              textAlign: 'center',
                              cursor: 'pointer'
                            }}
                          />
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={form.amount}
                            onChange={(e) => setForm({ ...form, amount: e.target.value })}
                            style={{ ...s.input, width: '100px', textAlign: 'center' }}
                          />
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          <select
                            value={form.frequency}
                            onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                            style={{ ...s.input, width: '120px' }}
                          >
                            <option value="Monthly">Monthly</option>
                            <option value="Quarterly">Quarterly</option>
                            <option value="6 Months">6 Months</option>
                            <option value="Yearly">Yearly</option>
                          </select>
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <Btn sm onClick={() => save(sub)} disabled={saving}>
                              {saving ? '...' : '✓'}
                            </Btn>
                            <Btn sm sec onClick={cancelEdit}>✕</Btn>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ ...s.td, fontWeight: 500 }}>{sub.name}</td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          {formatDate(sub.due_date)}
                        </td>
                        <td style={{ ...s.td, textAlign: 'center', fontWeight: 600, color: '#4ade80' }}>
                          {fmt(sub.amount)}
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            background: sub.frequency === 'Monthly' ? '#1a4d2e' : 
                                       sub.frequency === 'Quarterly' ? '#1a3a4d' :
                                       sub.frequency === '6 Months' ? '#4d1a3a' : '#4d3a1a',
                            borderRadius: '12px',
                            fontSize: '0.85rem'
                          }}>
                            {sub.frequency}
                          </span>
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button onClick={() => startEdit(sub)} style={s.iconBtn} title="Edit">✏️</button>
                            <button onClick={() => deleteSub(sub.id)} style={s.iconBtn} title="Delete">🗑️</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Debt({ data, reload }) {
  const [editingCard, setEditingCard] = useState(null);
  const [editingLoan, setEditingLoan] = useState(null);
  const [cardForm, setCardForm] = useState({});
  const [loanForm, setLoanForm] = useState({});
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  
  const cardDebt = data.cards.reduce((s, c) => s + +c.balance, 0);
  const loanDebt = data.loans.reduce((s, l) => s + +l.balance, 0);
  
  // Calculate debt by owner
  const jorgeCardDebt = data.cards.filter(c => c.owned_by === 'Jorge').reduce((s, c) => s + +c.balance, 0);
  const anseliCardDebt = data.cards.filter(c => c.owned_by === 'Anseli').reduce((s, c) => s + +c.balance, 0);
  const jorgeTotalDebt = jorgeCardDebt + loanDebt; // Assuming loans are shared or Jorge's
  const anseliTotalDebt = anseliCardDebt;

  const startEditCard = (card) => {
    setEditingCard(card.id);
    setCardForm({
      id: card.id,
      name: card.name || '',
      balance: card.balance || 0,
      credit_limit: card.credit_limit || '',
      min_payment: card.min_payment || 0,
      apr: card.apr || 0,
      owned_by: card.owned_by || 'Jorge',
      due_date: card.due_date || 1
    });
  };

  const saveCard = async () => {
    try {
      await supabase.from('credit_cards').update({
        name: cardForm.name,
        balance: +cardForm.balance,
        credit_limit: +cardForm.credit_limit || null,
        min_payment: +cardForm.min_payment,
        apr: +cardForm.apr,
        owned_by: cardForm.owned_by,
        due_date: +cardForm.due_date
      }).eq('id', editingCard);
      setEditingCard(null);
      setCardForm({});
      reload();
    } catch (error) {
      console.error('Error updating card:', error);
    }
  };

  const cancelEditCard = () => {
    setEditingCard(null);
    setCardForm({});
  };

  const deleteCard = async (id, name) => {
    if (window.confirm(`Delete "${name}"?`)) {
      await supabase.from('credit_cards').delete().eq('id', id);
      reload();
    }
  };

  const addCard = async () => {
    const name = prompt('Card name:');
    if (!name) return;
    const balance = prompt('Balance:') || 0;
    const minPayment = prompt('Minimum payment:') || 0;
    const apr = prompt('APR (%):') || 0;
    const dueDate = prompt('Due date (1-31):') || 1;
    
    await supabase.from('credit_cards').insert([{
      name,
      balance: +balance,
      min_payment: +minPayment,
      apr: +apr,
      due_date: +dueDate,
      owned_by: 'Jorge',
      active: true
    }]);
    reload();
  };

  const startEditLoan = (loan) => {
    setEditingLoan(loan.id);
    setLoanForm({
      id: loan.id,
      name: loan.name || '',
      balance: loan.balance || 0,
      monthly_payment: loan.monthly_payment || 0,
      apr: loan.apr || 0
    });
  };

  const saveLoan = async () => {
    try {
      await supabase.from('loans').update({
        name: loanForm.name,
        balance: +loanForm.balance,
        monthly_payment: +loanForm.monthly_payment,
        apr: +loanForm.apr
      }).eq('id', editingLoan);
      setEditingLoan(null);
      setLoanForm({});
      reload();
    } catch (error) {
      console.error('Error updating loan:', error);
    }
  };

  const cancelEditLoan = () => {
    setEditingLoan(null);
    setLoanForm({});
  };

  const deleteLoan = async (id, name) => {
    if (window.confirm(`Delete "${name}"?`)) {
      await supabase.from('loans').delete().eq('id', id);
      reload();
    }
  };

  const addLoan = async () => {
    const name = prompt('Loan name:');
    if (!name) return;
    const balance = prompt('Balance:') || 0;
    const payment = prompt('Monthly payment:') || 0;
    const apr = prompt('APR (%):') || 0;
    
    await supabase.from('loans').insert([{
      name,
      balance: +balance,
      monthly_payment: +payment,
      apr: +apr,
      active: true
    }]);
    reload();
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const sortedCards = [...data.cards].sort((a, b) => {
    let aVal, bVal;
    if (sortBy === 'balance') {
      aVal = +a.balance;
      bVal = +b.balance;
    } else if (sortBy === 'due_date') {
      aVal = +a.due_date;
      bVal = +b.due_date;
    } else if (sortBy === 'owner') {
      aVal = a.owned_by;
      bVal = b.owned_by;
    } else {
      aVal = a.name;
      bVal = b.name;
    }
    
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div>
      <h1 style={s.h1}>Debt Overview</h1>
      <div style={s.grid}>
        <StatCard l="Total Debt" v={fmt(cardDebt + loanDebt)} />
        <StatCard l="Credit Cards" v={fmt(cardDebt)} />
        <StatCard l="Loans" v={fmt(loanDebt)} />
        <StatCard l="Jorge's Debt" v={fmt(jorgeTotalDebt)} />
        <StatCard l="Anseli's Debt" v={fmt(anseliTotalDebt)} />
      </div>

      <Card t="Credit Cards">
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Card</th>
              <th style={{ ...s.th, cursor: 'pointer' }} onClick={() => handleSort('balance')}>
                Balance {sortBy === 'balance' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th style={s.th}>Credit Limit</th>
              <th style={s.th}>Min Payment</th>
              <th style={{ ...s.th, cursor: 'pointer' }} onClick={() => handleSort('due_date')}>
                Due {sortBy === 'due_date' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th style={s.th}>APR</th>
              <th style={{ ...s.th, cursor: 'pointer' }} onClick={() => handleSort('owner')}>
                Owner {sortBy === 'owner' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedCards.map(c => {
              const isEditing = editingCard === c.id;
              return (
                <tr key={c.id}>
                  <td style={s.td}>
                    {isEditing ? (
                      <input value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} style={s.editInput} />
                    ) : c.name}
                  </td>
                  <td style={{ ...s.td, fontWeight: 600 }}>
                    {isEditing ? (
                      <input type="number" step="0.01" value={cardForm.balance} onChange={(e) => setCardForm({ ...cardForm, balance: e.target.value })} style={s.editInput} />
                    ) : fmt(c.balance)}
                  </td>
                  <td style={s.td}>
                    {isEditing ? (
                      <input type="number" step="0.01" value={cardForm.credit_limit || ''} onChange={(e) => setCardForm({ ...cardForm, credit_limit: e.target.value })} style={s.editInput} placeholder="Limit" />
                    ) : (c.credit_limit ? fmt(c.credit_limit) : '—')}
                  </td>
                  <td style={s.td}>
                    {isEditing ? (
                      <input type="number" step="0.01" value={cardForm.min_payment} onChange={(e) => setCardForm({ ...cardForm, min_payment: e.target.value })} style={s.editInput} />
                    ) : fmt(c.min_payment)}
                  </td>
                  <td style={s.td}>
                    {isEditing ? (
                      <input type="number" min="1" max="31" value={cardForm.due_date} onChange={(e) => setCardForm({ ...cardForm, due_date: e.target.value })} style={s.editInput} />
                    ) : `${c.due_date}${c.due_date === 1 ? 'st' : c.due_date === 2 ? 'nd' : c.due_date === 3 ? 'rd' : 'th'}`}
                  </td>
                  <td style={s.td}>
                    {isEditing ? (
                      <input type="number" step="0.01" value={cardForm.apr} onChange={(e) => setCardForm({ ...cardForm, apr: e.target.value })} style={s.editInput} />
                    ) : `${c.apr}%`}
                  </td>
                  <td style={s.td}>
                    {isEditing ? (
                      <select value={cardForm.owned_by} onChange={(e) => setCardForm({ ...cardForm, owned_by: e.target.value })} style={s.editInput}>
                        <option value="Jorge">Jorge</option>
                        <option value="Anseli">Anseli</option>
                      </select>
                    ) : <Bdg g={c.owned_by === 'Anseli'}>{c.owned_by}</Bdg>}
                  </td>
                  <td style={s.td}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Btn sm onClick={saveCard}>Save</Btn>
                        <Btn sm sec onClick={cancelEditCard}>Cancel</Btn>
                        <button onClick={() => deleteCard(c.id, c.name)} style={{...s.iconBtn, color: '#ef4444'}} title="Delete">🗑️</button>
                      </div>
                    ) : (
                      <button onClick={() => startEditCard(c)} style={s.iconBtn} title="Edit">✏️</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: '1rem', borderTop: '1px solid #2d2d2d' }}>
          <Btn onClick={addCard}>+ Add Credit Card</Btn>
        </div>
      </Card>

      <Card t="Loans">
        <table style={s.table}>
          <thead>
            <tr>{['Loan', 'Balance', 'Payment', 'APR', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {data.loans.map(l => {
              const isEditing = editingLoan === l.id;
              return (
                <tr key={l.id}>
                  <td style={s.td}>
                    {isEditing ? (
                      <input value={loanForm.name} onChange={(e) => setLoanForm({ ...loanForm, name: e.target.value })} style={s.editInput} />
                    ) : l.name}
                  </td>
                  <td style={{ ...s.td, fontWeight: 600 }}>
                    {isEditing ? (
                      <input type="number" step="0.01" value={loanForm.balance} onChange={(e) => setLoanForm({ ...loanForm, balance: e.target.value })} style={s.editInput} />
                    ) : fmt(l.balance)}
                  </td>
                  <td style={s.td}>
                    {isEditing ? (
                      <input type="number" step="0.01" value={loanForm.monthly_payment} onChange={(e) => setLoanForm({ ...loanForm, monthly_payment: e.target.value })} style={s.editInput} />
                    ) : fmt(l.monthly_payment)}
                  </td>
                  <td style={s.td}>
                    {isEditing ? (
                      <input type="number" step="0.01" value={loanForm.apr} onChange={(e) => setLoanForm({ ...loanForm, apr: e.target.value })} style={s.editInput} />
                    ) : `${l.apr}%`}
                  </td>
                  <td style={s.td}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Btn sm onClick={saveLoan}>Save</Btn>
                        <Btn sm sec onClick={cancelEditLoan}>Cancel</Btn>
                        <button onClick={() => deleteLoan(l.id, l.name)} style={{...s.iconBtn, color: '#ef4444'}} title="Delete">🗑️</button>
                      </div>
                    ) : (
                      <button onClick={() => startEditLoan(l)} style={s.iconBtn} title="Edit">✏️</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: '1rem', borderTop: '1px solid #2d2d2d' }}>
          <Btn onClick={addLoan}>+ Add Loan</Btn>
        </div>
      </Card>
    </div>
  );
}

function Settings({ data, reload }) {
  const [jorge, setJorge] = useState(null);
  const [anseli, setAnseli] = useState(null);
  const [editingJorge, setEditingJorge] = useState(false);
  const [editingAnseli, setEditingAnseli] = useState(false);
  const [jorgeForm, setJorgeForm] = useState({});
  const [anseliForm, setAnseliForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const j = data.income.find(s => s.person === 'Jorge');
    const a = data.income.find(s => s.person === 'Anseli');
    setJorge(j);
    setAnseli(a);
    // Ensure dates are in YYYY-MM-DD format for date inputs
    setJorgeForm({
      ...j,
      next_pay_date: j?.next_pay_date ? j.next_pay_date : ''
    });
    setAnseliForm({
      ...a,
      next_pay_date: a?.next_pay_date ? a.next_pay_date : ''
    });
  }, [data]);

  const saveJorge = async () => {
    setSaving(true);
    await supabase.from('income_sources').update({
      amount: +jorgeForm.amount,
      next_pay_date: jorgeForm.next_pay_date
    }).eq('id', jorge.id);
    setEditingJorge(false);
    setSaving(false);
    reload();
  };

  const saveAnseli = async () => {
    setSaving(true);
    await supabase.from('income_sources').update({
      amount: +anseliForm.amount,
      next_pay_date: anseliForm.next_pay_date
    }).eq('id', anseli.id);
    setEditingAnseli(false);
    setSaving(false);
    reload();
  };

  if (!jorge || !anseli) return <div style={s.loading}>Loading...</div>;

  const totalBiweekly = +jorge.amount + +anseli.amount;
  const totalMonthly = totalBiweekly * 2;
  const jorgeMonthly = +jorge.amount * 2;
  const anseliMonthly = +anseli.amount * 2;

  return (
    <div>
      <h1 style={s.h1}>Settings</h1>

      {/* Summary Card at Top */}
      <Card t="Combined Income">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', background: '#0a0a0a', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.5rem' }}>Bi-weekly Total</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#4ade80' }}>${totalBiweekly.toLocaleString()}</div>
          </div>
          <div style={{ padding: '1rem', background: '#0a0a0a', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.5rem' }}>Monthly Total (approx)</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#4ade80' }}>${Math.round(totalMonthly).toLocaleString()}</div>
          </div>
        </div>

        <h3 style={{ ...s.h3, marginBottom: '1rem' }}>Individual Monthly Income</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: '#0a0a0a', borderRadius: '8px', border: '1px solid #4ade80' }}>
            <div style={{ fontSize: '0.9rem', color: '#4ade80', marginBottom: '0.5rem', fontWeight: 600 }}>Jorge</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>${Math.round(jorgeMonthly).toLocaleString()}</div>
            <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>per month</div>
          </div>
          <div style={{ padding: '1rem', background: '#0a0a0a', borderRadius: '8px', border: '1px solid #4ade80' }}>
            <div style={{ fontSize: '0.9rem', color: '#4ade80', marginBottom: '0.5rem', fontWeight: 600 }}>Anseli</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>${Math.round(anseliMonthly).toLocaleString()}</div>
            <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>per month</div>
          </div>
        </div>
      </Card>

      {/* Jorge Card */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ ...s.h2, margin: 0, color: '#4ade80' }}>Jorge</h2>
          {!editingJorge && (
            <button onClick={() => setEditingJorge(true)} style={s.iconBtn} title="Edit">✏️</button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', fontWeight: 500 }}>
              Paycheck Amount
            </label>
            {editingJorge ? (
              <input
                type="number"
                step="0.01"
                value={jorgeForm.amount}
                onChange={(e) => setJorgeForm({ ...jorgeForm, amount: e.target.value })}
                style={{ ...s.input, padding: '0.5rem' }}
              />
            ) : (
              <div style={{ fontSize: '1.3rem', fontWeight: 600, color: '#4ade80' }}>
                ${(+jorge.amount).toLocaleString()}
              </div>
            )}
            <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>Every 2 weeks</div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', fontWeight: 500 }}>
              Next Pay Date
            </label>
            {editingJorge ? (
              <input
                type="date"
                value={jorgeForm.next_pay_date || ''}
                onChange={(e) => setJorgeForm({ ...jorgeForm, next_pay_date: e.target.value })}
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                style={{ 
                  ...s.input, 
                  padding: '0.5rem',
                  cursor: 'pointer'
                }}
              />
            ) : (
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {jorge.next_pay_date ? new Date(jorge.next_pay_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
              </div>
            )}
            <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>Bi-weekly</div>
          </div>
        </div>

        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#0a0a0a', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.85rem', color: '#999' }}>Monthly (approx)</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#4ade80' }}>
            ${Math.round((+jorge.amount) * 2).toLocaleString()}
          </div>
        </div>

        {editingJorge && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Btn onClick={saveJorge} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Btn>
            <Btn sec onClick={() => { setEditingJorge(false); setJorgeForm(jorge); }}>
              Cancel
            </Btn>
          </div>
        )}
      </Card>

      {/* Anseli Card */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ ...s.h2, margin: 0, color: '#4ade80' }}>Anseli</h2>
          {!editingAnseli && (
            <button onClick={() => setEditingAnseli(true)} style={s.iconBtn} title="Edit">✏️</button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', fontWeight: 500 }}>
              Paycheck Amount
            </label>
            {editingAnseli ? (
              <input
                type="number"
                step="0.01"
                value={anseliForm.amount}
                onChange={(e) => setAnseliForm({ ...anseliForm, amount: e.target.value })}
                style={{ ...s.input, padding: '0.5rem' }}
              />
            ) : (
              <div style={{ fontSize: '1.3rem', fontWeight: 600, color: '#4ade80' }}>
                ${(+anseli.amount).toLocaleString()}
              </div>
            )}
            <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>Every 2 weeks</div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', fontWeight: 500 }}>
              Next Pay Date
            </label>
            {editingAnseli ? (
              <input
                type="date"
                value={anseliForm.next_pay_date || ''}
                onChange={(e) => setAnseliForm({ ...anseliForm, next_pay_date: e.target.value })}
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                style={{ 
                  ...s.input, 
                  padding: '0.5rem',
                  cursor: 'pointer'
                }}
              />
            ) : (
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {anseli.next_pay_date ? new Date(anseli.next_pay_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
              </div>
            )}
            <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>Bi-weekly</div>
          </div>
        </div>

        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#0a0a0a', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.85rem', color: '#999' }}>Monthly (approx)</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#4ade80' }}>
            ${Math.round((+anseli.amount) * 2).toLocaleString()}
          </div>
        </div>

        {editingAnseli && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Btn onClick={saveAnseli} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Btn>
            <Btn sec onClick={() => { setEditingAnseli(false); setAnseliForm(anseli); }}>
              Cancel
            </Btn>
          </div>
        )}
      </Card>

      {/* Backup & Export Section */}
      <BackupExport data={data} />
    </div>
  );
}

function BackupExport({ data }) {
  const [expanded, setExpanded] = useState(false);
  const [lastExport, setLastExport] = useState(null);

  // Load last export date from localStorage
  useState(() => {
    const saved = localStorage.getItem('lastExportDate');
    if (saved) setLastExport(new Date(saved));
  }, []);

  const exportAllJSON = () => {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      data: {
        income: data.income,
        bills: data.bills,
        cards: data.cards,
        loans: data.loans,
        subscriptions: data.subscriptions,
        notes: data.notes
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medina-budget-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    const now = new Date();
    setLastExport(now);
    localStorage.setItem('lastExportDate', now.toISOString());
  };

  const exportCSV = (tableName, tableData) => {
    if (!tableData || tableData.length === 0) {
      alert(`No data in ${tableName} to export`);
      return;
    }

    // Get all unique keys from the data
    const keys = Object.keys(tableData[0]);
    
    // Create CSV header
    const csv = [
      keys.join(','),
      ...tableData.map(row => 
        keys.map(key => {
          const val = row[key];
          // Handle values with commas, quotes, or newlines
          if (val === null || val === undefined) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableName.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);

        if (!importData.version || !importData.data) {
          alert('Invalid backup file format');
          return;
        }

        const confirmed = window.confirm(
          `⚠️ WARNING: This will replace all current data!\n\n` +
          `Backup contains:\n` +
          `- ${importData.data.income?.length || 0} income sources\n` +
          `- ${importData.data.bills?.length || 0} bills\n` +
          `- ${importData.data.cards?.length || 0} credit cards\n` +
          `- ${importData.data.loans?.length || 0} loans\n` +
          `- ${importData.data.subscriptions?.length || 0} subscriptions\n` +
          `- ${importData.data.notes?.length || 0} notes\n\n` +
          `Continue with import?`
        );

        if (!confirmed) return;

        // Import data to Supabase
        const importPromises = [];

        // Delete existing data and import new (for each table)
        if (importData.data.income) {
          importPromises.push(
            supabase.from('income_sources').delete().neq('id', '00000000-0000-0000-0000-000000000000')
              .then(() => supabase.from('income_sources').insert(importData.data.income.map(i => ({ ...i, id: undefined }))))
          );
        }
        if (importData.data.bills) {
          importPromises.push(
            supabase.from('bills').delete().neq('id', '00000000-0000-0000-0000-000000000000')
              .then(() => supabase.from('bills').insert(importData.data.bills.map(b => ({ ...b, id: undefined }))))
          );
        }
        if (importData.data.cards) {
          importPromises.push(
            supabase.from('credit_cards').delete().neq('id', '00000000-0000-0000-0000-000000000000')
              .then(() => supabase.from('credit_cards').insert(importData.data.cards.map(c => ({ ...c, id: undefined }))))
          );
        }
        if (importData.data.loans) {
          importPromises.push(
            supabase.from('loans').delete().neq('id', '00000000-0000-0000-0000-000000000000')
              .then(() => supabase.from('loans').insert(importData.data.loans.map(l => ({ ...l, id: undefined }))))
          );
        }
        if (importData.data.subscriptions) {
          importPromises.push(
            supabase.from('subscriptions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
              .then(() => supabase.from('subscriptions').insert(importData.data.subscriptions.map(s => ({ ...s, id: undefined }))))
          );
        }
        if (importData.data.notes) {
          importPromises.push(
            supabase.from('budget_notes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
              .then(() => supabase.from('budget_notes').insert(importData.data.notes.map(n => ({ ...n, id: undefined }))))
          );
        }

        await Promise.all(importPromises);
        
        alert('✅ Import successful! Page will reload...');
        window.location.reload();
      } catch (error) {
        console.error('Import error:', error);
        alert('❌ Import failed: ' + error.message);
      }
    };

    input.click();
  };

  const daysSinceExport = lastExport ? Math.floor((new Date() - lastExport) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div style={{ 
      background: '#1a1a1a', 
      border: '1px solid #2d2d2d', 
      borderRadius: '12px', 
      overflow: 'hidden',
      marginTop: '1.5rem'
    }}>
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ 
          padding: '1.5rem', 
          cursor: 'pointer', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: expanded ? '1px solid #2d2d2d' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.5rem' }}>💾</span>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>Backup & Export</h3>
            <p style={{ fontSize: '0.9rem', color: '#999', margin: 0 }}>
              {lastExport ? (
                daysSinceExport === 0 ? 'Last backup: Today' :
                daysSinceExport === 1 ? 'Last backup: Yesterday' :
                `Last backup: ${daysSinceExport} days ago`
              ) : 'No backups yet'}
              {daysSinceExport > 30 && <span style={{ color: '#ef4444', marginLeft: '0.5rem' }}>⚠️ Backup recommended</span>}
            </p>
          </div>
        </div>
        <span style={{ fontSize: '1.5rem', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>
          ▼
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '1.5rem' }}>
          {/* Full Backup Section */}
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📦</span> Full Backup (JSON)
            </h4>
            <p style={{ color: '#999', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Export all data as JSON for complete backup. Includes all bills, debt, subscriptions, and notes.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Btn onClick={exportAllJSON}>
                📥 Export All Data
              </Btn>
              <Btn sec onClick={importJSON}>
                📤 Import Backup
              </Btn>
            </div>
          </div>

          {/* CSV Exports Section */}
          <div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📊</span> Export to CSV
            </h4>
            <p style={{ color: '#999', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Export individual tables as CSV for use in Excel or Google Sheets.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
              <Btn sec onClick={() => exportCSV('Income', data.income)}>
                💵 Income ({data.income?.length || 0})
              </Btn>
              <Btn sec onClick={() => exportCSV('Bills', data.bills)}>
                📄 Bills ({data.bills?.length || 0})
              </Btn>
              <Btn sec onClick={() => exportCSV('Credit-Cards', data.cards)}>
                💳 Cards ({data.cards?.length || 0})
              </Btn>
              <Btn sec onClick={() => exportCSV('Loans', data.loans)}>
                🏦 Loans ({data.loans?.length || 0})
              </Btn>
              <Btn sec onClick={() => exportCSV('Subscriptions', data.subscriptions)}>
                📅 Subscriptions ({data.subscriptions?.length || 0})
              </Btn>
              <Btn sec onClick={() => exportCSV('Notes', data.notes)}>
                📝 Notes ({data.notes?.length || 0})
              </Btn>
            </div>
          </div>

          {/* Info Box */}
          <div style={{ 
            marginTop: '1.5rem', 
            padding: '1rem', 
            background: '#0a0a0a', 
            border: '1px solid #2d2d2d', 
            borderRadius: '8px' 
          }}>
            <div style={{ fontSize: '0.9rem', color: '#999', lineHeight: '1.6' }}>
              <strong style={{ color: '#4ade80' }}>💡 Backup Tips:</strong>
              <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
                <li>Export full backup monthly for safety</li>
                <li>Store backups in cloud storage (Google Drive, Dropbox)</li>
                <li>CSV exports are great for analysis in Excel</li>
                <li>Import will replace ALL current data - use with caution!</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Components
const StatCard = ({ l, v, g, sub }) => (
  <div style={s.stat}>
    <div style={{ color: '#999', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{l}</div>
    <div style={{ fontSize: '2rem', fontWeight: 700, color: g ? '#4ade80' : '#fff' }}>{v}</div>
    {sub && <div style={{ color: '#999', fontSize: '0.85rem', marginTop: '0.5rem' }}>{sub}</div>}
  </div>
);

const Card = ({ t, children }) => (
  <div style={s.card}>
    {t && <h2 style={s.h2}>{t}</h2>}
    {children}
  </div>
);

const Btn = ({ children, onClick, sm, sec, danger, disabled, type }) => (
  <button type={type} onClick={onClick} disabled={disabled} style={{
    ...s.btn,
    ...(sm && { padding: '0.4rem 0.8rem', fontSize: '0.85rem' }),
    ...(danger && { background: '#ef4444' }),
    ...(sec && { background: '#2d2d2d' }),
    ...(disabled && { opacity: 0.5, cursor: 'not-allowed' })
  }}>
    {children}
  </button>
);

const Inp = ({ l, ...props }) => (
  <div style={{ marginBottom: '1rem' }}>
    {l && <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>{l}</label>}
    <input {...props} style={s.input} />
  </div>
);

const Bdg = ({ children, g }) => (
  <span style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 500, 
    background: g ? 'rgba(74,222,128,0.2)' : 'rgba(59,130,246,0.2)', color: g ? '#4ade80' : '#3b82f6' }}>
    {children}
  </span>
);

// Styles
const s = {
  app: { minHeight: '100vh', background: '#0a0a0a', color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif' },
  nav: { background: '#1a1a1a', borderBottom: '2px solid #2d2d2d', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' },
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#4ade80', margin: 0 },
  links: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  navBtn: { background: 'transparent', color: '#e0e0e0', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem' },
  navBtnActive: { background: '#2d2d2d', color: '#4ade80' },
  main: { maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', fontSize: '1.2rem', color: '#999' },
  h1: { fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' },
  h2: { fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' },
  h3: { fontSize: '0.9rem', color: '#999', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' },
  stat: { background: 'linear-gradient(135deg, #1a1a1a, #0a0a0a)', border: '1px solid #2d2d2d', borderRadius: '12px', padding: '1.5rem' },
  card: { background: '#1a1a1a', border: '1px solid #2d2d2d', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' },
  expCard: { background: '#1a1a1a', border: '1px solid #2d2d2d', borderRadius: '12px', marginBottom: '1.5rem', overflow: 'hidden' },
  expHeader: { padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'background 0.2s', ':hover': { background: '#0a0a0a' } },
  expBody: { borderTop: '1px solid #2d2d2d' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '1rem', textAlign: 'left', borderBottom: '1px solid #2d2d2d', fontWeight: 600, color: '#999', textTransform: 'uppercase', fontSize: '0.85rem' },
  td: { padding: '1rem', borderBottom: '1px solid #2d2d2d' },
  btn: { padding: '0.625rem 1.25rem', borderRadius: '6px', border: 'none', fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem', background: '#4ade80', color: '#0a0a0a' },
  iconBtn: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0.25rem 0.5rem', borderRadius: '4px', transition: 'background 0.2s', ':hover': { background: '#2d2d2d' } },
  input: { width: '100%', padding: '0.75rem', background: '#0a0a0a', border: '1px solid #2d2d2d', borderRadius: '6px', color: '#e0e0e0', fontSize: '1rem' },
  editInput: { width: '100%', padding: '0.5rem', background: '#0a0a0a', border: '1px solid #4ade80', borderRadius: '4px', color: '#e0e0e0', fontSize: '0.9rem' }
};
