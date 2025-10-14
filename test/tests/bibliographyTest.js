"use strict";

describe("Create Bibliography Dialog", function () {
	var win, zp;
	
	before(async function () {
		win = await loadZoteroPane();
		zp = win.ZoteroPane;
	});
	
	after(function () {
		win.close();
	});
	
	it("should open the Cite prefpane when Manage Styles… is clicked", async function () {
		await Zotero.Styles.init();
		var item = await createDataObject('item');
		
		var deferred = Zotero.Promise.defer();
		var called = false;
		Zotero.debug("Opening Bibliography pane", 1);
		waitForWindow("chrome://zotero/content/bibliography.xhtml", function (dialog) {
			Zotero.debug("Opening Preferences pane", 1);
			waitForWindow("chrome://zotero/content/preferences/preferences.xhtml", function (window) {
				// Wait for switch to Cite pane
				Zotero.debug("Opening Cite pane", 1);
				(async function () {
					do {
						Zotero.debug("Checking for pane", 1);
						await Zotero.Promise.delay(5);
					}
					while (!window.document.querySelector('[value=zotero-prefpane-cite]').selected);
					called = true;
					window.close();
					deferred.resolve();
				})();
			});
			dialog.document.getElementById('manage-styles').click();
		});
		await win.Zotero_File_Interface.bibliographyFromItems();
		await deferred.promise;
		
		assert.ok(called);
	});
});
