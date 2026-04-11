import {
  Shield,
  Truck,
  User,
  CircleCheck,
  Clock,
  AlertCircle,
} from 'lucide-react';

const roleStyle = {
  admin: { icon: Shield, className: 'bg-blue-600 text-white' },
  rescue: { icon: Truck, className: 'bg-blue-100 text-blue-600' },
  victim: { icon: User, className: 'bg-gray-100 text-gray-600' },
};

/** ROLE — UI tiếng Việt + giá trị API (userModel: Admin, Rescue, Victim, …) */
export const ROLE_CONFIG = {
  'Quản trị viên': roleStyle.admin,
  Admin: roleStyle.admin,
  ADMIN: roleStyle.admin,
  'Đội cứu trợ': roleStyle.rescue,
  Rescue: roleStyle.rescue,
  RESCUE: roleStyle.rescue,
  'Người dân': roleStyle.victim,
  Victim: roleStyle.victim,
  VICTIM: roleStyle.victim,
};

const statusStyle = {
  ok: { icon: CircleCheck, className: 'bg-green-100 text-green-600' },
  warn: { icon: Clock, className: 'bg-yellow-100 text-yellow-600' },
  bad: { icon: AlertCircle, className: 'bg-red-100 text-red-500' },
};

/** STATUS — UI tiếng Việt + API (Active, Blocked, …) */
export const STATUS_CONFIG = {
  'Đã xác minh': statusStyle.ok,
  Active: statusStyle.ok,
  ACTIVE: statusStyle.ok,
  'Đang chờ': statusStyle.warn,
  INACTIVE: statusStyle.warn,
  'Chưa xác minh': statusStyle.bad,
  Blocked: statusStyle.bad,
  BANNED: statusStyle.bad,
};
