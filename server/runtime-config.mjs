// Public, non-secret runtime flags. The existing browser configuration stays intact.
export function publicRuntimeConfiguration(env=process.env,{staging=env.STAGING!=='false'}={}){
 let origin=null;
 try{
  const value=new URL(env.APP_ORIGIN||'');
  const local=['localhost','127.0.0.1','[::1]'].includes(value.hostname);
  if(!value.username&&!value.password&&value.pathname==='/'&&!value.search&&!value.hash&&(value.protocol==='https:'||(value.protocol==='http:'&&local)))origin=value.origin;
 }catch{}
 return Object.freeze({serviceBookings:env.SERVICE_BOOKINGS_ENABLED==='true'&&!!origin,
  analyticsMode:env.METRIKA_ENABLED==='true'&&!staging&&origin==='https://optikim.ru'?'production':'disabled'});
}
export function runtimeConfigurationScript(original,env=process.env,options={}){
 const settings=publicRuntimeConfiguration(env,options);
 return original+'\n// Additive public feature flags; no credentials or private environment values.\n'+
  `window.OPTIKA_CONFIG=Object.freeze({...window.OPTIKA_CONFIG,serviceBookings:${settings.serviceBookings}});\n`+
  `window.OPTIKA_ANALYTICS=Object.freeze({mode:${JSON.stringify(settings.analyticsMode)}});\n`;
}
export function metrikaCspSources(env=process.env,options={}){
 const enabled=publicRuntimeConfiguration(env,options).analyticsMode==='production';
 return {script:enabled?' https://mc.yandex.ru https://mc.yandex.com https://yastatic.net':'',
  connect:enabled?' https://mc.yandex.ru https://mc.yandex.com':''};
}
