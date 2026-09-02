import { Injectable, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class AiGatewayService {
  private readonly enabled = true;
  private readonly killSwitch = false;
  execute(input:any, analysis:any){
    if(!this.enabled || this.killSwitch) throw new ForbiddenException('AI Gateway disabled');
    const riskClass = input.riskClass;
    return {
      requestId: randomUUID(), engineId: input.engineId,
      model:{provider:'internal-rules',modelId:'rules-engine',version:'7.3.3'},
      riskClass,
      dataPolicy:{inputMinimized:true,redactionApplied:true},
      result:{status:'ANALYSIS_COMPLETE',engine:input.engineId,analysis},
      evidence:[], confidence:analysis?.confidence ?? null,
      uncertainty:{reason:'Rules-based V7.3.3; no production ML model connected'},
      humanReviewRequired:riskClass==='B', humanReviewStatus:riskClass==='B'?'PENDING':'NOT_REQUIRED',
      autonomousClinicalAction:false, audit:{required:true}, generatedAt:new Date().toISOString()
    };
  }
  governance(){return {status:'ok',version:'7.3.3',component:'ai-gateway-governance',aiEnabled:this.enabled,killSwitch:this.killSwitch,timestamp:new Date().toISOString()};}
}
