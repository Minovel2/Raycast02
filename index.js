import {world, Player, Entity, system, MolangVariableMap} from "@minecraft/server"
let over = world.getDimension("overworld");
let id = 0;
let raycast = {};

//---------------------
// пример создания луча
system.runInterval(() => {
    let p = world.getAllPlayers();
    p[0].createRay(10, (obj) => {
        over.runCommandAsync(`particle minecraft:basic_flame_particle ${obj.x} ${obj.y} ${obj.z}`);
    } );
},19)
//---------------------

// снизу конструктор лучей и функции для луча
function Ray(maxSteps, x, y, z, tpx, tpy, tpz, func, options = {} ) {
  raycast[id] = {}
  raycast[id].step = 0;
  raycast[id].maxSteps = maxSteps;
  raycast[id].x = x;
  raycast[id].y = y;
  raycast[id].z = z;
  raycast[id].tpx = tpx * (options?.multiply || 1);
  raycast[id].tpy = tpy * (options?.multiply || 1);
  raycast[id].tpz = tpz * (options?.multiply || 1);
  raycast[id].tpLength = Math.sqrt(tpx**2 + tpy**2 + tpz**2) * (options?.multiply || 1);
  raycast[id].func = func;
  raycast[id].id = id;
  raycast[id].dimension = options?.dimension || over;
  raycast[id].source = options?.source;
  raycast[id].ignoreBlocks = options?.ignoreBlocks || false;
  raycast[id].stepsPerTick = options?.stepsPerTick || 1;
   raycast[id].autoMove = options?.autoMove || true;
  raycast[id].onDeathFunc = options?.onDeathFunc || function() {};
  
  if (options?.l) {
      rotate(raycast[id], options.l);
  }
  id++;
  }
Player.prototype.createRay = function(maxSteps, func, options = {} ) {
    let loc = this.location;
    let vec = this.getViewDirection();
    options.source = this;
    options.dimension = this.dimension;
    new Ray(maxSteps, loc.x, loc.y + 1.62, loc.z, vec.x, vec.y, vec.z, func, options)
};

system.runInterval(() => {
    for (let prop in raycast) {
        if (raycast[prop].autoMove) {
        let ray = raycast[prop];
        let i1 = Math.floor(ray.step + ray.stepsPerTick) - Math.floor(ray.step);
        for(let i=0;i<i1 && ray;i++) {
            move(ray, true);
        }
        ray.step += ray.stepsPerTick - i1;
        }
    }
}, 0)
  
function move(obj, useFunc = false) {
    try {
        let block = false;
        
        if (!obj.ignoreBlocks) {
            block = obj.dimension.getBlockFromRay({
                x: obj.x,
                y: obj.y,
                z: obj.z
            }, {
                x: obj.tpx,
                y: obj.tpy,
                z: obj.tpz
            }, {
                maxDistance: obj.tpLength * 1.1
            });
        }
        if (!block) {
        obj.x += obj.tpx;
        obj.y += obj.tpy;
        obj.z += obj.tpz;
        
        if (useFunc)
        obj.func(obj);
        
        obj.step += 1;
        
        } else {
            obj.onDeathFunc();
            delete raycast[obj.id];
        }
        if (obj.step >= obj.maxSteps) {
        obj.onDeathFunc();
        delete raycast[obj.id];
    }
    } catch {
        delete raycast[obj.id];
    }
}
function deleteRay(obj) {
    delete raycast[obj.id];
}
function rotate(obj, l) {
    let rad = l * Math.PI / 180;
    let x = obj.tpx * Math.cos(rad) - obj.tpz * Math.sin(rad);
    let z = obj.tpx * Math.sin(rad) + obj.tpz * Math.cos(rad);
    obj.tpx = x;
    obj.tpz = z;
}
