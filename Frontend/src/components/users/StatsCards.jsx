const StatsCards = ({ stats }) => {
    // 🔥 fallback nếu chưa có data
    const data = stats || [
      { title: "TỔNG CỘNG (DN)", value: "--" },
      { title: "LỰC LƯỢNG", value: "--" },
      { title: "ĐÃ XÁC MINH", value: "--" },
      { title: "ĐANG CHỜ", value: "--" },
    ];
  
    return (
      <div className="grid grid-cols-4 gap-4">
        {data.map((item, i) => (
          <div
            key={i}
            className="bg-white p-4 rounded-xl border shadow-sm"
          >
            <p className="text-gray-400 text-xs">
              {item.title}
            </p>
            <h2 className="text-xl font-semibold">
              {item.value}
            </h2>
          </div>
        ))}
      </div>
    );
  };
  
  export default StatsCards;