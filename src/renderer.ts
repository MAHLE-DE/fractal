import { nodes, edges, palette, byId, topPublic } from "./model";
export const state = {
  panelSpace: 0,
  transitionTarget: -1,
  focusBlend: 0,
  rotation: 0,
  zoom: 1,
  anchor: 1,
  light: 0,
  mix: 0,
  opening: 0,
  live: !matchMedia("(prefers-reduced-motion: reduce)").matches,
  focus: -1,
  hover: -1,
  run: -1,
  runProgress: 0,
  runDirection: 1,
  flash: 0,
  categoryFilter: -1,
};
export const samples: number[] = [];
export const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const gl = canvas.getContext("webgl2", { alpha: false, antialias: false })!;
const internalEdgeCount = edges.findIndex((e) => e.public);
const internalNodeCount = nodes.findIndex((n) => n.category === "PUB");
if (!gl) throw Error("WebGL2 unavailable");
function shader(type: number, code: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, code);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw Error(gl.getShaderInfoLog(s)!);
  return s;
}
function program(v: string, f: string) {
  const p = gl.createProgram()!;
  gl.attachShader(p, shader(gl.VERTEX_SHADER, v));
  gl.attachShader(p, shader(gl.FRAGMENT_SHADER, f));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw Error(gl.getProgramInfoLog(p)!);
  return p;
}
const common = `uniform float panelSpace,transitionTarget,focusBlend,time,rotation,zoom,anchor,light,publicMix,live,opening,focus,hover,run,runProgress,runDirection,flash,categoryFilter;uniform vec2 resolution;uniform sampler2D nodeData;
vec4 nd(float id){return texelFetch(nodeData,ivec2(int(id),0),0);}
float category(float id){return texelFetch(nodeData,ivec2(int(id),1),0).x;}
float ang(float id){vec4 n=nd(id);return mix(n.x,n.y,publicMix)+rotation+live*.0017*sin(time*(.17+fract(id*.618)*.23)+id*2.399);}
vec2 polar(float a,float r){return vec2(cos(a),sin(a))*r;}
vec2 node(float id){vec4 n=nd(id);return polar(ang(id),mix(n.z,1.,publicMix));}
vec2 project(vec2 p){p*=.70*zoom;p.y+=.70*(zoom*anchor-1.);p.x*=resolution.y/resolution.x;return p;}`;
const edgeProgram = program(
  `#version 300 es
precision highp float;${common}
uniform sampler2D dynamicControls,edgeData,edgeColors;uniform float width,segments,passMode;out vec3 tint;out float progress,alpha,lateral,strokeWidth;flat out float edgeID;flat out float selected;layout(location=2)in float edgeIndex;vec4 edgeInfo;vec3 color;int eid;
vec2 cp(int j){return texelFetch(dynamicControls,ivec2(clamp(j,0,int(edgeInfo.z)-1),eid),0).xy;}
vec2 curve(float t,out vec2 tangent){float u=clamp(t,0.,.999999)*float(int(edgeInfo.z)+1);int k=int(floor(u))-2;float f=fract(u),f2=f*f,f3=f2*f;vec2 a=cp(k),b=cp(k+1),c=cp(k+2),d=cp(k+3);tangent=a*(-.5*(1.-f)*(1.-f))+b*(1.5*f2-2.*f)+c*(-1.5*f2+f+.5)+d*(.5*f2);return (a*pow(1.-f,3.)+b*(3.*f3-6.*f2+4.)+c*(-3.*f3+3.*f2+3.*f+1.)+d*f3)/6.;}
void main(){eid=int(edgeIndex);edgeInfo=texelFetch(edgeData,ivec2(0,eid),0);color=texelFetch(edgeColors,ivec2(0,eid),0).rgb;bool isFocusEdge=edgeInfo.x==focus||edgeInfo.y==focus||float(eid)==hover||float(eid)==run;if((passMode>.5&&passMode<1.5&&focus>=0.&&!isFocusEdge)||(passMode>1.5&&isFocusEdge)||(edgeInfo.w>.5&&publicMix<.001&&edgeInfo.x!=focus&&edgeInfo.y!=focus)){gl_Position=vec4(2,2,0,1);alpha=0.;tint=vec3(0);progress=0.;edgeID=-1.;selected=0.;return;}float t=float(gl_VertexID/2)/segments;vec2 tangent;vec2 p=project(curve(t,tangent));float len=length(tangent);vec2 normal=len>0.000001?vec2(-tangent.y,tangent.x)/len:vec2(0.,1.);
float outgoing=float(edgeInfo.x==focus),incoming=float(edgeInfo.y==focus);selected=max(outgoing,incoming);float h=float(float(eid)==hover);float running=float(float(eid)==run);
alpha=focus<0.?1.:mix(.07,1.,selected);if(categoryFilter>=0.&&category(edgeInfo.x)!=categoryFilter&&category(edgeInfo.y)!=categoryFilter)alpha*=.03;if(edgeInfo.w>0.5)alpha*=focus<0.?publicMix:selected;if(edgeInfo.w>.5&&publicMix<.001&&texelFetch(nodeData,ivec2(int(edgeInfo.y),1),0).w<.5)alpha=0.;alpha*=smoothstep(.1,.75,opening);tint=mix(color,vec3(1.,.89,.64),outgoing);tint=mix(tint,vec3(.50,.91,1.),incoming);tint*=mix(1.,.58,light);if(hover>=0.&&selected>.5)alpha*=mix(.16,1.,h);alpha=max(alpha,h);strokeWidth=(width+selected*.3)*mix(1.,2.6,h)*clamp(1.+(zoom-1.)*.03,1.,1.5);lateral=float(gl_VertexID%2)*2.-1.;p+=normal*lateral*(strokeWidth+2.)/resolution;gl_Position=vec4(p,0,1);progress=t;edgeID=float(eid);selected=max(h,running);}`,
  `#version 300 es
precision highp float;in vec3 tint;in float progress,alpha,lateral,strokeWidth;flat in float edgeID;flat in float selected;uniform float time,opacity,hover,run,runProgress,runDirection,opening;out vec4 outputColor;
void main(){float reveal=opening>=1.?1.:1.-smoothstep(max(0.,opening-.1)*.60,max(0.,opening-.1)*.60+.04,abs(progress-.5));float coverage=reveal*(1.-smoothstep(strokeWidth*.5-.5,strokeWidth*.5+.5,abs(lateral)*(strokeWidth+2.)*.5));if(alpha<.3){outputColor=vec4(tint,opacity*alpha*coverage);return;}float breath=.90+.10*sin(time*.6+edgeID*.31);float pulse=fract(edgeID*.371)>.95?exp(-pow((progress-fract(time*.10+edgeID*.0618))*65.,2.)):0.;if(edgeID==hover)pulse+=exp(-pow((progress-fract(time*.65))*25.,2.))*5.;float d=(progress-runProgress)*runDirection;float travel=edgeID==run?exp(-pow(d*30.,2.))*7.+step(-.15,d)*step(d,0.)*exp(d*25.)*2.:0.;vec3 base=tint*breath;base=mix(base,vec3(1.),selected*.12);base=mix(base,vec3(1.,.97,.9),clamp(pulse*.55+travel*.4,0.,.85));outputColor=vec4(base,clamp(opacity*alpha*coverage*(1.+travel*.6),0.,1.));}`,
);
const nodeProgram = program(
  `#version 300 es
precision highp float;${common}
uniform sampler2D edgeData;layout(location=0)in vec3 color;out vec3 tint;out float alpha,ratio,pix;flat out float focused;
void main(){float id=float(gl_VertexID);vec4 n=nd(id);gl_Position=vec4(project(node(id)),0,1);float radius=1.3+sqrt(n.w)*.7;float scale=mix(1.,4.5,clamp((zoom-1.)/15.,0.,1.));radius=zoom>3.?clamp(radius*scale,9.,16.):radius;focused=max(float(id==focus)*(1.-focusBlend),float(id==transitionTarget)*(.65+.35*focusBlend));if(hover>=0.){vec4 h=texelFetch(edgeData,ivec2(0,int(hover)),0);float other=h.x==focus?h.y:h.x;focused=max(focused,float(id==other));}float pxScale=min(resolution.y/1000.,1.5);float halo=focused*(7.+2.*sin(time*2.4));float total=radius+halo+1.5;gl_PointSize=2.*total*pxScale;ratio=radius/total;pix=gl_PointSize;tint=color*mix(1.,.72,light);alpha=smoothstep(float(gl_VertexID)/${nodes.length}.+0.0,float(gl_VertexID)/${nodes.length}.+.1,opening*1.3);if(categoryFilter>=0.&&category(id)!=categoryFilter)alpha*=.07;if(n.z>1.1)alpha*=mix(texelFetch(nodeData,ivec2(gl_VertexID,1),0).w*float(focus>=0.)*.6,1.,publicMix);}`,
  `#version 300 es
precision highp float;uniform float light;in vec3 tint;in float alpha,ratio,pix;flat in float focused;out vec4 outputColor;void main(){float d=length(gl_PointCoord-.5)*2.;float px=2./max(pix,1.);float body=1.-smoothstep(ratio-px,ratio,d);vec3 rimColor=mix(tint,vec3(1.),focused*.85);vec3 fill=mix(vec3(.071,.137,.22),vec3(.93,.95,.97),light);vec3 col=rimColor;if(pix*ratio>7.){float rim=max(px*1.7,ratio*.17);float inner=1.-smoothstep(ratio-rim-px,ratio-rim,d);col=mix(rimColor,fill,inner);}float haloD=ratio+(1.-ratio)*.45;float halo=focused*.55*exp(-pow((d-haloD)/(px*2.2),2.));vec3 outCol=mix(col,vec3(1.),halo*(1.-body));outputColor=vec4(outCol,max(body,halo)*alpha);}`,
);
function texture(unit: number, w: number, h: number, values: number[]) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA32F,
    w,
    h,
    0,
    gl.RGBA,
    gl.FLOAT,
    new Float32Array(values),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
}
texture(0, nodes.length, 2, [
  ...nodes.flatMap((n) => [n.angle, n.mixed, n.radius, n.incoming]),
  ...nodes.flatMap((n) => [
    Object.keys(palette).indexOf(n.category),
    0,
    0,
    n.category !== "PUB" || topPublic.includes(n.id) ? 1 : 0,
  ]),
]);
texture(
  1,
  7,
  edges.length,
  edges.flatMap((e) =>
    Array.from(
      { length: 7 },
      (_, i) => e.controls[Math.min(i, e.controls.length - 1)],
    ).flat(),
  ),
);
texture(
  3,
  1,
  edges.length,
  edges.flatMap((e) => [
    byId.get(e.source)!,
    byId.get(e.target)!,
    e.controls.length,
    e.public ? 1 : 0,
  ]),
);
texture(
  4,
  1,
  edges.length,
  edges.flatMap((e) => [...rgb(palette[nodes[byId.get(e.source)!].category]), 1]),
);
if (!gl.getExtension("EXT_color_buffer_float"))
  throw Error("Floating-point render targets unavailable");
