import type {
  HumanActorRole,
} from '../types/actor';

export const ROLE_LABELS: Record<HumanActorRole, string> = {
  ADMIN: 'Quản trị viên hệ thống',
  SUPERVISOR: 'Ban Giám đốc',
  CARE_MANAGER: 'Quản lý chung',
  PSYCHOLOGIST: 'Nhân viên tâm lý và công tác xã hội',
  SOCIAL_WORKER: 'Nhân viên tâm lý và công tác xã hội',
  NURSE: 'Nhân viên y tế',
  CAREGIVER: 'Nhân viên chăm sóc',
  NUTRITIONIST: 'Nhân viên dinh dưỡng',
  HOUSEKEEPING: 'Nhân viên tạp vụ',
  REHABILITATION_SPECIALIST: 'Nhân viên phục hồi chức năng',
  COMMUNICATIONS: 'Nhân viên truyền thông',
  SECURITY: 'Nhân viên bảo vệ',
  ACCOUNTANT: 'Nhân viên kế toán',
  RECEPTIONIST: 'Nhân viên lễ tân',
  GUARDIAN: 'Người bảo hộ cư dân',
};

export type AppRouteKey =
  | 'dashboard'
  | 'accommodation'
  | 'residents'
  | 'resident-leave'
  | 'workforce'
  | 'operations'
  | 'admissions'
  | 'health-reports'
  | 'staff-access'
  | 'family-portal'
  | 'medication-inventory'
  | 'kitchen-operations'
  | 'billing-invoicing'
  | 'analytics-intelligence'
  | 'audit-trail'
  | 'service-contracts'
  | 'system-status';

export interface RoleCapability {
  allowedRoutes: AppRouteKey[];
  canManageStaff: boolean;
  canManageDirectorStaff: boolean; // ĐỘC QUYỀN BAN GIÁM ĐỐC / ADMIN: Ban Giám đốc tạo ID & mật khẩu cho BGĐ, Quản lý & Nhân viên. Quản lý chỉ tạo cho Nhân viên.
  canDeleteStaff: boolean; // ĐỘC QUYỀN BAN GIÁM ĐỐC / ADMIN: Quyền bớt/xoá tài khoản nhân viên khỏi hệ thống.`
  canManageAccommodation: boolean;
  canManageLifecycle: boolean;
  canApproveDischarge: boolean;
  canCreateHealthReport: boolean;
  canCreateAdmissionAssessment: boolean;
  canApproveLeave: boolean;
  canAssignShifts: boolean;
  canLogDirectCare: boolean;
  canPrescribeMedication: boolean; // Chỉ nhân viên y tế mới có quyền phân chia thuốc theo đơn bác sĩ
  canAdministerMedication: boolean; // Nhân viên y tế / điều dưỡng ký xác nhận eMAR & cho uống thuốc
  canManageInventory: boolean; // Nhân viên y tế & Quản lý có quyền truy xuất quản lý kho vật tư
  canManageKitchenOperations: boolean; // Nhân viên dinh dưỡng, Quản lý và Ban Giám đốc quản lý khu vực bếp ăn, tiếp nhận thực phẩm, kiểm đếm và lưu mẫu
  canManageBilling: boolean; // Kế toán & Ban Giám đốc quản lý viện phí & tài chính
  canConfigurePricing: boolean; // ĐỘC QUYỀN: Chỉ Ban Giám đốc và Quản lý có quyền cấu hình đơn giá, gói dịch vụ và duyệt giảm giá
  canAccessAnalytics: boolean; // Ban Giám đốc & Quản lý xem báo cáo phân tích quản trị thông minh
  canViewAuditLog: boolean; // ĐỘC QUYỀN: Chỉ Ban Giám đốc và Quản lý có quyền xem nhật ký truy vết & lịch sử thay đổi để phục vụ kiểm toán quy trách nhiệm
  canViewDirectorAuditLog: boolean; // ĐỘC QUYỀN BAN GIÁM ĐỐC / ADMIN: Ban Giám đốc xem được toàn bộ hoạt động kể cả của Ban Giám đốc. Quản lý KHÔNG xem được hoạt động của Ban Giám đốc.
  canViewSensitiveFinancials: boolean; // ĐỘC QUYỀN BAN GIÁM ĐỐC / ADMIN: Quyền xem thông tin kinh phí, chi phí nhập thực phẩm, doanh thu và thu nhập nhạy cảm của Trung tâm
  canEvaluatePsychology: boolean; // ĐỘC QUYỀN: Nhân viên Tâm lý và Nhân viên Công tác xã hội lập/đánh giá Phiếu đánh giá Tâm lý
  canRegisterStaffMeals: boolean; // ĐỘC QUYỀN: Nhân viên Quản lý thực hiện đăng ký suất ăn cho nhân viên theo nhóm công việc & ca
  canManageCareSuppliesImport: boolean; // ĐỘC QUYỀN: Nhân viên Quản lý có quyền nhập kho Vật tư phục vụ chăm sóc NCT
  canManagePharmacy: boolean; // ĐỘC QUYỀN: Nhân viên Y tế nhập kho và xuất kho Dược phẩm
  canEvaluateKPI: boolean; // ĐỘC QUYỀN: Nhân viên Quản lý đánh giá KPI chi tiết dạng tick theo ca trực
  canViewResidentSupplies: boolean; // Quyền xem và tiếp nhận/quản lý Đồ gửi cụ từ gia đình (Bảo vệ Nhân viên Y tế không xem đồ gửi cụ)
}

