
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";

const CompletionPopup = ({ isOpen, onClose, onBackHome }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white w-full max-w-[400px] rounded-[32px] p-8 shadow-2xl relative overflow-hidden text-center"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Animated Icon Container */}
            <div className="flex justify-center mb-8 relative">
              {/* Glow Effect */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1.2 }}
                transition={{ duration: 1, repeat: Infinity, repeatType: "mirror" }}
                className="absolute inset-0 bg-emerald-400/20 rounded-full blur-2xl"
              />
              
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 260, 
                  damping: 20,
                  delay: 0.2 
                }}
                className="relative"
              >
                <motion.div
                  animate={{ 
                    y: [0, -15, 0],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity, 
                    ease: "easeInOut",
                    times: [0, 0.5, 1]
                  }}
                  className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-200"
                >

                  <div className="w-12 h-12 rounded-full border-4 border-white/30 flex items-center justify-center">
                    <Check size={28} strokeWidth={4} />
                  </div>
                </motion.div>
              </motion.div>
            </div>

            {/* Content */}
            <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">
              Nhiệm vụ đã hoàn thành
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-10 px-4">
              Nạn nhân đã được cứu hộ thành công và hệ thống đã ghi nhận trạng thái hoàn tất.
            </p>

            {/* Action Button */}
            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: "#059669" }}
              whileTap={{ scale: 0.98 }}
              onClick={onBackHome}
              className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold text-base shadow-xl shadow-emerald-100 transition-all uppercase tracking-widest"
            >
              Về trang chủ
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CompletionPopup;
