var Sheet = require("./sheet").Sheet;
var Span = require("./span").Span;
var util = require("./util");

exports.Book = util.Class(function Book(def) {
  this.inherit(util.Evented);

  def.constructor = function(data) {
    util.Evented.constructor.call(this);
    this.data = util.merge(data || {}, {
      sheets: {},
      regions: {}
    });

    this._regions = {};
    this._sheets = {};
    if(this.data.code) {
      new Function("book", this.data.code).call(this, this);
    }
  }

  def.sheets = function() {
    var list = [];
    for(var key in this._data.sheets) {
      list.push(key);
    }
    return list;
  };

  def.sheet = function(name, create) {
    if(arguments.length === 1) create = true;
    var self = this;
    var sheet = this._sheets[name];
    if(!sheet) {
      var data = this.data.sheets[name];
      if(!data) {
        if(!create) return;
        data = this.data.sheets[name] = {};
      }
      sheet = this._sheets[name] = new Sheet(this, name, data);
      sheet.onAny(function(evt) {
        var e = util.clone(evt) || {};
        e.sheet = this;
        self.emit("sheet." + this.event, e);
      });
      this.emit("sheet.new", { sheet: sheet });
    }
    return sheet;
  };

  def.region = function(name, span) {
    if(arguments.length == 2) {
      this.data.regions[name] = {
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
    if(this.data.regions.hasOwnProperty(name)) {
      var data = this.data.regions[name];
      var sheet = this.sheet(data.sheet, false);
      return this._regions[name] = new Span(sheet,data.x,data.y,data.width,data.height);
    }
    return null;
  };

});

