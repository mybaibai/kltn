const StatsCards = ({ stats }) => {
  // fallback nếu chưa có data
  const data = stats || [
    { title: "TỔNG CỘNG (DN)", value: "--" },
    { title: "LỰC LƯỢNG", value: "--" },
    { title: "ĐANG HOẠT ĐỘNG", value: "--" },
    { title: "NGƯNG HOẠT ĐỘNG", value: "--" },
  ];

  // màu cho từng card
  const cardStyles = [
    {
      bg: "bg-blue-50",
      border: "border-blue-100",
      title: "text-blue-500",
      value: "text-blue-700",
    },
    {
      bg: "bg-yellow-50",
      border: "border-yellow-100",
      title: "text-yellow-500",
      value: "text-yellow-700",
    },
    {
      bg: "bg-green-50",
      border: "border-green-100",
      title: "text-green-500",
      value: "text-green-700",
    },
    {
      bg: "bg-red-50",
      border: "border-red-100",
      title: "text-red-600",
      value: "text-red-700",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {data.map((item, i) => {
        const style = cardStyles[i];

        return (
          <div
            key={i}
            className={`
              ${style.bg}
              ${style.border}
              p-5 rounded-2xl border shadow-sm
              transition hover:shadow-md
            `}
          >
            <p className={`text-sm font-bold tracking-wide ${style.title}`}>
              {item.title}
            </p>

            <h2 className={`text-3xl font-bold mt-2 ${style.value}`}>
              {item.value}
            </h2>
          </div>
        );
      })}
    </div>
  );
};

export default StatsCards;