var TableView = Waffles.util.Class.extend({
  init: function(em, book) {
    var self = this;
    this.book = book;
    this.em = em.css("overflow", "hidden");
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
      self.refreshValues();
    });
    this.span.on("cell:changed", function(e, span) {
      setTimeout(function() {
        self.onVisibleCellChanged(self.cellAt(e.cell.x - span.x, e.cell.y - span.y), e.cell);
      }, 8);
    });
    
    this.createVerticalScroll();
    this.createHorizontalScroll();
    this.createEditInput();
    this.refreshValues();
    this.createSelectionDragger();
    this.rigMouse();
    $(function() {
      $(em).prepend(self._table)
      $(window).bind("resize", function() {
        self.refreshValues();
      });
      self.updateSelection();
    });
  },
  
  createVerticalScroll: function() {
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
  
  createHorizontalScroll: function() {
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
  },
  
  
  
  rigMouse: function() {
    var isDragging = false;
    var startCell = null;
    var self = this;
    this.table.mousedown(function(e) {
      e.preventDefault();
    });
    this.table.delegate("td[data-x]", "mousedown", function(e) {
      e.preventDefault();
      if(isDragging) { return; }
      isDragging = true;
      startCell = $(this);
      self.select(startCell);
    });
    $(document.body).mouseup(function(e) {
      e.preventDefault();
      isDragging = false;
    });
    this.em.mouseup(function() {
      self._input.focus();
    });
    this.table.delegate("td[data-x]", "mouseover", function(e) {
      if(!isDragging) { return; }
      self.select(startCell, $(this));
    });
    this.table.delegate("td[data-x]", "click", function(e) {
      self.hideEditInput();
      self.select.call(self, $(this));
    });
    this.table.delegate("td[data-x]", "dblclick", function(e) {
      self.select.call(self, $(this));
      self.showEditInput();
    });
    
    if(!jQuery.browser.msie) { return; }
    this._selection.mousemove(function(e) {
      if(!isDragging) { return; }
      var rows = self.table[0].rows;
      for(var y=0; y<rows.length; ++y) {
        yAt = $(rows[y]).offset().top;
        if(e.clientY < yAt || e.clientY >= yAt + rows[y].offsetHeight) {
          continue;
        }
        var cells = rows[y].cells;
        for(var x=0; x<cells.length; ++x) {          
          var cell = $(cells[x]);
          xAt = cell.offset().left;
          if(e.clientX < xAt || e.clientX >= xAt + cells[y].offsetWidth) {
            continue;
          }
          cell.trigger("mouseover", e);
        }
        return;
      }
    });
  },
  
  
  createSelectionDragger: function() {
    this._selection = $("<div>").addClass("selectionWrapper");
    $("<div>").addClass("selection").appendTo(this._selection);
    $("<div>").addClass("drag").appendTo(this._selection);
    this.em.prepend(this._selection);
  },
  editInputVisible: function() {
    return !this._inputWrapper.hasClass("hidden");
  },
  scrollToFocus: function() {
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

    if(dx === 0 && dy === 0) { return; }
    this.span.moveBy(dx, dy);
  },
  dataCell: function(cell, create) {
    var x = Number(cell.x||cell.attr("data-x"));
    if(x == null) { return; }
    var y = Number(cell.y||cell.attr("data-y"));
    return this.span.cell(x, y, !!create);
  },
  hideEditInput: function(update) {
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
  },
  showEditInput: function(updateValue) {
    var cellLocation = {x:this.selectionFocus.x,y:this.selectionFocus.y};
    this.scrollToFocus();
    var cell = this.cellAt(cellLocation.x-this.span.x, cellLocation.y-this.span.y);
    if(!cell) { return; }
    var dataCell = this.dataCell(cell, false);
    this._inputWrapper.offset(cell.offset()).removeClass("hidden");
    this._input.width(cell.outerWidth())
               .height(cell.outerHeight());
    if(updateValue !== false) {
      this._input.val(dataCell ? dataCell.formula() : "").select();
    }
  },
  createEditInput: function() {
    var self = this;
    var inputWrapper = this._inputWrapper = $("<div>").addClass("hidden").attr("id", "inputWrapper").appendTo(this.em);
    var input = this._input = $("<input>").attr("id", "input").appendTo(inputWrapper);
    
    input.keyup(function(e) {
      var isVisible = !inputWrapper.hasClass("hidden");
      switch(e.which) {
          case 27:
            self.hideEditInput(false);
            if(!isVisible) { self.showEditInput(); }
            e.preventDefault();
            break;
      }
      self.fitEditInput();
    });
    
    input.keydown(function(e) {
      var isVisible = !inputWrapper.hasClass("hidden");

      if(isVisible) {
        // Runs in edit mode.
        switch(e.which) {
          case 37: // L
            if(input[0].selectionStart === 0) {
              self.hideEditInput();
              self.moveSelection(e.shiftKey, -1, 0);
            }
            break;
          case 39: // R
            if(input[0].selectionEnd === input[0].value.length) {
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
        case 32: // Space
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
  },
  assignValue: function(node, dataCell) {
    if(node.length) { node = node[0]; }
    if(node.nodeName == "TD") { node = node.childNodes[0].childNodes[0]; }
    var td = node.parentNode.parentNode;
    td.className = "";
    var value;
    try {
      value = dataCell ? dataCell.valueOf() : "";
      if(value === undefined) { value = ""; }
    } catch(e) {
      td.className = "error";
      value = this.getErrorMessage(e);
    }
    if(node.nodeValue !== value) {
      node.nodeValue = value;
    }
  getErrorMessage: function(err) {
    if(err.type) return err.type;
    return "#ERR";
  },
  _locate: function(em, add) {
    var xy = [add&&em?em.offsetWidth:0, add&&em?em.offsetHeight:0];
    while(em != null && em != this.em[0]) {
      xy[0] += em.offsetLeft || 0;
      xy[1] += em.offsetTop || 0;
      em = em.offsetParent;
    }
    return xy;
  },
  selectionRing: function() {
    if(!this._selection) { return; }
    var minMax = this.minMaxCellsInSpan(this.selection);
    if(!minMax[0].length || !minMax[1].length) {
      this._selection[0].style.cssText = "display:none;"
      return false;
    }
    var start = this._locate(minMax[0][0], false);
    var end = this._locate(minMax[1][0], true);
    this._selection[0].style.cssText = [
      "position:absolute",
      "left:" + (start[0]) + "px",
      "top:" + (start[1]) + "px",
      "width:" + (end[0]-start[0]) + "px",
      "height:" + (end[1]-start[1]) + "px",
      "display:block"].join(";");
    return true;
  },
  headersInSpan: function(span) {
    var minX = span.x - this.span.x, maxX = minX + span.width;
    var minY = span.y - this.span.y, maxY = minY + span.height;
    if(minX < 0 && minY < 0 && maxX < 0 && maxY < 0) { return $([]); }
    var cellSelector = "td.header-x:not(:nth-child(n+" + (2+Math.max(0,maxX)) + ")):nth-child(n+" + (2+Math.max(0,minX)) + ")";
    var rowSelector = "tr:not(:nth-child(n+" + (2+Math.max(0,maxY)) + ")):nth-child(n+" + (2+Math.max(0,minY)) + ") td.header-y";
    return this.table.find(rowSelector + ", " + cellSelector);
  },
  cellsInSpan: function(span) {
    var minX = span.x - this.span.x, maxX = minX + span.width;
    var minY = span.y - this.span.y, maxY = minY + span.height;
    if(minX < 0 && minY < 0 && maxX < 0 && maxY < 0) { return $([]); }
    var cellSelector = "td.data:not(:nth-child(n+" + (2+Math.max(0,maxX)) + ")):nth-child(n+" + (2+Math.max(0,minX)) + ")";
    var rowSelector = "tr:not(:nth-child(n+" + (2+Math.max(0,maxY)) + ")):nth-child(n+" + (2+Math.max(0,minY)) + ")";
    return this.table.find(rowSelector + " " + cellSelector);
  },
  minMaxCellsInSpan: function(span) {
    var minX = span.x - this.span.x, maxX = minX + span.width - 1;
    var minY = span.y - this.span.y, maxY = minY + span.height - 1;
    var under = minX < 0 && minY < 0;
    var over = maxX > this.span.width && maxY > this.span.height;
    var min = this.cellAt(Math.max(0,minX), Math.max(0,minY));
    var max = this.cellAt(Math.min(this.span.width-2,maxX), Math.min(this.span.height-2,maxY));
    return [min, max];
  },
  cellAt: function(x, y) {
    if(x < 0 || y < 0) { return $(); }
    var rows = this.table[0].rows;
    if(!rows || rows.length <= y+1) { return $(); }
    var cells = rows[y+1].cells;
    if(!cells) { return $(); }
    return $(cells[x+1]);
  },
  updateSelection: function() {
    $(this.table).find(".selected").removeClass("selected");
    this.headersInSpan(this.selection).addClass("selected");
    this.cellsInSpan(this.selectionFocus).addClass("selected");
    this.selectionRing();
    if(!this.span.contains(this.selectionFocus)) {
      this.hideEditInput();
    }
    if(this.editInputVisible()) {
      this.showEditInput(false);
    }
  },
  select: function(fromCell, toCell) {
    this.hideEditInput();
    this.selectionFocus.location(this.span.x+Number(fromCell.attr("data-x")), this.span.y+Number(fromCell.attr("data-y")));
    if(arguments.length > 1) {
      this.selectionAt.location(this.span.x+Number(toCell.attr("data-x")), this.span.y+Number(toCell.attr("data-y")));
    }
  },
  moveSelection: function(resize, x, y) {
    if(resize) {
      this.selectionAt.moveBy(x, y);
    } else {
      this.selectionFocus.moveBy(x, y);
    }
  },

  defaultWidth: 80,
  defaultHeight: 23,

  refreshValues: function() {
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
    for(mx=0, currentWidth=defaultWidth; currentWidth < fullWidth; ++mx) {
      currentWidth += (sizes.x[this.span.x + mx] || defaultWidth);
    }
    var my, currentHeight;
    for(my=0, currentHeight=defaultHeight; currentHeight < fullHeight; ++my) {
      currentHeight += sizes.y[this.span.y + my] || defaultHeight;
    }
    if(this.span.width != mx || this.span.height != my) {
      return this.span.size(mx, my);
    }
    
    var cells = this.span.cells();
    var cellMap = [];
    for(var i=0; i<cells.length; ++i) {
      cellMap[(cells[i].y - this.span.y) * this.span.width + cells[i].x - this.span.x] = cells[i];
    }
    
    tbl.css("width", currentWidth);
    tbl.find("tr:nth-child(1n+" + (my+1) + "), td:nth-child(1n+" + (mx+1) + ")").remove()        
    for(var y=0; y<my; ++y) {
      var row = tblEm.rows[y] || $("<tr>").appendTo(tbl)[0];
      for(var x=0; x<=mx; ++x) {
        var cell = row.cells[x];
        var newCell = !cell;

        if(newCell) {
          cell = $("<td>").appendTo(row)[0];
          var wrapper = document.createElement("div");
          wrapper.appendChild(document.createTextNode(""));
          cell.appendChild(wrapper);
          // cell.style.height = (sizes.y[this.span.y + y-1] || defaultHeight) + "px";
        }

        var wrapper = cell.childNodes[0];
        cell.style.height = (sizes.y[this.span.y + y-1] || defaultHeight) + "px";
        cell.style.width  = (sizes.x[this.span.x + x-1] || defaultWidth) + "px";

        if(x === 0 && y === 0) {
          // TOP LEFT HEADER
          cell.className = "header header-xy";
          cell.style.height = defaultHeight + "px";
          cell.style.width = defaultWidth + "px";

        } else if(x === 0) {
          // LEFT HEADER
          cell.className = "header header-y header-y" + (y-1);
          cell.setAttribute("data-header-y", y-1);
          wrapper.childNodes[0].nodeValue = this.span.y+y;
          cell.style.width = defaultWidth + "px";


        } else if(y === 0) {
          // TOP HEADER
          cell.className = "header header-x header-x" + (x-1);
          cell.setAttribute("data-header-x", x-1);
          wrapper.childNodes[0].nodeValue = Waffles.Scripting.columnName(this.span.x+x);
          cell.style.height = defaultHeight + "px";
          

        } else {
          // VALUE COLUMN
          cell.setAttribute("data-x", x-1);
          cell.setAttribute("data-y", y-1);
          cell.className = "data";
          var dataCell = cellMap[(y-1)*this.span.width+(x-1)];
          this.assignValue(cell, dataCell);
        }
        wrapper.style.height = cell.style.height;
        wrapper.style.width = cell.style.width;
        wrapper.style.lineHeight = cell.style.height;

      }
    }
    this.updateSelection();
  }
});

