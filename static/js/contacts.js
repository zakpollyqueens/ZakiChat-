const modal=document.getElementById("contactModal");
const openBtn=document.getElementById("openAddContact");
const closeBtn=document.getElementById("closeAddContact");
const form=document.getElementById("addContactForm");
const phone=document.getElementById("phoneNumber");
const email=document.getElementById("contactEmail");
const message=document.getElementById("formMessage");
const search=document.getElementById("contactSearch");
const list=document.getElementById("contactList");
const empty=document.getElementById("emptyContacts");

function openModal(){
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
  setTimeout(()=>document.getElementById("contactName").focus(),100);
}

function closeModal(){
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden","true");
  form.reset();
  message.style.display="none";
}

openBtn.addEventListener("click",openModal);
closeBtn.addEventListener("click",closeModal);

modal.addEventListener("click",e=>{
  if(e.target===modal) closeModal();
});

document.addEventListener("keydown",e=>{
  if(e.key==="Escape" && modal.classList.contains("open")) closeModal();
});

form.addEventListener("submit",e=>{
  e.preventDefault();

  const name=document.getElementById("contactName").value.trim();
  const phoneValue=phone.value.trim();
  const emailValue=email.value.trim();

  if(!name || (!phoneValue && !emailValue)){
    message.textContent="Enter a contact name and either a phone number or email.";
    message.style.display="block";
    return;
  }

  message.textContent="Contact form is ready. Database connection will be added in the next step.";
  message.style.display="block";
});

search.addEventListener("input",()=>{
  const query=search.value.toLowerCase().trim();
  const cards=[...list.querySelectorAll(".contact-card")];
  let visible=0;

  cards.forEach(card=>{
    const matches=card.textContent.toLowerCase().includes(query);
    card.style.display=matches?"flex":"none";
    if(matches) visible++;
  });

  empty.style.display=visible?"none":"block";
});
