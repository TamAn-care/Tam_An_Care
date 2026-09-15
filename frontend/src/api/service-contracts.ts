import { apiRequest } from './client';
import type { HumanActorSession } from '../types/actor';

export type ContractStatus = 'DRAFT' | 'SIGNED' | 'ACTIVE' | 'TERMINATED' | 'CANCELLED';

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, { label: string; badgeClass: string }> = {
  DRAFT: { label: 'Dự thảo', badgeClass: 'badge badge-neutral' },
  SIGNED: { label: 'Đã ký kết', badgeClass: 'badge badge-info' },
  ACTIVE: { label: 'Đang hiệu lực', badgeClass: 'badge badge-success' },
  TERMINATED: { label: 'Đã thanh lý', badgeClass: 'badge badge-warning' },
  CANCELLED: { label: 'Đã hủy', badgeClass: 'badge badge-danger' },
};

export interface ContractPartyA {
  // Người cao tuổi 1 (*)
  residentName: string;
  residentBirthYear: string;
  residentCccd: string;
  residentAddress: string;

  // Người cao tuổi 2 (nếu gửi cả 2 Ông/Bà)
  hasSecondResident?: boolean;
  resident2Name?: string;
  resident2BirthYear?: string;
  resident2Cccd?: string;
  resident2Address?: string;

  // Thân nhân (**)
  relative1Name: string;
  relative1BirthYear: string;
  relative1Cccd: string;
  relative1Address: string;
  relative1Relationship: string;

  // Thân nhân (***)
  relative2Name: string;
  relative2BirthYear: string;
  relative2Cccd: string;
  relative2Address: string;
  relative2Relationship: string;

  // Số điện thoại
  phone1: string;
  phone2: string;
}

export interface ContractPartyB {
  companyName: string;
  address: string;
  taxCode: string;
  phone: string;
  representativeName: string;
  representativeTitle: string;
  bankAccount: string;
  bankName: string;
  centerName: string;
  centerAddress: string;
}

export interface AppendixServiceItem {
  stt: number;
  name: string;
  fee: number;
  note: string;
  selected: boolean;
}

export interface ContractAppendix {
  healthStatusAtAdmission: string;
  roomType: string;
  bedCode: string;
  baseMonthlyFee: number;
  baseMonthlyFeeText: string;
  additionalServices: AppendixServiceItem[];
  discount: number;
  discountReason: string;
  totalMonthlyFee: number;
  totalMonthlyFeeText: string;
}

