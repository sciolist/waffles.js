var Scripting = require("./scripting").Scripting;
var util = require("./util");

exports.Cell = util.Evented.extend({
  init: function(owner, data, x, y) {
    if(!data) { data = { } }
    this.owner = owner;
    this.x = x;
    this.y = y;
    this._data = data;
    this.valid = this._data.value !== undefined || this._data.formula === undefined;
    this._dep = [];
  },
  formula: function(formula, value, emit) {
    if(arguments.length > 0) {
      if(arguments.length < 3) {
        emit = true;
      }
      this.valid = value !== undefined;
      this._data.formula = formula;
      if(value !== undefined) {
        this._data.value = value;
      } else {
        delete this._data.value;
      }
      delete this._error;
      if(emit) {
        this.emit("changed");
      }
      return;
    }
    return this._data.formula;
  },
  _clearDependencies: function() {
    if(!this._dep || !this._dep.length) return;
    for(var i=0, mi=this._dep.length;i<mi;++i) {
      this._dep[i].call && this._dep[i]();
    }
    this._dep = [];
  },
  dependency: function(dep) {
    this._dep.push(dep);
  },
  _createDependencies: function() {
    var self = this;
    for(var i=0; i<this._dep.length; ++i) {
      (function(i) {
        var dep = self._dep[i];
        dep.on("cell:changed", function(e) {
          self.valid = false;
          delete self._data.value;
          self.emit("changed");
        });
        self._dep[i] = function() { dep.destroy(); };
      })(i);
    };
  },
  valueOfCached: function() {
    if(this._error !== undefined) throw this._error;
    var v = this._data.value;
    if(v === undefined || v === "") return "";
    if(isNaN(v)) return v.valueOf();
    return Number(v);
  },
  valueOf: function() {
    if(this.valid) { return this.valueOfCached(); }
    if(this._running) { throw new Error("Circular dependency"); }
    var self = this;
    delete this._error;
    this._running = true;
    this._clearDependencies();
    try {
      var value = this._data.formula;
      if(value !== undefined && value[0] === "=") {
        value = Scripting.compile(this, value.substring(1))(this);
      }
    } catch(e) {
      this._error = e;
      value = undefined;
    }
    this.valid = true;
    this._running = false;
    this._data.value = value;
    this._createDependencies();
    return this.valueOfCached();
  }
});

