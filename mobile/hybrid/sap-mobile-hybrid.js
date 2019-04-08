/* hybrid capacity bootstrap
 *
 * This has to happen after sapui5 bootstrap, and before first application page is loaded.
 */

sap.hybrid = {
	loadCordova: false,

	setCordova: function () {
		sap.hybrid.loadCordova = true;
	},

	packUrl: function (url, route) {
		var result;
		if (route.manual) { // routes requires a manually created Mobile Destination with Rewrite on Backend and via CP App set
			result = route.path; // keep the original path
		} else { // OData routes that can be proxied through the automatically created CP Destination
			var connection = (fiori_client_appConfig.appID + "_" + route.destination).substr(0, 63); // max length cap by SCPms DB
			result = "/" + connection;
		}
		var path = url.substring(route.path.endsWith("/") ? route.path.length - 1 : route.path.length); // the remaining URL path
		result += (route.entryPath ? route.entryPath : "") + path;
		return result;
	},

	openStore: function () {
		sap.m.MessageToast.show("In openStore");
		jQuery.sap.require("sap.ui.thirdparty.datajs"); //Required when using SAPUI5 and the Kapsel Offline Store
		var properties = {
			"name": "chek_mainService",
			"host": sap.hybrid.kapsel.appContext.registrationContext.serverHost,
			"port": sap.hybrid.kapsel.appContext.registrationContext.serverPort,
			"https": sap.hybrid.kapsel.appContext.registrationContext.https,
			"serviceRoot": fiori_client_appConfig.appID + "_" + mobile_appRoutes[0].destination,

			"definingRequests": {
				"chekset": "/parentSet",
				"empset": "/EmployeeSet"
			}
		};

		store = sap.OData.createOfflineStore(properties);

		var openStoreSuccessCallback = function () {
			sap.m.MessageToast.show("In openStoreSuccessCallback");
			sap.OData.applyHttpClient(); //Offline OData calls can now be made against datajs.
			sap.hybrid.startApp();
		}

		var openStoreErrorCallback = function (error) {
			sap.m.MessageToast.show("In openStoreErrorCallback");
			sap.m.MessageToast.show("An error occurred" + JSON.stringify(error));
		}

		store.open(openStoreSuccessCallback, openStoreErrorCallback);
	},

	refreshStore: function () {
		sap.m.MessageToast.show("Offline events: refreshStore");
		if (!store) {
			sap.m.MessageToast.show("The store must be open before it can be refreshed");
			return;
		}
		store.refresh(sap.hybrid.refreshStoreCallback, sap.hybrid.errorCallback, null, sap.hybrid.progressCallback);
	},

	refreshStoreCallback: function () {
		sap.m.MessageToast.show("Offline events: refreshStoreCallback");
	},

	clearStore: function () {
		sap.m.MessageToast.show("Offline events: clearStore");
		store.close(sap.hybrid.closeStoreCallback, sap.hybrid.errorCallback);
	},

	closeStoreCallback: function () {
		sap.m.MessageToast.show("Offline events: closeStoreCallback");
		store.clear(function () {
			sap.m.MessageToast.show("Clear Success");
		}, sap.hybrid.errorCallback);
	},

	flushStore: function () {
		sap.m.MessageToast.show("Offline events: flushStore");
		if (!store) {
			sap.m.MessageToast.show("The store must be open before it can be flushed");
			return;
		}
		store.flush(sap.hybrid.flushStoreCallback, sap.hybrid.errorCallback, null, sap.hybrid.progressCallback);
	},

	flushStoreCallback: function () {
		sap.m.MessageToast.show("Offline events: flushStoreCallback");
	},

	errorCallback: function (error) {
		sap.m.MessageToast.show("Offline events: errorCallback");
		sap.m.MessageToast.show("An error occurred: " + JSON.stringify(error));
	},

	progressCallback: function (progressStatus) {
		// sap.m.MessageToast.show("Offline events: progressCallback");

		var status = progressStatus.progressState;
		var lead = "unknown";
		if (status === sap.OfflineStore.ProgressState.STORE_DOWNLOADING) {
			lead = "Downloading ";
		} else if (status === sap.OfflineStore.ProgressState.REFRESH) {
			lead = "Refreshing ";
		} else if (status === sap.OfflineStore.ProgressState.FLUSH_REQUEST_QUEUE) {
			lead = "Flushing ";
		} else if (status === sap.OfflineStore.ProgressState.DONE) {
			lead = "Complete ";
		} else {
			sap.m.MessageToast.show("Unknown status in progressCallback");
		}
		sap.m.MessageToast.show(lead + "Sent: " + progressStatus.bytesSent + "  Received: " + progressStatus.bytesRecv + "   File Size: " +
			progressStatus.fileSize);
	},

	appLogon: function (appConfig) {
		var context = {};
		var url = appConfig.fioriURL;
		if (url && (url.indexOf("https://") === 0 || url.indexOf("http://") === 0)) {
			if (url.indexOf("https://") === 0) {
				context.https = true;
				url = url.substring("https://".length);
			} else {
				context.https = false;
				url = url.substring("http://".length);
			}

			if (url.indexOf("?") >= 0) {
				url = url.substring(0, url.indexOf("?"));
			}
			if (url.indexOf("/") >= 0) {
				url = url.split("/")[0];
			}
			if (url.indexOf(":") >= 0) {
				context.serverHost = url.split(":")[0];
				context.serverPort = url.split(":")[1];
			}
		}

		// set auth element
		if (appConfig.auth) {
			context.auth = appConfig.auth;
		}

		// If communicatorId is set then use it to be compatible with existing values. Otherwise, use the default "REST". 
		// By doing so logon core does not need to send ping request to server root URL, which will cause authentication issue. 
		// It occurs when the root URL uses a different auth method from the application's endpoint URL, as application can only handle authentication on its own endpoint URL.
		context.communicatorId = appConfig.communicatorId ? appConfig.communicatorId : "REST";

		// if ("serverHost" in context && "serverPort" in context && "https" in context) {
		// 	// start SCPms logon
		// 	sap.hybrid.kapsel.doLogonInit(context, appConfig.appID, sap.hybrid.startApp);
		if ('serverHost' in context && 'serverPort' in context && 'https' in context) {
			// start SCPms logon
			sap.hybrid.kapsel.doLogonInit(context, appConfig.appID, sap.hybrid.openStore);
			// Modification of the datasource uri in the manifest file is no longer required. You can use 
		} else {
			console.error("context data for logon are not complete");
		}
	},

	bootStrap: function () {
		if (sap.hybrid.loadCordova) {
			// bind to Cordova event
			document.addEventListener("deviceready", function () {
				// check if app configuration is available
				if (fiori_client_appConfig && fiori_client_appConfig.appID && fiori_client_appConfig.fioriURL) {
					sap.hybrid.appLogon(fiori_client_appConfig);
				} else {
					console.error("Can't find app configuration probably due to a missing appConfig.js in the app binary.");
				};
			}, false);
		} else {
			console.error("cordova is not loaded");
		}
	},

	loadComponent: function (componentName) {
		sap.ui.getCore().attachInit(function () {
			// not support sap.ushell navigation
			sap.ui.require([
				"sap/m/Shell",
				"sap/ui/core/ComponentContainer"
			], function (Shell, ComponentContainer) {
				// initialize the UI component
				new Shell({
					app: new ComponentContainer({
						height: "100%",
						name: componentName
					})
				}).placeAt("content");
			});
		});
	}
};