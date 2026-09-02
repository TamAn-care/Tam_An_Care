#!/bin/bash
set -Eeuo pipefail

ROOT="/Users/anhha/Downloads/TamAnCare_V7_4_3_Development"
API="$ROOT/api"
FE="$ROOT/frontend"
PG="tamancare_v7_4_3_development-postgres-1"
MASTER_API="tamancare_v7_4_3_development-api-1"
HEALTH="http://127.0.0.1:3000/api/health"
STAMP="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/V8.0/checkpoints/y3c_$STAMP"
TMP="$(mktemp -d)"
IPG="tamancare_y3c_pg_$STAMP"
IAPI="tamancare_y3c_api_$STAMP"
NET="tamancare_y3c_net_$STAMP"
IMG="tamancare-y3c:$STAMP"
ISO_DB="taman_y3c"
SRC_DB="taman_y3c_source"
DBU="taman"
DBP="taman_dev_password"
MIG010="$ROOT/database/migrations/20260831_010_aa_accommodation_room_bed.sql"
MIG011="$ROOT/database/migrations/20260901_011_y_resident_lifecycle.sql"
ROLLBACK_NEEDED=0

cleanup(){
  docker rm -f "$IAPI" >/dev/null 2>&1 || true
  docker rm -f "$IPG" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$TMP" >/dev/null 2>&1 || true
}
rollback(){
  if [ "$ROLLBACK_NEEDED" -eq 1 ]; then
    echo "ROLLBACK: restoring Y3C checkpoint..."
    cp -R "$BK/api_src/." "$API/src/"
    cp -R "$BK/fe_src/." "$FE/src/"
    if [ -f "$BK/app.module.ts" ]; then cp "$BK/app.module.ts" "$API/src/app.module.ts"; fi
    if [ -f "$BK/router.path" ]; then
      RP="$(cat "$BK/router.path")"
      [ -f "$BK/router.file" ] && cp "$BK/router.file" "$RP"
    fi
    if [ -f "$BK/nav.path" ]; then
      NP="$(cat "$BK/nav.path")"
      [ -f "$BK/nav.file" ] && cp "$BK/nav.file" "$NP"
    fi
    [ -f "$MIG011" ] && rm -f "$MIG011"
    echo "ROLLBACK_COMPLETE=YES"
  fi
}
fail(){
  echo
  echo "======================================================================"
  echo " STATUS: Y3C FAST IMPLEMENTATION FAILED"
  echo " FAILURE=$1"
  rollback
  echo " MASTER_DATABASE_MUTATION=NO"
  echo " MASTER_RUNTIME_REDEPLOYMENT=NO"
  echo " Y_PRODUCT_ACCEPTED=NO"
  echo " NEXT=STOP_AND_RETURN_OUTPUT"
  echo "======================================================================"
  cleanup
  exit 1
}
trap cleanup EXIT

echo "======================================================================"
echo " TAM AN CARE V8.0 — Y RESIDENT LIFECYCLE"
echo " Y3C — FAST IMPLEMENTATION + ISOLATED ACCEPTANCE"
echo " CHECKPOINT / ROLLBACK / NO MASTER DEPLOYMENT"
echo "======================================================================"

echo
echo "STEP 1 — MASTER SAFETY + CHECKPOINT"
H="$(curl -sS -o /dev/null -w '%{http_code}' "$HEALTH" 2>/dev/null || true)"
AA="$(docker exec "$PG" psql -X -U taman -d taman_care -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('accommodation_buildings','accommodation_floors','accommodation_rooms','accommodation_beds','bed_assignments','accommodation_audit_events');" 2>/dev/null || true)"
[ "$H" = 200 ] || fail MASTER_HEALTH_NOT_200
[ "$AA" = 0 ] || fail MASTER_AA_TABLES_NOT_ZERO

mkdir -p "$BK/api_src" "$BK/fe_src"
cp -R "$API/src/." "$BK/api_src/"
cp -R "$FE/src/." "$BK/fe_src/"
cp "$API/src/app.module.ts" "$BK/app.module.ts"

ROUTER_FILE="$(python3 - <<'PY'
from pathlib import Path
root=Path("/Users/anhha/Downloads/TamAnCare_V7_4_3_Development/frontend/src")
for p in list(root.rglob("*.tsx"))+list(root.rglob("*.ts")):
    try:s=p.read_text()
    except:continue
    if "/accommodation" in s and ("createBrowserRouter" in s or "path:" in s):
        print(p); break
PY
)"
[ -n "$ROUTER_FILE" ] || fail ROUTER_FILE_NOT_FOUND
cp "$ROUTER_FILE" "$BK/router.file"; printf '%s' "$ROUTER_FILE" > "$BK/router.path"

NAV_FILE="$(python3 - <<'PY'
from pathlib import Path
root=Path("/Users/anhha/Downloads/TamAnCare_V7_4_3_Development/frontend/src")
for p in root.rglob("*.tsx"):
    try:s=p.read_text()
    except:continue
    if "<nav" in s.lower() and "/residents" in s:
        print(p); break
PY
)"
[ -n "$NAV_FILE" ] || fail NAVIGATION_FILE_NOT_FOUND
cp "$NAV_FILE" "$BK/nav.file"; printf '%s' "$NAV_FILE" > "$BK/nav.path"

echo "MASTER_HEALTH=$H"
echo "MASTER_AA_TABLES=$AA"
echo "ROUTER_FILE=$ROUTER_FILE"
echo "NAVIGATION_FILE=$NAV_FILE"
echo "CHECKPOINT=$BK"
ROLLBACK_NEEDED=1
echo "PASS: MASTER SAFE + CHECKPOINT"

