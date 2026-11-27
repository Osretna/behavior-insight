# Security Specification — BEHAVIOR INSIGHT

## 1. Data Invariants
1. **Strict Ownership & Master Gate**: Every document under `/users/{userId}/profiles/{profileId}/...` belongs strictly to `userId == request.auth.uid`, and its parent `/users/{userId}` and `/users/{userId}/profiles/{profileId}` documents must exist and match `ownerId == request.auth.uid`.
2. **Email Verification Mandate**: All reads and writes require `request.auth != null` and `request.auth.token.email_verified == true`.
3. **Immutable Identity & Timestamps**: `ownerId`, `profileId`, and `createdAt` cannot be modified after creation. `createdAt` and `updatedAt` must equal `request.time`.
4. **Weight Sum Invariant**: Profile axis weights (`obedience + study + prayer + responsibilities`) must be integers in `[0, 100]` and sum strictly to `100`.
5. **Immutable Audit Trail**: Documents in `auditLogs` can only be created by the verified owner and can never be updated or deleted.
6. **Finalized Assessment Protection**: A `dailyAssessments` document with `status == 'finalized'` cannot be arbitrarily overwritten without an explicit `manualOverride` with non-empty `reason` and `modifiedBy`.
7. **PII & Prayer Privacy**: `/users/{userId}` (containing `email` and `pinHash`) disables `list` completely and restricts `get` strictly to `request.auth.uid == userId`. `prayerRecords` are strictly private to the owner.

## 2. The "Dirty Dozen" Attack Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Reading `/users/u1/profiles/p1` with `auth == null`.
2. **Unverified Email Write**: Creating `/users/u1` with `token.email_verified == false`.
3. **Cross-Tenant Read/List**: User `u2` attempting `get` or `list` on `/users/u1/profiles`.
4. **Self-Assigned Admin Role**: Creating `/users/u1` with `role: "admin"` or updating `role` to `"admin"`.
5. **Shadow / Ghost Field Injection**: Creating `/users/u1/profiles/p1` with an extra undeclared key `isSuperUser: true`.
6. **OwnerId Spoofing**: Creating a task under `/users/u1/profiles/p1/tasks/t1` with `ownerId: "u2"`.
7. **ID Poisoning**: Attempting to create `/users/u1/profiles/bad..id$123` or a >128 char document ID.
8. **Weight Manipulation**: Updating profile `weights` to `{ obedience: 50, study: 50, prayer: 50, responsibilities: 50 }` (sum = 200 != 100).
9. **Client Timestamp Forgery**: Creating an observation with `createdAt: new Date('2020-01-01')` instead of `request.time`.
10. **Audit Log Tampering**: Updating or deleting an existing `/users/u1/profiles/p1/auditLogs/log1` document.
11. **Finalized Assessment Silent Overwrite**: Updating a `finalized` `dailyAssessment` score without providing `manualOverride.reason` and `manualOverride.modifiedBy`.
12. **User Enumeration**: Calling `list` on `/users` or `/admins`.
