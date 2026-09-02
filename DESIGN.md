---
version: 1.0.0
name: Tam An Care Design Tokens
description: Design system and visual language for Tam An Care Geriatric Care & Nursing Home Platform
colors:
  primary: "#166534"
  primary-light: "#e2f4ea"
  primary-dark: "#14532d"
  forest: "#315b46"
  background: "#f8fafc"
  surface: "#ffffff"
  text-primary: "#0f172a"
  text-secondary: "#475569"
  text-muted: "#64748b"
  border: "#cbd5e1"
  border-light: "#e2e8f0"
  success: "#15803d"
  success-bg: "#dcfce7"
  warning: "#b45309"
  warning-bg: "#fef3c7"
  danger: "#b91c1c"
  danger-bg: "#fee2e2"
  info: "#1e40af"
  info-bg: "#eff6ff"
typography:
  heading-xl:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 24px
    fontWeight: 800
    lineHeight: 1.25
  heading-lg:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.3
  heading-md:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 16px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: 10px
---

# Tâm An Care — Design Specification

## Overview
Hệ thống thiết kế giao diện Viện Dưỡng Lão Tâm An hướng tới sự thanh lịch, chuẩn mực y khoa, đem lại cảm giác an tâm, ấm áp và chuyên nghiệp cho người cao tuổi, gia đình và đội ngũ y bác sĩ, điều dưỡng, nhân viên dinh dưỡng.

## Colors & Hierarchy
- **Gam màu chủ đạo (Emerald / Forest Green):** `#166534`, `#315b46` — tượng trưng cho sự an yên, sinh khí và sức khỏe.
- **Gam màu nền & thẻ:** `#f8fafc` và `#ffffff` tạo độ tương phản cao, dễ đọc cho mọi lứa tuổi.
- **Trạng thái cảnh báo & an toàn:**
  - Xanh lá (`#15803d`): Chuẩn y khoa, đạt tiêu chuẩn HACCP, đã xác nhận.
  - Vàng cam (`#b45309`): Đang theo dõi, chênh lệch khối lượng nhẹ, lưu mẫu trong hạn.
  - Đỏ (`#b91c1c`): Cảnh báo cận date, từ chối nhận hàng, dị ứng hoặc sự cố nghiêm trọng.
  - Xanh dương (`#1e40af`): Phân tích quản trị, đối soát số liệu và quy trình nghiệp vụ.
