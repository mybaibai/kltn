import { useState } from 'react';

const incidentTypes = [
  { id: 'thienTai', label: 'Thiên tai', icon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      <path d="M8 12a4 4 0 0 1 4-4" strokeLinecap="round"/>
    </svg>
  )},
  { id: 'chayNo', label: 'Cháy nổ', icon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
      <path d="M12 2c0 6-6 8-6 13a6 6 0 0 0 12 0c0-5-6-7-6-13z" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 12c0 3-2 4-2 6a2 2 0 0 0 4 0c0-2-2-3-2-6z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
  { id: 'phuongTien', label: 'Sự cố phương tiện', icon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
      <rect x="1" y="10" width="22" height="8" rx="2"/>
      <path d="M5 10V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/>
      <circle cx="7" cy="18" r="2"/>
      <circle cx="17" cy="18" r="2"/>
      <path d="M12 5v1M12 3v1" strokeLinecap="round"/>
      <path d="M12 2l1 2h-2l1-2z" fill="currentColor" stroke="none"/>
    </svg>
  )},
  { id: 'sucKhoe', label: 'Sức khỏe', icon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M12 8v8M8 12h8" strokeLinecap="round"/>
    </svg>
  )},
  { id: 'lacDuong', label: 'Lạc đường', icon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="1" fill="currentColor"/>
    </svg>
  )},
  { id: 'khac', label: 'Khác', icon: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
      <circle cx="5" cy="12" r="2"/>
      <circle cx="12" cy="12" r="2"/>
      <circle cx="19" cy="12" r="2"/>
    </svg>
  )},
];

export default function SOSForm({ position, onConfirm, onCancel, sending }) {
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState(null);

  const handleSubmit = () => {
    if (!selectedType) {
      return;
    }
    onConfirm?.({ type: selectedType, description });
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4">
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ fontFamily: "'Segoe UI', sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-600 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                <path d="M12 2L2 19h20L12 2zm0 3.5L19.5 18h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">Gửi yêu cầu cứu trợ</h2>
              <p className="text-sm text-gray-400 mt-0.5">Đội cứu hộ sẽ phản hồi trong vòng 1-3 phút</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Incident Type */}
          <div>
            <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3 flex items-center gap-1.5">
              <span className="w-0.5 h-3.5 bg-red-600 rounded-full inline-block"></span>
              Loại sự cố
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {incidentTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl border-2 transition-all
                      ${isSelected
                        ? 'border-red-500 bg-red-50 text-red-600'
                        : 'border-gray-100 bg-gray-50 text-red-500 hover:border-red-200 hover:bg-red-50/50'
                      }`}
                  >
                    <Icon />
                    <span className={`text-xs font-medium text-center leading-tight ${isSelected ? 'text-red-700' : 'text-gray-700'}`}>
                      {type.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3 flex items-center gap-1.5">
              <span className="w-0.5 h-3.5 bg-red-600 rounded-full inline-block"></span>
              Mô tả chi tiết
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent resize-none transition"
              placeholder="Mô tả ngắn gọn tình huống bạn đang gặp phải..."
              rows={3}
            />
          </div>

          {/* Location & Contact */}
          <div className="grid grid-cols-2 gap-4">
            {/* Location */}
            <div>
              <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-2 flex items-center gap-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path d="M12 21c-4-4-7-7.5-7-11a7 7 0 0 1 14 0c0 3.5-3 7-7 11z" strokeLinejoin="round"/>
                  <circle cx="12" cy="10" r="2.5"/>
                </svg>
                Vị trí hiện tại
              </p>
              <div className="bg-gray-50 rounded-xl p-3 border-l-4 border-green-500">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-white"/>
                  </div>
                  <p className="text-xs font-bold text-gray-800 leading-tight">
                    {position?.address?.slice(0, 30) }
                  </p>
                </div>
                <p className="text-xs text-gray-400 ml-6">10.7769° N, 106.7009° E</p>
                <button className="text-xs text-red-600 font-semibold ml-6 mt-1 flex items-center gap-1 hover:underline">
                  Cập nhật vị trí
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                    <path d="M21 12a9 9 0 1 1-9-9" strokeLinecap="round"/>
                    <path d="M21 3v4h-4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Contact */}
            <div>
              <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-2 flex items-center gap-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Thông tin liên hệ
              </p>
              <div className="space-y-2">
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Họ và tên</p>
                  <p className="text-sm font-semibold text-gray-800">Nguyễn Văn An</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Số điện thoại</p>
                  <p className="text-sm font-semibold text-gray-800">+84 901 234 567</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={sending || !selectedType}
              className={`flex-1 py-3.5 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all
                ${sending || !selectedType ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700 active:scale-[0.98]'}
              `}
            >
              {sending ? (
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 5h-2v6h2zm0 8h-2v2h2z"/>
                  </svg>
                  ✳ GỬI SOS
                </>
              )}
            </button>
            <button
              onClick={onCancel}
              className="px-5 py-3.5 rounded-xl text-gray-600 font-semibold hover:bg-gray-100 transition-colors"
            >
              Hủy
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Thông tin sẽ được gửi trực tiếp đến đội cứu trợ gần nhất
          </p>
        </div>
      </div>
    </div>
  );
}