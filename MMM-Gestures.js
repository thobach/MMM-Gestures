/* 
 * MMM-Gestures is a third party Magic Mirror 2 Module
 *
 * By Thomas Bachmann (https://github.com/thobach)
 *
 * License: MIT
 *
 * The module consists of two roles:
 * 1) Server role, written in Node.js (gestures.js)
 * 2) Client role, written in Javascript (this file)
 *
 * The communication between the two roles happens via WebSocket protocol.
 *
 * Other modules can receive gestures via Magic Mirror 2's notification mechanism using
 * the notificationReceived() function.
 */

Module.register('MMM-Gestures',{

	defaults: {
		serverIp: 'localhost', // 192.168.178.29
	},

	// init connection to server role and setup compliment module hiding/showing upon 
	// events
	init: function (){
	
		var self = this;
		
		// create connection to server role to receive gesture events
		var connection = new WebSocket('ws://' + self.config.serverIp + ':8004');
		
		// send message from client to server to test connection to server
		connection.onopen = function () {
			
			Log.info('Connection to gesture server established.');
			
			connection.send('MMM-Gestures client registered to WebSocket server');
			
		};

		// On error log error and try to reconnect after 5s
		connection.onerror = function (error) {
		
			Log.error('WebSocket error from gesture server:');
			Log.error(error);
			
			Log.info('Trying to reconnect to gesture server after error in 5s.');
			setTimeout(function(){self.init()}, 5000);
			
		};
		
		// On connection close log error and try to reconnect after 5s
		connection.onclose = function () {
		
		  Log.error('Connection to gesture server was closed.'
		  
		  Log.info('Will reconnect to gesture server in 5s.');
		  setTimeout(function(){self.init()}, 5000);
		  
		};

		// On message received from gesture server forward message to other modules
		// and hide / show compliment module
		connection.onmessage = function (e) {

			Log.info('Received message from gesture server: ' + e.data);

			// forward gesture to other modules
			self.sendNotification('GESTURE', {gesture:e.data});

			// interact with compliments module upon PRESENT and AWAY gesture
			var complimentModules = MM.getModules().withClass('compliments');
			
			if(complimentModules && complimentModules.length == 1){
			
				var compliment = complimentModules[0];

				if(e.data == 'PRESENT'){
				
					Log.info('Showing compliment after having received PRESENT gesture.');
					compliment.show();
					
				} else if(e.data == 'AWAY'){
				
					Log.info('Hiding compliment after having received AWAY gesture.');
					compliment.hide();
					
				} else if(e.data == 'FAR'){
				
					Log.info('Reloading page after having received FAR gesture.');
					location.reload();
					
				} else {
				
					Log.info('Not handling received gesture in this module directly:');
					Log.info(e.data);
					
				}
			}
		};
		
	},
	
	// hide compliment module by default, until PRESENT gesture is received
	notificationReceived: function(notification, payload, sender) {
	
		// hide compliment module by default after all modules were loaded
		if (notification == 'ALL_MODULES_STARTED'){
		
			var complimentModules = MM.getModules().withClass('compliments');
			
			if(complimentModules && complimentModules.length == 1){
			
				Log.info('Hiding compliment module since all modules were loaded.');
				var compliment = complimentModules[0];
				compliment.hide();
			
			}
			
		}

	}

});