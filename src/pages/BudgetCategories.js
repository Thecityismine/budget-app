import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { formatCurrency } from '../utils/calculations';

function BudgetCategories() {
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', budgeted_amount: '', notes: '' });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const { data } = await supabase.from('budget_categories').select('*').eq('active', true).order('name');
    setCategories(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await supabase.from('budget_categories').insert([{
      ...formData,
      budgeted_amount: parseFloat(formData.budgeted_amount)
    }]);
    setFormData({ name: '', budgeted_amount: '', notes: '' });
    setShowForm(false);
    loadCategories();
  };

  const updateNotes = async (id, notes) => {
    await supabase.from('budget_categories').update({ notes }).eq('id', id);
    loadCategories();
  };

  const totalBudget = categories.reduce((sum, cat) => sum + parseFloat(cat.budgeted_amount), 0);

  return (
    <div>
      <div className="page-header flex-between">
        <h1 className="page-title">Budget Categories</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Category</button>
      </div>

      <div className="stat-card mb-2">
        <div className="stat-label">Total Monthly Budget</div>
        <div className="stat-value positive">{formatCurrency(totalBudget)}</div>
      </div>

      {showForm && (
        <div className="card mb-2">
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Category Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Budgeted Amount</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.budgeted_amount}
                  onChange={(e) => setFormData({ ...formData, budgeted_amount: e.target.value })}
                  required
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add Category</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Budget Categories</h2>
        </div>
        {categories.map(cat => (
          <div key={cat.id} style={{ padding: '1rem', borderBottom: '1px solid #3d3d3d' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{cat.name}</h3>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#4ade80' }}>{formatCurrency(cat.budgeted_amount)}</span>
            </div>
            <div className="form-group">
              <label className="form-label">Notes:</label>
              <textarea
                className="form-textarea"
                value={cat.notes || ''}
                onChange={(e) => updateNotes(cat.id, e.target.value)}
                placeholder="Track overages and adjustments..."
                style={{ minHeight: '60px' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BudgetCategories;
