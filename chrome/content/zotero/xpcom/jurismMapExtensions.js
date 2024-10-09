
Zotero.Jurism = {}

Zotero.Jurism.EXTENDED = JSON.parse(
	Zotero.File.getContentsFromURL("resource://zotero/schema/global/schema-jurism-patch.json")
);

Zotero.Jurism.CSL = {
	FORCE_FIELD_CONTENT: {
		"tvBroadcast":{
			"genre":"television broadcast"
		},
		"radioBroadcast":{
			"genre":"radio broadcast"
		},
		"instantMessage":{
			"genre":"instant message"
		},
		"email":{
			"genre":"email"
		},
		"podcast":{
			"genre":"podcast"
		}
	},

	FORCE_REMAP: {
		"periodical":{
			"title":"container-title"
		}
	}
}

try {

Zotero.Jurism.PATCH = {

	TYPES: {
		add: Zotero.Jurism.EXTENDED.TYPES,
		extend: {},
		remove: {},
		override: {}
	},
	
	CREATORS: {
		add: {
			contributor: "contributor",
			commenter: "commenter"
		},
		extend: {},
		remove: {},
		override: {}
	},
	
	FIELDS: {
		add: {
			"admin-flag": ["adminFlag"],
			"gazette-flag": ["gazetteFlag"],
			"document-name": ["documentName"],
			"volume-title": ["volumeTitle"],
			jurisdiction: ["jurisdiction"],
			"publication-number": ["publicationNumber"],
			supplement: ["supplementName"],
			division: ["division"]
		},
		extend: {
			"container-title": ["album", "websiteTitle", "bookTitle"],
			"collection-title": ["parentTreaty"],
			"collection-number": ["assemblyNumber", "regnalYear", "yearAsVolume"],
			authority: ["institution", "regulatoryBody"],
			section: ["opus"],
			genre: ["genre", "reign", "sessionType", "regulationType"],
			"issue": ["meetingNumber"],
			status: ["status"],
			edition: ["release"],
			event: ["resolutionLabel"],
			number: ["treatyNumber"]
		},
		remove: {
			"section": ["committee"] // ?? What's going on with this in the hearing type?
		},
		override: {}
	},
	
	DATES: {
		add: {
			"original-date": ["newsCaseDate", "priorityDate", "originalDate", "adoptionDate"],
			"available-date": ["openingDate"],
			"event-date": ["signingDate", "conferenceDate", "dateAmended"],
			"publication-date": ["publicationDate"]
		},
		extend: {},
		remove: {},
		override: {
			issued: ["date"],
			accessed: ["accessDate"],
			submitted: ["filingDate"]
		}
	}
}

Zotero.Jurism.MapTools = {
	getMap: function(key) {
		return Zotero.Jurism.CSL[key];
	},
	patchMap: function(key, data) {
		var patchData = Zotero.Jurism.PATCH[key];
		for (var k in patchData.override) {
			if (!data[k]) {
				throw "Expected field " + k + " does not exist to be overridden in " + key;
			}
			data[k] = patchData.override[k];
		}
		for (var k in patchData.add) {
			if (data[k]) {
				throw "Field " + k + " already exists in " + key;
			}
			if (key === "TYPES") {
				data[k] = patchData.add[k].csl;
			} else {
				data[k] = patchData.add[k];
			}
		}
		for (var k in patchData.extend) {
			if (!data[k]) {
				throw "Expected field " + k + " does not exist to be exteded in " + key;
			}
			for (var i=0,ilen=patchData.extend[k].length; i<ilen; i++) {
				data[k].push(patchData.extend[k][i]);
			}
		}
		for (var k in patchData.remove) {
			if (!data[k]) {
				throw "Expected field " + k + " does not exist for removals to be applied in " + key;
			}
			for (var i=0,ilen=patchData.remove[k].length; i<ilen; i++) {
				var removeCSLvar = patchData.remove[k][i];
				for (var j=0,jlen=data[k].length; j<jlen; j++) {
					if (data[k][j] === removeCSLvar) {
						data[k] = data[k].slice(0, j).concat(data[k].slice(j+1));
					}
				}
			}
		}
	},

	// These will have to be run on Utilities, and install the maps there.
	DECODE: 1,
	ENCODE: 2,

	// We need first build the encode map, to establish which
	// zField is the correct mapping for the cField within the type.

	// Then when to build the decode map, we just reverse the cField and zField
	// mappings in the ecnode map.

	// Then everything just works.
	
	getFieldsForType: function(type) {
		if(type === "attachment" || type === "note") return [];
		var fields = Zotero.ItemFields.getItemTypeFields(Zotero.ItemTypes.getID(type));
		var cleanFields = new Array();
		for(var i=0; i<fields.length; i++) {
			cleanFields.push(Zotero.ItemFields.getName(fields[i]));
		}
		return cleanFields;
	},

	getEncodeField: function(zField, cslMap) {
		for (var mapField in cslMap) {
			if ("string" === typeof cslMap[mapField]) {
				if (cslMap[mapField] === zField) {
					return mapField;
				}
			} else {
				if (mapField === "shortTitle") {
					continue;
				}
				for (var i=0,ilen=cslMap[mapField].length; i<ilen; i++) {
					var val = cslMap[mapField][i];
					if (val === zField) {
						return mapField;
					}
				}
			}
		}
	},
	
	makeEncodeMap: function(extName, cslMap, objectValues) {
		var ret = {};
		var extMap = Zotero.Jurism.EXTENDED[extName];
		for (var itemType in extMap) {
			ret[itemType] = {};
			var me = this;
			extMap[itemType].forEach(function(zField){
				if (objectValues) {
					var field = zField.baseField ? zField.baseField : zField.field;
					ret[itemType][zField.field] = me.getEncodeField(field, cslMap);
				} else {
					ret[itemType][zField] = me.getEncodeField(zField, cslMap);
				}
			});
		}
		return ret;
	},
	
	makeDecodeMap: function(extName, cslMap) {
		if (extName === "FIELDS") {
			var encodeMap = this.makeEncodeMap(extName, cslMap, true);
		} else {
			var encodeMap = this.makeEncodeMap(extName, cslMap);
		}
		var ret = JSON.parse(JSON.stringify(encodeMap));
		for (var itemType in encodeMap) {
			ret[itemType] = {};
			for (var zField in encodeMap[itemType]) {
				ret[itemType][encodeMap[itemType][zField]] = zField;
			}
		}
		return ret;
	},

	makeReverseMap: function(extName, cslMap) {
		if (!Zotero.ItemTypes) {
			throw "Error: Zotero.ItemTypes is not yet loaded";
		}
		var _map = {};
		var allTypes = Zotero.ItemTypes.getSecondaryTypes().map(o => o.name);
		for (var i=0,ilen=allTypes.length; i<ilen; i++) {
			var newItemType = allTypes[i];
			if (!Zotero.Schema.CSL_TYPE_MAPPINGS[newItemType]) {
				continue;
			}
			_map[newItemType] = {};
			var allFields;
			if (extName === "CREATORS") {
				allFields = Zotero.Utilities.getCreatorsForType(newItemType);
			} else {
				allFields = this.getFieldsForType(newItemType);
			}
			for (var j=0,jlen=allFields.length; j<jlen; j++) {
				var newZField = allFields[j];
				var cField = this.getEncodeField(newZField, cslMap);
				if (cField) {
					_map[newItemType][newZField] = cField;
				}
			}
		}
		return _map;
	}
}

} catch (e) {
	dump(e.message+"\n");
	throw new Error(e);
}
	
if (typeof process === 'object' && process + '' === '[object process]'){
    module.exports = Zotero.Jurism.MapTools;
}
