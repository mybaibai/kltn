import StaffDashboardLayout from "@/components/staff/StaffDashboardLayout";
import { getAuthUser } from "@/services/auth/session";

export default function AdminPage() {
	const user = getAuthUser();

	return (
		<StaffDashboardLayout
			user={user}
			title="Trang quan tri he thong"
			description="Quan ly doi cuu tro, kiem tra trang thai va dieu phoi tai nguyen."
		>
			<h2 style={{ margin: "0 0 10px", color: "#0f172a", fontSize: 22 }}>
				Chuc nang quan tri
			</h2>
			<ul style={{ margin: 0, paddingLeft: 20, color: "#334155", lineHeight: 1.8 }}>
				<li>Them, khoa hoac mo khoa tai khoan doi cuu tro</li>
				<li>Xem tong quan tinh trang SOS theo thoi gian thuc</li>
				<li>Gan nguoi phu trach xu ly su co theo khu vuc</li>
			</ul>
		</StaffDashboardLayout>
	);
}
