import { Controller, Get } from '@nestjs/common';
import { AiGatewayService } from './ai-gateway.service';
@Controller('api/ai/governance')
export class AiGovernanceController { constructor(private readonly gateway:AiGatewayService){} @Get('status') status(){return this.gateway.governance();} @Get('risk-classes') risk(){return [{riskClass:'A',humanReviewRequired:false,autonomousClinicalAction:false},{riskClass:'B',humanReviewRequired:true,autonomousClinicalAction:false}];} @Get('policies') policies(){return {inputMinimized:true,redactionApplied:true,humanReviewForRiskClassB:true,autonomousClinicalAction:false,auditRequired:true,productionModelConnected:false};} }
