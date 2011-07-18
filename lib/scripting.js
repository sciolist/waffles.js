var Macro = require("./macro").Macro;
var Span = require("./span").Span;

// Load CoffeeScript.
var Coffee = typeof CoffeeScript === "undefined" ? require("coffee-script") : CoffeeScript;
if(!Coffee.require) Coffee.require = function(v) {
  return require("coffee-script/lib/" + v.substring(1));
}

var Scripting = exports.Scripting = {};
Scripting.SPAN_RX = /^(?:([\w\d]+)\!)?([A-Z]+\d+)(?:\:([A-Z]+\d+))?/;
Scripting.compile = function(cell, code) {
  var sheet = cell ? cell.owner : null;
  var book = sheet ? sheet.owner : null;

  var parser = Coffee.require("./parser");
  var lexer = new (Coffee.require("./lexer").Lexer);
  
  // rewrite A1:A10 to Scripting.span("A1:A10", this)
  var old = lexer.identifierToken;
  lexer.identifierToken = function() {
    var match;
    if(!(match = Scripting.SPAN_RX.exec(this.chunk))) {
      return old.apply(this, arguments);
    }
    this.token("IDENTIFIER", "Scripting.parseSpan('" + match[0] + "', cell)");
    return match[0].length
  }
  
  // Tokenize and wrap with a return statement.
  var tokens = [
    ["RETURN", "return", 0],
    ["PARAM_START", "(", 0],
    ["IDENTIFIER", "cell", 0],
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
    if(book && book.region(token[1])) {
      token[1] = "Scripting.parseSpan('" + token[1].replace("'", "\'") + "', cell)";
    }
  };

  var results = parser.parse(tokens);
  var js = results.compile();
  return eval(js);
}
Scripting.number = function(value) {
  if(!value) return null;
  var rx = /^([A-Z]+)([1-9]\d*)$/;
  var match = value.match(rx);
  
  var column = 0;
  var min = "A".charCodeAt(0);
  var ch = match[1];
  for(var i=ch.length-1; i>=0; --i) {
    var pow = ch.length-i-1;
    var val = ch[i].charCodeAt(0) - min;
    column += Math.pow(26, pow)*(val+1);
  };
  var result = [ column - 1, Number(match[2]) - 1 ];
  return result;
};
Scripting.parseSpan = function(value, cell) {
  var sheet = cell && cell.owner;
  var book = sheet && sheet.owner;
  var region = book && book.region(value);
  if(region) {
    return region;
  }

  var match = value.match(Scripting.SPAN_RX);
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
  
  var parsedFrom = Scripting.number(match[2]) || [0,0];
  var parsedTo = Scripting.number(match[3]) || parsedFrom;

  var fromX = Math.min(parsedTo[0], parsedFrom[0]);
  var fromY = Math.min(parsedTo[1], parsedFrom[1]);
  var toX = Math.max(parsedTo[0], parsedFrom[0]);
  var toY = Math.max(parsedTo[1], parsedFrom[1]);
  var width = 1 + toX - fromX;
  var height = 1 + toY - fromY;

  var span = new Span(targetSheet, fromX, fromY, width, height);
  if(cell && cell.dependency) cell.dependency(span);
  return span;
}
