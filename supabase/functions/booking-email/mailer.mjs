// Provider-independent message: plain text keeps visitor input inert.
export function messageFor(job) {
 return {from:job.sender,to:[job.recipient],subject:'Новая заявка на проверку зрения — Имидж Оптика',
 text:`Новая заявка на проверку зрения\n\nИмя: ${job.customer_name}\nТелефон: ${job.customer_phone}\nДата: ${job.booking_created_at}\nНомер заявки: ${job.booking_id}\n\nЗаявка также сохранена в панели администратора. Свяжитесь с клиентом, чтобы согласовать время.`};
}
export async function sendNotification(job,{apiKey,fetcher=fetch}) {
 let response;
 try { response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`optika-booking/${job.booking_id}`},body:JSON.stringify(messageFor(job)),signal:AbortSignal.timeout(15000)}); }
 catch { throw new Error('Почтовый сервис не ответил. Повтор запланирован.'); }
 const data=await response.json().catch(()=>null);
 if(!response.ok||typeof data?.id!=='string')throw new Error(`Почтовый сервис не принял письмо (HTTP ${response.status}). Проверьте настройки отправителя.`);
 return data.id;
}
