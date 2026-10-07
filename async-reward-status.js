/* Local candidate for the post-completion reward status UI. The production
 * client never starts this controller until an authenticated completion
 * response explicitly carries an opaque reward job id. */
(function(root){'use strict';
 const initialDelayMs=250,maximumDelayMs=60000,manualCooldownMs=3000,maxAutomaticChecks=6;
 function create({readStatus,onChange,clock=()=>Date.now(),random=Math.random,
   schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id),visible=()=>true}){
  if(typeof readStatus!=='function'||typeof onChange!=='function')throw Error('REWARD_STATUS_CONFIG');
  let owner='',job='',state='idle',settledReward=null,settlement=null,attempts=0,timer=null,flight=null,nextAt=0,
    lastManualAt=-Infinity,stopped=false;
  const notify=()=>onChange({state,result:settledReward,settlement,attempts,nextAt});
  const clear=()=>{if(timer!==null)cancel(timer);timer=null};
  // Check a newly settled reward promptly. Longer jobs retain exponential
  // backoff, the same request cap, and one in-flight status read per student.
  const delay=()=>Math.min(maximumDelayMs,attempts===1?500:1500*2**Math.min(attempts-1,6))
    *(.8+.4*Math.max(0,Math.min(1,random())));
  const arm=ms=>{clear();if(stopped||!job||state==='done'||state==='dead')return;
    nextAt=clock()+ms;timer=schedule(()=>{timer=null;return poll()},ms);notify()};
  async function poll(){
   if(stopped||!job||flight)return flight;
   if(!visible()){nextAt=0;return;}
   if(attempts>=maxAutomaticChecks){state='waiting';nextAt=0;notify();return;}
   const expectedOwner=owner,expectedJob=job;
   flight=(async()=>{
    try{
     const result=await readStatus(expectedJob);
     if(stopped||owner!==expectedOwner||job!==expectedJob)return;
     if(result?.status==='done'||result?.status==='dead'){
      state=result.status;settledReward=result?.reward||null;
      settlement=state==='done'?{
       ...(Object.hasOwn(result,'xp')?{xp:result.xp}:{}),
       ...(Object.hasOwn(result,'study')?{study:result.study}:{})}:null;
      clear();nextAt=0;notify();return;
     }
     if(!['pending','processing','retry'].includes(result?.status))
      throw Error('REWARD_STATUS_INVALID');
     state='pending';attempts++;arm(delay());
    }catch{
     if(stopped||owner!==expectedOwner||job!==expectedJob)return;
     state='pending';attempts++;arm(delay());
    }finally{flight=null;}
   })();
   return flight;
  }
  return{
   begin(scope,opaqueJob){
    if(typeof scope!=='string'||!scope||typeof opaqueJob!=='string'||
       !/^[A-Za-z0-9_-]{12,100}$/.test(opaqueJob))throw Error('REWARD_STATUS_SCOPE');
    if(scope===owner&&opaqueJob===job)return;
    clear();owner=scope;job=opaqueJob;state='pending';settledReward=null;settlement=null;attempts=0;lastManualAt=-Infinity;stopped=false;
    arm(initialDelayMs);
   },
   retry(){if(stopped||!job||flight||state==='done'||clock()-lastManualAt<manualCooldownMs)return false;
    lastManualAt=clock();attempts=0;state='pending';arm(manualCooldownMs);return true;},
   resume(){if(!stopped&&job&&state==='pending'&&timer===null)arm(initialDelayMs);},
   stop(){clear();owner='';job='';state='idle';settledReward=null;settlement=null;attempts=0;nextAt=0;stopped=true;notify();},
   snapshot(){return {state,result:settledReward,settlement,attempts,nextAt};}
  };
 }
 root.HistoryAsyncRewardStatus={create};
})(typeof window!=='undefined'?window:globalThis);
