const sanitize=require('sanitize-html')
const colors=['#26364c','#d33b45','#315cbb','#238268','#8a4db5','#c06d18']
const highlights=['#fff2a8','#ffd6df','#cfe4ff','#d4f0db','#e5d9fa']
function canonical(value){
 value=(value||'').trim().toLowerCase()
 const rgb=value.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/)
 if(rgb)value='#'+rgb.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join('')
 return value
}
function style(tag,attrs){
 const property=tag==='mark'?'background-color':'color',palette=tag==='mark'?highlights:colors
 const match=(attrs.style||'').match(new RegExp('(?:^|;)\\s*'+property+'\\s*:\\s*([^;]+)','i'))
 const color=canonical(match?.[1]||(tag==='mark'?attrs['data-color']:''))
 return {tagName:tag,attribs:palette.includes(color)?{style:property+': '+color,...(tag==='mark'?{'data-color':color}:{})}:{}}
}
function sanitizeRichText(html){
 return sanitize(html,{allowedTags:['p','br','strong','b','span','mark'],allowedAttributes:{span:['style'],mark:['style','data-color']},transformTags:{span:(tag,attrs)=>style(tag,attrs),mark:(tag,attrs)=>style(tag,attrs)}})
}
module.exports={sanitizeRichText}
