/** Format only; server owns durable, globally non-reusable serial allocation. */
export interface ResidentRecordIdentity {
  /** Exact issued contract-style serial, including any leading zeroes. */
  serial: string;
  /** Four-digit year frozen at first allocation. */
  issueYear: number;
  /** True only while no service contract is linked. */
  isTrialWithoutContract: boolean;
}
export function formatResidentRecordCode(identity: ResidentRecordIdentity): string {
  const {serial,issueYear,isTrialWithoutContract}=identity;
  if (!/^[0-9]*[1-9][0-9]*$/.test(serial)) throw new Error('Invalid serial');
  if (!Number.isInteger(issueYear)||issueYear<1900||issueYear>9999) throw new Error('Invalid issue year');
  return `${serial}/${issueYear}/TA${isTrialWithoutContract ? '/TN' : ''}`;
}
export function parseContractSerialAndYear(contractCode: string): {serial:string;issueYear:number}|null {
  const m=/^([0-9]+)\/([0-9]{4})\/HĐDV-TA$/.exec(contractCode.trim());
  if(!m||!/^[0-9]*[1-9][0-9]*$/.test(m[1]))return null;
  const year=Number(m[2]);
  return year>=1900?{serial:m[1],issueYear:year}:null;
}
export function verifyContractMatchesResidentRecord(contractCode:string,identity:Pick<ResidentRecordIdentity,'serial'|'issueYear'>):boolean {
  const c=parseContractSerialAndYear(contractCode);
  return !!c&&BigInt(c.serial)===BigInt(identity.serial)&&c.issueYear===identity.issueYear;
}
