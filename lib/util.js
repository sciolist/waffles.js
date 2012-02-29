exports.clone = function(obj) {
  if(obj.slice) return obj.slice(0);
  var newObject = {};
  for(var key in obj) {
    newObject[key] = obj[key];
  }
  return newObject;
}

exports.Class = function Class() { }
exports.Class.extend = function(data) {
  var parent = this;
  if(arguments.length === 2) {
    parent = data;
    data = arguments[1];
  }
  var cls = data.init || function(){};
  cls.base = data.__proto__ = parent.prototype;
  cls.extend = arguments.callee;
  cls.prototype = data;
  return cls;
};

exports.SheetError = exports.Class.extend(Error, {
  init: function(code, msg) {
    this.code = code;
    //Error.constructor.call(this, msg);
  }
});

exports.Evented = exports.Class.extend({
  emit: function(msg, args) {
    if(!args) { args = {}; }
    if(msg !== "*") { args.type = msg; }
    args.sender = this;

    var listeners = this._msgs && this._msgs[msg];
    if(listeners) {
      var handlers = listeners.slice(0);
      for(var i=0; i<handlers.length; ++i) {
        handlers[i].call(this, args, this);
      };
    }
    if(msg !== "*") {
      this.emit("*", args);
    }
  },
  unbind: function(msg, method) {
    if(!this._msgs || !this._msgs[msg]) { return; }
    for(var i=this._msgs[msg].length-1; i>=0; --i) {
      if(this._msgs[msg][i] === method) {
        this._msgs[msg].splice(i, 1);
      }
    }
    if(this._msgs[msg].length === 0) {
      delete this._msgs[msg];
    }
  },
  on: function(msg, method) {
    var self = this;
    if(!this._msgs) this._msgs = {};
    if(!this._msgs[msg]) this._msgs[msg] = [];
    this._msgs[msg].push(method);
    return function() { self.unbind(msg, method); }
  },
  once: function(msg, method) {
    var self = this;
    return this.on(msg, function cb() {
      self.unbind(msg, cb);
      method.apply(this, arguments);
    });
  },
  destroy: function() {
    this._msgs = null;
  }
});

