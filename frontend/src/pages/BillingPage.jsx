import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { paymentService, subscriptionService } from '../services';
import { loadRazorpayScript } from '../utils/razorpay';
import Icon from '../components/Icon';
import { Badge } from '../components/UI';

export default function BillingPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('team');
  const [teamMembers, setTeamMembers] = useState(2);
  const [paymentMethodType, setPaymentMethodType] = useState('upi'); // 'upi' | 'card'
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [lastPaymentSuccess, setLastPaymentSuccess] = useState(null);

  // Fetch billing config, current subscription, and payment history
  const loadData = async () => {
    try {
      setLoading(true);
      const [cfg, sub, hist] = await Promise.all([
        paymentService.getConfig().catch(() => null),
        subscriptionService.getCurrent().catch(() => ({ hasSubscription: false })),
        paymentService.getHistory().catch(() => ({ payments: [] })),
      ]);

      if (cfg) setConfig(cfg);
      if (sub) setSubscription(sub);
      if (hist && hist.payments) setHistory(hist.payments);
    } catch (err) {
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const isUpi = paymentMethodType === 'upi';
  const currencySymbol = isUpi ? '₹' : '$';

  // Dynamic price display calculation
  // Formula:
  // Card/USD: team_price = member_count × $3
  // UPI/INR: team_price = member_count × ₹250
  const calculateDisplayPrice = (planCode) => {
    if (isUpi) {
      if (planCode === 'individual') return 400;
      if (planCode === 'team') return teamMembers * 250;
      if (planCode === 'business') return 2400;
    } else {
      if (planCode === 'individual') return 5;
      if (planCode === 'team') return teamMembers * 3;
      if (planCode === 'business') return 29;
    }
    return 0;
  };

  // Stepper handlers for Team plan
  const handleMemberChange = (delta) => {
    setTeamMembers((prev) => {
      const next = prev + delta;
      if (next < 2) return 2;
      if (next > 50) return 50;
      return next;
    });
  };

  // Razorpay Checkout Trigger
  const handleSubscribe = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        toast.error('Unable to load payment checkout. Please check your internet connection.');
        setSubmitting(false);
        return;
      }

      // Step 1: Create server-side order with explicit payment rail & currency
      const orderPayload = {
        plan: selectedPlan,
        memberCount: selectedPlan === 'team' ? teamMembers : 1,
        currency: isUpi ? 'INR' : 'USD',
        paymentMethod: paymentMethodType,
      };

      const orderData = await paymentService.createOrder(orderPayload);

      // Step 2: Initialize Razorpay Checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amountSubunits,
        currency: orderData.currency,
        name: 'DevFlow Agile Workspace',
        description: isUpi
          ? `${orderData.plan.name} Plan - Scan QR / Enter UPI ID`
          : `${orderData.plan.name} Plan Subscription`,
        order_id: orderData.orderId,
        prefill: {
          name: orderData.user.name || '',
          email: orderData.user.email || '',
          method: isUpi ? 'upi' : undefined,
        },
        theme: {
          color: '#4f46e5', // DevFlow Indigo
        },
        // Dedicated UPI block configuration: opens directly with QR code & UPI ID collect flows
        config: isUpi
          ? {
              display: {
                blocks: {
                  upi: {
                    name: 'Pay with UPI (Scan QR / Enter UPI ID)',
                    instruments: [
                      {
                        method: 'upi',
                        flows: ['qr', 'collect', 'intent'],
                      },
                    ],
                  },
                },
                sequence: ['block.upi'],
                preferences: {
                  show_default_blocks: false,
                },
              },
            }
          : undefined,
        modal: {
          ondismiss: () => {
            setSubmitting(false);
            toast('Payment process was cancelled', { icon: 'ℹ️' });
          },
        },
        handler: async (response) => {
          try {
            toast.loading('Verifying secure payment signature...', { id: 'pmt-verify' });

            // Step 3: Server-side cryptographic signature verification
            const verifyRes = await paymentService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            toast.success('Payment verified & subscription activated!', { id: 'pmt-verify' });
            setLastPaymentSuccess(verifyRes);
            await loadData();
          } catch (verifyErr) {
            toast.error(
              verifyErr.message || 'Payment signature verification failed. Please contact support.',
              { id: 'pmt-verify' }
            );
          } finally {
            setSubmitting(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (failedRes) => {
        setSubmitting(false);
        toast.error(
          failedRes.error?.description || 'Payment failed. Your subscription was not activated.'
        );
      });

      rzp.open();
    } catch (err) {
      setSubmitting(false);
      toast.error(err.message || 'Failed to initiate payment checkout');
    }
  };

  // Subscription Cancellation
  const handleCancelSubscription = async () => {
    try {
      await subscriptionService.cancel();
      toast.success('Subscription cancelled successfully.');
      setCancelModalOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to cancel subscription');
    }
  };

  // Receipt Download
  const handleDownloadReceipt = async (paymentId, receiptNumber) => {
    try {
      toast.loading('Generating official PDF receipt...', { id: 'rcpt' });
      await paymentService.downloadReceipt(paymentId, receiptNumber);
      toast.success('Receipt downloaded successfully', { id: 'rcpt' });
    } catch (err) {
      toast.error('Failed to download receipt', { id: 'rcpt' });
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'blobFloat 0.8s linear infinite' }}></div>
      </div>
    );
  }

  const activeSub = subscription?.subscription;
  const hasActiveSub = subscription?.hasSubscription;

  return (
    <div className="billing-page" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      {/* Top Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Subscription & Billing
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 15 }}>
          Manage your DevFlow team plans, member limits, secure UPI/card payments, and invoices.
        </p>
      </div>

      {/* Success Notification Banner after Checkout */}
      {lastPaymentSuccess && (
        <div
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <h4 style={{ color: '#16a34a', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              🎉 Payment Successful!
            </h4>
            <p style={{ color: 'var(--text)', fontSize: 14 }}>
              Your DevFlow subscription is active. Receipt #: <b>{lastPaymentSuccess.receiptNumber}</b>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn-primary"
              style={{ background: '#16a34a', borderColor: '#16a34a' }}
              onClick={() => handleDownloadReceipt(lastPaymentSuccess.paymentId, lastPaymentSuccess.receiptNumber)}
            >
              <Icon name="file" /> Download Receipt
            </button>
            <button className="btn" onClick={() => setLastPaymentSuccess(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Current Subscription Card */}
      <div className="card" style={{ marginBottom: 36, padding: 24, borderRadius: 16, boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>Current Plan</h2>
              <Badge value={hasActiveSub ? 'Active' : (activeSub?.status || 'Free')} />
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              {hasActiveSub
                ? `Billed ${activeSub.billingInterval || 'monthly'} via Razorpay`
                : 'You are currently on the DevFlow Starter plan'}
            </p>
          </div>

          {hasActiveSub && (
            <button
              className="btn"
              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              onClick={() => setCancelModalOpen(true)}
            >
              <Icon name="trash" /> Cancel Subscription
            </button>
          )}
        </div>

        {hasActiveSub ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Plan Name
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>
                {activeSub.planName}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Current Team Members
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>
                {activeSub.memberCount} member{activeSub.memberCount > 1 ? 's' : ''}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Recurring Amount
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>
                {activeSub.currency === 'INR' ? '₹' : '$'}{parseFloat(activeSub.amount).toFixed(2)}/mo
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Renewal Date
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>
                {activeSub.currentPeriodEnd
                  ? new Date(activeSub.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'N/A'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '8px 0', color: 'var(--muted)', fontSize: 14 }}>
            Upgrade your DevFlow workspace to unlock collaborative team management, expanded member seats, and advanced agile analytics.
          </div>
        )}
      </div>

      {/* Payment Method Selector & Toggle */}
      <div
        className="card"
        style={{
          padding: 20,
          borderRadius: 16,
          marginBottom: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: 'var(--shadow)',
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            Select Payment Method:
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Choose how you'd like to complete checkout on Razorpay
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${isUpi ? 'btn-primary' : ''}`}
            onClick={() => setPaymentMethodType('upi')}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: isUpi ? '2px solid #6366f1' : '1px solid var(--border)',
            }}
          >
            <span>⚡</span>
            <span>UPI / QR Code (Google Pay, PhonePe, Paytm, Any UPI ID)</span>
          </button>

          <button
            type="button"
            className={`btn ${!isUpi ? 'btn-primary' : ''}`}
            onClick={() => setPaymentMethodType('card')}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: !isUpi ? '2px solid #6366f1' : '1px solid var(--border)',
            }}
          >
            <Icon name="creditCard" />
            <span>Cards & International ($ USD)</span>
          </button>
        </div>
      </div>

      {/* Plans & Pricing Cards */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Choose the Perfect Plan for Your Team
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            {isUpi
              ? '🇮🇳 Indian UPI Pricing with instant QR Code scan and VPA/UPI ID approval.'
              : 'Transparent USD pricing. Cancel or change plans anytime.'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {/* PLAN 1: Individual */}
          <div
            className={`card plan-card ${selectedPlan === 'individual' ? 'selected' : ''}`}
            onClick={() => setSelectedPlan('individual')}
            style={{
              padding: 28,
              borderRadius: 16,
              border: selectedPlan === 'individual' ? '2px solid #6366f1' : '1px solid var(--border)',
              background: 'var(--card)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: selectedPlan === 'individual' ? '0 8px 30px rgba(99, 102, 241, 0.15)' : 'var(--shadow)',
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Individual</h3>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                For solo developers & freelance agile workflows
              </p>
            </div>

            <div style={{ margin: '16px 0 24px' }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)' }}>
                {currencySymbol}{calculateDisplayPrice('individual')}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 14 }}> / month</span>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>1 member included</div>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                <span style={{ color: '#22c55e' }}>✓</span> Single developer workspace
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                <span style={{ color: '#22c55e' }}>✓</span> Unlimited tasks & sprint boards
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                <span style={{ color: '#22c55e' }}>✓</span> Standard email support
              </li>
            </ul>

            <button
              className={`btn ${selectedPlan === 'individual' ? 'btn-primary' : ''}`}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {selectedPlan === 'individual' ? 'Selected' : 'Select Individual'}
            </button>
          </div>

          {/* PLAN 2: Team (With Dynamic Stepper & Pricing Formula) */}
          <div
            className={`card plan-card ${selectedPlan === 'team' ? 'selected' : ''}`}
            onClick={() => setSelectedPlan('team')}
            style={{
              padding: 28,
              borderRadius: 16,
              border: selectedPlan === 'team' ? '2px solid #6366f1' : '1px solid var(--border)',
              background: 'var(--card)',
              position: 'relative',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: selectedPlan === 'team' ? '0 12px 36px rgba(99, 102, 241, 0.2)' : 'var(--shadow)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -12,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#6366f1',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '4px 12px',
                borderRadius: 20,
                letterSpacing: '0.05em',
              }}
            >
              Most Popular
            </div>

            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Team</h3>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                For agile squads & collaborating engineering teams
              </p>
            </div>

            {/* Dynamic Calculated Price Display */}
            <div style={{ margin: '16px 0 16px' }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)' }}>
                {currencySymbol}{calculateDisplayPrice('team')}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 14 }}> / month</span>
              <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, marginTop: 4 }}>
                {isUpi
                  ? `Starting at ₹500/mo (₹250 per member/month)`
                  : `Starting at $6/mo ($3 per member/month)`}
              </div>
            </div>

            {/* Interactive Member Count Stepper */}
            <div
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '12px 16px',
                marginBottom: 20,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Team Members:</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#6366f1' }}>{teamMembers} seats</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  type="button"
                  className="btn"
                  style={{ width: 36, height: 36, padding: 0, justifyContent: 'center', fontSize: 16, fontWeight: 700 }}
                  onClick={() => handleMemberChange(-1)}
                  disabled={teamMembers <= 2}
                  title="Decrease members (Min: 2)"
                >
                  –
                </button>

                <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
                  {teamMembers}
                </div>

                <button
                  type="button"
                  className="btn"
                  style={{ width: 36, height: 36, padding: 0, justifyContent: 'center', fontSize: 16, fontWeight: 700 }}
                  onClick={() => handleMemberChange(1)}
                  disabled={teamMembers >= 50}
                  title="Increase members (Max: 50)"
                >
                  +
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 6 }}>
                {isUpi
                  ? `Formula: ${teamMembers} × ₹250 = ₹${teamMembers * 250}/mo`
                  : `Formula: ${teamMembers} × $3 = $${teamMembers * 3}/mo`}
              </div>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                <span style={{ color: '#22c55e' }}>✓</span> Minimum 2 team members
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                <span style={{ color: '#22c55e' }}>✓</span> Dynamic seat management ({isUpi ? '₹250' : '$3'}/seat)
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                <span style={{ color: '#22c55e' }}>✓</span> Shared team sprint boards & burndown
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                <span style={{ color: '#22c55e' }}>✓</span> Team activity audit logs & velocity
              </li>
            </ul>

            <button
              className={`btn ${selectedPlan === 'team' ? 'btn-primary' : ''}`}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {selectedPlan === 'team' ? 'Selected' : 'Select Team'}
            </button>
          </div>

          {/* PLAN 3: Business */}
          <div
            className={`card plan-card ${selectedPlan === 'business' ? 'selected' : ''}`}
            onClick={() => setSelectedPlan('business')}
            style={{
              padding: 28,
              borderRadius: 16,
              border: selectedPlan === 'business' ? '2px solid #6366f1' : '1px solid var(--border)',
              background: 'var(--card)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: selectedPlan === 'business' ? '0 8px 30px rgba(99, 102, 241, 0.15)' : 'var(--shadow)',
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Business</h3>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                For high-velocity organizations & growing enterprises
              </p>
            </div>

            <div style={{ margin: '16px 0 24px' }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)' }}>
                {currencySymbol}{calculateDisplayPrice('business')}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 14 }}> / month</span>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Full organization access</div>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                <span style={{ color: '#22c55e' }}>✓</span> Unlimited team members & projects
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                <span style={{ color: '#22c55e' }}>✓</span> Advanced AI sprint velocity insights
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                <span style={{ color: '#22c55e' }}>✓</span> Enterprise compliance & audit trail
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                <span style={{ color: '#22c55e' }}>✓</span> 24/7 Priority SLA support
              </li>
            </ul>

            <button
              className={`btn ${selectedPlan === 'business' ? 'btn-primary' : ''}`}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {selectedPlan === 'business' ? 'Selected' : 'Select Business'}
            </button>
          </div>
        </div>

        {/* Selected Plan Action Bar */}
        <div
          style={{
            marginTop: 32,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 20,
            boxShadow: 'var(--shadow)',
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
              Selected Subscription & Payment Method:
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Plan{' '}
              {selectedPlan === 'team' && `(${teamMembers} members)`} —{' '}
              <span style={{ color: '#6366f1' }}>
                {currencySymbol}{calculateDisplayPrice(selectedPlan)}/month
              </span>
            </div>
            <div style={{ fontSize: 13, color: isUpi ? '#16a34a' : 'var(--muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              {isUpi ? (
                <>
                  <span>📱</span>
                  <b>UPI Selected:</b> Scan QR code with Google Pay, PhonePe, Paytm, or enter any UPI ID on checkout.
                </>
              ) : (
                <>
                  <span>💳</span>
                  Protected by 256-bit Razorpay encryption. No card details stored on DevFlow servers.
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{
              padding: '14px 32px',
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 10,
              minWidth: 220,
              justifyContent: 'center',
            }}
            disabled={submitting}
            onClick={handleSubscribe}
          >
            {submitting ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'blobFloat 0.8s linear infinite' }}></span>
                Processing Checkout...
              </span>
            ) : isUpi ? (
              <span>Pay {currencySymbol}{calculateDisplayPrice(selectedPlan)} with UPI / QR →</span>
            ) : (
              <span>Pay {currencySymbol}{calculateDisplayPrice(selectedPlan)} with Card →</span>
            )}
          </button>
        </div>
      </div>

      {/* Payment History Section */}
      <div className="card" style={{ padding: 24, borderRadius: 16, boxShadow: 'var(--shadow)' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
          Payment History & Receipts
        </h2>

        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <p style={{ fontSize: 15, fontWeight: 500 }}>No payments recorded yet</p>
            <p style={{ fontSize: 13 }}>Once you make a payment, your official SaaS invoices and receipts will appear here.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: 12 }}>
                  <th style={{ padding: '12px 16px' }}>Receipt #</th>
                  <th style={{ padding: '12px 16px' }}>Plan</th>
                  <th style={{ padding: '12px 16px' }}>Members</th>
                  <th style={{ padding: '12px 16px' }}>Amount</th>
                  <th style={{ padding: '12px 16px' }}>Method</th>
                  <th style={{ padding: '12px 16px' }}>Date</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {history.map((pmt) => (
                  <tr key={pmt.payment_id} style={{ borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text)' }}>
                      {pmt.receipt_number}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {pmt.plan_name || 'Team'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {pmt.member_count || 1}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text)' }}>
                      {pmt.currency === 'INR' ? '₹' : '$'}{parseFloat(pmt.amount).toFixed(2)}
                    </td>
                    <td style={{ padding: '14px 16px', textTransform: 'uppercase', fontSize: 12, color: 'var(--muted)' }}>
                      {pmt.payment_method === 'upi' ? '⚡ UPI / QR' : (pmt.payment_method || 'Online')}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--muted)' }}>
                      {new Date(pmt.payment_time || pmt.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <Badge value={pmt.status} />
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {pmt.status === 'Success' ? (
                        <button
                          className="btn btn-sm"
                          style={{ fontSize: 12, padding: '4px 10px' }}
                          onClick={() => handleDownloadReceipt(pmt.payment_id, pmt.receipt_number)}
                          title="Download PDF Receipt"
                        >
                          <Icon name="file" /> Download
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 440, width: '100%', padding: 24, borderRadius: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Cancel DevFlow Subscription?
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to cancel your subscription? You will continue to have access until the end of your current billing period, after which your account will revert to the free starter tier.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn" onClick={() => setCancelModalOpen(false)}>
                Keep Subscription
              </button>
              <button
                className="btn"
                style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444' }}
                onClick={handleCancelSubscription}
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
