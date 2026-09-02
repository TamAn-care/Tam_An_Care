import type {
  Availability,
  ResidentCareLevel,
  ResidentGender,
} from '../../api/residents';

export const CARE_LEVEL_LABEL:
  Record<ResidentCareLevel, string> = {
    INDEPENDENT: 'Tự lập',
    ASSISTED: 'Cần hỗ trợ',
    HIGH_ASSISTANCE: 'Hỗ trợ cao',
    DEPENDENT: 'Phụ thuộc',
  };

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
