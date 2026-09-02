import {
  Injectable,
} from '@nestjs/common';

import {
  DatabaseService,
} from '../database/database.service';

import {
  CareAction,
  AssignCareActionInput,
  TransferCareActionInput,
  StartCareActionReviewInput,
  ResolveCareActionInput,
  ReopenCareActionInput,
  CareActionDetails,
} from './care-action.types';

import {
  CareActionRepository,
} from './care-action.repository';

import {
  assertValidPriority,
  normalizeNullableDate,
  requireNonEmptyText,
} from './care-action.validation';

import {
  assertCareActionTransition,
} from './care-action.policy';
import { StartReviewAuthorizationService } from '../start-review-authorization/start-review-authorization.service';



import {
  ResolutionAuthorizationService,
} from '../resolution-authorization/resolution-authorization.service';

@Injectable()
export class CareActionService {

  constructor(
    private readonly db: DatabaseService,
    private readonly repository: CareActionRepository,
    private readonly startReviewAuthorization:
      StartReviewAuthorizationService,

    private readonly resolutionAuthorization:
      ResolutionAuthorizationService,
) {}


  async get(
    residentId: string,
    patternId: string,
  ): Promise<CareAction | null> {

    const normalizedResidentId =
      requireNonEmptyText(
        residentId,
        'residentId',
      );

    const normalizedPatternId =
      requireNonEmptyText(
        patternId,
        'patternId',
      );

    return this.repository
      .findByResidentAndPattern(
        normalizedResidentId,
        normalizedPatternId,
      );

  }


  async getDetails(
    residentId: string,
    patternId: string,
  ): Promise<CareActionDetails | null> {

    const action =
      await this.get(
        residentId,
        patternId,
      );

    if (!action) {
      return null;
    }

    const [
      transferHistory,
      auditTrail,
    ] =
      await Promise.all([
        this.repository
          .listTransfers(
            action.id,
          ),

        this.repository
          .listAudit(
            action.id,
          ),
      ]);

    return {
      action,
      transferHistory,
      auditTrail,
    };

  }


  async getOrCreate(
    residentId: string,
    patternId: string,
  ): Promise<CareAction> {

    const normalizedResidentId =
      requireNonEmptyText(
        residentId,
        'residentId',
      );

    const normalizedPatternId =
      requireNonEmptyText(
        patternId,
        'patternId',
      );


    return this.db.withTransaction(
      async client => {

        const existing =
          await this.repository
            .findByResidentAndPattern(
              normalizedResidentId,
              normalizedPatternId,
              client,
            );

        if (existing) {
          return existing;
        }


        const created =
          await this.repository.insert(
            normalizedResidentId,
            normalizedPatternId,
            client,
          );


        await this.repository.insertAudit(
          {
            careActionId:
              created.id,

            residentId:
              created.residentId,

            patternId:
              created.patternId,

            eventType:
              'CREATED',

            actorId:
              null,

            actorRole:
              null,

            previousState:
              null,

            newState:
              {
                status:
                  created.status,
              },
          },
          client,
        );


        return created;

      },
    );

  }