export interface ServiceContract {
  contractId: string;
  contractCode: string;
  residentId: string;
  status: ContractStatus;
  signedDate: string;
  effectiveDate: string;
  partyA: ContractPartyA;
  partyB: ContractPartyB;
  appendix: ContractAppendix;
  depositAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_PARTY_B: ContractPartyB = {
  companyName: 'CÔNG TY CP THƯƠNG MẠI DỊCH VỤ AN THỊNH PHÁT GROUP',
  address: 'Số 3 phố Vĩnh Tuy, phường Vĩnh Tuy, Thành phố Hà Nội',
  taxCode: '0111273193',
  phone: '0961.81.86.83',
  representativeName: 'Nguyễn Thị Ngọc Hoa',
  representativeTitle: 'Tổng giám đốc',
  bankAccount: '111603721868',
  bankName: 'Ngân hàng TMCP Công Thương Việt Nam (VietinBank) – Chi nhánh Hai Bà Trưng',
  centerName: 'Trung tâm dưỡng lão Tâm An - Thuộc Công ty Cổ phần thương mại dịch vụ An Thịnh Phát Group',
  centerAddress: 'Khu Phố Đông 8, Khu đô thị Vinhomes Ocean Park 2, Xã Nghĩa Trụ, Tỉnh Hưng Yên',
};

export const DEFAULT_APPENDIX_SERVICES: AppendixServiceItem[] = [
  { stt: 1, name: 'Hỗ trợ tắm gội', fee: 500000, note: 'Hỗ trợ tắm rửa sinh hoạt hàng ngày', selected: false },
  { stt: 2, name: 'Hỗ trợ nâng đỡ, di chuyển', fee: 800000, note: 'Hỗ trợ xoay trở, nâng đỡ di chuyển chống loét', selected: false },
  { stt: 3, name: 'Hỗ trợ xúc ăn', fee: 600000, note: 'Hỗ trợ bón cháo/cơm theo bữa', selected: false },
  { stt: 4, name: 'Hỗ trợ vệ sinh', fee: 700000, note: 'Thay tã bỉm & vệ sinh bài tiết', selected: false },
  { stt: 5, name: 'Hỗ trợ ăn qua sonde', fee: 1200000, note: 'Bơm thức ăn dinh dưỡng qua ống Sonde 6 bữa/ngày', selected: false },
  { stt: 6, name: 'Chăm sóc NCT bị lẫn tuổi già', fee: 1500000, note: 'Theo dõi đặc biệt người sa sút trí tuệ, hay quên', selected: false },
  { stt: 7, name: 'Chăm sóc hỗ trợ tập luyện, xoa bóp, vật lý trị liệu, phục hồi chức năng chuyên sâu sử dụng công nghệ AI', fee: 2000000, note: 'Trị liệu phục hồi chức năng cao cấp', selected: false },
  { stt: 8, name: 'Chăm sóc các ổ loét', fee: 1000000, note: 'Rửa, thay băng & điều trị ổ loét tì đè', selected: false },
  { stt: 9, name: 'Chăm sóc người đặt sonde bàng quang', fee: 800000, note: 'Vệ sinh & theo dõi sonde dẫn lưu nước tiểu', selected: false },
  { stt: 10, name: 'Chăm sóc người đặt nội khí quản', fee: 2500000, note: 'Chăm sóc chuyên sâu đường thở', selected: false },
  { stt: 11, name: 'Thay băng, rửa vết thương', fee: 500000, note: 'Thay băng y tế định kỳ theo chỉ định', selected: false },
  { stt: 12, name: 'Chi phí nhân viên đi cùng đưa đón đi Bệnh viện, hoặc đưa đón theo yêu cầu GD NCT(Chi phí xe: theo nhà cung cấp (TT gọi hộ)', fee: 300000, note: 'Đưa đón khám chữa bệnh ngoài Trung tâm', selected: false },
];

export const MOCK_SERVICE_CONTRACTS: ServiceContract[] = [
  {
    contractId: 'ctr-demo-001',
    contractCode: '001/2026/HĐDV-TA',
    residentId: 'res-demo-001',
    status: 'ACTIVE',
    signedDate: '2026-01-15',
    effectiveDate: '2026-01-15',
    partyA: {
      residentName: 'Nguyễn Văn An',
      residentBirthYear: '1944',
      residentCccd: '001044001234',
      residentAddress: 'Số 15 Phố Huế, Quận Hoàn Kiếm, Hà Nội',
      relative1Name: 'Nguyễn Văn Bình',
      relative1BirthYear: '1972',
      relative1Cccd: '001072005678',
      relative1Address: 'Số 15 Phố Huế, Quận Hoàn Kiếm, Hà Nội',
      relative1Relationship: 'Con trai trưởng',
      relative2Name: 'Trần Thị Cúc',
      relative2BirthYear: '1975',
      relative2Cccd: '001075009876',
      relative2Address: 'Số 15 Phố Huế, Quận Hoàn Kiếm, Hà Nội',
      relative2Relationship: 'Con dâu',
      phone1: '0912.345.678',
      phone2: '0988.765.432',
    },
    partyB: DEFAULT_PARTY_B,
    appendix: {
      healthStatusAtAdmission: 'Tỉnh táo, minh mẫn, cao huyết áp nhẹ đã kiểm soát bằng thuốc, tự di chuyển nhẹ nhàng.',
      roomType: 'Phòng 101 (Phòng Đôi)',
      bedCode: '101-2',
      baseMonthlyFee: 12000000,
      baseMonthlyFeeText: 'Mười hai triệu đồng',
      additionalServices: [
        { ...DEFAULT_APPENDIX_SERVICES[0], selected: true },
        { ...DEFAULT_APPENDIX_SERVICES[6], selected: true },
      ],
      discount: 600000,
      discountReason: 'Ưu đãi đóng phí 6 tháng',
      totalMonthlyFee: 13900000,
      totalMonthlyFeeText: 'Mười ba triệu chín trăm ngàn đồng',
    },
    depositAmount: 20000000,
    notes: 'Hợp đồng lưu trú dài hạn 12 tháng.',
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-01-15T08:00:00Z',
  },
  {
    contractId: 'ctr-demo-002',
    contractCode: '002/2026/HĐDV-TA',
    residentId: 'res-demo-002',
    status: 'ACTIVE',
    signedDate: '2026-02-01',
    effectiveDate: '2026-02-01',
    partyA: {
      residentName: 'Trần Thị Bình',
      residentBirthYear: '1948',
      residentCccd: '001048002345',
      residentAddress: 'Số 88 Hàng Bài, Quận Hoàn Kiếm, Hà Nội',
      relative1Name: 'Trần Văn Dũng',
      relative1BirthYear: '1976',
      relative1Cccd: '001076008765',
      relative1Address: 'Số 88 Hàng Bài, Quận Hoàn Kiếm, Hà Nội',
      relative1Relationship: 'Con trai',
      relative2Name: 'Phạm Thị Hoa',
      relative2BirthYear: '1978',
      relative2Cccd: '001078004321',
      relative2Address: 'Số 88 Hàng Bài, Quận Hoàn Kiếm, Hà Nội',
      relative2Relationship: 'Con gái',
      phone1: '0903.112.233',
      phone2: '0915.445.566',
    },
    partyB: DEFAULT_PARTY_B,
    appendix: {
      healthStatusAtAdmission: 'Sa sút trí tuệ nhẹ tuổi già, cần hỗ trợ xoay trở & tắm rửa hàng ngày.',
      roomType: 'Phòng 102 (Phòng 6 Giường)',
      bedCode: '102-1',
      baseMonthlyFee: 10000000,
      baseMonthlyFeeText: 'Mười triệu đồng',
      additionalServices: [
        { ...DEFAULT_APPENDIX_SERVICES[0], selected: true },
        { ...DEFAULT_APPENDIX_SERVICES[1], selected: true },
        { ...DEFAULT_APPENDIX_SERVICES[5], selected: true },
      ],
      discount: 0,
      discountReason: '',
      totalMonthlyFee: 12800000,
      totalMonthlyFeeText: 'Mười hai triệu tám trăm ngàn đồng',
    },
    depositAmount: 20000000,
    notes: 'Gia đình yêu cầu chế độ chăm sóc đặc biệt sa sút trí tuệ.',
    createdAt: '2026-02-01T09:30:00Z',
    updatedAt: '2026-02-01T09:30:00Z',
  },
];

const LS_CONTRACTS_KEY = 'taman_service_contracts_v1';

export function getStoredServiceContracts(): ServiceContract[] {
  try {
    const raw = localStorage.getItem(LS_CONTRACTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return MOCK_SERVICE_CONTRACTS;
}

export function saveStoredServiceContracts(items: ServiceContract[]) {
  try {
    localStorage.setItem(LS_CONTRACTS_KEY, JSON.stringify(items));
  } catch {}
}

export function generateAutoContractCode(existingContracts: ServiceContract[]): string {
  const currentYear = new Date().getFullYear();
  const yearSuffix = `${currentYear}`;
  
  let maxNum = 0;
  for (const c of existingContracts) {
    if (c.contractCode) {
      const match = c.contractCode.match(/^(\d+)\//);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
  }

  const nextNum = String(maxNum + 1).padStart(3, '0');
  return `${nextNum}/${yearSuffix}/HĐDV-TA`;
}


export async function listServiceContracts(
  actor?: HumanActorSession | null,
): Promise<ServiceContract[]> {
  try {
    const res = await apiRequest<ServiceContract[]>('/api/service-contracts', { actor });
    if (res && res.length > 0) return res;
  } catch (error) {
    console.warn('[TamAnCare API] Offline mode active for listServiceContracts:', error);
  }
  return getStoredServiceContracts();
}

export async function getServiceContract(
  contractId: string,
  _actor?: HumanActorSession | null,
): Promise<ServiceContract | null> {
  const items = getStoredServiceContracts();
  const found = items.find(c => c.contractId === contractId);
  return found || null;
}

export async function saveServiceContract(
  actor: HumanActorSession,
  contract: ServiceContract,
): Promise<ServiceContract> {
  const items = getStoredServiceContracts();
  const idx = items.findIndex(c => c.contractId === contract.contractId);
  const now = new Date().toISOString();

  let updatedContract: ServiceContract;
  if (idx >= 0) {
    updatedContract = { ...contract, updatedAt: now };
    items[idx] = updatedContract;
  } else {
    updatedContract = { ...contract, createdAt: now, updatedAt: now };
    items.unshift(updatedContract);
  }

  saveStoredServiceContracts(items);

  try {
    await apiRequest('/api/service-contracts', {
      method: 'POST',
      actor,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(updatedContract),
    });
  } catch {}

  return updatedContract;
}

export async function deleteServiceContract(
  actor: HumanActorSession,
  contractId: string,
): Promise<void> {
  const items = getStoredServiceContracts().filter(c => c.contractId !== contractId);
  saveStoredServiceContracts(items);

  try {
    await apiRequest(`/api/service-contracts/${encodeURIComponent(contractId)}`, {
      method: 'DELETE',
      actor,
    });
  } catch {}
}

export function numberToVietnameseText(num: number): string {
  if (!num || num === 0) return 'Không đồng';
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  
  function readGroup(n: number): string {
    const hundred = Math.floor(n / 100);
    const ten = Math.floor((n % 100) / 10);
    const unit = n % 10;
    let res = '';

    if (hundred > 0 || n >= 100) {
      res += units[hundred] + ' trăm ';
      if (ten === 0 && unit > 0) res += 'lẻ ';
    }

    if (ten > 1) {
      res += units[ten] + ' mươi ';
      if (unit === 1) res += 'mốt ';
      else if (unit === 5) res += 'lăm ';
      else if (unit > 0) res += units[unit] + ' ';
    } else if (ten === 1) {
      res += 'mười ';
      if (unit === 1) res += 'một ';
      else if (unit === 5) res += 'lăm ';
      else if (unit > 0) res += units[unit] + ' ';
    } else if (unit > 0) {
      res += units[unit] + ' ';
    }

    return res.trim();
  }

  let temp = Math.abs(num);
  let result = '';

  const million = Math.floor(temp / 1000000);
  temp %= 1000000;
  const thousand = Math.floor(temp / 1000);
  const remain = temp % 1000;

  if (million > 0) {
    result += readGroup(million) + ' triệu ';
  }
  if (thousand > 0) {
    result += readGroup(thousand) + ' ngàn ';
  }
  if (remain > 0) {
    result += readGroup(remain) + ' ';
  }

  result = result.trim() + ' đồng';
  return result.charAt(0).toUpperCase() + result.slice(1);
}
