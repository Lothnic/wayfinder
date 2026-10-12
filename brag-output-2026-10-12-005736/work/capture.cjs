const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require(path.resolve(__dirname,'../../brag-output/work/node_modules/playwright'));
const mode=process.argv[2]||'scout';
const fileMode=process.argv.includes('--file');
const root=__dirname,mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const name=decodeURIComponent(req.url.split('?')[0]);const file=path.join(root,name==='/'?'index.html':name);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{
 if(!fileMode)await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox',...(fileMode?['--allow-file-access-from-files']:[])]});
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(fileMode?require('url').pathToFileURL(path.join(root,'index.html')).href:'http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.READY===true);
 await page.evaluate(()=>document.fonts.ready);
 if(mode==='scout'){
  const times=[1,2.9,3.1,5.8,7.92,8.15,9.7,10.85,12.5,13.92,14.2,15.4,16.65,17.92,18.2,20];
  for(const t of times){await page.evaluate(t=>window.RENDER(t),t);await page.screenshot({path:path.join(root,'scout-'+t.toFixed(2)+'.png')});}
  const overflow=await page.evaluate(()=>[...document.querySelectorAll('#copy h1,#sub,.url')].map(e=>({text:e.textContent,width:e.clientWidth,scroll:e.scrollWidth})));console.log('Layout checks:',JSON.stringify(overflow));
 }else{
  const frames=path.join(root,'frames');fs.mkdirSync(frames,{recursive:true});
  await page.evaluate(()=>window.RENDER(13.2));await page.screenshot({path:path.join(root,'poster.png')});
  for(let i=0;i<660;i++){
   if(i===0){fs.copyFileSync(path.join(root,'poster.png'),path.join(frames,'f0000.png'));continue;}
   await page.evaluate(t=>window.RENDER(t),(i+.5)/30);await page.screenshot({path:path.join(frames,'f'+String(i).padStart(4,'0')+'.png')});
   if(i%90===0)console.log('Captured '+i+'/660 frames');
  }
 }
 if(errors.length)throw Error(errors.join('\n'));
 console.log(mode+' complete: no browser errors');await browser.close();server.close();
})().catch(e=>{console.error(e);server.close();process.exit(1)});
