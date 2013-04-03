/*
 ****************************************
 *** twinklebatchundelete.js: Batch undelete module
 ****************************************
 * Mode of invocation:     Tab ("Und-batch")
 * Active on:              Existing user pages and project pages
 * Config directives in:   TwinkleConfig
 */


Twinkle.batchundelete = function twinklebatchundelete() {
	if( !mw.config.get("wgArticleId") ) {
		return;
	}
	if( Morebits.userIsInGroup( 'sysop' ) && (mw.config.get("wgNamespaceNumber") === 2 ||
		mw.config.get("wgNamespaceNumber") === 4) ) {
		twAddPortletLink( Twinkle.batchundelete.callback, "Und-batch", "tw-batch-undel", "Undelete 'em all" );
	}
};

Twinkle.batchundelete.callback = function twinklebatchundeleteCallback() {
	var Window = new Morebits.simpleWindow( 800, 400 );
	Window.setTitle("Batch undelete");
	Window.setScriptName("Twinkle");
	Window.addFooterLink("Twinkle help", "WP:TW/DOC#batchundelete");

	var form = new Morebits.quickForm( Twinkle.batchundelete.callback.evaluate );
	form.append( {
			type: 'textarea',
			name: 'reason',
			label: 'Reason: '
		} );

	var statusdiv = document.createElement( 'div' );
	statusdiv.style.padding = '15px';  // just so it doesn't look broken
	Window.setContent(statusdiv);
	Morebits.status.init(statusdiv);
	Window.display();

	var query = {
		'action': 'query',
		'generator': 'links',
		'titles': mw.config.get("wgPageName"),
		'gpllimit' : Twinkle.getPref('batchMax') // the max for sysops
	};
	var statelem = new Morebits.status("Grabbing list of pages");
	var wikipedia_api = new Morebits.wiki.api( 'loading...', query, function( apiobj ) {
			var xml = apiobj.responseXML;
			var $pages = $(xml).find('page');
			var list = [];
			$pages.each(function(index, page) {
				var $page = $(page);
				if ($page.attr('missing') !== "") {
					return true; // skip it
				}
				var title = $page.attr('title');
				list.push( { label: title, value: title, checked: true });
			});
			form.append({ type: 'header', label: 'Pages to protect' });
			form.append( {
					type: 'checkbox',
					name: 'pages',
					list: list
				} );
			form.append( { type:'submit' } );

			var result = form.render();
			Window.setContent( result );

		}, statelem );

	wikipedia_api.post();
};

Twinkle.batchundelete.callback.evaluate = function( event ) {
	Morebits.wiki.actionCompleted.notice = 'Status';
	Morebits.wiki.actionCompleted.postfix = 'batch undeletion is now completed';

	var pages = event.target.getChecked( 'pages' );
	var reason = event.target.reason.value;
	if( ! reason ) {
		alert("You need to give a reason, you cabal crony!");
		return;
	}
	Morebits.simpleWindow.setButtonsEnabled(false);
	Morebits.status.init( event.target );
	Morebits.status.warn("Notice", "Batch undeletion can be extremely slow, especially for files. Please be patient. You may need to run this tool for a second or third time if errors occur.");

	if( !pages ) {
		Morebits.status.error( 'Error', 'Nothing to undelete, aborting' );
		return;
	}

	var batchOperation = new Morebits.batchOperation("Undeleting pages");
	batchOperation.setOption("chunkSize", 10);  // API undeletion is very slow
	batchOperation.setOption("preserveIndividualStatusLines", true);  // user might want to check each page
	batchOperation.setPageList(pages);
	batchOperation.run(function(pageName) {
		var query = { 
			'token': mw.user.tokens.get().editToken,
			'title': pageName,
			'action': 'undelete',
			'reason': reason + Twinkle.getPref('deletionSummaryAd')
		};
		var wikipedia_api = new Morebits.wiki.api( "Undeleting page " + pageName, query, 
			batchOperation.workerSuccess, null, batchOperation.workerFailure );
		wikipedia_api.statelem.status("undeleting...");
		wikipedia_api.pageName = pageName;
		wikipedia_api.post();
	});
};
