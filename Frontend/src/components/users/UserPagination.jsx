const Pagination = ({
    currentPage = 1,
    totalPages = 1,
    onPageChange,
  }) => {
    return (
      <div className="flex items-center justify-between mt-4">
  
        <button
          className="px-3 py-2 border rounded-lg text-sm text-gray-500"
          onClick={() => onPageChange?.(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ← Trước
        </button>
  
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((page) => (
            <button
              key={page}
              onClick={() => onPageChange?.(page)}
              className={`w-8 h-8 text-sm ${
                page === currentPage
                  ? "rounded bg-blue-600 text-white"
                  : ""
              }`}
            >
              {page}
            </button>
          ))}
          <span>...</span>
          <button
            onClick={() => onPageChange?.(totalPages)}
            className="text-sm"
          >
            {totalPages}
          </button>
        </div>
  
        <button
          className="px-3 py-2 border rounded-lg text-sm"
          onClick={() => onPageChange?.(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Tiếp →
        </button>
  
      </div>
    );
  };
  
  export default Pagination;