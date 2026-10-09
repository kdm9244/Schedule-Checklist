const {test}=require('node:test'),assert=require('node:assert/strict')
const {sanitizeRichText}=require('../utils/pdfRichText')
test('PDF writing retains only approved text and highlight colors',()=>{
 const html=sanitizeRichText('<p><strong>答え</strong><span style="color: rgb(211, 59, 69); position:fixed" onclick="evil()">赤</span><mark data-color="#fff2a8" style="background-color:#fff2a8">重要</mark><script>alert(1)</script><img src=x onerror=evil()></p>')
 assert.match(html,/<strong>答え<\/strong>/);assert.match(html,/color: ?#d33b45/);assert.match(html,/background-color: ?#fff2a8/)
 assert.doesNotMatch(html,/script|onclick|img|position|alert/)
 assert.doesNotMatch(sanitizeRichText('<span style="color: url(javascript:evil())">x</span>'),/style|javascript/)
 assert.equal(sanitizeRichText(html),html)
})
