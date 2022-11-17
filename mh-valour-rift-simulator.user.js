// ==UserScript==
// @name         🐭️ MouseHunt - Valour Rift Simulator
// @version      0.0.1
// @description
// @license      MIT
// @author       bradp
// @namespace    bradp
// @match        https://www.mousehuntgame.com/*
// @icon         https://brrad.com/mouse.png
// @grant        none
// @run-at       document-end
// ==/UserScript==

((function () {
	'use strict';

	/**
	 * Add styles to the page.
	 *
	 * @param {string} styles The styles to add.
	 */
	const addStyles = (styles) => {
		// Check to see if the existing element exists.
		const existingStyles = document.getElementById('mh-mouseplace-custom-styles');

		// If so, append our new styles to the existing element.
		if (existingStyles) {
			existingStyles.innerHTML += styles;
			return;
		}

		// Otherwise, create a new element and append it to the head.
		const style = document.createElement('style');
		style.id = 'mh-mouseplace-custom-styles';
		style.innerHTML = styles;
		document.head.appendChild(style);
	};

	/**
	 * Do something when ajax requests are completed.
	 *
	 * @param {Function} callback    The callback to call when an ajax request is completed.
	 * @param {string}   url         The url to match. If not provided, all ajax requests will be matched.
	 * @param {boolean}  skipSuccess Skip the success check.
	 */
	const onAjaxRequest = (callback, url = null, skipSuccess = false) => {
		const req = XMLHttpRequest.prototype.open;
		XMLHttpRequest.prototype.open = function () {
			this.addEventListener('load', function () {
				if (this.responseText) {
					let response = {};
					try {
						response = JSON.parse(this.responseText);
					} catch (e) {
						return;
					}

					if (response.success || skipSuccess) {
						if (! url) {
							callback(response);
							return;
						}

						if (this.responseURL.indexOf(url) !== -1) {
							callback(response);
						}
					}
				}
			});
			req.apply(this, arguments);
		};
	};

	/**
	 * Run the callbacks depending on visibility.
	 *
	 * @param {Object} settings   Settings object.
	 * @param {Node}   parentNode The parent node.
	 * @param {Object} callbacks  The callbacks to run.
	 *
	 * @return {Object} The settings.
	 */
	const runCallbacks = (settings, parentNode, callbacks) => {
		// Loop through the keys on our settings object.
		Object.keys(settings).forEach((key) => {
			// If the parentNode that's passed in contains the selector for the key.
			if (parentNode.classList.contains(settings[ key ].selector)) {
				// Set as visible.
				settings[ key ].isVisible = true;

				// If there is a show callback, run it.
				if (callbacks[ key ] && callbacks[ key ].show) {
					callbacks[ key ].show();
				}
			} else if (settings[ key ].isVisible) {
				// Mark as not visible.
				settings[ key ].isVisible = false;

				// If there is a hide callback, run it.
				if (callbacks[ key ] && callbacks[ key ].hide) {
					callbacks[ key ].hide();
				}
			}
		});

		return settings;
	};

	/**
	 * Get the current page slug.
	 *
	 * @return {string} The page slug.
	 */
	const getCurrentPage = () => {
		// Grab the container element and make sure it has classes on it.
		const container = document.getElementById('mousehuntContainer');
		if (! container || container.classList.length <= 0) {
			return null;
		}

		// Use the page class as a slug.
		return container.classList[ 0 ].replace('Page', '').toLowerCase();
	};

	/**
	 * Get the saved settings.
	 *
	 * @param {string}  key          The key to get.
	 * @param {boolean} defaultValue The default value.
	 *
	 * @return {Object} The saved settings.
	 */
	const getSetting = (key = null, defaultValue = null) => {
		// Grab the local storage data.
		const settings = JSON.parse(localStorage.getItem('mh-mouseplace-settings')) || {};

		// If we didn't get a key passed in, we want all the settings.
		if (! key) {
			return settings;
		}

		// If the setting doesn't exist, return the default value.
		if (Object.prototype.hasOwnProperty.call(settings, key)) {
			return settings[ key ];
		}

		return defaultValue;
	};

	/**
	 * POST a request to the server and return the response.
	 *
	 * @param {string} url      The url to post to, not including the base url.
	 * @param {Object} formData The form data to post.
	 *
	 * @return {Promise} The response.
	 */
	const doRequest = async (url, formData) => {
		// If we don't have the needed params, bail.
		if ('undefined' === typeof lastReadJournalEntryId || 'undefined' === typeof user) {
			return;
		}

		// If our needed params are empty, bail.
		if (! lastReadJournalEntryId || ! user || ! user.unique_hash) { // eslint-disable-line no-undef
			return;
		}

		// Build the form for the request.
		const form = new FormData();
		form.append('sn', 'Hitgrab');
		form.append('hg_is_ajax', 1);
		form.append('last_read_journal_entry_id', lastReadJournalEntryId ? lastReadJournalEntryId : 0); // eslint-disable-line no-undef
		form.append('uh', user.unique_hash ? user.unique_hash : ''); // eslint-disable-line no-undef

		// Add in the passed in form data.
		for (const key in formData) {
			form.append(key, formData[ key ]);
		}

		// Convert the form to a URL encoded string for the body.
		const requestBody = new URLSearchParams(form).toString();

		// Send the request.
		const response = await fetch(
			callbackurl ? callbackurl + url : 'https://www.mousehuntgame.com/' + url, // eslint-disable-line no-undef
			{
				method: 'POST',
				body: requestBody,
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			}
		);

		// Wait for the response and return it.
		const data = await response.json();
		return data;
	};

	/**
	 *  Add a submenu item to a menu.
	 *
	 * @param {Object} options The options for the submenu item.
	 */
	const addSubmenuItem = (options) => {
		// Default to sensible values.
		const settings = Object.assign({}, {
			menu: 'kingdom',
			label: '',
			icon: 'https://www.mousehuntgame.com/images/ui/hud/menu/prize_shoppe.png',
			href: '',
			callback: null,
			external: false,
		}, options);

		// Grab the menu item we want to add the submenu to.
		const menuTarget = document.querySelector(`.mousehuntHud-menu .${ settings.menu }`);
		if (! menuTarget) {
			return;
		}

		// If the menu already has a submenu, just add the item to it.
		if (! menuTarget.classList.contains('hasChildren')) {
			menuTarget.classList.add('hasChildren');
		}

		let submenu = menuTarget.querySelector('ul');
		if (! submenu) {
			submenu = document.createElement('ul');
			menuTarget.appendChild(submenu);
		}

		// Create the item.
		const item = document.createElement('li');

		// Create the link.
		const link = document.createElement('a');
		link.href = settings.href || '#';

		if (settings.callback) {
			link.addEventListener('click', (e) => {
				e.preventDefault();
				settings.callback();
			});
		}

		// Create the icon.
		const icon = document.createElement('div');
		icon.classList.add('icon');
		icon.styles = `background-image: url(${ settings.icon });`;

		// Create the label.
		const name = document.createElement('div');
		name.classList.add('name');
		name.innerText = settings.label;

		// Add the icon and label to the link.
		link.appendChild(icon);
		link.appendChild(name);

		// If it's an external link, also add the icon for it.
		if (settings.external) {
			const externalLinkIcon = document.createElement('div');
			externalLinkIcon.classList.add('external_icon');
			link.appendChild(externalLinkIcon);

			// Set the target to _blank so it opens in a new tab.
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
		}

		// Add the link to the item.
		item.appendChild(link);

		// Add the item to the submenu.
		submenu.appendChild(item);
	};

	/**
	 * Build a popup.
	 *
	 * Templates:
	 *   ajax: no close button in lower right, 'prefix' instead of title. 'suffix' for close button area.
	 *   default: {*title*} {*content*}
	 *   error: in red, with error icon{*title*} {*content*}
	 *   largerImage: full width image {*title*} {*image*}
	 *   largerImageWithClass: smaller than larger image, with caption {*title*} {*image*} {*imageCaption*} {*imageClass*} (goes on the img tag)
	 *   loading: Just says loading
	 *   multipleItems: {*title*} {*content*} {*items*}
	 *   singleItemLeft: {*title*} {*content*} {*items*}
	 *   singleItemRight: {*title*} {*content*} {*items*}
	 *
	 * @param {Object} options The popup options.
	 */
	const createPopup = (options) => {
		// If we don't have jsDialog, bail.
		if ('undefined' === typeof jsDialog || ! jsDialog) { // eslint-disable-line no-undef
			return;
		}

		// Default to sensible values.
		const settings = Object.assign({}, {
			title: '',
			content: '',
			hasCloseButton: true,
			template: 'default',
			show: true,
		}, options);

		// Initiate the popup.
		const popup = new jsDialog(); // eslint-disable-line no-undef
		popup.setIsModal(! settings.hasCloseButton);

		// Set the template & add in the content.
		popup.setTemplate(settings.template);
		popup.addToken('{*title*}', settings.title);
		popup.addToken('{*content*}', settings.content);

		// If we want to show the popup, show it.
		if (settings.show) {
			popup.show();
		}

		return popup;
	};

	/**
	 * Make an element draggable. Saves the position to local storage.
	 *
	 * @param {string} dragTarget The selector for the element that should be dragged.
	 * @param {string} dragHandle The selector for the element that should be used to drag the element.
	 * @param {number} defaultX   The default X position.
	 * @param {number} defaultY   The default Y position.
	 * @param {string} storageKey The key to use for local storage.
	 */
	const makeElementDraggable = (dragTarget, dragHandle, defaultX = null, defaultY = null, storageKey = null) => {
		const modal = document.querySelector(dragTarget);
		if (! modal) {
			return;
		}

		const handle = document.querySelector(dragHandle);
		if (! handle) {
			return;
		}

		/**
		 * Make sure the coordinates are within the bounds of the window.
		 *
		 * @param {string} type  The type of coordinate to check.
		 * @param {number} value The value of the coordinate.
		 *
		 * @return {number} The value of the coordinate, or the max/min value if it's out of bounds.
		 */
		const keepWithinLimits = (type, value) => {
			if ('top' === type) {
				return value < -20 ? -20 : value;
			}

			if (value < (handle.offsetWidth * -1) + 20) {
				return (handle.offsetWidth * -1) + 20;
			}

			if (value > document.body.clientWidth - 20) {
				return document.body.clientWidth - 20;
			}

			return value;
		};

		/**
		 * When the mouse is clicked, add the class and event listeners.
		 *
		 * @param {Object} e The event object.
		 */
		const onMouseDown = (e) => {
			e.preventDefault();

			// Get the current mouse position.
			x1 = e.clientX;
			y1 = e.clientY;

			// Add the class to the element.
			modal.classList.add('mh-is-dragging');

			// Add the onDrag and finishDrag events.
			document.onmousemove = onDrag;
			document.onmouseup = finishDrag;
		};

		/**
		 * When the drag is finished, remove the dragging class and event listeners, and save the position.
		 */
		const finishDrag = () => {
			document.onmouseup = null;
			document.onmousemove = null;

			// Remove the class from the element.
			modal.classList.remove('mh-is-dragging');

			if (storageKey) {
				localStorage.setItem(storageKey, JSON.stringify({ x: modal.offsetLeft, y: modal.offsetTop }));
			}
		};

		/**
		 * When the mouse is moved, update the element's position.
		 *
		 * @param {Object} e The event object.
		 */
		const onDrag = (e) => {
			e.preventDefault();

			// Calculate the new cursor position.
			x2 = x1 - e.clientX;
			y2 = y1 - e.clientY;

			x1 = e.clientX;
			y1 = e.clientY;

			const newLeft = keepWithinLimits('left', modal.offsetLeft - x2);
			const newTop = keepWithinLimits('top', modal.offsetTop - y2);

			// Set the element's new position.
			modal.style.left = `${ newLeft }px`;
			modal.style.top = `${ newTop }px`;
		};

		// Set the default position.
		let startX = defaultX || 0;
		let startY = defaultY || 0;

		// If the storageKey was passed in, get the position from local storage.
		if (storageKey) {
			const storedPosition = localStorage.getItem(storageKey);
			if (storedPosition) {
				const position = JSON.parse(storedPosition);

				// Make sure the position is within the bounds of the window.
				startX = keepWithinLimits('left', position.x);
				startY = keepWithinLimits('top', position.y);
			}
		}

		// Set the element's position.
		modal.style.left = `${ startX }px`;
		modal.style.top = `${ startY }px`;

		// Set up our variables to track the mouse position.
		let x1 = 0,
			y1 = 0,
			x2 = 0,
			y2 = 0;

		// Add the event listener to the handle.
		handle.onmousedown = onMouseDown;
	};

	/**
	 * Log to the console.
	 *
	 * @param {string|Object} message The message to log.
	 */
	const clog = (message) => {
		// If a string is passed in, log it in line with our prefix.
		if ('string' === typeof message) {
			console.log(`%c[MousePlace] %c${ message }`, 'color: #ff0000; font-weight: bold;', 'color: #000000;'); // eslint-disable-line no-console
		} else {
			// Otherwise, log it separately.
			console.log('%c[MousePlace]', 'color: #ff0000; font-weight: bold;', 'color: #000000;'); // eslint-disable-line no-console
			console.log(message); // eslint-disable-line no-console
		}
	};

	const displayResults = (results) => {
		console.log(results);

		let eclipseText = '';
		results.eclipses.forEach((eclipse) => {
			eclipseText += `<li>
			<span class="number">Eclipse ${ eclipse.number }</span>
			<span class="percent ${ eclipse.percent === '100.0' ? 'guarenteed' : '' }">${ eclipse.percent }%</span>
			<span class="cumulative ${ eclipse.cumulative === '100.0' ? 'guarenteed' : '' }">${ eclipse.cumulative }%</span>
			</li>`;
		});

		return `<div class="mh-vrift-sim-results">
			<div class="stats">
				<div class="result">
					<div class="label">Speed</div>
					<div class="value">${ results.speed }</div>
				</div>
				<div class="result">
					<div class="label">Sync</div>
					<div class="value">${ results.sync }</div>
				</div>
				<div class="result">
					<div class="label">Avg. Highest Floor</div>
					<div class="value">${ results.avgFloor }</div>
				</div>
				<div class="result">
					<div class="label">Avg. Hunts</div>
					<div class="value">${ results.avgHunts }</div>
				</div>
				<div class="result">
					<div class="label">Sigils (Loot)</div>
					<div class="value">${ results.lootSigils }</div>
				</div>
				<div class="result">
					<div class="label">Secrets (Loot)</div>
					<div class="value">${ results.lootSecrets }</div>
				</div>
				<div class="result">
					<div class="label">Sigils (Cache)</div>
					<div class="value">${ results.cacheSigils }</div>
				</div>
				<div class="result">
					<div class="label">Secrets (Cache)</div>
					<div class="value">${ results.cacheSecrets }</div>
				</div>
			</div>

			<div class="eclipses">
				<ol>
					<li class="header">
						<span>#</span>
						<span>Chance</span>
						<span>Total</span>
					</li>
					${ eclipseText }
				</ol>
			</div>
		</div>`;
	};

	/* eslint-disable brace-style */

	/**
	 * Adding styles.
	 */
	addStyles(`
	#overlayPopup.mh-vrift-popup .jsDialogContainer {
		background: linear-gradient(#20216f, #703271, #20216f);
		outline: 1px solid #20216f;
	}

	#overlayPopup.mh-vrift-popup .title {
		padding: 10px;
		font-size: 18px;
		color: #ffffff;
	}

	.mh-vrift-sim-results {
		display: grid;
		grid-template-columns: 2fr repeat(1, 1fr);
		margin: 0 1em;
		color: #ffffff;
	}

	.mh-vrift-sim-results .stats {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		grid-row-gap: 1rem;
		margin-bottom: 2em;
	}

	.mh-vrift-sim-results .result {
		display: flex;
		justify-content: space-between;
		align-content: center;
	}

	.mh-vrift-sim-results .label {
		color: #eaeaea;
		vertical-align: middle;
		line-height: 30px;
		background-color: rgb(195 195 195 / 10%);
		width: 100%;
		padding-left: 10px;
		border-radius: 5px;
		font-size: 13px;
	}

	.mh-vrift-sim-results .value {
		background: linear-gradient(#07041d, #4d3bac);
		border: 1px solid #6d86de;
		text-align: center;
		width: 25px;
		line-height: 30px;
		color: #eaeaea;
		font-weight: 700;
		border-radius: 5px;
		position: relative;
		left: -25px;
	}

	.mh-vrift-sim-results .eclipses {
		background-color: rgb(195 195 195 / 10%);
		padding: 10px;
		border-radius: 5px;
		margin-bottom: 2em;
		font-size: 13px;
	}

	.mh-vrift-sim-results .eclipses .header {
		color: rgb(175 175 175 / 85%);
		font-size: 10px;
		margin-bottom: 10px;
		border-bottom: 1px solid rgb(175 175 175 / 85%);
		padding-bottom: 3px;
	}

	.mh-vrift-sim-results .eclipses li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		align-content: center;
	}

	.mh-vrift-sim-results .eclipses .guarenteed {
		color: #80e472;
	}
	`);

	/**
	 * Adding a submenu item to the navigation.
	 */
	addSubmenuItem({
		menu: 'kingdom',
		label: 'mouse.rip',
		icon: 'https://www.mousehuntgame.com/images/ui/hud/menu/prize_shoppe.png',
		href: 'https://mouse.rip',
		external: true,
	});

	/**
	 * Creating a popup.
	 */
	const simPopup = document.querySelector('.valourRiftHUD-floorProgress-boss');
	if (simPopup) {
		simPopup.addEventListener('click', () => {
			const data = simulate(false);
			console.log(data);
			const popup = createPopup({
				title: 'VRift Run Simulation',
				content: displayResults(data),
				show: false,
			});

			popup.setAttributes({ className: 'mh-vrift-popup' });
			popup.show();
		});
	}

	// Sets the display for the percentages
	// Set to true or false depending on which display you want
	const cumulativeDisplay = true;
	const exactDisplay = false;
	const useUConEclipse = false;

	const cacheLoot =
		[[0, 0],
			[7, 0],
			[16, 0],
			[24, 0],
			[32, 0],
			[40, 0],
			[48, 0],
			[50, 0],
			[59, 8],
			[69, 10],
			[80, 11],
			[88, 13],
			[98, 14],
			[107, 16],
			[118, 17],
			[120, 17],
			[135, 20],
			[150, 22],
			[165, 24],
			[182, 26],
			[199, 28],
			[217, 31],
			[235, 33],
			[254, 33],
			[272, 37],
			[290, 40],
			[308, 43],
			[325, 45],
			[342, 48],
			[357, 51],
			[372, 54],
			[386, 54],
			[399, 60],
			[410, 63],
			[421, 66],
			[430, 70],
			[439, 73],
			[446, 77],
			[453, 80],
			[459, 80],
			[464, 88],
			[469, 92],
			[473, 96],
			[477, 101],
			[480, 105],
			[482, 109],
			[485, 113],
			[487, 113],
			[489, 123],
			[490, 128],
			[492, 133],
			[493, 138],
			[494, 143],
			[495, 148],
			[495, 153],
			[496, 153],
			[497, 161],
			[497, 167],
			[497, 173],
			[498, 178],
			[498, 184],
			[498, 190],
			[499, 196],
			[500, 196],
			[500, 205],
			[500, 212],
			[500, 218],
			[500, 224],
			[500, 231],
			[500, 237],
			[500, 244],
			[500, 244],
			[500, 253],
			[500, 260],
			[500, 267],
			[500, 274],
			[500, 282],
			[500, 289],
			[500, 296],
			[500, 300]];

	const normalAR = [[0.00000, 0.00000, 0.00000, 0.00000],
		[0.00000, 0.00000, 0.00000, 0.00000],
		[0.08246, 0.05616, 0.04866, 0.04231],
		[0.08246, 0.05616, 0.04866, 0.04231],
		[0.08246, 0.05616, 0.04866, 0.04231],
		[0.08246, 0.05616, 0.04866, 0.04231],
		[0.08246, 0.05616, 0.04866, 0.04231],
		[0.08246, 0.05616, 0.04866, 0.04231],
		[0.08246, 0.05616, 0.04866, 0.04231],
		[0.00000, 0.00000, 0.00000, 0.00000],
		[0.00000, 0.01658, 0.02836, 0.04121],
		[0.00000, 0.01658, 0.02836, 0.04121],
		[0.00000, 0.01658, 0.02836, 0.04121],
		[0.00000, 0.01658, 0.02836, 0.04121],
		[0.00000, 0.01658, 0.02836, 0.04121],
		[0.00000, 0.01658, 0.02836, 0.04121],
		[0.00000, 0.01658, 0.02836, 0.04121],
		[0.00000, 0.00000, 0.00000, 0.00000],
		[0.17073, 0.06332, 0.06193, 0.08571],
		[0.04065, 0.01583, 0.02368, 0.01978],
		[0.03252, 0.01583, 0.02732, 0.01209],
		[0.00000, 0.29288, 0.11840, 0.03626],
		[0.00000, 0.00000, 0.12750, 0.07473],
		[0.00000, 0.00000, 0.00000, 0.09725],
		[0.17886, 0.10290, 0.10200, 0.08956],
		[0.00000, 0.00000, 0.00000, 0.00000],
		[0.00000, 0.00000, 0.00000, 0.00000]];

	const umbraAR = [[0.00000, 0.00000, 0.00000, 0.00000],
		[0.00000, 0.00000, 0.00000, 0.00000],
		[0.06600, 0.04129, 0.03857, 0.03100],
		[0.06600, 0.04129, 0.03857, 0.03100],
		[0.06600, 0.04129, 0.03857, 0.03100],
		[0.06600, 0.04129, 0.03857, 0.03100],
		[0.06600, 0.04129, 0.03857, 0.03100],
		[0.06600, 0.04129, 0.03857, 0.03100],
		[0.06600, 0.04129, 0.03857, 0.03100],
		[0.00000, 0.00000, 0.00000, 0.00000],
		[0.00000, 0.01043, 0.01886, 0.03600],
		[0.00000, 0.01043, 0.01886, 0.03600],
		[0.00000, 0.01043, 0.01886, 0.03600],
		[0.00000, 0.01043, 0.01886, 0.03600],
		[0.00000, 0.01043, 0.01886, 0.03600],
		[0.00000, 0.01043, 0.01886, 0.03600],
		[0.00000, 0.01043, 0.01886, 0.03600],
		[0.00000, 0.00000, 0.00000, 0.00000],
		[0.11500, 0.07200, 0.06500, 0.05600],
		[0.03800, 0.02300, 0.02000, 0.01700],
		[0.02300, 0.01400, 0.01300, 0.00900],
		[0.00000, 0.23110, 0.10806, 0.03300],
		[0.00000, 0.00000, 0.09800, 0.05500],
		[0.00000, 0.00000, 0.00000, 0.08100],
		[0.18300, 0.11200, 0.10200, 0.08000],
		[0.17900, 0.18600, 0.19200, 0.20000],
		[0.00000, 0.00000, 0.00000, 0.00000]];

	const mouseDrops = [[0.00000, 0.00000, 0.00000, 0.00000, 1982],
		[0.00000, 0.00000, 0.00000, 0.00000, 4250],
		[0.60515, 0.60515, 0.00000, 0.00000, 1000],
		[0.63774, 0.63774, 0.00000, 0.00000, 1250],
		[0.56444, 0.56444, 0.00000, 0.00000, 1500],
		[0.57674, 0.57674, 0.00000, 0.00000, 2000],
		[0.63102, 0.63102, 0.00000, 0.00000, 2500],
		[0.57209, 0.57209, 0.00000, 0.00000, 3000],
		[0.59000, 0.59000, 0.00000, 0.00000, 4000],
		[2.40541, 0.98649, 0.00000, 0.00000, 25000],
		[0.01000, 0.01000, 1.10000, 1.00000, 6000],
		[0.00000, 0.00000, 1.10000, 1.00000, 6000],
		[0.00909, 0.00909, 1.10000, 1.00000, 6000],
		[0.00000, 0.00000, 1.10000, 1.00000, 6000],
		[0.00800, 0.00800, 1.10000, 1.00000, 6000],
		[0.00826, 0.00826, 1.10000, 1.00000, 6000],
		[0.03150, 0.03150, 1.10000, 1.00000, 6000],
		[3.82927, 1.00000, 0.00000, 0.00000, 100000],
		[0.01770, 0.01770, 0.00000, 0.00000, 2000],
		[0.00000, 0.00000, 0.00000, 0.00000, 1500],
		[0.01429, 0.01429, 0.00000, 0.00000, 1000],
		[0.00643, 0.00643, 1.10000, 1.00000, 5000],
		[0.00000, 0.00000, 1.15000, 1.00000, 5000],
		[0.02475, 0.02475, 1.75000, 1.00000, 8000],
		[0.99597, 0.99396, 0.00000, 0.00000, 4795],
		[0.00000, 0.00000, 0.00000, 0.00000, 12000],
		[0.00000, 0.00000, 0.00000, 0.00000, 0]];

	const mouseStats = [[3300, 1],
		[5050, 1],
		[2900, 1],
		[6650, 2],
		[8800, 3],
		[11750, 4],
		[16000, 5],
		[21500, 6],
		[29000, 7],
		[7000000, 1000],
		[72000, 9],
		[72000, 9],
		[72000, 9],
		[72000, 9],
		[72000, 9],
		[72000, 9],
		[72000, 9],
		[13500000, 1000],
		[4800, 1.75],
		[8250, 1.75],
		[23000, 1.75],
		[38000, 10],
		[150000, 25],
		[350000, 50],
		[100, 2],
		[818250, 75],
		[1e30, 1]];

	function getCacheLoot(floor) {
		let idx = floor > 1 ? (floor - 1) : 0;
		if (idx >= cacheLoot.length) { idx = cacheLoot.length - 1; }
		const loot = cacheLoot[ idx ];
		return loot;
	}

	function convertToCR(power, luck, stats) {
		const mPower = stats[ 0 ];
		const mEff = stats[ 1 ];
		return Math.min(1, (power * mEff + 2 * Math.pow(luck * Math.min(mEff, 1.4), 2)) / (mPower + power * mEff));
	}

	function simulate(shouldDisplay = true) {
		const time = (new Date()).getTime() / 1000;

		const lvSpeed = window.user.enviroment_atts.power_up_data.long_stride.current_value;
		const lvSync = window.user.enviroment_atts.power_up_data.hunt_limit.current_level + 1;
		const lvSiphon = window.user.enviroment_atts.power_up_data.boss_extension.current_level + 1;
		let siphon = window.user.enviroment_atts.power_up_data.boss_extension.current_value;
		const sync = window.user.enviroment_atts.hunts_remaining;
		const steps = window.user.enviroment_atts.current_step;
		const torchState = window.user.enviroment_atts.is_fuel_enabled;
		const torchEclipse = true;
		const umbra = window.user.enviroment_atts.active_augmentations.tu;
		const superSiphon = window.user.enviroment_atts.active_augmentations.ss;
		const strStep = window.user.enviroment_atts.active_augmentations.sste;
		const curFloor = window.user.enviroment_atts.floor;
		const sh = window.user.enviroment_atts.active_augmentations.hr;
		const sr = window.user.enviroment_atts.active_augmentations.sr;
		const bail = 999; // this is only here so I don't have to maintain two versions of this code :^)

		let power = window.user.trap_power;
		let luck = (window.user.trinket_name == 'Ultimate Charm') ? 100000 : window.user.trap_luck;

		try {
			const altpower = Number(document.getElementsByClassName('campPage-trap-trapStat power')[ 0 ].children[ 1 ].innerText.match(/[0-9]/g).join(''));
			const altluck = Number(document.getElementsByClassName('campPage-trap-trapStat luck')[ 0 ].children[ 1 ].innerText);
			power = Number.isNaN(altpower) ? power : Math.max(power, altpower);
			luck = Number.isNaN(altluck) ? luck : Math.max(luck, altluck);
		}
		catch (err) { console.log(err); }

		const mouseCR = mouseStats.map(function (stats) { return convertToCR(power, luck, stats); });
		if (useUConEclipse) {
			mouseCR[ 9 ] = 1;
			mouseCR[ 17 ] = 1;
		}

		const mouseAR = umbra ? umbraAR : normalAR;
		const eclipseCR = umbra ? mouseCR[ 17 ] : mouseCR[ 9 ];
		const eclipseSG = umbra ? mouseDrops[ 17 ][ 0 ] : mouseDrops[ 9 ][ 0 ];
		const eclipseSC = umbra ? mouseDrops[ 17 ][ 2 ] : mouseDrops[ 9 ][ 2 ];
		const eclipseGold = umbra ? mouseDrops[ 17 ][ 4 ] : mouseDrops[ 9 ][ 4 ];
		const catchProfile = {
			push: [eclipseCR],
			ta: [0],
			kb: [1 - eclipseCR],
			bkb: [0],
			fta: [0],
			sg: [eclipseSG * eclipseCR],
			sgi: [0],
			sc: [eclipseSC * eclipseCR],
			sci: [0],
			gold: [eclipseGold * eclipseCR],
			cf: [0]
		};

		for (var j = 1; j <= 4; j++) {
			catchProfile.ta[ j ] = mouseCR[ 24 ] * mouseAR[ 24 ][ j - 1 ];
			catchProfile.bkb[ j ] = (1 - mouseCR[ 25 ]) * mouseAR[ 25 ][ j - 1 ];
			catchProfile.fta[ j ] = 0;
			catchProfile.sg[ j ] = 0;
			catchProfile.sgi[ j ] = 0;
			catchProfile.sc[ j ] = 0;
			catchProfile.sci[ j ] = 0;
			catchProfile.gold[ j ] = 0;
			catchProfile.cf[ j ] = 0;
			catchProfile.push[ j ] = -catchProfile.ta[ j ];
			mouseCR.map(function (cr, index) {
				catchProfile.push[ j ] += cr * mouseAR[ index ][ j - 1 ];
				catchProfile.sg[ j ] += cr * mouseAR[ index ][ j - 1 ] * mouseDrops[ index ][ 0 ];
				catchProfile.sgi[ j ] += cr * mouseAR[ index ][ j - 1 ] * mouseDrops[ index ][ 1 ];
				catchProfile.sc[ j ] += cr * mouseAR[ index ][ j - 1 ] * mouseDrops[ index ][ 2 ];
				catchProfile.sci[ j ] += cr * mouseAR[ index ][ j - 1 ] * mouseDrops[ index ][ 3 ];
				catchProfile.gold[ j ] += cr * mouseAR[ index ][ j - 1 ] * mouseDrops[ index ][ 4 ];
			});
			catchProfile.kb[ j ] = 1 - catchProfile.ta[ j ] - catchProfile.bkb[ j ] - catchProfile.push[ j ];
		}
		console.log(catchProfile);

		const speed = torchState ? Number(lvSpeed) + 1 : lvSpeed;
		siphon = superSiphon ? siphon * 2 : siphon;

		// Simulating Run ------------------------------------------------------------------------

		let sigils = 0;
		let secrets = 0;
		let gold = 0;
		let cfDrops = 0;
		let totalHunts = 0;
		let catches = 0;

		function addRate(step, hunts, change) {
			if (runValues[ step ] == null) {
				runValues[ step ] = [];
			}
			if (runValues[ step ][ hunts ] == null) {
				runValues[ step ][ hunts ] = 0;
			}
			runValues[ step ][ hunts ] += change;
		}

		function stepBuild(step) {
			stepDetails[ step ] = {};
			let lap = Math.floor(Math.pow(step / 35 + 2809 / 1225, 0.5) - 53 / 35) + 1;
			const checkLap = Math.floor(Math.pow((step + 1) / 35 + 2809 / 1225, 0.5) - 53 / 35) + 1;
			const toEC = checkLap * (106 + 35 * (checkLap)) - 1;
			const floorLength = 10 * (lap + 1);
			const onEC = lap * (106 + 35 * (lap)) - 1;
			const flFromEC = Math.ceil((onEC - step) / floorLength);
			const floorStart = onEC - flFromEC * floorLength;
			stepDetails[ step ].floor = lap * 8 - flFromEC;
			stepDetails[ step ].sync = siphon * (lap - 1) - syncSpent;
			stepDetails[ step ].toPush = (flFromEC == 0) ? Math.min(step + speed - torchState + torchEclipse, toEC) : Math.min(step + speed, toEC);
			stepDetails[ step ].toTA = strStep ? Math.min(step + 4 * speed, toEC) : Math.min(step + 2 * speed, toEC); // normal TA
			stepDetails[ step ].toKB = umbra === true ? Math.max(step - 5, floorStart) : Math.max(step, floorStart); // normal run FTC
			stepDetails[ step ].toBKB = Math.max(step - 10, floorStart); // bulwarked
			lap = (flFromEC == 0) ? 0 : Math.min(lap, 4);
			stepDetails[ step ].cPush = catchProfile.push[ lap ];
			stepDetails[ step ].cTA = catchProfile.ta[ lap ];
			stepDetails[ step ].cKB = catchProfile.kb[ lap ];
			stepDetails[ step ].cBKB = catchProfile.bkb[ lap ];
			stepDetails[ step ].cFTA = catchProfile.fta[ lap ];
			stepDetails[ step ].sg = catchProfile.sg[ lap ];
			stepDetails[ step ].sgi = catchProfile.sgi[ lap ];
			stepDetails[ step ].sc = catchProfile.sc[ lap ];
			stepDetails[ step ].sci = catchProfile.sci[ lap ];
			stepDetails[ step ].gold = catchProfile.gold[ lap ];
			stepDetails[ step ].cf = catchProfile.cf[ lap ];
		}

		var syncSpent = 0;
		const valuesDistribution = Array(500);
		for (var i = 0; i < 500; i++) { valuesDistribution[ i ] = []; }
		var stepDetails = [];
		let loopActive = 1;
		let startActive = steps;
		let endActive = steps;
		let loopEnd;

		for (let k = 0; k < valuesDistribution.length; k++) {
			valuesDistribution[ k ][ 0 ] = 0;
		}
		var runValues = [];
		for (var step = 0; step < steps; step++) {
			runValues[ step ] = [];
			runValues[ step ][ 0 ] = 0;
		}
		runValues[ steps ] = [1];

		stepBuild(steps);
		syncSpent = stepDetails[ steps ].sync - sync;
		stepBuild(steps);

		// runDetails[step][detail] = value
		// detail: lap (0), toEC (1), fltoEC (2)
		// runValues[step][hunts] = probability

		for (let hunts = 1; loopActive == 1; hunts++) {
			loopActive = 0;
			loopEnd = endActive;
			for (step = startActive; step <= loopEnd; step++) {
				if (runValues[ step ] == null) {
					runValues[ step ] = [];
				}
				else {
					const rate = runValues[ step ][ hunts - 1 ];
					if (rate != null && rate > 1e-8) {
						if (stepDetails[ step ] == null) {
							stepBuild(step);
						}
						gold += rate * stepDetails[ step ].gold;
						cfDrops += rate * stepDetails[ step ].cf;
						sigils += rate * stepDetails[ step ].sg;
						secrets += rate * stepDetails[ step ].sc;
						if ((torchState && (stepDetails[ step ].floor % 8 != 0)) || (torchEclipse && (stepDetails[ step ].floor % 8 == 0))) {
							sigils += rate * stepDetails[ step ].sgi;
							secrets += rate * stepDetails[ step ].sci;
						}
						if (hunts <= stepDetails[ step ].sync && rate != 0 && stepDetails[ step ].floor < bail) {
							loopActive = 1;
							startActive = Math.min(startActive, stepDetails[ step ].toBKB);
							endActive = Math.max(endActive, stepDetails[ step ].toTA);
							addRate(stepDetails[ step ].toPush, hunts, rate * stepDetails[ step ].cPush);
							addRate(stepDetails[ step ].toTA, hunts, rate * stepDetails[ step ].cTA);
							addRate(stepDetails[ step ].toKB, hunts, rate * stepDetails[ step ].cKB);
							addRate(stepDetails[ step ].toBKB, hunts, rate * stepDetails[ step ].cBKB);
							addRate(step, hunts, rate * stepDetails[ step ].cFTA); // FTA
							catches += rate * (stepDetails[ step ].cPush + stepDetails[ step ].cTA);
						}
						else if (hunts - 1 == stepDetails[ step ].sync || stepDetails[ step ].floor >= bail) {
							totalHunts += (hunts - 1) * rate;
							valuesDistribution[ stepDetails[ step ].floor - 1 ][ 0 ] += rate;
						}
					}
				}
			}
		}

		// Results Display ------------------------------------------------------------------------

		let averageFloor = 0;
		valuesDistribution.map(function (a, b) { averageFloor += a * (b + 1); });

		const loopDistribution = Array(25).fill(0).map(
			function (a, index) {
				let sum = 0;
				valuesDistribution.slice(index * 8, (index + 1) * 8).map(
					function (a) {
						sum += Number(a);
					}
				);
				return Number(sum);
			}
		);

		let runningProbability = 1;
		const loopCumulative = loopDistribution.map(function (a) {
			const result = runningProbability;
			runningProbability -= a;
			return result;
		});
		const loopCopy = loopDistribution.slice(0).filter(function (a) { return a > 0.001; });

		const avgFloor = Math.round(averageFloor);
		const curCache = getCacheLoot(curFloor);
		const avgCache = getCacheLoot(avgFloor);
		const mult = [sh ? 1.5 : 1.0, sr ? 1.5 : 1.0];
		const deltaCache = [Math.ceil(avgCache[ 0 ] * mult[ 0 ]) - Math.ceil(curCache[ 0 ] * mult[ 0 ]), Math.ceil(avgCache[ 1 ] * mult[ 1 ]) - Math.ceil(curCache[ 1 ] * mult[ 1 ])];

		const display = [
			'VRift Sim: ' + lvSpeed + '/' + lvSync + '/' + lvSiphon + (torchState ? ' CF' : '') + (superSiphon ? ' SS' : '') + (umbra ? ' UU' : '') + (strStep ? ' SSt' : '') + (useUConEclipse ? ' (UC Eclipse)' : ''),
			'Steps: ' + steps + '    Sync: ' + sync,
			'Power: ' + power + '    Luck: ' + luck,
			'Average Highest Floor: ' + avgFloor + ',    Average Hunts: ' + Math.round(totalHunts),
			'| Loot:  Sigils: +' + Math.round(sigils) + ',    Secrets: +' + Math.round(secrets),
			'| Cache: Sigils: +' + deltaCache[ 0 ] + ',    Secrets: +' + deltaCache[ 1 ],
			''
		];

		const startDisplay = display.length;
		const fullDisplay = ['VRift Run Simulation: ' + ((new Date()).getTime() / 1000 - time) + ' seconds taken.',
			'Speed: ' + lvSpeed,
			'Siphon: ' + siphon,
			(torchState ? 'CF ' : '') + (superSiphon ? 'SS ' : '') + (umbra ? 'UU ' : '') + (strStep ? 'SSt ' : ''),
			'Steps: ' + steps,
			'Sync: ' + sync,
			'Power: ' + power,
			'Luck: ' + luck,
			'Sigils: ' + sigils,
			'Secrets: ' + secrets,
			'Gold: ' + gold,
			'Average Highest Floor: ' + Math.round(averageFloor),
			'Average Hunts: ' + Math.round(totalHunts),
			''];

		const startFullDisplay = fullDisplay.length;

		const eclipses = [];

		for (i = 0; i < loopCopy.length; i++) {
			const loopIndex = loopDistribution.indexOf(loopCopy[ i ]);

			const eEntry = (loopCopy[ i ] * 100).toFixed(1);
			const cEntry = (loopCumulative[ loopIndex ] * 100).toFixed(1);
			let entry = 'Eclipse #' + loopIndex.toString() + ': ';
			const fullEntry = entry + eEntry + '% (' + cEntry + '% cumulative)';
			if (exactDisplay && cumulativeDisplay) {
				entry = fullEntry;
			}
			else if (cumulativeDisplay) {
				entry += cEntry + '%';
			}
			else {
				entry += eEntry + '%';
			}

			display[ startDisplay + i ] = entry;
			fullDisplay[ startFullDisplay + i ] = fullEntry;

			// add entry to eclipses array
			eclipses.push({
				number: loopIndex,
				percent: eEntry,
				cumulative: cEntry
			});
		}

		if (shouldDisplay) {
			console.log(fullDisplay.join('\n'));
			alert(display.join('\n'));
		} else {
			return {
				speed: lvSpeed,
				sync: lvSync,
				siphon: lvSiphon,
				cfOn: torchState,
				superSiphon,
				umbra,
				strStep,
				ucEclipse: useUConEclipse,
				steps,
				power,
				luck,
				avgFloor,
				avgHunts: Math.round(totalHunts),
				lootSigils: Math.round(sigils),
				lootSecrets: Math.round(secrets),
				cacheSigils: deltaCache[ 0 ],
				cacheSecrets: deltaCache[ 0 ],
				eclipses,
			};
		}
	}
})());
