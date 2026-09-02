export type HumanActorRole =
  | 'ADMIN' // Quản trị viên tối cao (Admin) - Toàn quyền truy cập và chỉnh sửa tất cả thông tin
  | 'SUPERVISOR' // Ban Giám đốc - Toàn quyền điều hành và quản trị
  | 'CARE_MANAGER' // Quản lý - Quản lý chung tất cả hoạt động
  | 'PSYCHOLOGIST' // Nhân viên tâm lý
  | 'SOCIAL_WORKER' // Nhân viên công tác xã hội
  | 'NURSE' // Nhân viên y tế / Điều dưỡng
  | 'CAREGIVER' // Nhân viên chăm sóc
  | 'NUTRITIONIST' // Nhân viên dinh dưỡng - Bếp & thực đơn
  | 'HOUSEKEEPING' // Nhân viên tạp vụ - Vệ sinh & giặt là
  | 'REHABILITATION_SPECIALIST' // Nhân viên phục hồi chức năng
  | 'SECURITY' // Bảo vệ - An ninh & trật tự
  | 'ACCOUNTANT' // Kế toán - Tài chính & chi phí chăm sóc
  | 'RECEPTIONIST' // Nhân viên lễ tân - Đón tiếp & lịch hẹn
  | 'GUARDIAN'; // Thân nhân / Người bảo hộ người cao tuổi

export interface HumanActorSession {
  actorId: string;
  actorRole: HumanActorRole;
  displayName?: string;
}
