import React, { useState } from 'react';
import { useActor } from '../../auth/ActorContext';

// UI-only draft. No patient data is transmitted, cached, or stored.
// Do not enable persistence until resident-scoped server RBAC and immutable baseline API are verified.
const DASS_ITEMS = [
  ['S','Tôi thấy mình hay bối rối trước những việc chẳng đâu vào đâu'],
  ['A','Tôi hay bị khô miệng'],
  ['D','Tôi dường như chẳng có chút cảm xúc tích cực nào'],
  ['A','Tôi bị rối loạn nhịp thở (thở gấp, khó thở dù chẳng làm việc gì nặng)'],
  ['D','Tôi dường như không thể làm việc như trước được'],
  ['S','Tôi có xu hướng phản ứng thái quá với mọi tình huống'],
  ['A','Tôi có cảm giác bị run (tay, chân...)'],
  ['S','Tôi thấy khó thư giãn được'],
  ['A','Tôi đã rơi vào sự việc khiến tôi rất lo lắng và tôi chỉ dịu lại khi sự việc đó đã qua đi'],
  ['D','Tôi thấy mình chẳng có gì để mong đợi cả'],
  ['S','Tôi khá dễ bị bối rối'],
  ['S','Tôi thấy mình đang suy nghĩ quá nhiều'],
  ['D','Tôi cảm thấy buồn chán, trì trệ'],
  ['S','Tôi thấy mình không thể kiên nhẫn được khi phải chờ đợi'],
  ['A','Tôi thấy mình gần như bị ngất'],
  ['D','Tôi mất hứng thú với mọi việc'],
  ['D','Tôi cảm thấy mình chẳng đáng làm người'],
  ['S','Tôi khá dễ phật ý, tự ái'],
  ['A','Tôi bị đổ mồ hôi dù chẳng vì làm việc nặng hay do trời nóng'],
  ['A','Tôi hay sợ vô cớ'],
  ['D','Tôi thấy cuộc sống không có gì đáng giá cả'],
  ['S','Tôi thấy khó mà thoải mái được'],
  ['A','Tôi thấy khó nuốt'],
  ['D','Tôi dường như chẳng có chút cảm xúc tích cực nào'],
  ['A','Tôi bị rối loạn nhịp thở (thở gấp, khó thở dù chẳng làm việc gì nặng)'],
  ['D','Tôi cảm thấy chán nản, thất vọng'],
  ['S','Tôi dễ cáu kỉnh, bực bội'],
  ['A','Tôi thấy mình gần như hoảng loạn'],
  ['S','Sau khi bị bối rối tôi thấy khó mà trấn tĩnh lại được'],
  ['A','Tôi sợ phải làm những việc tuy bình thường nhưng trước đây tôi chưa từng làm'],
  ['D','Tôi không thấy hào hứng với bất kỳ việc gì nữa'],
  ['S','Tôi thấy khó chấp nhận việc đang làm bị gián đoạn'],
  ['S','Tôi sống trong tình trạng căng thẳng'],
  ['D','Tôi thấy mình khá là vô tích sự'],
  ['S','Tôi không chấp nhận được việc có cái gì đó xen vào cản trở việc tôi đang làm'],
  ['A','Tôi cảm thấy khiếp sợ'],
  ['D','Tôi chẳng thấy có hy vọng gì ở tương lai cả'],
  ['D','Tôi thấy cuộc sống vô nghĩa'],
  ['S','Tôi dễ bị kích động'],
  ['A','Tôi lo lắng về những tình huống có thể làm tôi hoảng sợ hoặc biến tôi thành trò cười'],
  ['A','Tôi bị run'],
  ['D','Tôi thấy khó bắt tay vào công việc'],
] as const;

