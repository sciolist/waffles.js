var Span = require("./span").Span;

var Macro = exports.Macro = {
  VALUES: function(args) {
    var results = [];
    if(args && (!args.length || (args.length && args.substr))) {
      return [args];
    }

    for(var i=0; i<args.length; ++i) {
      var value = args[i];

      if(value instanceof Span) {
        var cells = value.values();
        if(!cells || !cells.length) continue;
        for(var j=0; j<cells.length; ++j) {
          results.push(cells[j]);
        }
        continue;
      }

      if(value && value.length && !value.substr) {
        for(var j=0; j<value.length; ++j) {
          results.push(value[j]);
        }
        continue;
      }

      results.push(value);
    };
    return results;
  },
  REDUCE: function() {
    var args = Array.prototype.slice.call(arguments);
    var aggregator = args.pop();
    var seed = undefined;
    if(!aggregator.call) {
      seed = aggregator;
      aggregator = args.pop();
    }
    if(args.length === 1 && !isNaN(args[0].length)) {
      args = Array.prototype.slice.call(args[0]);
    }
    var values = Macro.VALUES(args);
    if(seed === undefined) {
      seed = values.shift();
    }
    for(var i=0; i<values.length; ++i) {
      var value = values[i];
      if(value) value = value.valueOf();
      seed = aggregator(seed, value);
    }
    return seed;
  },
  MAP: function() {
    var args = Array.prototype.slice.call(arguments);
    var mapper = args.pop();

    if(args.length === 1 && !isNaN(args[0].length) && !args[0].substr) {
      args = Array.prototype.slice.call(args[0]);
    }

    var values = Macro.VALUES(args);
    for(var i=0; i<values.length; ++i) {
      values[i] = mapper(values[i]);
    }
    return values;
  },
  FILTER: function() {
    var args = Array.prototype.slice.call(arguments);
    var filter = args.pop();
    var values = Macro.VALUES(args);
    var results = [];
    for(var i=0; i<values.length; ++i) {
      var value = values[i];
      if(filter(value)) results.push(value);
    }
    return results;
  },
  ZIP: function(first, second, mapper) {
    var a = Macro.VALUES(first||[]);
    var b = Macro.VALUES(second||[]);
    if(!mapper) mapper = function(aa, bb) { return [aa, bb]; }
    var results = [];
    for(var i=0; i<a.length; ++i) {
      results.push(mapper(a[i], b[i]));
    }
    return results;
  },
  DATE: function() { return new Date(); },
  COUNT: function() { return Macro.REDUCE(arguments, function(c, n) { return c + 1; }); },
  SUM: function() { return Macro.REDUCE(arguments, function(c, n) { return isNaN(n) ? c : Number(c + n); }, 0); },
  MIN: function() { return Macro.REDUCE(arguments, function(c, n) { return isNaN(n) ? c : Math.min(c, n); }); },
  MAX: function() { return Macro.REDUCE(arguments, function(c, n) { return isNaN(n) ? c : Math.max(c, n); }); },
  UPPER: function() { return Macro.MAP(arguments, function(c){return c&&c.toString().toUpperCase();}); },
  LOWER: function() { return Macro.MAP(arguments, function(c){return c&&c.toString().toLowerCase();}); },
  TRIM: function() { return Macro.MAP(arguments, function(c){return c&&c.toString().trim();}); },
  INDEXOF: function() {
    var args = Array.prototype.slice.call(arguments);
    var startIndex = args.pop();
    var searchValue = "";
    if(isNaN(startIndex)) {
      searchValue = startIndex;
      startIndex = 0;
    }
    else searchValue = args.pop();
    return Macro.MAP(args, function(c) { return c&&c.toString().indexOf(searchValue, startIndex); });
  },
  SUBSTR: function() {
    var args = Array.prototype.slice.call(arguments);
    var startAt = args.pop();
    var length = Number.MAX_VALUE;
    if(!isNaN(args[args.length-1])) {
      length = startAt;
      startAt = args.pop();
    }
    return Macro.MAP(args, function(c) { return c&&c.toString().substr(startAt, length); });
  },
  SUB: function() {
    var args = Array.prototype.slice.call(arguments);
    var value = args.pop();
    var pattern = args.pop();
    return Macro.MAP(args, function(c) { return c&&c.toString().replace(pattern, value); });
  },
  AVG: function() {
    var values = Macro.VALUES(arguments);
    var sum = Macro.SUM(values);
    return sum / values.length;
  }
};
