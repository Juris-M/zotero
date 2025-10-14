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
// Used by integrationDocPrefs.xhtml and bibliography.xhtml

window.Zotero_File_Interface_Bibliography = new function () {
	var _io;
	
	// Only changes when explicitly selected
	var lastSelectedStyle,
		lastSelectedLocale;
	
	var styleConfigurator;

	/**
	 * @type {"bibliography" | "docPrefs"}
	 */
	var windowType;
	
	/**
	 * Initialize some variables and prepare event listeners for when chrome is done
	 * loading
	 *
	 * @param {Object} [args] - Explicit arguments in place of window arguments
	 */
	this.init = async function (args = {}) {
		window.addEventListener('dialogaccept', () => this.acceptSelection());
		window.addEventListener('dialoghelp', () => this.openHelpLink());

		// Set font size from pref
		// Affects bibliography.xhtml and integrationDocPrefs.xhtml
		var bibContainer = document.getElementById("zotero-bibliography-container");
		if (bibContainer) {
			Zotero.UIProperties.registerRoot(bibContainer);
		}
		
		if (window.arguments && window.arguments.length) {
			_io = window.arguments[0];
			if (_io.wrappedJSObject) _io = _io.wrappedJSObject;
		}
		else if (args) {
			_io = args;
		}
		else {
			_io = {};
		}

		windowType = {
			"integration-doc-prefs": "docPrefs",
			"bibliography-window": "bibliography"
		}[document.querySelector("window").id];
		
		styleConfigurator = document.querySelector("#style-configurator");
		
		// if no style is requested, get the last style used
		if (!_io.style) {
			_io.style = Zotero.Prefs.get("export.lastStyle");
			// if language params not set, get from SQL prefs
			// and Firefox preferences
			Zotero.setCitationLanguages(_io);
		}
		
		// See note in style.js
		if (!Zotero.Styles.initialized()) {
			// Initialize styles
			await Zotero.Styles.init();
		}
		if (!Zotero.StyleModules.initialized) {
			// Initialize style modules
			await Zotero.StyleModules.init();
		}
		
		// Wait for CE initialization
		let i = 0;
		while (!styleConfigurator.initialized && i < 300) {
			await Zotero.Promise.delay(10);
			i++;
		}

		// Select supplied style and locale
		if (_io.style) {
			styleConfigurator.style = _io.style;
			if (styleConfigurator.style !== _io.style) {
				styleConfigurator.style = styleConfigurator.styles[0];
			}
			else if (_io.locale) {
				styleConfigurator.locale = _io.locale;
			}
		}

		if (_io.supportedNotes?.length < 2) {
			styleConfigurator.toggleAttribute("no-multi-notes", true);
		}

		styleConfigurator.addEventListener("select", event => this.styleChanged(event));

		styleConfigurator.toggleAttribute("show-manage-styles", true);
		styleConfigurator.addEventListener("manage-styles", this.manageStyles.bind(this));
		
		this.initBibWindow();

		this.initDocPrefsWindow();

		setTimeout(() => this.updateWindowSize(), 0);
		
		// set style to false, in case this is cancelled
		_io.style = false;
	};

	this.initBibWindow = function () {
		if (windowType !== "bibliography") return;
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
		document.getElementById('output-mode-radio').selectedItem
			= document.getElementById(mode);
		document.getElementById('output-method-radio').selectedItem
			= document.getElementById(method);
		
		this.onBibWindowStyleChange();
	};

	this.initDocPrefsWindow = function () {
		if (windowType !== "docPrefs") return;
		this.toggleAdvancedOptions(true);
		document.querySelector(".advanced-header").addEventListener("click", () => this.toggleAdvancedOptions());

		if (_io.useEndnotes == 1) {
			styleConfigurator.displayAs = "endnotes";
		}
		
		if (document.getElementById("formatUsing-container")) {
			if (["Field", "ReferenceMark"].includes(_io.primaryFieldType)) {
				if (_io.fieldType == "Bookmark") document.getElementById("formatUsingBookmarks").checked = true;
				document.getElementById("bookmarks-file-format-notice").dataset.l10nArgs = '{"show": "true"}';
			}
			else {
				let formatUsing = document.getElementById("formatUsing-container");
				formatUsing.hidden = true;
				formatUsing.toggleAttribute("always-hidden", true);
				_io.fieldType = _io.primaryFieldType;
			}
		}
		if (document.getElementById("automaticJournalAbbreviations")) {
			if (_io.automaticJournalAbbreviations === undefined) {
				_io.automaticJournalAbbreviations = Zotero.Prefs.get("cite.automaticJournalAbbreviations");
			}
			if (_io.automaticJournalAbbreviations) {
				document.getElementById("automaticJournalAbbreviations").checked = true;
			}
			
			document.getElementById("automaticCitationUpdates-checkbox").checked = !_io.delayCitationUpdates;
		}
		
		if (_io.showImportExport) {
			document.querySelector('#exportImport').hidden = false;
		}

		if(document.getElementById("suppressTrailingPunctuation-checkbox")) {
			if(_io.suppressTrailingPunctuation === undefined) {
				_io.suppressTrailingPunctuation = Zotero.Prefs.get("export.citeSuppressTrailingPunctuation");
			}
			if (_io.suppressTrailingPunctuation) {
				document.getElementById("suppressTrailingPunctuation-checkbox").checked = true;
			}
		}

        // Start Jurism multilingual
        
		// Set group name (integrationDocPrefs.xul only)
		var checkNode = document.getElementById("group-name");
		if (checkNode) {
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
			for (var i = langPrefs.childNodes.length -1; i > -1; i += -1) {
				langPrefs.removeChild(langPrefs.childNodes.item(i));
			}
			var tags = Zotero.CachedLanguages.getAllLangTagData();
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
        // End Jurism multilingual
        
		document.querySelector("#exportDocument")?.addEventListener("command", this.exportDocument.bind(this));

		this.onDocPrefsWindowStyleChange(Zotero.Styles.get(styleConfigurator.style));

		// If any advanced options are checked, expand the advanced options section
		let hasCheckedAdvancedOption
			= !!Array.from(document.querySelectorAll(".advanced-checkbox"))
				.find(elem => elem.checked);
		if (hasCheckedAdvancedOption) {
			this.toggleAdvancedOptions(false);
		}
	};
	
	this.openHelpLink = function () {
		Zotero.launchURL("https://www.zotero.org/support/word_processor_integration");
	};

	/*
	 * Called when style is changed
	 */
	this.styleChanged = function (event) {
		lastSelectedStyle = styleConfigurator.style;
		lastSelectedLocale = styleConfigurator.locale;
		let selectedStyleObj = Zotero.Styles.get(lastSelectedStyle);
		if (event.detail?.type === "style") {
			this.onBibWindowStyleChange(selectedStyleObj);
			this.onDocPrefsWindowStyleChange(selectedStyleObj);
		}
		this.updateWindowSize();
	};

	this.onBibWindowStyleChange = function (style = undefined) {
		if (windowType !== "bibliography") return;
		if (!style) {
			style = Zotero.Styles.get(styleConfigurator.style);
		}
		if (!style) return;
		let citations = document.getElementById("citations");
		// Change label to "Citation" or "Note" depending on style class
		citations.dataset.l10nArgs = `{"type": "${style.class}"}`;
	};

	this.onDocPrefsWindowStyleChange = function (style) {
		if (windowType !== "docPrefs") return;

		let isNote = style.class == "note";
		// update status of formatUsing box based on style class
		if (isNote) document.querySelector("#formatUsingBookmarks").checked = false;
		let formatUsing = document.querySelector("#formatUsing-container");
		if (!formatUsing.hasAttribute("always-hidden")) {
			formatUsing.hidden = isNote;
		}
		
		let usesAbbreviation = style.usesAbbreviation;
		document.querySelector("#automaticJournalAbbreviations-container").hidden = !usesAbbreviation;

		let advancedOptions = document.querySelector(".advanced-options");
		let hasEnabledOption
			= !!Array.from(advancedOptions.querySelector(".advanced-body").childNodes)
				.find(elem => !elem.hidden);
		advancedOptions.hidden = !hasEnabledOption;
	};

	this.acceptSelection = function () {
		// collect code
		_io.style = styleConfigurator.style;
		
		_io.locale = styleConfigurator.locale;
		
		this.onBibWindowAccept();
		
		this.onDocPrefsWindowAccept();
		
		// remember style and locale if user selected these explicitly
		if (lastSelectedStyle) {
			Zotero.Prefs.set("export.lastStyle", _io.style);
		}
		
		if (lastSelectedLocale) {
			Zotero.Prefs.set("export.lastLocale", lastSelectedLocale);
		}
	};

	this.onBibWindowAccept = function () {
		if (windowType !== "bibliography") return;
		// collect settings
		_io.mode = document.getElementById("output-mode-radio").selectedItem.id;
		_io.method = document.getElementById("output-method-radio").selectedItem.id;
		// save settings
		Zotero.Prefs.set("export.bibliographySettings",
			JSON.stringify({ mode: _io.mode, method: _io.method }));
	};

	this.onDocPrefsWindowAccept = function () {
		if (windowType !== "docPrefs") return;
		var automaticJournalAbbreviationsEl = document.getElementById("automaticJournalAbbreviations");
		_io.automaticJournalAbbreviations = automaticJournalAbbreviationsEl.checked;
		if (!automaticJournalAbbreviationsEl.hidden && lastSelectedStyle) {
			Zotero.Prefs.set("cite.automaticJournalAbbreviations", _io.automaticJournalAbbreviations);
		}
		// Jurism
		var suppressTrailingPunctuationEl = document.getElementById("suppressTrailingPunctuation-checkbox");
		_io.suppressTrailingPunctuation = suppressTrailingPunctuationEl.checked;
		var groupNameNode = document.getElementById('group-name');
		_io.extractingLibraryID = groupNameNode.getAttribute('value') ? parseInt(groupNameNode.getAttribute('value'), 10) : 0;
		_io.extractingLibraryName = groupNameNode.getAttribute('label') ? groupNameNode.getAttribute('label') : '';
		
		_io.useEndnotes = styleConfigurator.displayAs == "endnotes" ? 1 : 0;
		_io.fieldType = (document.getElementById("formatUsingBookmarks").checked ? _io.secondaryFieldType : _io.primaryFieldType);
		_io.delayCitationUpdates = !document.getElementById("automaticCitationUpdates-checkbox").checked;
	};
	
	
	this.manageStyles = function () {
		_io.dontActivateDocument = true;
		document.querySelector('dialog').cancelDialog();
		var win = Zotero.Utilities.Internal.openPreferences('zotero-prefpane-cite', {
			scrollTo: '#styles'
		});
		if (window.isDocPrefs) {
			Zotero.Utilities.Internal.activate(win);
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
			if (!_io[param] || _io[param].indexOf(tag) === -1) {
				if (!_io[param]) {
					_io[param] = [];
				}
				_io[param].push(tag);
			}
		} else if (_io[param]) {
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

    
	this.updateWindowSize = function () {
		this.resizeWindow();
		// Keep in sync with _styleConfigurator.scss
		const defaultListMaxHeight = 260;
		const listMaxHeightProp = "--style-configurator-richlistitem-max-height";
		let currentListMaxHeight = parseFloat(document.documentElement.style.getPropertyValue(listMaxHeightProp));
		let overflow = window.outerHeight - window.screen.availHeight;
		if (overflow > 0) {
			let styleList = document.querySelector("#style-list");
			let currentHeight = styleList.clientHeight;
			let newHeight = Math.max(currentHeight - overflow, 100);
			document.documentElement.style.setProperty(listMaxHeightProp, `${newHeight}px`);
			this.resizeWindow();
		}
		else if (!isNaN(currentListMaxHeight) && currentListMaxHeight < defaultListMaxHeight) {
			let newHeight = Math.min(defaultListMaxHeight, currentListMaxHeight + Math.abs(overflow));
			document.documentElement.style.setProperty(listMaxHeightProp, `${newHeight}px`);
			this.resizeWindow();
		}
	};

	this.resizeWindow = function () {
		document.documentElement.style.removeProperty("min-height");
		window.sizeToContent();
		document.documentElement.style.minHeight = document.documentElement.clientHeight + "px";
	};

	/**
	 * Toggle advanced options
	 * only called from docPrefs
	 */
	this.toggleAdvancedOptions = function (collapsed = undefined) {
		let header = document.querySelector(".advanced-header");
		if (typeof collapsed === "undefined") {
			collapsed = !header.classList.contains("collapsed");
		}
		document.querySelector(".advanced-body").hidden = collapsed;
		header.classList.toggle("collapsed", collapsed);
		this.updateWindowSize();
	};

	/**
	 * Export the document
	 * only called from docPrefs
	 */
	this.exportDocument = function () {
		if (Zotero.Integration.confirmExportDocument()) {
			_io.exportDocument = true;
			document.querySelector('dialog').acceptDialog();
		}
	};
};
