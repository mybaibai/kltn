const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}) => {
  // tạo danh sách page thật
  const pages = Array.from(
    { length: totalPages },
    (_, i) => i + 1
  );

  return (
    <div className="flex items-center justify-between mt-6">

      {/* PREV */}
      <button
        className={`
          px-4 py-2 rounded-lg border text-sm transition
          ${
            currentPage === 1
              ? "opacity-50 cursor-not-allowed"
              : "bg-blue-50 hover:text-blue-600 hover:border-blue-400"
          }
        `}
        onClick={() => onPageChange?.(currentPage - 1)}
        disabled={currentPage === 1}
      >
        ← Trước
      </button>

      {/* PAGE NUMBERS */}
      <div className="flex items-center gap-2">

        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange?.(page)}
            className={`
              w-9 h-9 rounded-lg text-sm font-medium transition

              ${
                page === currentPage
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-100 text-gray-600"
              }
            `}
          >
            {page}
          </button>
        ))}

      </div>

      {/* NEXT */}
          <button
           className={`
            px-4 py-2 rounded-lg border text-sm transition
            ${
            currentPage === totalPages
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-blue-50 hover:text-blue-600 hover:border-blue-400"
            }
      `}
          onClick={() => onPageChange?.(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
        Tiếp →
      </button>

    </div>
  );
};

export default Pagination;