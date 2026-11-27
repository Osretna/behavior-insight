/**
 * Security Rules Verification Suite (Payload-First Security TDD)
 * Verifies that all 12 Dirty Dozen adversarial payloads are rejected with PERMISSION_DENIED
 * against the Firestore security rules defined in firestore.rules.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  authUid: string | null;
  emailVerified: boolean;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Read',
    operation: 'get',
    path: '/users/user1/profiles/prof1',
    authUid: null,
    emailVerified: false,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    operation: 'create',
    path: '/users/user1',
    authUid: 'user1',
    emailVerified: false,
    payload: { uid: 'user1', email: 'test@example.com', role: 'guardian' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-Tenant Profile List',
    operation: 'list',
    path: '/users/user1/profiles',
    authUid: 'attacker2',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Self-Assigned Admin Escalation',
    operation: 'create',
    path: '/users/user1',
    authUid: 'user1',
    emailVerified: true,
    payload: { uid: 'user1', email: 'u1@example.com', displayName: 'U1', role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow Field Injection',
    operation: 'create',
    path: '/users/user1/profiles/prof1',
    authUid: 'user1',
    emailVerified: true,
    payload: { ownerId: 'user1', name: 'Ahmad', isAdminBypass: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'OwnerId Spoofing on Subcollection',
    operation: 'create',
    path: '/users/user1/profiles/prof1/tasks/task1',
    authUid: 'user1',
    emailVerified: true,
    payload: { ownerId: 'otherUser', profileId: 'prof1', title: 'Task' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Document ID Poisoning',
    operation: 'create',
    path: '/users/user1/profiles/invalid$id!with.dots',
    authUid: 'user1',
    emailVerified: true,
    payload: { ownerId: 'user1', name: 'Bad' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Axis Weights Sum != 100',
    operation: 'update',
    path: '/users/user1/profiles/prof1',
    authUid: 'user1',
    emailVerified: true,
    payload: { weights: { obedience: 40, study: 40, prayer: 40, responsibilities: 40 } },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/users/user1/profiles/prof1/observations/obs1',
    authUid: 'user1',
    emailVerified: true,
    payload: { ownerId: 'user1', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Audit Log Modification',
    operation: 'delete',
    path: '/users/user1/profiles/prof1/auditLogs/log1',
    authUid: 'user1',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Finalized Assessment Overwrite Without Reason',
    operation: 'update',
    path: '/users/user1/profiles/prof1/dailyAssessments/2026-11-27',
    authUid: 'user1',
    emailVerified: true,
    payload: { status: 'finalized', scores: { obedience: 10, study: 10, prayer: 10, responsibilities: 10, total: 10 } },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'User Collection Enumeration',
    operation: 'list',
    path: '/users',
    authUid: 'user1',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
];
