import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AiEngineService } from './ai-engine.service';
import { AiGatewayService } from './ai-gateway.service';

@Controller('api/ai/engines')
export class AiEngineController {
  constructor(private readonly engines:AiEngineService, private readonly gateway:AiGatewayService){}
  @Get() list(){return this.engines.list();}
  @Get('demo-data/:engineId') demoData(@Param('engineId') id:string){return this.engines.demoData(id);}
  @Post(':engineId/analyze') analyze(@Param('engineId') id:string,@Body() body:any){const meta=this.engines.meta(id); const analysis=this.engines.analyze(id,body.data||{}); return this.gateway.execute({userId:body.userId,engineId:id,riskClass:meta.riskClass,subjectType:body.subjectType||'resident',subjectId:body.subjectId||'demo-resident-001',input:body.data||{}},analysis);}
  @Post(':engineId/demo') demo(@Param('engineId') id:string,@Body() body:any){const meta=this.engines.meta(id); const data=this.engines.demoData(id); const analysis=this.engines.analyze(id,data); return this.gateway.execute({userId:body.userId,engineId:id,riskClass:meta.riskClass,subjectType:body.subjectType||'resident',subjectId:body.subjectId||'demo-resident-001',input:data},analysis);}
}
