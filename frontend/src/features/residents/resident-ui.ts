import type {
  Availability,
  ResidentCareLevel,
  ResidentGender,
} from '../../api/residents';

export const CARE_LEVEL_LABEL: Record<string, string> = {
  INDEPENDENT: '(1) Tự phục vụ cơ bản',
  LEVEL_1: '(1) Tự phục vụ cơ bản',
  '1': '(1) Tự phục vụ cơ bản',
  ASSISTED: '(2) Cần hỗ trợ một phần',
  PARTIAL_ASSIST: '(2) Cần hỗ trợ một phần',
  LEVEL_2: '(2) Cần hỗ trợ một phần',
  '2': '(2) Cần hỗ trợ một phần',
  HIGH_ASSISTANCE: '(3) Cần chăm sóc toàn diện',
  DEPENDENT: '(3) Cần chăm sóc toàn diện',
  COMPREHENSIVE: '(3) Cần chăm sóc toàn diện',
  LEVEL_3: '(3) Cần chăm sóc toàn diện',
  '3': '(3) Cần chăm sóc toàn diện',
};

export function formatCareLevel(value: string | null | undefined): string {
  if (!value) return '—';
  return CARE_LEVEL_LABEL[value] || value;
}

export const GENDER_LABEL:
  Record<ResidentGender, string> = {
    MALE: 'Nam',
    FEMALE: 'Nữ',
    OTHER: 'Khác',
    UNSPECIFIED: 'Chưa xác định',
  };

export const AVAILABILITY_LABEL:
  Record<Availability, string> = {
    AVAILABLE: 'Có dữ liệu',
    EMPTY: 'Chưa có dữ liệu',
    UNAVAILABLE: 'Nguồn chưa khả dụng',
  };

export function formatVietnameseDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return '—';
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})/.exec(
      value,
    );

  if (!match) {
    return value;
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function textFromRecord(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];

  if (
    typeof value === 'string' &&
    value.trim()
  ) {
    return value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }

  return null;
}
