import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/**
 * Server-side read-only verification against existing Tâm An operational data.
 * No private data logging; no new resident, room or care-level storage.
 */
@Injectable()
export class ContractOperationalEvidenceService {
 constructor(private readonly db:DatabaseService){}
 async inspect(residentId:string) {
  if(!/^[A-Za-z0-9_-]{1,160}$/.test(residentId))
   throw Error('CONTRACT_RESIDENT_ID_INVALID');
  const r=await this.db.query(
   `SELECT r.resident_id,r.care_level
    FROM public.residents r WHERE r.resident_id=$1`,
   [residentId]);
  if(r.rows.length!==1)throw Error('CONTRACT_RESIDENT_NOT_FOUND');
  const admission=await this.db.query(
   `SELECT c.approved_care_level,c.review_status,c.approved_at
    FROM public.admission_care_classifications c
    JOIN public.admission_cases ac ON ac.admission_case_id=c.admission_case_id
    WHERE ac.resident_id=$1 AND c.approved_at IS NOT NULL
    ORDER BY c.approved_at DESC,c.created_at DESC LIMIT 1`,
   [residentId]);
  const beds=await this.db.query(
   `SELECT b.bed_id,b.code AS bed_code,rm.room_id,rm.code AS room_code
    FROM public.bed_assignments ba
    JOIN public.accommodation_beds b ON b.bed_id=ba.bed_id
    JOIN public.accommodation_rooms rm ON rm.room_id=b.room_id
    WHERE ba.resident_id=$1 AND ba.ended_at IS NULL LIMIT 2`,
   [residentId]);
  const classification=admission.rows[0];
  const assignment=beds.rows[0];
  if(admission.rows.length!==1||beds.rows.length!==1||
     !['APPROVED','OVERRIDDEN'].includes(classification.review_status)||
     !classification.approved_care_level||
     classification.approved_care_level!==r.rows[0].care_level)
    throw Error('CONTRACT_ADMISSION_CARE_OR_BED_NOT_APPROVED');
  return {
   residentId,careLevel:r.rows[0].care_level,
   roomId:assignment.room_id,roomCode:assignment.room_code,
   bedId:assignment.bed_id,bedCode:assignment.bed_code,
   operationalEvidenceVerified:true,
  };
 }
}
