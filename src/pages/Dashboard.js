import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import {
  getCurrentPayPeriod,
  calculatePeriodIncome,
  assignBillsToPeriod,
  calculateTransfer,
  formatCurrency
} from '../utils/calculations';

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [currentPeriod, setCurrentPeriod] = useState(null);
  const [incomeSources, setIncomeSources] = useState([]);
  const [bills, setBills] = useState([]);
  const [periodData, setPeriodData] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get current period
      const period = getCurrentPayPeriod();
      setCurrentPeriod(period);

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

      // Get or create monthly instances for this period
      const monthlyBills = await getMonthlyBillInstances(billsData, period);
      setBills(monthlyBills);

      // Calculate period income
      const income = calculatePeriodIncome(period, incomeData || []);

      // Assign bills to this period
      const assignedBills = assignBillsToPeriod(monthlyBills, period);

      // Calculate transfer
      const transfer = calculateTransfer(income, assignedBills);

      setPeriodData({
        income,
        assignedBills,
        transfer
      });

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMonthlyBillInstances = async (billsData, period) => {
    const year = period.startDate.getFullYear();
    const month = period.startDate.getMonth() + 1;

    // Check if we have instances for this month
    const { data: existingInstances } = await supabase
      .from('monthly_bill_instances')
      .select('*')
      .eq('year', year)
      .eq('month', month);

    // If no instances exist, create them from bills
    if (!existingInstances || existingInstances.length === 0) {
      const instances = billsData.map(bill => ({
        bill_id: bill.id,
        month,
        year,
        period: bill.due_date <= 15 ? 1 : 2,
        amount: bill.default_amount || 0,
        paid: false
      }));

      await supabase
        .from('monthly_bill_instances')
        .insert(instances);

      // Reload instances
      const { data: newInstances } = await supabase
        .from('monthly_bill_instances')
        .select('*')
        .eq('year', year)
        .eq('month', month);

      // Merge with bill data
      return newInstances.map(instance => {
        const bill = billsData.find(b => b.id === instance.bill_id);
        return { ...bill, ...instance, instance_id: instance.id };
      });
    }

    // Merge existing instances with bill data
    return existingInstances.map(instance => {
      const bill = billsData.find(b => b.id === instance.bill_id);
      return { ...bill, ...instance, instance_id: instance.id };
    });
  };

  const toggleBillPaid = async (instanceId, currentStatus) => {
    await supabase
      .from('monthly_bill_instances')
      .update({ 
        paid: !currentStatus,
        paid_date: !currentStatus ? new Date().toISOString() : null
      })
      .eq('id', instanceId);

    loadDashboardData();
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (!periodData) {
    return <div className="empty-state">No data available</div>;
  }

  const { income, assignedBills, transfer } = periodData;
  const paidBills = assignedBills.filter(b => b.paid).length;
  const totalBills = assignedBills.length;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">{currentPeriod?.label}</p>
      </div>

      {/* Income Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">💰 Total Income</div>
          <div className="stat-value positive">{formatCurrency(income.totalIncome)}</div>
          <div className="stat-subtext">
            Jorge: {formatCurrency(income.jorgeTotal)} • Anseli: {formatCurrency(income.anseliTotal)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">💸 Total Bills</div>
          <div className="stat-value">{formatCurrency(transfer.totalBills)}</div>
          <div className="stat-subtext">
            {paidBills} of {totalBills} paid
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(paidBills / totalBills) * 100}%` }}
            />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">🔄 Transfer Needed</div>
          <div className="stat-value">{formatCurrency(transfer.transferAmount)}</div>
          <div className="stat-subtext">{transfer.transferDirection || 'No transfer needed'}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">💵 Leftover</div>
          <div className={`stat-value ${transfer.leftover >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(transfer.leftover)}
          </div>
          <div className="stat-subtext">After all bills paid</div>
        </div>
      </div>

      {/* Paychecks Details */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Income This Period</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <h3 style={{ marginBottom: '1rem', color: '#4ade80' }}>Jorge</h3>
            {income.jorgePaychecks.map((check, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>{check.displayDate}</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(check.amount)}</span>
              </div>
            ))}
            <div style={{ borderTop: '2px solid #3d3d3d', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Total</span>
              <span style={{ color: '#4ade80' }}>{formatCurrency(income.jorgeTotal)}</span>
            </div>
          </div>
          <div>
            <h3 style={{ marginBottom: '1rem', color: '#4ade80' }}>Anseli</h3>
            {income.anseliPaychecks.map((check, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>{check.displayDate}</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(check.amount)}</span>
              </div>
            ))}
            <div style={{ borderTop: '2px solid #3d3d3d', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Total</span>
              <span style={{ color: '#4ade80' }}>{formatCurrency(income.anseliTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bills Due */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Bills Due This Period</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>Bill</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Paid By</th>
            </tr>
          </thead>
          <tbody>
            {assignedBills.map((bill) => (
              <tr key={bill.instance_id} style={{ opacity: bill.paid ? 0.6 : 1 }}>
                <td>
                  <input
                    type="checkbox"
                    checked={bill.paid || false}
                    onChange={() => toggleBillPaid(bill.instance_id, bill.paid)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </td>
                <td style={{ textDecoration: bill.paid ? 'line-through' : 'none' }}>
                  {bill.name}
                  {bill.varies && <span className="badge badge-info" style={{ marginLeft: '0.5rem' }}>Varies</span>}
                </td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(bill.amount)}</td>
                <td>{bill.due_date}{bill.due_date === 1 ? 'st' : bill.due_date === 2 ? 'nd' : bill.due_date === 3 ? 'rd' : 'th'}</td>
                <td>
                  <span className={`badge ${bill.paid_by === 'Jorge' ? 'badge-info' : 'badge-success'}`}>
                    {bill.paid_by}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, fontSize: '1.1rem' }}>
              <td colSpan="2">Total Bills</td>
              <td>{formatCurrency(transfer.totalBills)}</td>
              <td colSpan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default Dashboard;