echo
echo "STEP 2 — CREATE Y LIFECYCLE MIGRATION"
cat > "$MIG011" <<'SQL'
CREATE TABLE IF NOT EXISTS resident_lifecycle_events (
  lifecycle_event_id text PRIMARY KEY,
  resident_id text NOT NULL REFERENCES residents(resident_id),
  event_type text NOT NULL CHECK (event_type IN ('DISCHARGED')),
  effective_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  note text NULL,
  destination text NULL,
  actor_id text NOT NULL,
  actor_role text NOT NULL,
  previous_state jsonb NULL,
  new_state jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_resident_lifecycle_discharge
  ON resident_lifecycle_events(resident_id)
  WHERE event_type='DISCHARGED';

CREATE INDEX IF NOT EXISTS idx_resident_lifecycle_history
  ON resident_lifecycle_events(resident_id, created_at DESC);
SQL
echo "PASS: MIGRATION CREATED"

echo
echo "STEP 3 — BACKEND RESIDENT LIFECYCLE MODULE"
mkdir -p "$API/src/resident-lifecycle"

cat > "$API/src/resident-lifecycle/resident-lifecycle.module.ts" <<'TS'
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ResidentLifecycleController } from './resident-lifecycle.controller';
import { ResidentLifecycleService } from './resident-lifecycle.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ResidentLifecycleController],
  providers: [ResidentLifecycleService],
})
export class ResidentLifecycleModule {}
TS

cat > "$API/src/resident-lifecycle/resident-lifecycle.controller.ts" <<'TS'
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ResidentLifecycleService } from './resident-lifecycle.service';

@Controller('api/resident-lifecycle')
export class ResidentLifecycleController {
  constructor(private readonly service: ResidentLifecycleService) {}

  private actor(actorId?: string, actorRole?: string) {
    return {
      actorId: String(actorId ?? '').trim(),
      actorRole: String(actorRole ?? '').trim().toUpperCase(),
    };
  }

  private rejectBodyActor(body: any) {
    if (body && (body.actorId !== undefined || body.actorRole !== undefined)) {
      throw new BadRequestException('Actor identity must come from authenticated headers');
    }
  }

  @Post('residents/:residentId/discharge')
  discharge(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('residentId') residentId?: string,
    @Body() body: any = {},
  ) {
    this.rejectBodyActor(body);
    return this.service.discharge(
      this.actor(actorId, actorRole),
      residentId,
      body,
    );
  }

  @Get('residents/:residentId/history')
  history(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('residentId') residentId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.history(
      this.actor(actorId, actorRole),
      residentId,
      limit,
      offset,
    );
  }

  @Get('residents/:residentId/care-plans')
  carePlans(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('residentId') residentId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.carePlans(
      this.actor(actorId, actorRole),
      residentId,
      limit,
      offset,
    );
  }

  @Patch('care-plans/:carePlanId')
  updateCarePlan(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Param('carePlanId') carePlanId?: string,
    @Body() body: any = {},
  ) {
    this.rejectBodyActor(body);
    return this.service.updateCarePlan(
      this.actor(actorId, actorRole),
      carePlanId,
      body,
    );
  }
}
TS

cat > "$API/src/resident-lifecycle/resident-lifecycle.service.ts" <<'TS'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';

type Actor = { actorId: string; actorRole: string };
const HUMAN = new Set(['CAREGIVER', 'NURSE', 'CARE_MANAGER', 'SUPERVISOR']);
const UPDATE = new Set(['NURSE', 'CARE_MANAGER', 'SUPERVISOR']);
const MGMT = new Set(['CARE_MANAGER', 'SUPERVISOR']);

@Injectable()
export class ResidentLifecycleService {
  constructor(private readonly db: DatabaseService) {}

  private req(v: any, n: string) {
    const x = String(v ?? '').trim();
    if (!x) throw new BadRequestException(`${n} is required`);
    return x;
  }

  private page(l?: string, o?: string) {
    const limit = l ? Number(l) : 50;
    const offset = o ? Number(o) : 0;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequestException('limit must be between 1 and 100');
    if (!Number.isInteger(offset) || offset < 0)
      throw new BadRequestException('offset must be non-negative');
    return { limit, offset };
  }

  private async auth(a: Actor, roles: Set<string> = HUMAN) {
    if (!a.actorId || !a.actorRole)
      throw new UnauthorizedException('Authenticated human actor context is required');
    if (!roles.has(a.actorRole))
      throw new ForbiddenException('Actor role is not authorized');
    const q = await this.db.query(
      `SELECT primary_operational_role,status
       FROM staff_actors WHERE actor_id=$1 LIMIT 1`,
      [a.actorId],
    );
    const x = q.rows[0];
    if (!x || x.status !== 'ACTIVE' || x.primary_operational_role !== a.actorRole)
      throw new ForbiddenException('Canonical active staff actor is required');
  }

  async carePlans(a: Actor, rid?: string, l?: string, o?: string) {
    await this.auth(a);
    const residentId = this.req(rid, 'residentId');
    const p = this.page(l, o);
    const q = await this.db.query(
      `SELECT care_plan_id "carePlanId", resident_id "residentId",
              plan_code "planCode", title, description, status,
              effective_from "effectiveFrom", effective_to "effectiveTo",
              approved_by "approvedBy", approved_by_role "approvedByRole",
              approved_at "approvedAt", created_at "createdAt",
              updated_at "updatedAt", COUNT(*) OVER()::int "totalCount"
       FROM care_plans
       WHERE resident_id=$1
       ORDER BY updated_at DESC, care_plan_id
       LIMIT $2 OFFSET $3`,
      [residentId, p.limit, p.offset],
    );
    return {
      items: q.rows,
      total: q.rows[0]?.totalCount ?? 0,
      limit: p.limit,
      offset: p.offset,
    };
  }