export const ROLE_CAPABILITIES: Record<HumanActorRole, RoleCapability> = {
  ADMIN: {
    allowedRoutes: [
      'dashboard',
      'accommodation',
      'residents',
      'resident-leave',
      'workforce',
      'operations',
      'admissions',
      'health-reports',
      'staff-access',
      'family-portal',
      'medication-inventory',
      'kitchen-operations',
      'billing-invoicing',
      'analytics-intelligence',
      'audit-trail',
      'service-contracts',
      'system-status',
    ],
    canManageStaff: true, // ADMIN: Toàn quyền tạo và quản lý tài khoản 100% nhân sự & BGĐ
    canManageDirectorStaff: true, // ADMIN: Toàn quyền quản lý tài khoản Ban Giám đốc
    canDeleteStaff: true, // ADMIN: Quyền bớt/xoá tài khoản nhân viên khỏi hệ thống
    canManageAccommodation: true, // ADMIN: Toàn quyền quản lý phòng giường
    canManageLifecycle: true, // ADMIN: Toàn quyền quản lý vòng đời cư dân
    canApproveDischarge: true, // ADMIN: Toàn quyền duyệt xuất viện
    canCreateHealthReport: true, // ADMIN: Toàn quyền tạo báo cáo sức khỏe
    canCreateAdmissionAssessment: true, // ADMIN: Toàn quyền đánh giá tiếp nhận
    canApproveLeave: true, // ADMIN: Toàn quyền duyệt đơn nghỉ phép
    canAssignShifts: true, // ADMIN: Toàn quyền phân ca kíp
    canLogDirectCare: true, // ADMIN: Toàn quyền ghi nhật ký chăm sóc
    canPrescribeMedication: true, // ADMIN: Toàn quyền phân liều thuốc
    canAdministerMedication: true, // ADMIN: Toàn quyền cho uống thuốc và ký eMAR
    canManageInventory: true, // ADMIN: Toàn quyền quản lý kho dược phẩm & vật tư
    canManageKitchenOperations: true, // ADMIN: Toàn quyền quản lý bếp ăn & dinh dưỡng
    canManageBilling: true, // ADMIN: Toàn quyền quản lý viện phí, hóa đơn & thu chi
    canConfigurePricing: true, // ADMIN: Toàn quyền cấu hình bảng giá & chính sách
    canAccessAnalytics: true, // ADMIN: Toàn quyền truy cập trung tâm phân tích MI
    canViewAuditLog: true, // ADMIN: Toàn quyền xem nhật ký truy vết 100%
    canViewDirectorAuditLog: true, // ADMIN: Toàn quyền xem mọi hoạt động của Ban Giám đốc & nhân viên
    canViewSensitiveFinancials: true, // ADMIN: Xem chi phí nhập thực phẩm & thu nhập nhạy cảm
    canEvaluatePsychology: true,
    canRegisterStaffMeals: true,
    canManageCareSuppliesImport: true,
    canManagePharmacy: true,
    canEvaluateKPI: true,
    canViewResidentSupplies: true,
  },
  SUPERVISOR: {
    allowedRoutes: [
      'dashboard',
      'accommodation',
      'residents',
      'resident-leave',
      'workforce',
      'operations',
      'admissions',
      'health-reports',
      'staff-access',
      'family-portal',
      'medication-inventory',
      'kitchen-operations',
      'billing-invoicing',
      'analytics-intelligence',
      'audit-trail',
      'service-contracts',
      'system-status',
    ],
    canManageStaff: true, // BAN GIÁM ĐỐC: Toàn quyền tạo ID, cấp mật khẩu cho Ban Giám đốc, Quản lý và toàn thể Nhân viên
    canManageDirectorStaff: true, // BAN GIÁM ĐỐC: Độc quyền tạo & quản lý tài khoản Ban Giám đốc
    canDeleteStaff: true, // BAN GIÁM ĐỐC: Quyền bớt/xoá tài khoản nhân viên khỏi hệ thống
    canManageAccommodation: true,
    canManageLifecycle: true,
    canApproveDischarge: true,
    canCreateHealthReport: false,
    canCreateAdmissionAssessment: true,
    canApproveLeave: true,
    canAssignShifts: true,
    canLogDirectCare: true,
    canPrescribeMedication: false, // Ban Giám đốc chỉ xem quản lý, không phân chia thuốc thay chuyên môn y tế
    canAdministerMedication: false, // Ban Giám đốc không ký eMAR thay điều dưỡng
    canManageInventory: false, // Ban Giám đốc xem để quản lý điều hành
    canManageKitchenOperations: true, // Ban Giám đốc giám sát & kiểm toán bếp ăn & tiếp nhận thực phẩm
    canManageBilling: true, // Ban Giám đốc toàn quyền xem và duyệt quyết toán
    canConfigurePricing: true, // BAN GIÁM ĐỐC: Toàn quyền cấu hình bảng giá, gói dịch vụ và duyệt giảm giá
    canAccessAnalytics: true, // Ban Giám đốc toàn quyền xem Trung tâm phân tích & MI
    canViewAuditLog: true, // BAN GIÁM ĐỐC: Toàn quyền xem nhật ký truy vết & trách nhiệm
    canViewDirectorAuditLog: true, // BAN GIÁM ĐỐC: Toàn quyền xem hoạt động của Ban Giám đốc và toàn thể nhân sự
    canViewSensitiveFinancials: true, // BAN GIÁM ĐỐC: Độc quyền xem thông tin kinh phí, chi phí nhập thực phẩm & thu nhập nhạy cảm
    canEvaluatePsychology: true,
    canRegisterStaffMeals: true,
    canManageCareSuppliesImport: true,
    canManagePharmacy: true,
    canEvaluateKPI: true,
    canViewResidentSupplies: true,
  },
  CARE_MANAGER: {
    allowedRoutes: [
      'dashboard',
      'accommodation',
      'residents',
      'resident-leave',
      'workforce',
      'operations',
      'admissions',
      'health-reports',
      'staff-access',
      'family-portal',
      'medication-inventory',
      'kitchen-operations',
      'billing-invoicing',
      'analytics-intelligence',
      'audit-trail',
      'service-contracts',
      'system-status',
    ],
    canManageStaff: true,
    canManageDirectorStaff: false,
    canDeleteStaff: false,
    canManageAccommodation: true,
    canManageLifecycle: true,
    canApproveDischarge: true,
    canCreateHealthReport: true,
    canCreateAdmissionAssessment: true,
    canApproveLeave: true,
    canAssignShifts: true,
    canLogDirectCare: true,
    canPrescribeMedication: true,
    canAdministerMedication: true,
    canManageInventory: true,
    canManageKitchenOperations: true,
    canManageBilling: true,
    canConfigurePricing: true,
    canAccessAnalytics: true,
    canViewAuditLog: true,
    canViewDirectorAuditLog: false,
    canViewSensitiveFinancials: true, // QUẢN LÝ: Quyền xem đơn giá & tổng giá trị nhập thực phẩm, kinh phí
    canEvaluatePsychology: false,
    canRegisterStaffMeals: true,
    canManageCareSuppliesImport: true,
    canManagePharmacy: false,
    canEvaluateKPI: true,
    canViewResidentSupplies: true,
  },
  PSYCHOLOGIST: {
    allowedRoutes: [
      'dashboard',
      'residents',
      'resident-leave',
      'admissions',
      'health-reports',
      'workforce',
      'operations',
    ],
    canManageStaff: false,
    canManageDirectorStaff: false,
    canDeleteStaff: false,
    canManageAccommodation: false,
    canManageLifecycle: false,
    canApproveDischarge: false,
    canCreateHealthReport: false,
    canCreateAdmissionAssessment: false, // Nhân viên tâm lý chỉ xem thông tin tiếp nhận ban đầu, không tạo mới
    canApproveLeave: false,
    canAssignShifts: false,
    canLogDirectCare: true,
    canPrescribeMedication: false,
    canAdministerMedication: false,
    canManageInventory: false,
    canManageKitchenOperations: false,
    canManageBilling: false,
    canConfigurePricing: false,
    canAccessAnalytics: false,
    canViewAuditLog: false,
    canViewDirectorAuditLog: false,
    canViewSensitiveFinancials: false,
    canEvaluatePsychology: true,
    canRegisterStaffMeals: false,
    canManageCareSuppliesImport: false,
    canManagePharmacy: false,
    canEvaluateKPI: false,
    canViewResidentSupplies: true,
  },
  SOCIAL_WORKER: {
    allowedRoutes: [
      'dashboard',
      'residents',
      'resident-leave',
      'admissions',
      'health-reports',
      'workforce',
      'operations',
    ],
    canManageStaff: false,
    canManageDirectorStaff: false,
    canDeleteStaff: false,
    canManageAccommodation: false,
    canManageLifecycle: false,
    canApproveDischarge: false,
    canCreateHealthReport: false,
    canCreateAdmissionAssessment: false, // Nhân viên công tác xã hội chỉ xem thông tin tiếp nhận ban đầu
    canApproveLeave: false,
    canAssignShifts: false,
    canLogDirectCare: true,
    canPrescribeMedication: false,
    canAdministerMedication: false,
    canManageInventory: false,
    canManageKitchenOperations: false,
    canManageBilling: false,
    canConfigurePricing: false,
    canAccessAnalytics: false,
    canViewAuditLog: false,
    canViewDirectorAuditLog: false,
    canViewSensitiveFinancials: false,
    canEvaluatePsychology: true,
    canRegisterStaffMeals: false,
    canManageCareSuppliesImport: false,
    canManagePharmacy: false,
    canEvaluateKPI: false,
    canViewResidentSupplies: true,
  },
  NURSE: {
    allowedRoutes: [
      'dashboard',
      'accommodation',
      'residents',
      'resident-leave',
      'workforce',
      'operations',
      'admissions',
      'health-reports',
      'medication-inventory',
    ],
    canManageStaff: false,
    canManageDirectorStaff: false,
    canDeleteStaff: false,
    canManageAccommodation: false,
    canManageLifecycle: false,
    canApproveDischarge: false,
    canCreateHealthReport: true,
    canCreateAdmissionAssessment: true,
    canApproveLeave: false,
    canAssignShifts: false,
    canLogDirectCare: true,
    canPrescribeMedication: true, // ĐỘC QUYỀN: Nhân viên y tế phân chia thuốc theo đơn bác sĩ
    canAdministerMedication: true, // ĐỘC QUYỀN: Nhân viên y tế cho uống thuốc đúng cữ & ký xác nhận eMAR
    canManageInventory: true, // Nhân viên y tế có quyền truy xuất kho vật tư
    canManageKitchenOperations: false,
    canManageBilling: false,
    canConfigurePricing: false,
    canAccessAnalytics: false,
    canViewAuditLog: false,
    canViewDirectorAuditLog: false,
    canViewSensitiveFinancials: false,
    canEvaluatePsychology: false,
    canRegisterStaffMeals: false,
    canManageCareSuppliesImport: false,
    canManagePharmacy: true,
    canEvaluateKPI: false,
    canViewResidentSupplies: false, // BẢO VỆ: Nhân viên Y tế KHÔNG xem Đồ gửi cụ
  },
  CAREGIVER: {
    allowedRoutes: [
      'dashboard',
      'residents',
      'resident-leave',
      'operations',
      'workforce',
    ],
    canManageStaff: false,
    canManageDirectorStaff: false,
    canDeleteStaff: false,
    canManageAccommodation: false,
    canManageLifecycle: false,
    canApproveDischarge: false,
    canCreateHealthReport: false,
    canCreateAdmissionAssessment: false, // Nhân viên chăm sóc KHÔNG tiếp nhận & đánh giá
    canApproveLeave: false,
    canAssignShifts: false,
    canLogDirectCare: true,
    canPrescribeMedication: false,
    canAdministerMedication: false,
    canManageInventory: false,
    canManageKitchenOperations: false,
    canManageBilling: false,
    canConfigurePricing: false,
    canAccessAnalytics: false,
    canViewAuditLog: false,
    canViewDirectorAuditLog: false,
    canViewSensitiveFinancials: false,
    canEvaluatePsychology: false,
    canRegisterStaffMeals: false,
    canManageCareSuppliesImport: false,
    canManagePharmacy: false,
    canEvaluateKPI: false,
    canViewResidentSupplies: true, // Nhân viên chăm sóc xem & quản lý Đồ gửi cụ từ gia đình
  },
  NUTRITIONIST: {
    allowedRoutes: [
      'dashboard',
      'resident-leave',
      'kitchen-operations',
      'workforce',
    ],
    canManageStaff: false,
    canManageDirectorStaff: false,
    canDeleteStaff: false,
    canManageAccommodation: false,
    canManageLifecycle: false,
    canApproveDischarge: false,
    canCreateHealthReport: false,
    canCreateAdmissionAssessment: false,
    canApproveLeave: false,
    canAssignShifts: false,
    canLogDirectCare: false,
    canPrescribeMedication: false,
    canAdministerMedication: false,
    canManageInventory: false,
    canManageKitchenOperations: true, // ĐỘC QUYỀN: Nhân viên dinh dưỡng trực tiếp nhận hàng, kiểm đếm, lưu kho và lưu mẫu 24h
    canManageBilling: false,
    canConfigurePricing: false,
    canAccessAnalytics: false,
    canViewAuditLog: false,
    canViewDirectorAuditLog: false,
    canViewSensitiveFinancials: false,
    canEvaluatePsychology: false,
    canRegisterStaffMeals: false,
    canManageCareSuppliesImport: false,
    canManagePharmacy: false,
    canEvaluateKPI: false,
    canViewResidentSupplies: false,
  },
  HOUSEKEEPING: {
    allowedRoutes: [
      'dashboard',
      'resident-leave',
      'workforce',
    ],
    canManageStaff: false,
    canManageDirectorStaff: false,
    canDeleteStaff: false,
    canManageAccommodation: false,
    canManageLifecycle: false,
    canApproveDischarge: false,
    canCreateHealthReport: false,
    canCreateAdmissionAssessment: false,
    canApproveLeave: false,
    canAssignShifts: false,
    canLogDirectCare: false,
    canPrescribeMedication: false,
    canAdministerMedication: false,
    canManageInventory: false,
    canManageKitchenOperations: false,
    canManageBilling: false,
    canConfigurePricing: false,
    canAccessAnalytics: false,
    canViewAuditLog: false,
    canViewDirectorAuditLog: false,
    canViewSensitiveFinancials: false,
    canEvaluatePsychology: false,
    canRegisterStaffMeals: false,
    canManageCareSuppliesImport: false,
    canManagePharmacy: false,
    canEvaluateKPI: false,
    canViewResidentSupplies: false,
  },
  REHABILITATION_SPECIALIST: {
    allowedRoutes: [
      'dashboard',
      'residents',
      'resident-leave',
      'operations',
      'workforce',
    ],
    canManageStaff: false,
    canManageDirectorStaff: false,
    canDeleteStaff: false,
    canManageAccommodation: false,
    canManageLifecycle: false,
    canApproveDischarge: false,
    canCreateHealthReport: false,
    canCreateAdmissionAssessment: false,
    canApproveLeave: false,
    canAssignShifts: false,
    canLogDirectCare: true,
    canPrescribeMedication: false,
    canAdministerMedication: false, // Tuyệt đối KHÔNG có quyền hỗ trợ các cụ uống thuốc
    canManageInventory: false,
    canManageKitchenOperations: false,
    canManageBilling: false,
    canConfigurePricing: false,
    canAccessAnalytics: false,
    canViewAuditLog: false,
    canViewDirectorAuditLog: false,
    canViewSensitiveFinancials: false,
    canEvaluatePsychology: false,
    canRegisterStaffMeals: false,
    canManageCareSuppliesImport: false,
    canManagePharmacy: false, // PHỤC HỒI CHỨC NĂNG: KHÔNG quản lý kho Dược phẩm
    canEvaluateKPI: false,
    canViewResidentSupplies: false, // PHỤC HỒI CHỨC NĂNG: KHÔNG xem/quản lý Đồ gửi cụ
  },
  COMMUNICATIONS: {
    allowedRoutes: [
      'dashboard',
      'resident-leave',
      'operations',
    ],
    canManageStaff: false,
    canManageDirectorStaff: false,
    canDeleteStaff: false,
    canManageAccommodation: false,
    canManageLifecycle: false,
    canApproveDischarge: false,
    canCreateHealthReport: false,
    canCreateAdmissionAssessment: false,
    canApproveLeave: false,
    canAssignShifts: false,
    canLogDirectCare: false,
    canPrescribeMedication: false,
    canAdministerMedication: false,
    canManageInventory: false,
    canManageKitchenOperations: false,
    canManageBilling: false,
    canConfigurePricing: false,
    canAccessAnalytics: false,
    canViewAuditLog: false,
    canViewDirectorAuditLog: false,
    canViewSensitiveFinancials: false,
    canEvaluatePsychology: false,
    canRegisterStaffMeals: false,
    canManageCareSuppliesImport: false,
    canManagePharmacy: false,
    canEvaluateKPI: false,
    canViewResidentSupplies: false,
  },
  SECURITY: {
    allowedRoutes: [
      'dashboard',
      'resident-leave',
      'workforce',
    ],
    canManageStaff: false,
    canManageDirectorStaff: false,
    canDeleteStaff: false,
    canManageAccommodation: false,
    canManageLifecycle: false,
    canApproveDischarge: false,
    canCreateHealthReport: false,
    canCreateAdmissionAssessment: false,
    canApproveLeave: false,
    canAssignShifts: false,
    canLogDirectCare: false,
    canPrescribeMedication: false,
    canAdministerMedication: false,
    canManageInventory: false,
    canManageKitchenOperations: false,
    canManageBilling: false,
    canConfigurePricing: false,
    canAccessAnalytics: false,
    canViewAuditLog: false,
    canViewDirectorAuditLog: false,
    canViewSensitiveFinancials: false,
    canEvaluatePsychology: false,
    canRegisterStaffMeals: false,
    canManageCareSuppliesImport: false,
    canManagePharmacy: false,
    canEvaluateKPI: false,
    canViewResidentSupplies: false,
  },
  ACCOUNTANT: {
    allowedRoutes: [
      'dashboard',
      'resident-leave',
      'billing-invoicing',
    ],
    canManageStaff: false,
    canManageDirectorStaff: false,
    canDeleteStaff: false,
    canManageAccommodation: false,
    canManageLifecycle: false,
    canApproveDischarge: false,
    canCreateHealthReport: false,
    canCreateAdmissionAssessment: false,
    canApproveLeave: false,
    canAssignShifts: false,
    canLogDirectCare: false,
    canPrescribeMedication: false,
    canAdministerMedication: false,
    canManageInventory: false,
    canManageKitchenOperations: false,
    canManageBilling: true, // KẾ TOÁN: Toàn quyền quản lý viện phí & thu chi
    canConfigurePricing: false, // Kế toán chỉ xem biểu giá & lập hóa đơn, KHÔNG được sửa đơn giá & chính sách giảm giá
    canAccessAnalytics: false,
    canViewAuditLog: false,
    canViewDirectorAuditLog: false,
    canViewSensitiveFinancials: false,
    canEvaluatePsychology: false,
    canRegisterStaffMeals: false,
    canManageCareSuppliesImport: false,
    canManagePharmacy: false,
    canEvaluateKPI: false,
    canViewResidentSupplies: false,
  },
  RECEPTIONIST: {
    allowedRoutes: [
      'dashboard',
      'accommodation',
      'residents',
      'resident-leave',
      'workforce',
      'family-portal',
    ],
    canManageStaff: false,
    canManageDirectorStaff: false,
    canDeleteStaff: false,
    canManageAccommodation: false,
    canManageLifecycle: false,
    canApproveDischarge: false,
    canCreateHealthReport: false,
    canCreateAdmissionAssessment: false,
    canApproveLeave: false,
    canAssignShifts: false,
    canLogDirectCare: false,
    canPrescribeMedication: false,
    canAdministerMedication: false,
    canManageInventory: false,
    canManageKitchenOperations: false,
    canManageBilling: false,
    canConfigurePricing: false,
    canAccessAnalytics: false,
    canViewAuditLog: false,
    canViewDirectorAuditLog: false,
    canViewSensitiveFinancials: false,
    canEvaluatePsychology: false,
    canRegisterStaffMeals: false,
    canManageCareSuppliesImport: false,
    canManagePharmacy: false,
    canEvaluateKPI: false,
    canViewResidentSupplies: false, // LỄ TÂN: KHÔNG xem/quản lý Đồ gửi cụ
  },
  GUARDIAN: {
    allowedRoutes: [
      'dashboard',
      'family-portal',
    ],
    canManageStaff: false,
    canManageDirectorStaff: false,
    canDeleteStaff: false,
    canManageAccommodation: false,
    canManageLifecycle: false,
    canApproveDischarge: false,
    canCreateHealthReport: false,
    canCreateAdmissionAssessment: false,
    canApproveLeave: false,
    canAssignShifts: false,
    canLogDirectCare: false,
    canPrescribeMedication: false,
    canAdministerMedication: false,
    canManageInventory: false,
    canManageKitchenOperations: false,
    canManageBilling: false,
    canConfigurePricing: false,
    canAccessAnalytics: false,
    canViewAuditLog: false,
    canViewDirectorAuditLog: false,
    canViewSensitiveFinancials: false,
    canEvaluatePsychology: false,
    canRegisterStaffMeals: false,
    canManageCareSuppliesImport: false,
    canManagePharmacy: false,
    canEvaluateKPI: false,
    canViewResidentSupplies: true,
  },
};

