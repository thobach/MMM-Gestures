'use strict';

/*
 * Node.js application used to collect events from Arduino via serial USB port
 * - gesture and presence events are forwarded to web view via websockets
 * - power saving mode to turn off display if no gesture was received for 5 minutes
 *
 * By Thomas Bachmann (https://github.com/thobach)
 *
 * License: MIT
 *
 */

// retrieving gesture and distance events from Arduino happens via serial port (USB)
var serialport = require("serialport");
var SerialPort = require("serialport").SerialPort;

// communication between web view and this node.js application happens via websockets
var ws = require("nodejs-websocket");

// by default assuming monitor is on
var hdmiOn = true;

// handler for timeout function, used to clear timer when display goes off
var turnOffTimer;

// put monitor to sleep after 5 minutes without gesture or distance events
var WAIT_UNTIL_SLEEP = 5*60*1000;

// setup websocket server
var server = ws.createServer(function (conn) {
    console.log("New connection from client established")
    conn.on("text", function (str) {
        console.log("Received "+str)
        // echo received text to sender
        conn.sendText(str.toUpperCase()+"!!!")
    })
    conn.on("close", function (code, reason) {
        console.log("Connection closed")
    })
}).listen(8004);

// broadcast text messages to all subscribers (open web views)
function broadcast(str) {
	server.connections.forEach(function (connection) {
		connection.sendText(str);
	});
}

// turn display on or off
function saveEnergy(person) {

	// deactivate timeout handler if present
	if(turnOffTimer){
		clearTimeout(turnOffTimer);
	}

	// turn on display if off and person is present in front of mirror
	if(person == "PRESENT" && !hdmiOn){

		// make system call to power on display
		var exec = require('child_process').exec;
		exec('tvservice -p', function(error, stdout, stderr) {
			if (error !== null) {
				console.log(new Date() + ': exec error: ' + error);
			} else {
				process.stdout.write(new Date() + ': Turned monitor on.\n');
				hdmiOn = true;
			}
		});
	
	}
	// activate timer to turn off display if display is on and person is away for a while
	else if(person == "AWAY" && hdmiOn) {
		
		// activate time to turn off display
		turnOffTimer = setTimeout(function(){
		
			// make system call to turn off display
			var exec = require('child_process').exec;
			exec('tvservice -o', function(error, stdout, stderr) {
				if (error !== null) {
					console.log(new Date() + ': exec error: ' + error);
				} else {
					process.stdout.write(new Date() + ': Turned monitor off.\n');
					hdmiOn = false;
				}
			});
		
		}, WAIT_UNTIL_SLEEP);
	
	}
		
};

// init node.js app
function init() {
	
	// make system call to get device where Arduino is connected (e.g. /dev/ttyUSB0)
	// can vary depending on which USB port the Arduino is connected
	var exec = require('child_process').exec;
	exec('ls /dev/ttyUSB*', function(error, stdout, stderr) {
	
		if (error !== null) {
		
			console.log(new Date() + ': exec error: ' + error);
			
		} else {
			
			// extract device information (which USB port)
			var usbDev = stdout.replace("\n","");
			process.stdout.write(new Date() + ': Using USB: ' + usbDev + '.\n');
			
			// create serial port for connected Arduino
			var serialPort = new serialport(usbDev, {
			  baudRate: 9600,
			  parser: new serialport.parsers.Readline("\n")
			});

			// list to events from Arduino via serial USB port (e.g. from /dev/ttyACM0)
			serialPort.on("open", function () {
	
				console.log('serial port opened');
		
				serialPort.on('data', function(data) {
				
					// parse Arduino distance events (distance sensor)
					if(data.indexOf("Person: ") == 0){
		
						console.log(data);
			
						var person = data.toString().replace("Person: ","");
						// remove ending newline
						person = person.replace(/(\r\n|\n|\r)/gm,"");
					
						broadcast(person);
						
						saveEnergy(person);
			
					}
					// parse Arduino gesture events (gesture sensor)
					else if(data.indexOf("Gesture: ") == 0){
		
						console.log(data);
			
						var gesture = data.toString().replace("Gesture: ","");
						// remove ending newline
						gesture = gesture.replace(/(\r\n|\n|\r)/gm,"");
					
						broadcast(gesture);
			
					}
			
				});
		
			});
		}
	});


};

init();
