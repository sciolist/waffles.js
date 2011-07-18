var Span = require("./span").Span;

var Macro = exports.Macro = {
  VALUES: function(args) {
    var results = [];
    for(var i=0; i<args.length; ++i) {
      if(args[i] instanceof Span) {
        var cells = args[i].cells();
        if(!cells || !cells.length) continue;
        for(var q=0; q<cells.length; ++q) {
          results.push(cells[q].valueOf());
        }
      } else if(args[i] && args[i].length && !(args[i] instanceof String)) {
        for(var q=0; q<args[i].length; ++q) {
          results.push(args[i][q]);
        }
      }
      else results.push(args[i]);
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
    var values = Macro.VALUES(args);
    for(var i=0; i<values.length; ++i) {
      values[i] = mapper(values[i]);
    }
    return values;
  },
  SUM: function() { return Macro.REDUCE(arguments, function(c, n) { return isNaN(n) ? NaN : c + n; }, 0); },
  MIN: function() { return Macro.REDUCE(arguments, Math.min); },
  MAX: function() { return Macro.REDUCE(arguments, Math.max); },
  
};
