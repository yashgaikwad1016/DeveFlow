import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';

const VerifyOTP = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const location = useLocation();
  const [email, setEmail] = useState(() => location.state?.email || '');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const navigate = useNavigate();

  const handleOtpChange = (index, value) => {
    if (value.length > 1) {
      // If user pasted a full OTP
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      if (digits.length > 1) {
        const newOtp = [...otp];
        digits.forEach((d, i) => {
          if (i < 6) newOtp[i] = d;
        });
        setOtp(newOtp);
        const nextIdx = Math.min(digits.length, 5);
        document.getElementById(`otp-${nextIdx}`)?.focus();
        return;
      }
      value = value.slice(-1);
    }
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;
    const newOtp = [...otp];
    pastedData.split('').forEach((digit, i) => {
      newOtp[i] = digit;
    });
    setOtp(newOtp);
    const nextIdx = Math.min(pastedData.length, 5);
    document.getElementById(`otp-${nextIdx}`)?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      toast.error('Please enter a 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/verify-email', {
        email,
        otp: otpString
      });
      
      toast.success('Email verified successfully! You can now log in.');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || error.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!email) {
      toast.error('Email is required to resend OTP');
      return;
    }
    setResendLoading(true);
    try {
      await api.post('/auth/resend-otp', { email });
      toast.success('New OTP sent to your email!');
    } catch (error) {
      toast.error(error.response?.data?.message || error.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      {/* Animated background blobs */}
      <div className="blob-1 animate-blob"></div>
      <div className="blob-2 animate-blob animation-delay-2000"></div>
      <div className="blob-3 animate-blob animation-delay-4000"></div>

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand-badge">DevFlow</div>
          <h1 className="auth-title">Verify Email</h1>
          <p className="auth-subtitle">Enter the 6-digit code sent to your email</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-field"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label text-center">OTP Code</label>
            <div className="otp-container" onPaste={handlePaste}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="otp-input-box"
                  maxLength="1"
                  required
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Didn't receive the code?{' '}
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={resendLoading}
              className="auth-link-button"
            >
              {resendLoading ? 'Sending...' : 'Resend OTP'}
            </button>
          </p>
          <p style={{ marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="auth-link-subtle"
            >
              ← Back to Register
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyOTP;
