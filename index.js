import {world, Player, Entity, system, MolangVariableMap} from "@minecraft/server"
const over = world.getDimension("overworld");

export class Options {
    constructor(options) {
        if (options?.moveInRealTime) {
            this._moveFunction = _time;
        } else {
            this._moveFunction = _tick;
        }
        
        this.name = options?.name || "";
        this.moveInRealTime = options?.moveInRealTime || false;
        this.maxSteps = options?.maxSteps || 10;
        this.func = options?.func || function() {};
        this.dimension = options?.dimension || over;
        this.source = options?.source;
        this.ignoreBlocks = options?.ignoreBlocks || false;
        this.stepsPerTick = options?.stepsPerTick || 1;
        this.stepsPerSecond = options?.stepsPerSecond || 1;
        this.canMove = options?.canMove || true;
        this.onDeathFunc = options?.onDeathFunc || function() {};
        this.multiply = options?.multiply || 1;
        this.l = options?.l || 0;
    }
    
    clone() {
        const c = Object.create(Object.getPrototypeOf(this));
        for (const key in this) {
            c[key] = this[key];
        };
        return c;
    }
}

export class OptimizedRay {
    static getCount() {
        return Ray.raycast.size;
    }
    
    constructor(location, velocity, options = new Options()) {
        this.options = options;
        this.steps = 0;
        this._tick = 0;
        this.isActive = true;
        this.canMove = options.canMove;
        this.dimension = options.dimension;
        this.source = options.source;
        this.setLocation(location);
        this.setVelocity(velocity, options.multiply);
        Ray.raycast.add(this);
    }
    
    kill() {
        this.options.onDeathFunc(this);
        this.delete();
    }
    
    sleep() {
        this.isActive = false;
        Ray.raycast.delete(this);
    }
    
    awake() {
        this.isActive = true;
        Ray.raycast.add(this);
    }
    
    setLocation(location = {x: 0, y: 0, z: 0}) {
        this.location = {
            x: location.x,
            y: location.y,
            z: location.z
        };
    }
    
    clone() {
        const c = Object.create(Object.getPrototypeOf(this));
        for (const key in this) {
            c[key] = this[key];
        };
        c.setLocation(this.location);
        c.setVelocity(this.velocity);
        Ray.raycast.add(c);
        return c;
    }
    
    rotate(l) {
      const rad = l * Math.PI / 180;
      const x = this.velocity.x * Math.cos(rad) - this.velocity.z * Math.sin(rad);
      const z = this.velocity.x * Math.sin(rad) + this.velocity.z * Math.cos(rad);
      this.velocity.x = x;
      this.velocity.z = z;
  }
  
  move(useFunc = false) {
    try {
        let block = false;
        
        if (!this.options.ignoreBlocks) {
            block = this.dimension.getBlockFromRay(this.location, this.velocity, {
                maxDistance: this.tpLength * 1.1
            });
        }
        if (!block) {
        this.location.x += this.velocity.x;
        this.location.y += this.velocity.y;
        this.location.z += this.velocity.z;
        
        if (useFunc)
        this.options.func(this);
        
        this.steps += 1;
        
        } else {
            this.kill();
        }
        if (this.steps >= this.options.maxSteps) {
        this.kill();
    }
    } catch (e) {
        console.warn(e);
        this.delete();
    }
}

  setVelocity(velocity = {x: 0, y: 0, z: 0}, multiply = 1) {
      this.velocity = {
            x: velocity.x * multiply,
            y: velocity.y * multiply,
            z: velocity.z * multiply
        };
        
        this.tpLength = Math.sqrt(this.velocity.x**2 + this.velocity.y**2 + this.velocity.z**2) * multiply;
  }
}

export class Ray extends OptimizedRay {
    static raycast = new Set();
    static getCount() {
        return Ray.raycast.size;
    }
    constructor(location, velocity, options = new Options()) {
        super(location, velocity, options);
        this.options = this.options.clone();
       /* if (options.l) {
            this.rotate(options.l);
        }*/
    }
    
    clone() {
        const c = super.clone();
        c.options = this.options?.clone();
        return c;
    }
}

OptimizedRay.prototype.delete = function() {
    this.isActive = false;
    Ray.raycast.delete(this);
}

Player.prototype.createRay = function(options = new Options()) {
    const loc = this.location;
    const vec = this.getViewDirection();
    const r = new Ray({x: loc.x, y: loc.y + 1.62, z: loc.z}, vec, options);
    r.source = this;
    r.dimension = this.dimension;
    return r;
};

let pastDate = Date.now();
let now, delta;
system.runInterval(() => {
    now = Date.now();
    delta = (now - pastDate)/1000;
    pastDate = now;
    
    for (const ray of Ray.raycast) {
        ray.options._moveFunction(ray);
    }
}, 0);

function _tick (ray) {
    ray._tick += ray.options.stepsPerTick;
    const i1 = Math.floor(ray._tick);
    ray._tick -= i1;
        for(let i=0;i<i1 && ray.isActive;i++) {
            if (ray.canMove)
            ray.move(true);
            else ray.options.func(ray);
        }
}

function _time (ray) {
    ray._tick += ray.options.stepsPerSecond * delta
    const i1 = Math.floor(ray._tick);
    ray._tick -= i1;
        for(let i=0;i<i1 && ray.isActive;i++) {
            if (ray.canMove)
            ray.move(true);
            else ray.options.func(ray);
        }
}
