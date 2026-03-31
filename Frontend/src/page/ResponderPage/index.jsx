import { Bell, ChevronDown, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { assignTeam, getAllSos, getSosByTeam, updateSosStatus } from '@/services/api/apiSos';
import { findNearestTeams, getAllTeams, updateTeamLocation } from '@/services/api/apiTeam';

const LEVEL_STYLES = {
	high: {
		dot: 'bg-red-600',
		edge: 'before:bg-red-700',
		badge: 'bg-red-700 text-red-50',
		button: 'bg-red-700 hover:bg-red-800',
	},
	medium: {
		dot: 'bg-amber-600',
		edge: 'before:bg-amber-700',
		badge: 'bg-amber-700 text-amber-50',
		button: 'bg-amber-700 hover:bg-amber-800',
	},
	low: {
		dot: 'bg-emerald-600',
		edge: 'before:bg-emerald-700',
		badge: 'bg-emerald-700 text-emerald-50',
		button: 'bg-emerald-700 hover:bg-emerald-800',
	},
};

const LEVEL_LABEL = {
	high: 'CAO',
	medium: 'TRUNG BÌNH',
	low: 'THẤP',
};

const TEAM_STATUS_LABEL = {
	available: 'SẴN SÀNG',
	busy: 'ĐANG BẬN',
	offline: 'NGOẠI TUYẾN',
};

const TEAM_STATUS_STYLE = {
	available: 'border-emerald-200 bg-emerald-50 text-emerald-700',
	busy: 'border-amber-200 bg-amber-50 text-amber-700',
	offline: 'border-zinc-300 bg-zinc-100 text-zinc-600',
};

const OPEN_STATUSES = new Set(['pending', 'assigned', 'in_progress']);

const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

const normalizeTeamStatus = (status) => {
	const value = normalizeStatus(status);
	if (value === 'active' || value === 'available') return 'available';
	if (value === 'busy' || value === 'assigned' || value === 'in_progress') return 'busy';
	return 'offline';
};

const toNumber = (value) => {
	const num = Number(value);
	return Number.isFinite(num) ? num : 0;
};

const toLevel = (item) => {
	const status = normalizeStatus(item.status);

	if (typeof item.ai_priority_score === 'number') {
		if (item.ai_priority_score >= 80) return 'high';
		if (item.ai_priority_score >= 50) return 'medium';
		return 'low';
	}

	if (status === 'pending') return 'high';
	if (status === 'assigned') return 'medium';
	return 'low';
};

const formatCreatedTime = (createdAt) => {
	if (!createdAt) return '--:--';
	return new Date(createdAt).toLocaleTimeString('vi-VN', {
		hour: '2-digit',
		minute: '2-digit',
	});
};

const formatAgo = (createdAt) => {
	if (!createdAt) return 'vừa xong';
	const diffMs = Math.max(0, Date.now() - new Date(createdAt).getTime());
	const sec = Math.floor(diffMs / 1000);
	if (sec < 60) return `${sec} giây trước`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min} phút trước`;
	const hour = Math.floor(min / 60);
	return `${hour} giờ trước`;
};

const haversineKm = (lat1, lng1, lat2, lng2) => {
	const toRad = (n) => (n * Math.PI) / 180;
	const earthR = 6371;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	return earthR * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const estimateEta = (distanceKm) => {
	const speedKmH = 35;
	const minute = Math.max(1, Math.round((distanceKm / speedKmH) * 60));
	return `~${minute} phút`;
};

const formatCoords = (lat, lng) => `${toNumber(lat).toFixed(4)}° N, ${toNumber(lng).toFixed(4)}° E`;

const mapSosToView = (sos, team) => {
	const level = toLevel(sos);
	const normalizedStatus = normalizeStatus(sos.status);
	const createdAt = sos.createdAt || sos.created_at || null;
	const teamCoords = team?.location?.coordinates || [null, null];
	const teamLng = toNumber(teamCoords[0]);
	const teamLat = toNumber(teamCoords[1]);
	const reqLat = toNumber(sos.latitude);
	const reqLng = toNumber(sos.longitude);

	const hasTeamPos = Number.isFinite(teamCoords[0]) && Number.isFinite(teamCoords[1]);
	const distanceKm = hasTeamPos ? haversineKm(teamLat, teamLng, reqLat, reqLng) : 0;
	const distanceText = hasTeamPos ? `${distanceKm.toFixed(1)}km` : '--';

	return {
		id: sos._id,
		level,
		levelLabel: LEVEL_LABEL[level],
		distance: distanceText,
		time: formatCreatedTime(createdAt),
		title: sos.incident_type_id?.name || sos.ai_category || 'Yêu cầu cứu trợ',
		description: sos.description || 'Chưa có mô tả từ người gửi.',
		address: sos.address || `${reqLat.toFixed(5)}, ${reqLng.toFixed(5)}`,
		coords: formatCoords(reqLat, reqLng),
		eta: hasTeamPos ? estimateEta(distanceKm) : '--',
		newSince: formatAgo(createdAt),
		status: normalizedStatus,
		raw: sos,
	};
};

function RequestCard({ request, active, onSelect }) {
	const style = LEVEL_STYLES[request.level];

	return (
		<article
			className={[
				'relative rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm transition-all duration-200 before:absolute before:bottom-4 before:left-0 before:top-4 before:w-1.5 before:rounded-r-md',
				style.edge,
				active ? 'ring-2 ring-zinc-900/10 shadow-md' : 'hover:-translate-y-0.5 hover:shadow-md',
			].join(' ')}
		>
			<div className="mb-3 flex items-start justify-between gap-3">
				<div className="flex items-center gap-2">
					<span className={`rounded-full px-3 py-1 text-xs font-bold tracking-wide ${style.badge}`}>
						{request.levelLabel}
					</span>
					<div className="flex items-center gap-1 text-xs text-zinc-500">
						<MapPin size={12} />
						<span>{request.distance}</span>
					</div>
				</div>
				<span className="text-xs font-medium text-zinc-500">{request.time}</span>
			</div>

			<h3 className="mb-2 text-3xl leading-none font-black text-zinc-900">{request.title}</h3>
			<p className="mb-4 max-w-4xl text-sm leading-relaxed text-zinc-600">{request.description}</p>

			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="max-w-2xl text-xs font-semibold tracking-wide text-zinc-500">{request.address}</p>
				<button
					type="button"
					onClick={() => onSelect(request.id)}
					className="rounded-xl bg-zinc-100 px-6 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-200"
				>
					Xem chi tiết
				</button>
			</div>
		</article>
	);
}

export default function ResponderPage() {
	const [team, setTeam] = useState(null);
	const [nearestTeams, setNearestTeams] = useState([]);
	const [requests, setRequests] = useState([]);
	const [selectedId, setSelectedId] = useState('');
	const [loading, setLoading] = useState(true);
	const [syncing, setSyncing] = useState(false);
	const [error, setError] = useState('');

	const refreshData = useCallback(async () => {
		setLoading(true);
		setError('');

		try {
			const [teamsRes, sosRes] = await Promise.all([getAllTeams(), getAllSos()]);
			const teams = teamsRes.data?.data || [];
			const preferredTeamId = team?._id || import.meta.env.VITE_RESPONDER_TEAM_ID;
			const activeTeam =
				teams.find((item) => item._id === preferredTeamId) || teams[0] || null;

			if (activeTeam) {
				setTeam(activeTeam);
			}

			const allSos = (sosRes.data?.data || []).filter((item) =>
				OPEN_STATUSES.has(normalizeStatus(item.status))
			);

			let teamSosIds = new Set();
			if (activeTeam?._id) {
				const teamSosRes = await getSosByTeam(activeTeam._id);
				teamSosIds = new Set((teamSosRes.data?.data || []).map((item) => item._id));
			}

			const mapped = allSos
				.map((item) => {
					const viewItem = mapSosToView(item, activeTeam);
					return {
						...viewItem,
						isOwnedByTeam: teamSosIds.has(item._id),
					};
				})
				.sort((a, b) => {
					const bTime = new Date(b.raw.createdAt || b.raw.created_at || 0).getTime();
					const aTime = new Date(a.raw.createdAt || a.raw.created_at || 0).getTime();
					return bTime - aTime;
				});

			setRequests(mapped);
			setSelectedId((prev) => {
				if (prev && mapped.some((item) => item.id === prev)) return prev;
				return mapped[0]?.id || '';
			});
		} catch (err) {
			setError(err.response?.data?.message || err.message || 'Không tải được dữ liệu từ server.');
			setRequests([]);
		} finally {
			setLoading(false);
		}
	}, [team?._id]);

	useEffect(() => {
		refreshData();
	}, [refreshData]);

	useEffect(() => {
		if (!team?._id || !navigator.geolocation) return;

		const watchId = navigator.geolocation.watchPosition(
			async ({ coords }) => {
				try {
					await updateTeamLocation(team._id, coords.latitude, coords.longitude);
					const nearestRes = await findNearestTeams(coords.latitude, coords.longitude, 10000);
					setNearestTeams(nearestRes.data?.data || []);
				} catch {
					setNearestTeams([]);
				}
			},
			() => setNearestTeams([]),
			{ enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
		);

		return () => navigator.geolocation.clearWatch(watchId);
	}, [team?._id]);

	const handleAccept = async (sosId) => {
		if (!team?._id) {
			setError('Chưa có đội cứu trợ khả dụng để nhận yêu cầu.');
			return;
		}

		setSyncing(true);
		setError('');

		try {
			await assignTeam(sosId, team._id);
			await updateSosStatus(sosId, 'in_progress');
			await refreshData();
			setSelectedId(sosId);
		} catch (err) {
			setError(err.response?.data?.message || err.message || 'Không thể nhận yêu cầu lúc này.');
		} finally {
			setSyncing(false);
		}
	};

	const activeRequest = useMemo(() => requests.find((item) => item.id === selectedId) || requests[0] || null, [requests, selectedId]);
	const activeStyle = activeRequest ? LEVEL_STYLES[activeRequest.level] : LEVEL_STYLES.high;
	const teamStatus = normalizeTeamStatus(team?.status);
	const teamStatusClass = TEAM_STATUS_STYLE[teamStatus] || TEAM_STATUS_STYLE.offline;
	const teamStatusLabel = TEAM_STATUS_LABEL[teamStatus] || TEAM_STATUS_LABEL.offline;

	return (
		<div className="min-h-screen bg-gradient-to-b from-zinc-100 to-zinc-50 text-zinc-900">
			<div className="mx-auto max-w-[1500px] px-4 py-5 md:px-8">
				<header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white/90 px-5 py-3 shadow-sm backdrop-blur">
					<div>
						<p className="text-[10px] font-black tracking-[0.35em] text-red-700">SENTINEL</p>
						<p className="text-xl font-black tracking-tight text-red-700">RESCUE</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
						>
							Gần nhất
							<ChevronDown size={16} />
						</button>
						<button
							type="button"
							className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
						>
							Mức độ khẩn cấp
							<ChevronDown size={16} />
						</button>
					</div>

					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={refreshData}
							className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100"
						>
							<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
							Làm mới
						</button>
						<button
							type="button"
							className="relative rounded-full border border-zinc-200 bg-zinc-50 p-2 text-zinc-600 transition-colors hover:bg-zinc-100"
							aria-label="Thông báo"
						>
							<Bell size={18} />
							<span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-600" />
						</button>
						<div className="h-10 w-10 rounded-full bg-[radial-gradient(circle_at_30%_30%,#4b5563_0%,#111827_65%)] shadow-inner" />
					</div>
				</header>

				<main className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
					<section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm md:p-6">
						<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
							<div>
								<h1 className="text-3xl font-black tracking-tight md:text-4xl">NHẬN YÊU CẦU CỨU TRỢ</h1>
								<div className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
									<span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
									Đang giám sát thời gian thực
								</div>
							</div>

							<div className={`rounded-xl border px-4 py-2 text-right ${teamStatusClass}`}>
								<p className="text-[11px] font-semibold tracking-wider">TRẠNG THÁI ĐỘI</p>
								<p className="text-sm font-black">{teamStatusLabel}</p>
							</div>
						</div>

						{error ? (
							<p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
						) : null}

						{loading ? (
							<div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
								<Loader2 size={16} className="animate-spin" />
								Đang tải danh sách yêu cầu...
							</div>
						) : null}

						<div className="space-y-4">
							{!loading && requests.length === 0 ? (
								<div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-5 text-sm text-zinc-600">
									Hiện chưa có yêu cầu SOS đang mở.
								</div>
							) : null}

							{requests.map((request) => (
								<RequestCard
									key={request.id}
									request={request}
									active={selectedId === request.id}
									onSelect={setSelectedId}
								/>
							))}
						</div>
					</section>

					<aside className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm md:p-6">
						{!activeRequest ? (
							<div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
								Chọn một yêu cầu từ danh sách để xem chi tiết.
							</div>
						) : (
							<>
						<div className="mb-5 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-900">
							<div className="relative h-44 bg-[radial-gradient(circle_at_60%_35%,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.08)_30%,transparent_60%),radial-gradient(circle_at_40%_60%,rgba(255,255,255,0.2)_0%,transparent_44%),linear-gradient(135deg,#0f172a_0%,#18181b_55%,#111827_100%)]">
								<div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:48px_48px]" />
								<div className="absolute bottom-4 left-4">
									<p className="text-[10px] font-semibold tracking-[0.2em] text-zinc-200">TỌA ĐỘ MỤC TIÊU</p>
									<p className="text-2xl font-black text-white">{activeRequest.coords}</p>
								</div>
							</div>
						</div>

						<div className="mb-4">
							<p className="text-sm text-zinc-500">Yêu cầu lúc: {activeRequest.time}</p>
							<h2 className="mt-1 text-4xl font-black tracking-tight text-zinc-900">{activeRequest.title}</h2>
							<div className="mt-2 flex items-center gap-2 text-sm font-semibold text-red-700">
								<MapPin size={16} />
								<span>{activeRequest.address}</span>
							</div>
						</div>

						<div className="mb-5 border-t border-zinc-200 pt-4">
							<p className="text-xs font-semibold tracking-[0.2em] text-zinc-500">CHI TIẾT</p>
							<p className="mt-2 text-lg font-medium text-zinc-700">{activeRequest.description}</p>
						</div>

						<div className="mb-6 grid grid-cols-2 gap-3">
							<div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
								<p className="text-[11px] font-semibold tracking-wider text-zinc-500">KHOẢNG CÁCH</p>
								<p className="mt-1 text-3xl font-black text-zinc-900">{activeRequest.distance}</p>
							</div>
							<div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
								<p className="text-[11px] font-semibold tracking-wider text-zinc-500">THỜI GIAN TỚI</p>
								<p className="mt-1 text-3xl font-black text-zinc-900">{activeRequest.eta}</p>
							</div>
						</div>

						<div className="space-y-3">
							{[activeRequest, ...requests.filter((item) => item.id !== activeRequest.id)].slice(0, 4).map((item) => {
								const itemStyle = LEVEL_STYLES[item.level];
								const owned = item.isOwnedByTeam;
								const statusLabel =
									item.status === 'in_progress'
										? 'ĐANG XỬ LÝ'
										: item.status === 'assigned'
											? 'ĐÃ PHÂN CÔNG'
											: 'CHỜ TIẾP NHẬN';

								return (
									<div
										key={`queue-${item.id}`}
										className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm"
									>
										<div className="mb-2 flex items-center justify-between">
											<span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${itemStyle.badge}`}>
												{item.levelLabel}
											</span>
											<span className="text-xs font-medium text-zinc-500">{item.newSince}</span>
										</div>

										<p className="text-sm font-semibold text-zinc-900">{item.title}</p>
										<p className="mb-2 text-xs text-zinc-500">{item.address}</p>
										<p className="mb-2 text-[11px] font-semibold text-zinc-500">{statusLabel}</p>

										<button
											type="button"
											onClick={() => handleAccept(item.id)}
											disabled={syncing || owned || item.status === 'in_progress'}
											className={`w-full rounded-lg px-4 py-2 text-sm font-bold text-white transition-colors ${itemStyle.button} disabled:cursor-not-allowed disabled:opacity-60`}
										>
											{owned || item.status === 'in_progress' ? 'ĐANG NHẬN' : 'NHẬN NGAY'}
										</button>
									</div>
								);
							})}
						</div>

						{nearestTeams.length > 0 ? (
							<div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
								Đội lân cận: {nearestTeams.map((item) => item.full_name || item.name || 'Chưa đặt tên').join(', ')}
							</div>
						) : null}

						<div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
							<span className={`h-2 w-2 rounded-full ${activeStyle.dot}`} />
							Luồng phân phối đang hoạt động
						</div>
							</>
						)}
					</aside>
				</main>
			</div>
		</div>
	);
}
