'use babel';

var pathsep = require("path").sep;
var pkgName = 'smart-tab-names';
var pkgTitle = 'SmartTabNames';

import { CompositeDisposable } from 'atom';

function log() {
	//if(!atom.inDevMode()) return;
	//var args = Array.prototype.slice.call(arguments);
	//args.unshift(pkgTitle + ':');
	//console.log.apply(console, args);
}

export default {
	subscriptions: null,

	config: {
		stripEndings: {
			title: "Strip Endings",
			description: "Remove these strings from the end of file paths.",
			type: 'array',
			default: [
				'index.htm',
				'index.html',
				'index.js',
				'index.php',
				'init.lua',
				'__init__.py',
			],
			items: {
				type: 'string',
			},
		},
	},

	activate(state) {
		/* Package activated.
		 */
		if(atom.inDevMode()) {
			log("activating...");
			try {
				this.realActivate(state);
				log("activated OK");
			}
			catch(e) {
				log(e);
			}
		}
		else this.realActivate(state);
	},

	realActivate(state) {
		// Events subscribed to in atom's system can be easily cleaned up
		//with a CompositeDisposable
		this.subscriptions = new CompositeDisposable();

		//connect to some events to refresh titles.
		var butt = this;
		var refresh = function() {
			log("refresh");
			setTimeout(function() { butt.processAllTabs() }, 10);
		};

		this.subscriptions.add(atom.workspace.onDidAddTextEditor(refresh));
		this.subscriptions.add(atom.workspace.onDidDestroyPaneItem(refresh));
		this.subscriptions.add(atom.config.onDidChange(pkgName, refresh));

		this.subscriptions.add(atom.workspace.onDidAddPane(function(event) {
			butt.subscriptions.add(event.pane.onDidMoveItem(refresh));
		}));

		var panes = atom.workspace.getPanes();
		for(i in panes) {
			this.subscriptions.add(panes[i].onDidAddItem(refresh));
			this.subscriptions.add(panes[i].onDidRemoveItem(refresh));
			this.subscriptions.add(panes[i].onDidMoveItem(refresh));
		}

		setTimeout(function() { butt.processAllTabs() }, 10);
	},

	deactivate() {
		/* Package deactivated.
		 */
		if(atom.inDevMode()) {
			log("deactivating...");
			try {
				this.realDeactivate();
				log("deactivated OK");
			}
			catch(e) {
				log(e);
			}
		}
		else this.realDeactivate();
	},

	realDeactivate() {
		this.revertAllTabs(); //restore original titles
		this.subscriptions.dispose(); //disconnect callbacks
	},

	consumeAutoreload(reloader) {
		/* https://github.com/paulpflug/autoreload-package-service
		 * Auto-reload the package when it's modified.
		 */
		//log("reloading!");
		return reloader({
			pkg:    pkgName,
			files:  ["package.json"],
			folders:["lib/"]
		});
	},

	processAllTabs() {
		/* Improve the titles of all tabs.
		 */
		var toProcess = [];

		//get all the tabs that have paths.
		var tabs = atom.workspace.getPaneItems();
		for(i in tabs) {
			if(tabs[i].getPath) {
				toProcess.push(tabs[i]);
			}
		}
		//log("tabs to process:", toProcess);

		//process each tab.
		for(i in toProcess) {
			var tab = toProcess[i];
			this.processTab(tab);
		}

		log("done processing tabs");
	},

	processTab(tab) {
		/* Improve the title of specified tab.
		 */
		var path = tab.getPath();
		if(!path) return; //there's no path to build a title from.

		var oldPath = path;
		//log("path", i, path)

		//strip specified suffixes
		var stripEndings = atom.config.get(pkgName+'.stripEndings');
		for(j in stripEndings) {
			ending = stripEndings[j];
			if(path.endsWith(ending)) {
				path = path.slice(0, -ending.length);
				break;
			}
		}

		//strip directory name
		path = path.split(pathsep);
		var last = path.pop();

		//if the result is blank (because we stripped the name), use the
		//previous directory, and append a slash.
		if(last == '') last = path.pop() + pathsep;

		path = last;
		if(path != '' && path != oldPath) {
			//if the new path is different, change the title.
			log("rename", oldPath, "->", path);
			this.setTabName(tab, path);
		}
		else log("keep", oldPath);
	},

	setTabName(tab, name) {
		/* Change the title of specified tab.
		 */

		//find the tab title element for this editor tab. (XXX ew)
		var data_path = tab.getPath().replace(/\\/g,"\\\\");
		var elems = atom.views.getView(atom.workspace).querySelectorAll(
			"ul.tab-bar > " +
			"li.tab[data-type='TextEditor'] > " +
			"div.title[data-path='" + data_path + "']");
		//if(!elems[0]) return;
		//log("tab:", tab, "elem:", elem);

		for(var i=0; i<elems.length; i++) {
			//get the container for our replacement text
			var elem = elems[i];
			var container = elem.querySelector("div."+pkgName);
			if(!container) {
				//create it and replace the original text
				container = document.createElement("div");
	        	container.classList.add(pkgName);
				elem.innerHTML = '';
				elem.appendChild(container);
			}

			//set the container's text
			container.innerText = name;
		}
	},

	revertAllTabs() {
		/* Return all tabs to their original names.
		*/
		var tabs = atom.workspace.getPaneItems();
		for(i in tabs) {
			if(tabs[i].getPath) {
				this.revertTabName(tabs[i]);
			}
		}
	},

	revertTabName(tab) {
		/* Return specified tab to its original name.
		 */
		var elem = tab.getElement();
		var container = elem.querySelector("div."+pkgName);
		if(container) {
			elem.removeChild(container);
			elem.innerText = tab.getPath().split(pathsep).pop();
			//XXX save the original elements and restore them.
		}
	},

};