  async updateCarePlan(a: Actor, pid?: string, body: any = {}) {
    await this.auth(a, UPDATE);
    const carePlanId = this.req(pid, 'carePlanId');
    const expectedUpdatedAt = this.req(body?.expectedUpdatedAt, 'expectedUpdatedAt');

    return this.db.withTransaction(async c => {
      const found = await c.query(
        `SELECT * FROM care_plans WHERE care_plan_id=$1 FOR UPDATE`,
        [carePlanId],
      );
      if (found.rowCount !== 1) throw new NotFoundException('Care Plan not found');
      const old = found.rows[0];

      if (!['DRAFT', 'ACTIVE', 'SUSPENDED'].includes(old.status))
        throw new ConflictException('Completed or cancelled Care Plan cannot be updated');

      if (new Date(old.updated_at).toISOString() !== new Date(expectedUpdatedAt).toISOString())
        throw new ConflictException('Care Plan changed since it was loaded');

      const title =
        body?.title === undefined ? old.title : this.req(body.title, 'title');
      const description =
        body?.description === undefined
          ? old.description
          : String(body.description ?? '').trim() || null;
      const effectiveFrom =
        body?.effectiveFrom === undefined ? old.effective_from : body.effectiveFrom || null;
      const effectiveTo =
        body?.effectiveTo === undefined ? old.effective_to : body.effectiveTo || null;

      const updated = await c.query(
        `UPDATE care_plans
         SET title=$2, description=$3, effective_from=$4,
             effective_to=$5, updated_at=now()
         WHERE care_plan_id=$1
         RETURNING *`,
        [carePlanId, title, description, effectiveFrom, effectiveTo],
      );
      const next = updated.rows[0];

      const seq = await c.query(
        `SELECT COALESCE(MAX(event_sequence),0)+1 AS next_sequence
         FROM care_plan_audit WHERE care_plan_id=$1`,
        [carePlanId],
      );

      await c.query(
        `INSERT INTO care_plan_audit(
           audit_id,event_sequence,care_plan_id,resident_id,event_type,
           actor_id,actor_role,previous_state,new_state,created_at
         ) VALUES($1,$2,$3,$4,'PLAN_UPDATED',$5,$6,$7::jsonb,$8::jsonb,now())`,
        [
          randomUUID(),
          Number(seq.rows[0].next_sequence),
          carePlanId,
          old.resident_id,
          a.actorId,
          a.actorRole,
          JSON.stringify({
            title: old.title,
            description: old.description,
            effectiveFrom: old.effective_from,
            effectiveTo: old.effective_to,
            updatedAt: old.updated_at,
          }),
          JSON.stringify({
            title: next.title,
            description: next.description,
            effectiveFrom: next.effective_from,
            effectiveTo: next.effective_to,
            updatedAt: next.updated_at,
          }),
        ],
      );

      return {
        carePlanId: next.care_plan_id,
        residentId: next.resident_id,
        status: next.status,
        title: next.title,
        description: next.description,
        effectiveFrom: next.effective_from,
        effectiveTo: next.effective_to,
        updatedAt: next.updated_at,
      };
    });
  }

  async discharge(a: Actor, rid?: string, body: any = {}) {
    await this.auth(a, MGMT);
    const residentId = this.req(rid, 'residentId');
    const reason = this.req(body?.reason, 'reason').slice(0, 120);
    const note = String(body?.note ?? '').trim().slice(0, 1000) || null;
    const destination = String(body?.destination ?? '').trim().slice(0, 250) || null;
    const effectiveAt = body?.effectiveAt ? new Date(body.effectiveAt) : new Date();
    if (Number.isNaN(effectiveAt.getTime()))
      throw new BadRequestException('effectiveAt is invalid');

    return this.db.withTransaction(async c => {
      const rq = await c.query(
        `SELECT resident_id,resident_code,display_name,active_status,room,bed,care_level
         FROM residents WHERE resident_id=$1 FOR UPDATE`,
        [residentId],
      );
      if (rq.rowCount !== 1) throw new NotFoundException('Resident not found');
      const resident = rq.rows[0];

      if (!resident.active_status) {
        const prior = await c.query(
          `SELECT lifecycle_event_id FROM resident_lifecycle_events
           WHERE resident_id=$1 AND event_type='DISCHARGED' LIMIT 1`,
          [residentId],
        );
        if (prior.rowCount)
          throw new ConflictException('Resident already discharged');
        throw new ConflictException('Resident is already inactive');
      }

      const aq = await c.query(
        `SELECT x.assignment_id,x.bed_id,b.status bed_status,
                r.status room_status,f.status floor_status,bu.status building_status
         FROM bed_assignments x
         JOIN accommodation_beds b ON b.bed_id=x.bed_id
         JOIN accommodation_rooms r ON r.room_id=b.room_id
         JOIN accommodation_floors f ON f.floor_id=r.floor_id
         JOIN accommodation_buildings bu ON bu.building_id=f.building_id
         WHERE x.resident_id=$1 AND x.ended_at IS NULL
         FOR UPDATE OF x,b,r,f,bu`,
        [residentId],
      );

      let releasedBedId: string | null = null;
      if (aq.rowCount === 1) {
        const x = aq.rows[0];
        releasedBedId = x.bed_id;
        await c.query(
          `UPDATE bed_assignments
           SET ended_at=$2,ended_by=$3,ended_by_role=$4,end_reason=$5
           WHERE assignment_id=$1`,
          [x.assignment_id, effectiveAt, a.actorId, a.actorRole, `DISCHARGE:${reason}`],
        );
        const nextBedStatus =
          x.building_status === 'ACTIVE' &&
          x.floor_status === 'ACTIVE' &&
          x.room_status === 'AVAILABLE'
            ? 'AVAILABLE'
            : 'TEMPORARILY_UNAVAILABLE';
        await c.query(
          `UPDATE accommodation_beds SET status=$2,updated_at=now() WHERE bed_id=$1`,
          [x.bed_id, nextBedStatus],
        );
      } else if ((aq.rowCount ?? 0) > 1) {
        throw new ConflictException('Resident has multiple active bed assignments');
      }

      const updated = await c.query(
        `UPDATE residents
         SET active_status=false,room=NULL,bed=NULL,updated_at=now()
         WHERE resident_id=$1
         RETURNING resident_id,resident_code,display_name,active_status,room,bed,care_level`,
        [residentId],
      );
      const next = updated.rows[0];
      const eventId = `lifecycle-${randomUUID()}`;

      await c.query(
        `INSERT INTO resident_lifecycle_events(
           lifecycle_event_id,resident_id,event_type,effective_at,reason,
           note,destination,actor_id,actor_role,previous_state,new_state
         ) VALUES($1,$2,'DISCHARGED',$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)`,
        [
          eventId,
          residentId,
          effectiveAt,
          reason,
          note,
          destination,
          a.actorId,
          a.actorRole,
          JSON.stringify({
            activeStatus: resident.active_status,
            room: resident.room,
            bed: resident.bed,
            careLevel: resident.care_level,
          }),
          JSON.stringify({
            activeStatus: next.active_status,
            room: next.room,
            bed: next.bed,
            releasedBedId,
            reason,
          }),
        ],
      );

      await c.query(
        `INSERT INTO resident_audit(
           event_type,target_resident_id,performed_by,performed_by_role,
           previous_value,new_value
         ) VALUES('RESIDENT_DISCHARGED',$1,$2,$3,$4::jsonb,$5::jsonb)`,
        [
          residentId,
          a.actorId,
          a.actorRole,
          JSON.stringify({
            activeStatus: resident.active_status,
            room: resident.room,
            bed: resident.bed,
          }),
          JSON.stringify({
            activeStatus: false,
            room: null,
            bed: null,
            reason,
            lifecycleEventId: eventId,
          }),
        ],
      );

      return {
        lifecycleEventId: eventId,
        residentId,
        status: 'DISCHARGED',
        effectiveAt,
        reason,
        note,
        destination,
        releasedBedId,
      };
    });
  }

