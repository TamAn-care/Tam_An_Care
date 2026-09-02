import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { InventoryItemService } from './inventory-item.service';
import { InventoryLotService } from './inventory-lot.service';
import { InventoryTransactionService } from './inventory-transaction.service';

@Controller('api/inventory')
export class InventoryController {
  constructor(
    private readonly items: InventoryItemService,
    private readonly lots: InventoryLotService,
    private readonly transactions: InventoryTransactionService,
  ) {}

  @Get('items')
  listItems(
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
    @Query() query: any,
  ) {
    return this.items.list(actorId, actorRole, query);
  }

  @Get('items/:inventoryItemId/balance')
  balance(
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
    @Param('inventoryItemId') inventoryItemId: string,
    @Query() query: any,
  ) {
    return this.transactions.readBalance(
      actorId,
      actorRole,
      inventoryItemId,
      query,
    );
  }

  @Get('items/:inventoryItemId')
  itemDetail(
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
    @Param('inventoryItemId') inventoryItemId: string,
  ) {
    return this.items.detail(
      actorId,
      actorRole,
      inventoryItemId,
    );
  }

  @Post('items')
  createItem(
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
    @Body() body: any,
  ) {
    return this.items.create(actorId, actorRole, body);
  }

  @Patch('items/:inventoryItemId')
  updateItem(
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
    @Param('inventoryItemId') inventoryItemId: string,
    @Body() body: any,
  ) {
    return this.items.update(
      actorId,
      actorRole,
      inventoryItemId,
      body,
    );
  }

  @Get('lots')
  listLots(
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
    @Query() query: any,
  ) {
    return this.lots.list(actorId, actorRole, query);
  }

  @Get('lots/:inventoryLotId')
  lotDetail(
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
    @Param('inventoryLotId') inventoryLotId: string,
  ) {
    return this.lots.detail(
      actorId,
      actorRole,
      inventoryLotId,
    );
  }

  @Post('lots')
  createLot(
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
    @Body() body: any,
  ) {
    return this.lots.create(actorId, actorRole, body);
  }

  @Patch('lots/:inventoryLotId')
  updateLot(
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
    @Param('inventoryLotId') inventoryLotId: string,
    @Body() body: any,
  ) {
    return this.lots.update(
      actorId,
      actorRole,
      inventoryLotId,
      body,
    );
  }

  @Get('transactions')
  listTransactions(
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
    @Query() query: any,
  ) {
    return this.transactions.list(
      actorId,
      actorRole,
      query,
    );
  }

  @Get('transactions/:inventoryTransactionId')
  transactionDetail(
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
    @Param('inventoryTransactionId')
    inventoryTransactionId: string,
  ) {
    return this.transactions.detail(
      actorId,
      actorRole,
      inventoryTransactionId,
    );
  }

  @Post('transactions')
  createTransaction(
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
    @Body() body: any,
  ) {
    return this.transactions.create(
      actorId,
      actorRole,
      body,
    );
  }
}
