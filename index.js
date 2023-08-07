import {world, Player, Entity, system, MolangVariableMap} from "@minecraft/server"
let over = world.getDimension("overworld");

//---------------------
// пример импорта и создания луча
/*
import {world, system} from "@minecraft/server"
let over = world.getDimension("overworld");
import {Ray} from "./Ray.js"

system.runInterval(() => {
    for (let p of world.getAllPlayers()) {
        p.createRay(10, (obj) => {
        over.runCommandAsync(`particle minecraft:basic_flame_particle ${obj.x} ${obj.y} ${obj.z}`);
    } );
    }
},19)
*/
//---------------------

// снизу конструктор лучей и функции для луча, если не знаете, что это такое , то лучше не трогать.
export class Ray {
    static raycast = new Set();
    static getCount() {
        return Ray.raycast.size;
    }
    constructor(maxSteps, x, y, z, tpx, tpy, tpz, func, options = {} ) {
        
        this.step = 0;
        this.maxSteps = maxSteps;
        this.x = x;
        this.y = y;
        this.z = z;
        this.tpx = tpx * (options?.multiply || 1);
        this.tpy = tpy * (options?.multiply || 1);
        this.tpz = tpz * (options?.multiply || 1);
        this.tpLength = Math.sqrt(tpx**2 + tpy**2 + tpz**2) * (options?.multiply || 1);
        this.func = func;
        this.dimension = options?.dimension || over;
        this.source = options?.source;
        this.ignoreBlocks = options?.ignoreBlocks || false;
        this.stepsPerTick = options?.stepsPerTick || 1;
        this.autoMove = options?.autoMove || true;
        this.onDeathFunc = options?.onDeathFunc || function() {};
        
        if (options?.l) {
            this.rotate(options.l);
        }
        Ray.raycast.add(this);
    }
  
  rotate(l) {
      let rad = l * Math.PI / 180;
      let x = this.tpx * Math.cos(rad) - this.tpz * Math.sin(rad);
      let z = this.tpx * Math.sin(rad) + this.tpz * Math.cos(rad);
      this.tpx = x;
      this.tpz = z;
  }
  
  move(useFunc = false) {
    try {
        let block = false;
        
        if (!this.ignoreBlocks) {
            block = this.dimension.getBlockFromRay({
                x: this.x,
                y: this.y,
                z: this.z
            }, {
                x: this.tpx,
                y: this.tpy,
                z: this.tpz
            }, {
                maxDistance: this.tpLength * 1.1
            });
        }
        if (!block) {
        this.x += this.tpx;
        this.y += this.tpy;
        this.z += this.tpz;
        
        if (useFunc)
        this.func(this);
        
        this.step += 1;
        
        } else {
            this.onDeathFunc();
            Ray.raycast.delete(this);
        }
        if (this.step >= this.maxSteps) {
        this.onDeathFunc();
        Ray.raycast.delete(this);
    }
    } catch {
        Ray.raycast.delete(this);
    }
}
}

Ray.prototype.delete = function() {
    Ray.raycast.delete(this);
}

Player.prototype.createRay = function(maxSteps, func, options = {} ) {
    let loc = this.location;
    let vec = this.getViewDirection();
    options.source = this;
    options.dimension = this.dimension;
    return new Ray(maxSteps, loc.x, loc.y + 1.62, loc.z, vec.x, vec.y, vec.z, func, options);
};

system.runInterval(() => {
    for (let ray of Ray.raycast) {
        if (ray.autoMove) {
        let i1 = Math.floor(ray.step + ray.stepsPerTick) - Math.floor(ray.step);
        for(let i=0;i<i1 && ray;i++) {
            ray.move(true);
        }
        ray.step += ray.stepsPerTick - i1;
        }
    }
}, 0)
