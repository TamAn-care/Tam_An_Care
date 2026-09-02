import { BadRequestException,Body,Controller,Get,Headers,Param,Post,Query } from '@nestjs/common';
import { AccommodationService } from './accommodation.service';
@Controller('api/accommodation')
export class AccommodationController {
  constructor(private readonly s:AccommodationService){}
  private a(id?:string,role?:string){return{actorId:String(id??'').trim(),actorRole:String(role??'').trim().toUpperCase()};}
  private rb(b:any){if(b&&(b.actorId!==undefined||b.actorRole!==undefined||b.assignedBy!==undefined||b.endedBy!==undefined))throw new BadRequestException('Actor identity must come from authenticated request context');}
  @Get('overview') overview(@Headers('x-actor-id')i?:string,@Headers('x-actor-role')r?:string){return this.s.overview(this.a(i,r));}
  @Get('buildings') buildings(@Headers('x-actor-id')i?:string,@Headers('x-actor-role')r?:string){return this.s.listBuildings(this.a(i,r));}
  @Post('buildings') building(@Headers('x-actor-id')i?:string,@Headers('x-actor-role')r?:string,@Body()b?:any){this.rb(b);return this.s.createBuilding(this.a(i,r),b);}
  @Get('floors') floors(@Headers('x-actor-id')i?:string,@Headers('x-actor-role')r?:string,@Query('buildingId')x?:string){return this.s.listFloors(this.a(i,r),x);}
  @Post('floors') floor(@Headers('x-actor-id')i?:string,@Headers('x-actor-role')r?:string,@Body()b?:any){this.rb(b);return this.s.createFloor(this.a(i,r),b);}
  @Get('rooms') rooms(@Headers('x-actor-id')i?:string,@Headers('x-actor-role')r?:string,@Query('floorId')f?:string,@Query('limit')l?:string,@Query('offset')o?:string){return this.s.listRooms(this.a(i,r),f,l,o);}
  @Post('rooms') room(@Headers('x-actor-id')i?:string,@Headers('x-actor-role')r?:string,@Body()b?:any){this.rb(b);return this.s.createRoom(this.a(i,r),b);}
  @Get('beds') beds(@Headers('x-actor-id')i?:string,@Headers('x-actor-role')r?:string,@Query('roomId')x?:string,@Query('status')s?:string,@Query('limit')l?:string,@Query('offset')o?:string){return this.s.listBeds(this.a(i,r),x,s,l,o);}
  @Post('beds') bed(@Headers('x-actor-id')i?:string,@Headers('x-actor-role')r?:string,@Body()b?:any){this.rb(b);return this.s.createBed(this.a(i,r),b);}
  @Post('beds/:bedId/assign') assign(@Headers('x-actor-id')i?:string,@Headers('x-actor-role')r?:string,@Param('bedId')x?:string,@Body()b?:any){this.rb(b);return this.s.assign(this.a(i,r),x,b?.residentId);}
  @Post('residents/:residentId/transfer') transfer(@Headers('x-actor-id')i?:string,@Headers('x-actor-role')r?:string,@Param('residentId')x?:string,@Body()b?:any){this.rb(b);return this.s.transfer(this.a(i,r),x,b?.bedId);}
  @Post('residents/:residentId/release') release(@Headers('x-actor-id')i?:string,@Headers('x-actor-role')r?:string,@Param('residentId')x?:string,@Body()b?:any){this.rb(b);return this.s.release(this.a(i,r),x,b?.reason);}
  @Get('residents/:residentId/history') history(@Headers('x-actor-id')i?:string,@Headers('x-actor-role')r?:string,@Param('residentId')x?:string,@Query('limit')l?:string,@Query('offset')o?:string){return this.s.history(this.a(i,r),x,l,o);}
}
