var Scripting = require("./scripting").Scripting;
var util = require("./util");

exports.CircularDependencyError = util.extend(Error, {
  type: "#CIRC",
  init: function() {
    this.message = "Circular dependency";
    Error.prototype.constructor.call(this, this.message);
  }
});

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
  name: function() {
    return Scripting.cellName(this.x+1, this.y);
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
        this.emit("modified");
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
  _createDependencies: function() {
    var self = this;
    for(var i=0; i<this._dep.length; ++i) {
      (function(i) {
        var dep = self._dep[i];
        var rm = dep.on("cell:modified", function(e) {
          self.valid = false;
          delete self._data.value;
          self.emit("changed");
        });
        self._dep[i] = function() { dep.destroy(); rm(); };
      })(i);
    };
  },
  value: function(v) {
    if(arguments.length === 0) {
      return this.valueOf();
    }
    this._data.value = v;
    this.valid = true;
    this._error = null;
    this.emit("modified");
    this.emit("changed");
  },
  valueOfCached: function() {
    if(this._error) throw this._error;
    var v = this._data.value;
    if(v === undefined || v === "") return "";
    if(!this._isNumeric(v)) return v.valueOf();
    return Number(v);
  },
  _isNumeric: function(v) {
    return /^\d+(\.\d+)?$/.test(v);
  },
  valueOf: function() {
    if(this._running) { throw new exports.CircularDependencyError(); }
    this._running = true;

    if(this.valid) {
      try {
        return this.valueOfCached();
      } catch(e) {
        console && console.error(e);
        this._error = e;
        throw e;
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
        this._dep = compiled.dependencies;
        value = compiled.call(this, this);
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
      this._data.value = value;
      this._createDependencies();
    }
    return this.valueOfCached();
  }
});

