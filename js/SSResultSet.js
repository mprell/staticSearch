
/*             SSResultSet.js              */
/* Authors: Martin Holmes and Joey Takeda. */
/*        University of Victoria.          */

/** This file is part of the projectEndings staticSearch
  * project.
  *
  * Free to anyone for any purpose, but
  * acknowledgement would be appreciated.
  * The code is licensed under both MPL and BSD.
  */

/** @class SSResultSet
  * @description This is the class that handles the building of the
  * search result set, and then its display, paged or not. An
  * instance of this class is instantiated by the host StaticSearch
  * class. It manages search hits using a Map(), with document ids
  * forming the keys, and values being objects based on the JSON
  * objects returned from the search index queries.
  */
class SSResultSet{
/** 
  * constructor
  * @description The constructor is typically called from the host
  *              StaticSearch instance, and it passes only the 
  *              information required by the result set object.
  * @param {number} maxKwicsToShow The maximum number of keyword-
  *              in-context strings to display for any single hit
  *              document.
  * @param {RegExp} reKwicTruncateStr A pre-constructed regular 
  *              expression that will remove leading and trailing 
  *              ellipses (whatever form these take, configured by
  *              the user) from a KWIC form before using it to create
  *              a scroll-to-text-fragment link.
  */
  
  constructor(maxKwicsToShow, reKwicTruncateStr){
    try{
      this.mapDocs = new Map([]);
      //The maximum allowed number of keyword-in-context results to be
      //included in output.
      this.maxKwicsToShow = maxKwicsToShow;
      //A regex to trim KWICs
      this.reKwicTruncateStr = reKwicTruncateStr;
      //A list of titles indexed by docUri is retrieved by AJAX
      //and set later.
      this.titles = null;
      //Current user-selected result-table sort. A second click on the same
      //column reverses the direction.
      this.tableSort = {column: '', direction: 'asc'};
      //Client-side pagination for the Goethe-Biographica result table.
      //The selected page size is remembered for the current browser tab.
      this.currentPage = 1;
      this.resultsPerPageOptions = [10, 25, 50, 100, 250, 500];
      this.resultsPerPage = 50;
      try{
        let storedPageSize = parseInt(sessionStorage.getItem('gbResultsPerPage'), 10);
        if (this.resultsPerPageOptions.indexOf(storedPageSize) >= 0){
          this.resultsPerPage = storedPageSize;
        }
      }
      catch(e){
        //sessionStorage is optional; 50 results per page remains the default.
      }
    }
    catch(e){
      console.log('ERROR: ' + e.message);
    }
  }

/**
  * @function SSResultSet~clear
  * @description Clears all content from the result map.
  * @return {boolean} true if successful, false if not.
  */
  clear(){
    try{
      this.mapDocs.clear();
      this.currentPage = 1;
      return true;
    }
    catch(e){
      console.log('ERROR: ' + e.message);
      return false;
    }
  }

/** @function SSResultSet~addArray
  * @description Adds an array of document uris to the result set. Used when
  * only facet filters are provided, so there are no hits or document scores
  * involved.
  * @param {!Array<string>} docUris The array of document URIs to add.
  * @return {boolean} true if successful; false if not.
  */
  addArray(docUris){
    try{
      for (let docUri of docUris){
        this.mapDocs.set(docUri, {docUri: docUri, score: 0, sortKey: this.getSortKeyByDocId(docUri), contexts: []});
      }
      return true;
    }
    catch(e){
      console.log('ERROR: ' + e.message);
      return false;
    }
  }

/**
  * @function SSResultSet~has
  * @description Provides access to the Map.prototype.has() function
  * to check whether a document is already in the result set.
  * @param {string} docUri The URI of the document to check, which will
  * be the key to the entry in the map.
  * @return {boolean} true if this document is in the map; false if not.
  */
  has(docUri){
    return this.mapDocs.has(docUri);
  }
/**
  * @function SSResultSet~set
  * @description Provides access to the Map.prototype.set() function
  * to add data to the result set. This first checks whether there
  * is already an entry for this docUri, and if there is, it merges the
  * data instead; otherwise, it sets the data.
  * @param {string} docUri The URI of the document to check, which will
  * be the key to the entry in the map.
  * @param {Object} data The structured data from the query index.
  * @return {boolean} true if successful, false if not.
  */
  set(docUri, data){
    try{
      if (this.mapDocs.has(docUri)){
        this.merge(docUri, data);
      }
      else{
        this.mapDocs.set(docUri, data);
//Add the sort key if there is one.
        this.mapDocs.get(docUri).sortKey = this.getSortKeyByDocId(docUri);
//Now we need to truncate the list of kwic contexts in case it's too long.
        this.mapDocs.get(docUri).contexts = this.mapDocs.get(docUri).contexts.slice(0, this.maxKwicsToShow);
      }
      return true;
    }
    catch(e){
      console.log('ERROR: ' + e.message);
      return false;
    }
  }
/**
  * @function SSResultSet~merge
  * @description Merges an incoming dataset for a document id with an
  * existing entry for that docUri. This involves two steps: first,
  * increment the score for the document, and second, add any keyword-
  * in-context strings from the new item.
  * @param {string} docUri The URI of the document to check, which will
  * be the key to the entry in the map.
  * @param {Object} data The structured data from the query index.
  * @return {boolean} true if successful, false if not.
  */
  merge(docUri, data){
    try{
      if (!this.mapDocs.has(docUri)){
        this.mapDocs.set(docUri, data);
        this.mapDocs.get(docUri).sortKey = this.getSortKeyByDocId(docUri);
      }
      else{
        let currEntry = this.mapDocs.get(docUri);
        let i = 0;
        while (i < data.contexts.length){
          if (currEntry.contexts.indexOf(data.contexts[i]) < 0){
            currEntry.contexts.push(data.contexts[i]);
            currEntry.score += data.score;
          }
          i++;
        }
      }
      return true;
    }
    catch(e){
      console.log('ERROR: ' + e.message);
      return false;
    }
  }

/**
  * @function SSResultSet~delete
  * @description Deletes an existing entry from the map.
  * @param {string} docUri The URI of the document to delete.
  * @return {boolean} true if the item existed and was successfully
  * deleted, false if not, or if there is an error.
  */
  delete(docUri){
    try{
      return this.mapDocs.delete(docUri);
    }
    catch(e){
      console.log('ERROR: ' + e.message);
      return false;
    }
  }

/**
  * @function SSResultSet~deleteArray
  * @description Deletes a collection of existing entries from the map.
  * @param {Array.<String>} arrDocUris The URIs of the document to delete.
  * @return {boolean} true if any of the items existed and was successfully
  * deleted, false if not, or if there is an error.
  */
  deleteArray(arrDocUris){
    let result = false;
    try{
      for (let i=0; i<arrDocUris.length; i++){
        let deleted = this.mapDocs.delete(arrDocUris[i]);
        result = result || deleted;
      }
      return result;
    }
    catch(e){
      console.log('ERROR: ' + e.message);
      return false;
    }
  }

