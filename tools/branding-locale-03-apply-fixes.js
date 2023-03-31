var fs = require("fs");
var path = require("path");

const getScriptDir = (fn) => {
	var pth = path.join(__dirname);
	if (fn) {
		return path.join(pth, fn);
	} else {
		return pth;
	}
}

const getLocaleDir = (fn) => {
	var pth = path.join(__dirname, "..", "chrome", "locale");
	if (fn) {
		return path.join(pth, fn);
	} else {
		return pth;
	}
}

const getLocaleFile = (locale, fn) => {
	var pth = path.join(__dirname, "..", "chrome", "locale", locale, "zotero");
	if (fn) {
		return path.join(pth, fn);
	} else {
		return pth;
	}
}

/*
 * Load replacements object
 */

const getReplacements = () => {
	return JSON.parse(fs.readFileSync(getScriptDir("branding-locale-replacements.json")));
}

const patchConnectorJSON = () => {
	for (var locale of fs.readdirSync(getLocaleDir())) {
        var pth = getLocaleFile(locale, "connector.json");
        if (!fs.existsSync(pth)) continue;
		var obj = JSON.parse(fs.readFileSync(getLocaleFile(locale, "connector.json")).toString());
		for (var key in obj) {
			for (var subkey in obj[key]) {
				if ("string" === typeof obj[key][subkey]) {
					obj[key][subkey] = obj[key][subkey].replace(/Zotero/g, "Jurism");
				}
			}
		}
		fs.writeFileSync(getLocaleFile(locale, "connector.json"), JSON.stringify(obj, null, 2));
	}
};

/*
 * Force replacements
 */

const setStringsInLocaleFiles = (repl) => {
	for (var fn in repl) {
		var mode = null;
		if (fn.slice(-4) === ".dtd") {
			mode = "dtd";
		} else if (fn.slice(-11) === ".properties") {
			mode = "properties";
		} else {
			continue;
		}
		var fileRepl = repl[fn];
		
		for (var locale of fs.readdirSync(getLocaleDir())) {
			var txt = fs.readFileSync(getLocaleFile(locale, fn)).toString();
			var lines = txt.split("\n");

			for (var key in repl[fn]) {
				var mKey = key.replace(/\./g, "\\.");
				var rex = null;
				if (mode === "dtd") {
					rex = new RegExp(`\\s${mKey}\\s+"([^"]+)"`);
				} else if (mode === "properties") {
					rex = new RegExp(`^${mKey}\\s+=\\s+(.*)`);
				}

				for (var i=0,ilen=lines.length;i<ilen;i++) {
					var line = lines[i];
					var m = line.match(rex);
					if (!m) continue;

					var str = m[1];
					if (repl[fn][key].text) {
						str = repl[fn][key].text;
					} else if (repl[fn][key].words) {
						var lst = str.split(/(?:Zotero)/);
						var mWords = str.match(/(?:Zotero)/g);
						if (!mWords) continue;
						var replWords = repl[fn][key].words;
						replWords = replWords.slice(0, mWords.length);
						while (mWords.length > replWords.length) {
							replWords.push("Jurism");
						}
						var str = "";
						for (var j=0,jlen=lst.length; j<jlen-1; j++) {
							str += lst[j];
							str += replWords[j];
						}
						str += lst[lst.length-1];
					} else {
						continue;
					}

					str = str.trim();
						
					if (mode === "dtd") {
						lines[i] = line.replace(rex, ` ${key} "${str}"`);
					} else if (mode === "properties") {
						lines[i] = line.replace(rex, `${key} = ${str}`);
					}
				}
			}
			txt = lines.join("\n");
			fs.writeFileSync(getLocaleFile(locale, fn), txt);
		}
	}
	patchConnectorJSON();
}

const run = () => {
	var repl = getReplacements();
	setStringsInLocaleFiles(repl);
}

run();
