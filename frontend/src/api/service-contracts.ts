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

/**
 * Chuyển đổi định dạng ngày từ ISO/YYYY-MM-DD sang dd/mm/yyyy
 * Ví dụ: '2026-09-15' -> '15/09/2026'
 */
export function formatDateDDMMYYYY(dateStr?: string | null, fallback = '...................'): string {
  if (!dateStr || dateStr.trim() === '') {
    return fallback;
  }
  const cleanStr = dateStr.trim().split('T')[0];
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanStr)) {
    return cleanStr;
  }
  const isoMatch = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

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
  companyName: 'CÔNG TY CỔ PHẦN THƯƠNG MẠI DỊCH VỤ AN THỊNH PHÁT GROUP',
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



const LS_CONTRACTS_KEY = 'taman_service_contracts_v1';

export function getStoredServiceContracts(): ServiceContract[] {
  try {
    const raw = localStorage.getItem(LS_CONTRACTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (error) {
    throw new Error('CONTRACT_LOCAL_STORAGE_READ_FAILED');
  }
  return [];
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


/**
 * Contract data is server-authoritative. Existing localStorage is deliberately
 * preserved as a non-authoritative recovery source: NEVER auto-upload it,
 * delete it, or silently merge it into signed contracts.
 */
export async function listServiceContracts(
 actor?: HumanActorSession | null,
): Promise<ServiceContract[]> {
 const items=await apiRequest<ServiceContract[]>('/api/service-contracts',{actor});
 if(!Array.isArray(items))throw new Error('CONTRACT_SERVER_RESPONSE_INVALID');
 return items;
}

export async function getServiceContract(
 contractId:string,
 actor?:HumanActorSession | null,
):Promise<ServiceContract | null> {
 if(!/^[A-Za-z0-9_-]{1,160}$/.test(contractId))throw new Error('CONTRACT_ID_INVALID');
 try {
  return await apiRequest<ServiceContract>(
   `/api/service-contracts/${encodeURIComponent(contractId)}`,{actor});
 } catch(error) {
  // No browser fallback: distinguish offline/error from a genuine null.
  throw error;
 }
}

export async function saveServiceContract(
 actor:HumanActorSession,
 contract:ServiceContract,
):Promise<ServiceContract> {
 if(contract.status!=='DRAFT')throw new Error('CONTRACT_SIGNED_EDIT_REQUIRES_AMENDMENT');
 if(!contract.contractId||!contract.residentId||!contract.contractCode)
  throw new Error('CONTRACT_DRAFT_REQUIRED_FIELDS');
 const result=await apiRequest<{contractId:string;status:string;version:number}>(
  '/api/service-contract-drafts',{
    method:'POST',actor,headers:{'content-type':'application/json'},
    body:JSON.stringify({
      contractId:contract.contractId,contractCode:contract.contractCode,
      residentId:contract.residentId,payload:contract,
    }),
  });
 if(result?.status!=='DRAFT'||result.contractId!==contract.contractId)
  throw new Error('CONTRACT_SERVER_SAVE_NOT_CONFIRMED');
 return {...contract,status:'DRAFT'};
}

export async function deleteServiceContract(
 _actor:HumanActorSession,
 _contractId:string,
):Promise<void>{
 // No server DELETE endpoint: fail closed instead of deleting browser state.
 throw new Error('CONTRACT_DELETION_REQUIRES_CONTROLLED_ARCHIVE');
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
