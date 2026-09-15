export type HumanActorRole =
  | 'ADMIN'                     // Quản trị viên hệ thống
  | 'SUPERVISOR'                // Ban Giám đốc
  | 'CARE_MANAGER'              // Quản lý chung
  | 'PSYCHOLOGIST'              // Nhân viên tâm lý và công tác xã hội
  | 'SOCIAL_WORKER'             // Nhân viên tâm lý và công tác xã hội
  | 'NURSE'                     // Nhân viên y tế
  | 'CAREGIVER'                 // Nhân viên chăm sóc
  | 'NUTRITIONIST'              // Nhân viên dinh dưỡng
  | 'HOUSEKEEPING'              // Nhân viên tạp vụ
  | 'REHABILITATION_SPECIALIST' // Nhân viên phục hồi chức năng
  | 'COMMUNICATIONS'            // Nhân viên truyền thông
  | 'SECURITY'                  // Nhân viên bảo vệ
  | 'ACCOUNTANT'                // Nhân viên kế toán
  | 'RECEPTIONIST'              // Nhân viên lễ tân
  | 'GUARDIAN';                 // Người bảo hộ cư dân

export interface HumanActorSession {
  actorId: string;
  actorRole: HumanActorRole;
  displayName?: string;
}
