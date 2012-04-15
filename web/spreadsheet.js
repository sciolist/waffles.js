function locate(em, add, top) {
  var result = [0, 0];
  if(add) {
    result[0] += em.offsetWidth;
    result[1] += em.offsetHeight;
  }
  while(em && em != top) {
    result[0] += em.offsetLeft;
    result[1] += em.offsetTop;
    em = em.offsetParent;
  }
  return result;
};



var Highlight = Waffles.util.Class(function Highlight(def) {

  def.constructor = function(spreadsheet, span, element) {
    this.span = span;
  };

  def.applyTo = function(spreadsheet, em) {
    var cells = this.minMax(spreadsheet);
    $(em).removeClass("hide-left hide-right hide-top hide-bottom");
    em.className += cells.className;
    if(!cells.min || !cells.max) {
      em.style.cssText = "display:none;"
      return false;
    }
    var start = locate(cells.min, false, spreadsheet.em[0]);
    var end = locate(cells.max, true, spreadsheet.em[0]);
    em.style.cssText = [
      "position:absolute",
      "left:" + (start[0]) + "px",
      "top:" + (start[1]) + "px",
      "width:" + (end[0]-start[0]) + "px",
      "height:" + (end[1]-start[1]) + "px",
      "display:block"
    ].join(";");
      return true;
  };

  def.minMax = function(spreadsheet) {
    var span = spreadsheet.span;

    var minX = this.span.x - span.x;
    var maxX = minX + this.span.width - 1;

    var minY = this.span.y - span.y;
    var maxY = minY + this.span.height - 1;

    var min = spreadsheet.cellAt(Math.max(0,minX), Math.max(0,minY));
    var max = spreadsheet.cellAt(Math.min(span.width-2,maxX), Math.min(span.height-2,maxY));

    var className = "";
    if(minX <  0) className += " hide-left";
    if(maxX >= span.width) className += " hide-right";
    if(minY <  0) className += " hide-top";
    if(maxY >= span.height) className += " hide-bottom";

    return {
      min: min[0],
      max: max[0],
      className: className
    };
  };

});

