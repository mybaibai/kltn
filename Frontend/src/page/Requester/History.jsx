import { useState } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import Fire from '../../assets/fire.svg?react';
import Compass from '../../assets/lost.svg?react';
import Car from '../../assets/car.svg?react';    
import PlusCircle from '../../assets/medical.svg?react';
import Waves from '../../assets/wave.svg?react';
import MoreHorizontal from '../../assets/more.svg?react'; 
import Header from "./Header";

const HISTORY_DATA = [
  {
    id: 1,
    type: 'vehicle',
    label: 'Tai nạn giao thông',
    time: '14:30, 15 Tháng 5, 2024',
    location: 'Ngã tư Lê Lợi - Nam Kỳ Khởi Nghĩa, Quận 1',
    status: 'HOÀN THÀNH',
  },
  {
    id: 2,
    type: 'medical',
    label: 'Cấp cứu y tế',
    time: '08:15, 10 Tháng 5, 2024',
    location: '245 Nguyễn Trãi, Phường Nguyễn Cư Trinh, Quận 1',
    status: 'HOÀN THÀNH',
  },
  {
    id: 3,
    type: 'fire',
    label: 'Cháy nổ',
    time: '22:00, 28 Tháng 4, 2024',
    location: 'Chung cư Landmark 81, Quận Bình Thạnh',
    status: 'HOÀN THÀNH',
  },
];

const iconConfig = {
  vehicle: { Component: Car,        bg: 'bg-blue-100',   color: 'text-blue-500' },
  medical: { Component: PlusCircle, bg: 'bg-red-100',    color: 'text-red-500'  },
  fire:    { Component: Fire,       bg: 'bg-orange-100', color: 'text-orange-500' },
};

function HistoryCard({ item }) {
  const { Component, bg, color } = iconConfig[item.type] ?? iconConfig.vehicle;

  return (
    <div className="bg-white rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      {/* Icon */}
      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Component className={`w-6 h-6 ${color}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-[15px] mb-1">{item.label}</p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            {/* Clock icon */}
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {item.time}
          </span>
          <span className="flex items-center gap-1">
            {/* Pin icon */}
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            {item.location}
          </span>
        </div>
      </div>

      {/* Badge */}
      <span className="bg-green-500 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-full flex-shrink-0">
        {item.status}
      </span>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* <Header /> */}

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Lịch sử cứu trợ</h1>
        <p className="text-sm text-gray-500 mb-7">
          Danh sách các yêu cầu hỗ trợ khẩn cấp đã thực hiện.
        </p>

        <div className="flex flex-col gap-3">
          {HISTORY_DATA.map((item) => (
            <HistoryCard key={item.id} item={item} />
          ))}
        </div>
      </main>
    </div>
  );
}