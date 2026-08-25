export const EMAIL_PROMPT_TEMPLATES = [
  {
    id: 'executive',
    label: 'Báo cáo điều hành',
    icon: '📊',
    description: 'Đầy đủ 7 phần, phù hợp báo cáo định kỳ cho Ban Lãnh đạo',
    instruction: 'Soạn email báo cáo tình hình portfolio toàn diện gửi Ban Lãnh đạo. Bao gồm đầy đủ 7 phần: (1) Tóm tắt điều hành, (2) KPI chính dạng bảng, (3) Tình trạng sức khoẻ dự án theo Program với bảng màu RAG, phân tích nguyên nhân dự án đỏ/vàng, (4) Rủi ro và vấn đề trọng yếu top 5, (5) Cột mốc sắp tới 30 ngày, (6) Đánh giá xu hướng và nhận định PMO về điểm mạnh/yếu, (7) Khuyến nghị hành động cụ thể CẦN lãnh đạo quyết định hoặc hỗ trợ — nêu rõ người/team đề xuất phụ trách và timeline.',
  },
  {
    id: 'quick',
    label: 'Cập nhật nhanh',
    icon: '⚡',
    description: 'Ngắn gọn, chỉ highlights và action items quan trọng',
    instruction: 'Soạn email executive brief tình hình portfolio. Tập trung vào: (1) 3-4 điểm nổi bật quan trọng nhất trong kỳ, (2) Dự án/rủi ro cần chú ý ngay (nêu cụ thể nguyên nhân), (3) 2-3 hành động ưu tiên cần thực hiện ngay với người phụ trách đề xuất. Ngắn gọn, súc tích, không quá 350 từ. Ưu tiên rõ ràng và actionable hơn đầy đủ.',
  },
  {
    id: 'risk',
    label: 'Cảnh báo rủi ro',
    icon: '⚠️',
    description: 'Tập trung dự án đỏ/vàng, escalation và quyết định cần thiết',
    instruction: 'Soạn email cảnh báo rủi ro portfolio gửi Ban Lãnh đạo. Tập trung vào: (1) Phân tích chi tiết các dự án đỏ/vàng — nguyên nhân gốc rễ, tác động kinh doanh, phương án xử lý hiện tại và kết quả dự kiến, (2) Rủi ro/vấn đề trọng yếu cần leo thang lên Lãnh đạo — nêu cụ thể điểm bị block, (3) Đề xuất quyết định hoặc hỗ trợ cụ thể cần từ Lãnh đạo để unblock, kèm impact nếu không xử lý kịp. Tone: khẩn cấp nhưng chuyên nghiệp, dựa trên dữ liệu.',
  },
  {
    id: 'milestone',
    label: 'Review tiến độ',
    icon: '🎯',
    description: 'Thành tựu đã đạt, tiến độ thực tế và cột mốc sắp tới',
    instruction: 'Soạn email review tiến độ và thành tựu dự án gửi Ban Lãnh đạo. Tập trung vào: (1) Thành tựu nổi bật đã hoàn thành trong kỳ — nêu ý nghĩa và tác động kinh doanh của chúng, (2) Trạng thái cột mốc quan trọng sắp tới — on-track vs. at-risk với nguyên nhân, (3) Tiến độ tổng thể so với kế hoạch ban đầu — có đang gia tăng hay chậm lại?, (4) Cảnh báo sớm về deliverables có nguy cơ trễ và đề xuất biện pháp phòng ngừa. Cân bằng giữa ghi nhận thành công và cảnh báo rủi ro tiếp theo.',
  },
] as const;