  async history(a: Actor, rid?: string, l?: string, o?: string) {
    await this.auth(a);
    const residentId = this.req(rid, 'residentId');
    const p = this.page(l, o);
    const q = await this.db.query(
      `SELECT lifecycle_event_id "lifecycleEventId",resident_id "residentId",
              event_type "eventType",effective_at "effectiveAt",reason,note,
              destination,actor_id "actorId",actor_role "actorRole",
              previous_state "previousState",new_state "newState",
              created_at "createdAt",COUNT(*) OVER()::int "totalCount"
       FROM resident_lifecycle_events
       WHERE resident_id=$1
       ORDER BY effective_at DESC,created_at DESC
       LIMIT $2 OFFSET $3`,
      [residentId, p.limit, p.offset],
    );
    return {
      items: q.rows,
      total: q.rows[0]?.totalCount ?? 0,
      limit: p.limit,
      offset: p.offset,
    };
  }
}
TS

python3 - "$API/src/app.module.ts" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); s=p.read_text()
imp="import { ResidentLifecycleModule } from './resident-lifecycle/resident-lifecycle.module';\n"
if "ResidentLifecycleModule" not in s:
    m=re.search(r'@Module\s*\(',s)
    if not m: raise SystemExit("APP_MODULE_DECORATOR_NOT_FOUND")
    s=s[:m.start()]+imp+s[m.start():]
    m=re.search(r'imports\s*:\s*\[',s)
    if not m: raise SystemExit("APP_MODULE_IMPORTS_ARRAY_NOT_FOUND")
    s=s[:m.end()]+"\n    ResidentLifecycleModule,"+s[m.end():]
    p.write_text(s)
PY
grep -q "ResidentLifecycleModule" "$API/src/app.module.ts" || fail APP_MODULE_PATCH_FAILED

python3 - "$API/src/accommodation/accommodation.service.ts" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); s=p.read_text()
old="private async resident(c:PoolClient,id:string){const q=await c.query(`SELECT resident_id,room,bed FROM residents WHERE resident_id=$1 FOR UPDATE`,[id]);if(q.rowCount!==1)throw new NotFoundException('Resident not found');return q.rows[0];}"
new="private async resident(c:PoolClient,id:string){const q=await c.query(`SELECT resident_id,room,bed,active_status FROM residents WHERE resident_id=$1 FOR UPDATE`,[id]);if(q.rowCount!==1)throw new NotFoundException('Resident not found');if(!q.rows[0].active_status)throw new ConflictException('Inactive resident cannot receive accommodation');return q.rows[0];}"
if old not in s:
    raise SystemExit("ACCOMMODATION_RESIDENT_GUARD_PATTERN_NOT_FOUND")
p.write_text(s.replace(old,new,1))
PY
grep -q "Inactive resident cannot receive accommodation" "$API/src/accommodation/accommodation.service.ts" || fail INACTIVE_RESIDENT_GUARD_PATCH_FAILED
echo "PASS: BACKEND IMPLEMENTED"

echo
echo "STEP 4 — FRONTEND LIFECYCLE API + UI"
cat > "$FE/src/api/resident-lifecycle.ts" <<'TS'
import { apiRequest } from './client';
import type { HumanActorSession } from '../types/actor';
import type { ResidentContextResponse } from './residents';

export type ResidentPage = {
  items: ResidentContextResponse[];
  total: number;
  limit: number;
  offset: number;
};

export type CarePlanItem = {
  carePlanId: string;
  residentId: string;
  planCode: string;
  title: string;
  description: string | null;
  status: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  updatedAt: string;
};

export function listLifecycleResidents(
  actor: HumanActorSession,
  limit = 100,
  offset = 0,
): Promise<ResidentPage> {
  return apiRequest(`/api/residents?limit=${limit}&offset=${offset}`, { actor });
}

export function listLifecycleHistory(
  actor: HumanActorSession,
  residentId: string,
) {
  return apiRequest(
    `/api/resident-lifecycle/residents/${encodeURIComponent(residentId)}/history?limit=100&offset=0`,
    { actor },
  );
}

export function listResidentCarePlans(
  actor: HumanActorSession,
  residentId: string,
): Promise<{ items: CarePlanItem[]; total: number; limit: number; offset: number }> {
  return apiRequest(
    `/api/resident-lifecycle/residents/${encodeURIComponent(residentId)}/care-plans?limit=100&offset=0`,
    { actor },
  );
}