export function canAccessRoute(
  role: HumanActorRole | undefined | null,
  route: AppRouteKey,
): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.allowedRoutes.includes(route) ?? false;
}

export function hasCapability(
  role: HumanActorRole | undefined | null,
  capability: keyof Omit<RoleCapability, 'allowedRoutes'>,
): boolean {
  if (!role) return false;
  return Boolean(ROLE_CAPABILITIES[role]?.[capability]);
}

export const CAREGIVER_ASSIGNMENTS: Record<string, string[]> = {
  // Hoàng Văn Tuấn
  'cg-tuan-002': ['res-demo-004', 'res-demo-005', 'res-demo-007'],
  'STAFF-CG-002': ['res-demo-004', 'res-demo-005', 'res-demo-007'],
  'Hoàng Văn Tuấn': ['res-demo-004', 'res-demo-005', 'res-demo-007'],

  // Trần Thị Mai
  'cg-mai-001': ['res-demo-001', 'res-demo-002', 'res-demo-003'],
  'STAFF-CG-001': ['res-demo-001', 'res-demo-002', 'res-demo-003'],
  'Trần Thị Mai': ['res-demo-001', 'res-demo-002', 'res-demo-003'],

  // Đặng Thị Hoa
  'cg-hoa-003': ['res-demo-008', 'res-demo-006', 'resident-vw9ec-20260828-153826'],
  'STAFF-CG-003': ['res-demo-008', 'res-demo-006', 'resident-vw9ec-20260828-153826'],
  'Đặng Thị Hoa': ['res-demo-008', 'res-demo-006', 'resident-vw9ec-20260828-153826'],
};

