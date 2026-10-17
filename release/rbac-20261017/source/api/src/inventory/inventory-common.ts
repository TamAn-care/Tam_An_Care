import { BadRequestException } from '@nestjs/common';

export function inventoryLimit(value: any): number {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ''
  ) {
    return 50;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > 100
  ) {
    throw new BadRequestException(
      'limit must be an integer between 1 and 100',
    );
  }

  return parsed;
}

export function requiredText(
  value: any,
  field: string,
): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0
  ) {
    throw new BadRequestException(`${field} is required`);
  }

  return value.trim();
}

export function optionalText(value: any): string | null {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ''
  ) {
    return null;
  }

  return String(value).trim();
}

export function positiveQuantity(value: any): number {
  const quantity = Number(value);

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    throw new BadRequestException(
      'quantity must be greater than 0',
    );
  }

  return quantity;
}