export function updateResidentCarePlan(
  actor: HumanActorSession,
  carePlanId: string,
  input: {
    expectedUpdatedAt: string;
    title: string;
    description?: string | null;
  },
) {
  return apiRequest(
    `/api/resident-lifecycle/care-plans/${encodeURIComponent(carePlanId)}`,
    {
      method: 'PATCH',
      actor,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}

export function dischargeResident(
  actor: HumanActorSession,
  residentId: string,
  input: { reason: string; note?: string; destination?: string },
) {
  return apiRequest(
    `/api/resident-lifecycle/residents/${encodeURIComponent(residentId)}/discharge`,
    {
      method: 'POST',
      actor,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}
TS

mkdir -p "$FE/src/features/resident-lifecycle"
cat > "$FE/src/features/resident-lifecycle/ResidentLifecyclePage.tsx" <<'TSX'
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import {
  dischargeResident,
  listLifecycleHistory,
  listLifecycleResidents,
  listResidentCarePlans,
  updateResidentCarePlan,
  type CarePlanItem,
} from '../../api/resident-lifecycle';

export default function ResidentLifecyclePage() {
  const { actor } = useActor();
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [residentId, setResidentId] = useState('');
  const [reason, setReason] = useState('END_OF_SERVICE');
  const [note, setNote] = useState('');
  const [destination, setDestination] = useState('');
  const [confirmDischarge, setConfirmDischarge] = useState(false);
  const [planId, setPlanId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const residents = useQuery({
    queryKey: ['resident-lifecycle-residents', offset],
    enabled: !!actor,
    queryFn: () => listLifecycleResidents(actor!, 100, offset),
  });

  const selected = useMemo(
    () => residents.data?.items.find(x => x.resident.residentId === residentId)?.resident,
    [residents.data, residentId],
  );

  const plans = useQuery({
    queryKey: ['resident-lifecycle-plans', residentId],
    enabled: !!actor && !!residentId,
    queryFn: () => listResidentCarePlans(actor!, residentId),
  });

  const history = useQuery({
    queryKey: ['resident-lifecycle-history', residentId],
    enabled: !!actor && !!residentId,
    queryFn: () => listLifecycleHistory(actor!, residentId),
  });

  const chosenPlan = plans.data?.items.find(x => x.carePlanId === planId);

  const updatePlan = useMutation({
    mutationFn: () =>
      updateResidentCarePlan(actor!, planId, {
        expectedUpdatedAt: chosenPlan!.updatedAt,
        title,
        description,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['resident-lifecycle-plans', residentId] });
    },
  });

  const discharge = useMutation({
    mutationFn: () =>
      dischargeResident(actor!, residentId, { reason, note, destination }),
    onSuccess: async () => {
      setConfirmDischarge(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['resident-lifecycle-residents'] }),
        qc.invalidateQueries({ queryKey: ['resident-lifecycle-history', residentId] }),
        qc.invalidateQueries({ queryKey: ['residents'] }),
        qc.invalidateQueries({ queryKey: ['accommodation-overview'] }),
      ]);
    },
  });

  function choosePlan(p: CarePlanItem) {
    setPlanId(p.carePlanId);
    setTitle(p.title);
    setDescription(p.description ?? '');
  }

  if (!actor) {
    return <main><div className="notice notice-info">Cần đăng nhập bằng tài khoản nhân sự để quản lý vòng đời người cao tuổi.</div></main>;
  }

  return (
    <main>
      <header className="page-header">
        <div className="eyebrow">Resident Lifecycle</div>
        <h1 className="page-title">Vòng đời người cao tuổi</h1>
        <p className="page-description">
          Cập nhật kế hoạch chăm sóc, theo dõi lịch sử và kết thúc dịch vụ có kiểm soát.
        </p>
      </header>

      <section className="card">
        <label className="field-group">
          <span className="field-label">Người cao tuổi</span>
          <select className="text-input" value={residentId} onChange={e => {
            setResidentId(e.target.value); setPlanId('');
          }}>
            <option value="">Chọn hồ sơ</option>
            {(residents.data?.items ?? []).map(({ resident }) => (
              <option key={resident.residentId} value={resident.residentId}>
                {resident.residentCode} — {resident.displayName} — {resident.activeStatus ? 'Đang hoạt động' : 'Đã kết thúc'}
              </option>
            ))}
          </select>
        </label>
        <div>
          <button className="button button-subtle" disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 100))}>Trang trước</button>{' '}
          <button className="button button-subtle"
            disabled={!residents.data || offset + 100 >= residents.data.total}
            onClick={() => setOffset(offset + 100)}>Trang sau</button>
        </div>
      </section>

      {selected && (
        <>
          <section className="card">
            <h2>Kế hoạch chăm sóc</h2>
            {(plans.data?.items ?? []).map(p => (
              <div key={p.carePlanId} style={{ marginBottom: 12 }}>
                <button className="button button-subtle" onClick={() => choosePlan(p)}>
                  {p.planCode} — {p.title} — {p.status}
                </button>
              </div>
            ))}
            {chosenPlan && (
              <div>
                <label className="field-group">
                  <span className="field-label">Tiêu đề</span>
                  <input className="text-input" value={title} onChange={e => setTitle(e.target.value)} />
                </label>
                <label className="field-group">
                  <span className="field-label">Nội dung</span>
                  <textarea className="text-input" value={description} onChange={e => setDescription(e.target.value)} />
                </label>
                <button className="button" disabled={updatePlan.isPending || !title.trim()}
                  onClick={() => updatePlan.mutate()}>
                  {updatePlan.isPending ? 'Đang lưu…' : 'Cập nhật kế hoạch'}
                </button>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Lịch sử vòng đời</h2>
            {(history.data as any)?.items?.length
              ? (history.data as any).items.map((e: any) => (
                  <div key={e.lifecycleEventId}>
                    <strong>{e.eventType}</strong> — {e.reason} — {String(e.effectiveAt)}
                  </div>
                ))
              : <p>Chưa có sự kiện kết thúc dịch vụ.</p>}
          </section>

          {selected.activeStatus && (
            <section className="card">
              <h2>Kết thúc dịch vụ / Discharge</h2>
              <label className="field-group">
                <span className="field-label">Lý do</span>
                <select className="text-input" value={reason} onChange={e => setReason(e.target.value)}>
                  <option value="END_OF_SERVICE">Kết thúc dịch vụ</option>
                  <option value="RETURN_HOME">Về gia đình</option>
                  <option value="TRANSFER_FACILITY">Chuyển cơ sở khác</option>
                  <option value="HOSPITAL_TRANSFER">Chuyển viện</option>
                  <option value="OTHER">Khác</option>
                </select>
              </label>
              <label className="field-group">
                <span className="field-label">Nơi chuyển đến</span>
                <input className="text-input" value={destination} onChange={e => setDestination(e.target.value)} />
              </label>
              <label className="field-group">
                <span className="field-label">Ghi chú</span>
                <textarea className="text-input" value={note} onChange={e => setNote(e.target.value)} />
              </label>
              <label>
                <input type="checkbox" checked={confirmDischarge}
                  onChange={e => setConfirmDischarge(e.target.checked)} />{' '}
                Tôi xác nhận kết thúc dịch vụ cho hồ sơ này.
              </label>
              <div style={{ marginTop: 12 }}>
                <button className="button" disabled={!confirmDischarge || discharge.isPending}
                  onClick={() => discharge.mutate()}>
                  {discharge.isPending ? 'Đang xử lý…' : 'Kết thúc dịch vụ'}
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
TSX

python3 - "$ROUTER_FILE" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); s=p.read_text()
if "/resident-lifecycle" in s:
    raise SystemExit(0)

m=re.search(r'(?ms)^(\s*const\s+AccommodationPage\s*=\s*lazy\(.+?^\s*\);\s*)',s)
if not m:
    m=re.search(r'(?m)^(\s*const\s+AccommodationPage\s*=.+$)',s)
if not m:
    raise SystemExit("ACCOMMODATION_LAZY_DECLARATION_NOT_FOUND")

decl="\nconst ResidentLifecyclePage = lazy(() => import('./features/resident-lifecycle/ResidentLifecyclePage'));\n"
s=s[:m.end()]+decl+s[m.end():]

route=re.search(r'(?ms)\{\s*path:\s*[\'"]/accommodation[\'"].*?\n\s*\}',s)
if not route:
    raise SystemExit("ACCOMMODATION_ROUTE_BLOCK_NOT_FOUND")
newroute="\n  {\n    path: '/resident-lifecycle',\n    element: <ResidentLifecyclePage />,\n  },"
s=s[:route.end()]+"," + newroute+s[route.end():]
p.write_text(s)
PY

python3 - "$NAV_FILE" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); s=p.read_text()
if "/resident-lifecycle" not in s:
    m=re.search(r"<nav\b[^>]*>",s,flags=re.I|re.S)
    if not m: raise SystemExit("NAV_OPEN_TAG_NOT_FOUND")
    s=s[:m.end()]+'\n        <a href="/resident-lifecycle">Vòng đời người cao tuổi</a>'+s[m.end():]
    p.write_text(s)
PY

grep -q "/resident-lifecycle" "$ROUTER_FILE" || fail LIFECYCLE_ROUTE_PATCH_FAILED
grep -q "/resident-lifecycle" "$NAV_FILE" || fail LIFECYCLE_NAV_PATCH_FAILED
echo "PASS: FRONTEND IMPLEMENTED"

echo
echo "STEP 5 — BUILD"
(cd "$API" && npm run build) || fail API_BUILD_FAILED
echo "API_BUILD=PASS"
(cd "$FE" && npm run build) || fail FRONTEND_BUILD_FAILED
echo "FRONTEND_BUILD=PASS"

echo
echo "STEP 6 — ISOLATED DATABASE"
docker network create "$NET" >/dev/null
docker run -d --name "$IPG" --network "$NET" \
  -e POSTGRES_USER="$DBU" -e POSTGRES_PASSWORD="$DBP" -e POSTGRES_DB=postgres \
  postgres:16 >/dev/null

FINAL=0
for _ in $(seq 1 240); do
  if docker logs "$IPG" 2>&1 | grep -q "PostgreSQL init process complete; ready for start up."; then FINAL=1; break; fi
  sleep .25
done
[ "$FINAL" = 1 ] || fail ISOLATED_POSTGRES_FINAL_STARTUP_NOT_READY
STABLE=0
for _ in $(seq 1 120); do
  if docker exec "$IPG" psql -X -U "$DBU" -d postgres -Atc 'SELECT 1' >/dev/null 2>&1; then
    STABLE=$((STABLE+1)); [ "$STABLE" -ge 3 ] && break
  else STABLE=0; fi
  sleep .25
done
[ "$STABLE" -ge 3 ] || fail ISOLATED_POSTGRES_NOT_STABLE

docker exec "$PG" pg_dump -Fc -U taman -d taman_care > "$TMP/master.dump" || fail MASTER_READONLY_DUMP_FAILED
docker cp "$TMP/master.dump" "$IPG:/tmp/master.dump" >/dev/null
docker exec "$IPG" createdb -U "$DBU" "$SRC_DB" || fail SOURCE_DB_CREATE_FAILED
docker exec "$IPG" pg_restore -U "$DBU" -d "$SRC_DB" --no-owner --no-acl /tmp/master.dump >/dev/null || fail SOURCE_DB_RESTORE_FAILED
docker exec "$IPG" createdb -U "$DBU" -T "$SRC_DB" "$ISO_DB" || fail ISO_DB_CLONE_FAILED

docker cp "$MIG010" "$IPG:/tmp/010.sql" >/dev/null
docker cp "$MIG011" "$IPG:/tmp/011.sql" >/dev/null
docker exec "$IPG" psql -v ON_ERROR_STOP=1 -X -U "$DBU" -d "$ISO_DB" -f /tmp/010.sql >/dev/null || fail MIGRATION010_FAILED
docker exec "$IPG" psql -v ON_ERROR_STOP=1 -X -U "$DBU" -d "$ISO_DB" -f /tmp/011.sql >/dev/null || fail MIGRATION011_FAILED
echo "PASS: ISOLATED DB + MIGRATIONS"

echo
echo "STEP 7 — SEED Y3C FIXTURES"
ACTOR="$(docker exec "$IPG" psql -X -U "$DBU" -d "$ISO_DB" -Atc "SELECT actor_id||'|'||primary_operational_role FROM staff_actors WHERE status='ACTIVE' AND primary_operational_role='SUPERVISOR' ORDER BY actor_id LIMIT 1")"
RID="$(docker exec "$IPG" psql -X -U "$DBU" -d "$ISO_DB" -Atc "SELECT resident_id FROM residents WHERE active_status=true ORDER BY resident_id LIMIT 1")"
[ -n "$ACTOR" ] || fail ACTOR_NOT_FOUND
[ -n "$RID" ] || fail ACTIVE_RESIDENT_NOT_FOUND
AID="${ACTOR%%|*}"; AROLE="${ACTOR##*|}"

cat > "$TMP/seed.sql" <<SQL
INSERT INTO accommodation_buildings(building_id,code,name) VALUES('y3-b','Y3B','Y3 Building');
INSERT INTO accommodation_floors(floor_id,building_id,code,name,floor_number) VALUES('y3-f','y3-b','Y3F','Y3 Floor',1);
INSERT INTO accommodation_rooms(room_id,floor_id,code,name) VALUES('y3-r','y3-f','Y3R','Y3 Room');
INSERT INTO accommodation_beds(bed_id,room_id,code,name,status) VALUES
('y3-bed-1','y3-r','Y3B1','Y3 Bed 1','AVAILABLE'),
('y3-bed-2','y3-r','Y3B2','Y3 Bed 2','AVAILABLE');
INSERT INTO bed_assignments(assignment_id,bed_id,resident_id,assigned_by,assigned_by_role)
VALUES('y3-assignment','y3-bed-1','$RID','$AID','$AROLE');
UPDATE accommodation_beds SET status='OCCUPIED' WHERE bed_id='y3-bed-1';
UPDATE residents SET room='Y3R',bed='Y3B1' WHERE resident_id='$RID';
INSERT INTO care_plans(
 care_plan_id,resident_id,plan_code,title,description,status,
 created_by,created_by_role
) VALUES(
 'y3-plan','$RID','Y3-PLAN','Y3 Initial Plan','Before update','DRAFT',
 '$AID','$AROLE'
);
INSERT INTO care_plan_audit(
 audit_id,event_sequence,care_plan_id,resident_id,event_type,
 actor_id,actor_role,previous_state,new_state
) VALUES(
 'y3-plan-audit-1',1,'y3-plan','$RID','PLAN_CREATED',
 '$AID','$AROLE',NULL,'{"status":"DRAFT"}'::jsonb
);
SQL
docker cp "$TMP/seed.sql" "$IPG:/tmp/seed.sql" >/dev/null
docker exec "$IPG" psql -v ON_ERROR_STOP=1 -X -U "$DBU" -d "$ISO_DB" -f /tmp/seed.sql >/dev/null || fail FIXTURE_SEED_FAILED
echo "ACTOR=$ACTOR"
echo "RESIDENT=$RID"
echo "PASS: FIXTURES"

echo
echo "STEP 8 — BUILD + START ISOLATED API"
(cd "$API" && docker build -t "$IMG" . >/dev/null) || fail ISOLATED_API_IMAGE_BUILD_FAILED
docker inspect "$MASTER_API" --format '{{range .Config.Env}}{{println .}}{{end}}' > "$TMP/api.env"
grep -v '^DATABASE_URL=' "$TMP/api.env" > "$TMP/api2.env" || true
PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()
PY
)"
docker run -d --name "$IAPI" --network "$NET" -p "127.0.0.1:$PORT:3000" \
  --env-file "$TMP/api2.env" \
  -e DATABASE_URL="postgresql://$DBU:$DBP@$IPG:5432/$ISO_DB" \
  "$IMG" >/dev/null

READY=0
for _ in $(seq 1 120); do
  C="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/health" 2>/dev/null || true)"
  [ "$C" = 200 ] && { READY=1; break; }
  sleep .5
done
[ "$READY" = 1 ] || { docker logs --tail 120 "$IAPI" 2>&1 || true; fail ISOLATED_API_NOT_READY; }
echo "ISOLATED_API_PORT=$PORT"
echo "PASS: ISOLATED API READY"

echo
echo "STEP 9 — CARE PLAN UPDATE ACCEPTANCE"
PLAN_JSON="$(curl -sS -H "x-actor-id: $AID" -H "x-actor-role: $AROLE" \
  "http://127.0.0.1:$PORT/api/resident-lifecycle/residents/$RID/care-plans?limit=100&offset=0")"
UPDATED_AT="$(python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(d["items"][0]["updatedAt"])' <<<"$PLAN_JSON")"
BODY="$(python3 - "$UPDATED_AT" <<'PY'
import json,sys
print(json.dumps({"expectedUpdatedAt":sys.argv[1],"title":"Y3 Updated Plan","description":"Updated through lifecycle API"}))
PY
)"
CODE="$(curl -sS -o "$TMP/update.json" -w '%{http_code}' -X PATCH \
  -H "x-actor-id: $AID" -H "x-actor-role: $AROLE" -H 'content-type: application/json' \
  --data "$BODY" "http://127.0.0.1:$PORT/api/resident-lifecycle/care-plans/y3-plan")"
[ "$CODE" = 200 ] || fail CARE_PLAN_UPDATE_HTTP_$CODE
AUDIT="$(docker exec "$IPG" psql -X -U "$DBU" -d "$ISO_DB" -Atc "SELECT count(*) FROM care_plan_audit WHERE care_plan_id='y3-plan' AND event_type='PLAN_UPDATED'")"
[ "$AUDIT" = 1 ] || fail CARE_PLAN_UPDATE_AUDIT_MISSING
STALE="$(curl -sS -o /dev/null -w '%{http_code}' -X PATCH \
  -H "x-actor-id: $AID" -H "x-actor-role: $AROLE" -H 'content-type: application/json' \
  --data "$BODY" "http://127.0.0.1:$PORT/api/resident-lifecycle/care-plans/y3-plan")"
[ "$STALE" = 409 ] || fail STALE_CARE_PLAN_UPDATE_EXPECTED_409_GOT_$STALE
echo "CARE_PLAN_UPDATE=PASS"
echo "CARE_PLAN_AUDIT=PASS"
echo "STALE_UPDATE_REJECTION=PASS"

echo
echo "STEP 10 — DISCHARGE ACCEPTANCE"
DCODE="$(curl -sS -o "$TMP/discharge.json" -w '%{http_code}' -X POST \
  -H "x-actor-id: $AID" -H "x-actor-role: $AROLE" -H 'content-type: application/json' \
  --data '{"reason":"END_OF_SERVICE","note":"Y3C isolated acceptance","destination":"HOME"}' \
  "http://127.0.0.1:$PORT/api/resident-lifecycle/residents/$RID/discharge")"
[ "$DCODE" = 201 ] || [ "$DCODE" = 200 ] || fail DISCHARGE_HTTP_$DCODE

STATE="$(docker exec "$IPG" psql -X -U "$DBU" -d "$ISO_DB" -Atc "SELECT active_status||'|'||coalesce(room,'NULL')||'|'||coalesce(bed,'NULL') FROM residents WHERE resident_id='$RID'")"
[ "$STATE" = "false|NULL|NULL" ] || fail RESIDENT_DISCHARGE_STATE_BAD_$STATE

ASSIGN_ENDED="$(docker exec "$IPG" psql -X -U "$DBU" -d "$ISO_DB" -Atc "SELECT count(*) FROM bed_assignments WHERE resident_id='$RID' AND ended_at IS NOT NULL AND end_reason LIKE 'DISCHARGE:%'")"
[ "$ASSIGN_ENDED" -ge 1 ] || fail BED_ASSIGNMENT_NOT_ENDED

BED_STATUS="$(docker exec "$IPG" psql -X -U "$DBU" -d "$ISO_DB" -Atc "SELECT status FROM accommodation_beds WHERE bed_id='y3-bed-1'")"
[ "$BED_STATUS" = AVAILABLE ] || fail RELEASED_BED_NOT_AVAILABLE_$BED_STATUS

EVENTS="$(docker exec "$IPG" psql -X -U "$DBU" -d "$ISO_DB" -Atc "SELECT count(*) FROM resident_lifecycle_events WHERE resident_id='$RID' AND event_type='DISCHARGED'")"
[ "$EVENTS" = 1 ] || fail DISCHARGE_EVENT_COUNT_$EVENTS

RAUDIT="$(docker exec "$IPG" psql -X -U "$DBU" -d "$ISO_DB" -Atc "SELECT count(*) FROM resident_audit WHERE target_resident_id='$RID' AND event_type='RESIDENT_DISCHARGED'")"
[ "$RAUDIT" -ge 1 ] || fail RESIDENT_AUDIT_MISSING

DUP="$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  -H "x-actor-id: $AID" -H "x-actor-role: $AROLE" -H 'content-type: application/json' \
  --data '{"reason":"END_OF_SERVICE"}' \
  "http://127.0.0.1:$PORT/api/resident-lifecycle/residents/$RID/discharge")"
[ "$DUP" = 409 ] || fail DUPLICATE_DISCHARGE_EXPECTED_409_GOT_$DUP

POST_ASSIGN="$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  -H "x-actor-id: $AID" -H "x-actor-role: $AROLE" -H 'content-type: application/json' \
  --data "{\"residentId\":\"$RID\"}" \
  "http://127.0.0.1:$PORT/api/accommodation/beds/y3-bed-2/assign")"
[ "$POST_ASSIGN" = 409 ] || fail POST_DISCHARGE_ASSIGN_EXPECTED_409_GOT_$POST_ASSIGN

echo "RESIDENT_DISCHARGE=PASS"
echo "ATOMIC_BED_RELEASE=PASS"
echo "RESIDENT_HISTORY_PRESERVED=PASS"
echo "DUPLICATE_DISCHARGE_REJECTED=PASS"
echo "POST_DISCHARGE_ASSIGNMENT_REJECTED=PASS"

echo
echo "STEP 11 — BOUNDED HISTORY + CORE REGRESSION"
HC="$(curl -sS -H "x-actor-id: $AID" -H "x-actor-role: $AROLE" \
  "http://127.0.0.1:$PORT/api/resident-lifecycle/residents/$RID/history?limit=100&offset=0")"
HLIM="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["limit"])' <<<"$HC")"
[ "$HLIM" = 100 ] || fail HISTORY_BOUNDING_FAILED
RCODE="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/residents?limit=50&offset=0")"
[ "$RCODE" = 200 ] || fail RESIDENT_LIST_REGRESSION_$RCODE
ACODE="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "x-actor-id: $AID" -H "x-actor-role: $AROLE" \
  "http://127.0.0.1:$PORT/api/accommodation/overview?limit=100&offset=0")"
