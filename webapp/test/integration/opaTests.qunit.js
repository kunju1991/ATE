/* global QUnit */

QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function() {
	"use strict";

	sap.ui.require([
		"ate/activity/book/ATE/test/integration/AllJourneys"
	], function() {
		QUnit.start();
	});
});