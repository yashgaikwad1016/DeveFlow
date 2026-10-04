import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { paymentService, reportService } from '../services';
import Icon from '../components/Icon';
import { Badge } from '../components/UI';

export default function AdminPaymentsPage() {
  const [data, setData] = useState({ payments: [], pagination: {}, summary: {} });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('DESC');

  const searchDebounceRef = useRef(null);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await paymentService.getAdminPayments({
        page,
        limit,
        search,
        status,
        plan,
        sortBy,
        sortDir,
      });
      setData(res);
    } catch (err) {
      toast.error(err.message || 'Failed to load admin payment logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [page, status, plan, sortBy, sortDir]);

  // Debounced search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setPage(1);
      fetchPayments();
    }, 300);
    return () => clearTimeout(searchDebounceRef.current);
  }, [search]);

  const handleDownloadReceipt = async (paymentId, receiptNumber) => {
    try {
      toast.loading('Downloading receipt...', { id: 'admin-rcpt' });
      await paymentService.downloadReceipt(paymentId, receiptNumber);
      toast.success('Receipt downloaded', { id: 'admin-rcpt' });
    } catch (err) {
      toast.error('Failed to download receipt', { id: 'admin-rcpt' });
    }
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      toast.loading('Exporting financial report...', { id: 'admin-export' });
      await reportService.exportPaymentsCsv();
      toast.success('Payments CSV downloaded successfully', { id: 'admin-export' });
    } catch (err) {
      toast.error(err.message || 'Failed to export CSV', { id: 'admin-export' });
    } finally {
      setExporting(false);
    }
  };

  const { payments = [], pagination = {}, summary = {} } = data;
  const currencySymbol = summary.currency === 'INR' ? '₹' : '$';

  return (
    <div className="admin-payments-page" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            Payment & Revenue Management
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            Administrative audit logs, financial summaries, and transaction records.
          </p>
        </div>
        <button
          className="btn"
          onClick={handleExportCsv}
          disabled={exporting}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px' }}
        >
          <Icon name="download" /> {exporting ? 'Exporting...' : 'Export Payments CSV'}
        </button>
      </div>

      {/* Summary Metrics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <div className="card" style={{ padding: 20, borderRadius: 14, boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            Total Revenue
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>
            {currencySymbol}{summary.totalRevenue || '0.00'}
          </div>
        </div>

        <div className="card" style={{ padding: 20, borderRadius: 14, boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            Active Subscriptions
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#6366f1' }}>
            {summary.activeSubscriptions || 0}
          </div>
        </div>

        <div className="card" style={{ padding: 20, borderRadius: 14, boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            Successful Transactions
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
            {summary.successfulPayments || 0}
          </div>
        </div>

        <div className="card" style={{ padding: 20, borderRadius: 14, boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            Failed / Cancelled
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444' }}>
            {summary.failedPayments || 0}
          </div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div
        className="card"
        style={{
          padding: 16,
          borderRadius: 14,
          marginBottom: 20,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
          {/* Search */}
          <div style={{ position: 'relative', minWidth: 260, flex: 1 }}>
            <input
              type="text"
              placeholder="Search user, email, receipt #, or payment ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
              }}
            />
            <span style={{ position: 'absolute', left: 10, top: 10, color: 'var(--muted)' }}>
              <Icon name="search" />
            </span>
          </div>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 13,
            }}
          >
            <option value="">All Statuses</option>
            <option value="Success">Success</option>
            <option value="Failed">Failed</option>
            <option value="Created">Created</option>
          </select>

          {/* Plan Filter */}
          <select
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 13,
            }}
          >
            <option value="">All Plans</option>
            <option value="individual">Individual</option>
            <option value="team">Team</option>
            <option value="business">Business</option>
          </select>
        </div>

        {/* Refresh button */}
        <button className="btn" onClick={fetchPayments} disabled={loading} title="Refresh records">
          <Icon name="activity" /> Refresh
        </button>
      </div>

      {/* Payment Logs Table */}
      <div className="card" style={{ padding: 0, borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
            <div style={{ width: 28, height: 28, border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'blobFloat 0.8s linear infinite' }}></div>
          </div>
        ) : payments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
            <p style={{ fontSize: 16, fontWeight: 500 }}>No transaction records found</p>
            <p style={{ fontSize: 13 }}>Try adjusting your search criteria or clear your filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)' }}>
                  <th style={{ padding: '12px 16px' }}>Receipt / ID</th>
                  <th style={{ padding: '12px 16px' }}>User Details</th>
                  <th style={{ padding: '12px 16px' }}>Plan & Seats</th>
                  <th style={{ padding: '12px 16px' }}>Amount</th>
                  <th style={{ padding: '12px 16px' }}>Method</th>
                  <th style={{ padding: '12px 16px' }}>Razorpay Payment ID</th>
                  <th style={{ padding: '12px 16px' }}>Date</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.payment_id} style={{ borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>
                      <div>{p.receipt_number}</div>
                      <small style={{ color: 'var(--muted)', fontSize: 11 }}>ID: #{p.payment_id}</small>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{p.user_name}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{p.user_email}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 500 }}>{p.plan_name || 'Team'}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 11 }}>{p.member_count || 1} seat(s)</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>
                      {p.currency === 'INR' ? '₹' : '$'}{parseFloat(p.amount).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px', textTransform: 'uppercase', fontSize: 11, color: 'var(--muted)' }}>
                      {p.payment_method || 'Online'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'monospace' }}>
                      {p.razorpay_payment_id || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12 }}>
                      {new Date(p.payment_time || p.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge value={p.status} />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {p.status === 'Success' ? (
                        <button
                          className="btn btn-sm"
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => handleDownloadReceipt(p.payment_id, p.receipt_number)}
                          title="Download Receipt"
                        >
                          <Icon name="file" /> PDF
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-side Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
              color: 'var(--muted)',
            }}
          >
            <div>
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalRecords} total entries)
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                className="btn btn-sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
