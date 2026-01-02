import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { formatCurrency } from '../utils/calculations';

function BillsManagement() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    default_amount: '',
    due_date: '',
    category: 'Utility',
    paid_by: 'Anseli',
    account_name: '',
    recurring: true,
    varies: false,
    active: true
  });

  useEffect(() => {
    loadBills();
  }, [showInactive]);

  const loadBills = async () => {
    try {
      setLoading(true);
      let query = supabase.from('bills').select('*');
      
      if (!showInactive) {
        query = query.eq('active', true);
      }
      
      const { data } = await query.order('due_date');
      setBills(data || []);
    } catch (error) {
      console.error('Error loading bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const billData = {
        ...formData,
        default_amount: formData.varies ? null : parseFloat(formData.default_amount) || null
      };

      if (editingBill) {
        await supabase
          .from('bills')
          .update(billData)
          .eq('id', editingBill.id);
      } else {
        await supabase
          .from('bills')
          .insert([billData]);
      }

      resetForm();
      loadBills();
    } catch (error) {
      console.error('Error saving bill:', error);
    }
  };

  const toggleActive = async (bill) => {
    await supabase
      .from('bills')
      .update({ active: !bill.active })
      .eq('id', bill.id);
    
    loadBills();
  };

  const deleteBill = async (id) => {
    if (window.confirm('Are you sure you want to delete this bill?')) {
      await supabase.from('bills').delete().eq('id', id);
      loadBills();
    }
  };

  const editBill = (bill) => {
    setEditingBill(bill);
    setFormData({
      name: bill.name,
      default_amount: bill.default_amount || '',
      due_date: bill.due_date,
      category: bill.category,
      paid_by: bill.paid_by,
      account_name: bill.account_name || '',
      recurring: bill.recurring,
      varies: bill.varies,
      active: bill.active
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingBill(null);
    setFormData({
      name: '',
      default_amount: '',
      due_date: '',
      category: 'Utility',
      paid_by: 'Anseli',
      account_name: '',
      recurring: true,
      varies: false,
      active: true
    });
  };

  const activeBills = bills.filter(b => b.active);
  const inactiveBills = bills.filter(b => !b.active);

  return (
    <div className="bills-management">
      <div className="page-header flex-between">
        <h1 className="page-title">Bills Management</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="btn btn-secondary btn-small"
            onClick={() => setShowInactive(!showInactive)}
          >
            {showInactive ? 'Hide' : 'Show'} Paused Bills
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Add Bill
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card mb-2">
          <div className="card-header">
            <h2 className="card-title">{editingBill ? 'Edit Bill' : 'Add New Bill'}</h2>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Bill Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Amount {formData.varies && '(optional)'}</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.default_amount}
                  onChange={(e) => setFormData({ ...formData, default_amount: e.target.value })}
                  disabled={formData.varies}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Due Date (day of month) *</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  className="form-input"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  className="form-select"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="Rent">Rent</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Utility">Utility</option>
                  <option value="Loan">Loan</option>
                  <option value="Personal">Personal</option>
                  <option value="Investment">Investment</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Paid By *</label>
                <select
                  className="form-select"
                  value={formData.paid_by}
                  onChange={(e) => setFormData({ ...formData, paid_by: e.target.value })}
                >
                  <option value="Jorge">Jorge</option>
                  <option value="Anseli">Anseli</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Account/Card</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  placeholder="e.g., AMEX, Debit"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', margin: '1rem 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={formData.varies}
                  onChange={(e) => setFormData({ ...formData, varies: e.target.checked })}
                />
                <span>Amount varies each month</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                />
                <span>Active</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingBill ? 'Update Bill' : 'Add Bill'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Bills */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Active Bills ({activeBills.length})</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Category</th>
              <th>Paid By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeBills.map((bill) => (
              <tr key={bill.id}>
                <td>
                  {bill.name}
                  {bill.varies && <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}>Varies</span>}
                </td>
                <td>{bill.varies ? '—' : formatCurrency(bill.default_amount)}</td>
                <td>{bill.due_date}{bill.due_date === 1 ? 'st' : bill.due_date === 2 ? 'nd' : bill.due_date === 3 ? 'rd' : 'th'}</td>
                <td><span className="badge badge-info">{bill.category}</span></td>
                <td><span className={`badge ${bill.paid_by === 'Jorge' ? 'badge-info' : 'badge-success'}`}>{bill.paid_by}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary btn-small" onClick={() => editBill(bill)}>Edit</button>
                    <button className="btn btn-secondary btn-small" onClick={() => toggleActive(bill)}>Pause</button>
                    <button className="btn btn-danger btn-small" onClick={() => deleteBill(bill.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paused Bills */}
      {showInactive && inactiveBills.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Paused Bills ({inactiveBills.length})</h2>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Category</th>
                <th>Paid By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inactiveBills.map((bill) => (
                <tr key={bill.id} style={{ opacity: 0.6 }}>
                  <td>{bill.name}</td>
                  <td>{bill.varies ? '—' : formatCurrency(bill.default_amount)}</td>
                  <td>{bill.due_date}{bill.due_date === 1 ? 'st' : bill.due_date === 2 ? 'nd' : bill.due_date === 3 ? 'rd' : 'th'}</td>
                  <td><span className="badge badge-info">{bill.category}</span></td>
                  <td><span className={`badge ${bill.paid_by === 'Jorge' ? 'badge-info' : 'badge-success'}`}>{bill.paid_by}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-primary btn-small" onClick={() => toggleActive(bill)}>Activate</button>
                      <button className="btn btn-danger btn-small" onClick={() => deleteBill(bill.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default BillsManagement;
