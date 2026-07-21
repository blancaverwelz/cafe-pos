let menu={categories:[]};
let activeCat=null;
let searchQuery='';
let order=[];
let discountType='percent';
let discountValue=0;
let paymentMethod='cash';
let cashTendered=0;
let orderCounter=parseInt(localStorage.getItem('cafePosOrderCounter')||'0',10);
let toastTimer;

const $=id=>document.getElementById(id);
const escAttr=s=>String(s).replace(/'/g,"\\'");
const escHtml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function saveState(){
  localStorage.setItem('cafePosCart',JSON.stringify(order));
  localStorage.setItem('cafePosDiscount',JSON.stringify({type:discountType,value:discountValue}));
  localStorage.setItem('cafePosPayment',JSON.stringify({method:paymentMethod,cash:cashTendered}));
}
function loadState(){
  try{
    const c=JSON.parse(localStorage.getItem('cafePosCart')||'[]');
    if(Array.isArray(c))order=c;
    const d=JSON.parse(localStorage.getItem('cafePosDiscount')||'null');
    if(d){discountType=d.type;discountValue=d.value;}
    const p=JSON.parse(localStorage.getItem('cafePosPayment')||'null');
    if(p){paymentMethod=p.method;cashTendered=p.cash||0;}
  }catch(e){}
}

async function init(){
  loadState();
  try{
    const res=await fetch('menu.json');
    menu=await res.json();
  }catch(e){
    $('menu').innerHTML='<div class="empty"><i class="ti ti-alert-triangle" aria-hidden="true"></i>Could not load menu.json</div>';
    return;
  }
  activeCat=menu.categories[0]?.name||null;
  renderCats();
  renderMenu();
  renderOrder();
  $('discountType').value=discountType;
  $('discountValue').value=discountValue;
  if(cashTendered) $('cashInput').value=cashTendered;
  setPaymentMethod(paymentMethod,true);
  updateOrderNoDisplay();
}

function catByName(name){return menu.categories.find(c=>c.name===name);}

function renderCats(){
  $('cats').innerHTML=menu.categories.map(c=>`
    <button class="cat${c.name===activeCat?' on':''}" onclick="switchCat('${escAttr(c.name)}')">
      <i class="ti ${c.icon}" aria-hidden="true"></i>${escHtml(c.name)}
    </button>`).join('');
}
function switchCat(name){
  activeCat=name;
  searchQuery='';
  $('search').value='';
  renderCats();
  renderMenu();
}
function onSearch(v){searchQuery=v;renderMenu();}

function renderMenu(){
  const cat=catByName(activeCat);
  const el=$('menu');
  if(!cat){el.innerHTML='';return;}
  const q=searchQuery.trim().toLowerCase();
  const items=q?cat.items.filter(i=>i.name.toLowerCase().includes(q)):cat.items;
  if(!items.length){
    el.innerHTML=`<div class="empty"><i class="ti ti-search-off" aria-hidden="true"></i>No items match "${escHtml(searchQuery)}".</div>`;
    return;
  }
  el.innerHTML=items.map(item=>`
    <div class="icard">
      <div class="iicon"><i class="ti ${cat.icon}" aria-hidden="true"></i></div>
      <div class="iinfo">
        <div class="iname">${escHtml(item.name)}</div>
        <div class="sizes">${Object.entries(item.sizes).map(([sz,pr])=>
          `<button class="sz" onclick="addItem('${escAttr(item.name)}','${escAttr(sz)}',${pr},this)">${escHtml(sz)} ₱${pr}</button>`
        ).join('')}</div>
      </div>
    </div>`).join('');
}

function addItem(name,size,price,btn){
  const key=name+'|'+size;
  const ex=order.find(o=>o.key===key);
  if(ex)ex.qty++;else order.push({key,name,size,price,qty:1,note:''});
  if(btn){btn.classList.add('pop');setTimeout(()=>btn.classList.remove('pop'),220);}
  saveState();
  renderOrder();
}
function changeQty(key,d){
  const i=order.findIndex(o=>o.key===key);
  if(i<0)return;
  order[i].qty+=d;
  if(order[i].qty<=0)order.splice(i,1);
  saveState();
  renderOrder();
}
function voidItem(key){
  const i=order.findIndex(o=>o.key===key);
  if(i<0)return;
  const name=order[i].name;
  order.splice(i,1);
  saveState();
  renderOrder();
  showToast('Voided '+name);
}
function clearAll(){
  if(!order.length)return;
  order=[];
  discountValue=0;
  $('discountValue').value=0;
  saveState();
  renderOrder();
}
function toggleNote(key){
  const row=document.querySelector(`.orow[data-key="${cssEsc(key)}"]`);
  if(!row)return;
  row.classList.toggle('noteOpen');
  const input=row.querySelector('.noteInput');
  if(row.classList.contains('noteOpen')&&input)input.focus();
}
function cssEsc(s){return s.replace(/(["\\])/g,'\\$1');}
function saveNote(key,val){
  const i=order.findIndex(o=>o.key===key);
  if(i<0)return;
  order[i].note=val.slice(0,60);
  saveState();
  renderOrder();
}

function renderOrder(){
  const el=$('olist');
  if(!order.length){
    el.innerHTML=`<div class="empty"><i class="ti ti-basket" aria-hidden="true"></i>No items yet.<br>Tap a size to add.</div>`;
  }else{
    el.innerHTML=order.map(o=>`
      <div class="orow${o.note?' hasNote':''}" data-key="${escAttr(o.key)}">
        <div class="ormain">
          <div class="oname">${escHtml(o.name)}<span class="osize">${escHtml(o.size)}</span></div>
          <div class="qc">
            <button class="qb" aria-label="Decrease quantity" onclick="changeQty('${escAttr(o.key)}',-1)">−</button>
            <span class="qn">${o.qty}</span>
            <button class="qb" aria-label="Increase quantity" onclick="changeQty('${escAttr(o.key)}',1)">+</button>
          </div>
          <span class="op">₱${(o.price*o.qty).toFixed(2)}</span>
          <button class="iconbtn" aria-label="Add note" onclick="toggleNote('${escAttr(o.key)}')"><i class="ti ti-note" aria-hidden="true"></i></button>
          <button class="iconbtn void" aria-label="Void item" onclick="voidItem('${escAttr(o.key)}')"><i class="ti ti-trash" aria-hidden="true"></i></button>
        </div>
        <div class="noteRow">
          <input class="noteInput" type="text" placeholder="Order note, e.g. less sugar" maxlength="60" value="${escHtml(o.note||'')}" onchange="saveNote('${escAttr(o.key)}',this.value)">
        </div>
      </div>`).join('');
  }
  renderTotals();
}

function computeTotals(){
  const subtotal=order.reduce((s,o)=>s+o.price*o.qty,0);
  let discountAmount=0;
  if(discountValue>0){
    discountAmount=discountType==='percent'?subtotal*(discountValue/100):Math.min(discountValue,subtotal);
  }
  const taxable=Math.max(0,subtotal-discountAmount);
  const tax=taxable*0.12;
  const total=taxable+tax;
  return{subtotal,discountAmount,taxable,tax,total};
}
function renderTotals(){
  const{subtotal,discountAmount,tax,total}=computeTotals();
  $('sub').textContent='₱'+subtotal.toFixed(2);
  $('discRow').style.display=discountAmount>0?'flex':'none';
  $('disc').textContent='−₱'+discountAmount.toFixed(2);
  $('tax').textContent='₱'+tax.toFixed(2);
  $('tot').textContent='₱'+total.toFixed(2);
  updateChange();
  $('pay').disabled=!order.length||(paymentMethod==='cash'&&cashTendered<total);
  updateSheetSummary();
}

function setDiscountType(v){discountType=v;discountValue=parseFloat($('discountValue').value)||0;saveState();renderTotals();}
function setDiscountValue(v){discountValue=Math.max(0,parseFloat(v)||0);saveState();renderTotals();}

function setPaymentMethod(m,silent){
  paymentMethod=m;
  $('payCash').classList.toggle('on',m==='cash');
  $('payCard').classList.toggle('on',m==='card');
  $('cashPanel').style.display=m==='cash'?'block':'none';
  if(!silent)saveState();
  renderTotals();
}
function updateCash(v){
  cashTendered=Math.max(0,parseFloat(v)||0);
  saveState();
  renderTotals();
}
function updateChange(){
  const{total}=computeTotals();
  const change=cashTendered-total;
  $('changeOut').textContent='₱'+Math.max(0,change).toFixed(2);
  $('changeRow').classList.toggle('short',paymentMethod==='cash'&&cashTendered>0&&change<0);
}

function openPreview(){
  if(!order.length)return;
  const{subtotal,discountAmount,tax,total}=computeTotals();
  $('prevLines').innerHTML=order.map(o=>`
    <div class="prevline">
      <span>${o.qty}× ${escHtml(o.name)} <span class="prevSize">${escHtml(o.size)}</span>${o.note?`<span class="prevNote">${escHtml(o.note)}</span>`:''}</span>
      <span>₱${(o.price*o.qty).toFixed(2)}</span>
    </div>`).join('');
  $('prevSub').textContent='₱'+subtotal.toFixed(2);
  $('prevDiscRow').style.display=discountAmount>0?'flex':'none';
  $('prevDisc').textContent='−₱'+discountAmount.toFixed(2);
  $('prevTax').textContent='₱'+tax.toFixed(2);
  $('prevTot').textContent='₱'+total.toFixed(2);
  $('prevMethod').textContent=paymentMethod==='cash'?'Cash':'Card';
  $('prevCashRow').style.display=paymentMethod==='cash'?'flex':'none';
  $('prevChangeRow').style.display=paymentMethod==='cash'?'flex':'none';
  if(paymentMethod==='cash'){
    $('prevTendered').textContent='₱'+cashTendered.toFixed(2);
    $('prevChange').textContent='₱'+Math.max(0,cashTendered-total).toFixed(2);
  }
  $('overlay').classList.add('show');
  $('confirmCharge').focus();
}
function closePreview(){$('overlay').classList.remove('show');}

function confirmCharge(){
  const{total}=computeTotals();
  orderCounter++;
  localStorage.setItem('cafePosOrderCounter',String(orderCounter));
  const receiptNo='OR-'+String(orderCounter).padStart(6,'0');
  closePreview();
  showToast(`✓ ${receiptNo} — charged ₱${total.toFixed(2)}`);
  order=[];
  discountValue=0;
  cashTendered=0;
  $('discountValue').value=0;
  $('cashInput').value='';
  saveState();
  renderOrder();
  updateOrderNoDisplay();
}

function showToast(msg){
  const t=$('toast');
  t.textContent=msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2500);
}

function updateOrderNoDisplay(){
  $('orderNo').textContent='Next OR-'+String(orderCounter+1).padStart(6,'0');
}
function updateSheetSummary(){
  const{total}=computeTotals();
  const count=order.reduce((s,o)=>s+o.qty,0);
  $('sheetSummary').textContent=count?`${count} item${count>1?'s':''} · ₱${total.toFixed(2)}`:'No items yet';
}
function toggleOrderPanel(){
  $('appRoot').classList.toggle('sheetOpen');
}

init();