  /**
   * @function SSResultSet~filterByContexts
   * @description Deletes any contexts that are not "in" a selected context
   * and deletes the document from the result set if the document is removed
   * @param activeContextIds{XSet.<String>} contextIds The context ids to use
   * @return {boolean} true if any items remain, false if not
   */
  filterByContexts(activeContextIds){
    try{
      for (let [key, value] of this.mapDocs){
        let contexts = value.contexts;
        // Filter the contexts using the intersection of the two sets
        let filteredContexts = contexts.filter(ctx => {
          if (!ctx.hasOwnProperty('in')){
            return false;
          }
          let ctxIds = ctx.in;
          let ctxSet = new XSet(ctxIds);
          let intersection = ctxSet.intersection(activeContextIds);
          return (intersection.size > 0);
        });
        // If there are no contexts left, then
        // delete the document from the result set
        if (filteredContexts.length === 0){
          this.mapDocs.delete(key);
          continue;
        }
        //Otherwise, reassign the map, copying
        // the values but overwriting the contexts
        // and the score
        
        this.mapDocs.set(key, {
          ...value,
          contexts: filteredContexts,
          score: parseInt(filteredContexts.reduce((total, b) => {
              return total + parseInt(b.weight);
           }, 0))
        });
      }
      return (this.mapDocs.size > 0);
    } catch(e){
      console.log('ERROR: ' + e.message);
      return false;
    }
  }
/**
  * @function SSResultSet~filterBySet
  * @description Deletes any entry in the list which doesn't match an item
  * in the paramter set.
  * @param {Set.<String>} acceptableDocUris The URIs of docs to retain.
  * @return {boolean} true if any items remain, false if not.
  */
  filterBySet(acceptableDocUris){
    try{
      for (let [key, value] of this.mapDocs){
        if (! acceptableDocUris.has(key)){
          this.mapDocs.delete(key);
        }
      }
      return (this.mapDocs.size > 0);
    }
    catch(e){
      console.log('ERROR: ' + e.message);
      return false;
    }
  }

/**
  * @function SSResultSet~getSize
  * @description Returns the number of items in the result set.
  * @return {number} number of documents in the result set.
  */
  getSize(){
    try{
      return this.mapDocs.size;
    }
    catch(e){
      console.log('ERROR: ' + e.message);
      return 0;
    }
  }

/**
  * @function SSResultSet~getContextCount
  * @description Returns the number of kwic contexts in the result set.
  * @return {number} number of kwic contexts in the result set.
  */
  getContextCount(){
    try{
      let arr = [];
      for (let [key, value] of this.mapDocs){
        arr.push(value.contexts.length);
      }
      return arr.reduce(function(a, b){return a + b;}, 0);
    }
    catch(e){
      console.log('ERROR: ' + e.message);
      return 0;
    }
  }

/**
  * @function SSResultSet~sortByScoreDesc
  * @description Sorts the collection of documents so that the highest
  *              scoring items come at the top.
  * @return {boolean} true if successful, false on error.
  */
  sortByScoreDesc(){
    try{
      let s = this.mapDocs.size;
      //this.mapDocs = new Map([...this.mapDocs.entries()].sort((a, b) => b[1].score - a[1].score));
      this.mapDocs = new Map([...this.mapDocs.entries()].sort(function(a, b){
        let x = b[1].score - a[1].score; 
        return (x == 0)? a[1].sortKey.localeCompare(b[1].sortKey) : x; 
      })); 
      return (s === this.mapDocs.size);
    }
    catch(e){
      console.log('ERROR: ' + e.message);
      return false;
    }
  }

/**
  * @function SSResultSet~sortResultTable
  * @description Sort the current result set according to a clickable table
  *              column. Sorting the Map (rather than only DOM rows) keeps
  *              previous/next result navigation in the same order as the table.
  * @param {string} column project, date, title, number, or status.
  */
  sortResultTable(column){
    let direction = 'asc';
    if (this.tableSort.column === column){
      direction = (this.tableSort.direction === 'asc') ? 'desc' : 'asc';
    }
    this.tableSort = {column: column, direction: direction};
    this.currentPage = 1;

    let collator = new Intl.Collator('de', {
      sensitivity: 'base',
      ignorePunctuation: true
    });
    let entries = Array.from(this.mapDocs.entries());
    let compare = (a, b) => {
      let docA = a[1].docUri || a[0];
      let docB = b[1].docUri || b[0];
      let result = 0;

      switch (column){
        case 'project':
          result = collator.compare(this.getProjectByDocId(docA), this.getProjectByDocId(docB));
          break;
        case 'date':
          result = this.compareMachineDates(
            this.getMachineDateByDocId(docA),
            this.getMachineDateByDocId(docB)
          );
          break;
        case 'title':
          result = collator.compare(this.getTitleByDocId(docA), this.getTitleByDocId(docB));
          break;
        case 'number':
          result = this.compareDocumentNumbers(
            this.getNumberByDocId(docA),
            this.getNumberByDocId(docB),
            collator
          );
          break;
        case 'status':
          result = this.compareStatuses(
            this.getStatusByDocId(docA),
            this.getStatusByDocId(docB),
            collator
          );
          break;
      }

      //Deterministic tie-breaker, independent of result score.
      if (result === 0){
        result = collator.compare(this.getTitleByDocId(docA), this.getTitleByDocId(docB));
      }
      if (result === 0){
        result = collator.compare(docA, docB);
      }
      return (direction === 'asc') ? result : -result;
    };

    entries.sort(compare);
    this.mapDocs = new Map(entries);
  }