var Spreadsheet = Waffles.util.Class(function Spreadsheet(def) {

  def.constructor = function(em, book) {
    var self = this;
    this.queue = [];
    this.book = book;

    this.em = $("<div>").addClass("spreadsheet");
    $(em).append(this.em);

    var sheet = book.sheet("Sheet1");
    this.span = new Waffles.Span(sheet, 0, 0, 10, 10);
    this.selection = new Waffles.Span(sheet, 0, 0, 1, 1);
    this.selectionAt = new Waffles.Span(sheet, 0, 0, 1, 1);
    this.selectionFocus = new Waffles.Span(sheet, 0, 0, 1, 1);
    
    this.selectionFocus.on("moved", function() {
      self.selectionAt.location(this);
    });
    this.selectionAt.on("moved", function() {
      self.selection.location(
        Math.min(self.selectionAt.x, self.selectionFocus.x),
        Math.min(self.selectionAt.y, self.selectionFocus.y),
        Math.abs(self.selectionAt.x - self.selectionFocus.x) + 1,
        Math.abs(self.selectionAt.y - self.selectionFocus.y) + 1
      );
    });

    this.selection.on("moved", function() {
      self.scrollToFocus();
      self.updateSelection();
    });
    this.span.on("moved", function() {
      self.hideEditInput();
      self.refreshValues();
    });

    this.span.on("cell.changed", function(e) {
      var span = this;
      self.queue.push(function() {
        self.onVisibleCellChanged(self.cellAt(e.cell.x - span.x, e.cell.y - span.y), e.cell);
      });
    });

    this.createVerticalScroll();
    this.createHorizontalScroll();
    this.createEditInput();
    this.refreshValues();
    this.createSelectionDragger();
    this.selectionSetup();
    this.selectionHighlight = new Highlight(this, this.selection, this._selection);
    
    this.table.mousedown(function(e) {
      e.preventDefault();
    });
    this.em.mouseup(function() {
      self._input.focus();
    });

    setInterval(function() {
      while(self.queue.length) {
        self.queue.pop()();
      }
    }, 16);

    $(function() {
      $(em).prepend(self._table)
      $(window).bind("resize", function() {
        self.refreshValues();
      });
      self.updateSelection();
    });
  };
  
  def.createVerticalScroll = function() {
    var self = this;
    var area = this.span.sheet().area();
    var updatingScroll = false;
    var updatingMove = false;
    
    function refreshSize(value) {
      var loc = Math.max(((value||0) + self.span.height), self.span.sheet().area()[1])|0;
      bar.opts.currentMax = loc + 1;
      bar.scroll();
    }
    
    var bar = new ScrollBar(this.em, {
      delegate: true,
      axis: 2,
      min: 0,
      scale: 1,
      max: area[1],
      step: 1,
      scroll: function(value) {
        var value = this.value();
        refreshSize(value);
        isScrolling = true;
        self.span.location(self.span.x, value);
        isScrolling = false;
      }
    });
    
    var isScrolling = false;
    
    this.span.on("resized", function() {
      refreshSize(bar.value());
    });
    
    this.span.on("moved", function() {
      if(isScrolling) { return; }
      bar.scroll(self.span.y*10);
    });
  },
  
  def.createHorizontalScroll = function() {
    var self = this;
    var area = this.span.sheet().area();
    var updatingScroll = false;
    var updatingMove = false;
    
    function refreshSize(value) {
      var loc = Math.max(((value||0) + self.span.width), self.span.sheet().area()[0])|0;
      bar.opts.currentMax = loc + 1;
      bar.scroll();
    }
    
    var bar = new ScrollBar(this.em, {
      delegate: true,
      axis: 1,
      dir: "x",
      min: 0,
      scale: 1,
      max: area[0],
      step: 1,
      scroll: function(value) {
        var value = this.value();
        refreshSize(value);
        isScrolling = true;
        self.span.location(value, self.span.y);
        isScrolling = false;
      }
    });
    
    var isScrolling = false;
    
    this.span.on("resized", function() {
      refreshSize(bar.value());
    });
    
    this.span.on("moved", function() {
      if(isScrolling) { return; }
      bar.scroll(self.span.x * 10);
    });
  };




  // SELECTION BOX
  def.createSelectionDragger = function() {
    this._selection = $("<div>").addClass("selection-wrapper");
    $("<div>").addClass("selection").appendTo(this._selection);
    $("<div>").addClass("drag").appendTo(this._selection);
    this.em.prepend(this._selection);
  };
  def.selectionRing = function() {
    if(!this._selection) { return; }
    this.selectionHighlight.applyTo(this, this._selection[0]);
  };

  def.select = function(fromCell, toCell) {
    this.hideEditInput();
    this.selectionFocus.location(this.getSpanXY(fromCell));
    if(arguments.length > 1) {
      this.selectionAt.location(this.getSpanXY(toCell));
    }
  };

  def.getSpanXY = function(cell) {
    if(cell.attr) {
      return {
        x: this.span.x + Number(cell.attr("data-x")),
        y: this.span.y + Number(cell.attr("data-y"))
      }
    }
    return {x: this.span.x + cell.x, y: this.span.y + cell.y };
  },

  def.selectionSetup = function() {
    var self = this;
    var startAt = 0;
    var mxy = null;
    var dragTarget = null;
    var dragMode = null;

    $(document).bind("mouseup", "click", function(e) {
      dragMode = null;
    });

    this.table.delegate("td.header-xy", "click", function(e) {
      var sheet = self.span.sheet();
      self.selectionFocus.location(self.span.x, self.span.y);
      self.selection.location(0, 0, sheet.width, sheet.height);
    });

    // Header X
    this.table.delegate("td.header-x", "mousedown", function(e) {
      e.preventDefault();
      if(dragMode) { return; }
      self.hideEditInput();
      dragMode = "header-x";

      var height = self.span.sheet().height;
      var x = Number($(this).data("header-x")) + self.span.x;
      self.selectionAt.location(x, self.span.y, 1, 1);
      self.selectionFocus.location(x, self.span.y, 1, 1);
      self.selection.location(x, 0, 1, height);
      startAt = x;
    });
    this.table.delegate("td.header-x", "mouseover", function(e) {
      if(dragMode !== "header-x") { return; }

      e.preventDefault();
      var height = self.span.sheet().height;
      var x = Number($(this).data("header-x")) + self.span.x;
      var width = startAt + 1 - x;
      if(width <= 0) {
        width = x + 1 - startAt;
        x = startAt;
      }
      self.selection.location(x, 0, Math.max(1, width), height);
    });
    this.table.delegate("td.header-x", "click", function(e) {
      self.hideEditInput();
      var height = self.span.sheet().height;
      var x = Number($(this).data("header-x")) + self.span.x;
      self.selectionAt.location(x, self.span.y, 1, 1);
      self.selectionFocus.location(x, self.span.y, 1, 1);
      self.selection.location(x, 0, 1, height);
    });

    // Header Y
    this.table.delegate("td.header-y", "mousedown", function(e) {
      e.preventDefault();
      if(dragMode) { return; }
      self.hideEditInput();
      dragMode = "header-y";

      var width = self.span.sheet().width;
      var y = Number($(this).data("header-y")) + self.span.y;
      self.selectionAt.location(self.span.x, y, 1, 1);
      self.selectionFocus.location(self.span.x, y, 1, 1);
      self.selection.location(0, y, width, 1);
      startAt = y;
    });
    this.table.delegate("td.header-y", "mouseover", function(e) {
      if(dragMode !== "header-y") { return; }

      e.preventDefault();
      var width = self.span.sheet().width;
      var y = Number($(this).data("header-y")) + self.span.y;
      var height = startAt + 1 - y;
      if(height <= 0) {
        height =  y - startAt;
        y = startAt;
      }
      self.selection.location(0, y, width, Math.max(1, height));
    });
    this.table.delegate("td.header-y", "click", function(e) {
      self.hideEditInput();
      var width = self.span.sheet().width;
      var y = Number($(this).data("header-y")) + self.span.y;
      self.selection.location(0, y, width, 1);
    });


    // Oh dear lord
    setInterval(function() {
      if(!dragMode || !mxy) return;

      var inSheet = $(dragTarget).closest("div.spreadsheet").length > 0;
      var inCell = $(dragTarget).closest("td.data").length > 0;

      switch(dragMode) {
        case "cell":
          if(inSheet) return;
          self.selectionAt.location(mxy.x + self.span.x, mxy.y + self.span.y);
          break;
        case "header-x":
          if(inSheet && !inCell) return;
          var height = self.span.sheet().height;
          var x = Math.max(0, mxy.x + self.span.x);

          self.selectionAt.location(x, 0);
          var width = Math.abs(self.selectionFocus.x - x) + 1;
          x = Math.min(x, self.selectionFocus.x);
          self.selection.location(x, 0, Math.max(1, width), height);
          break;
        case "header-y":
          if(inSheet && !inCell) return;
          var width = self.span.sheet().width;
          var y = Math.max(0, mxy.y + self.span.y);

          self.selectionAt.location(0, y);
          var height = Math.abs(self.selectionFocus.y - y) + 1;
          y = Math.min(y, self.selectionFocus.y);
          self.selection.location(0, y, width, Math.max(1, height));
          break;

      }

    }, 40);

    $(document).mousemove(function(e) {
      mxy = null;
      if(!dragMode) return;
      dragTarget = e.target;
      var emXY = self.em.offset();
      var sizes = self.span.sheet().sizes();
      var mouseX = e.pageX - emXY.left, invX = mouseX < 0;
      var mouseY = e.pageY - emXY.top, invY = mouseY < 0;

      var dx = -1;
      while(true) {
        var w = (sizes[dx + self.span.x] || self.defaultWidth) + 4;
        mouseX += invX ? w : -w;
        if(invX ? mouseX > 0 : mouseX < 0) break;
        dx += invX ? -1 : 1;
      }

      var dy = -1;
      while(true) {
        var h = (sizes[dy + self.span.y] || self.defaultHeight) + 4;
        mouseY += invY ? h : -h;
        if(invY ? mouseY > 0 : mouseY < 0) break;
        dy += invY ? -1 : 1;
      }
      mxy = { x: dx, y: dy };
     });

    // CELLS
    this.table.delegate("td[data-x]", "mousedown", function(e) {
      e.preventDefault();
      if(dragMode) { return; }
      self.hideEditInput();
      dragMode = "cell";
      var x = $(this).data("x"), y = $(this).data("y");
      self.selectionFocus.location(self.span.x + x, self.span.y + y);
    });
    this.table.delegate("td[data-x]", "mouseover", function(e) {
      if(dragMode !== "cell") { return; }
      var x = $(this).data("x"), y = $(this).data("y");
      self.selectionAt.location(self.span.x + x, self.span.y + y);
    });
    this.table.delegate("td[data-x]", "click", function(e) {
      self.hideEditInput();
      var x = $(this).data("x"), y = $(this).data("y");
      self.selectionFocus.location(self.span.x + x, self.span.y + y);
    });

    this.table.delegate("td[data-x]", "dblclick", function(e) {
      self.select.call(self, $(this));
      self.showEditInput();
    });
  };





  // INPUT SETUP
  def.createEditInput = function() {
    var self = this;
    var inputWrapper = this._inputWrapper = $("<div>").addClass("hidden").addClass("input-wrapper").appendTo(this.em);
    var input = this._input = $("<textarea wrap=off>").addClass("input").appendTo(inputWrapper);
    var em = input[0];

    input.keyup(function(e) {
      var isVisible = !inputWrapper.hasClass("hidden");
      switch(e.which) {
          case 27:
            self.hideEditInput(false);
            if(!isVisible) { self.showEditInput(); }
            e.preventDefault();
            break;
      }
      if(isVisible) self.fitEditInput();
    });
    
    input.keydown(function(e) {
      var isVisible = !inputWrapper.hasClass("hidden");

      if(isVisible) {
        // Runs in edit mode.
        switch(e.which) {
          case 37: // L
            if(e.ctrlKey || (em.selectionStart === 0 && em.selectionEnd === 0)) {
              self.hideEditInput();
              self.moveSelection(e.shiftKey, -1, 0);
            }
            break;
          case 39: // R
            if(e.ctrlKey || (em.selectionStart === em.value.length && em.selectionEnd === em.value.length)) {
              self.hideEditInput();
              self.moveSelection(e.shiftKey, 1, 0);
            }
            break;          
          case 38: // U
            self.hideEditInput();
            self.moveSelection(e.shiftKey, 0, -1);
            break;
          case 40: // D
            self.hideEditInput();
            self.moveSelection(e.shiftKey, 0, 1);
            break;
          case 13:
            self.hideEditInput();
            self.moveSelection(false, 0, e.shiftKey ? -1 : 1);
            break;
        }
        return;
      }

      // Runs OUTSIDE edit mode.
      switch(e.which) {
        case 27:
        case 16:
        case 17:
        case 18: 
        case 224:
          break;
        case 13: // enter
          if(e.ctrlKey) {
            self.showEditInput();
            return;
          }
          self.hideEditInput();
          self.moveSelection(false, 0, e.shiftKey ? -1 : 1);
          break;
        case 37: // L
          self.moveSelection(e.shiftKey, -1, 0);
          break;
        case 38: // U
          self.moveSelection(e.shiftKey, 0, -1);
          break;
        case 39: // R
          self.moveSelection(e.shiftKey, 1, 0);
          break;
        case 40: // D
          self.moveSelection(e.shiftKey, 0, 1);
          break;

        case 33: // Page up
          self.moveSelection(e.shiftKey, 0, -self.span.height);
          break;
        //case 32: // Space
        case 34: // Page dn
          self.moveSelection(e.shiftKey, 0, self.span.height * 2);
          self.moveSelection(e.shiftKey, 0, -self.span.height);
          break;
        case 35:
          self.moveSelection(e.shiftKey, self.span.width * 2, 0);
          self.moveSelection(e.shiftKey, -self.span.width, 0);
          break;
        case 36:
          self.moveSelection(e.shiftKey, -self.span.width, 0);
          break;

        default:
          self.showEditInput();
          break;
      }
    });
  };


















  def.editInputVisible = function() {
    return !this._inputWrapper.hasClass("hidden");
  };

  def.scrollToFocus = function() {
    this._scrollToFocus = true;
    var dx = 0, dy = 0;

    if(this.selectionAt.y < this.span.y) {
      dy = this.selectionAt.y - this.span.y;
    } else {
      var ry = this.defaultHeight, max = this.em.height(), sheet = this.span.sheet();
      var sizes = sheet.sizes();
      for(var y=this.span.y; y<=this.selectionAt.y; ++y) {
        ry += (sizes.y[y] || this.defaultHeight + 3);
        if(ry >= max) {
          dy = this.selectionAt.y - y + 1;
          break;
        }
      }
    }

    if(this.selectionAt.x < this.span.x) {
      dx = this.selectionAt.x - this.span.x;
    } else {
      var rx = this.defaultWidth, max = this.em.width(), sheet = this.span.sheet();
      var sizes = sheet.sizes();
      for(var x=this.span.x; x<=this.selectionAt.x; ++x) {
        if(rx < max) rx += (sizes.x[x] || this.defaultWidth + 3);
        if(rx >= max) {
          dx = this.selectionAt.x - x + 1;
          break;
        }
      }
    }

    if(dx !== 0 || dy !== 0) {
      this.span.moveBy(dx, dy);
    }
    this._scrollToFocus = false;
  };

  def.dataCell = function(cell, create) {
    var x = Number(cell.x||cell.attr("data-x"));
    if(x == null) { return; }
    var y = Number(cell.y||cell.attr("data-y"));
    return this.span.cell(x, y, !!create);
  };

  def.hideEditInput = function(update) {
    if(this._inputWrapper.hasClass("hidden")) { return; }
    this._inputWrapper.addClass("hidden");
    this._inputWrapper[0].style.cssText = "";
    var newValue = this._input.val();
    if(update !== false) {
      var dataCell = this.selectionFocus.cell(0,0,!!newValue);
      if(dataCell && dataCell.formula() != newValue) {
        dataCell.formula(newValue);
      }
    }
    this._input.val("").select();
  };

  def.fitEditInput = function() {
    var sel = this.selectionFocus;
    var cell = this.cellAt(sel.x, sel.y);

    var w = cell.outerWidth();
    var requires = this._input[0].scrollWidth - 2;
    var maxX = this.span.x + this.span.width - 3;
    var x = 1;

    if(requires > this._input.width()) {
      while(w < requires) {
        var cell = this.cellAt(x + sel.x - this.span.x, sel.y);
        if(!cell || sel.x + x >= maxX) break;

        w += cell.outerWidth();
        x += 1;
      }
      this._input.width(w);
    }

    if(jQuery.browser.mozilla) { // FF doesn't autoscroll in wrap=off textareas..
      this._input[0].scrollLeft = this._input[0].selectionStart;
    }
  };

  def.showEditInput = function(updateValue) {
    this.scrollToFocus();

    var cellLocation = {x:this.selectionFocus.x,y:this.selectionFocus.y};
    var cell = this.cellAt(cellLocation.x-this.span.x, cellLocation.y-this.span.y);
    if(!cell) { return; }
    var dataCell = this.dataCell(cell, false);
    this._inputWrapper.offset(cell.offset()).removeClass("hidden");
    this._input.width(cell.outerWidth())
      .height(cell.outerHeight())
      .css("line-height", cell[0].childNodes[0].style.lineHeight);
    if(updateValue !== false) {
      this._input.val(dataCell ? dataCell.formula() : "").select();
    }
    this.fitEditInput();
  };


  def.assignValue = function(node, dataCell) {
    if(node.length) { node = node[0]; }
    if(node.nodeName == "TD") { node = node.childNodes[0].childNodes[0].childNodes[0]; }
    var td = node.parentNode.parentNode.parentNode;
    $(td).removeClass("error");

    var value;
    try {
      value = dataCell ? dataCell.valueOf() : "";
      if(value === undefined) { value = ""; }
    } catch(e) {
      $(td).addClass("error");
      value = this.getErrorMessage(e);
    }
    if(node.nodeValue !== value) {
      node.nodeValue = value;
    }

    if(dataCell) this.resizeToFit(node.parentNode, dataCell);
  };

  def.getErrorMessage = function(err) {
    if(err.message) return err.message;
    return "#ERR";
  };

  def.onVisibleCellChanged = function(node, dataCell) {
    this.refreshInnerValues();
  };

  // Fills up empty neighbours if a cell is overflowing.
  def.resizeToFit = function(node, dataCell, log) {
    var self = this;
    var reset = [];

    var w = $(node).parent().width(), x = 1;
    $(node).width(w);
    var requires = node.scrollWidth - 4;
    var last = $(node).closest("td");

    var needsResizing = w < requires;
    while(w < requires) {
      var nextEm = this.cellAt(dataCell.x + x - this.span.x, dataCell.y - this.span.y)[0];
      if(!nextEm) { break; }
      var text = nextEm.childNodes[0].childNodes[0].childNodes[0];
      if(text && /[^\s]/.test(text.nodeValue)) break;
      if(last) last.addClass("overflowing-from");
      last = $(nextEm).closest("td");
      last.addClass("overflowing-into");
      last.addClass("overflowing");
      w += nextEm.clientWidth;
      x += 1;
    }

    if(!needsResizing) return;
    if(x > 1) {
      $(node).width(w).closest("td").addClass("overflowing overflowing-from");
    }
  };


  def.headersInSpan = function(span) {
    var minX = span.x - this.span.x, maxX = minX + span.width;
    var minY = span.y - this.span.y, maxY = minY + span.height;
    if(minX < 0 && minY < 0 && maxX < 0 && maxY < 0) { return $([]); }
    var cellSelector = "td.header-x:not(:nth-child(n+" + (2+Math.max(0,maxX)) + ")):nth-child(n+" + (2+Math.max(0,minX)) + ")";
    var rowSelector = "tr:not(:nth-child(n+" + (2+Math.max(0,maxY)) + ")):nth-child(n+" + (2+Math.max(0,minY)) + ") td.header-y";
    return this.table.find(rowSelector + ", " + cellSelector);
  };

  def.cellsInSpan = function(span) {
    var minX = span.x - this.span.x, maxX = minX + span.width;
    var minY = span.y - this.span.y, maxY = minY + span.height;
    if(minX < 0 && minY < 0 && maxX < 0 && maxY < 0) { return $([]); }
    var cellSelector = "td.data:not(:nth-child(n+" + (2+Math.max(0,maxX)) + ")):nth-child(n+" + (2+Math.max(0,minX)) + ")";
    var rowSelector = "tr:not(:nth-child(n+" + (2+Math.max(0,maxY)) + ")):nth-child(n+" + (2+Math.max(0,minY)) + ")";
    return this.table.find(rowSelector + " " + cellSelector);
  };

  def.cellAt = function(x, y) {
    if(x < 0 || y < 0) { return $(); }
    var rows = this.table[0].rows;
    if(!rows || rows.length <= y+1) { return $(); }
    var cells = rows[y+1].cells;
    if(!cells) { return $(); }
    return $(cells[x+1]);
  };

  def.updateSelection = function updateSelection() {
    this.table.find(".selected").removeClass("selected");
    this.headersInSpan(this.selection).addClass("selected");
    this.cellsInSpan(this.selectionFocus).addClass("selected");
    this.selectionRing();
    if(!this.span.contains(this.selectionFocus)) {
      this.hideEditInput();
    }
    if(this.editInputVisible()) {
      this.showEditInput(false);
    }
  };
  
  def.moveSelection = function(resize, x, y) {
    if(resize) {
      this.selectionAt.moveBy(x, y);
    } else {
      this.selectionFocus.moveBy(x, y);
    }
  };

  def.defaultWidth = 80;
  def.defaultHeight = 23;

  def.refreshInnerValues = function refreshInnerValues() {
    var cells = this.span.cells();
    var cellMap = [];
    for(var i=0; i<cells.length; ++i) {
      cellMap[(cells[i].y - this.span.y) * this.span.width + cells[i].x - this.span.x] = cells[i];
    }
    
    var table = this.table[0];
    for(var y=table.rows.length-1; y>=1; --y) {
      var row = table.rows[y];
      for(var x=row.cells.length-1; x>=1; --x) {
        var cell = row.cells[x];
        cell.className = "data";
        var dataCell = cellMap[(y - 1) * this.span.width + (x - 1)];
        this.assignValue(cell, dataCell);
      }
    }
  };

  def.refreshValues = function refreshValues() {
    if(!this.table) {
      this.table = $("<table>").appendTo(this.em);
    }
    var self = this;
    var defaultWidth = this.defaultWidth;
    var defaultHeight = this.defaultHeight;
    var tbl = this.table, tblEm = tbl[0];
    var sizes = this.span.sheet().sizes();

    var fullWidth = $(this.em).width(), fullHeight = $(this.em).height();
    var mx, currentWidth;
    for(mx=1, currentWidth=defaultWidth; currentWidth < fullWidth; ++mx) {
      currentWidth += (sizes.x[this.span.x + mx] || defaultWidth);
    }
    var my, currentHeight;
    for(my=0, currentHeight=defaultHeight; currentHeight < fullHeight; ++my) {
      currentHeight += sizes.y[this.span.y + my] || defaultHeight;
    }
    if(this.span.width != mx || this.span.height != my) {
      this.span.size(mx, my);
      return;
    }
    
    if(this._refreshCache && this._refreshCache.equalTo(this.span)) return;
    this._refreshCache = Waffles.util.clone(this.span);
    tbl.width(currentWidth);
    for(var y=my; ; ++y) {
      var row = tblEm.rows[y];
      if(!row) break;
      try { tblEm.removeChild(row); } catch(e) { }
    }

    for(var y=0; y<my; ++y) {
      var row = tblEm.rows[y] || $("<tr>").appendTo(tbl)[0];

      for(var x=mx; ;++x) {
        var cell = row.cells[x];
        if(!cell) break;
        row.removeChild(cell);
      }
      
      for(var x=0; x<mx; ++x) {
        var cell = row.cells[x];
        var newCell = !cell;

        if(newCell) {
          cell = $("<td>").appendTo(row)[0];
          var text = document.createElement("div");
          text.appendChild(document.createTextNode(""));

          var wrapper = document.createElement("div");
          wrapper.appendChild(text);
          cell.appendChild(wrapper);
          // cell.style.height = (sizes.y[this.span.y + y-1] || defaultHeight) + "px";
        }

        var wrapper = cell.childNodes[0];
        var text = wrapper.childNodes[0];
        cell.style.height = (sizes.y[this.span.y + y-1] || defaultHeight) + "px";
        cell.style.width  = (sizes.x[this.span.x + x-1] || defaultWidth) + "px";
        
        if(x === 0 && y === 0) {
          // TOP LEFT HEADER
          cell.className = "header header-xy";
          cell.style.height = defaultHeight + "px";
          cell.style.width = defaultWidth + "px";

        } else if(x === 0) {
          // LEFT HEADER
          cell.className = "header header-y header-y" + (y - 1);
          cell.setAttribute("data-header-y", y-1);
          text.childNodes[0].nodeValue = this.span.y + y;
          cell.style.width = defaultWidth + "px";


        } else if(y === 0) {
          // TOP HEADER
          cell.className = "header header-x header-x" + (x - 1);
          cell.setAttribute("data-header-x", x-1);
          text.childNodes[0].nodeValue = Waffles.Scripting.columnName(this.span.x+x);
          cell.style.height = defaultHeight + "px";
          

        } else {
          // VALUE COLUMN
          cell.setAttribute("data-x", x-1);
          cell.setAttribute("data-y", y-1);
          cell.className = "data";
        }

        wrapper.style.height = cell.style.height;
        wrapper.style.width = cell.style.width;
        wrapper.style.lineHeight = cell.style.height;
      }
    }
    this.refreshInnerValues();
    this.updateSelection();
  }
});

