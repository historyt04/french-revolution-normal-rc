/* Classroom latency fallbacks. Server verdicts and rewards remain authoritative. */
(function(){'use strict';
 const answerBeforeLatency=answer;
 answer=function(e,m){
  const state=attempts42[m]?.state,fast=state?.v26&&Array.isArray(state?.localQuestions);
  if(!['beginner','intermediate'].includes(m)||!state?.v26||fast)return answerBeforeLatency(e,m);
  e.preventDefault();if(e.isComposing||busy42)return;
  const value=document.querySelector('#ans')?.value||'';if(!value.trim())return;
  pendingAnswer42();
  return run42(async()=>{const out=await api42.request('attempt.answer',payload42(m,{questionId:state.question.id,answer:value}));applyStudentWhenNeeded42(out);applyAttempt42(out);render42()});
 };
})();
