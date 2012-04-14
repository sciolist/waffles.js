var global = typeof window === "undefined" ? exports : window;
if(global.EventEmitter2 === undefined) {
  global.EventEmitter2 = require("EventEmitter2").EventEmitter2;
}

exports.clone = function(obj) {
  if(!obj) return null;
  if(obj.slice) return obj.slice(0);
  var newObject = {};
  for(var key in obj) {
    newObject[key] = obj[key];
  }
  return newObject;
}

var merge = exports.merge = function() {
  var tgt = arguments[0];
  for(var i=1; i<arguments.length; ++i) {
    for(var key in arguments[i]) {
      if(!Object.hasOwnProperty.call(arguments[i], key)) continue;
      tgt[key] = arguments[i][key];
    }
  }
  return tgt;
}



if(!Function.prototype.getName) {
  Function.prototype.getName = function() {
    if(this.name) return this.name;
    return this.name = this.toString().match(/^function\s+(.*?)\s*\(/)[1];
  }
}

var BaseClass = exports.BaseClass = function BaseClass() { }
BaseClass.append = function(fn) {
  var instance = this.prototype;
  fn.call(this, instance);
  merge(this.prototype, instance);
  return this;
}
BaseClass.include = function(obj) {
  merge(this.prototype, obj.prototype);
  if(obj.included && obj.included.call) obj.included(this);
}
BaseClass.inherit = function(obj) {
  if(!(obj instanceof Function)) {
    throw new Error("Can only inherit from class-like objects.");
  }

  function base() { }
  base.prototype = obj.prototype;
  var prototype = new base();
  merge(prototype, this.prototype);
  this.prototype = prototype;
  this.base = base.prototype;

  if(obj.inherited && obj.inherited.call) obj.inherited(this);
}
BaseClass.extend = function(obj) {
  merge(this, obj.prototype);
  if(obj.extended && obj.extended.call) obj.extended(this);
}


exports.Module = function Module(cb) {
  var self = {};
  merge(self, BaseClass);
  self.inherit(BaseClass);
  self.inherit = null;
  self.append(cb);
  return self;
}

exports.Class = function Class(cb) {
  var self = function() { if(this.constructor) this.constructor.apply(this, arguments); }
  self.className = cb.getName();
  self.toString = function() { return "[" + self.className + "]" }

  merge(self, BaseClass);
  self.inherit(BaseClass);
  self.append(cb);
  self.prototype.class = self;
  self.constructor = self.prototype.constructor;
  return self;
}


exports.Evented = exports.Class(function Evented(def) {
  this.inherit(global.EventEmitter2);
  
  def.constructor = function(args) {
    if(!args) args = {}
    if(args.wildcard === undefined) args.wildcard = true;
    global.EventEmitter2.call(this, args);
  }

  def.eventProxy = function(fn) {
    function proxy() {
      var args = [this.event, this];
      args.concat(Array.prototype.slice.call(arguments));
      fn.apply(this, args);
    };

    this.onAny(proxy);
    return function() { this.offAny(proxy); };
  }

  def._eventProxy = function(prefix, target) {
    function proxy() {
      target.proxyInfo = this.proxyInfo || {};
      target.proxyInfo[prefix] = this;

      var name = (prefix ? prefix + (this.delimited || ".") : "") + this.event;
      var args = Array.prototype.slice.call(arguments);
      args.unshift(name);
      target.emit.apply(target, args);

      delete target.proxyInfo;
    };
    this.onAny(proxy);
    return proxy;
  }
});

