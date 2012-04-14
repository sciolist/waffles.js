var Scripting = require("./scripting").Scripting;
var util = require("./util");
function isNumeric(v) { return /^\d+(\.\d+)?$/.test(v); };

exports.CircularDependencyError = util.Class(function CircularDependencyError(def) {
  this.inherit(Error);

  def.constructor = function() {
    this.message = "Circular dependency";
    this.type = "#CIRC";
  }
});

exports.Cell = util.Class(function Cell(def) {
  this.inherit(util.Evented);

  def.constructor = function(owner, data, x, y) {
    util.Evented.constructor.call(this);
    if(!data) data = {}
    this.owner = owner;
    this.x = x;
    this.y = y;
    this._data = data;
    this.valid = this._data.formula === undefined;
    this._dep = [];
  };

  def.name = function() {
    return Scripting.cellName(this.x+1, this.y);
  };

  def.formula = function(formula, value, emit) {
    if(arguments.length === 0) {
      return this._data.formula;
    }
    if(arguments.length < 3) {
      emit = true;
    }

    this.valid = value !== undefined;
    this._data.formula = formula;
    if(value !== undefined) {
      this._value = value;
    } else {
      delete this._value;
    }
    delete this._error;
    if(emit) { this.emit("changed"); }
    if(this._data.formula === undefined || this._data.formula === "" || this._data.formula === null) {
      this.owner.deleteCell(this.x, this.y);
    }
  };

  def._clearDependencies = function() {
    if(!this._dep || !this._dep.length) return;
    for(var i=0, mi=this._dep.length;i<mi;++i) {
      this._dep[i].call && this._dep[i]();
    }
    this._dep = [];
  };

  def.dependency = function(span) {
    this._dep.push(span);
  };

  def._createDependencies = function() {
    var self = this;
    for(var i=0; i<this._dep.length; ++i) {
      if(!this._dep[i].on) continue;
      (function() {
        var span = self._dep[i];
        function onChange() {
          if(!self.valid || self._running) return;
          self.valid = false;
          delete self._value;
          self.emit("changed");
        }
        span.on("cell.changed", onChange);
        self._dep[i] = function() {
          span.off("cell.changed", onChange);
        }
      })(i);
    }
  };

  def.value = function(v) {
    if(arguments.length === 0) {
      return this.valueOf();
    }
    this._value = v;
    this.valid = true;
    this._error = null;
    this.emit("changed");
  };

  def.valueOfCached = function() {
    if(this._error) {
      console && console.error(this._error);
      throw this._error;
    }

    var v = this._value;
    if(v === undefined || v === "") return "";
    if(!isNumeric(v)) return v.valueOf();
    return Number(v);
  };

  def.valueOf = function() {
    if(this._running) { throw new exports.CircularDependencyError(); }
    this._running = true;

    if(this.valid) {
      try {
        return this.valueOfCached();
      } finally {
        this._running = false;
      }
    }

    delete this._error;
    this.valid = true;
    this._clearDependencies();
    try {
      var value = this._data.formula;
      if(value !== undefined && value[0] === "=") {
        var compiled = Scripting.compile(this, value.substring(1));
        value = compiled(this);
        if(value) value = value.valueOf();
      }
    } catch(e) {
      this._error = e;
      console && console.error(e);
      value = undefined;
      throw e;
    }
    finally {
      this.valid = true;
      this._running = false;
      this._value = value;
      this._createDependencies();
    }
    return this.valueOfCached();
  };

});

