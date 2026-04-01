import { useState, useRef, useEffect } from 'react';

function PhoneStep({ onNext }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    onNext(phone);
  };

  return (
    <div className="px-8 pt-2 pb-7 flex flex-col items-center">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
        <svg viewBox="0 0 24 24" fill="#dc2626" className="w-8 h-8">
          <path d="M12 1L3 5v6c0 5.25 3.75 10.15 9 11.35C17.25 21.15 21 16.25 21 11V5l-9-4zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 9c-2.67 0-5.33 1.33-6 2v.35C7.67 17.55 9.75 18.5 12 18.5s4.33-.95 6-1.65V16c-.67-.67-3.33-2-6-2z"/>
        </svg>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-1">Đăng Nhập</h2>
      <p className="text-sm text-gray-400 mb-6">Vui lòng nhập số điện thoại để tiếp tục</p>

      <div className="w-full mb-4">
        <p className="text-xs font-bold text-gray-500 tracking-widest uppercase mb-2">Số điện thoại</p>
        <div className="flex w-full rounded-xl bg-gray-100 overflow-hidden border border-gray-100 focus-within:border-red-300 focus-within:ring-2 focus-within:ring-red-100 transition-all">
          <div className="flex items-center gap-1.5 px-4 border-r border-gray-200 flex-shrink-0">
            <span className="text-sm font-semibold text-gray-500">VN</span>
            <span className="text-sm font-bold text-gray-700">+84</span>
          </div>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            placeholder="9xx xxx xxx"
            maxLength={10}
            className="flex-1 bg-transparent px-4 py-3.5 text-sm text-gray-700 placeholder-gray-400 outline-none"
          />
        </div>
      </div>

      <button
        onClick={handleConfirm}
        disabled={loading || !phone.trim()}
        className={`w-full py-3.5 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all mb-4
          ${loading || !phone.trim() ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-[0.98]'}`}
      >
        {loading ? (
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        ) : (
          <>Xác nhận
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-4 h-4">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </>
        )}
      </button>

      <button className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
        Gặp sự cố khi đăng nhập?
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round"/>
          <circle cx="12" cy="17" r="0.5" fill="currentColor"/>
        </svg>
      </button>
    </div>
  );
}

const OTP_LENGTH = 6;

function OtpStep({ phone, onBack, onConfirm }) {
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [error, setError] = useState('');
  const refs = useRef([]);

  useEffect(() => { refs.current[0]?.focus(); }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = (i, val) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[i] = digit; setOtp(next); setError('');
    if (digit && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      if (otp[i]) { const next = [...otp]; next[i] = ''; setOtp(next); }
      else if (i > 0) refs.current[i - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = [...otp];
    pasted.split('').forEach((d, idx) => { next[idx] = d; });
    setOtp(next);
    refs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    e.preventDefault();
  };

  const handleResend = () => {
    setCountdown(60); setOtp(Array(OTP_LENGTH).fill('')); setError('');
    refs.current[0]?.focus();
  };

  const handleSubmit = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    if (code === '000000') { setError('Mã OTP không đúng. Vui lòng thử lại.'); return; }
    onConfirm?.(`+84${phone.replace(/^0/, '')}`, code);
  };

  const filled = otp.join('').length === OTP_LENGTH;
  const displayPhone = `+84 ${phone.replace(/^0/, '')}`;

  return (
    <div className="px-8 pt-2 pb-7 flex flex-col items-center">
      {/* Back row */}
       <div className="w-full flex items-center justify-between mb-5">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
            <path d="M19 12H5M11 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="#dc2626" className="w-8 h-8">
            <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14zm-5-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
          </svg>
        </div>
        <div className="w-5" />
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-1">Xác thực OTP</h2>
      <p className="text-sm text-gray-400 text-center mb-0.5">Nhập mã {OTP_LENGTH} chữ số đã gửi đến</p>
      <p className="text-sm font-bold text-red-600 mb-6">{displayPhone}</p>

      {/* OTP boxes */}
      <div className="flex gap-2 mb-2 w-full justify-center" onPaste={handlePaste}>
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={el => refs.current[i] = el}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            style={{ height: '52px', width: '42px' }}
            className={`text-center text-xl font-bold rounded-xl border-2 outline-none transition-all bg-gray-50
              ${error
                ? 'border-red-400 bg-red-50 text-red-600'
                : digit
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-800 focus:border-red-400 focus:bg-red-50/40'
              }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1 mb-2 mt-1">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
            <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          {error}
        </p>
      )}

      <div className="text-sm text-gray-400 mb-5 mt-2">
        {countdown > 0 ? (
          <span>Gửi lại mã sau <span className="font-bold text-red-500">{countdown}s</span></span>
        ) : (
          <button onClick={handleResend} className="text-red-600 font-semibold hover:underline">
            Gửi lại mã OTP
          </button>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !filled}
        className={`w-full py-3.5 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all mb-4
          ${loading || !filled ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-[0.98]'}`}
      >
        {loading ? (
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        ) : (
          <>Xác nhận
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-4 h-4">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </>
        )}
      </button>

      <button className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
        Gặp sự cố khi đăng nhập?
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round"/>
          <circle cx="12" cy="17" r="0.5" fill="currentColor"/>
        </svg>
      </button>
    </div>
  );
}

export default function LoginPopup({ onConfirm, onCancel }) {
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const modalRef = useRef(null);

  const handleOverlayClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onCancel?.();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4"
      onMouseDown={handleOverlayClick}
    >
      <div ref={modalRef} className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ fontFamily: "'Segoe UI', sans-serif" }}>
        <div className="flex justify-end px-5 pt-4">
          <button onClick={onCancel} className="text-gray-300 hover:text-gray-500 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {step === 'phone'
          ? <PhoneStep onNext={(p) => { setPhone(p); setStep('otp'); }} />
          : <OtpStep phone={phone} onBack={() => setStep('phone')} onConfirm={onConfirm} />
        }
      </div>
    </div>
  );
}