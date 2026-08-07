
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
  * @function SSResultSet~resultsAsHtml
  * @description Outputs the search results as a Goethe-Biographica-style table.
  *              Document metadata come from ssTitles JSON; KWIC contexts remain
  *              query-dependent and are rendered from value.contexts.
  * @param {string} strScore caption for the score assigned to a hit document.
  * @return {Element} a table element ready for insertion into the host document.
  */
  resultsAsHtml(strScore){
    let table = document.createElement('table');
    table.setAttribute('class', 'ssResultTable gbSearchResults');

    // Show the search-context column only when the result set actually
    // contains KWIC contexts (i.e. when a text query produced contexts).
    let showContexts = Array.from(this.mapDocs.values()).some(function(value){
      return value.contexts && value.contexts.length > 0;
    });

    let thead = document.createElement('thead');
    let headRow = document.createElement('tr');
    let labels = ['Projekt', 'Datierung', ''];
    if (showContexts){
      labels.push('Suchkontext');
    }
    labels.push('Nummer', 'Status');
    for (const label of labels){
      let th = document.createElement('th');
      th.appendChild(document.createTextNode(label));
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    let tbody = document.createElement('tbody');

    for (let [key, value] of this.mapDocs){
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
        imgA.setAttribute('href', value.docUri);
        imgA.setAttribute('class', 'target ssResultThumbnailLink');
        let img = document.createElement('img');
        img.setAttribute('alt', docTitle);
        img.setAttribute('title', docTitle);
        img.setAttribute('src', imgPath);
        imgA.appendChild(img);
        tdTitle.appendChild(imgA);
      }
      let a = document.createElement('a');
      a.setAttribute('href', value.docUri);
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
            let queryString = '?ssMark=' + encodeURIComponent(cleanMark);
            if (((value.contexts[i].hasOwnProperty('fid'))&&(value.contexts[i].fid != ''))){
              let fid = value.contexts[i].hasOwnProperty('fid')? value.contexts[i].fid : '';
              let a2 = document.createElement('a');
              a2.appendChild(document.createTextNode('\u21ac'));
              a2.setAttribute('href', value.docUri + queryString + '#' + fid);
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
    return table;
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
