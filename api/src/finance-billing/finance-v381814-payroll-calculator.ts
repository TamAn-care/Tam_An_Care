/**
 * Finance V3.8.18.14 — integer-VND agreed payroll breakdown, pure only.
 * Salary is manually agreed; shifts are not a required input.
 * No DB writes, approvals, endpoints, or automatic ledger posting.
 */
export type PayrollBreakdown={
 baseAgreedVnd:string;allowancesVnd:string;bonusesVnd:string;
 deductionsVnd:string;employerCostVnd:string;
};
export type PayrollTotals={ok:boolean;errors:string[];grossVnd:string|null;
 netPayableVnd:string|null;employerTotalExpenseVnd:string|null;postingEnabled:false};
const valid=/^(0|[1-9]\d*)$/;
const MAX=9999999999999999n;
export function calculateAgreedPayroll(x:PayrollBreakdown):PayrollTotals{
 const errors:string[]=[];
 if(!x||typeof x!=='object')return{ok:false,errors:['PAYROLL_MISSING'],grossVnd:null,netPayableVnd:null,employerTotalExpenseVnd:null,postingEnabled:false};
 const keys=['baseAgreedVnd','allowancesVnd','bonusesVnd','deductionsVnd','employerCostVnd'] as const;
 for(const k of keys)if(typeof x[k]!=='string'||!valid.test(x[k])||BigInt(valid.test(x[k]||'')?x[k]:'0')>MAX)errors.push('INVALID_'+k);
 if(errors.length)return{ok:false,errors,grossVnd:null,netPayableVnd:null,employerTotalExpenseVnd:null,postingEnabled:false};
 const gross=BigInt(x.baseAgreedVnd)+BigInt(x.allowancesVnd)+BigInt(x.bonusesVnd);
 const deductions=BigInt(x.deductionsVnd);
 const employerCost=BigInt(x.employerCostVnd);
 if(deductions>gross)errors.push('DEDUCTIONS_EXCEED_GROSS');
 if(gross>MAX||gross+employerCost>MAX)errors.push('AMOUNT_OVERFLOW');
 return errors.length?{ok:false,errors,grossVnd:null,netPayableVnd:null,employerTotalExpenseVnd:null,postingEnabled:false}:
 {ok:true,errors:[],grossVnd:gross.toString(),netPayableVnd:(gross-deductions).toString(),
 employerTotalExpenseVnd:(gross+employerCost).toString(),postingEnabled:false};
}
