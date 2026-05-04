import dotenv from 'dotenv';
dotenv.config();

const analysisCache = new Map();

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích điều phối cứu trợ khẩn cấp.
Phân tích mô tả sự cố và trả về JSON duy nhất, không markdown, không text thừa:
{
  "priority_label": "Thấp/Trung bình/Cao/Cực kì cao",
  "priority_score": 1-10,
  "category": "string",
  "situation_summary": "string",
  "rescue_summary": "string",
  "victim_advice": "string"
}

Quy tắc priority:
- Thấp (1-3): Không nguy hiểm tính mạng ngay
- Trung bình (4-6): Cần hỗ trợ sớm
- Cao (7-8): Nguy hiểm, cần can thiệp nhanh
- Cực kì cao (9-10): Đe dọa tính mạng trực tiếp

situation_summary: Tóm tắt NGẮN GỌN tình huống thực tế đang xảy ra (1-2 câu, khách quan, dựa trên mô tả nạn nhân). VD: "Có vụ cháy lớn tại tòa nhà, 2 người bị kẹt ở tầng 3, khói dày đặc."
rescue_summary: Hướng dẫn cho ĐỘI CỨU HỘ — thiết bị cần mang, lưu ý hiện trường, các bước ưu tiên.
victim_advice: Hướng dẫn cho NẠN NHÂN — trấn an, sơ cứu cơ bản, chờ cứu hộ.
Trả lời bằng tiếng Việt, súc tích, chuyên nghiệp.`;

export async function analyzeSOS(description, incidentTypeName = '') {
  const cacheKey = `${incidentTypeName}::${String(description).slice(0, 120)}`;
  if (analysisCache.has(cacheKey)) {
    console.log('📦 AI cache hit');
    return analysisCache.get(cacheKey);
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ GROQ_API_KEY chưa cấu hình trong .env');
    return null;
  }

  const cleanDesc = String(description || '').trim();
  if (!cleanDesc && !incidentTypeName) {
    return {
      priority_score: 3,
      priority_label: 'Thấp',
      category: 'Khác',
      rescue_summary: 'Nạn nhân chưa mô tả. Cần xác nhận tình trạng khi đến nơi.',
      victim_advice: 'Hãy giữ bình tĩnh và ở lại nơi an toàn. Đội cứu hộ đang trên đường.',
    };
  }

  const prompt = `Loại sự cố: ${incidentTypeName || 'Chưa rõ'}. Mô tả từ nạn nhân: "${cleanDesc}"`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const startTime = Date.now();

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 500,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Groq ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content || '';
      console.log(`⏱️ Groq AI took ${Date.now() - startTime}ms (attempt ${attempt})`);

      const cleanText = rawText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanText);

      const aiResult = {
  priority_score:    Math.min(10, Math.max(1, Math.round(Number(parsed.priority_score) || 5))),
  priority_label:    String(parsed.priority_label || 'Trung bình').trim(),
  category:          String(parsed.category || 'Khác').trim(),
  situation_summary: String(parsed.situation_summary || '').trim(), // ← thêm dòng này
  rescue_summary:    String(parsed.rescue_summary || '').trim(),
  victim_advice:     String(parsed.victim_advice || '').trim(),
};

      // Cache 1 giờ
      analysisCache.set(cacheKey, aiResult);
      setTimeout(() => analysisCache.delete(cacheKey), 60 * 60 * 1000);

      return aiResult;

    } catch (err) {
      console.error(`❌ AI attempt ${attempt} failed:`, err.message);
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  return null;
}