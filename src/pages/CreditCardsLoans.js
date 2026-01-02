import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { formatCurrency } from '../utils/calculations';

function CreditCardsLoans() {
  const [cards, setCards] = useState([]);
  const [loans, setLoans] = useState([]);
  
  useEffect(() => {
    loadDebt();
  }, []);

  const loadDebt = async () => {
    const { data: cardsData } = await supabase.from('credit_cards').select('*').eq('active', true).order('balance', { ascending: false });
    const { data: loansData } = await supabase.from('loans').select('*').eq('active', true);
    setCards(cardsData || []);
    setLoans(loansData || []);
  };

  const totalCardDebt = cards.reduce((sum, card) => sum + parseFloat(card.balance), 0);
  const totalLoanDebt = loans.reduce((sum, loan) => sum + parseFloat(loan.balance), 0);
  const totalMinPayments = cards.reduce((sum, card) => sum + parseFloat(card.min_payment), 0) +
                          loans.reduce((sum, loan) => sum + parseFloat(loan.monthly_payment), 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Credit Cards & Loans</h1>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Debt</div>
          <div className="stat-value negative">{formatCurrency(totalCardDebt + totalLoanDebt)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Credit Card Debt</div>
          <div className="stat-value">{formatCurrency(totalCardDebt)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Loan Debt</div>
          <div className="stat-value">{formatCurrency(totalLoanDebt)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Monthly Payments</div>
          <div className="stat-value">{formatCurrency(totalMinPayments)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Credit Cards</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Card</th>
              <th>Balance</th>
              <th>Min Payment</th>
              <th>APR</th>
              <th>Owner</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {cards.map(card => (
              <tr key={card.id}>
                <td>{card.name}</td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(card.balance)}</td>
                <td>{formatCurrency(card.min_payment)}</td>
                <td>{card.apr}%</td>
                <td><span className={`badge ${card.owned_by === 'Jorge' ? 'badge-info' : 'badge-success'}`}>{card.owned_by}</span></td>
                <td>{card.due_date}{card.due_date === 1 ? 'st' : card.due_date === 2 ? 'nd' : card.due_date === 3 ? 'rd' : 'th'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Loans</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Loan</th>
              <th>Balance</th>
              <th>Monthly Payment</th>
              <th>APR</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {loans.map(loan => (
              <tr key={loan.id}>
                <td>{loan.name}</td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(loan.balance)}</td>
                <td>{formatCurrency(loan.monthly_payment)}</td>
                <td>{loan.apr}%</td>
                <td>{loan.due_date}{loan.due_date === 1 ? 'st' : loan.due_date === 2 ? 'nd' : loan.due_date === 3 ? 'rd' : 'th'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CreditCardsLoans;