gl.activeTexture(gl.TEXTURE2);
const dynamic = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, dynamic);
gl.texImage2D(
  gl.TEXTURE_2D,
  0,
  gl.RGBA32F,
  7,
  edges.length,
  0,
  gl.RGBA,
  gl.FLOAT,
  null,
);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
const fbo = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
gl.framebufferTexture2D(
  gl.FRAMEBUFFER,
  gl.COLOR_ATTACHMENT0,
  gl.TEXTURE_2D,
  dynamic,
  0,
);
if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
  throw Error("GPU controls framebuffer incomplete");
gl.bindFramebuffer(gl.FRAMEBUFFER, null);
const prepass = program(
  `#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0,1);}`,
  `#version 300 es
precision highp float;${common}uniform sampler2D controls,edgeData;out vec4 outputControl;
void main(){int edge=int(gl_FragCoord.y);vec4 info=texelFetch(edgeData,ivec2(0,edge),0);int j=min(int(gl_FragCoord.x),int(info.z)-1);vec4 c=texelFetch(controls,ivec2(j,edge),0);vec2 p=c.w>0.?node(c.w-1.):polar(mix(c.x,c.y,publicMix)+rotation,c.z);outputControl=vec4(mix(mix(node(info.x),node(info.y),float(j)/(info.z-1.)),p,.85),0,1);}`,
);
const runner = program(
  `#version 300 es
precision highp float;${common}uniform sampler2D dynamicControls,edgeData;
vec2 cp(int i,int count){return texelFetch(dynamicControls,ivec2(clamp(i,0,count-1),int(run)),0).xy;}
void main(){int count=int(texelFetch(edgeData,ivec2(0,int(run)),0).z);float u=clamp(runProgress,0.,.999999)*float(count+1);int k=int(floor(u))-2;float f=fract(u),f2=f*f,f3=f2*f;vec2 p=(cp(k,count)*pow(1.-f,3.)+cp(k+1,count)*(3.*f3-6.*f2+4.)+cp(k+2,count)*(-3.*f3+3.*f2+3.*f+1.)+cp(k+3,count)*f3)/6.;gl_Position=vec4(project(p),0,1);gl_PointSize=32.;}`,
  `#version 300 es
precision highp float;out vec4 color;void main(){float d=length(gl_PointCoord-.5)*2.;color=vec4(1.,.86,.49,exp(-d*d*5.)*.9);}`,
);
function attr(loc: number, size: number, values: number[], divisor: number) {
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(loc, divisor);
}
function rgb(c: string) {
  return c.match(/[0-9a-f]{2}/gi)!.map((x) => parseInt(x, 16) / 255);
}
const ev = gl.createVertexArray();
gl.bindVertexArray(ev);
attr(2, 1, edges.map((_, i) => i), 1);
// Subconjunto: so as fibras da norma em foco (mais a do hover e a da corrida), desenhadas em alta resolucao.
const focusVao = gl.createVertexArray();
gl.bindVertexArray(focusVao);
const focusBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, focusBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edges.length), gl.DYNAMIC_DRAW);
gl.enableVertexAttribArray(2);
gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
gl.vertexAttribDivisor(2, 1);
let focusKey = "";
let focusCount = 0;
function updateFocusSubset() {
  const key = `${state.focus}|${state.hover}|${state.run}`;
  if (key === focusKey) return;
  focusKey = key;
  const focusId = nodes[state.focus]?.id;
  const list: number[] = [];
  edges.forEach((e, i) => {
    if (e.source === focusId || e.target === focusId || i === state.hover || i === state.run) list.push(i);
  });
  focusCount = list.length;
  gl.bindBuffer(gl.ARRAY_BUFFER, focusBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(list));
}
const nv = gl.createVertexArray();
gl.bindVertexArray(nv);
attr(
  0,
  3,
  nodes.flatMap((n) => rgb(palette[n.category])),
  0,
);
const uniformLocations = new WeakMap<
  WebGLProgram,
  Map<string, WebGLUniformLocation | null>
