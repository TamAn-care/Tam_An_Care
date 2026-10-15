import { apiRequest } from './client';
import type { HumanActorSession } from '../types/actor';

export type MealType = 'BREAKFAST'|'MORNING_SNACK'|'LUNCH'|'AFTERNOON_SNACK'|'DINNER'|'EVENING_SNACK';
export type MealRegistration = {
  registration_id: string;
  resident_id: string;
  meal_date: string;
  meal_type: MealType;
  portions: number;
  note: string;
  status: 'REGISTERED'|'CANCELLED';
  revision: number;
};
export const listResidentMeals=(actor:HumanActorSession,date:string,mealType?:MealType)=>
  apiRequest<{items:MealRegistration[]}>(`/api/resident-meal-registrations?date=${encodeURIComponent(date)}${mealType?'&mealType='+encodeURIComponent(mealType):''}`,{actor});
export const getResidentMealTotals=(actor:HumanActorSession,date:string)=>
  apiRequest<{items:{meal_type:MealType;residents:number;portions:number}[]}>(`/api/resident-meal-registrations/totals?date=${encodeURIComponent(date)}`,{actor});
export const registerResidentMeal=(actor:HumanActorSession,input:{residentId:string;mealDate:string;mealType:MealType;portions:number;note?:string})=>
  apiRequest<MealRegistration>('/api/resident-meal-registrations',{actor,method:'POST',body:JSON.stringify(input)});
export const updateResidentMeal=(actor:HumanActorSession,id:string,input:{portions:number;note?:string;revision:number})=>
  apiRequest<MealRegistration>(`/api/resident-meal-registrations/${encodeURIComponent(id)}`,{actor,method:'PATCH',body:JSON.stringify(input)});
export const cancelResidentMeal=(actor:HumanActorSession,id:string,revision:number)=>
  apiRequest<MealRegistration>(`/api/resident-meal-registrations/${encodeURIComponent(id)}/cancel`,{actor,method:'POST',body:JSON.stringify({revision})});
