# Budget App

A comprehensive budget and finance management application for tracking income, bills, debt, and savings goals.

## Features

- **Dashboard**: Current pay period overview with income, bills, transfers, and leftover calculations
- **Monthly View**: Side-by-side pay periods showing full month breakdown
- **Bills Management**: Add, edit, pause, and track recurring bills
- **Debt Tracking**: Monitor credit cards and loans
- **Budget Categories**: Track monthly budgets with notes
- **Future Expenses**: Set and track savings goals

## Setup Instructions

### 1. Database Setup (Already Complete!)

Your Supabase database is ready at: `https://wgjbslvpvgymdmlucpyh.supabase.co`

The SQL script in `supabase-setup.sql` has created all tables and loaded your initial data.

To sync Monthly page checkboxes across devices, run `supabase-monthly-checks.sql` once in the Supabase SQL Editor.

### 2. Local Development

```bash
# Navigate to project directory
cd budget-app

# Install dependencies
npm install

# Start development server
npm start
```

The app will open at `http://localhost:3000`

### 3. Test the App

1. Visit Dashboard - see current pay period
2. Visit Monthly View - see both periods for current month
3. Update variable bills (rent amounts, utilities, etc.)
4. Mark bills as paid
5. Add/edit bills, credit cards, budget categories

## Deployment to Vercel (Free)

### Option 1: Deploy via Vercel Website

1. **Push code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Deploy on Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect it's a React app
   - Click "Deploy"
   - Done! Your app will be live at `your-app.vercel.app`

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Follow prompts:
# - Set up and deploy? Y
# - Which scope? (your account)
# - Link to existing project? N
# - Project name? budget-app
# - Directory? ./
# - Override settings? N

# Deploy to production
vercel --prod
```

## Mobile Access

Once deployed, both you and Anseli can access the app from any device:
- **Laptop**: Visit your Vercel URL
- **Phone**: Visit the same URL (works on iOS/Android)
- **Add to Home Screen**: 
  - iOS: Safari → Share → Add to Home Screen
  - Android: Chrome → Menu → Add to Home Screen

## Key Workflows

### Monthly Workflow

1. **Start of Month**:
   - Go to Monthly View
   - Update variable bills (rent, utilities)
   - Note any budget category changes

2. **During Pay Periods**:
   - Check Dashboard for transfer amount
   - Mark bills as paid
   - Track budget spending in notes

3. **End of Month**:
   - Review leftover amounts
   - Update future expense savings
   - Adjust budget categories for next month

### Managing Bills

- **Add new bill**: Bills page → Add Bill
- **Pause bill**: Bills page → Pause (e.g., CashApp investment)
- **Update amount**: Monthly View → Edit amount directly
- **Mark paid**: Dashboard → Check box

## Data Structure

### Pay Periods
- Period 1: 1st-15th of month
- Period 2: 16th-31st of month

### Income Calculation
- Jorge: Every Friday (bi-weekly)
- Anseli: Every Tuesday (bi-weekly)
- Paychecks auto-assigned to periods based on date

### Transfer Calculation
```
Jorge's bills - Jorge's income = Jorge's balance
Anseli's bills - Anseli's income = Anseli's balance

If Anseli's balance < 0:
  Transfer = Jorge → Anseli
Else if Jorge's balance < 0:
  Transfer = Anseli → Jorge
```

## Customization

### Update Income Amounts
Currently set in database:
- Jorge: $8,240 per paycheck
- Anseli: $3,400 per paycheck

To change, use Supabase dashboard → income_sources table

### Add New Categories
- Bills: Rent, Credit Card, Utility, Loan, Personal, Investment
- Add new in Bills Management page

## Troubleshooting

### Data not loading?
- Check browser console for errors
- Verify Supabase URL and key in `src/supabaseClient.js`

### Bills not showing?
- Check if bills are marked as `active`
- Toggle "Show Paused Bills" in Bills Management

### Wrong pay period showing?
- Verify today's date
- Check income_sources `next_pay_date` in database

## Future Enhancements (Optional)

- [ ] Email/SMS reminders for bill due dates
- [ ] Charts/graphs for spending trends
- [ ] Export data to Excel
- [ ] Multi-user authentication
- [ ] Receipt uploads
- [ ] Actual vs budget tracking per category

## Support

For issues or questions, check:
1. Browser console (F12) for error messages
2. Supabase dashboard for data issues
3. Vercel deployment logs for hosting issues

---

**Made with ❤️ for Jorge & Anseli**
