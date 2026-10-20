import { Body, Controller, ForbiddenException, Param, Post, Req } from '@nestjs/common';
import { readVerifiedFinanceIdentity } from '../security/verified-finance-identity';
import { GeneralFinanceWorkflowService } from './general-finance-workflow.service';

@Controller('api/finance-workflows')
export class GeneralFinanceWorkflowController {
  constructor(private readonly workflows:GeneralFinanceWorkflowService){}
  private identity(req:object){const value=readVerifiedFinanceIdentity(req);if(!value)throw new ForbiddenException('FINANCE_VERIFIED_IDENTITY_REQUIRED');return value;}
  @Post('invoices/drafts') createInvoice(@Req() req:object,@Body() body:Record<string,unknown>){return this.workflows.createInvoice(this.identity(req),body);}
  @Post('invoices/:invoiceId/review') review(@Req() req:object,@Param('invoiceId') id:string,@Body() body:{reason:string}){return this.workflows.transitionInvoice(this.identity(req),id,'REVIEW',body?.reason||'');}
  @Post('invoices/:invoiceId/approve') approve(@Req() req:object,@Param('invoiceId') id:string,@Body() body:{reason:string}){return this.workflows.transitionInvoice(this.identity(req),id,'APPROVE',body?.reason||'');}
  @Post('invoices/:invoiceId/issue') issue(@Req() req:object,@Param('invoiceId') id:string,@Body() body:{reason:string}){return this.workflows.transitionInvoice(this.identity(req),id,'ISSUE',body?.reason||'');}
  @Post('receipts') createReceipt(@Req() req:object,@Body() body:Record<string,unknown>){return this.workflows.createReceipt(this.identity(req),body);}
  @Post('receipts/:receiptId/verify') verifyReceipt(@Req() req:object,@Param('receiptId') id:string,@Body() body:{reason:string}){return this.workflows.verifyReceipt(this.identity(req),id,body?.reason||'');}
  @Post('invoices/:invoiceId/post-ledger') postLedger(@Req() req:object,@Param('invoiceId') id:string,@Body() body:{reason:string}){return this.workflows.postInvoiceLedger(this.identity(req),id,body?.reason||'');}
  @Post('periods/:period/close') close(@Req() req:object,@Param('period') period:string,@Body() body:{reason:string}){return this.workflows.closePeriod(this.identity(req),period,body?.reason||'');}
  @Post('periods/:period/reopen') reopen(@Req() req:object,@Param('period') period:string,@Body() body:{reason:string}){return this.workflows.closePeriod(this.identity(req),period,body?.reason||'',true);}
}
