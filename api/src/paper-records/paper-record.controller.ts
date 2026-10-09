import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
} from '@nestjs/common';

import { PaperRecordService } from './paper-record.service';

@Controller('api/paper-records')
export class PaperRecordController {
  constructor(
    private readonly paperRecords: PaperRecordService,
  ) {}

  private actor(actorId?: string, actorRole?: string) {
    return { actorId, actorRole };
  }

  @Get(':residentId')
  get(
    @Param('residentId') residentId: string,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    return this.paperRecords.get(
      residentId,
      this.actor(actorId, actorRole),
    );
  }

  @Get(':residentId/history')
  history(
    @Param('residentId') residentId: string,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    return this.paperRecords.history(
      residentId,
      this.actor(actorId, actorRole),
    );
  }

  @Put(':residentId')
  upsert(
    @Param('residentId') residentId: string,
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
    @Body() body: {
      recordCode?: string;
      cabinet?: string | null;
      drawer?: string | null;
      position?: string | null;
      status?: 'STORED' | 'RETURNED_TO_FAMILY' | 'ARCHIVED';
      documentCatalog?: Array<{
        name: string;
        present: boolean;
        note?: string | null;
      }>;
      lastInventoryAt?: string | null;
    } = {},
  ) {
    return this.paperRecords.upsert(
      residentId,
      this.actor(actorId, actorRole),
      body,
    );
  }

  @Post(':residentId/borrow')
  borrow(
    @Param('residentId') residentId: string,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    return this.paperRecords.borrow(
      residentId,
      this.actor(actorId, actorRole),
    );
  }

  @Post(':residentId/return')
  returnRecord(
    @Param('residentId') residentId: string,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    return this.paperRecords.returnRecord(
      residentId,
      this.actor(actorId, actorRole),
    );
  }
}
