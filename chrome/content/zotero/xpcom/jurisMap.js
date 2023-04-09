Zotero.JurisMaps = new function() {
	var _initialized = false;
	var _populated = false;
	var _initializationDeferred = false;
	var _jurisMaps;
	
	Components.utils.import("resource://gre/modules/Services.jsm");
	Components.utils.import("resource://gre/modules/FileUtils.jsm");
	
	this.totalCount = 0;
	this.progressCount = 0;
	
	this.init = Zotero.Promise.coroutine(function* (options = {}) {
		Zotero.debug("[Jurism] Running JurisMaps init", 1);
		// Wait until bundled files have been updated, except when this is called by the schema update
		// code itself
		if (!options.fromSchemaUpdate) {
			yield Zotero.Schema.schemaUpdatePromise;
		}
		
		if (Zotero.test) {
			this.versionFile = "versions-zz.json";
		} else {
			this.versionFile = "versions.json";
		}
		
		// If an initialization has already started, a regular init() call should return the promise
		// for that (which may already be resolved). A reinit should yield on that but then continue
		// with reinitialization.
		if (_initializationDeferred) {
			let promise = _initializationDeferred.promise;
			if (options.reinit) {
				yield promise;
			}
			else {
				return promise;
			}
		}
		
		_initializationDeferred = Zotero.Promise.defer();
		
		Zotero.debug("Initializing juris maps");
		var start = new Date;
		
		_jurisMaps = {};
		
		// main dir
		var dir = Zotero.getJurisMapsDirectory().path;
		var num = yield this.readMapsFromDirectory(dir);
		
		Zotero.debug("Cached " + num + " juris maps in " + (new Date - start) + " ms");
		
		yield this.populateJurisdictions();
		
		_initializationDeferred.resolve();
		_initialized = true;
	});
	
	this.reinit = function (options = {}) {
		return this.init(Object.assign({}, options, { reinit: true }));
	};
	
	/**
	 * Reads all maps from a given directory and caches their metadata
	 * @private
	 */
	this.readMapsFromDirectory = Zotero.Promise.coroutine(function* (dir) {
		var numCached = 0;
		
		var iterator = new OS.File.DirectoryIterator(dir);
		try {
			while (true) {
				let entries = yield iterator.nextBatch(10); // TODO: adjust as necessary
				if (!entries.length) break;
				
				for (let i = 0; i < entries.length; i++) {
					let entry = entries[i];
					let path = entry.path;
					let fileName = entry.name;
					if (!fileName || fileName[0] === "."
						|| fileName.substr(-5) !== ".json"
						|| (fileName.substr(0, 6) !== "juris-" && fileName !== this.versionFile)
						|| entry.isDir) continue;
					try {
						var id = fileName.slice(0, -5);
						var mapinfo = new Zotero.JurisMap(id, path);
					}
					catch (e) {
						Components.utils.reportError(e);
						Zotero.debug(e, 1);
						continue;
					}
					if(mapinfo.jurisMapID) {
						// same map is already cached
						if (_jurisMaps[mapinfo.jurisMapID]) {
							Components.utils.reportError('Juris map with ID ' + mapinfo.jurisMapID
								+ ' already loaded from ' + _jurisMaps[mapinfo.jurisMapID].fileName);
						} else {
							// add to cache
							_jurisMaps[mapinfo.jurisMapID] = mapinfo;
						}
					}
					numCached++;
				}
			}
		}
		finally {
			iterator.close();
		}
		return numCached;
	});
	
	/**
	 * Gets a map with a given ID
	 * @param {String} id
	 */
	this.get = function (id) {
		if (!_initialized) {
			throw new Zotero.Exception.UnloadedDataException("Juris maps not yet loaded (1)", 'juris-maps');
		}
		return _jurisMaps[id] || false;
	};

	/*
	 * (re)Populate the jurisdiction table
	 */
	this.populateJurisdictions = Zotero.Promise.coroutine(function*() {
		if (_populated) return;
		Zotero.debug("[Jurism] populating database with jurisdiction info");
		var mapsToUpdate = {};
		this.progressCount = 0;
		// So. What this needs to do is:
		// 1. Find the source directory
		// 2. Get a list of files in the source directory (from this.versionFile)
		// 3. Sample each file, extract header date, compare with jurisMaps version value in DB
		// 4. Iterate over files for which update is appropriate.
		var jurisMapsDir = Zotero.getJurisMapsDirectory().path;
		var jurisMapsVersionsFile = OS.Path.join(jurisMapsDir, this.versionFile);
		var versions = yield Zotero.File.getContentsAsync(jurisMapsVersionsFile);
		versions = JSON.parse(versions);
		var jurisID;
		for (jurisID in versions) {
			var newVersionInfo = versions[jurisID];
			var oldVersion = yield Zotero.DB.valueQueryAsync("SELECT version FROM jurisVersion WHERE schema = ?", [jurisID]);
			// Check if database maps version exists and is greater than or equal to the new file date
			if (!oldVersion || newVersionInfo.timestamp !== oldVersion) {
				this.totalCount = (this.totalCount + newVersionInfo.rowcount);
				mapsToUpdate[jurisID] = newVersionInfo;
			}
		}

		if (Object.keys(mapsToUpdate).length > 0) {
			Zotero.debug("updating jurisdictions: "+ JSON.stringify(Object.keys(mapsToUpdate)));
			Zotero.showZoteroPaneProgressMeter(`Configuring ${Object.keys(mapsToUpdate).length} jurisdictions`, true);

			var iterator = new OS.File.DirectoryIterator(jurisMapsDir);
			try {
				while (true) {
					let entries = yield iterator.nextBatch(10); // TODO: adjust as necessary
					if (!entries.length) break;
					// Iterate over entries list.
					for (let i = 0; i < entries.length; i++) {
						let entry = entries[i];
						let path = entry.path;
						let fileName = entry.name;
						let jurisID = fileName.replace(/^juris-/, "").replace(/-map\.json/, "");
						if (!mapsToUpdate[jurisID]
							|| !fileName
							|| fileName[0] === "."
							|| fileName.substr(-9) !== "-map.json"
							|| fileName.substr(0, 6) !== "juris-"
							|| entry.isDir) continue;
						// Process passing files one by one
						var jurisFilePath = OS.Path.join(jurisMapsDir, fileName);
						jurisID = fileName.replace("juris-", "").replace("-map.json", "");
						yield this.populateOneJurisdiction(jurisID, jurisFilePath, mapsToUpdate[jurisID].timestamp);
					}
				}
			} catch (e) {
				Zotero.hideZoteroPaneOverlays();
				throw e;
			}
			Zotero.hideZoteroPaneOverlays();
			alert(`Configured ${Object.keys(mapsToUpdate).length}} jurisdictions.\nRestart Jurism to install the updated configuration.`);
		}
		_populated = true;
	});

	this.updateProgressMeter = function() {
		this.progressCount++;
		if ((this.progressCount % 25) === 0) {
			Zotero.updateZoteroPaneProgressMeter(Math.round(this.progressCount * 100 / this.totalCount));
		}
	};
	
	this.getNextIdx = (segment) => {
		var nextIdx = this.indices[`${segment}Holes`][0];
		if ("number" !== typeof nextIdx) {
			nextIdx = this.lastIdx[segment];
			nextIdx++;
			while (this.indices[segment].indexOf(nextIdx) > -1) {
				nextIdx++;
			}
		} else {
			this.indices[`${segment}Holes`] = this.indices[`${segment}Holes`].slice(1);
		}
		this.lastIdx[segment] = nextIdx;
		return nextIdx;
	};

	this.setLanguages = Zotero.Promise.coroutine(function* (obj) {
		var ret = {};
		var selSQL = "SELECT langIdx FROM uiLanguages WHERE lang=?";
		var insSQL = "INSERT INTO uiLanguages VALUES (NULL, ?)";
		for (var lang in obj.jurisdictions) {
			var idx = yield Zotero.DB.valueQueryAsync(selSQL, lang);
			if ("number" !== typeof idx) {
				yield Zotero.DB.queryAsync(insSQL, [lang]);
				idx = yield Zotero.DB.valueQueryAsync(selSQL, lang);
			}
			ret[lang] = idx;
		}
		return ret;
	});
	
	this.setCountry = Zotero.Promise.coroutine(function* (jurisID) {
		var countryID = jurisID.split(":")[0];
		var selSQL = "SELECT countryIdx FROM countries WHERE countryID=?";
		var insSQL = "INSERT INTO countries VALUES (NULL, ?)";
		var idx = yield Zotero.DB.valueQueryAsync(selSQL, countryID);
		if ("number" !== typeof idx) {
			yield Zotero.DB.queryAsync(insSQL, [countryID]);
			idx = yield Zotero.DB.valueQueryAsync(selSQL, countryID);
		}
		return idx;
	});
	
	this.setJurisdictions = Zotero.Promise.coroutine(function* (jurisID, obj) {

		// Assure that country exists
		var countryIdx = yield this.setCountry(jurisID);
		
		// Assure that languages exist
		this.langIndex = yield this.setLanguages(obj);

		var insSQL = "INSERT INTO jurisdictions VALUES (?, ?, ?, ?, ?);";
		var insSQLnolang = "INSERT INTO jurisdictions VALUES (?, ?, ?, ?, NULL);";

		var fullIdVals = {};
		var fullNameVals = {};
		for (var lang in obj.jurisdictions) {
			var langIdx = this.langIndex[lang];
			for (var i=0,ilen=obj.jurisdictions[lang].length; i<ilen; i++) {
				var jurisdiction = obj.jurisdictions[lang][i];
				var parentPos = jurisdiction[2];
				if (parentPos === null) {
					fullIdVals[i] = jurisdiction[0];
					fullNameVals[i] = jurisdiction[1] + "|" + jurisdiction[0].toUpperCase();
				} else {
					fullIdVals[i] = fullIdVals[jurisdiction[2]] + ":" + jurisdiction[0];
					fullNameVals[i] = fullNameVals[jurisdiction[2]] + "|" + jurisdiction[1];
				}
				var nextIdx = this.getNextIdx("jurisdiction");
				var fullID = fullIdVals[i];
				var fullName = fullNameVals[i];
				var segmentCount = fullName.split("|").length;

				// Potential existing entries are purged before function is run
				if (lang === "default") {
					yield Zotero.DB.queryAsync(insSQLnolang, [nextIdx, fullID, fullName, segmentCount]);
				} else {
					yield Zotero.DB.queryAsync(insSQL, [nextIdx, fullID, fullName, segmentCount, langIdx]);
				}
				for (var courtPos of jurisdiction.slice(3)) {
					var courtID = obj.courts[courtPos][0];
					var courtName = obj.courts[courtPos][1];
					var courtIdx = yield this.setCourt(countryIdx, courtID, courtName, lang);
					yield this.setJurisdictionCourt(nextIdx, courtIdx, lang);
				}
				this.updateProgressMeter();
			}
		}
	});
	
	// Set a single court. Called from setJurisdictionCourts
	this.setCourt = Zotero.Promise.coroutine(function* (countryIdx, courtID, courtName, lang) {
		var langIdx = this.langIndex[lang];
		var selSQL = "SELECT courtIdx FROM courts WHERE countryIdx=? AND courtID=? AND langIdx=?";
		var selSQLnolang = "SELECT courtIdx FROM courts WHERE countryIdx=? AND courtID=? AND langIdx IS NULL";
		var insSQL = "INSERT INTO courts VALUES (?, ?, ?, ?, ?);";
		var insSQLnolang = "INSERT INTO courts VALUES (?, ?, ?, ?, NULL);";

		var courtIdx;
		if (lang === "default") {
			courtIdx = yield Zotero.DB.valueQueryAsync(selSQLnolang, [countryIdx, courtID]);
		} else {
			courtIdx = yield Zotero.DB.valueQueryAsync(selSQL, [countryIdx, courtID, langIdx]);
		}
		if (!courtIdx) {
			courtName = courtName.replace(/^%s\s*/, "").replace(/\s*%s$/, "");
			courtIdx = this.getNextIdx("court");
			if (lang === "default") {
				yield Zotero.DB.queryAsync(insSQLnolang, [courtIdx, countryIdx, courtID, courtName]);
			} else {
				yield Zotero.DB.queryAsync(insSQL, [courtIdx, countryIdx, courtID, courtName, langIdx]);
			}
		}
		return courtIdx;
	});

	this.setJurisdictionCourt = Zotero.Promise.coroutine(function* (jurisdictionIdx, courtIdx, lang) {
		// Purge at the top of populateOneJurisdiction assures there will be no existing entry
		var insSQL = "INSERT INTO jurisdictionCourts VALUES (NULL, ?, ?, ?)";
		var insSQLnolang = "INSERT INTO jurisdictionCourts VALUES (NULL, ?, ?, NULL)";
		if (lang === "default") {
			yield Zotero.DB.queryAsync(insSQLnolang, [jurisdictionIdx, courtIdx]);
		} else {
			yield Zotero.DB.queryAsync(insSQL, [jurisdictionIdx, courtIdx, lang]);
		}
	});
	
	this.finalize = Zotero.Promise.coroutine(function* (jurisID, version) {
		var sql = "INSERT OR REPLACE INTO jurisVersion VALUES (?, ?)";
		yield Zotero.DB.queryAsync(sql, [jurisID, version]);
	});

	this.populateOneJurisdiction = Zotero.Promise.coroutine(function*(jurisID, jurisFilePath, version) {
		try {

			this.indices = {};
			Zotero.debug("Deleting any previous data in jurisdictions table for "+jurisID);
			
			// Get a list of jurisdiction indices to be opened by removal
			this.indices.jurisdictionHoles = yield Zotero.DB.columnQueryAsync('SELECT jurisdictionIdx FROM jurisdictions WHERE jurisdictionID=? OR jurisdictionID LIKE ? ORDER BY jurisdictionIdx', [jurisID, jurisID + ":%"]);
			yield Zotero.DB.queryAsync('DELETE FROM jurisdictions WHERE jurisdictionID=? OR jurisdictionID LIKE ?', [jurisID, jurisID + ":%"]);
			
			// Get a list of court indices to be opened by removal
			this.indices.courtHoles = yield Zotero.DB.columnQueryAsync('SELECT courtIdx FROM courts WHERE courtIdx NOT IN (SELECT courtIdx FROM jurisdictionCourts) ORDER BY courtIdx');
			yield Zotero.DB.queryAsync('DELETE FROM courts WHERE courtIdx NOT IN (SELECT courtIdx FROM jurisdictionCourts)');

			// Get lists of all remaining indices
			this.indices.court = yield Zotero.DB.columnQueryAsync("SELECT courtIdx FROM courts");
			this.indices.jurisdiction = yield Zotero.DB.columnQueryAsync("SELECT jurisdictionIdx FROM jurisdictions");

			// Initialize index counters
			this.lastIdx = {
				jurisdiction: 1,
				court: 1
			};
			
			Zotero.debug("Populating jurisdictions for " + jurisID);

			// Fetch JSON file from data directory
			var jsonStr = yield Zotero.File.getContentsAsync(jurisFilePath);
			var obj = JSON.parse(jsonStr);
			
			yield this.setJurisdictions(jurisID, obj);
			
			yield this.finalize(jurisID, version);
		} catch (e) {
			Zotero.debug("Failed to populate " + jurisID);
			Zotero.debug(e);
		}
	});
}

/**
 * @class Represents a style module file
 * @property {String} id The id of the style module derived from its filename
 * @property {String} path The path to the style file
 */
Zotero.JurisMap = function (id, path) {
	if (path) {
		this.path = path;
		this.fileName = OS.Path.basename(path);
	}
	this.jurisMapID = id;
	this.title = id;
}

/**
 * Retrieves the XML corresponding to this style module
 * @type String
 */
Zotero.JurisMap.prototype.getXML = function () {
	return Zotero.File.getContents(this.path);
};
