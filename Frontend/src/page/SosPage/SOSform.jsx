
import { useState } from 'react';
import {
  MapPin, Send, User, Phone, Edit3,
  AlertTriangle, X, FileText, 
  // Car, Flame, PlusCircle,
//   Waves, Compass, MoreHorizontal, FileText,
} from 'lucide-react';
import Fire from '../../assets/fire.svg?react';
import Compass from '../../assets/lost.svg?react';
import Car from '../../assets/car.svg?react';    
import PlusCircle from '../../assets/medical.svg?react';
import Waves from '../../assets/wave.svg?react';
import MoreHorizontal from '../../assets/more.svg?react'; // nếu có
import { useNavigate } from "react-router-dom";

export default function SOSForm({ position, onConfirm, onCancel, sending, user }) {
  const [selectedType, setSelectedType] = useState(null);
  const [otherType, setOtherType] = useState('');
  const [description, setDescription] = useState('');

  const suggestions = ['Mất tích', 'Bị đe dọa', 'Ngập nước', 'Mất liên lạc'];

  const incidentTypes = [
    { id: 'vehicle', label: 'Sự cố phương tiện', icon: Car },
    { id: 'fire', label: 'Cháy nổ', icon: Fire },
    { id: 'medical', label: 'Sức khỏe khẩn cấp', icon: PlusCircle },
    { id: 'natural', label: 'Thiên tai', icon: Waves },
    { id: 'lost', label: 'Lạc đường', icon: Compass },
    { id: 'other', label: 'Khác', icon: MoreHorizontal },
  ];
  const [errorKey, setErrorKey] = useState(0);
  const [error, setError] = useState('');
  const showError = (msg) => {
    setError(msg);
    setErrorKey(k => k + 1);
    setTimeout(() => setError(''), 3000);
  };
  const handleSubmit = () => {
    const typeValue =
      selectedType === 'other' ? otherType : selectedType;
  
    if (!typeValue || !typeValue.trim()) {
      showError('Vui lòng chọn loại sự cố');
      return;
    }
  
    onConfirm?.({
      type: typeValue,
      description,
      position,
    });
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden">

        {/* HEADER */}
        <div className="px-6 py-4 flex justify-between items-center bg-gray-100 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="text-red-600" />
            </div>  
            <h2 className="font-bold text-lg">Gửi yêu cầu cứu trợ</h2>
          </div>

          <button onClick={onCancel}>
            <X />
          </button>
        </div>

        {/* CONTENT */}
        <div className="px-6 py-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[999999] bg-red-500 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg animate-bounce">
              ⚠️ {error}
            </div>
          )}
          {/* TYPE */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase mb-3">Loại sự cố</p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {incidentTypes.map((item) => {
                const Icon = item.icon;
                const active = selectedType === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedType(item.id)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold
                      ${active
                        ? 'border-green-500 bg-green-50 text-green-600'
                        : 'border-gray-300 bg-gray-100 hover:bg-gray-200'
                      }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          {/* OTHER */}
          {selectedType === 'other' && (
            <div className="mt-4 space-y-3">

              <div className="relative">
                <input
                  value={otherType}
                  onChange={(e) => setOtherType(e.target.value)}
                  placeholder="Nhập loại sự cố..."
                  className="w-full border-2 border-green-500 rounded-xl px-4 py-3 pr-10 focus:outline-none"
                />
                <Edit3 className="absolute right-3 top-3 text-green-600" />
              </div>

              {/* Suggestions */}
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setOtherType(s)}
                    className="px-3 py-1 bg-gray-200 rounded-full text-sm hover:bg-green-100 hover:text-green-600"
                  >
                    {s}
                  </button>
                ))}
              </div>

            </div>
          )}
        </div>

        {/* DESCRIPTION */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
            <FileText size={14} /> Mô tả chi tiết
          </p>

          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả tình trạng hiện tại..."
            className="w-full bg-gray-100 rounded-xl px-4 py-3"
          />
        </div>

        {/* LOCATION */}
        <div className="p-4 bg-gray-100 rounded-xl border">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2 text-green-600 font-semibold">
              <MapPin size={16} />
              Vị trí hiện tại
            </div>
            <button className="text-xs bg-green-100 text-green-600 px-3 py-1 rounded-lg font-bold">
              Cập nhật vị trí
            </button>
          </div>

          {position ? (
            <p className="text-sm text-gray-700 leading-relaxed">
              {position.address || `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">Chưa có vị trí</p>
          )}
        </div>

        {/* USER */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 flex gap-1 items-center mb-1">
              <User size={12} /> Người gửi
            </p>
            <div className="p-3 bg-gray-100 rounded-xl text-sm text-gray-700">
              {user?.full_name?.trim() || (
                <span className="text-gray-400 italic">Chưa có tên</span>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 flex gap-1 items-center mb-1">
              <Phone size={12} /> Số điện thoại
            </p>
            <div className="p-3 bg-gray-100 rounded-xl text-sm text-gray-700">
              {user?.phone || user?.phoneNumber || (
                <span className="text-gray-400 italic">Chưa có số điện thoại</span>
              )}
            </div>
          </div>
        </div>
        {/* FOOTER */}
        <div className="px-6 py-4 border-t bg-gray-100 space-y-3">
          <button
            onClick={handleSubmit}
            disabled={sending}
            className="w-full bg-red-600 text-white py-3 rounded-xl font-bold flex justify-center gap-2"
          >
            {sending ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send size={18} />
                Gửi SOS
              </>
            )}
          </button>

          <button
            onClick={onCancel}
            className="w-full text-gray-500"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  </div>
  );
}