  getAriaSort(column){
    if (this.tableSort.column !== column){return 'none';}
    return (this.tableSort.direction === 'asc') ? 'ascending' : 'descending';
  }

  compareMachineDates(a, b){
    let normalize = function(value){
      let s = String(value || '').trim();
      if (s.length === 0){return {empty: true, parts: []};}
      //Works for ISO-like machine-readable dates such as YYYY, YYYY-MM,
      //YYYY-MM-DD and extended values because the numeric components are
      //compared in sequence rather than as display text.
      let parts = s.match(/-?\d+/g);
      return {
        empty: false,
        parts: parts ? parts.map(function(n){return parseInt(n, 10);}) : [],
        raw: s
      };
    };
    let x = normalize(a);
    let y = normalize(b);
    if (x.empty && y.empty){return 0;}
    if (x.empty){return 1;}
    if (y.empty){return -1;}
    let len = Math.max(x.parts.length, y.parts.length);
    for (let i=0; i<len; i++){
      let xv = (i < x.parts.length) ? x.parts[i] : 0;
      let yv = (i < y.parts.length) ? y.parts[i] : 0;
      if (xv !== yv){return xv - yv;}
    }
    return x.raw.localeCompare(y.raw);
  }

  compareDocumentNumbers(a, b, collator){
    let parse = function(value){
      let s = String(value || '').trim();
      //Primary order: alphabetic part. Secondary order: all numeric parts
      //in their occurrence order, e.g. RA 2, Nr. 9 before RA 2, Nr. 10.
      let alpha = s.replace(/\d+/g, ' ').replace(/[^A-Za-zÀ-ÖØ-öø-ÿÄÖÜäöüß]+/g, ' ').trim();
      let nums = (s.match(/\d+/g) || []).map(function(n){return parseInt(n, 10);});
      return {raw: s, alpha: alpha, nums: nums};
    };
    let x = parse(a);
    let y = parse(b);
    let c = collator.compare(x.alpha, y.alpha);
    if (c !== 0){return c;}
    let len = Math.max(x.nums.length, y.nums.length);
    for (let i=0; i<len; i++){
      if (i >= x.nums.length){return -1;}
      if (i >= y.nums.length){return 1;}
      if (x.nums[i] !== y.nums[i]){return x.nums[i] - y.nums[i];}
    }
    return collator.compare(x.raw, y.raw);
  }

