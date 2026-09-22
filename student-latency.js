/* Classroom latency fallbacks. Server verdicts and rewards remain authoritative. */
(function(){'use strict';
 const answerBeforeLatency=answer;
 answer=function(e,m){
  const fast=attempts42[m]?.state?.v26&&Array.isArray(attempts42[m]?.state?.localQuestions);
  if(['beginner','intermediate'].includes(m)&&!fast&&!busy42)pendingAnswer42();
  return answerBeforeLatency(e,m);
 };
})();
