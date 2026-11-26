import data from '../data/cascade-data.json';
import {gsap} from 'gsap';
const canvas=document.querySelector('canvas')!; const gl=canvas.getContext('webgl2',{alpha:false,antialias:true})!;
if(!gl){document.querySelector('#error')!.textContent='WebGL2 is unavailable. Enable hardware acceleration and reopen.';throw Error('WebGL2 unavailable')}
const colors:Record<string,number[]>={DSGN:[.33,.74,1],MATL:[.96,.61,.28],MEAS:[.25,.87,.73],MNFG:[.78,.5,1],PROD:[.99,.48,.6],TEST:[.9,.82,.4]};
const state={rotation:0,zoom:1,live:!matchMedia('(prefers-reduced-motion: reduce)').matches};
const common=`uniform float time,rotation,zoom,live;uniform vec2 resolution;
float current(float a,float id){return a+rotation+live*.0019*sin(time*(.17+fract(id*.618)*.23)+id*2.399);}
vec2 polar(float a,float r){return vec2(cos(a),sin(a))*r;}
vec2 project(vec2 p){p*=.73*zoom;p.y+=.73*(zoom-1.);p.x*=resolution.y/resolution.x;return p;}`;
function program(v:string,f:string){function shader(type:number,code:string){const s=gl.createShader(type)!;gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)!);return s}const p=gl.createProgram()!;gl.attachShader(p,shader(gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p)!);return p}
const edges=program(`#version 300 es
precision highp float;layout(location=0)in vec4 anglesA;layout(location=1)in vec3 anglesB;layout(location=2)in vec2 ids;layout(location=3)in vec3 color;out vec3 tint;out float progress;flat out float seed;uniform float width;${common}
vec2 curve(float t){vec2 p[7];p[0]=polar(current(anglesA.x,ids.x),1.);p[1]=polar(anglesA.y+rotation,.76);p[2]=polar(anglesA.z+rotation,.40);p[3]=vec2(0);p[4]=polar(anglesB.x+rotation,.40);p[5]=polar(anglesB.y+rotation,.76);p[6]=polar(current(anglesB.z,ids.y),1.);vec2 straight=mix(p[0],p[6],t);for(int k=6;k>0;k--)for(int i=0;i<k;i++)p[i]=mix(p[i],p[i+1],t);return mix(straight,p[0],.85);}
void main(){float t=float(gl_VertexID/2)/64.;vec2 p=project(curve(t));vec2 next=project(curve(min(1.,t+.001)));if(t>=1.)next=p+(p-project(curve(t-.001)));vec2 tangent=normalize((next-p)*resolution);vec2 normal=vec2(-tangent.y,tangent.x);p+=normal*(float(gl_VertexID%2)*2.-1.)*width/resolution;gl_Position=vec4(p,0,1);tint=color;progress=t;seed=ids.x*13.7+ids.y;}`,`#version 300 es
precision highp float;in vec3 tint;in float progress;flat in float seed;uniform float time,opacity;out vec4 outColor;
void main(){float breath=.8+.2*sin(time*.7+seed);float phase=fract(time*.13+seed*.0618);float pulse=exp(-pow((progress-phase)*65.,2.))*step(.88,fract(seed*.371));outColor=vec4(tint*(breath+pulse*4.),opacity);}`);
const nodes=program(`#version 300 es
precision highp float;layout(location=0)in float angle;layout(location=1)in vec3 color;out vec3 tint;${common}
void main(){gl_Position=vec4(project(polar(current(angle,float(gl_VertexID)),1.)),0,1);gl_PointSize=min(10.,3.*zoom);tint=color;}`,`#version 300 es
precision highp float;in vec3 tint;out vec4 outColor;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;outColor=vec4(tint,1.-smoothstep(.18,.5,d));}`);
function attribute(location:number,size:number,values:number[],instanced=false){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.STATIC_DRAW);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(location,instanced?1:0)}
const index=new Map(data.nodes.map((n,i)=>[n.id,i]));const edgeVAO=gl.createVertexArray();gl.bindVertexArray(edgeVAO);
attribute(0,4,data.edges.flatMap(e=>e.controls.slice(0,4).map(c=>c[0])),true);attribute(1,3,data.edges.flatMap(e=>e.controls.slice(4).map(c=>c[0])),true);attribute(2,2,data.edges.flatMap(e=>[index.get(e.source)!,index.get(e.target)!]),true);attribute(3,3,data.edges.flatMap(e=>colors[e.source.split('-')[0]]||[.5,.7,1]),true);
const nodeVAO=gl.createVertexArray();gl.bindVertexArray(nodeVAO);attribute(0,1,data.nodes.map(n=>n.angle));attribute(1,3,data.nodes.flatMap(n=>colors[n.category]||[.6,.8,1]));
function uniforms(p:WebGLProgram,t:number){gl.useProgram(p);for(const [k,v]of Object.entries({time:t,rotation:state.rotation,zoom:state.zoom,live:+state.live}))gl.uniform1f(gl.getUniformLocation(p,k),v);gl.uniform2f(gl.getUniformLocation(p,'resolution'),canvas.width,canvas.height)}
let last=performance.now(),samples:number[]=[];const fps=document.querySelector('#fps')!;
function draw(now:number){samples.push(now-last);if(samples.length>600)samples.shift();last=now;const dpr=Math.min(devicePixelRatio,1.5),w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}gl.clearColor(.024,.043,.075,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);uniforms(edges,now/1000);gl.bindVertexArray(edgeVAO);for(const [width,opacity]of [[3.0,.012],[.7,.105]]){gl.uniform1f(gl.getUniformLocation(edges,'width'),width);gl.uniform1f(gl.getUniformLocation(edges,'opacity'),opacity);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,130,data.edges.length)}uniforms(nodes,now/1000);gl.bindVertexArray(nodeVAO);gl.drawArrays(gl.POINTS,0,data.nodes.length);fps.textContent=`${(1000/(samples.slice(-120).reduce((a,b)=>a+b,0)/Math.min(samples.length,120))).toFixed(1)} FPS · ${data.edges.length} fibers · ${data.nodes.length} cells`;requestAnimationFrame(draw)}
requestAnimationFrame(draw);
function focus(id:string){const n=data.nodes.find(n=>n.id===id);if(!n)return;const delta=Math.atan2(Math.sin(-Math.PI/2-n.angle-state.rotation),Math.cos(-Math.PI/2-n.angle-state.rotation));gsap.to(state,{rotation:state.rotation+delta,zoom:2.15,duration:.6+Math.abs(delta)/Math.PI*.8,ease:'power2.inOut',overwrite:true});document.querySelector('#focus')!.textContent=n.id;document.querySelector('#title')!.textContent=n.title;document.querySelector('#detail')!.textContent=`${n.previous} · ${n.language.toUpperCase()}`;}
function overview(){gsap.to(state,{zoom:1,duration:.9,ease:'power2.inOut'});document.querySelector('#focus')!.textContent='595 standards';document.querySelector('#title')!.textContent='Every thread is a citation. Choose a standard to bring it closer.'}
document.querySelector('#date')!.textContent=`VALID-DOCUMENTS · ${data.meta.validDocuments}`;
const list=document.querySelector('datalist')!;for(const n of data.nodes){const opt=document.createElement('option');opt.value=n.id;opt.label=n.title;list.append(opt)}
document.querySelector('input')!.addEventListener('change',e=>focus((e.target as HTMLInputElement).value));
function liveLabel(){document.querySelector('#live')!.textContent=`Live motion: ${state.live?'on':'off'}`}
liveLabel();document.querySelector('#live')!.addEventListener('click',()=>{state.live=!state.live;liveLabel()});document.querySelector('#reset')!.addEventListener('click',overview);
addEventListener('keydown',e=>{if(e.key.toLowerCase()==='f'&&document.activeElement?.tagName!=='INPUT')fps.toggleAttribute('hidden');if(e.key==='Escape')overview()});canvas.addEventListener('wheel',e=>{e.preventDefault();state.zoom=Math.max(.7,Math.min(3,state.zoom-e.deltaY*.002))},{passive:false});
document.querySelector('#legend')!.innerHTML=Object.entries(colors).map(([cat,c])=>`<span class="dot" style="background:rgb(${c.map(v=>v*255).join(',')})"></span>${cat}`).join('');
(window as any).cascade={focus,overview,state,samples,data,renderer:gl.getParameter(gl.RENDERER)};
