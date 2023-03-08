Zotero.Jurism.SyncRecode = {

	"syncJsonRex": /mlzsync1:([0-9][0-9][0-9][0-9])(.*)/,

	"syncKeyValRex": /^([a-zA-Z][_a-zA-Z ]+(?:\-[a-zA-Z]+)*)(?:--([0-9]+))*(?:--([a-z][-_a-zA-Z0-9]+)|--([A-Z][-_a-zA-Z0-9]+))*:\s*(.*)/,

	"fieldInfoSort": function(a, b) {
		if (a.cslField > b.cslField) {
			return 1;
		} else if (a.cslField < b.cslField) {
			return -1;
		} else {
			if (a.creatorIdx > b.creatorIdx) {
				return 1;
			} else if (a.creatorIdx < b.creatorIdx) {
				return -1;
			} else {
				if (a.lang > b.lang) {
					return 1;
				} else if (a.lang < b.lang) {
					return -1;
				} else {
					return 0;
				}
			}
		}
	},

	"normalizeLangTag": function(tag) {
		if (!tag) {
			return false;
		}
		var lst = tag.split(/[-_]/);
		for (var i=0,ilen=lst.length; i<ilen; i++) {
			if (i === 0 || lst[i].length > 4) {
				lst[i] = lst[i].toLowerCase();
			} else if (lst[i].length < 4) {
				lst[i] = lst[i].toUpperCase();
			} else if (lst[i].length === 4) {
				lst[i] = lst[i].slice(0, 1).toUpperCase() + lst[i].slice(1).toLowerCase();
			}
		}
		return lst.join("-");
	},
	
	"decode": function (json) {
		if (!json) return;

		var newjson = JSON.parse(JSON.stringify(json));

		// Add multi properties
		newjson.multi = {
			main: {},
			_keys: {}
		}
		// Extract extradata
		var syncJsonMatch = null;
		if (newjson.extra) {
			syncJsonMatch = newjson.extra.match(this.syncJsonRex);
			if (syncJsonMatch) {
				var offset = parseInt(syncJsonMatch[1], 10);
				var extradata = JSON.parse(syncJsonMatch[2].slice(0, offset))
				newjson.extra = newjson.extra.slice((offset+13));
				
				if (extradata.xtype) {
					newjson.itemType = extradata.xtype;
				}
				if (extradata.extrafields) {
					for (var zFieldName in extradata.extrafields) {
						newjson[zFieldName] = extradata.extrafields[zFieldName];
					}
				}
				if (extradata.multifields) {
					for (zFieldName in extradata.multifields.main) {
						newjson.multi.main[zFieldName] = extradata.multifields.main[zFieldName];
					}
					for (zFieldName in extradata.multifields._keys) {
						newjson.multi._keys[zFieldName] = {};
						for (zLang in extradata.multifields._keys[zFieldName]) {
							newjson.multi._keys[zFieldName][zLang] = extradata.multifields._keys[zFieldName][zLang];
						}
					}
				}
				if (extradata.extracreators) {
					for (var pos in extradata.extracreators) {
						var extraCreator = extradata.extracreators[pos];
						if (extraCreator.name || extraCreator.lastName) {
							var creator = {
								creatorType: extraCreator.creatorType
							}
							if (extraCreator.name) {
								creator.name = extraCreator.name;
							} else if (extraCreator.fieldMode == "1") {
								creator.name = extraCreator.lastName;
							} else {
								if (extraCreator.lastName) {
									creator.lastName = extraCreator.lastName;
								}
								if (extraCreator.firstName) {
									creator.firstName = extraCreator.firstName;
								}
							}
							newjson.creators.push(extraCreator);
						}
					}
				}
				for (var pos in newjson.creators) {
					var creator = newjson.creators[pos];
					creator.multi = {
						main: false,
						_key: {}
					}
				}
				if (extradata.multicreators) {
					for (var pos in extradata.multicreators) {
						var creator = newjson.creators[pos];
						var multiObj = extradata.multicreators[pos];
						if (multiObj.main) {
							creator.multi.main = multiObj.main;
						}
						if (multiObj._key) {
							for (var langTag in multiObj._key) {
								var nameObj = multiObj._key[langTag];
								if (nameObj.name || nameObj.lastName) {
									creator.multi._key[langTag] = {};
									if (nameObj.name) {
										creator.multi._key[langTag].name = nameObj.name;
									} else if (creator.name) {
										creator.multi._key[langTag].name = nameObj.lastName;
									} else {
										if (nameObj.firstName) {
											creator.multi._key[langTag].firstName = nameObj.firstName;
										}
										if (nameObj.lastName) {
											creator.multi._key[langTag].lastName = nameObj.lastName;
										}
									}
								}
							}
						}
					}
				}
			}
		}
		return newjson;
	},

	"encode": function (json) {
		if (!Zotero.Utilities.Internal._mapsInitialized) {
			Zotero.Utilities.Internal.initMaps();
		}
		if (!json.multi) {
			//throw "No multi segment on item JSON. What happened?";
			return json;
		}
		
		var extradata = {};
		
		var newjson = JSON.parse(JSON.stringify(json));
		
		// multifields
		if (Object.keys(newjson.multi.main).length > 0 || Object.keys(newjson.multi._keys).length > 0) {
			extradata.multifields = newjson.multi;
		}
		delete newjson.multi;

		// extrafields
		if (Zotero.Utilities.Internal.ENCODE.FIELDS[newjson.itemType]) {
			Object.keys(newjson).sort().forEach((fieldName) => {
				if (Zotero.Utilities.Internal.ENCODE.FIELDS[newjson.itemType][fieldName]) {
					if (newjson[fieldName]) {
						if (!extradata.extrafields) {
							extradata.extrafields = {};
						}
						extradata.extrafields[fieldName] = newjson[fieldName];
					}
					delete newjson[fieldName];
				}
			});
		}

		if (Zotero.Utilities.Internal.ENCODE.DATES[newjson.itemType]) {
			for (var fieldName in newjson) {
				if (Zotero.Utilities.Internal.ENCODE.DATES[newjson.itemType][fieldName]) {
					if (newjson[fieldName]) {
						if (!extradata.extrafields) {
							extradata.extrafields = {};
						}
						extradata.extrafields[fieldName] = newjson[fieldName];
					}
					delete newjson[fieldName];
				}
			}
		}
		
		if (newjson.creators) {
			// extracreators [1]
			// Move extended creators to the end of the line
			if (Zotero.Utilities.Internal.ENCODE.CREATORS[newjson.itemType]) {
				var extendedcreators = [];
				for (var i=newjson.creators.length-1;i > -1; i--) {
					var creator = newjson.creators[i];
					if (Zotero.Utilities.Internal.ENCODE.CREATORS[newjson.itemType][creator.creatorType]) {
						extendedcreators.push(creator);
						newjson.creators = newjson.creators.slice(0, i).concat(newjson.creators.slice(i+1))
					}
				}
				newjson.creators = newjson.creators.concat(extendedcreators);
			}
			
			// multicreators
			for (var pos in newjson.creators) {
				var creator = newjson.creators[pos];
				if (creator.multi) {
					if (creator.multi.main || Object.keys(creator.multi._key).length > 0) {
						if (!extradata.multicreators) {
							extradata.multicreators = {};
						}
						extradata.multicreators[pos] = creator.multi;
					}
					delete creator.multi;
				}
			}
			
			// extracreators [2]
			// Move extended creators to extradata property
			if (Zotero.Utilities.Internal.ENCODE.CREATORS[newjson.itemType]) {
				if (extendedcreators.length) {
					extradata.extracreators = extendedcreators;
					var creatorsLength = (newjson.creators.length - extendedcreators.length);
					newjson.creators = newjson.creators.slice(0, creatorsLength);
				}
			}
		}

		// xtype
		if (Zotero.Jurism.EXTENDED.TYPES[newjson.itemType]) {
			if (newjson.itemType !== Zotero.Jurism.EXTENDED.TYPES[newjson.itemType].zotero) {
				extradata.xtype = newjson.itemType;
			}
			newjson.itemType = Zotero.Jurism.EXTENDED.TYPES[newjson.itemType].zotero;
		}

		// Bundle it
		if (Object.keys(extradata).length > 0) {
			extradata = JSON.stringify(extradata);
			var extradataLength = ("" + extradata.length);
			while (extradataLength.length < 4) {
				extradataLength = "0" + extradataLength;
			}
			// Check if content exists on extra
			if (newjson.extra) {
				// Remove any preexisting sync object in extra (should never happen, but hey)
				var m = newjson.extra.match(/^mlzsync[1-9]:([0-9][0-9][0-9][0-9])/);
				if (m) {
					var totalOffset = parseInt(m[1]) + 13;
					newjson.extra = newjson.extra.slice(totalOffset);
				}
			} else {
				newjson.extra = "";
			}
			// Prepend sync object to extra
			newjson.extra = 'mlzsync1:' + extradataLength + extradata + newjson.extra;
			// Done!
		}
		return newjson;
	}
}

if (typeof process === 'object' && process + '' === '[object process]'){
    module.exports = Zotero.Jurism.SyncRecode;
}