export function getAssignedResidentIdsForActor(actorId?: string, displayName?: string): string[] {
  if (actorId && CAREGIVER_ASSIGNMENTS[actorId]) return CAREGIVER_ASSIGNMENTS[actorId];
  if (displayName && CAREGIVER_ASSIGNMENTS[displayName]) return CAREGIVER_ASSIGNMENTS[displayName];
  return ['res-demo-004', 'res-demo-005', 'res-demo-007'];
}

export const GUARDIAN_ASSIGNMENTS: Record<string, string[]> = {
  // Lê Gia Bảo - Con trai cụ Nguyễn Văn An (res-demo-001)
  'TA-GUA-01': ['res-demo-001'],
  'guardian-bao-001': ['res-demo-001'],
  'GD-001': ['res-demo-001'],
  'Lê Gia Bảo': ['res-demo-001'],
  'STAFF-GD-001': ['res-demo-001'],
  'GUARDIAN-001': ['res-demo-001'],

  // Trần Anh Đức - Con trai cụ Trần Thị Bình (res-demo-002)
  'TA-GUA-02': ['res-demo-002'],
  'guardian-duc-002': ['res-demo-002'],
  'GD-002': ['res-demo-002'],
  'Trần Anh Đức': ['res-demo-002'],
  'STAFF-GD-002': ['res-demo-002'],
  'GUARDIAN-002': ['res-demo-002'],

  // Bùi Thị Mai - Thân nhân cụ Phạm Văn Cường (res-demo-003)
  'TA-GUA-03': ['res-demo-003'],
  'guardian-mai-003': ['res-demo-003'],
};

export function getAssignedResidentIdsForGuardian(actorId?: string, displayName?: string): string[] {
  if (actorId && GUARDIAN_ASSIGNMENTS[actorId]) return GUARDIAN_ASSIGNMENTS[actorId];
  if (displayName && GUARDIAN_ASSIGNMENTS[displayName]) return GUARDIAN_ASSIGNMENTS[displayName];

  // Dynamic fallback for any TA-GUA-xx or GUARDIAN account
  if (actorId) {
    const match = actorId.match(/(?:TA-GUA-|GUA-|GD-)(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      const demoResId = `res-demo-00${((num - 1) % 3) + 1}`;
      return [demoResId];
    }
  }

  return ['res-demo-001'];
}