type OptionGroup = { label: string; options: readonly string[]; multiple?: boolean };
const GROUPS: OptionGroup[] = [
  {label:'Diện mạo & vệ sinh',options:['Sạch sẽ/Gọn gàng','Tuềnh toàng','Kém vệ sinh']},
  {label:'Giao tiếp bằng mắt',options:['Tốt','Tránh né','Đờ đẫn']},
  {label:'Thái độ hợp tác',options:['Cởi mở','Thờ ơ','Chống đối/Phản kháng']},
  {label:'Định hướng (thời gian, không gian, bản thân)',options:['Tốt','Mất định hướng từng phần','Mất định hướng hoàn toàn']},
  {label:'Trí nhớ',options:['Bình thường','Giảm trí nhớ ngắn hạn','Giảm trí nhớ dài hạn'],multiple:true},
  {label:'Khả năng tập trung/Chú ý',options:['Duy trì tốt','Dễ xao nhãng','Rất kém']},
  {label:'Nguy cơ tự hại/Tự sát',options:['Không','Thấp','Cao (cần giám sát 24/7)']},
  {label:'Nguy cơ hung tính/Gây hại người khác',options:['Không','Có']},
  {label:'Nguy cơ đi lạc',options:['Không','Có nguy cơ']},
];
const NOTES = ['Cảm nhận khí sắc','Tâm trạng tự báo cáo','Tiền sử bệnh lý','Sự kiện xáo trộn tâm lý gần đây','Sở thích','Điều dễ gây kích động (Triggers)','Điều giúp xoa dịu (Soothers)','Chi tiết hành vi gây hại nếu có','Phương án xử lý nguy cơ đã thực hiện','Nhận định của bộ phận Tâm lý & Công tác xã hội'];
export function InitialPsychologyBaselineDraft() {
  const { actor } = useActor();
  const allowed = actor?.actorRole === 'PSYCHOLOGIST' || actor?.actorRole === 'SOCIAL_WORKER';
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<Record<string,string[]>>({});
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [answers,setAnswers] = useState<Record<number,number>>({});
  if (!allowed) return null;
  const toggle = (g:OptionGroup,value:string) => setChoices(prev => {
    const old = prev[g.label] || [];
    return {...prev,[g.label]:g.multiple?(old.includes(value)?old.filter(x=>x!==value):[...old,value]):[value]};
  });
  const answered=Object.keys(answers).length;
  const score=(category:'D'|'A'|'S')=>DASS_ITEMS.reduce((sum,[group],i)=>sum+(group===category?(answers[i]??0):0),0);
  return <section className="card" style={{padding:'1rem',marginBottom:'1rem',border:'1px solid #bbf7d0'}}>
    <h2 style={{margin:'0 0 .4rem'}}>🧠 Phiếu đánh giá tâm lý ban đầu</h2>
    <p>Chức năng dành cho Nhân viên Tâm lý và Nhân viên Công tác xã hội. Phiếu ban đầu sẽ là mốc so sánh với từng báo cáo định kỳ và kỳ liền trước.</p>
    <p role="status" style={{color:'#9a3412',fontWeight:700}}>Bản giao diện thử nghiệm — chưa kết nối API và chưa lưu hồ sơ người cao tuổi. Không nhập dữ liệu thật.</p>
    <button type="button" className="btn btn-primary" onClick={()=>setOpen(v=>!v)}>{open?'Đóng phiếu':'Mở phiếu chạm – ghi nhận'}</button>
    {open && <div style={{marginTop:'1rem'}}>
      <h3>I. Đánh giá sơ bộ lâm sàng</h3>
      {GROUPS.slice(0,6).map(group=><fieldset key={group.label} style={{border:'1px solid #e2e8f0',borderRadius:8,margin:'0 0 .65rem',padding:10}}>
        <legend style={{fontWeight:700}}>{group.label}{group.multiple?' (chọn nhiều nếu cần)':''}</legend>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>{group.options.map(option=><button type="button" key={option} aria-pressed={(choices[group.label]||[]).includes(option)} onClick={()=>toggle(group,option)} style={{padding:'10px 14px',borderRadius:10,border:'1px solid #cbd5e1',background:(choices[group.label]||[]).includes(option)?'#bbf7d0':'#fff',minHeight:44}}>{option}</button>)}</div>
      </fieldset>)}
      <h3>II. Lịch sử cá nhân và y tế</h3>
      {NOTES.slice(0,7).map(label=><label key={label} style={{display:'block',marginBottom:12,fontWeight:600}}>{label}<textarea className="form-input" style={{display:'block',width:'100%',marginTop:4}} rows={2} value={notes[label]||''} onChange={e=>setNotes(old=>({...old,[label]:e.target.value}))}/></label>)}
      <h3>III. Đánh giá nguy cơ và quản lý khủng hoảng</h3>
      {GROUPS.slice(6).map(group=><fieldset key={group.label} style={{border:'1px solid #e2e8f0',marginBottom:12,padding:10,borderRadius:8}}><legend style={{fontWeight:700}}>{group.label}</legend><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{group.options.map(option=><button key={option} type="button" aria-pressed={(choices[group.label]||[]).includes(option)} onClick={()=>toggle(group,option)} style={{minHeight:44,padding:12,background:(choices[group.label]||[]).includes(option)?'#bbf7d0':'#fff',border:'1px solid #cbd5e1',borderRadius:8}}>{option}</button>)}</div></fieldset>)}
      {NOTES.slice(7).map(label=><label key={label} style={{display:'block',marginBottom:12,fontWeight:600}}>{label}<textarea className="form-input" style={{display:'block',width:'100%',marginTop:4}} rows={3} value={notes[label]||''} onChange={e=>setNotes(old=>({...old,[label]:e.target.value}))}/></label>)}
      <h3>IV. Thang đánh giá Lo âu – Trầm cảm – Stress (DASS-42)</h3>
      <p>Chọn một mức cho mỗi câu: 0 Không đúng; 1 Thỉnh thoảng; 2 Phần lớn thời gian; 3 Hầu hết thời gian.</p>
      <p>Đã trả lời: <b>{answered}/42</b>. {answered===42?`Trầm cảm: ${score('D')} · Lo âu: ${score('A')} · Stress: ${score('S')}`:'Chưa hoàn thành — chưa tính kết quả chính thức.'}</p>
      {DASS_ITEMS.map(([category,question],index)=><fieldset key={index} style={{padding:10,marginBottom:10,border:'1px solid #e2e8f0',borderRadius:8}}>
        <legend>{index+1}. {question}</legend><div style={{display:'flex',gap:8}}>{[0,1,2,3].map(value=><button key={value} type="button" aria-label={`Câu ${index+1}, mức ${value}`} aria-pressed={answers[index]===value} onClick={()=>setAnswers(old=>({...old,[index]:value}))} style={{flex:1,minHeight:44,border:'1px solid #cbd5e1',borderRadius:8,background:answers[index]===value?'#bbf7d0':'#fff'}}>{value}</button>)}</div>
        <span style={{display:'none'}}>{category}</span>
      </fieldset>)}
      <p style={{fontSize:13,color:'#64748b'}}>DASS-42 là công cụ sàng lọc, không phải chẩn đoán. Mọi thông tin chỉ giữ tạm trong bộ nhớ giao diện cho đến khi đóng hoặc tải lại trang.</p>
    </div>}
  </section>;
}
