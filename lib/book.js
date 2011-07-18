var Sheet = require("./sheet").Sheet;
var Span = require("./span").Span;
var util = require("./util");

exports.Book = util.Evented.extend({
  init: function(data) {
    this._data = data || {};
    if(!this._data.sheets) this._data.sheets = {};
    if(!this._data.regions) this._data.regions = {};
    this._regions = {};
    this._sheets = {};
    if(this._data.code) {
      new Function("coffeemill", this._data.code).call(this, exports);
    }
  },
  sheet: function(name, create) {
    if(arguments.length === 1) create = true;
    var self = this;
    var sheet = this._sheets[name];
    if(!sheet) {
      var data = this._data.sheets[name];
      if(!data) {
        if(!create) return;
        data = this._data.sheets[name] = {};
      }
      sheet = this._sheets[name] = new Sheet(this, name, data);
      sheet.on("*", function(evt, sender) {
        var e = util.clone(evt);
        e.sheet = sender;
        self.emit("sheet:" + e.type, e);
      });
    }
    return sheet;
  },
  region: function(name, span) {
    if(arguments.length == 2) {
      this._data.regions[name] = {
        "sheet":span.sheet().name,
        "x":span.x,
        "y":span.y,
        "width":span.width,
        "height":span.height,
      };
      this._regions[name] = span;
      return;
    }
    if(this._regions[name]) {
      var region = this._regions.hasOwnProperty(name) ? this._regions[name] : null;
      return region;
    }
    if(this._data.regions.hasOwnProperty(name)) {
      var data = this._data.regions[name];
      var sheet = this.sheet(data.sheet, false);
      return this._regions[name] = new Span(sheet,data.x,data.y,data.width,data.height);
    }
    return null;
  }
});

