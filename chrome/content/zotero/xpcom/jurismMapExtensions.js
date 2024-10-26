
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

Zotero.Jurism.MapTools = {
	getMap: function(key) {
		return Zotero.Jurism.CSL[key];
	},

	// These will have to be run on Utilities, and install the maps there.
	DECODE: 1,
	ENCODE: 2,

	// For sync campatibility
	
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
	}
}

} catch (e) {
	dump(e.message+"\n");
	throw new Error(e);
}
	
if (typeof process === 'object' && process + '' === '[object process]'){
    module.exports = Zotero.Jurism.MapTools;
}