  compareStatuses(a, b, collator){
    let normalize = function(value){
      let statuses = String(value || '').split('|')
        .map(function(s){return s.trim();})
        .filter(function(s){return s.length > 0;});
      //Count different statuses, not duplicate occurrences.
      let unique = [];
      let seen = new Set();
      for (const status of statuses){
        let key = status.toLocaleLowerCase('de');
        if (!seen.has(key)){
          seen.add(key);
          unique.push(status);
        }
      }
      unique.sort(function(x, y){return collator.compare(x, y);});
      return {count: unique.length, alpha: unique.join('|')};
    };
    let x = normalize(a);
    let y = normalize(b);
    if (x.count !== y.count){return x.count - y.count;}
    return collator.compare(x.alpha, y.alpha);
  }

/**
  * @function SSResultSet~getPageCount
  * @description Returns the number of pages for the current result set.
  */
  getPageCount(){
    return Math.max(1, Math.ceil(this.mapDocs.size / this.resultsPerPage));
  }

  /**
   * @function SSResultSet~setResultsPerPage
   * @description Changes the page size and returns to page one.
   * @param {number} size Number of results to show per page.
   */
  setResultsPerPage(size){
    let parsed = parseInt(size, 10);
    if (this.resultsPerPageOptions.indexOf(parsed) < 0){return false;}
    this.resultsPerPage = parsed;
    this.currentPage = 1;
    try{sessionStorage.setItem('gbResultsPerPage', String(parsed));}
    catch(e){}
    return true;
  }

