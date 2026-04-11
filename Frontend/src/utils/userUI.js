// import icon
import AdminIcon from "@/assets/icons/Icon-6.svg?react";
import UserIcon from "@/assets/icons/Icon-4.svg?react";
import RescuerIcon from "@/assets/icons/Icon-9.svg?react";

import VerifiedIcon from "@/assets/icons/Icon-1.svg?react";
import PendingIcon from "@/assets/icons/Icon-5.svg?react";
import Unverified from "@/assets/icons/Icon-8.svg?react";

// ROLE
export const ROLE_CONFIG = {
  "Quản trị viên": {
    icon: AdminIcon,
    className: "bg-blue-600 text-white",
  },
  "Đội cứu trợ": {
    icon: RescuerIcon,
    className: "bg-blue-100 text-blue-600",
  },
  "Người dân": {
    icon: UserIcon,
    className: "bg-gray-100 text-gray-600",
  },
};

// STATUS
export const STATUS_CONFIG = {
  "Đã xác minh": {
    icon: VerifiedIcon,
    className: "bg-green-100 text-green-600",
  },
  "Đang chờ": {
    icon: PendingIcon,
    className: "bg-yellow-100 text-yellow-600",
  },
  "Chưa xác minh": {
    icon: Unverified,
    className: "bg-red-100 text-red-500",
  },
};