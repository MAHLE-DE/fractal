window.CanvasRenderer = class CanvasRenderer {
    constructor(canvas,tooltip){
        this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.tooltip=tooltip;
        this.scale=.5; this.minScale=.07; this.maxScale=80;
        this.tx=0; this.ty=0; this.nodes=[]; this.hover=null; this.selected=null;
        this.dragging=false; this.dirty=true; this.bind(); this.resize();
    }

    bind(){
        addEventListener('resize',()=>this.resize());
        this.canvas.addEventListener('wheel',event=>{
            event.preventDefault();
            const old=this.scale;
            const next=Math.min(this.maxScale,Math.max(this.minScale,old*Math.exp(-event.deltaY*.0017)));
            const wx=(event.clientX-this.tx)/old,wy=(event.clientY-this.ty)/old;
            this.scale=next; this.tx=event.clientX-wx*next; this.ty=event.clientY-wy*next;
            this.dirty=true;
        },{passive:false});
        this.canvas.addEventListener('mousedown',e=>{
            this.dragging=true; this.lastX=e.clientX; this.lastY=e.clientY;
            this.canvas.style.cursor='grabbing';
        });
        addEventListener('mouseup',()=>{
            this.dragging=false; this.canvas.style.cursor=this.hover?'pointer':'grab';
        });
        addEventListener('mousemove',e=>{
            if(this.dragging){
                this.tx+=e.clientX-this.lastX; this.ty+=e.clientY-this.lastY;
                this.lastX=e.clientX; this.lastY=e.clientY; this.dirty=true;
            }
            this.pick(e.clientX,e.clientY);
        });
        this.canvas.addEventListener('click',()=>{
            if(this.hover){ this.selected=this.hover; this.dirty=true; }
            else { this.selected=null; this.dirty=true; }
        });
        this.canvas.addEventListener('dblclick',()=>this.fitToScreen());
    }

    resize(){
        this.dpr=devicePixelRatio||1;
        this.canvas.width=innerWidth*this.dpr; this.canvas.height=innerHeight*this.dpr;
        this.canvas.style.width=`${innerWidth}px`; this.canvas.style.height=`${innerHeight}px`;
        this.dirty=true;
    }

    setTree(root){
        this.root=root; this.nodes=[]; this.flatten(root); this.fitToScreen();
    }
    flatten(node){ this.nodes.push(node); node.children.forEach(c=>this.flatten(c)); }

    fitToScreen(){
        const m=78;
        const minX=Math.min(...this.nodes.map(n=>n.x-n.r)),maxX=Math.max(...this.nodes.map(n=>n.x+n.r));
        const minY=Math.min(...this.nodes.map(n=>n.y-n.r)),maxY=Math.max(...this.nodes.map(n=>n.y+n.r));
        this.scale=Math.max(this.minScale,Math.min((innerWidth-2*m)/(maxX-minX),(innerHeight-1.65*m)/(maxY-minY),.88));
        this.tx=innerWidth/2-(minX+maxX)*.5*this.scale;
        this.ty=innerHeight/2-(minY+maxY)*.5*this.scale+12;
        this.dirty=true;
    }

    pick(sx,sy){
        if(!this.root)return;
        const x=(sx-this.tx)/this.scale,y=(sy-this.ty)/this.scale;
        const before=this.hover;
        this.hover=[...this.nodes].reverse().find(n=>Math.hypot(n.x-x,n.y-y)<=n.r+5/this.scale)||null;
        if(this.hover){
            this.tooltip.style.display='block'; this.tooltip.style.left=`${sx+15}px`; this.tooltip.style.top=`${sy+15}px`;
            this.tooltip.innerHTML=`<strong>${this.hover.label}</strong><span>Nível ${this.hover.depth} · força ${this.hover.strength}</span>`;
            if(!this.dragging)this.canvas.style.cursor='pointer';
        }else{
            this.tooltip.style.display='none'; if(!this.dragging)this.canvas.style.cursor='grab';
        }
        if(before!==this.hover)this.dirty=true;
    }

    isImmediateChild(node){ return !!this.selected && node.parent===this.selected; }
    isSelectedEdge(parent,child){ return !!this.selected && (child===this.selected || parent===this.selected); }

    drawBackground(){
        const c=this.ctx; c.setTransform(this.dpr,0,0,this.dpr,0,0);
        const g=c.createRadialGradient(innerWidth*.5,innerHeight*.42,18,innerWidth*.5,innerHeight*.42,innerWidth*.76);
        g.addColorStop(0,'#11183d'); g.addColorStop(.48,'#090e28'); g.addColorStop(1,'#040611');
        c.fillStyle=g; c.fillRect(0,0,innerWidth,innerHeight);
    }

    edgeColor(node){ return this.depthColor(node.branchColor,node.depth); }

    drawEdge(parent,child){
        const c=this.ctx;
        const highlighted=this.isSelectedEdge(parent,child);
        const width=child.strength===3?4:child.strength===2?2.35:1.12;
        const alpha=highlighted?1:(child.strength===3?.68:child.strength===2?.42:.22);
        const distance=Math.hypot(child.x-parent.x,child.y-parent.y);
        const outAngle=parent.actualDirection??parent.direction??child.actualDirection;
        const inAngle=child.actualDirection;

        // Halo escuro sob cada galho cria separação visual quando arestas se cruzam.
        c.save(); c.globalAlpha=highlighted?.92:.55; c.strokeStyle='#050817';
        c.lineWidth=width+(highlighted?5.2:3.0); c.lineCap='round'; c.beginPath();
        c.moveTo(parent.x,parent.y);
        c.bezierCurveTo(
            parent.x+Math.cos(outAngle)*distance*.34,parent.y+Math.sin(outAngle)*distance*.34,
            child.x-Math.cos(inAngle)*distance*.37,child.y-Math.sin(inAngle)*distance*.37,
            child.x,child.y
        ); c.stroke(); c.restore();

        c.save(); c.globalAlpha=alpha; c.strokeStyle=highlighted?'#ffffff':this.edgeColor(child);
        c.lineWidth=highlighted?width+1.15:width; c.lineCap='round';
        c.shadowColor=highlighted?'#ffffff':this.edgeColor(child); c.shadowBlur=highlighted?12:(child.strength===3?7:2);
        c.beginPath(); c.moveTo(parent.x,parent.y);
        c.bezierCurveTo(
            parent.x+Math.cos(outAngle)*distance*.34,parent.y+Math.sin(outAngle)*distance*.34,
            child.x-Math.cos(inAngle)*distance*.37,child.y-Math.sin(inAngle)*distance*.37,
            child.x,child.y
        ); c.stroke(); c.restore();
        child.children.forEach(next=>this.drawEdge(child,next));
    }

    fitFont(label,r){
        let size=Math.min(10.2,r*.39),max=r*1.62;
        while(size>3.2){ this.ctx.font=`600 ${size}px "Segoe UI"`; if(this.ctx.measureText(label).width<=max)break; size-=.28; }
        return size;
    }

    drawNode(node){
        const c=this.ctx,hover=node===this.hover,selected=node===this.selected,child=this.isImmediateChild(node);
        const r=node.r*(hover?1.07:1),base=node.depth===0?'#f2f4ff':this.depthColor(node.branchColor,node.depth);
        c.save();
        const g=c.createRadialGradient(node.x-r*.3,node.y-r*.34,r*.06,node.x,node.y,r);
        if(node.depth===0){g.addColorStop(0,'#fff');g.addColorStop(1,'#dce0ff');}
        else{g.addColorStop(0,this.lighten(base,20));g.addColorStop(1,base);}
        c.fillStyle=g; c.shadowColor=node.depth===0?'#8b7cff':base; c.shadowBlur=hover||selected||child?20:Math.max(3,9-node.depth);
        c.beginPath(); c.arc(node.x,node.y,r,0,Math.PI*2); c.fill(); c.shadowBlur=0;

        // Borda principal e aro externo dos filhos imediatos.
        c.lineWidth=selected?2.5:.7; c.strokeStyle=selected?'#fff':'rgba(255,255,255,.22)'; c.stroke();
        if(child){
            c.beginPath(); c.arc(node.x,node.y,r+4.2,0,Math.PI*2);
            c.lineWidth=2.1; c.strokeStyle='#ffd166'; c.shadowColor='#ffd166'; c.shadowBlur=10; c.stroke();
        }

        const fs=this.fitFont(node.label,r);
        c.font=`600 ${fs}px "Segoe UI"`; c.textAlign='center'; c.textBaseline='middle';
        c.fillStyle=node.depth===0?'#151a37':'rgba(255,255,255,.98)';
        c.save(); c.beginPath(); c.arc(node.x,node.y,Math.max(1,r-2),0,Math.PI*2); c.clip();
        c.fillText(node.label,node.x,node.y,r*1.65); c.restore(); c.restore();
        node.children.forEach(next=>this.drawNode(next));
    }

    depthColor(hex,depth){
        if(depth<=1)return hex;
        // Gradiente leve por camada: níveis externos ficam mais claros e um pouco
        // menos saturados, sem perder a identidade cromática da família.
        const amount=Math.min(38,(depth-1)*7);
        return this.lighten(hex,amount);
    }

    lighten(hex,amount){
        const n=parseInt(hex.replace('#',''),16);
        const r=Math.min(255,(n>>16)+amount),g=Math.min(255,((n>>8)&255)+amount),b=Math.min(255,(n&255)+amount);
        return `rgb(${r},${g},${b})`;
    }

    render(){
        this.drawBackground(); if(!this.root)return;
        const c=this.ctx; c.save(); c.translate(this.tx,this.ty); c.scale(this.scale,this.scale);
        this.root.children.forEach(child=>this.drawEdge(this.root,child));
        this.drawNode(this.root); c.restore();
    }
    frame(){ if(this.dirty){this.render();this.dirty=false;} requestAnimationFrame(()=>this.frame()); }
    start(){this.dirty=true;requestAnimationFrame(()=>this.frame());}
};