>();
const uniformValues = new WeakMap<WebGLProgram, Map<string, number>>();
function locationFor(p: WebGLProgram, key: string) {
  let map = uniformLocations.get(p);
  if (!map) {
    map = new Map();
    uniformLocations.set(p, map);
  }
  if (!map.has(key)) map.set(key, gl.getUniformLocation(p, key));
  return map.get(key) ?? null;
}
function uniforms(p: WebGLProgram, t: number) {
  gl.useProgram(p);
  let previous = uniformValues.get(p);
  if (!previous) {
    previous = new Map();
    uniformValues.set(p, previous);
  }
  for (const [key, value] of Object.entries({
    ...state,
    live: +state.live,
    time: t,
    publicMix: state.mix,
  })) {
    if (previous.get(key) === value) continue;
    const location = locationFor(p, key);
    if (location) gl.uniform1f(location, value as number);
    previous.set(key, value as number);
  }
  if (
    previous.get("__w") !== canvas.width ||
    previous.get("__h") !== canvas.height
  ) {
    gl.uniform2f(locationFor(p, "resolution"), canvas.width, canvas.height);
    previous.set("__w", canvas.width);
    previous.set("__h", canvas.height);
  }
  if (!previous.has("__samplers")) {
    gl.uniform1i(locationFor(p, "nodeData"), 0);
    gl.uniform1i(locationFor(p, "controls"), 1);
    gl.uniform1i(locationFor(p, "dynamicControls"), 2);
    gl.uniform1i(locationFor(p, "edgeData"), 3);
    gl.uniform1i(locationFor(p, "edgeColors"), 4);
    previous.set("__samplers", 1);
  }
}
export function screenPosition(id: number, t = performance.now() / 1000) {
  const n = nodes[id],
    angle =
      n.angle * (1 - state.mix) +
      n.mixed * state.mix +
      state.rotation +
      (state.live
        ? 0.0017 * Math.sin(t * (0.17 + ((id * 0.618) % 1) * 0.23) + id * 2.399)
        : 0);
  const radius =
    ((n.radius * (1 - state.mix) + state.mix) *
      0.7 *
      state.zoom *
      innerHeight) /
    2;
  return {
    x: (innerWidth - state.panelSpace) / 2 + Math.cos(angle) * radius,
    y:
      innerHeight / 2 -
      (0.7 * (state.zoom * state.anchor - 1) * innerHeight) / 2 -
      Math.sin(angle) * radius,
    angle,
  };
}
let last = performance.now();
let overlay: (t: number) => void = () => {};
export function setOverlay(f: (t: number) => void) {
  overlay = f;
}
function draw(now: number) {
  samples.push(now - last);
  if (samples.length > 600) samples.shift();
  last = now;
  const dpr = Math.min(devicePixelRatio, 1.25);
  const stageWidth = Math.max(320, innerWidth - state.panelSpace);
  if (canvas.style.width !== `${stageWidth}px`)
    canvas.style.width = `${stageWidth}px`;
  (canvas.width === Math.round(stageWidth * dpr) &&
    canvas.height === Math.round(innerHeight * dpr)) ||
    Object.assign(canvas, {
      width: Math.round(stageWidth * dpr),
      height: Math.round(innerHeight * dpr),
    });
  gl.disable(gl.BLEND);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  const ringOverview = state.mix < 0.001 && state.focus < 0;
  const activeEdges = ringOverview ? internalEdgeCount : edges.length;
  gl.viewport(0, 0, 7, activeEdges);
  uniforms(prepass, now / 1000);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(
    state.light ? 0.93 : 11 / 255,
    state.light ? 0.95 : 18 / 255,
    state.light ? 0.98 : 32 / 255,
    1,
  );
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  uniforms(edgeProgram, now / 1000);
  gl.bindVertexArray(ev);
  // Passes: [modo, espessura, opacidade, segmentos]. Modo 0 = todas; 1 = so as da norma em foco; 2 = todas menos as do foco.
  // So as fibras em foco usam alta resolucao (curvas lisas no zoom); o fundo usa menos segmentos para manter 60 FPS.
  const fine = state.zoom > 3 ? 128 : 64;
  const passes: [number, number, number, number][] =
    state.focus >= 0
      ? [
          [2, 1.3, 0.9, state.zoom > 3 ? 40 : 48],
          [1, 3.0, 0.05, fine],
          [1, 1.3, 0.9, fine],
        ]
      : [[0, 1.3, 0.34, 64]];
  if (state.focus >= 0) updateFocusSubset();
  for (const [mode, width, opacity, segments] of passes) {
    const subset = mode === 1;
    if (subset && !focusCount) continue;
    gl.bindVertexArray(subset ? focusVao : ev);
    gl.uniform1f(locationFor(edgeProgram, "passMode"), mode);
    gl.uniform1f(locationFor(edgeProgram, "segments"), segments);
    gl.uniform1f(locationFor(edgeProgram, "width"), width);
    gl.uniform1f(locationFor(edgeProgram, "opacity"), opacity);
    gl.drawArraysInstanced(
      gl.TRIANGLE_STRIP,
      0,
      (segments + 1) * 2,
      subset ? focusCount : activeEdges,
    );
  }
  uniforms(nodeProgram, now / 1000);
  gl.bindVertexArray(nv);
  gl.drawArrays(gl.POINTS, 0, ringOverview ? internalNodeCount : nodes.length);
  if (state.run >= 0) {
    uniforms(runner, now / 1000);
    gl.drawArrays(gl.POINTS, 0, 1);
  }
  overlay(now / 1000);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
export const renderer = gl.getParameter(gl.RENDERER);
