window.FractalLayout = class FractalLayout {
    constructor() {
        this.counter = 0;
        this.cfg = {
            maxDepth: 6,
            trunkLength: 205,
            lengthDecay: 0.765,
            minLength: 62,
            baseRadius: 31,
            minRadius: 7,
            cellGap: 8,
            collisionIterations: 28
        };
    }

    build(graph) {
        this.counter = 0;
        const root = {
            id: 'root', label: graph.product.name, x: 0, y: 0, r: 45,
            depth: 0, strength: 3, category: 'product', family: 'root',
            branchColor: '#8b7cff', direction: -Math.PI / 2,
            targetDirection: -Math.PI / 2, children: [], parent: null
        };

        // As três famílias formam uma única copa contínua, com apenas pequenos
        // corredores visuais entre elas.
        const families = {
            test:     { direction: this.rad(-122), min: this.rad(-166), max: this.rad(-99) },
            material: { direction: this.rad(-90),  min: this.rad(-103), max: this.rad(-77) },
            design:   { direction: this.rad(-58),  min: this.rad(-81),  max: this.rad(-14) }
        };

        for (const branch of graph.branches) {
            const family = families[branch.category];
            const model = this.demo(branch.category);
            const counts = this.countByDepth(model);
            root.children.push(this.place({
                model, parent: root, branch, counts, depth: 1,
                direction: family.direction,
                familyDirection: family.direction,
                familyMin: family.min,
                familyMax: family.max
            }));
        }

        const nodes=[];
        this.flatten(root,nodes);
        this.resolveCollisions(nodes,root);
        this.refreshDirections(root);
        return root;
    }

    rad(degrees){ return degrees*Math.PI/180; }

    demo(category) {
        const prefix=category==='material'?'MATL':category.toUpperCase();
        let serial=1;
        const make=(depth,strength)=>{
            const node={
                label:`${prefix}-${String(serial++).padStart(3,'0')}`,
                category,strength,children:[]
            };
            if(depth<this.cfg.maxDepth){
                const pattern=depth===1?[3,3,2,1]:depth===2?[3,2,2,1]:depth<=4?[3,2,1]:[3,1];
                node.children=pattern.map(s=>make(depth+1,s));
            }
            return node;
        };
        return make(1,3);
    }

    countByDepth(model){
        const counts={};
        const walk=(node,d)=>{
            counts[d]=(counts[d]||0)+1;
            node.children.forEach(c=>walk(c,d+1));
        };
        walk(model,1);
        return counts;
    }

    radius(depth,count){
        // Redução suave por profundidade e densidade. A redução por densidade
        // evita uma coroa externa congestionada sem esvaziar os níveis internos.
        const byDepth=Math.pow(0.835,depth-1);
        const byDensity=Math.pow(Math.max(1,count/6),-0.16);
        return Math.max(this.cfg.minRadius,this.cfg.baseRadius*byDepth*byDensity);
    }

    length(depth,count,radius){
        // Comprimento sempre decrescente. A densidade só aumenta discretamente
        // o passo, impedindo os saltos verticais observados na versão anterior.
        const decayed=this.cfg.trunkLength*Math.pow(this.cfg.lengthDecay,depth-1);
        const density=1+Math.min(0.19,Math.log2(Math.max(1,count))*0.025);
        return Math.max(this.cfg.minLength,decayed*density,radius*3.65);
    }

    ordered(children){
        return [...children].sort((a,b)=>b.strength-a.strength);
    }

    angularOffsets(children,depth){
        const offsets=new Array(children.length).fill(0);
        const groups={3:[],2:[],1:[]};
        children.forEach((c,i)=>groups[c.strength].push(i));

        // Abertura derivativa: cada bifurcação é uma fração da abertura do pai.
        const spread=this.rad(28)*Math.pow(0.73,depth-1);
        const centerStep=Math.max(this.rad(2.2),spread*0.16);
        groups[3].forEach((index,i)=>{
            offsets[index]=(i-(groups[3].length-1)/2)*centerStep;
        });
        groups[2].forEach((index,i)=>{
            const side=i%2===0?-1:1;
            offsets[index]=side*spread*0.56;
        });
        groups[1].forEach((index,i)=>{
            const side=i%2===0?-1:1;
            const layer=Math.floor(i/2);
            offsets[index]=side*spread*(0.98+layer*0.24);
        });
        return offsets;
    }

    place({model,parent,branch,counts,depth,direction,familyDirection,familyMin,familyMax}){
        const count=counts[depth]||1;
        const r=this.radius(depth,count);
        const step=this.length(depth,count,r);
        const clamped=Math.max(familyMin,Math.min(familyMax,direction));
        const node={
            id:`cell-${++this.counter}`,label:model.label,
            x:parent.x+Math.cos(clamped)*step,
            y:parent.y+Math.sin(clamped)*step,
            r,depth,strength:model.strength,category:model.category,
            family:model.category,branchColor:branch.color,
            direction:clamped,targetDirection:clamped,
            familyDirection,familyMin,familyMax,baseLength:step,
            parent,children:[]
        };
        if(!model.children.length)return node;

        const children=this.ordered(model.children);
        const offsets=this.angularOffsets(children,depth);
        // A direção local é herdada majoritariamente do pai, evitando o leque
        // radial e produzindo ramificações sucessivas como no modelo fractal.
        children.forEach((child,i)=>{
            const localDirection=clamped+offsets[i];
            const familyCorrection=this.angleDelta(localDirection,familyDirection)*0.045;
            node.children.push(this.place({
                model:child,parent:node,branch,counts,depth:depth+1,
                direction:localDirection+familyCorrection,
                familyDirection,familyMin,familyMax
            }));
        });
        return node;
    }

    flatten(node,out){ out.push(node); node.children.forEach(c=>this.flatten(c,out)); }

    resolveCollisions(nodes,root){
        const movable=nodes.filter(n=>n!==root);
        for(let iteration=0;iteration<this.cfg.collisionIterations;iteration++){
            let collisions=0;
            for(let i=0;i<movable.length;i++){
                for(let j=i+1;j<movable.length;j++){
                    const a=movable[i],b=movable[j];
                    const dx=b.x-a.x,dy=b.y-a.y;
                    const distance=Math.hypot(dx,dy)||0.001;
                    const crossFamily=a.family===b.family?0:5;
                    const needed=a.r+b.r+this.cfg.cellGap+crossFamily;
                    if(distance>=needed)continue;
                    collisions++;
                    const overlap=needed-distance;
                    const nx=dx/distance,ny=dy/distance;
                    const ma=this.mobility(a),mb=this.mobility(b),sum=ma+mb;
                    a.x-=nx*overlap*(ma/sum); a.y-=ny*overlap*(ma/sum);
                    b.x+=nx*overlap*(mb/sum); b.y+=ny*overlap*(mb/sum);
                }
            }
            // A correção preserva o comprimento e a direção local, mas é leve
            // o bastante para não desfazer os afastamentos necessários.
            this.restore(root,0.055);
            if(!collisions)break;
        }
    }

    mobility(node){
        const strength=node.strength===3?0.42:node.strength===2?0.8:1.28;
        return strength*(1+node.depth*0.17);
    }

    restore(parent,amount){
        parent.children.forEach(child=>{
            const dx=child.x-parent.x,dy=child.y-parent.y;
            let angle=Math.atan2(dy,dx);
            angle+=this.angleDelta(angle,child.targetDirection)*amount*0.30;
            angle=Math.max(child.familyMin,Math.min(child.familyMax,angle));
            const dist=Math.hypot(dx,dy);
            const corrected=dist+(child.baseLength-dist)*amount;
            child.x=parent.x+Math.cos(angle)*corrected;
            child.y=parent.y+Math.sin(angle)*corrected;
            this.restore(child,amount);
        });
    }

    angleDelta(a,b){ return Math.atan2(Math.sin(b-a),Math.cos(b-a)); }

    refreshDirections(parent){
        parent.children.forEach(child=>{
            child.actualDirection=Math.atan2(child.y-parent.y,child.x-parent.x);
            this.refreshDirections(child);
        });
    }
};