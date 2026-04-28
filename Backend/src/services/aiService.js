// Backend/src/services/aiService.js
import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy init — không crash server khi chưa config API key
let _genAI = null;

function getGenAI() {
  if (_genAI) return _genAI;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  _genAI = new GoogleGenerativeAI(key);
  return _genAI;
}

const SYSTEM_PROMPT = `Bạn là trợ lý điều phối cứu hộ khẩn cấp tại Việt Nam.
Nhiệm vụ: Đọc mô tả sự cố từ nạn nhân → trả về thông tin chuẩn cho đội cứu hộ và hướng dẫn cho nạn nhân.

PHÂN LOẠI SỰ CỐ (category) — chọn đúng 1:
- "Thiên tai"           → lũ lụt, bão, ngập nước, sạt lở, động đất
- "Cháy nổ"            → cháy nhà, nổ bình gas, cháy xe, cháy rừng
- "Sự cố phương tiện"  → tai nạn xe, xe hỏng giữa đường, lật thuyền
- "Sức khỏe"           → đột quỵ, ngất xỉu, chấn thương, ngộ độc, sinh khẩn cấp
- "Lạc đường"          → mất phương hướng, kẹt trong rừng/núi
- "Khác"               → không thuộc loại nào trên

THANG ĐIỂM ƯU TIÊN (priority_score: số nguyên 1-10):
10: Đang chết — đuối nước, ngừng thở, kẹt trong lửa
9:  Nguy hiểm tính mạng — bất tỉnh, tai nạn xe nặng, ngộ độc nặng
8:  Khẩn cấp cao — mắc kẹt cần giải cứu ngay, chấn thương nặng
7:  Khẩn cấp — cháy đang lan, người già/trẻ bị lạc có thương tích
6:  Trung bình cao — lũ đang dâng, kẹt xe đêm trên đường nguy hiểm
5:  Trung bình — mắc kẹt nhưng an toàn, cần hỗ trợ không khẩn cấp
4:  Thấp vừa — xe hỏng, lạc đường khu vực an toàn
1-3:Thấp — chỉ cần tư vấn, không nguy hiểm ngay

rescue_summary — tóm tắt cho đội cứu hộ (tối đa 3 câu):
- Gồm: bản chất sự cố / mức độ nguy hiểm / thiết bị hoặc lưu ý cần chuẩn bị
- Giọng điều phối chuyên nghiệp, súc tích
- Ví dụ tốt: "Nạn nhân báo cáo tai nạn xe máy, khả năng chấn thương đầu và chân. Mức độ nguy hiểm trung bình-cao. Cần cáng, băng bó và liên hệ xe cấp cứu."

victim_advice — hướng dẫn cho nạn nhân (tối đa 2 câu):
- Hành động CỤ THỂ nạn nhân có thể làm NGAY LÚC NÀY
- Ví dụ tốt: "Hãy rời khỏi khu vực ngập lên chỗ cao và chờ cứu hộ. Không cố bơi qua dòng nước chảy mạnh."

QUAN TRỌNG — Trả về JSON THUẦN, KHÔNG markdown, KHÔNG backtick, KHÔNG giải thích bên ngoài:
{"priority_score":8,"category":"Sức khỏe","rescue_summary":"...","victim_advice":"..."}`;

/**
 * Phân tích mô tả SOS → tạo thông tin cho rescue + advice cho victim
 *
 * @param {string} description      - Mô tả của nạn nhân (text thuần)
 * @param {string} incidentTypeName - Loại sự cố đã chọn (ví dụ: "Sức khỏe")
 * @returns {Promise<{
 *   priority_score: number,
 *   category: string,
 *   rescue_summary: string,
 *   victim_advice: string,
 * } | null>}
 * Trả null khi: chưa config API key, Gemini lỗi, không parse được JSON
 * → Caller xử lý null gracefully — AI KHÔNG được crash SOS flow
 */
export async function analyzeSOS(description, incidentTypeName = '') {
  const client = getGenAI();
  if (!client) {
    console.warn('⚠️  GEMINI_API_KEY chưa cấu hình — bỏ qua AI analysis');
    return null;
  }

  const cleanDesc = String(description || '').trim();
  if (!cleanDesc && !incidentTypeName) {
    // Không có nội dung gì → trả fallback thay vì gọi API
    return {
      priority_score: 5,
      category: 'Khác',
      rescue_summary: 'Nạn nhân chưa cung cấp mô tả. Đội cứu hộ cần xác nhận tình trạng khi đến nơi.',
      victim_advice: 'Hãy giữ bình tĩnh và ở lại nơi an toàn. Đội cứu hộ đang trên đường đến.',
    };
  }

  try {
    const model = client.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 400,
        responseMimeType: 'application/json',
      },
    });

    const prompt = [
      incidentTypeName ? `Loại sự cố người dùng đã chọn: ${incidentTypeName}` : '',
      `Mô tả từ nạn nhân: "${cleanDesc}"`,
    ].filter(Boolean).join('\n');

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();

    // Parse JSON an toàn — trích xuất object JSON từ phản hồi dù AI có thêm text thừa
    const startIdx = rawText.indexOf('{');
    const endIdx = rawText.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      console.warn('⚠️ AI response không chứa JSON hợp lệ:', rawText.substring(0, 200));
      return null;
    }
    const jsonText = rawText.substring(startIdx, endIdx + 1);
    const parsed = JSON.parse(jsonText);

    const score = Number(parsed.priority_score);
    return {
      priority_score: Number.isFinite(score)
        ? Math.min(10, Math.max(1, Math.round(score)))
        : 5,
      category:       String(parsed.category       || 'Khác').trim(),
      rescue_summary: String(parsed.rescue_summary  || '').trim(),
      victim_advice:  String(parsed.victim_advice   || '').trim(),
    };
  } catch (err) {
    console.error('❌ analyzeSOS error:', err.message);
    return null; // Không bao giờ throw — AI không được crash SOS
  }
}