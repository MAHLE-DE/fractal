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
uniform sampler2D dynamicControls;uniform float width,segments;out vec3 tint;out float progress,alpha,lateral,strokeWidth;flat out float edgeID;flat out float selected;layout(location=0)in vec4 edgeInfo;layout(location=1)in vec3 color;
vec2 cp(int j){return texelFetch(dynamicControls,ivec2(clamp(j,0,int(edgeInfo.z)-1),gl_InstanceID),0).xy;}
vec2 curve(float t,out vec2 tangent){float u=clamp(t,0.,.999999)*float(int(edgeInfo.z)+1);int k=int(floor(u))-2;float f=fract(u),f2=f*f,f3=f2*f;vec2 a=cp(k),b=cp(k+1),c=cp(k+2),d=cp(k+3);tangent=a*(-.5*(1.-f)*(1.-f))+b*(1.5*f2-2.*f)+c*(-1.5*f2+f+.5)+d*(.5*f2);return (a*pow(1.-f,3.)+b*(3.*f3-6.*f2+4.)+c*(-3.*f3+3.*f2+3.*f+1.)+d*f3)/6.;}
void main(){if((width>2.&&focus>=0.&&edgeInfo.x!=focus&&edgeInfo.y!=focus&&float(gl_InstanceID)!=hover&&float(gl_InstanceID)!=run)||(edgeInfo.w>.5&&publicMix<.001&&edgeInfo.x!=focus&&edgeInfo.y!=focus)){gl_Position=vec4(2,2,0,1);alpha=0.;tint=vec3(0);progress=0.;edgeID=-1.;selected=0.;return;}float t=float(gl_VertexID/2)/segments;vec2 tangent;vec2 p=project(curve(t,tangent));float len=length(tangent);vec2 normal=len>0.000001?vec2(-tangent.y,tangent.x)/len:vec2(0.,1.);
float outgoing=float(edgeInfo.x==focus),incoming=float(edgeInfo.y==focus);selected=max(outgoing,incoming);float h=float(float(gl_InstanceID)==hover);float running=float(float(gl_InstanceID)==run);
alpha=focus<0.?1.:mix(.22,1.,selected);if(categoryFilter>=0.&&category(edgeInfo.x)!=categoryFilter&&category(edgeInfo.y)!=categoryFilter)alpha*=.03;if(edgeInfo.w>0.5)alpha*=focus<0.?publicMix:selected;if(edgeInfo.w>.5&&publicMix<.001&&texelFetch(nodeData,ivec2(int(edgeInfo.y),1),0).w<.5)alpha=0.;alpha*=smoothstep(.1,.75,opening);tint=mix(color,vec3(1.,.89,.64),outgoing);tint=mix(tint,vec3(.50,.91,1.),incoming);tint*=mix(1.,.58,light);if(hover>=0.&&selected>.5)alpha*=mix(.16,1.,h);alpha=max(alpha,h);strokeWidth=(width+selected*.35)*mix(1.,3.,h);lateral=float(gl_VertexID%2)*2.-1.;p+=normal*lateral*(strokeWidth+2.)/resolution;gl_Position=vec4(p,0,1);progress=t;edgeID=float(gl_InstanceID);selected=max(h,running);}`,
  `#version 300 es
precision highp float;in vec3 tint;in float progress,alpha,lateral,strokeWidth;flat in float edgeID;flat in float selected;uniform float time,opacity,hover,run,runProgress,runDirection,opening;out vec4 outputColor;
void main(){float reveal=opening>=1.?1.:1.-smoothstep(max(0.,opening-.1)*.60,max(0.,opening-.1)*.60+.04,abs(progress-.5));float coverage=reveal*(1.-smoothstep(strokeWidth*.5-.5,strokeWidth*.5+.5,abs(lateral)*(strokeWidth+2.)*.5));if(alpha<.3){outputColor=vec4(tint,opacity*alpha*coverage);return;}float breath=.90+.10*sin(time*.6+edgeID*.31);float pulse=fract(edgeID*.371)>.95?exp(-pow((progress-fract(time*.10+edgeID*.0618))*65.,2.)):0.;if(edgeID==hover)pulse+=exp(-pow((progress-fract(time*.65))*25.,2.))*5.;float d=(progress-runProgress)*runDirection;float travel=edgeID==run?exp(-pow(d*30.,2.))*7.+step(-.15,d)*step(d,0.)*exp(d*25.)*2.:0.;outputColor=vec4(tint*(breath+pulse*2.+travel+selected*.7),opacity*alpha*coverage);}`,
);
const nodeProgram = program(
  `#version 300 es
precision highp float;${common}
uniform sampler2D edgeData;layout(location=0)in vec3 color;out vec3 tint;out float alpha;flat out float focused;
void main(){float id=float(gl_VertexID);vec4 n=nd(id);gl_Position=vec4(project(node(id)),0,1);float radius=1.3+sqrt(n.w)*.7;float scale=mix(1.,4.5,clamp((zoom-1.)/15.,0.,1.));radius=zoom>3.?clamp(radius*scale,8.,14.):radius;focused=max(float(id==focus)*(1.-focusBlend),float(id==transitionTarget)*(.65+.35*focusBlend));if(hover>=0.){vec4 h=texelFetch(edgeData,ivec2(0,int(hover)),0);float other=h.x==focus?h.y:h.x;focused=max(focused,float(id==other));}gl_PointSize=2.*(radius+focused*(6.+3.*sin(time*3.)))*min(resolution.y/1000.,1.5);tint=color*mix(1.,.58,light);alpha=smoothstep(float(gl_VertexID)/${nodes.length}.+0.0,float(gl_VertexID)/${nodes.length}.+.1,opening*1.3);if(categoryFilter>=0.&&category(id)!=categoryFilter)alpha*=.07;if(n.z>1.1)alpha*=mix(texelFetch(nodeData,ivec2(gl_VertexID,1),0).w*float(focus>=0.)*.6,1.,publicMix);}`,
  `#version 300 es
precision highp float;in vec3 tint;in float alpha;flat in float focused;out vec4 outputColor;void main(){float d=length(gl_PointCoord-.5)*2.;float a=1.-smoothstep(.55,1.,d);if(focused>0.)a=max(a,focused*exp(-pow((d-.82)*22.,2.)));outputColor=vec4(tint*(1.+focused*.6),a*alpha);}`,
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
attr(
  0,
  4,
  edges.flatMap((e) => [
    byId.get(e.source)!,
    byId.get(e.target)!,
    e.controls.length,
    e.public ? 1 : 0,
  ]),
  1,
);
attr(
  1,
  3,
  edges.flatMap((e) => rgb(palette[nodes[byId.get(e.source)!].category])),
  1,
);
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
  gl.blendFunc(gl.SRC_ALPHA, state.light ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE);
  uniforms(edgeProgram, now / 1000);
  gl.bindVertexArray(ev);
  const segments = state.run >= 0 ? 32 : state.zoom > 3 ? 24 : 48;
  gl.uniform1f(locationFor(edgeProgram, "segments"), segments);
  for (const [width, opacity] of state.focus >= 0
    ? [
        [3, 0.018],
        [1.2, 0.27],
      ]
    : [[1.2, 0.27]]) {
    gl.uniform1f(locationFor(edgeProgram, "width"), width);
    gl.uniform1f(locationFor(edgeProgram, "opacity"), opacity);
    gl.drawArraysInstanced(
      gl.TRIANGLE_STRIP,
      0,
      (segments + 1) * 2,
      activeEdges,
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