  async assign(
    residentId: string,
    patternId: string,
    input: AssignCareActionInput,
  ): Promise<CareAction> {

    const normalizedResidentId =
      requireNonEmptyText(
        residentId,
        'residentId',
      );

    const normalizedPatternId =
      requireNonEmptyText(
        patternId,
        'patternId',
      );

    const assignedTo =
      requireNonEmptyText(
        input.assignedTo,
        'assignedTo',
      );

    const assignedRole =
      requireNonEmptyText(
        input.assignedRole,
        'assignedRole',
      );

    const priority =
      assertValidPriority(
        input.priority,
      );

    const dueAt =
      normalizeNullableDate(
        input.dueAt,
      );

    const actorId =
      requireNonEmptyText(
        input.actorId,
        'actorId',
      );

    const actorRole =
      requireNonEmptyText(
        input.actorRole,
        'actorRole',
      );


    return this.db.withTransaction(
      async client => {

        let action =
          await this.repository
            .findByResidentAndPatternForUpdate(
              normalizedResidentId,
              normalizedPatternId,
              client,
            );

        let createdNow = false;


        if (!action) {

          action =
            await this.repository.insert(
              normalizedResidentId,
              normalizedPatternId,
              client,
            );

          createdNow = true;


          await this.repository.insertAudit(
            {
              careActionId:
                action.id,

              residentId:
                action.residentId,

              patternId:
                action.patternId,

              eventType:
                'CREATED',

              actorId,
              actorRole,

              previousState:
                null,

              newState:
                {
                  status:
                    action.status,
                },
            },
            client,
          );

        }


        if (action.assignedTo) {

          throw new Error(
            'Care Action is already assigned. Use transfer().',
          );

        }


        const previousState = {
          assignedTo:
            action.assignedTo,

          assignedRole:
            action.assignedRole,

          assignedAt:
            action.assignedAt,

          priority:
            action.priority,

          dueAt:
            action.dueAt,
        };


        const now =
          new Date();


        const eventType =
          'ASSIGNMENT' as const;


        const updated =
          await this.repository.update(
            action.id,
            {
              assignedTo,
              assignedRole,
              assignedAt:
                now,

              priority,
              dueAt,
            },
            client,
          );


        await this.repository.insertTransfer(
          {
            careActionId:
              updated.id,

            eventType,

            fromAssignedTo:
              action.assignedTo,

            fromAssignedRole:
              action.assignedRole,

            toAssignedTo:
              updated.assignedTo!,

            toAssignedRole:
              updated.assignedRole!,

            priority:
              updated.priority,

            dueAt:
              updated.dueAt,

            actorId,
            actorRole,
          },
          client,
        );


        await this.repository.insertAudit(
          {
            careActionId:
              updated.id,

            residentId:
              updated.residentId,

            patternId:
              updated.patternId,

            eventType:
              'ASSIGNED',

            actorId,
            actorRole,

            previousState,

            newState:
              {
                assignedTo:
                  updated.assignedTo,

                assignedRole:
                  updated.assignedRole,

                assignedAt:
                  updated.assignedAt,

                priority:
                  updated.priority,

                dueAt:
                  updated.dueAt,

                createdNow,
              },
          },
          client,
        );


        return updated;

      },
    );

  }


  async transfer(
    residentId: string,
    patternId: string,
    input: TransferCareActionInput,
  ): Promise<CareAction> {

    const normalizedResidentId =
      requireNonEmptyText(
        residentId,
        'residentId',
      );

    const normalizedPatternId =
      requireNonEmptyText(
        patternId,
        'patternId',
      );

    const assignedTo =
      requireNonEmptyText(
        input.assignedTo,
        'assignedTo',
      );

    const assignedRole =
      requireNonEmptyText(
        input.assignedRole,
        'assignedRole',
      );

    const priority =
      assertValidPriority(
        input.priority,
      );

    const dueAt =
      normalizeNullableDate(
        input.dueAt,
      );

    const actorId =
      requireNonEmptyText(
        input.actorId,
        'actorId',
      );

    const actorRole =
      requireNonEmptyText(
        input.actorRole,
        'actorRole',
      );


    return this.db.withTransaction(
      async client => {

        const action =
          await this.repository
            .findByResidentAndPatternForUpdate(
              normalizedResidentId,
              normalizedPatternId,
              client,
            );


        if (!action) {

          throw new Error(
            'Care Action not found.',
          );

        }


        if (!action.assignedTo) {

          throw new Error(
            'Care Action is not assigned. Use assign() first.',
          );

        }


        if (action.status === 'RESOLVED') {

          throw new Error(
            'Resolved Care Action must be reopened before transfer.',
          );

        }


        const previousState = {
          assignedTo:
            action.assignedTo,

          assignedRole:
            action.assignedRole,

          assignedAt:
            action.assignedAt,

          priority:
            action.priority,

          dueAt:
            action.dueAt,

          status:
            action.status,
        };


        const updated =
          await this.repository.update(
            action.id,
            {
              assignedTo,
              assignedRole,

              assignedAt:
                new Date(),

              priority,
              dueAt,
            },
            client,
          );


        await this.repository.insertTransfer(
          {
            careActionId:
              updated.id,

            eventType:
              'TRANSFER',

            fromAssignedTo:
              action.assignedTo,

            fromAssignedRole:
              action.assignedRole,

            toAssignedTo:
              updated.assignedTo!,

            toAssignedRole:
              updated.assignedRole!,

            priority:
              updated.priority,

            dueAt:
              updated.dueAt,

            actorId,
            actorRole,
          },
          client,
        );


        await this.repository.insertAudit(
          {
            careActionId:
              updated.id,

            residentId:
              updated.residentId,

            patternId:
              updated.patternId,

            eventType:
              'TRANSFERRED',

            actorId,
            actorRole,

            previousState,

            newState:
              {
                assignedTo:
                  updated.assignedTo,

                assignedRole:
                  updated.assignedRole,

                assignedAt:
                  updated.assignedAt,

                priority:
                  updated.priority,

                dueAt:
                  updated.dueAt,

                status:
                  updated.status,
              },
          },
          client,
        );


        return updated;

      },
    );

  }


