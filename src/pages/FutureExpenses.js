import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { formatCurrency } from '../utils/calculations';
import { format } from 'date-fns';

function FutureExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    target_date: '',
    current_saved: 0,
    monthly_contribution: '',
    notes: ''
  });

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    const { data } = await supabase
      .from('future_expenses')
      .select('*')
      .eq('active', true)
      .eq('completed', false)
      .order('target_date');
    setExpenses(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await supabase.from('future_expenses').insert([{
      ...formData,
      target_amount: parseFloat(formData.target_amount),
      current_saved: parseFloat(formData.current_saved),
      monthly_contribution: parseFloat(formData.monthly_contribution) || null
    }]);
    setFormData({ name: '', target_amount: '', target_date: '', current_saved: 0, monthly_contribution: '', notes: '' });
    setShowForm(false);
    loadExpenses();
  };

  const updateSaved = async (id, amount) => {
    await supabase.from('future_expenses').update({ current_saved: parseFloat(amount) }).eq('id', id);
    loadExpenses();
  };

  return (
    <div>
      <div className="page-header flex-between">
        <h1 className="page-title">Future Expenses & Savings Goals</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Goal</button>
      </div>

      {showForm && (
        <div className="card mb-2">
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Goal Name</label>
                <input type="text" className="form-input" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Target Amount</label>
                <input type="number" step="0.01" className="form-input" value={formData.target_amount}
                  onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Target Date</label>
                <input type="date" className="form-input" value={formData.target_date}
                  onChange={(e) => setFormData({ ...formData, target_date: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Monthly Contribution</label>
                <input type="number" step="0.01" className="form-input" value={formData.monthly_contribution}
                  onChange={(e) => setFormData({ ...formData, monthly_contribution: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add Goal</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {expenses.map(expense => {
          const progress = (expense.current_saved / expense.target_amount) * 100;
          const remaining = expense.target_amount - expense.current_saved;
          
          return (
            <div key={expense.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{expense.name}</h3>
                <span style={{ fontSize: '1.1rem', color: '#999' }}>Target: {format(new Date(expense.target_date), 'MMM d, yyyy')}</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ color: '#999', fontSize: '0.9rem' }}>Goal Amount</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatCurrency(expense.target_amount)}</div>
                </div>
                <div>
                  <div style={{ color: '#999', fontSize: '0.9rem' }}>Saved</div>
                  <input
                    type="number"
                    step="0.01"
                    value={expense.current_saved}
                    onChange={(e) => updateSaved(expense.id, e.target.value)}
                    style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4ade80', background: 'transparent', border: 'none', width: '100%' }}
                  />
                </div>
                <div>
                  <div style={{ color: '#999', fontSize: '0.9rem' }}>Remaining</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fbbf24' }}>{formatCurrency(remaining)}</div>
                </div>
              </div>

              <div className="progress-bar" style={{ height: '12px' }}>
                <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
              <div style={{ textAlign: 'right', marginTop: '0.5rem', color: '#999' }}>
                {progress.toFixed(1)}% complete
              </div>

              {expense.monthly_contribution && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#252525', borderRadius: '6px' }}>
                  <span style={{ color: '#999' }}>Monthly Contribution: </span>
                  <span style={{ fontWeight: 600, color: '#4ade80' }}>{formatCurrency(expense.monthly_contribution)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FutureExpenses;
