export const EMAIL_PROMPT_TEMPLATES = [
  {
    id: 'executive',
    label: 'Báo cáo điều hành',
    text: `Bạn là PM của dự án. Viết email báo cáo tình trạng dự án gửi Project Sponsor và Ban Lãnh đạo với các phần:
1. Tóm tắt điều hành: Tình trạng tổng thể (RAG), tiến độ hoàn thành, nhận xét chính
2. Sức khỏe dự án: Phân tích chi tiết từng epic/phase, chỉ số quan trọng
3. Rủi ro & Vấn đề: Liệt kê và phân tích tác động
4. Hoàn thành trong kỳ: Điểm nổi bật và deliverables đã đạt được
5. Kế hoạch tiếp theo: Ưu tiên 30 ngày tới, các quyết định cần từ Sponsor
Tone: chuyên nghiệp, súc tích, dựa trên dữ liệu. Highlight rõ điểm cần quyết định.`,
  },
  {
    id: 'quick',
    label: 'Cập nhật nhanh',
    text: `Viết email cập nhật nhanh dự án (tối đa 350 từ) với 3-4 điểm nổi bật của kỳ báo cáo. Format: bullet points ngắn gọn. Kết thúc bằng 1-2 action items cần Sponsor xử lý (nếu có).`,
  },
  {
    id: 'risk',
    label: 'Cảnh báo rủi ro',
    text: `Viết email cảnh báo rủi ro cho Project Sponsor. Phân tích chi tiết: rủi ro/vấn đề đang mở, nguyên nhân gốc rễ, tác động đến tiến độ, và quyết định/hỗ trợ cần thiết từ Sponsor để xử lý ngay.`,
  },
  {
    id: 'milestone',
    label: 'Review tiến độ',
    text: `Viết email review tiến độ dự án: thành tựu đã đạt trong kỳ, tình trạng các milestone (đúng tiến độ vs có rủi ro), tiến độ tổng thể so với kế hoạch ban đầu, và cảnh báo sớm nếu cần điều chỉnh.`,
  },
];