  async startReview(
    residentId: string,
    patternId: string,
    input: StartCareActionReviewInput,
  ): Promise<CareAction> {

    const normalizedResidentId =
      requireNonEmptyText(
        residentId,
        'residentId',
      );

    const normalizedPatternId =
      requireNonEmptyText(
        patternId,
        'patternId',
      );

    const actorId =
      requireNonEmptyText(
        input.actorId,
        'actorId',
      );

    const actorRole =
      requireNonEmptyText(
        input.actorRole,
        'actorRole',
      );


    return this.db.withTransaction(
      async client => {

        const action =
          await this.repository
            .findByResidentAndPatternForUpdate(
              normalizedResidentId,
              normalizedPatternId,
              client,
            );


        if (!action) {

          throw new Error(
            'Care Action not found.',
          );

        }



        this.startReviewAuthorization.authorize({

          action,

          actorId,

          actorRole,

        });


        if (
          !action.assignedTo ||
          !action.assignedRole
        ) {

          throw new Error(
            'Care Action must be assigned before review starts.',
          );

        }


        assertCareActionTransition(
          action.status,
          'IN_REVIEW',
        );


        const previousState = {
          status:
            action.status,

          startedAt:
            action.startedAt,

          assignedTo:
            action.assignedTo,

          assignedRole:
            action.assignedRole,
        };


        const updated =
          await this.repository.update(
            action.id,
            {
              status:
                'IN_REVIEW',

              startedAt:
                new Date(),
            },
            client,
          );


        await this.repository.insertAudit(
          {
            careActionId:
              updated.id,

            residentId:
              updated.residentId,

            patternId:
              updated.patternId,

            eventType:
              'REVIEW_STARTED',

            actorId,
            actorRole,

            previousState,

            newState:
              {
                status:
                  updated.status,

                startedAt:
                  updated.startedAt,

                assignedTo:
                  updated.assignedTo,

                assignedRole:
                  updated.assignedRole,
              },
          },
          client,
        );


        return updated;

      },
    );

  }


