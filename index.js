import {world, Entity, system} from "@minecraft/server"
const over = world.getDimension("overworld");

export class Options {
    constructor(options) {
        if (options?.moveInRealTime) {
            this._moveFunction = _time;
        } else {
            this._moveFunction = _tick;
        }
        
        if (options?.onTriggerBlockEvent) {
            this.ignoreBlocks = options?.ignoreBlocks || false;
        } else {
            this.ignoreBlocks = options?.ignoreBlocks || true;
        }
        
        this.name = options?.name || "";
        this.moveInRealTime = options?.moveInRealTime || false;
        this.maxSteps = options?.maxSteps || 10;
        this.func = options?.func || voidFunc;
        this.onTriggerBlockEvent = options?.onTriggerBlockEvent || voidFunc;
        this.dimension = options?.dimension || over;
        this.source = options?.source;
        this.stepsPerTick = options?.stepsPerTick || 1;
        this.stepsPerSecond = options?.stepsPerSecond || 1;
        this.canMove = options?.canMove || true;
        this.onDeathEvent = options?.onDeathEvent || voidFunc;
        this.multiply = options?.multiply || 1;
        this.l = options?.l || 0;
    }
    
    get ignoreBlocks() {
        return this._ignoreBlocks;
    }
    
    set ignoreBlocks(value) {
        if (value) {
            this._blockRaycastFunction = voidFunc;
        } else {
            this._blockRaycastFunction = blockRaycastFunction;
        }
        this._ignoreBlocks = value;
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
    static getAllRays() {return Ray.raycast;}
    static getRaysInRadius(location, r) {
        const s = new Set();
        const r2 = r**2;
        for (const ray of Ray.raycast) {
            if ((location.x - ray.location.x)**2 + (location.y - ray.location.y)**2 + (location.z - ray.location.z)**2 <= r2)
            s.add(ray);
        }
        return s;
    }
    
    constructor(options = new Options(), location = {x:0, y:0, z:0}, velocity = {x:0, y:0, z:0}) {
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
    
    getRaysInRadius(r) {
        const s = OptimizedRay.getRaysInRadius(this.location, r);
        s.delete(this);
        return s;
    }
    
    kill() {
        this.options.onDeathEvent(this);
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
        this.options._blockRaycastFunction(this);
        if (this.isActive) {
            this.location.x += this.velocity.x;
            this.location.y += this.velocity.y;
            this.location.z += this.velocity.z;
            this.steps += 1;
        
        if (useFunc)
        this.options.func(this);
        
        if (this.steps >= this.options.maxSteps)
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
        
        this.tpLength = Math.sqrt(this.velocity.x**2 + this.velocity.y**2 + this.velocity.z**2);
  }
}

export class Ray extends OptimizedRay {
    static raycast = new Set();
    constructor(options = new Options(), location = {x:0, y:0, z:0}, velocity = {x:0, y:0, z:0}) {
        super(options, location, velocity);
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

Entity.prototype.createRay = function(ClassOfRay = OptimizedRay, ...options) {
    const loc = this.location;
    const vec = this.getViewDirection();
    const r = new ClassOfRay(...options);
    r.source = this;
    r.dimension = this.dimension;
    r.setVelocity(vec, r.options.multiply);
    r.location = {x: loc.x, y: loc.y + 1.32, z: loc.z};
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
    const i1 = Math.trunc(ray._tick);
    ray._tick -= i1;
        for(let i=0;i<i1 && ray.isActive;i++) {
            if (ray.canMove)
            ray.move(true);
            else ray.options.func(ray);
        }
}

function _time (ray) {
    ray._tick += ray.options.stepsPerSecond * delta
    const i1 = Math.trunc(ray._tick);
    ray._tick -= i1;
        for(let i=0;i<i1 && ray.isActive;i++) {
            if (ray.canMove)
            ray.move(true);
            else ray.options.func(ray);
        }
}

function voidFunc() {}

function blockRaycastFunction(ray) {
    const data = ray.dimension.getBlockFromRay(ray.location, ray.velocity, {
                maxDistance: ray.tpLength * 1.1
            });
            if (data)
            ray.options.onTriggerBlockEvent(ray, data);
}
