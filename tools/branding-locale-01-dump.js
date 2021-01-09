/*
 * Dump locale lines that include Zotero to standard output
 */

var fs = require("fs");
var path = require("path");
var query = require("prompt-radio");
var bold = require("ansi-bold");
var underline = require("ansi-underline");
var red = require("ansi-red");
var clear = require("cross-clear");

//var count = 0;

var choices = new query({
	name: "Jurism",
	message: "Replace with ... ?",
	choices: [
		" Jurism",
		" Zotero",
		" Save to BRANDO-FORCE",
		" Save and quit"
	]
});

const pth = path.join(__dirname, "..", "chrome", "locale", "en-US", "zotero");

const brando = "./BRANDO.txt";

var fns = fs.readdirSync(pth);

var brandoRet = "";
var brandoForceRet = "";

var doneOnes = {};

const editLine = async (str) => {
	var retstr = "";
	// REGEXP
	var lst = str.split(/(?:Zotero)/);
	var mm = str.match(/(Zotero)/g);
	var fakemm = mm.slice();
	for (var j=0,jlen=lst.length;j<jlen-1;j++) {
		fakemm[j] = bold(red(underline(mm[j])));
		var displaystr = "";
		for (var k=0,klen=lst.length;k<klen-1;k++) {
			displaystr += lst[k];
			displaystr += fakemm[k];
		}
		displaystr += lst.slice(-1)[0];
		console.log(displaystr);
		var res = await choices.run();
		if (res === " Save and quit") {
			fs.writeFileSync(brando, brandoRet);
			process.exit();
		} else if (res === " Save to BRANDO-FORCE") {
			clear();
			return "SAVE-TO-BRANDO-FORCE";
		} else {
			if (res) {
				mm[j] = res.trim();
				fakemm[j] = mm[j];
			}
		}
		clear();
	}
	for (var k=0,klen=lst.length;k<klen-1;k++) {
		retstr += lst[k];
		retstr += mm[k];
	}
	retstr += lst.slice(-1)[0];
	return retstr;
}

const saveToBrandoForce = (key, fn, str) => {
	brandoForceRet = "";
	brandoForceRet += `${key}@${fn}\n`;
	brandoForceRet += `    ${str}\n`;
	var txt = "";
	if (fs.existsSync("BRANDO-FORCE.txt")) {
		txt = fs.readFileSync("BRANDO-FORCE.txt").toString();
	}
	txt += brandoForceRet;
	fs.writeFileSync("BRANDO-FORCE.txt", txt);
};

async function showLines(mode, fn, txt) {
	var lines = txt.split("\n");
	for (var i=0,ilen=lines.length; i<ilen; i++) {
		var line = lines[i];
		if (mode === "dtd") {
			var m = line.match(/<\!ENTITY\s+(.*?)\s+\"(.*)\"\s*>/);
			if (m) {
				var key = m[1];
				var str = m[2];
				if (doneOnes[`${key}@${fn}`]) continue;
				if (str.indexOf("Zotero") === -1) continue;
				//count++;
				//continue;
				var fixedLine = await editLine(str);
				// doneOnes[`${key}@${fn}`] = true;
				if (fixedLine === "SAVE-TO-BRANDO-FORCE") {
					saveToBrandoForce(key, fn, str);
				} else {
					brandoRet += `${key}@${fn}\n`;
					brandoRet += `    ${fixedLine}\n`;
				}
			}
		} else if (mode === "properties") {
			var m = line.match(/^(.*?)\s+=\s+(.*)/);
			if (m) {
				var key = m[1];
				var str = m[2];
				if (doneOnes[`${key}@${fn}`]) continue;
				if (str.indexOf("Zotero") === -1) continue;
				//count++;
				//continue;
				var fixedLine = await editLine(str);
				if (fixedLine === "SAVE-TO-BRANDO-FORCE") {
					saveToBrandoForce(key, fn, str);
				} else {
					brandoRet += `${key}@${fn}\n`;
					brandoRet += `    ${fixedLine}\n`;
				}
			}
		}
	}
}

run = async () => {
	clear();
	if (fs.existsSync(brando)) {
		brandoRet = fs.readFileSync(brando).toString();
		var lines = brandoRet.split("\n");
		for (var line of lines) {
			if (line.match(/^\s+/)) continue;
			doneOnes[line.trim()] = true;
		}
	}
	if (fs.existsSync("BRANDO-FORCE.txt")) {
		brandoForceRet = fs.readFileSync("BRANDO-FORCE.txt").toString();
		var lines = brandoForceRet.split("\n");
		for (var line of lines) {
			if (line.match(/^\s+/)) continue;
			doneOnes[line.trim()] = true;
		}
	}
	for (var fn of fns) {
		var mode = null;
		if (fn.slice(-4) === ".dtd") {
			mode = "dtd";
		} else if (fn.slice(-11) === ".properties") {
			mode = "properties";
		} else {
			continue;
		}
		var txt = fs.readFileSync(path.join(pth, fn)).toString();
		await showLines(mode, fn, txt);
		//console.log(`${fn}: ${count}`);
		//count = 0;
	}
	fs.writeFileSync(brando, brandoRet);	
	//console.log(count)
}

run();