  async resolve(
    residentId: string,
    patternId: string,
    input: ResolveCareActionInput,
  ): Promise<CareAction> {

    const normalizedResidentId =
      requireNonEmptyText(
        residentId,
        'residentId',
      );

    const normalizedPatternId =
      requireNonEmptyText(
        patternId,
        'patternId',
      );

    const careNote =
      requireNonEmptyText(
        input.careNote,
        'careNote',
      );

    const resolutionReason =
      requireNonEmptyText(
        input.resolutionReason,
        'resolutionReason',
      );

    const actorId =
      requireNonEmptyText(
        input.actorId,
        'actorId',
      );

    const actorRole =
      requireNonEmptyText(
        input.actorRole,
        'actorRole',
      );


    return this.db.withTransaction(
      async client => {

        const action =
          await this.repository
            .findByResidentAndPatternForUpdate(
              normalizedResidentId,
              normalizedPatternId,
              client,
            );


        if (!action) {

          throw new Error(
            'Care Action not found.',
          );

        }


                this.resolutionAuthorization.authorize(
          {
            status:
              action.status,
            assignedTo:
              action.assignedTo,
            assignedRole:
              action.assignedRole,
            reviewStartedAt:
              action.startedAt,
            actorId,
            actorRole,
            careNote,
            resolutionReason,
          },
        );

        assertCareActionTransition(
          action.status,
          'RESOLVED',
        );


        const previousState = {
          status:
            action.status,

          startedAt:
            action.startedAt,

          resolvedAt:
            action.resolvedAt,

          resolutionReason:
            action.resolutionReason,

          careNote:
            action.careNote,

          assignedTo:
            action.assignedTo,

          assignedRole:
            action.assignedRole,
        };


        const updated =
          await this.repository.update(
            action.id,
            {
              status:
                'RESOLVED',

              resolvedAt:
                new Date(),

              resolutionReason,
              careNote,
            },
            client,
          );


        await this.repository.insertAudit(
          {
            careActionId:
              updated.id,

            residentId:
              updated.residentId,

            patternId:
              updated.patternId,

            eventType:
              'RESOLVED',

            actorId,
            actorRole,

            previousState,

            newState:
              {
                status:
                  updated.status,

                startedAt:
                  updated.startedAt,

                resolvedAt:
                  updated.resolvedAt,

                resolutionReason:
                  updated.resolutionReason,

                careNote:
                  updated.careNote,

                assignedTo:
                  updated.assignedTo,

                assignedRole:
                  updated.assignedRole,
              },
          },
          client,
        );


        return updated;

      },
    );

  }


  async reopen(
    residentId: string,
    patternId: string,
    input: ReopenCareActionInput,
  ): Promise<CareAction> {

    const normalizedResidentId =
      requireNonEmptyText(
        residentId,
        'residentId',
      );

    const normalizedPatternId =
      requireNonEmptyText(
        patternId,
        'patternId',
      );

    const actorId =
      requireNonEmptyText(
        input.actorId,
        'actorId',
      );

    const actorRole =
      requireNonEmptyText(
        input.actorRole,
        'actorRole',
      );


    return this.db.withTransaction(
      async client => {

        const action =
          await this.repository
            .findByResidentAndPatternForUpdate(
              normalizedResidentId,
              normalizedPatternId,
              client,
            );


        if (!action) {

          throw new Error(
            'Care Action not found.',
          );

        }


        assertCareActionTransition(
          action.status,
          'IN_REVIEW',
        );


        const previousState = {
          status:
            action.status,

          startedAt:
            action.startedAt,

          resolvedAt:
            action.resolvedAt,

          resolutionReason:
            action.resolutionReason,

          careNote:
            action.careNote,

          assignedTo:
            action.assignedTo,

          assignedRole:
            action.assignedRole,
        };


        const updated =
          await this.repository.update(
            action.id,
            {
              status:
                'IN_REVIEW',

              startedAt:
                new Date(),

              resolvedAt:
                null,

              resolutionReason:
                null,

              careNote:
                null,
            },
            client,
          );


        await this.repository.insertAudit(
          {
            careActionId:
              updated.id,

            residentId:
              updated.residentId,

            patternId:
              updated.patternId,

            eventType:
              'REOPENED',

            actorId,
            actorRole,

            previousState,

            newState:
              {
                status:
                  updated.status,

                startedAt:
                  updated.startedAt,

                resolvedAt:
                  updated.resolvedAt,

                resolutionReason:
                  updated.resolutionReason,

                careNote:
                  updated.careNote,

                assignedTo:
                  updated.assignedTo,

                assignedRole:
                  updated.assignedRole,
              },
          },
          client,
        );


        return updated;

      },
    );

  }

}