  /**
   * @function SSResultSet~buildPaginationControls
   * @description Creates accessible pagination controls. The callback redraws
   *              the result component after page or page-size changes.
   * @param {Function} redraw Callback which redraws the result component.
   * @param {boolean} includePageSize Whether to include the page-size selector.
   * @return {Element} pagination control div.
   */
  buildPaginationControls(redraw, includePageSize){
    let controls = document.createElement('div');
    controls.setAttribute('class', 'ssResultPagination');

    let total = this.mapDocs.size;
    let pageCount = this.getPageCount();
    if (this.currentPage > pageCount){this.currentPage = pageCount;}
    if (this.currentPage < 1){this.currentPage = 1;}

    if (includePageSize){
      let sizeGroup = document.createElement('div');
      sizeGroup.setAttribute('class', 'ssResultPageSize');
      let label = document.createElement('label');
      let selectId = 'ssResultsPerPage-' + Math.random().toString(36).slice(2);
      label.setAttribute('for', selectId);
      label.appendChild(document.createTextNode('Treffer pro Seite: '));
      let select = document.createElement('select');
      select.setAttribute('id', selectId);
      select.setAttribute('class', 'ssResultsPerPage');
      for (const optionValue of this.resultsPerPageOptions){
        let option = document.createElement('option');
        option.setAttribute('value', String(optionValue));
        option.appendChild(document.createTextNode(String(optionValue)));
        if (optionValue === this.resultsPerPage){option.selected = true;}
        select.appendChild(option);
      }
      select.addEventListener('change', () => {
        this.setResultsPerPage(select.value);
        redraw();
      });
      label.appendChild(select);
      sizeGroup.appendChild(label);
      controls.appendChild(sizeGroup);
    }

    let start = total === 0 ? 0 : ((this.currentPage - 1) * this.resultsPerPage) + 1;
    let end = Math.min(this.currentPage * this.resultsPerPage, total);
    let summary = document.createElement('div');
    summary.setAttribute('class', 'ssResultPageSummary');
    summary.setAttribute('aria-live', 'polite');
    summary.appendChild(document.createTextNode('Treffer ' + start + '–' + end + ' von ' + total));
    controls.appendChild(summary);

    if (pageCount > 1){
      let nav = document.createElement('nav');
      nav.setAttribute('class', 'ssResultPageNav');
      nav.setAttribute('aria-label', 'Seitennavigation der Suchergebnisse');

      let addButton = (text, page, label, disabled, current) => {
        let button = document.createElement('button');
        button.setAttribute('type', 'button');
        button.setAttribute('class', 'ssResultPageButton' + (current ? ' current' : ''));
        button.appendChild(document.createTextNode(text));
        button.setAttribute('aria-label', label);
        if (current){button.setAttribute('aria-current', 'page');}
        if (disabled){button.disabled = true;}
        else{
          button.addEventListener('click', () => {
            this.currentPage = page;
            redraw();
          });
        }
        nav.appendChild(button);
      };

      addButton('«', 1, 'Erste Seite', this.currentPage === 1, false);
      addButton('‹', this.currentPage - 1, 'Vorherige Seite', this.currentPage === 1, false);

      //Show a compact window of page numbers around the current page, while
      //always including first and last page and marking omitted ranges.
      let pages = new Set([1, pageCount]);
      for (let p=Math.max(1, this.currentPage - 2); p<=Math.min(pageCount, this.currentPage + 2); p++){
        pages.add(p);
      }
      let orderedPages = Array.from(pages).sort(function(a, b){return a - b;});
      let previous = 0;
      for (const page of orderedPages){
        if (previous && page - previous > 1){
          let ellipsis = document.createElement('span');
          ellipsis.setAttribute('class', 'ssResultPageEllipsis');
          ellipsis.setAttribute('aria-hidden', 'true');
          ellipsis.appendChild(document.createTextNode('…'));
          nav.appendChild(ellipsis);
        }
        addButton(String(page), page, 'Seite ' + page, false, page === this.currentPage);
        previous = page;
      }

      addButton('›', this.currentPage + 1, 'Nächste Seite', this.currentPage === pageCount, false);
      addButton('»', pageCount, 'Letzte Seite', this.currentPage === pageCount, false);
      controls.appendChild(nav);
    }

    return controls;
  }

/**
  * @function SSResultSet~resultsAsHtml
  * @description Outputs the search results as a Goethe-Biographica-style table.
  *              Document metadata come from ssTitles JSON; KWIC contexts remain
  *              query-dependent and are rendered from value.contexts.
  * @param {string} strScore caption for the score assigned to a hit document.
  * @return {Element} a table element ready for insertion into the host document.
  */
  resultsAsHtml(strScore){
    let root = document.createElement('div');
    root.setAttribute('class', 'ssResultSetPaged');

    let redraw = () => {
      let replacement = this.resultsAsHtml(strScore);
      if (root.parentNode){root.parentNode.replaceChild(replacement, root);}
    };

    //Store the complete current result order, not only the visible page. This
    //keeps previous/next navigation on individual documents aligned with the
    //active table sort across page boundaries.
    let allEntries = Array.from(this.mapDocs.entries());
    let navigationDocs = allEntries.map(function(entry){
      let value = entry[1];
      return new URL(value.docUri, window.location.href).href;
    });
    try{
      sessionStorage.setItem('gbSearchNavigation', JSON.stringify({
        searchUrl: window.location.href,
        docs: navigationDocs
      }));
    }
    catch(e){}

    root.appendChild(this.buildPaginationControls(redraw, true));

    let table = document.createElement('table');
    table.setAttribute('class', 'ssResultTable gbSearchResults');

    // Show the search-context column only when the complete result set actually
    // contains KWIC contexts (not merely the currently visible page).
    let showContexts = Array.from(this.mapDocs.values()).some(function(value){
      return value.contexts && value.contexts.length > 0;
    });

    let thead = document.createElement('thead');
    let headRow = document.createElement('tr');
    let columns = [
      {label: 'Projekt', sort: 'project'},
      {label: 'Datierung', sort: 'date'},
      {label: '', sort: 'title'}
    ];
    if (showContexts){columns.push({label: 'Suchkontext', sort: ''});}
    columns.push(
      {label: 'Nummer', sort: 'number'},
      {label: 'Status', sort: 'status'}
    );

    for (const column of columns){
      let th = document.createElement('th');
      if (column.sort){
        th.setAttribute('class', 'ssSortable');
        th.setAttribute('tabindex', '0');
        th.setAttribute('role', 'button');
        th.setAttribute('data-sort', column.sort);
        th.setAttribute('aria-sort', this.getAriaSort(column.sort));
        th.setAttribute('title', 'Nach dieser Spalte sortieren');

        let label = document.createElement('span');
        label.setAttribute('class', 'ssSortLabel');
        label.appendChild(document.createTextNode(column.label));
        th.appendChild(label);

        let indicator = document.createElement('span');
        indicator.setAttribute('class', 'ssSortIndicator');
        indicator.setAttribute('aria-hidden', 'true');
        if (this.tableSort.column === column.sort){
          indicator.appendChild(document.createTextNode(this.tableSort.direction === 'asc' ? ' ↑' : ' ↓'));
        }
        else{indicator.appendChild(document.createTextNode(' ↕'));}
        th.appendChild(indicator);

        let activateSort = () => {
          this.sortResultTable(column.sort);
          redraw();
        };
        th.addEventListener('click', activateSort);
        th.addEventListener('keydown', function(evt){
          if ((evt.key === 'Enter') || (evt.key === ' ')){
            evt.preventDefault();
            activateSort();
          }
        });
      }
      else{th.appendChild(document.createTextNode(column.label));}
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    let tbody = document.createElement('tbody');
    let pageCount = this.getPageCount();
    if (this.currentPage > pageCount){this.currentPage = pageCount;}
    let startIndex = (this.currentPage - 1) * this.resultsPerPage;
    let endIndex = Math.min(startIndex + this.resultsPerPage, allEntries.length);
    let pageEntries = allEntries.slice(startIndex, endIndex);

    for (let localIndex=0; localIndex<pageEntries.length; localIndex++){
      let key = pageEntries[localIndex][0];
      let value = pageEntries[localIndex][1];
      //Use the index in the complete sorted result set, not the page-local
      //index, so individual-document navigation works across page boundaries.
      let currentResultIndex = startIndex + localIndex;
      let resultUrl = new URL(value.docUri, window.location.href);
      resultUrl.searchParams.set('gbResult', String(currentResultIndex));

      let tr = document.createElement('tr');
      tr.setAttribute('class', 'ssResultRow');

      let docTitle = this.getTitleByDocId(value.docUri);
      let imgPath = this.getThumbnailByDocId(value.docUri);
      let project = this.getProjectByDocId(value.docUri);
      let displayDate = this.getDisplayDateByDocId(value.docUri);
      let number = this.getNumberByDocId(value.docUri);
      let status = this.getStatusByDocId(value.docUri);

      let tdProject = document.createElement('td');
      tdProject.setAttribute('class', 'category ssResultProject');
      let projectP = document.createElement('p');
      let projectClass = this.getProjectClass(project);
      projectP.setAttribute('class', 'button-tp' + (projectClass ? ' ' + projectClass : ''));
      let projectA = document.createElement('a');
      projectA.setAttribute('class', 'origin');
      projectA.setAttribute('href', 'javascript:void(0)');
      projectA.appendChild(document.createTextNode(project));
      projectP.appendChild(projectA);
      tdProject.appendChild(projectP);
      tr.appendChild(tdProject);

      let tdDate = document.createElement('td');
      tdDate.setAttribute('class', 'ssResultDate');
      tdDate.appendChild(document.createTextNode(displayDate));
      tr.appendChild(tdDate);

      let tdTitle = document.createElement('td');
      tdTitle.setAttribute('class', 'ssResultTitle');
      if (imgPath.length > 0){
        let imgA = document.createElement('a');
        imgA.setAttribute('href', resultUrl.href);
        imgA.setAttribute('class', 'target ssResultThumbnailLink');
        let img = document.createElement('img');
        img.setAttribute('alt', docTitle);
        img.setAttribute('title', docTitle);
        img.setAttribute('src', imgPath);
        imgA.appendChild(img);
        tdTitle.appendChild(imgA);
      }
      let a = document.createElement('a');
      a.setAttribute('href', resultUrl.href);
      a.setAttribute('class', 'target');
      a.appendChild(document.createTextNode(docTitle));
      tdTitle.appendChild(a);
      tr.appendChild(tdTitle);

      if (showContexts){
        let tdContext = document.createElement('td');
        tdContext.setAttribute('class', 'ssResultContext');
        if (value.contexts.length > 0){
          value.contexts.sort( /** @suppress {missingProperties} */function(a, b){return a.pos - b.pos;});
          let contexts = document.createElement('div');
          contexts.setAttribute('class', 'kwic');
          for (let i=0; i<Math.min(value.contexts.length, this.maxKwicsToShow); i++){
            let context = document.createElement('div');
            context.setAttribute('class', 'kwicContext');
            let sp = document.createElement('span');
            sp.innerHTML = value.contexts[i].context;
            context.appendChild(sp);

            let cleanMark = value.contexts[i].context.replace(/.*<mark>([^<]+)<\/mark>.+/, '$1');
            if (((value.contexts[i].hasOwnProperty('fid'))&&(value.contexts[i].fid != ''))){
              let fid = value.contexts[i].hasOwnProperty('fid')? value.contexts[i].fid : '';
              let a2 = document.createElement('a');
              let contextUrl = new URL(value.docUri, window.location.href);
              contextUrl.searchParams.set('ssMark', cleanMark);
              contextUrl.searchParams.set('gbResult', String(currentResultIndex));
              contextUrl.hash = fid;
              a2.appendChild(document.createTextNode('\u21ac'));
              a2.setAttribute('href', contextUrl.href);
              a2.setAttribute('class', 'fidLink');
              context.appendChild(a2);
            }

            if (value.contexts[i].hasOwnProperty('prop')){
              let props = Object.entries(value.contexts[i].prop);
              for (const [propKey, propValue] of props){
                context.setAttribute('data-ss-' + propKey, propValue);
                if (propKey == 'img'){
                  let ctxImg = document.createElement('img');
                  ctxImg.setAttribute('src', propValue);
                  context.insertBefore(ctxImg, context.firstChild);
                }
              }
            }
            contexts.appendChild(context);
          }
          tdContext.appendChild(contexts);
        }
        tr.appendChild(tdContext);
      }

      let tdNumber = document.createElement('td');
      tdNumber.setAttribute('class', 'ssResultNumber');
      tdNumber.appendChild(document.createTextNode(number));
      tr.appendChild(tdNumber);

      let tdStatus = document.createElement('td');
      tdStatus.setAttribute('class', 'ssResultStatus');
      let statuses = status.split('|').map(function(s){return s.trim();}).filter(function(s){return s.length > 0;});
      for (const statusText of statuses){
        let statusSpan = document.createElement('span');
        statusSpan.setAttribute('class', this.getStatusClass(statusText));
        statusSpan.setAttribute('title', statusText + ' vorhanden');
        statusSpan.appendChild(document.createTextNode(statusText));
        tdStatus.appendChild(statusSpan);
      }
      tr.appendChild(tdStatus);
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    root.appendChild(table);
    root.appendChild(this.buildPaginationControls(redraw, false));
    return root;
  }


/** @function SSResultSet~getTitleByDocId
  * @description this function returns the title of a document based on
  *              its id.
  * @param {string} docId the id of the document.
  * @return {string} the title, or a placeholder if not found.
  */
  getTitleByDocId(docId){
    try{
      return this.titles.get(docId)[0];
    }
    catch(e){
      return '[No title]';
    }
  }

/** @function SSResultSet~getThumbnailByDocId
  * @description this function returns a thumbnail image for a document
  *              based on its id. If no thumbnail is defined in the ssTitles
  *              JSON, it returns an empty string.
  * @param {string} docId the id of the document.
  * @return {string} the relative path to an image, or an empty string.
  */
  getThumbnailByDocId(docId){
    try{
      if (this.titles.get(docId).length > 1){
        return this.titles.get(docId)[1];
      }
      else{
        return '';
      }
    }
    catch(e){
      return '';
    }
  }

/** @function SSResultSet~getSortKeyByDocId
  * @description this function returns a pre-configured sort key for a document
  *              based on its id. If no sort key is defined in the ssTitles
  *              JSON, it returns an empty string. Sort keys are used to 
  *              sequence result sets where their scores are identical.
  * @param {string} docId the id of the document.
  * @return {string} the sort key for this document, or an empty string.
  */
  getSortKeyByDocId(docId){
    try{
      if (this.titles.get(docId).length > 2){
        return this.titles.get(docId)[2];
      }
      else{
        return '';
      }
    }
    catch(e){
      return '';
    }
  }

  /** Goethe-Biographica-specific metadata appended to ssTitles JSON. */
  getProjectByDocId(docId){
    try{return (this.titles.get(docId).length > 3)? this.titles.get(docId)[3] : '';}
    catch(e){return '';}
  }

  getMachineDateByDocId(docId){
    try{
      let titleData = this.titles.get(docId);
      //If json.xsl appends the machine-readable <meta name="Datum"> as
      //an eighth value, use it directly. For the current Goethe-Biographica
      //ssTitles layout, docSortKey at index 2 is the machine-readable date
      //and is therefore the backwards-compatible fallback.
      return (titleData.length > 7 && titleData[7]) ? titleData[7] : ((titleData.length > 2) ? titleData[2] : '');
    }
    catch(e){return '';}
  }

  getDisplayDateByDocId(docId){
    try{return (this.titles.get(docId).length > 4)? this.titles.get(docId)[4] : '';}
    catch(e){return '';}
  }

  getNumberByDocId(docId){
    try{return (this.titles.get(docId).length > 5)? this.titles.get(docId)[5] : '';}
    catch(e){return '';}
  }

  getStatusByDocId(docId){
    try{return (this.titles.get(docId).length > 6)? this.titles.get(docId)[6] : '';}
    catch(e){return '';}
  }

  getProjectClass(project){
    switch (project){
      case 'Tagebücher': return 'gt';
      case 'Briefe von Goethe': return 'gb';
      case 'Briefe an Goethe': return 'ra';
      case 'Begegnungen & Gespräche': return 'bug';
      default: return '';
    }
  }

  getStatusClass(status){
    let s = status.toLowerCase();
    if (s.indexOf('transkription') >= 0){return 'status-text';}
    if ((s.indexOf('kommentar') >= 0)||(s.indexOf('erläuter') >= 0)){return 'status-comment';}
    if (s.indexOf('digitalisat') >= 0){return 'status-image';}
    if (s.indexOf('regest') >= 0){return 'status-regest';}
    if (s.indexOf('überliefer') >= 0){return 'status-tradition';}
    if ((s.indexOf('xml') >= 0)||(s.indexOf('tei') >= 0)){return 'status-xml';}
    return 'status-generic';
  }

/**
  * @function SSResultSet~resultsAsObject
  * @description Outputs an object containing result set counts, to be
  *              used in automated testing.
  * @return {Object} an object structure containing counts of docs found,
  *                  total contexts, and total score. Totting them up in
  *                  this way doesn't mean anything in particular, but it
  *                  provides a quick way to check whether things have
  *                  changed and a test is not returning what it used to.
  */
  resultsAsObject(){
    let scoreTotal = 0;
    let contextsTotal = 0;
    for (let [key, value] of this.mapDocs){
      scoreTotal += value.score;
      contextsTotal += value.contexts.length;
    }
    return {
      docsFound: this.mapDocs.size,
      contextsFound: contextsTotal,
      scoreTotal: scoreTotal
    }
  }
}
