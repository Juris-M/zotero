var fs = require("fs");

var oldFilename = process.argv[2];
var newFilename = process.argv[3];

if (!oldFilename || !newFilename) {
	console.log(`Takes two arguments: <jurism-schema> <new-zotero-schema>`);
	process.exit();
}

var oldData = JSON.parse(fs.readFileSync(oldFilename).toString());
var newData = JSON.parse(fs.readFileSync(newFilename).toString());

topKeys = ["itemTypes", "meta", "csl", "locales"];

for (key in newData) {
	getType = (val) => {
		var type = typeof val;
		if ((typeof val) === "object") {
			return val.length===undefined ? "object" : "array";
		}
		return type;
	};
	console.log(`${key}: ${getType(newData[key])}`);
}

var oldObj = {
	version: oldData.version,
	itemTypes: {},
	meta: oldData.meta,
	csl: oldData.csl,
	locales: oldData.locales
	
};
for (var itemType of oldData.itemTypes) {
	oldObj.itemTypes[itemType.itemType] = itemType;
}

var newObj = {
	version: newData.version,
	itemTypes: {},
	meta: newData.meta,
	csl: newData.csl,
	locales: newData.locales
	
};
for (var itemType of newData.itemTypes) {
	newObj.itemTypes[itemType.itemType] = itemType;
}

var removeCslFieldsNotInOldCslType = (cslType) => {
	var newCslTypes = newObj.csl.types[cslType];
	var oldCslTypes = oldObj.csl.types[cslType];
	for (var oldCslField of oldCslTypes) {
		for (newCslField of newCslTypes) {
			var hasField = false;
			if (oldCslField === newCslField) {
				hasField = true;
				break;
			}
		}
		if (!hasField) {
			console.log(`Removing csl field ${oldCslField} from ${cslType}`);
			console.log(`  BEFORE: ${JSON.stringify(oldCslTypes)}`);
			var idx = oldCslTypes.indexOf(oldCslField);
			oldCslTypes = oldCslTypes.slice(0, idx).concat(oldCslTypes.slice(idx+1));
			oldObj.csl.types[cslType] = oldCslTypes;
			console.log(`  AFTER: ${JSON.stringify(oldCslTypes)}`);
		}
	}
}

var addCslFieldsMissingInOldCslType = (cslType) => {
	var newCslTypes = newObj.csl.types[cslType];
	var oldCslTypes = oldObj.csl.types[cslType];
	for (var newCslField of newCslTypes) {
		for (oldCslField of oldCslTypes) {
			var hasField = false;
			if (oldCslField === newCslField) {
				hasField = true;
				break;
			}
		}
		if (!hasField) {
			console.log(`Adding csl field ${newCslField} to ${cslType}`);
			oldCslTypes.push(newCslField);
		}
	}
}

var cslTypeMappingChanges = (cslType) => {
	removeCslFieldsNotInOldCslType(cslType);
	addCslFieldsMissingInOldCslType(cslType);
}

var cslTypeMappingsNotInOld = () => {
	for (var newType in newObj.csl.types) {
		if (!oldObj.csl.types[newType]) {
			console.log(`adding csl type ${newType}`);
			oldObj.csl.types[newType] = newObj.csl.types[newType];
		} else {
			cslTypeMappingChanges(newType);
		}
	}
};

var creatorTypesNotInOld = (itemType) => {
	for (var newCreatorObj of newObj.itemTypes[itemType].creatorTypes) {
		var newCreatorType = newCreatorObj.creatorType;
		for (var oldCreatorObj of oldObj.itemTypes[itemType].creatorTypes) {
			var oldCreatorType = oldCreatorObj.creatorType;
			if (newCreatorType === oldCreatorType) {
				newCreatorType = null;
				break;
			}
		}
		if (newCreatorType) {
			console.log(`adding creator type ${newCreatorType} to ${itemType}`);
			oldObj.itemTypes[itemType].creatorTypes.push(newCreatorObj);
		}
	}
}

var fieldsNotInOld = (itemType) => {
	for (var newFieldObj of newObj.itemTypes[itemType].fields) {
		var newField = newFieldObj.field;
		for (var oldFieldObj of oldObj.itemTypes[itemType].fields) {
			var oldField = oldFieldObj.field;
			if (newField === oldField) {
				//console.log(`  ${newField} in both old and new`);
				newField = null;
				break;
			}
		}
		if (newField) {
			console.log(`adding field ${newField} to ${itemType}`);
			oldObj.itemTypes[itemType].fields.push(newFieldObj);
		}
	}
}

var itemTypeNotInOld = () => {
	for (var itemType in newObj.itemTypes) {
		if (!oldObj.itemTypes[itemType]) {
			console.log(`adding item type: ${itemType}`);
			oldObj.itemTypes[itemType] = newObj.itemTypes[itemType];
		} else {
			fieldsNotInOld(itemType);
			creatorTypesNotInOld(itemType);
		}
	}
}
itemTypeNotInOld();
cslTypeMappingsNotInOld();

var itemTypes = oldObj.itemTypes;
oldObj.itemTypes = [];
for (var itemTypeObj of newData.itemTypes) {
	var itemType = itemTypeObj.itemType;
	oldObj.itemTypes.push(itemTypes[itemType]);
}

fs.writeFileSync("schema-new.json", JSON.stringify(oldObj, null, 4));
