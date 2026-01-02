import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import {
  getPayPeriodsForMonth,
  calculatePeriodIncome,
  assignBillsToPeriod,
  calculateTransfer,
  formatCurrency
} from '../utils/calculations';

function MonthlyView() {
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [incomeSources, setIncomeSources] = useState([]);
  const [bills, setBills] = useState([]);
  const [periods, setPeriods] = useState([]);

  useEffect(() => {
    loadMonthlyData();
  }, [currentDate]);

  const loadMonthlyData = async () => {
    try {
      setLoading(true);

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      // Get pay periods for this month
      const monthPeriods = getPayPeriodsForMonth(year, month);

      // Load income sources
      const { data: incomeData } = await supabase
        .from('income_sources')
        .select('*');

      setIncomeSources(incomeData || []);

      // Load active bills
      const { data: billsData } = await supabase
        .from('bills')
        .select('*')
        .eq('active', true);

      // Get monthly bill instances
      const { data: instances } = await supabase
        .from('monthly_bill_instances')
        .select('*')
        .eq('year', year)
        .eq('month', month);

      let monthlyBills;
      
      // If no instances exist for this month, create them
      if (!instances || instances.length === 0) {
        const newInstances = billsData.map(bill => ({
          bill_id: bill.id,
          month,
          year,
          period: bill.due_date <= 15 ? 1 : 2,
          amount: bill.default_amount || 0,
          paid: false
        }));

        await supabase
          .from('monthly_bill_instances')
          .insert(newInstances);

        const { data: createdInstances } = await supabase
          .from('monthly_bill_instances')
          .select('*')
          .eq('year', year)
          .eq('month', month);

        monthlyBills = createdInstances.map(instance => {
          const bill = billsData.find(b => b.id === instance.bill_id);
          return { ...bill, ...instance, instance_id: instance.id };
        });
      } else {
        monthlyBills = instances.map(instance => {
          const bill = billsData.find(b => b.id === instance.bill_id);
          return { ...bill, ...instance, instance_id: instance.id };
        });
      }

      setBills(monthlyBills);

      // Calculate data for each period
      const periodsData = monthPeriods.map(period => {
        const income = calculatePeriodIncome(period, incomeData || []);
        const assignedBills = assignBillsToPeriod(monthlyBills, period);
        const transfer = calculateTransfer(income, assignedBills);

        return {
          ...period,
          income,
          assignedBills,
          transfer
        };
      });

      setPeriods(periodsData);

    } catch (error) {
      console.error('Error loading monthly data:', error);
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const updateBillAmount = async (instanceId, newAmount) => {
    await supabase
      .from('monthly_bill_instances')
      .update({ amount: parseFloat(newAmount) })
      .eq('id', instanceId);

    loadMonthlyData();
  };

  if (loading) {
    return <div className="loading">Loading monthly view...</div>;
  }

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="monthly-view">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">{monthName}</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => changeMonth(-1)}>
            ← Previous Month
          </button>
          <button className="btn btn-secondary" onClick={() => setCurrentDate(new Date())}>
            Current Month
          </button>
          <button className="btn btn-secondary" onClick={() => changeMonth(1)}>
            Next Month →
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {periods.map((period, idx) => (
          <div key={idx} className="card">
            <div className="card-header">
              <h2 className="card-title">{period.label}</h2>
            </div>

            {/* Income Section */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', color: '#999', marginBottom: '1rem' }}>INCOME</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Jorge:</span>
                  <span style={{ fontWeight: 600, color: '#4ade80' }}>
                    {formatCurrency(period.income.jorgeTotal)}
                  </span>
                </div>
                {period.income.jorgePaychecks.map((check, i) => (
                  <div key={i} style={{ paddingLeft: '1rem', fontSize: '0.9rem', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{check.displayDate}</span>
                    <span>{formatCurrency(check.amount)}</span>
                  </div>
                ))}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                  <span>Anseli:</span>
                  <span style={{ fontWeight: 600, color: '#4ade80' }}>
                    {formatCurrency(period.income.anseliTotal)}
                  </span>
                </div>
                {period.income.anseliPaychecks.map((check, i) => (
                  <div key={i} style={{ paddingLeft: '1rem', fontSize: '0.9rem', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{check.displayDate}</span>
                    <span>{formatCurrency(check.amount)}</span>
                  </div>
                ))}
                
                <div style={{ borderTop: '2px solid #3d3d3d', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>Total Income:</span>
                  <span style={{ color: '#4ade80' }}>{formatCurrency(period.income.totalIncome)}</span>
                </div>
              </div>
            </div>

            {/* Bills Section */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', color: '#999', marginBottom: '1rem' }}>BILLS DUE</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {period.assignedBills.map((bill) => (
                  <div key={bill.instance_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', backgroundColor: '#252525', borderRadius: '6px' }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{bill.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#999' }}>
                        Due: {bill.due_date}{bill.due_date === 1 ? 'st' : bill.due_date === 2 ? 'nd' : bill.due_date === 3 ? 'rd' : 'th'} • {bill.paid_by}
                      </div>
                    </div>
                    {bill.varies ? (
                      <input
                        type="number"
                        value={bill.amount || ''}
                        onChange={(e) => updateBillAmount(bill.instance_id, e.target.value)}
                        style={{
                          width: '100px',
                          padding: '0.4rem',
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #3d3d3d',
                          borderRadius: '4px',
                          color: '#4ade80',
                          fontWeight: 600,
                          textAlign: 'right'
                        }}
                      />
                    ) : (
                      <span style={{ fontWeight: 600, color: '#4ade80' }}>
                        {formatCurrency(bill.amount)}
                      </span>
                    )}
                  </div>
                ))}
                
                <div style={{ borderTop: '2px solid #3d3d3d', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>Total Bills:</span>
                  <span>{formatCurrency(period.transfer.totalBills)}</span>
                </div>
              </div>
            </div>

            {/* Summary Section */}
            <div style={{ borderTop: '2px solid #4ade80', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#999' }}>Transfer:</span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#fbbf24' }}>
                  {formatCurrency(period.transfer.transferAmount)}
                </span>
              </div>
              {period.transfer.transferDirection && (
                <div style={{ fontSize: '0.9rem', color: '#999', textAlign: 'right' }}>
                  {period.transfer.transferDirection}
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #3d3d3d' }}>
                <span style={{ fontWeight: 700 }}>Leftover:</span>
                <span style={{ fontWeight: 700, fontSize: '1.2rem', color: period.transfer.leftover >= 0 ? '#4ade80' : '#ef4444' }}>
                  {formatCurrency(period.transfer.leftover)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Summary */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <div className="card-header">
          <h2 className="card-title">Monthly Summary</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem' }}>
          <div>
            <div style={{ color: '#999', marginBottom: '0.5rem' }}>Total Income</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4ade80' }}>
              {formatCurrency(periods.reduce((sum, p) => sum + p.income.totalIncome, 0))}
            </div>
          </div>
          <div>
            <div style={{ color: '#999', marginBottom: '0.5rem' }}>Total Bills</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              {formatCurrency(periods.reduce((sum, p) => sum + p.transfer.totalBills, 0))}
            </div>
          </div>
          <div>
            <div style={{ color: '#999', marginBottom: '0.5rem' }}>Total Transfers</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fbbf24' }}>
              {formatCurrency(periods.reduce((sum, p) => sum + p.transfer.transferAmount, 0))}
            </div>
          </div>
          <div>
            <div style={{ color: '#999', marginBottom: '0.5rem' }}>Total Leftover</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4ade80' }}>
              {formatCurrency(periods.reduce((sum, p) => sum + p.transfer.leftover, 0))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MonthlyView;