[ "$ACODE" = 200 ] || fail ACCOMMODATION_OVERVIEW_REGRESSION_$ACODE
echo "BOUNDED_HISTORY=PASS"
echo "RESIDENT_LIST_REGRESSION=PASS"
echo "ACCOMMODATION_REGRESSION=PASS"

echo
echo "STEP 12 — MASTER FINAL SAFETY"
HF="$(curl -sS -o /dev/null -w '%{http_code}' "$HEALTH" 2>/dev/null || true)"
AAF="$(docker exec "$PG" psql -X -U taman -d taman_care -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('accommodation_buildings','accommodation_floors','accommodation_rooms','accommodation_beds','bed_assignments','accommodation_audit_events','resident_lifecycle_events');" 2>/dev/null || true)"
[ "$HF" = 200 ] || fail MASTER_HEALTH_FINAL_NOT_200
[ "$AAF" = 0 ] || fail MASTER_LIFECYCLE_TABLES_CHANGED
echo "MASTER_HEALTH_FINAL=$HF"
echo "MASTER_Y_AA_TABLES_FINAL=$AAF"
echo "PASS: MASTER PRESERVED"

ROLLBACK_NEEDED=0
echo
echo "======================================================================"
echo " STATUS: Y3C FAST IMPLEMENTATION PASSED"
echo " Y_MIGRATION_CREATED=YES"
echo " CARE_PLAN_UPDATE=PASS"
echo " CARE_PLAN_AUDIT=PASS"
echo " STALE_UPDATE_REJECTION=PASS"
echo " RESIDENT_DISCHARGE=PASS"
echo " ATOMIC_BED_RELEASE=PASS"
echo " RESIDENT_LIFECYCLE_HISTORY=PASS"
echo " DUPLICATE_DISCHARGE_REJECTED=PASS"
echo " POST_DISCHARGE_ASSIGNMENT_REJECTED=PASS"
echo " BOUNDED_HISTORY=PASS"
echo " RESIDENT_LIST_REGRESSION=PASS"
echo " ACCOMMODATION_REGRESSION=PASS"
echo " API_BUILD=PASS"
echo " FRONTEND_BUILD=PASS"
echo " SOURCE_IMPLEMENTED=YES"
echo " MASTER_DATABASE_MUTATION=NO"
echo " MASTER_RUNTIME_REDEPLOYMENT=NO"
echo " Y_PRODUCT_ACCEPTED=NO"
echo " NEXT=Y4_OPERATIONAL_CLOSEOUT_AND_SCALE_REGRESSION"
echo "======================================================================"
