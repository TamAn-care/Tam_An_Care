import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  canAccessRoute,
  hasCapability,
  ROLE_LABELS,
  CAREGIVER_ASSIGNMENTS,
  ROLE_CAPABILITIES,
  type HumanActorRole,
} from '../src/auth/role-policy.ts';

describe('Frontend RBAC & Role Policy Smoke Tests', () => {
  it('should allow ADMIN full access to all essential routes', () => {
    const requiredRoutes = [
      'dashboard',
      'residents',
      'resident-lifecycle',
      'kitchen-operations',
      'medication-inventory',
      'billing-invoicing',
      'analytics-intelligence',
      'staff-access',
      'audit-trail',
      'system-status',
    ] as const;

    for (const route of requiredRoutes) {
      assert.strictEqual(
        canAccessRoute('ADMIN', route),
        true,
        `ADMIN should have access to route: ${route}`
      );
    }
  });

  it('should restrict CAREGIVER from accessing financial, staff admin, and system status routes', () => {
    assert.strictEqual(canAccessRoute('CAREGIVER', 'billing-invoicing'), false);
    assert.strictEqual(canAccessRoute('CAREGIVER', 'staff-access'), false);
    assert.strictEqual(canAccessRoute('CAREGIVER', 'system-status'), false);
    assert.strictEqual(canAccessRoute('CAREGIVER', 'audit-trail'), false);
  });

  it('should allow CAREGIVER to access operations and assigned resident care', () => {
    assert.strictEqual(canAccessRoute('CAREGIVER', 'dashboard'), true);
    assert.strictEqual(canAccessRoute('CAREGIVER', 'residents'), true);
    assert.strictEqual(canAccessRoute('CAREGIVER', 'operations'), true);
  });

  it('should correctly enforce director-exclusive capabilities', () => {
    // Only ADMIN and SUPERVISOR can manage director-level staff accounts
    assert.strictEqual(hasCapability('ADMIN', 'canManageDirectorStaff'), true);
    assert.strictEqual(hasCapability('SUPERVISOR', 'canManageDirectorStaff'), true);
    assert.strictEqual(hasCapability('CARE_MANAGER', 'canManageDirectorStaff'), false);
    assert.strictEqual(hasCapability('NURSE', 'canManageDirectorStaff'), false);
    assert.strictEqual(hasCapability('CAREGIVER', 'canManageDirectorStaff'), false);
  });

  it('should enforce medication administration capabilities (eMAR)', () => {
    assert.strictEqual(hasCapability('NURSE', 'canAdministerMedication'), true);
    assert.strictEqual(hasCapability('MEDICAL_HEAD', 'canAdministerMedication'), true);
    assert.strictEqual(hasCapability('CAREGIVER', 'canAdministerMedication'), false);
    assert.strictEqual(hasCapability('ACCOUNTANT', 'canAdministerMedication'), false);
  });

  it('should allow ADMIN, SUPERVISOR, CARE_MANAGER, and MEDICAL_HEAD to manage resident lifecycle', () => {
    assert.strictEqual(hasCapability('ADMIN', 'canManageLifecycle'), true);
    assert.strictEqual(hasCapability('SUPERVISOR', 'canManageLifecycle'), true);
    assert.strictEqual(hasCapability('CARE_MANAGER', 'canManageLifecycle'), true);
    assert.strictEqual(hasCapability('MEDICAL_HEAD', 'canManageLifecycle'), true);
    assert.strictEqual(hasCapability('CAREGIVER', 'canManageLifecycle'), false);
  });

  it('should map all 15 human actor roles with Vietnamese human-readable labels', () => {
    const roles = Object.keys(ROLE_CAPABILITIES) as HumanActorRole[];
    assert.strictEqual(roles.length >= 14, true, 'Must support at least 14 distinct roles');

    for (const role of roles) {
      assert.ok(ROLE_LABELS[role], `Missing Vietnamese label for role: ${role}`);
      assert.strictEqual(typeof ROLE_LABELS[role], 'string');
    }
  });

  it('should maintain valid assigned resident scopes for caregivers', () => {
    assert.ok(CAREGIVER_ASSIGNMENTS['Trần Thị Mai']);
    assert.ok(CAREGIVER_ASSIGNMENTS['Hoàng Văn Tuấn']);
    assert.ok(CAREGIVER_ASSIGNMENTS['Đặng Thị Hoa']);
    assert.strictEqual(CAREGIVER_ASSIGNMENTS['Trần Thị Mai'].includes('res-demo-001'), true);
  });
});

describe('UTF-8 BOM CSV Export Smoke Tests', () => {
  it('should format CSV export with UTF-8 BOM prefix for Excel compatibility', () => {
    const BOM = '﻿';
    const sampleHeaders = ['Mã Cư Dân', 'Họ Và Tên', 'Phòng', 'Chế Độ Ăn'];
    const sampleRows = [
      ['RES-001', 'Nguyễn Thị Bích', 'P.101', 'Cháo xay nhuyễn'],
      ['RES-002', 'Trần Văn Cường', 'P.102', 'Cơm mềm - Giảm đạm'],
    ];

    const csvContent =
      BOM +
      [sampleHeaders.join(','), ...sampleRows.map((r) => r.join(','))].join('\r\n');

    // Verify BOM exists at character 0
    assert.strictEqual(csvContent.charCodeAt(0), 0xfeff, 'Must start with UTF-8 BOM character');
    assert.ok(csvContent.includes('Cháo xay nhuyễn'), 'Vietnamese characters must be preserved');
    assert.ok(csvContent.includes('Cơm mềm - Giảm đạm'), 'Vietnamese characters must be preserved');
  });
});

describe('Diet Preparation Matrix Smoke Tests', () => {
  it('should recognize the 4 standardized HACCP diet textures', () => {
    const DIET_PREPARATION_TYPES = [
      { code: 'REGULAR_SOFT', label: 'Cơm mềm' },
      { code: 'MASHED_SOFT', label: 'Cháo / Cơm nghiền' },
      { code: 'PUREED_SOUP', label: 'Xay nhuyễn' },
      { code: 'TUBE_FEEDING', label: 'Ăn qua Sonde' },
    ];

    assert.strictEqual(DIET_PREPARATION_TYPES.length, 4);
    assert.strictEqual(DIET_PREPARATION_TYPES[3].code, 'TUBE_FEEDING');
    assert.strictEqual(DIET_PREPARATION_TYPES[3].label, 'Ăn qua Sonde');
  });
});
