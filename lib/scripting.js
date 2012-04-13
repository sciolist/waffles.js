var Macro = require("./macro").Macro;
var Span = require("./span").Span;

// Load CoffeeScript.
var Coffee = typeof CoffeeScript === "undefined" ? require("coffee-script") : CoffeeScript;
if(!Coffee.require) {
  Coffee.require = function(v) {
    return require("coffee-script/lib/coffee-script/" + v.substring(1));
  }
}

var Scripting = exports.Scripting = {};
Scripting.SPAN_RX = /^(?:([\w\d]+)\!)?([A-Z]+\d+)(?:\:([A-Z]+\d+))?/;
Scripting.SPAN_RX_ALT = /^(?:([\w\d]+)\!)?([A-Z]+)\:([A-Z]+)/;
Scripting.compile = function(cell, code) {
  var sheet = cell ? cell.owner : null;
  var book = sheet ? sheet.owner : null;

  var dependencies = [];
  var parser = Coffee.require("./parser");
  var lexerClass = Coffee.require("./lexer").Lexer;
  var lexer = new lexerClass();
  
  // rewrite A1:A10 to Scripting.span("A1:A10", this)
  var old = lexerClass.prototype.identifierToken;
  lexerClass.prototype.identifierToken = function() {
    var match;
    if(!(match = Scripting.SPAN_RX.exec(this.chunk))) {
      if(!(match = Scripting.SPAN_RX_ALT.exec(this.chunk))) {
        return old.apply(this, arguments);
      }
    }
    // bind span ranges
    this.token("IDENTIFIER", "Span('" + match[0] + "')");
    return match[0].length;
  }
  
  // Tokenize and wrap with a return statement.
  var tokens = [
    ["RETURN", "return", 0],
    ["PARAM_START", "(", 0],
    ["IDENTIFIER", "cell", 0],
    [",", ",", 0],
    ["IDENTIFIER", "Span", 0],
    ["PARAM_END", ")", 0],
    ["->", "->", 0],
    ["INDENT", 2, 0],
    ["OUTDENT", 2, 0] 
    ];
  var method = lexer.tokenize(code);
  method.unshift(tokens.length-1, 0);
  tokens.splice.apply(tokens, method);

  // Replace Macro call tokens
  for(var i=0; i<tokens.length; ++i) {
    var token = tokens[i];
    if(token[0] != "IDENTIFIER") continue;
    if(Macro.hasOwnProperty(token[1]) && token[1][0] !== "_") {
      token[1] = "Macro." + token[1];
      continue;
    }
    if(book && book.region(token[1])) { // bind all region names
      token[1] = "Span('" + token[1].replace("'", "\\'") + "')";
    }
  };

  var results = parser.parse(tokens);
  var js = results.compile();
  var method = eval(js);
  return function(cell) {
    return method.call(cell, cell, function(v) {
      return Scripting.parseSpan(v, cell);
    });
  }
};
Scripting.columnName = function(number) {
  var min = "A".charCodeAt(0) - 1;
  if(number <= 26) {
    return String.fromCharCode(number + min);
  } else {
    var remains = number % 26;
    var mod = parseInt(number / 26);
    if(remains == 0) {
      return Scripting.columnName(mod - 1) + "Z";
    } else {
      return Scripting.columnName(mod) + String.fromCharCode(remains + min);
    }
  }
};
Scripting.cellName = function(x, y) {
  return Scripting.columnName(x) + (1+y).toString();
};
Scripting.number = function(value, max) {
  if(!value) return null;
  var rx = /^([A-Z]+)([1-9]\d*)?$/;
  var match = value.match(rx);
  
  var column = 0;
  var min = "A".charCodeAt(0);
  var ch = match[1];
  for(var i=ch.length-1; i>=0; --i) {
    var pow = ch.length-i-1;
    var val = ch[i].charCodeAt(0) - min;
    column += Math.pow(26, pow)*(val+1);
  };
  var row = max ? 1048576 : 0;
  if(match[2]) {
    row = Number(match[2]) - 1;
  }
  var result = [ column - 1, row ];
  return result;
};
Scripting.parseSpan = function(value, cell) {
  var sheet = cell && cell.owner;
  var book = sheet && sheet.owner;
  var region = book && book.region(value);
  if(region) { return region; }

  var match = value.match(Scripting.SPAN_RX) || value.match(Scripting.SPAN_RX_ALT);
  if(match == null || match[0].length != value.length) {
    throw new Error("Invalid specifier.");
  }

  var targetSheet = sheet;
  if(match[1]) {
    targetSheet = sheet.owner.sheet(match[1], false);
    if(!targetSheet) {
      throw new Error("Sheet not found: ", match[1]);
    }
  }
  
  var parsedFrom = Scripting.number(match[2], false) || [0,0];
  var parsedTo = Scripting.number(match[3], true) || parsedFrom;

  var fromX = Math.min(parsedTo[0], parsedFrom[0]);
  var fromY = Math.min(parsedTo[1], parsedFrom[1]);
  var toX = Math.max(parsedTo[0], parsedFrom[0]);
  var toY = Math.max(parsedTo[1], parsedFrom[1]);
  var width  = 1 + toX - fromX;
  var height = 1 + toY - fromY;

  var span = new Span(targetSheet, fromX, fromY, width, height);
  if(cell && cell.dependency) cell.dependency(span);
  return span;
  //return width == 1 && height == 1 ? span.valueOf() : span;
}
