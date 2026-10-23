const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname,argument=process.argv.indexOf('--port'),port=Number(argument>=0?process.argv[argument+1]:process.env.PORT||4174);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid preview port');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.wasm':'application/wasm','.md':'text/plain; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});return res.end()}
  const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=route==='/'?'/index.html':route;
  if(!['/index.html','/header-comparison.html','/geometry-comparison.html','/style.css','/app.js'].includes(file)&&!file.startsWith('/assets/')){res.writeHead(404);return res.end('Not found')}
  const resolved=path.resolve(root,'.'+file);
  if(!resolved.startsWith(root+path.sep)||file.startsWith('/assets/')&&!resolved.startsWith(path.join(root,'assets')+path.sep)){res.writeHead(403);return res.end('Forbidden')}
  const data=fs.readFileSync(resolved);res.writeHead(200,{'Content-Type':mime[path.extname(resolved)]||'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404);res.end('Not found')}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port '+port+' is in use. Try npm run dev -- --port 4175':error.message);process.exitCode=1});
server.listen(port,'127.0.0.1',()=>console.log('PhysNowHEX: http://127.0.0.1:'+port+'/ (root: '+root+')'));
