/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

//////////////////////////////////////////////////////////////////////////////
//
// Zotero_File_Interface_Bibliography
//
//////////////////////////////////////////////////////////////////////////////

// Class to provide options for bibliography
// Used by rtfScan.xul, integrationDocPrefs.xul, and bibliography.xul

var Zotero_File_Interface_Bibliography = new function() {
        var _io;
        
        // Only changes when explicitly selected
        var lastSelectedStyle,
                lastSelectedLocale;
        
        /*
         * Initialize some variables and prepare event listeners for when chrome is done
         * loading
         */
        this.init = function () {
                // Set font size from pref
                // Affects bibliography.xul and integrationDocPrefs.xul
                var bibContainerMain = document.getElementById("zotero-bibliography-container-main");
                if(bibContainerMain) {
                        Zotero.setFontSize(bibContainerMain);
                }
                var bibContainerInternal = document.getElementById("zotero-bibliography-container-internal");
                if(bibContainerInternal) {
                        Zotero.setFontSize(bibContainerInternal);
                }
                
                if(window.arguments && window.arguments.length) {
                        _io = window.arguments[0];
                        if(_io.wrappedJSObject) _io = _io.wrappedJSObject;
                } else {
                        _io = {};
                }
                
                var listbox = document.getElementById("style-listbox");
                
                // if no style is requested, get the last style used
                if(!_io.style) {
                        _io.style = Zotero.Prefs.get("export.lastStyle");
                        // if language params not set, get from SQL prefs
                        // and Firefox preferences
                        Zotero.setCitationLanguages(_io);
                }
                
                // add styles to list
                var styles = Zotero.Styles.getVisible();
                var index = 0;
                var nStyles = styles.length;
                var selectIndex = null;
                for(var i=0; i<nStyles; i++) {
                        var itemNode = document.createElement("listitem");
                        itemNode.setAttribute("value", styles[i].styleID);
                        itemNode.setAttribute("label", styles[i].title);
                        listbox.appendChild(itemNode);
                        
                        if(styles[i].styleID == _io.style) {
                                selectIndex = index;
                        }
                        index++;
                }

                var linkTitlesToggle = document.getElementById('zotero-bibliography-title-links');
                if (linkTitlesToggle) {
                        if (Zotero.Prefs.get('linkTitles')) {
                                linkTitlesToggle.setAttribute('checked', true);
                        } else {
                                linkTitlesToggle.setAttribute('checked', false);
                        }
                }
                
                let requestedLocale;
                if (selectIndex === null) {
                        // Requested style not found in list, pre-select first style
                        selectIndex = 0;
                } else {
                        requestedLocale = _io.locale;
                }
                
                let style = styles[selectIndex];
                lastSelectedLocale = Zotero.Prefs.get("export.lastLocale");
                if (requestedLocale && style && !style.locale) {
                        // pre-select supplied locale
                        lastSelectedLocale = requestedLocale;
                }
                
                // add locales to list
                Zotero.Styles.populateLocaleList(document.getElementById("locale-menu"));
                
                // Has to be async to work properly
                window.setTimeout(function () {
                        listbox.ensureIndexIsVisible(selectIndex);
                        listbox.selectedIndex = selectIndex;
                        Zotero_File_Interface_Bibliography.styleChanged();
                }, 0);
                
                // ONLY FOR bibliography.xul: export options
                if(document.getElementById("save-as-rtf")) {
                        var settings = Zotero.Prefs.get("export.bibliographySettings");
                        try {
                                settings = JSON.parse(settings);
                                var mode = settings.mode;
                                var method = settings.method;
                        }
                        // If not JSON, assume it's the previous format-as-a-string
                        catch (e) {
                                method = settings;
                        }
                        if (!mode) mode = "bibliography";
                        if (!method) method = "save-as-rtf";
                        
                        // restore saved bibliographic settings
                        document.getElementById('output-mode-radio').selectedItem =
                                document.getElementById(mode);
                        document.getElementById('output-method-radio').selectedItem =
                                document.getElementById(method);
                }
                
                // ONLY FOR integrationDocPrefs.xul: update status of displayAs, set
                // bookmarks text
                if(document.getElementById("displayAs")) {
                        if(_io.useEndnotes && _io.useEndnotes == 1) document.getElementById("displayAs").selectedIndex = 1;
                }
                if(document.getElementById("formatUsing")) {
                        if(_io.fieldType == "Bookmark") document.getElementById("formatUsing").selectedIndex = 1;
                        var formatOption = (_io.primaryFieldType == "ReferenceMark" ? "referenceMarks" : "fields");
                        document.getElementById("fields").label =
                                Zotero.getString("integration."+formatOption+".label");
                        document.getElementById("fields-caption").textContent =
                                Zotero.getString("integration."+formatOption+".caption");
                        document.getElementById("fields-file-format-notice").textContent =
                                Zotero.getString("integration."+formatOption+".fileFormatNotice");
                        document.getElementById("bookmarks-file-format-notice").textContent =
                                Zotero.getString("integration.fields.fileFormatNotice");
                }
                if(document.getElementById("automaticJournalAbbreviations-checkbox")) {
                        if(_io.automaticJournalAbbreviations === undefined) {
                                _io.automaticJournalAbbreviations = Zotero.Prefs.get("cite.automaticJournalAbbreviations");
                        }
                        if(_io.automaticJournalAbbreviations) {
                                document.getElementById("automaticJournalAbbreviations-checkbox").checked = true;
                        }
                }
                if(document.getElementById("suppressTrailingPunctuation-checkbox")) {
                        if(_io.suppressTrailingPunctuation === undefined) {
                                _io.suppressTrailingPunctuation = Zotero.Prefs.get("export.citeSuppressTrailingPunctuation");
                        }
                        if (_io.suppressTrailingPunctuation) {
                                document.getElementById("suppressTrailingPunctuation-checkbox").checked = true;
                        }
                }
                if(document.getElementById("storeReferences")) {
                        if(_io.storeReferences || _io.storeReferences === undefined) {
                                document.getElementById("storeReferences").checked = true;
                                if(_io.requireStoreReferences) document.getElementById("storeReferences").disabled = true;
                        }
                }

                // Set project and group name (integrationDocPrefs.xul only)
                var checkNode = document.getElementById("group-name");
                if (checkNode) {
                        this.displayProjectName();
                        this.displayGroupName();
                }

                // Also ONLY for integrationDocPrefs.xul: update language selections
                
                // initialize options display from provided params

                var checkNode = document.getElementById("persons-radio-orig");
                if (checkNode) {
                        var citationPrefNames = ['Persons', 'Institutions', 'Titles', 'Journals', 'Publishers', 'Places'];
                        for (var i = 0, ilen = citationPrefNames.length; i < ilen; i += 1) {
                                var prefname = citationPrefNames[i].toLowerCase();
                                var citationRoleNames = ["orig","translit","translat"];
                                this.citationLangSet(citationPrefNames[i], true);
                                for (var j = 0, jlen = citationRoleNames.length; j < jlen; j += 1) {
                                        var rolename = citationRoleNames[j];
                                        var citationPrefNode = document.getElementById(prefname + '-radio-orig');
                                        if (citationPrefNode) {
                                                if (_io['citationLangPrefs'+citationPrefNames[i]] && _io['citationLangPrefs'+citationPrefNames[i]].length) {
                                                        var selectedCitationPrefNode = document.getElementById(prefname + "-radio-" + _io['citationLangPrefs'+citationPrefNames[i]][0]);
                                                        selectedCitationPrefNode.checked = true;
                                                }
                                        }
                                }
                        }
                }


                var langPrefs = document.getElementById('lang-prefs');
                if (langPrefs){
                        for (var i = langPrefs.childNodes.length -1; i > 0; i += -1) {
                                langPrefs.removeChild(langPrefs.childNodes.item(i));
                        }
                        var tags = Zotero.DB.query("SELECT * FROM zlsTags ORDER BY tag");
                        for (var i = 0, ilen = tags.length; i < ilen; i += 1) {
                                var langSelectors = [];
                                var langSelectorTypes = [
                                        'citationTransliteration',
                                        'citationTranslation',
                                        'citationSort'
                                ];
                                for (var j = 0, jlen = langSelectorTypes.length; j < jlen; j += 1) {
                                        var newselector = buildSelector('default',tags[i],langSelectorTypes[j]);
                                        if ((j % 3) == 0) {
                                                newselector.setAttribute("class", "translit");
                                                newselector.setAttribute("onmouseover", "Zotero_File_Interface_Bibliography.setLanguageRoleHighlight(['translit-primary', 'translit-secondary', 'translit'],true);");
                                                newselector.setAttribute("onmouseout", "Zotero_File_Interface_Bibliography.setLanguageRoleHighlight(['translit-primary', 'translit-secondary', 'translit'],false);");
                                        } else if ((j % 3) == 1) {
                                                newselector.setAttribute("class", "translat");
                                                newselector.setAttribute("onmouseover", "Zotero_File_Interface_Bibliography.setLanguageRoleHighlight(['translat-primary', 'translat-secondary', 'translat'],true);");
                                                newselector.setAttribute("onmouseout", "Zotero_File_Interface_Bibliography.setLanguageRoleHighlight(['translat-primary', 'translat-secondary', 'translat'],false);");
                                        }
                                        langSelectors.push(newselector);
                                }
                                addSelectorRow(langPrefs,langSelectors);
                        }
                }
                
                // set style to false, in case this is cancelled
                _io.style = false;
        };

        /*
         * Called when locale is changed
         */
        this.localeChanged = function (selectedValue) {
                lastSelectedLocale = selectedValue;
        };

        /*
         * Called when style is changed
         */
        this.styleChanged = function () {
                var selectedItem = document.getElementById("style-listbox").selectedItem;
                lastSelectedStyle = selectedItem.getAttribute('value');
                var selectedStyleObj = Zotero.Styles.get(lastSelectedStyle);
                
                updateLocaleMenu(selectedStyleObj);
                
                //
                // For integrationDocPrefs.xul
                //
                
                // update status of displayAs box based on style class
                if(document.getElementById("displayAs-groupbox")) {
                        var isNote = selectedStyleObj.class == "note";
                        document.getElementById("displayAs-groupbox").hidden = !isNote;
                        
                        // update status of formatUsing box based on style class
                        if(document.getElementById("formatUsing")) {
                                if(isNote) document.getElementById("formatUsing").selectedIndex = 0;
                                document.getElementById("bookmarks").disabled = isNote;
                                document.getElementById("bookmarks-caption").disabled = isNote;
                        }
                }

                // update status of displayAs box based on style class
                if(document.getElementById("automaticJournalAbbreviations-vbox")) {
                        document.getElementById("automaticJournalAbbreviations-vbox").hidden =
                                !selectedStyleObj.usesAbbreviation;
                }
                
                //
                // For bibliography.xul
                //
                
                // Change label to "Citation" or "Note" depending on style class
                if(document.getElementById("citations")) {
                        let label = "";
                        if(Zotero.Styles.get(lastSelectedStyle).class == "note") {
                                label = Zotero.getString('citation.notes');
                        } else {
                                label = Zotero.getString('citation.citations');
                        }
                        document.getElementById("citations").label = label;
                }

                window.sizeToContent();
        };

        /*
         * Update locale menulist when style is changed
         */
        function updateLocaleMenu(selectedStyle) {
                Zotero.Styles.updateLocaleList(
                        document.getElementById("locale-menu"),
                        selectedStyle,
                        lastSelectedLocale
                );
        }

        this.acceptSelection = function () {
                // collect code
                _io.style = document.getElementById("style-listbox").value;
                
                let localeMenu = document.getElementById("locale-menu");
                _io.locale = localeMenu.disabled ? undefined : localeMenu.value;
                
                if(document.getElementById("output-method-radio")) {
                        // collect settings
                        _io.mode = document.getElementById("output-mode-radio").selectedItem.id;
                        _io.method = document.getElementById("output-method-radio").selectedItem.id;
                        // save settings
                        Zotero.Prefs.set("export.bibliographySettings",
                                JSON.stringify({ mode: _io.mode, method: _io.method }));
                }
                
                // ONLY FOR integrationDocPrefs.xul:
                if(document.getElementById("displayAs")) {
                        var automaticJournalAbbreviationsEl = document.getElementById("automaticJournalAbbreviations-checkbox");
                        _io.automaticJournalAbbreviations = automaticJournalAbbreviationsEl.checked;
                        if(!automaticJournalAbbreviationsEl.hidden && lastSelectedStyle) {
                                Zotero.Prefs.set("cite.automaticJournalAbbreviations", _io.automaticJournalAbbreviations);
                        }
                        var suppressTrailingPunctuationEl = document.getElementById("suppressTrailingPunctuation-checkbox");
                        _io.suppressTrailingPunctuation = suppressTrailingPunctuationEl.checked;
                        _io.useEndnotes = document.getElementById("displayAs").selectedIndex;
                        _io.fieldType = (document.getElementById("formatUsing").selectedIndex == 0 ? _io.primaryFieldType : _io.secondaryFieldType);
                        _io.storeReferences = document.getElementById("storeReferences").checked;
                        var groupNameNode = document.getElementById('group-name');
                        _io.extractingLibraryID = groupNameNode.getAttribute('value') ? parseInt(groupNameNode.getAttribute('value'), 10) : 0;
                        _io.extractingLibraryName = groupNameNode.getAttribute('label') ? groupNameNode.getAttribute('label') : '';
                }
                
                // remember style and locale if user selected these explicitly
                if(lastSelectedStyle) {
                        Zotero.Prefs.set("export.lastStyle", _io.style);
                }
                
                if (lastSelectedLocale) {
                        Zotero.Prefs.set("export.lastLocale", lastSelectedLocale);
                }
        };

        /*
         * ONLY FOR integrationDocPrefs.xul: language selection utility functions
         */
        function addSelectorRow(target,selectors) {
                //Zotero.debug("XXX == addSelectorRow() ==");
                var row = document.createElement('row');
                row.setAttribute("class", "compact");
                for (var i = 0, ilen = selectors.length; i < ilen; i += 1) {
                        row.appendChild(selectors[i]);
                }
                target.appendChild(row);
        }
                
        function setLangPref(event) {
                var target = event.currentTarget;
                var profile = target.getAttribute('profile');
                var param = target.getAttribute('param');
                var tag = target.getAttribute('value');
                var enable = target.hasAttribute('checked');
                if (enable) {
                        if (_io[param].indexOf(tag) === -1) {
                                if (!_io[param]) {
                                        _io[param] = [];
                                }
                                _io[param].push(tag);
                        }
                } else {
                        for (var i = _io[param].length - 1; i > -1; i += -1) {
                                if (_io[param][i] === tag) {
                                        _io[param] = _io[param].slice(0,i).concat(_io[param].slice(i + 1));
                                }
                        }
                }
        }

        function buildSelector(profile,tagdata,param) {
                //Zotero.debug("XXX == buildSelector() ==");
                var checkbox = document.createElement('checkbox');
                if (_io[param] && _io[param].indexOf(tagdata.tag) > -1) {
                        checkbox.setAttribute('checked',true);
                }
                checkbox.setAttribute('profile', profile);
                checkbox.setAttribute('param', param);
                checkbox.addEventListener("command", setLangPref);
                checkbox.setAttribute('value',tagdata.tag);

                checkbox.setAttribute('label',tagdata.nickname);
                checkbox.setAttribute('type','checkbox');
                var hbox = document.createElement('hbox');
                hbox.setAttribute("style", "overflow:hidden;margin-top:0px;margin-bottom:0px;");
                hbox.setAttribute('flex','1');
                hbox.appendChild(checkbox);
                var hboxfil = document.createElement('hbox');
                hboxfil.setAttribute('flex','1');
                hbox.appendChild(hboxfil);
                return hbox;
        }
                
        function capFirst(str) {
                return str[0].toUpperCase() + str.slice(1);
        }

        this.citationLangSet = function(name, init, radioClick) {
                var settings = _io['citationLangPrefs'+name];
                if (!settings || !settings[0]) {
                        settings = ['orig'];
                }
                var nodes = [];
                var forms = ['orig', 'translit', 'translat'];
                var base = name.toLowerCase();
                // get node
                // set node from pref
                if (init) {
                        this.citationGetAffixes();
                        var currentPrimaryID = base + "-radio-" + settings[0];
                        var node = document.getElementById(currentPrimaryID);
                        var control = node.control;
                        control.selectedItem = node;
                        
                        var translitID = base + "-radio-translit";
                        var translitNode = document.getElementById(translitID);
                        nodes.push(translitNode);
                        
                        for (var i = 0, ilen = forms.length; i < ilen; i += 1) {
                                nodes.push(document.getElementById(base + "-checkbox-" + forms[i]));
                        }
                        for (var i = 0, ilen = nodes.length; i < ilen; i += 1) {
                                nodes[i].checked = false;
                                for (var j = 1, jlen = settings.length; j < jlen; j += 1) {
                                        if (nodes[i].id === base + '-checkbox-' + settings[j]) {
                                                nodes[i].checked = true;
                                        }
                                }
                                if (nodes[i].id === base + "-checkbox-" + settings[0]) {
                                        nodes[i].checked = false;
                                        var idx = settings.slice(1).indexOf(settings[0]);
                                        if (idx > -1) {
                                                // +1 and +2 b/c first-position item (primary) is sliced off for this check
                                                settings = settings.slice(0,idx + 1).concat(settings.slice(idx + 2));
                                                _io['citationLangPrefs'+name] = settings;
                                        }
                                        this.citationSetAffixes(nodes[i]);
                                        nodes[i].disabled = true;
                                } else if (radioClick && nodes[i].id === translitID) {
                                        // true invokes a quash of the affixes
                                        if (currentPrimaryID === translitID) {
                                                this.citationSetAffixes(nodes[i]);
                                        } else {
                                                this.citationSetAffixes(nodes[i], null, true);
                                        }
                                } else {
                                        nodes[i].disabled = false;
                                }
                        }
                }
        }

        this.setLanguageRoleHighlight = function(classes, mode) {
                for (var i = 0, ilen = classes.length; i < ilen; i += 1) {
                        var nodes = document.getElementsByClassName(classes[i]);
                        for (var j = 0, jlen = nodes.length; j < jlen; j += 1) {
                                if (mode) {
                                        nodes[j].classList.add('language-role-highlight');
                                } else {
                                        nodes[j].classList.remove('language-role-highlight');
                                }
                        }
                }
        };

        this.citationPrimary = function(node) {
                var lst = node.getAttribute("id").split('-');
                var base = lst[0];
                var primarySetting = lst[2];
                var settings = _io['citationLangPrefs'+capFirst(base)];
                if (!settings) {
                        settings = ['orig'];
                }
                _io['citationLangPrefs'+capFirst(base)] = [primarySetting].concat(settings.slice(1));
                // Second true is for a radio click
                this.citationLangSet(capFirst(base), true, true);
        }

        this.citationSecondary = function(node) {
                //Zotero.debug("XXX == citationSecondary() ==");
                var lst = node.getAttribute("id").split('-');
                var lowerBase = lst[0];
                var upperBase = lst[0][0].toUpperCase() + lst[0].slice(1);
                var addme = false;
                var cullme = false;
                var secondarySetting = lst[2];
                var forms = ['orig', 'translit', 'translat'];
                // Check-box has not yet changed when this executes.
                if (!node.checked) {
                        addme = secondarySetting;
                } else {
                        cullme = secondarySetting;
                        // Also unset configured affixes.
                        this.citationSetAffixes(node);
                }
                var settings = _io['citationLangPrefs'+upperBase];
                var primarySetting = settings[0];
                var secondaries = settings.slice(1);
                for (var i = 0, ilen = secondaries.length; i < ilen; i += 1) {
                        if (forms.indexOf(secondaries[i]) === -1) {
                                secondaries = secondaries.slice(0, i).concat(secondaries.slice(i + 1));
                        }
                }
                if (addme && secondaries.indexOf(secondarySetting) === -1) {
                        secondaries.push(secondarySetting);
                }
                if (cullme) {
                        var cullidx = secondaries.indexOf(secondarySetting);
                        if (cullidx > -1) {
                                secondaries = secondaries.slice(0, cullidx).concat(secondaries.slice(cullidx + 1));
                        }
                }
                _io['citationLangPrefs'+upperBase] = [primarySetting].concat(secondaries);
                if (addme || cullme) {
                        this.citationLangSet(upperBase);
                }
        };

        this.citationSetAffixes = function(node, affixNode, quashPrimaryAffixes) {
                if (!node) {
                        node = document.popupNode;
                }
                var currentId = node.id;
                var prefixNode = document.getElementById(node.id + '-prefix');
                var suffixNode = document.getElementById(node.id + '-suffix');
                if (!affixNode || quashPrimaryAffixes) {
                        prefixNode.value = "";
                        suffixNode.value = "";
                } else {
                        var prefix = affixNode.value.split("|")[0];
                        if (!prefix) {
                                prefix = "";
                        }
                        var suffix = affixNode.value.split("|")[1];
                        if (!suffix) {
                                suffix = "";
                        }
                        prefixNode.value = prefix;
                        suffixNode.value = suffix;
                }
                // Do something to store this data in Prefs
                var types = ['persons', 'institutions', 'titles', 'journals', 'publishers', 'places'];
                var forms = ['orig', 'translit', 'translat'];
                var affixList = [];
                for (var i = 0, ilen = types.length; i < ilen; i += 1) {
                        this.affixListPush(types[i], "radio", "translit", affixList, "prefix");
                        this.affixListPush(types[i], "radio", "translit", affixList, "suffix");
                        for (var j = 0, jlen = forms.length; j < jlen; j += 1) {
                                this.affixListPush(types[i], "checkbox", forms[j], affixList, "prefix");
                                this.affixListPush(types[i], "checkbox", forms[j], affixList, "suffix");
                        }
                }
                _io['citationAffixes'] = affixList;
        }

        this.affixListPush = function(type, boxtype, form, lst, affix) {
                var elem = document.getElementById(type + "-" + boxtype + "-" + form + "-" +affix);
                if (!elem.value) {
                        elem.value = "";
                }
                lst.push(elem.value);
        };

        this.citationGetAffixes = function() {
                var affixList = null;
                if (_io['citationAffixes']) {
                        if (_io['citationAffixes'].length === 48) {
                                affixList = _io['citationAffixes'];
                        }
                }
                if (!affixList) {
                        affixList = [,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,];
                }
                var types = ['persons', 'institutions', 'titles', 'journals', 'publishers', 'places'];
                var forms = ['orig', 'translit', 'translat'];
                var count = 0;
                for (var i = 0, ilen = types.length; i < ilen; i += 1) {
                        count =  this.citationGetAffixesAction(types[i], "radio", "translit", affixList, count);
                        
                        for (var j = 0, jlen = forms.length; j < jlen; j += 1) {
                                count = this.citationGetAffixesAction(types[i], "checkbox", forms[j], affixList, count);
                        }
                }
        }

        this.citationGetAffixesAction = function(type, boxtype, form, affixList, count) {
                var affixPos = ['prefix', 'suffix']
                for (var k = 0, klen = affixPos.length; k < klen; k += 1) {
                        var id = type + '-' + boxtype + '-' + form + '-' + affixPos[k];
                        var node = document.getElementById(id);
                        if (affixList[count]) {
                                node.value = affixList[count];
                }
                        count += 1;
                }
                return count;
        }

        this.displayProjectName = function() {
                var projectName = document.getElementById('project-name');
                if (projectName) {
                        projectName.value = _io.projectName ? _io.projectName : '';
                }
        }

        this.openProjectName = function(event) {
                var node = event.target;
                var projectName = node.value;
                var parent = node.parentNode;
                parent.removeChild(node);
                var newNode = document.createElement('textbox');
                newNode.setAttribute('id', 'project-name');
                newNode.setAttribute('flex','1');
                newNode.setAttribute('onkeydown','Zotero_File_Interface_Bibliography.closeProjectName(event);');
                newNode.setAttribute('onblur','Zotero_File_Interface_Bibliography.closeProjectName(event);');
                newNode.setAttribute('value',projectName);
                parent.appendChild(newNode);
                newNode.focus();
        }

        this.closeProjectName = function(event) {
                var keyCodeMap = {
                        13:'Enter',
                        9:'Tab',
                        27:'Esc',
                        38:'Up',
                        40:'Down'
                }
                if ((event.type == 'keydown' && keyCodeMap[event.keyCode] === 'Enter') || event.type == 'blur') {
                        event.preventDefault();
                        var node = event.target;
                        var projectName = node.value;
                        _io['projectName'] = projectName;
                        var parent = node.parentNode;
                        parent.removeChild(node);
                        var newNode = document.createElement('label');
                        newNode.setAttribute('id', 'project-name');
                        newNode.setAttribute('flex','1');
                        newNode.setAttribute('onclick','Zotero_File_Interface_Bibliography.openProjectName(event);');
                        newNode.setAttribute('value',projectName);
                        newNode.classList.add('zotero-clicky');
                        newNode.classList.add('thin-border');
                        parent.appendChild(newNode);
                }
        }

        this.displayGroupName = function() {
                // Zotero.debug("MLZ: == displayGroupName() ==");
                // Check if we have access to the target group at all (change message if not)
                // Check if we have write access to it as well (disable if not)
                // If both of the above check out, set the target group as the list selection.
                var extractingLibraryID = _io.extractingLibraryID ? _io.extractingLibraryID : 0;
                var extractingLibraryName = _io.extractingLibraryName ? _io.extractingLibraryName : '';

                var groupNameNode = document.getElementById('group-name');
                var groupNamePopup = document.getElementById('group-name-popup');
                for (var i=1,ilen=groupNamePopup.childNodes.length;i<ilen;i+=1) {
                        groupNamePopup.removeChild(groupNamePopup.childNodes[1]);
                }

                var selectResult = null;
                var groups = Zotero.Groups.getAll();
                for (var i=0,ilen=groups.length;i<ilen;i+=1) {
                        var libraryName = groups[i].name;
                        var libraryID = Zotero.Groups.getLibraryIDFromGroupID(groups[i].id);
                        if (!groups[i].editable) {
                                if (extractingLibraryID == libraryID) {
                                        selectResult = false;
                                }
                        } else {
                                if (extractingLibraryID == libraryID) {
                                        selectResult = true;
                                }
                        }
                }

                if (!extractingLibraryName) {
                        // Cast a menu item for NOT SELECTED
                        Zotero_File_Interface_Bibliography.toggleGroupNameSafetyCatch(true);
                        Zotero_File_Interface_Bibliography.setErrorNode(groupNameNode,3);
                        groupNameNode.selectedItem = groupNamePopup.childNodes[0];
                } else {
                        // Cast a menu item for SELECTED
                        var itemNode = document.createElement('menuitem');
                        itemNode.setAttribute('value',extractingLibraryID);
                        itemNode.setAttribute('label',extractingLibraryName);
                        groupNamePopup.appendChild(itemNode);
                        groupNameNode.selectedItem = groupNamePopup.childNodes[1];
                        if (selectResult === null) {
                                // Setting is not a known group
                                Zotero_File_Interface_Bibliography.toggleGroupNameSafetyCatch(false,true);
                                Zotero_File_Interface_Bibliography.setErrorNode(groupNameNode,1);
                        } else if (selectResult == false) {
                                // Setting is a group to which we do not have write access
                                Zotero_File_Interface_Bibliography.toggleGroupNameSafetyCatch(true);
                                Zotero_File_Interface_Bibliography.setErrorNode(groupNameNode,2)
                        } else {
                                // Setting is a known group to which we have write access. Yay.
                                Zotero_File_Interface_Bibliography.toggleGroupNameSafetyCatch(true);
                                Zotero_File_Interface_Bibliography.setErrorNode(groupNameNode,0)
                        }
                }
        }

         this.openGroupList = function(event) {
                var extractingLibraryID = _io.extractingLibraryID ? _io.extractingLibraryID : 0;
                var extractingLibraryName = _io.extractingLibraryName ? _io.extractingLibraryName : '';

                var groupNameNode = document.getElementById('group-name');
                var groupNamePopup = document.getElementById('group-name-popup');
                for (var i=1,ilen=groupNamePopup.childNodes.length;i<ilen;i+=1) {
                        groupNamePopup.removeChild(groupNamePopup.childNodes[1]);
                }

                // Get a list of groups to which user has write access
                var groups = Zotero.Groups.getAll();
                for (var i=0,ilen=groups.length;i<ilen;i+=1) {
                        var libraryName = groups[i].name;
                        var libraryID = Zotero.Groups.getLibraryIDFromGroupID(groups[i].id, true);
                        if (!groups[i].editable) {
                                var itemNode = document.createElement('label');
                                itemNode.setAttribute('style','font-weight:bold;color:#999999;');
                                itemNode.setAttribute('value','[' + libraryName + ']');
                                if (extractingLibraryID == libraryID) {
                                        groupNameNode.setAttribute('label',libraryName);
                                }
                        } else {
                                var itemNode = document.createElement('menuitem');
                                itemNode.setAttribute('value',libraryID);
                                itemNode.setAttribute('label',libraryName);
                                itemNode.addEventListener("command", setGroupName);
                        }
                        groupNamePopup.appendChild(itemNode);
                }
        }

        function setGroupName(event) {
                var itemNode = event.target;
                var groupNameNode = document.getElementById('group-name');
                _io.extractingLibraryID = parseInt(itemNode.getAttribute('value'), 10);
                _io.extractingLibraryName = itemNode.getAttribute('label');
                Zotero_File_Interface_Bibliography.displayGroupName();
        }

        this.setErrorNode = function(groupNameNode,pos) {
                var errorNodes = [];
                errorNodes[0] = document.getElementById('group-no-error');
                errorNodes[1] = document.getElementById('group-unselected-error');
                errorNodes[2] = document.getElementById('group-readonly-error');
                errorNodes[3] = document.getElementById('group-nonexistent-error');
                function setOne (pos) {
                        for (var i=0,ilen=errorNodes.length;i<ilen;i+=1) {
                                if (i === pos) {
                                        errorNodes[i].hidden = false;
                                } else {
                                        errorNodes[i].hidden = true;
                                }
                        }
                };
                
                setOne(pos);
                switch (pos) {
                case 0:
                        groupNameNode.style['font-weight'] = 'bold';
                        groupNameNode.style.color = 'blue';
                        groupNameNode.style.opacity = '1.0';
                        break;
                        ;;
                case 1:
                        groupNameNode.style['font-weight'] = 'normal';
                        groupNameNode.style.color = 'black';
                        groupNameNode.style.opacity = '1.0';
                        break;
                        ;;
                case 2:
                        groupNameNode.style['font-weight'] = 'bold';
                        groupNameNode.style.color = 'red';
                        groupNameNode.style.opacity = '0.6';
                        break;
                        ;;
                case 3:
                        groupNameNode.style['font-weight'] = 'bold';
                        groupNameNode.style.color = 'red';
                        groupNameNode.style.opacity = '1.0';
                        break;
                        ;;
                }
        }

        this.toggleGroupNameSafetyCatch = function(forceCheck, disableToggle) {
                var groupNameNode = document.getElementById('group-name');
                var groupNameSafetyCatch = document.getElementById('group-name-safety-catch');
                        groupNameSafetyCatch.disabled = false;
                if (forceCheck === true) {
                        groupNameSafetyCatch.checked = false;
                } else if (forceCheck === false) {
                        groupNameSafetyCatch.checked = true;
                        groupNameSafetyCatch.disabled = true;
                }
                if (groupNameSafetyCatch.checked) {
                        groupNameNode.disabled = false;
                        groupNameSafetyCatch.checked = true;
                } else {
                        groupNameNode.disabled = true;
                        groupNameSafetyCatch.checked = false;
                }
        }

        this.toggleTitleLinks = function(event) {
                if (event.target.checked) {
                        Zotero.Prefs.set('linkTitles', true);
                } else {
                        Zotero.Prefs.set('linkTitles', false);
                }
        };
}
