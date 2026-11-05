// Public data only. Never use this cache for sessions, admin rows or submissions.
export function publicCache(load, {ttl=30000, maxAge=86400000, retry=10000, now=Date.now}={}) {
  let value, saved=0, attempted=-Infinity, pending;
  const usable=()=>value!==undefined && now()-saved<maxAge;
  async function refresh() {
    if(pending)return pending;
    if(now()-attempted<retry)throw new Error('Public data temporarily unavailable');
    attempted=now();
    pending=Promise.resolve().then(load).then(result=>{value=result;saved=now();return result;}).finally(()=>{pending=undefined;});
    return pending;
  }
  return {
    async get() {
      if(usable() && now()-saved<ttl)return {value,stale:false};
      try {return {value:await refresh(),stale:false};}
      catch(error) {if(usable())return {value,stale:true};throw error;}
    },
    // Informational pages render immediately; optional editorial data refreshes separately.
    peek() {if(!usable()||now()-saved>=ttl)refresh().catch(()=>{});return usable()?value:undefined;}
  };
}
