(function(){
"use strict";
/* ZakiPlay is available to every signed-in ZakiChat account type. */
document.querySelectorAll(".tg-zakiplay-launch").forEach(function(link){
 const lock=link.querySelector(".zplay-lock-badge");
 if(lock)lock.remove();
 link.classList.add("is-unlocked");
 link.setAttribute("aria-label","Open ZakiPlay entertainment hub");
 link.title="ZakiPlay · Available to all accounts";
});
})();