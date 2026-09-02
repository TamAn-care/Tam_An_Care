import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import {
  NutritionCommand,
} from './nutrition-hydration.types';
import {
  NutritionHydrationAuthorizationService,
} from './nutrition-hydration-authorization.service';

@Injectable()
export class NutritionHydrationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth:
      NutritionHydrationAuthorizationService,
  ) {}

  private required(value: unknown, name: string): string {
    const text = String(value ?? '').trim();

    if (!text) {
      throw new Error(`${name} is required.`);
    }

    return text;
  }

  private async resident(
    client: any,
    residentId: string,
  ) {
    const result = await client.query(
      `
      SELECT resident_id
      FROM residents
      WHERE resident_id = $1
      `,
      [residentId],
    );

    if (!result.rowCount) {
      throw new Error('Resident not found.');
    }
  }

  private async audit(
    client: any,
    residentId: string,
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    actorId: string | null,
    actorRole: string | null,
    previousState: unknown,
    newState: unknown,
  ) {
    const sequence = await client.query(
      `
      SELECT COALESCE(MAX(event_sequence), 0) + 1 AS seq
      FROM nutrition_audit
      WHERE aggregate_type = $1
        AND aggregate_id = $2
      `,
      [aggregateType, aggregateId],
    );

    await client.query(
      `
      INSERT INTO nutrition_audit (
        audit_id,
        event_sequence,
        resident_id,
        aggregate_type,
        aggregate_id,
        event_type,
        actor_id,
        actor_role,
        previous_state,
        new_state
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb
      )
      `,
      [
        randomUUID(),
        Number(sequence.rows[0].seq),
        residentId,
        aggregateType,
        aggregateId,
        eventType,
        actorId,
        actorRole,
        previousState
          ? JSON.stringify(previousState)
          : null,
        newState
          ? JSON.stringify(newState)
          : null,
      ],
    );
  }

  private async plan(
    client: any,
    residentId: string,
    planId: string,
    lock = false,
  ) {
    const result = await client.query(
      `
      SELECT *
      FROM nutrition_plans
      WHERE nutrition_plan_id = $1
        AND resident_id = $2
      ${lock ? 'FOR UPDATE' : ''}
      `,
      [planId, residentId],
    );

    if (!result.rowCount) {
      throw new Error('Nutrition Plan not found.');
    }

    return result.rows[0];
  }

  private async diet(
    client: any,
    residentId: string,
    dietOrderId: string,
    lock = false,
  ) {
    const result = await client.query(
      `
      SELECT *
      FROM diet_orders
      WHERE diet_order_id = $1
        AND resident_id = $2
      ${lock ? 'FOR UPDATE' : ''}
      `,
      [dietOrderId, residentId],
    );

    if (!result.rowCount) {
      throw new Error('Diet Order not found.');
    }

    return result.rows[0];
  }

  private async meal(
    client: any,
    residentId: string,
    mealScheduleId: string,
    lock = false,
  ) {
    const result = await client.query(
      `
      SELECT *
      FROM meal_schedules
      WHERE meal_schedule_id = $1
        AND resident_id = $2
      ${lock ? 'FOR UPDATE' : ''}
      `,
      [mealScheduleId, residentId],
    );

    if (!result.rowCount) {
      throw new Error('Meal Schedule not found.');
    }

    return result.rows[0];
  }

  private owner(
    row: any,
    actorId: string,
    actorRole: string,
  ) {
    if (
      row.assigned_to !== actorId ||
      row.assigned_role !== actorRole
    ) {
      throw new Error(
        'Only the assigned human owner may perform this action.',
      );
    }
  }

  async execute(
    residentId: string,
    input: NutritionCommand,
  ) {
    switch (input.action) {
      case 'CREATE_PLAN':
        return this.createPlan(residentId, input);

      case 'ACTIVATE_PLAN':
        return this.activatePlan(residentId, input);

      case 'CREATE_DIET_ORDER':
        return this.createDietOrder(residentId, input);

      case 'ACTIVATE_DIET_ORDER':
        return this.activateDietOrder(residentId, input);

      case 'CREATE_MEAL':
        return this.createMeal(residentId, input);

      case 'ASSIGN_MEAL':
        return this.assignMeal(residentId, input);

      case 'ACCEPT_MEAL':
        return this.acceptMeal(residentId, input);

      case 'READY_MEAL':
        return this.readyMeal(residentId, input);

      case 'COMPLETE_MEAL':
      case 'MISS_MEAL':
      case 'REFUSE_MEAL':
      case 'HOLD_MEAL':
        return this.terminalMeal(residentId, input);

      case 'CREATE_ASSISTANCE':
        return this.createAssistance(residentId, input);

      case 'ASSIGN_ASSISTANCE':
      case 'ACCEPT_ASSISTANCE':
      case 'START_ASSISTANCE':
      case 'COMPLETE_ASSISTANCE':
        return this.assistanceTransition(residentId, input);

      case 'RECORD_INTAKE':
        return this.recordIntake(residentId, input);

      case 'VERIFY_INTAKE':
        return this.verifyIntake(residentId, input);

      case 'AMEND_INTAKE':
        return this.amendIntake(residentId, input);

      case 'CREATE_ALERT':
        return this.createAlert(residentId, input);

      case 'ACK_ALERT':
        return this.ackAlert(residentId, input);

      case 'ESCALATE_ALERT':
        return this.escalateAlert(residentId, input);

      case 'ASSIGN_ESCALATION':
        return this.assignEscalation(residentId, input);

      case 'ACCEPT_ESCALATION':
        return this.acceptEscalation(residentId, input);

      case 'RESOLVE_ESCALATION':
        return this.resolveEscalation(residentId, input);

      default:
        throw new Error('Unsupported nutrition action.');
    }
  }

  private async createPlan(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireGovernance(input);

    return this.db.withTransaction(async (client: any) => {
      await this.resident(client, residentId);

      const id = randomUUID();
      const code = `NP-${id}`;
      const title = this.required(input.title, 'title');

      const result = await client.query(
        `
        INSERT INTO nutrition_plans (
          nutrition_plan_id,
          resident_id,
          plan_code,
          title,
          description,
          status,
          hydration_monitoring_required,
          feeding_assistance_required,
          created_by,
          created_by_role
        )
        VALUES (
          $1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,$9
        )
        RETURNING *
        `,
        [
          id,
          residentId,
          code,
          title,
          input.description ?? null,
          true,
          true,
          actor.actorId,
          actor.actorRole,
        ],
      );

      await this.audit(
        client,
        residentId,
        'NUTRITION_PLAN',
        id,
        'NUTRITION_PLAN_CREATED',
        actor.actorId,
        actor.actorRole,
        null,
        { status: 'DRAFT' },
      );

      return result.rows[0];
    });
  }

  private async activatePlan(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireGovernance(input);

    return this.db.withTransaction(async (client: any) => {
      const id = this.required(
        input.nutritionPlanId,
        'nutritionPlanId',
      );

      const row = await this.plan(
        client,
        residentId,
        id,
        true,
      );

      if (row.status !== 'DRAFT') {
        throw new Error(
          'Only a DRAFT Nutrition Plan can be activated.',
        );
      }

      const result = await client.query(
        `
        UPDATE nutrition_plans
        SET
          status = 'ACTIVE',
          approved_by = $2,
          approved_by_role = $3,
          approved_at = now(),
          updated_at = now()
        WHERE nutrition_plan_id = $1
        RETURNING *
        `,
        [id, actor.actorId, actor.actorRole],
      );

      await this.audit(
        client,
        residentId,
        'NUTRITION_PLAN',
        id,
        'NUTRITION_PLAN_ACTIVATED',
        actor.actorId,
        actor.actorRole,
        { status: row.status },
        { status: 'ACTIVE' },
      );

      return result.rows[0];
    });
  }

  private async createDietOrder(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireClinical(input);

    return this.db.withTransaction(async (client: any) => {
      const planId = this.required(
        input.nutritionPlanId,
        'nutritionPlanId',
      );

      const plan = await this.plan(
        client,
        residentId,
        planId,
        true,
      );

      if (plan.status !== 'ACTIVE') {
        throw new Error(
          'Diet Order requires an ACTIVE Nutrition Plan.',
        );
      }

      const id = randomUUID();

      const result = await client.query(
        `
        INSERT INTO diet_orders (
          diet_order_id,
          nutrition_plan_id,
          resident_id,
          diet_code,
          diet_type,
          texture_requirement,
          fluid_consistency,
          allergy_information,
          intolerance_information,
          restriction_information,
          fluid_restriction_active,
          fluid_restriction_details,
          swallowing_restriction_present,
          status,
          ordered_by,
          ordered_by_role
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
          'DRAFT',$14,$15
        )
        RETURNING *
        `,
        [
          id,
          planId,
          residentId,
          `DO-${id}`,
          this.required(input.dietType, 'dietType'),
          input.textureRequirement ?? null,
          input.fluidConsistency ?? null,
          input.allergyInformation ?? null,
          input.intoleranceInformation ?? null,
          input.restrictionInformation ?? null,
          Boolean(input.fluidRestrictionActive),
          input.fluidRestrictionDetails ?? null,
          Boolean(input.swallowingRestrictionPresent),
          actor.actorId,
          actor.actorRole,
        ],
      );

      await this.audit(
        client,
        residentId,
        'DIET_ORDER',
        id,
        'DIET_ORDER_CREATED',
        actor.actorId,
        actor.actorRole,
        null,
        { status: 'DRAFT' },
      );

      return result.rows[0];
    });
  }

  private async activateDietOrder(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireGovernance(input);

    if (input.safetyConfirmed !== true) {
      throw new Error(
        'Explicit human safety confirmation is required.',
      );
    }

    return this.db.withTransaction(async (client: any) => {
      const id = this.required(
        input.dietOrderId,
        'dietOrderId',
      );

      const row = await this.diet(
        client,
        residentId,
        id,
        true,
      );

      if (row.status !== 'DRAFT') {
        throw new Error(
          'Only a DRAFT Diet Order can be activated.',
        );
      }

      const result = await client.query(
        `
        UPDATE diet_orders
        SET
          status = 'ACTIVE',
          safety_confirmed = TRUE,
          safety_confirmed_by = $2,
          safety_confirmed_by_role = $3,
          safety_confirmed_at = now(),
          approved_by = $2,
          approved_by_role = $3,
          approved_at = now(),
          updated_at = now()
        WHERE diet_order_id = $1
        RETURNING *
        `,
        [id, actor.actorId, actor.actorRole],
      );

      await this.audit(
        client,
        residentId,
        'DIET_ORDER',
        id,
        'DIET_ORDER_ACTIVATED',
        actor.actorId,
        actor.actorRole,
        { status: row.status },
        { status: 'ACTIVE', safetyConfirmed: true },
      );

      return result.rows[0];
    });
  }

  private async createMeal(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireClinical(input);

    return this.db.withTransaction(async (client: any) => {
      const planId = this.required(
        input.nutritionPlanId,
        'nutritionPlanId',
      );

      const dietId = this.required(
        input.dietOrderId,
        'dietOrderId',
      );

      const plan = await this.plan(
        client,
        residentId,
        planId,
        true,
      );

      const diet = await this.diet(
        client,
        residentId,
        dietId,
        true,
      );

      if (
        plan.status !== 'ACTIVE' ||
        diet.status !== 'ACTIVE' ||
        diet.safety_confirmed !== true
      ) {
        throw new Error(
          'Meal scheduling requires active, safety-confirmed human-approved nutrition configuration.',
        );
      }

      const id = randomUUID();

      const result = await client.query(
        `
        INSERT INTO meal_schedules (
          meal_schedule_id,
          nutrition_plan_id,
          diet_order_id,
          resident_id,
          schedule_code,
          event_type,
          scheduled_at,
          status
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,'SCHEDULED'
        )
        RETURNING *
        `,
        [
          id,
          planId,
          dietId,
          residentId,
          `MS-${id}`,
          this.required(input.eventType, 'eventType'),
          this.required(input.scheduledAt, 'scheduledAt'),
        ],
      );

      await this.audit(
        client,
        residentId,
        'MEAL_SCHEDULE',
        id,
        'MEAL_SCHEDULE_CREATED',
        actor.actorId,
        actor.actorRole,
        null,
        { status: 'SCHEDULED' },
      );

      return result.rows[0];
    });
  }

  private async assignMeal(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireClinical(input);

    return this.db.withTransaction(async (client: any) => {
      const id = this.required(
        input.mealScheduleId,
        'mealScheduleId',
      );

      const row = await this.meal(
        client,
        residentId,
        id,
        true,
      );

      if (row.status !== 'SCHEDULED') {
        throw new Error(
          'Only a SCHEDULED meal may be assigned.',
        );
      }

      const assignedTo = this.required(
        input.assignedTo,
        'assignedTo',
      );

      const assignedRole = this.required(
        input.assignedRole,
        'assignedRole',
      ).toUpperCase();

      if (
        ['AI','SYSTEM'].includes(assignedRole)
      ) {
        throw new Error(
          'Meal owner must be an accountable human.',
        );
      }

      const result = await client.query(
        `
        UPDATE meal_schedules
        SET
          status = 'ASSIGNED',
          assigned_to = $2,
          assigned_role = $3,
          assigned_at = now(),
          updated_at = now()
        WHERE meal_schedule_id = $1
        RETURNING *
        `,
        [id, assignedTo, assignedRole],
      );

      await this.audit(
        client,
        residentId,
        'MEAL_SCHEDULE',
        id,
        'MEAL_ASSIGNED',
        actor.actorId,
        actor.actorRole,
        { status: row.status },
        {
          status: 'ASSIGNED',
          assignedTo,
          assignedRole,
        },
      );

      return result.rows[0];
    });
  }

  private async acceptMeal(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireHuman(input);

    return this.db.withTransaction(async (client: any) => {
      const id = this.required(
        input.mealScheduleId,
        'mealScheduleId',
      );

      const row = await this.meal(
        client,
        residentId,
        id,
        true,
      );

      if (row.status !== 'ASSIGNED') {
        throw new Error(
          'Only an ASSIGNED meal can be accepted.',
        );
      }

      this.owner(
        row,
        actor.actorId,
        actor.actorRole,
      );

      const result = await client.query(
        `
        UPDATE meal_schedules
        SET
          status = 'ACCEPTED',
          accepted_at = now(),
          updated_at = now()
        WHERE meal_schedule_id = $1
        RETURNING *
        `,
        [id],
      );

      await this.audit(
        client,
        residentId,
        'MEAL_SCHEDULE',
        id,
        'MEAL_ACCEPTED',
        actor.actorId,
        actor.actorRole,
        { status: row.status },
        { status: 'ACCEPTED' },
      );

      return result.rows[0];
    });
  }

  private async readyMeal(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireHuman(input);

    return this.db.withTransaction(async (client: any) => {
      const id = this.required(
        input.mealScheduleId,
        'mealScheduleId',
      );

      const row = await this.meal(
        client,
        residentId,
        id,
        true,
      );

      if (row.status !== 'ACCEPTED') {
        throw new Error(
          'Only an ACCEPTED meal can become READY.',
        );
      }

      this.owner(
        row,
        actor.actorId,
        actor.actorRole,
      );

      const result = await client.query(
        `
        UPDATE meal_schedules
        SET
          status = 'READY',
          ready_at = now(),
          updated_at = now()
        WHERE meal_schedule_id = $1
        RETURNING *
        `,
        [id],
      );

      await this.audit(
        client,
        residentId,
        'MEAL_SCHEDULE',
        id,
        'MEAL_READY',
        actor.actorId,
        actor.actorRole,
        { status: row.status },
        { status: 'READY' },
      );

      return result.rows[0];
    });
  }

  private async terminalMeal(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireHuman(input);

    const map: Record<string, {
      status: string;
      column: string;
      event: string;
    }> = {
      COMPLETE_MEAL: {
        status: 'COMPLETED',
        column: 'completed_at',
        event: 'MEAL_COMPLETED',
      },
      MISS_MEAL: {
        status: 'MISSED',
        column: 'missed_at',
        event: 'MEAL_MISSED',
      },
      REFUSE_MEAL: {
        status: 'REFUSED',
        column: 'refused_at',
        event: 'MEAL_REFUSED',
      },
      HOLD_MEAL: {
        status: 'HELD',
        column: 'held_at',
        event: 'MEAL_HELD',
      },
    };

    const target = map[input.action];

    return this.db.withTransaction(async (client: any) => {
      const id = this.required(
        input.mealScheduleId,
        'mealScheduleId',
      );

      const row = await this.meal(
        client,
        residentId,
        id,
        true,
      );

      if (row.status !== 'READY') {
        throw new Error(
          'Only a READY meal may enter terminal outcome.',
        );
      }

      this.owner(
        row,
        actor.actorId,
        actor.actorRole,
      );

      const result = await client.query(
        `
        UPDATE meal_schedules
        SET
          status = $2,
          ${target.column} = now(),
          exception_reason = $3,
          updated_at = now()
        WHERE meal_schedule_id = $1
        RETURNING *
        `,
        [
          id,
          target.status,
          input.exceptionReason ?? null,
        ],
      );

      await this.audit(
        client,
        residentId,
        'MEAL_SCHEDULE',
        id,
        target.event,
        actor.actorId,
        actor.actorRole,
        { status: row.status },
        { status: target.status },
      );

      return result.rows[0];
    });
  }

  private async createAssistance(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireClinical(input);

    return this.db.withTransaction(async (client: any) => {
      const mealId = this.required(
        input.mealScheduleId,
        'mealScheduleId',
      );

      await this.meal(
        client,
        residentId,
        mealId,
        true,
      );

      const id = randomUUID();

      const result = await client.query(
        `
        INSERT INTO feeding_assistance (
          feeding_assistance_id,
          meal_schedule_id,
          resident_id,
          assistance_level,
          status,
          assistance_note
        )
        VALUES (
          $1,$2,$3,$4,'PLANNED',$5
        )
        RETURNING *
        `,
        [
          id,
          mealId,
          residentId,
          this.required(
            input.assistanceLevel,
            'assistanceLevel',
          ),
          input.assistanceNote ?? null,
        ],
      );

      await this.audit(
        client,
        residentId,
        'FEEDING_ASSISTANCE',
        id,
        'FEEDING_ASSISTANCE_CREATED',
        actor.actorId,
        actor.actorRole,
        null,
        { status: 'PLANNED' },
      );

      return result.rows[0];
    });
  }

  private async assistanceTransition(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireHuman(input);

    const id = this.required(
      input.feedingAssistanceId,
      'feedingAssistanceId',
    );

    return this.db.withTransaction(async (client: any) => {
      const result = await client.query(
        `
        SELECT *
        FROM feeding_assistance
        WHERE feeding_assistance_id = $1
          AND resident_id = $2
        FOR UPDATE
        `,
        [id, residentId],
      );

      if (!result.rowCount) {
        throw new Error(
          'Feeding Assistance not found.',
        );
      }

      const row = result.rows[0];

      let target = '';
      let event = '';
      let expected = '';
      let extraSql = '';
      let values: any[] = [id];

      if (input.action === 'ASSIGN_ASSISTANCE') {
        this.auth.requireClinical(input);

        expected = 'PLANNED';
        target = 'ASSIGNED';
        event = 'FEEDING_ASSISTANCE_ASSIGNED';

        const assignedTo = this.required(
          input.assignedTo,
          'assignedTo',
        );

        const assignedRole = this.required(
          input.assignedRole,
          'assignedRole',
        ).toUpperCase();

        if (['AI','SYSTEM'].includes(assignedRole)) {
          throw new Error(
            'Feeding Assistance owner must be human.',
          );
        }

        extraSql = `,
          assigned_to = $2,
          assigned_role = $3,
          assigned_at = now()
        `;

        values = [
          id,
          assignedTo,
          assignedRole,
        ];
      }

      if (input.action === 'ACCEPT_ASSISTANCE') {
        expected = 'ASSIGNED';
        target = 'ACCEPTED';
        event = 'FEEDING_ASSISTANCE_ACCEPTED';

        this.owner(
          row,
          actor.actorId,
          actor.actorRole,
        );

        extraSql = ', accepted_at = now()';
      }

      if (input.action === 'START_ASSISTANCE') {
        expected = 'ACCEPTED';
        target = 'IN_PROGRESS';
        event = 'FEEDING_ASSISTANCE_STARTED';

        this.owner(
          row,
          actor.actorId,
          actor.actorRole,
        );

        extraSql = ', started_at = now()';
      }

      if (input.action === 'COMPLETE_ASSISTANCE') {
        expected = 'IN_PROGRESS';
        target = 'COMPLETED';
        event = 'FEEDING_ASSISTANCE_COMPLETED';

        this.owner(
          row,
          actor.actorId,
          actor.actorRole,
        );

        extraSql = ', completed_at = now()';
      }

      if (!target || row.status !== expected) {
        throw new Error(
          'Invalid Feeding Assistance transition.',
        );
      }

      const updated = await client.query(
        `
        UPDATE feeding_assistance
        SET
          status = '${target}'
          ${extraSql},
          updated_at = now()
        WHERE feeding_assistance_id = $1
        RETURNING *
        `,
        values,
      );

      await this.audit(
        client,
        residentId,
        'FEEDING_ASSISTANCE',
        id,
        event,
        actor.actorId,
        actor.actorRole,
        { status: row.status },
        { status: target },
      );

      return updated.rows[0];
    });
  }

  private async recordIntake(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireHuman(input);

    return this.db.withTransaction(async (client: any) => {
      const mealId = this.required(
        input.mealScheduleId,
        'mealScheduleId',
      );

      const meal = await this.meal(
        client,
        residentId,
        mealId,
        true,
      );

      if (
        ![
          'READY',
          'COMPLETED',
          'REFUSED',
          'HELD',
        ].includes(meal.status)
      ) {
        throw new Error(
          'Intake may only be recorded for an accountable meal state.',
        );
      }

      const id = randomUUID();

      const result = await client.query(
        `
        INSERT INTO nutrition_intake_records (
          intake_record_id,
          meal_schedule_id,
          resident_id,
          intake_type,
          food_intake_percent,
          fluid_amount_ml,
          intake_note,
          record_status,
          recorded_by,
          recorded_by_role
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,'RECORDED',$8,$9
        )
        RETURNING *
        `,
        [
          id,
          mealId,
          residentId,
          this.required(
            input.intakeType,
            'intakeType',
          ),
          input.foodIntakePercent ?? null,
          input.fluidAmountMl ?? null,
          input.intakeNote ?? null,
          actor.actorId,
          actor.actorRole,
        ],
      );

      await this.audit(
        client,
        residentId,
        'INTAKE_RECORD',
        id,
        'INTAKE_RECORDED',
        actor.actorId,
        actor.actorRole,
        null,
        { recordStatus: 'RECORDED' },
      );

      return result.rows[0];
    });
  }

  private async verifyIntake(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireClinical(input);
    const id = this.required(
      input.intakeRecordId,
      'intakeRecordId',
    );

    return this.db.withTransaction(async (client: any) => {
      const result = await client.query(
        `
        SELECT *
        FROM nutrition_intake_records
        WHERE intake_record_id = $1
          AND resident_id = $2
        FOR UPDATE
        `,
        [id, residentId],
      );

      if (!result.rowCount) {
        throw new Error('Intake Record not found.');
      }

      const row = result.rows[0];

      if (row.record_status !== 'RECORDED') {
        throw new Error(
          'Only a RECORDED Intake Record can be verified.',
        );
      }

      const updated = await client.query(
        `
        UPDATE nutrition_intake_records
        SET
          record_status = 'VERIFIED',
          verified_by = $2,
          verified_by_role = $3,
          verified_at = now()
        WHERE intake_record_id = $1
        RETURNING *
        `,
        [id, actor.actorId, actor.actorRole],
      );

      await this.audit(
        client,
        residentId,
        'INTAKE_RECORD',
        id,
        'INTAKE_VERIFIED',
        actor.actorId,
        actor.actorRole,
        { recordStatus: row.record_status },
        { recordStatus: 'VERIFIED' },
      );

      return updated.rows[0];
    });
  }

  private async amendIntake(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireClinical(input);
    const id = this.required(
      input.intakeRecordId,
      'intakeRecordId',
    );

    return this.db.withTransaction(async (client: any) => {
      const result = await client.query(
        `
        SELECT *
        FROM nutrition_intake_records
        WHERE intake_record_id = $1
          AND resident_id = $2
        FOR UPDATE
        `,
        [id, residentId],
      );

      if (!result.rowCount) {
        throw new Error('Intake Record not found.');
      }

      const row = result.rows[0];

      if (row.record_status !== 'VERIFIED') {
        throw new Error(
          'Only a VERIFIED Intake Record may be amended.',
        );
      }

      const newId = randomUUID();
      const reason = this.required(
        input.amendmentReason,
        'amendmentReason',
      );

      await client.query(
        `
        UPDATE nutrition_intake_records
        SET record_status = 'AMENDED'
        WHERE intake_record_id = $1
        `,
        [id],
      );

      const created = await client.query(
        `
        INSERT INTO nutrition_intake_records (
          intake_record_id,
          meal_schedule_id,
          resident_id,
          intake_type,
          food_intake_percent,
          fluid_amount_ml,
          intake_note,
          record_status,
          recorded_by,
          recorded_by_role,
          amends_record_id,
          amendment_reason
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,
          'RECORDED',$8,$9,$10,$11
        )
        RETURNING *
        `,
        [
          newId,
          row.meal_schedule_id,
          residentId,
          row.intake_type,
          input.foodIntakePercent
            ?? row.food_intake_percent,
          input.fluidAmountMl
            ?? row.fluid_amount_ml,
          input.intakeNote
            ?? row.intake_note,
          actor.actorId,
          actor.actorRole,
          id,
          reason,
        ],
      );

      await this.audit(
        client,
        residentId,
        'INTAKE_RECORD',
        id,
        'INTAKE_AMENDED',
        actor.actorId,
        actor.actorRole,
        { recordStatus: 'VERIFIED' },
        {
          recordStatus: 'AMENDED',
          amendmentRecordId: newId,
        },
      );

      return created.rows[0];
    });
  }

  private async createAlert(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireAlertCreator(input);

    return this.db.withTransaction(async (client: any) => {
      await this.resident(client, residentId);

      const id = randomUUID();

      const source =
        actor.actorRole === 'AI'
          ? 'AI_ALERT'
          : String(
              input.sourceType ?? 'HUMAN',
            ).toUpperCase();

      const result = await client.query(
        `
        INSERT INTO nutrition_alerts (
          nutrition_alert_id,
          resident_id,
          meal_schedule_id,
          alert_type,
          source_type,
          severity,
          summary,
          status,
          created_by,
          created_by_role
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,'OPEN',$8,$9
        )
        RETURNING *
        `,
        [
          id,
          residentId,
          input.mealScheduleId ?? null,
          this.required(
            input.alertType,
            'alertType',
          ),
          source,
          this.required(
            input.severity,
            'severity',
          ),
          this.required(
            input.summary,
            'summary',
          ),
          actor.actorId,
          actor.actorRole,
        ],
      );

      await this.audit(
        client,
        residentId,
        'NUTRITION_ALERT',
        id,
        'NUTRITION_ALERT_CREATED',
        actor.actorId,
        actor.actorRole,
        null,
        {
          status: 'OPEN',
          sourceType: source,
          advisoryOnly:
            actor.actorRole === 'AI',
        },
      );

      return result.rows[0];
    });
  }

  private async ackAlert(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireClinical(input);
    const id = this.required(
      input.nutritionAlertId,
      'nutritionAlertId',
    );

    return this.db.withTransaction(async (client: any) => {
      const result = await client.query(
        `
        SELECT *
        FROM nutrition_alerts
        WHERE nutrition_alert_id = $1
          AND resident_id = $2
        FOR UPDATE
        `,
        [id, residentId],
      );

      if (!result.rowCount) {
        throw new Error('Nutrition Alert not found.');
      }

      const row = result.rows[0];

      if (row.status !== 'OPEN') {
        throw new Error(
          'Only an OPEN Nutrition Alert can be acknowledged.',
        );
      }

      const updated = await client.query(
        `
        UPDATE nutrition_alerts
        SET
          status = 'ACKNOWLEDGED',
          acknowledged_by = $2,
          acknowledged_by_role = $3,
          acknowledged_at = now()
        WHERE nutrition_alert_id = $1
        RETURNING *
        `,
        [id, actor.actorId, actor.actorRole],
      );

      await this.audit(
        client,
        residentId,
        'NUTRITION_ALERT',
        id,
        'NUTRITION_ALERT_ACKNOWLEDGED',
        actor.actorId,
        actor.actorRole,
        { status: row.status },
        { status: 'ACKNOWLEDGED' },
      );

      return updated.rows[0];
    });
  }

  private async escalateAlert(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireClinical(input);
    const alertId = this.required(
      input.nutritionAlertId,
      'nutritionAlertId',
    );

    return this.db.withTransaction(async (client: any) => {
      const alert = await client.query(
        `
        SELECT *
        FROM nutrition_alerts
        WHERE nutrition_alert_id = $1
          AND resident_id = $2
        FOR UPDATE
        `,
        [alertId, residentId],
      );

      if (!alert.rowCount) {
        throw new Error('Nutrition Alert not found.');
      }

      if (alert.rows[0].status !== 'ACKNOWLEDGED') {
        throw new Error(
          'Only an ACKNOWLEDGED Nutrition Alert may be escalated.',
        );
      }

      const id = randomUUID();

      const result = await client.query(
        `
        INSERT INTO nutrition_escalations (
          nutrition_escalation_id,
          resident_id,
          nutrition_alert_id,
          reason,
          status,
          escalated_by,
          escalated_by_role
        )
        VALUES (
          $1,$2,$3,$4,'OPEN',$5,$6
        )
        RETURNING *
        `,
        [
          id,
          residentId,
          alertId,
          this.required(
            input.reason,
            'reason',
          ),
          actor.actorId,
          actor.actorRole,
        ],
      );

      await client.query(
        `
        UPDATE nutrition_alerts
        SET status = 'ESCALATED'
        WHERE nutrition_alert_id = $1
        `,
        [alertId],
      );

      await this.audit(
        client,
        residentId,
        'NUTRITION_ESCALATION',
        id,
        'NUTRITION_ESCALATION_CREATED',
        actor.actorId,
        actor.actorRole,
        null,
        { status: 'OPEN' },
      );

      return result.rows[0];
    });
  }

  private async escalation(
    client: any,
    residentId: string,
    id: string,
  ) {
    const result = await client.query(
      `
      SELECT *
      FROM nutrition_escalations
      WHERE nutrition_escalation_id = $1
        AND resident_id = $2
      FOR UPDATE
      `,
      [id, residentId],
    );

    if (!result.rowCount) {
      throw new Error(
        'Nutrition Escalation not found.',
      );
    }

    return result.rows[0];
  }

  private async assignEscalation(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireGovernance(input);
    const id = this.required(
      input.nutritionEscalationId,
      'nutritionEscalationId',
    );

    return this.db.withTransaction(async (client: any) => {
      const row = await this.escalation(
        client,
        residentId,
        id,
      );

      if (row.status !== 'OPEN') {
        throw new Error(
          'Only an OPEN escalation can be assigned.',
        );
      }

      const reviewer = this.required(
        input.assignedReviewer,
        'assignedReviewer',
      );

      const reviewerRole = this.required(
        input.assignedReviewerRole,
        'assignedReviewerRole',
      ).toUpperCase();

      if (
        ![
          'NURSE',
          'SUPERVISOR',
          'CARE_MANAGER',
        ].includes(reviewerRole)
      ) {
        throw new Error(
          'Escalation reviewer must be an authorized human.',
        );
      }

      const updated = await client.query(
        `
        UPDATE nutrition_escalations
        SET
          status = 'ASSIGNED',
          assigned_reviewer = $2,
          assigned_reviewer_role = $3,
          assigned_at = now(),
          updated_at = now()
        WHERE nutrition_escalation_id = $1
        RETURNING *
        `,
        [id, reviewer, reviewerRole],
      );

      await this.audit(
        client,
        residentId,
        'NUTRITION_ESCALATION',
        id,
        'NUTRITION_ESCALATION_ASSIGNED',
        actor.actorId,
        actor.actorRole,
        { status: row.status },
        {
          status: 'ASSIGNED',
          assignedReviewer: reviewer,
        },
      );

      return updated.rows[0];
    });
  }

  private async acceptEscalation(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireClinical(input);
    const id = this.required(
      input.nutritionEscalationId,
      'nutritionEscalationId',
    );

    return this.db.withTransaction(async (client: any) => {
      const row = await this.escalation(
        client,
        residentId,
        id,
      );

      if (row.status !== 'ASSIGNED') {
        throw new Error(
          'Only an ASSIGNED escalation may be accepted.',
        );
      }

      if (
        row.assigned_reviewer !== actor.actorId ||
        row.assigned_reviewer_role !== actor.actorRole
      ) {
        throw new Error(
          'Only the assigned human reviewer may accept escalation.',
        );
      }

      const updated = await client.query(
        `
        UPDATE nutrition_escalations
        SET
          status = 'ACCEPTED',
          accepted_at = now(),
          updated_at = now()
        WHERE nutrition_escalation_id = $1
        RETURNING *
        `,
        [id],
      );

      await this.audit(
        client,
        residentId,
        'NUTRITION_ESCALATION',
        id,
        'NUTRITION_ESCALATION_ACCEPTED',
        actor.actorId,
        actor.actorRole,
        { status: row.status },
        { status: 'ACCEPTED' },
      );

      return updated.rows[0];
    });
  }

  private async resolveEscalation(
    residentId: string,
    input: NutritionCommand,
  ) {
    const actor = this.auth.requireClinical(input);
    const id = this.required(
      input.nutritionEscalationId,
      'nutritionEscalationId',
    );

    return this.db.withTransaction(async (client: any) => {
      const row = await this.escalation(
        client,
        residentId,
        id,
      );

      if (row.status !== 'ACCEPTED') {
        throw new Error(
          'Only an ACCEPTED escalation may be resolved.',
        );
      }

      const governance =
        ['SUPERVISOR','CARE_MANAGER']
          .includes(actor.actorRole);

      const owner =
        row.assigned_reviewer === actor.actorId &&
        row.assigned_reviewer_role === actor.actorRole;

      if (!governance && !owner) {
        throw new Error(
          'Only assigned reviewer or governance may resolve escalation.',
        );
      }

      const summary = this.required(
        input.resolutionSummary,
        'resolutionSummary',
      );

      const updated = await client.query(
        `
        UPDATE nutrition_escalations
        SET
          status = 'RESOLVED',
          resolved_by = $2,
          resolved_by_role = $3,
          resolved_at = now(),
          resolution_summary = $4,
          updated_at = now()
        WHERE nutrition_escalation_id = $1
        RETURNING *
        `,
        [
          id,
          actor.actorId,
          actor.actorRole,
          summary,
        ],
      );

      await client.query(
        `
        UPDATE nutrition_alerts
        SET
          status = 'RESOLVED',
          resolved_by = $2,
          resolved_by_role = $3,
          resolved_at = now(),
          resolution_note = $4
        WHERE nutrition_alert_id = $1
        `,
        [
          row.nutrition_alert_id,
          actor.actorId,
          actor.actorRole,
          summary,
        ],
      );

      await this.audit(
        client,
        residentId,
        'NUTRITION_ESCALATION',
        id,
        'NUTRITION_ESCALATION_RESOLVED',
        actor.actorId,
        actor.actorRole,
        { status: row.status },
        { status: 'RESOLVED' },
      );

      return updated.rows[0];
    });
  }
}
