import { Controller, Get } from '@nestjs/common';
@Controller('api/health')
export class HealthController { @Get() get(){ return {status:'ok',version:'7.3.3',component:'health-trend-ai',aiEnabled:true,killSwitch:false,timestamp:new Date().toISOString()}; } }
