export function wrapEmailDocument(innerHtml: string, companyName: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Portfolio Report</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
  <tr><td style="padding:24px 12px;">
    <table role="presentation" style="max-width:780px;margin:0 auto;width:100%;">
      <tr><td style="background:#ffffff;border-radius:12px;overflow:hidden;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        ${innerHtml}
      </td></tr>
      <tr><td style="padding:16px 0;text-align:center;font-size:11px;color:#94a3b8;line-height:1.8;">
        ${companyName ? `<strong style="color:#64748b;">${companyName}</strong> · ` : ''}Báo cáo Portfolio · Bảo mật — Chỉ dành cho Ban Lãnh đạo<br>
        &copy; ${year} ${companyName || 'PMO'}. Gửi từ PMO Tool.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
