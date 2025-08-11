describe("Support Functions for Unit Testing", function() {
	describe("resetDB", function() {
		it("should restore the DB to factory settings", async function () {
			await Zotero.DB.queryAsync("CREATE TABLE testTable (foo INTEGER PRIMARY KEY)");
			assert.isTrue(await Zotero.DB.tableExists('testTable'));
			await resetDB({
				thisArg: this
			});
			assert.isFalse(await Zotero.DB.tableExists('testTable'));
		});
	});
	describe("loadSampleData", function() {
		it("should load data from file", function() {
			let data = loadSampleData('journalArticle');
			assert.isObject(data, 'loaded data object');
			assert.isNotNull(data);
			assert.isAbove(Object.keys(data).length, 0, 'data object is not empty');
		});
	});
	describe("populateDBWithSampleData", function() {
		it("should populate database with data", Zotero.Promise.coroutine(function* () {
			let data = loadSampleData('journalArticle');
			yield populateDBWithSampleData(data);
			
			let skipFields = ['id', 'itemType', 'creators', 'multi']; // Special comparisons
			
			for (let itemName in data) {
				let item = data[itemName];
				assert.isAbove(item.id, 0, 'assigned new item ID');
				
				let zItem = yield Zotero.Items.getAsync(item.id);
				assert.ok(zItem, 'inserted item into database');
				
				// Compare item type
				assert.equal(item.itemType, Zotero.ItemTypes.getName(zItem.itemTypeID), 'inserted item has the same item type');
				
				// Compare simple properties
				for (let prop in item) {
					if (skipFields.indexOf(prop) != -1) continue;
					
					// Using base-mapped fields
					let field = zItem.getField(prop, false, true);
					if (prop === "accessDate") field = Zotero.Date.sqlToISO8601(field);
					assert.equal(field, item[prop], 'inserted item property has the same value as sample data');
				}
				
				if (item.creators) {
					// Compare creators
					for (let i=0; i<item.creators.length; i++) {
						let creator = item.creators[i];
						let zCreator = zItem.getCreator(i);
						assert.ok(zCreator, 'creator was added to item');
						assert.equal(creator.firstName, zCreator.firstName, 'first names match');
						assert.equal(creator.lastName, zCreator.lastName, 'last names match');
						assert.equal(creator.creatorType, Zotero.CreatorTypes.getName(zCreator.creatorTypeID), 'creator types match');
					}
				}
			}
		}));
		it("should populate items with tags", Zotero.Promise.coroutine(function* () {
			let data = yield populateDBWithSampleData({
				itemWithTags: {
					itemType: "journalArticle",
					tags: [
						{ tag: "automatic tag", type: 0 },
						{ tag: "manual tag", type: 1}
					]
				}
			});
			
			let zItem = yield Zotero.Items.getAsync(data.itemWithTags.id);
			assert.ok(zItem, 'inserted item with tags into database');
			

			let tags = data.itemWithTags.tags;
			for (let i=0; i<tags.length; i++) {
				let tagID = Zotero.Tags.getID(tags[i].tag);
				assert.ok(tagID, '"' + tags[i].tag + '" tag was inserted into the database');
				assert.ok(zItem.hasTag(tags[i].tag), '"' + tags[i].tag + '" tag was assigned to item');
			}
		}));
	});
	describe("generateAllTypesAndFieldsData", function() {
		it("should generate all types and fields data", function() {
			let data = generateAllTypesAndFieldsData();
			assert.isObject(data, 'created data object');
			assert.isNotNull(data);
			assert.isAbove(Object.keys(data).length, 0, 'data object is not empty');
		});
		it("all types and fields sample data should be up to date", function() {
			var fileData = loadSampleData('allTypesAndFields');
			var generatedData = generateAllTypesAndFieldsData();
            
			for (var key in fileData) {
				assert.isTrue(!!generatedData[key], "generated data has all keys in sample");
			}
			for (var key in generatedData) {
				assert.isTrue(!!fileData[key], "sample has all keys in generated data");
			}
			for (var key in fileData) {
				for (var field in fileData[key]) {
					if ("string" === typeof fileData[key][field] || "number" === typeof fileData[key][field]) {
						assert.equal(fileData[key][field], generatedData[key][field], "text/number field " + field + " in sample matches generated data");
					}
				}
			}
			for (var key in generatedData) {
				for (var field in generatedData[key]) {
					if ("string" === typeof generatedData[key][field] || "number" === typeof generatedData[key][field]) {
						assert.equal(generatedData[key][field], fileData[key][field], "text/number field " + field +" of "+key+" in generated data matches the sample");
					}
				}
			}
			for (var key in fileData) {
				assert.equal(fileData[key].creators.length, generatedData[key].creators.length, "sample and generated data have the same number of creators for "  + key);
				for (var i in fileData[key].creators) {
					var sampleCreator = fileData[key].creators[i];
					var generatedCreator = generatedData[key].creators[i];
					assert.deepEqual(sampleCreator, generatedCreator, "sample creator matches generated creator");
				}
			}
			for (var key in fileData) {
				assert.deepEqual(fileData[key], generatedData[key], "sample data for item type matches generated data");
			}
			assert.deepEqual(loadSampleData('allTypesAndFields'), generateAllTypesAndFieldsData());
		});
	});
	describe("generateItemJSONData", function() {
		it("item JSON data should be up to date", Zotero.Promise.coroutine(function* () {
			let oldData = loadSampleData('itemJSON'),
				newData = yield generateItemJSONData();
			
			assert.isObject(newData, 'created data object');
			assert.isNotNull(newData);
			assert.isAbove(Object.keys(newData).length, 0, 'data object is not empty');
			
			// Ignore data that is not stable, but make sure it is set
			let ignoreFields = ['dateAdded', 'dateModified', 'key'];
			for (let itemName in oldData) {
				for (let i=0; i<ignoreFields.length; i++) {
					let field = ignoreFields[i]
					if (oldData[itemName][field] !== undefined) {
						assert.isDefined(newData[itemName][field], field + ' is set');
						delete oldData[itemName][field];
						delete newData[itemName][field];
					}
				}
			}
			// START
			for (var key in oldData) {
				assert.isTrue(!!newData[key], "generated data has all keys in sample");
			}
			for (var key in newData) {
				assert.isTrue(!!oldData[key], "sample has all keys in generated data");
			}
			for (var key in oldData) {
				for (var field in oldData[key]) {
					if ("string" === typeof oldData[key][field] || "number" === typeof oldData[key][field]) {
						assert.equal(oldData[key][field], newData[key][field], "text/number field " + field + " in sample matches generated data");
					}
				}
			}
			for (var key in newData) {
				for (var field in newData[key]) {
					if ("string" === typeof newData[key][field] || "number" === typeof newData[key][field]) {						
						assert.equal(newData[key][field], oldData[key][field], "text/number field " + field +" in generated data matches the sample");
					}
				}
			}
			for (var key in oldData) {
				assert.equal(oldData[key].creators.length, newData[key].creators.length, "sample and generated data have the same number of creators for "  + key);
				for (var i in oldData[key].creators) {
					var sampleCreator = oldData[key].creators[i];
					var generatedCreator = newData[key].creators[i];
					assert.deepEqual(sampleCreator, generatedCreator, "sample creator matches generated creator");
				}
			}
			for (var key in oldData) {
				assert.deepEqual(oldData[key], newData[key], "sample data for item type matches generated data");
			}
			// END
			assert.deepEqual(oldData, newData);
		}));
	});
	// describe("generateCiteProcJSExportData", function() {
	// 	let citeURL = Zotero.Prefs.get("export.citePaperJournalArticleURL");
	// 	before(function () {
	// 		Zotero.Prefs.set("export.citePaperJournalArticleURL", true);
	// 	});
	// 	after(function() {
	// 		Zotero.Prefs.set("export.citePaperJournalArticleURL", citeURL);
	// 	});
		
	// 	it("all citeproc-js export data should be up to date", Zotero.Promise.coroutine(function* () {
	// 		let oldData = loadSampleData('citeProcJSExport'),
	// 			newData = yield generateCiteProcJSExportData();
			
	// 		assert.isObject(newData, 'created data object');
	// 		assert.isNotNull(newData);
	// 		assert.isAbove(Object.keys(newData).length, 0, 'citeproc-js export object is not empty');
			
	// 		// Ignore item ID
	// 		for (let itemName in oldData) {
	// 			delete oldData[itemName].id;
	// 		}
	// 		for (let itemName in newData) {
	// 			delete newData[itemName].id;
	// 		}
			
	// 		assert.deepEqual(oldData, newData, 'citeproc-js export data has not changed');
	// 	}));
	// });
	describe("generateTranslatorExportData", function() {
		it("legacy mode data should be up to date", Zotero.Promise.coroutine(function* () {
			let oldData = loadSampleData('translatorExportLegacy'),
				newData = yield generateTranslatorExportData(true);
			

			assert.isObject(newData, 'created data object');
			assert.isNotNull(newData);
			assert.isAbove(Object.keys(newData).length, 0, 'translator export object is not empty');
			
			// Ignore data that is not stable, but make sure it is set
			let ignoreFields = ['itemID', 'dateAdded', 'dateModified', 'uri', 'key'];
			for (let itemName in oldData) {
				for (let i=0; i<ignoreFields.length; i++) {
					let field = ignoreFields[i];
					if (oldData[itemName][field] !== undefined) {
						assert.isDefined(newData[itemName][field], field + ' is set');
						delete oldData[itemName][field];
						delete newData[itemName][field];
					}
				}
			}
			// START
			for (var key in oldData) {
				assert.isTrue(!!newData[key], "generated data has all keys in sample");
			}
			for (var key in newData) {
				assert.isTrue(!!oldData[key], "sample has all keys in generated data");
			}
			for (var key in oldData) {
				for (var field in oldData[key]) {
					if ("string" === typeof oldData[key][field] || "number" === typeof oldData[key][field]) {
						assert.equal(oldData[key][field], newData[key][field], "text/number field " + field + " in sample matches generated data for type " + key);
					}
				}
			}
			for (var key in newData) {
				for (var field in newData[key]) {
					if ("string" === typeof newData[key][field] || "number" === typeof newData[key][field]) {
						assert.equal(newData[key][field], oldData[key][field], "text/number field " + field +" in generated data matches the sample for type " + key);
					}
				}
			}
			for (var key in oldData) {
				assert.equal(oldData[key].creators.length, newData[key].creators.length, "sample and generated data have the same number of creators for "  + key);
				for (var i in oldData[key].creators) {
					var sampleCreator = oldData[key].creators[i];
					var generatedCreator = newData[key].creators[i];
					assert.deepEqual(sampleCreator, generatedCreator, "sample creator matches generated creator");
				}
			}
			for (var key in oldData) {
				assert.deepEqual(oldData[key], newData[key], "sample data for item type matches generated data");
			}
			// END

			assert.deepEqual(oldData, newData, 'translator export data has not changed');
		}));
		it("translator export data should be up to date", Zotero.Promise.coroutine(function* () {
			let oldData = loadSampleData('translatorExport'),
				newData = yield generateTranslatorExportData();
			assert.isObject(newData, 'created data object');
			assert.isNotNull(newData);
			assert.isAbove(Object.keys(newData).length, 0, 'translator export object is not empty');
			
			// Ignore data that is not stable, but make sure it is set
			let ignoreFields = ['dateAdded', 'dateModified', 'uri'];
			for (let itemName in oldData) {
				for (let i=0; i<ignoreFields.length; i++) {
					let field = ignoreFields[i]
					if (oldData[itemName][field] !== undefined) {
						assert.isDefined(newData[itemName][field], field + ' is set');
						delete oldData[itemName][field];
						delete newData[itemName][field];
					}
				}
			}
			// START
			for (var key in oldData) {
				assert.isTrue(!!newData[key], "generated data has all keys in sample");
			}
			for (var key in newData) {
				assert.isTrue(!!oldData[key], "sample has all keys in generated data");
			}
			for (var key in oldData) {
				for (var field in oldData[key]) {
					if ("string" === typeof oldData[key][field] || "number" === typeof oldData[key][field]) {
						assert.equal(oldData[key][field], newData[key][field], "text/number field " + field + " in sample matches generated data");
					}
				}
			}
			for (var key in newData) {
				for (var field in newData[key]) {
					if ("string" === typeof newData[key][field] || "number" === typeof newData[key][field]) {
						assert.equal(newData[key][field], oldData[key][field], "text/number field " + field +" in generated data matches the sample");
					}
				}
			}
			for (var key in oldData) {
				assert.equal(oldData[key].creators.length, newData[key].creators.length, "sample and generated data have the same number of creators for "  + key);
				for (var i in oldData[key].creators) {
					var sampleCreator = oldData[key].creators[i];
					var generatedCreator = newData[key].creators[i];
					assert.deepEqual(sampleCreator, generatedCreator, "sample creator matches generated creator");
				}
			}
			for (var key in oldData) {
				// Zotero.debug("old\n" + JSON.stringify(oldData.legalCommentary, null, 2), 1);
				// Zotero.debug("new\n" + JSON.stringify(newData.legalCommentary, null, 2), 1);
				assert.deepEqual(oldData[key], newData[key], "sample data for item type matches generated data");
			}
			// END
			assert.deepEqual(oldData, newData, 'translator export data has not changed');
		}));
	});
});
