var Service, Characteristic;
var request = require('request');

const DEF_TIMEOUT = 5000, DEF_INTERVAL = 120000; //120s

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;

	homebridge.registerAccessory("homebridge-http-co2", "HttpCarbonDioxide", HttpCarbonDioxide);
}

function HttpCarbonDioxide(log, config) {
	this.log = log;

	this.url = config["url"];
	this.http_method = config["http_method"] || "GET";
	this.name = config["name"];
	this.manufacturer = config["manufacturer"];
	this.model = config["model"] || "N/A";
	this.serial = config["serial"] || "N/A";

	this.fieldName = ( config["field_name"] != null ? config["field_name"] : "co2" );
	this.threshold = Number(config["threshold"] || 1500);
	this.isCO2Detected = Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL;

	this.timeout = config["timeout"] || DEF_TIMEOUT;
	this.auth = config["auth"];
	this.update_interval = Number( config["update_interval"] || DEF_INTERVAL );
	this.debug = config["debug"] || false;

	// Internal variables
	this.last_value = null;
	this.waiting_response = false;
}

HttpCarbonDioxide.prototype = {
	logDebug: function (str) {
		if (this.debug) {
			this.log(str)
		}
	},

	updateState: function () {
		//Ensure previous call finished
		if (this.waiting_response) {
			this.logDebug("Avoid updateState as previous response hasn't arrived yet");
			return;
		}
		this.waiting_response = true;
		this.last_value = new Promise((resolve, reject) => {
			var ops = {
				uri:    this.url,
				method: this.http_method,
				timeout: this.timeout
			};
			this.logDebug('Requesting data on "' + ops.uri + '", method ' + ops.method);
			if (this.auth) {
				ops.auth = {
					user: this.auth.user,
					pass: this.auth.pass
				};
			}
			request(ops, (error, res, body) => {
				var value = null;
				if (error) {
					this.log('HTTP bad response (' + ops.uri + '): ' + error.message);
				} else {
					try {
						value = this.fieldName === '' ? body : this.getFromObject(JSON.parse(body), this.fieldName, '');
						value = Number(value);
						if (isNaN(value)) {
							throw new Error('Received value is not a number: "' + value + '" ("' + body.substring(0, 100) + '")');
						}
						this.logDebug('HTTP successful response: ' + value);
					} catch (parseErr) {
						this.logDebug('Error processing received information: ' + parseErr.message);
						error = parseErr;
					}
				}
				if (!error) {
					resolve(value);
				} else {
					reject(error);
				}
				this.waiting_response = false;
			});
		}).then((value) => {
			this.co2Service.getCharacteristic(Characteristic.CarbonDioxideLevel).updateValue(value, null);
			this.isCO2Detected = value >= this.threshold ? Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL : Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL;
			this.co2Service.getCharacteristic(Characteristic.CarbonDioxideDetected).updateValue(this.isCO2Detected, null);
			return value;
		}, (error) => {
			//For now, only to avoid the NodeJS warning about uncatched rejected promises
			return error;
		});
	},

	getState: function (callback) {
		this.logDebug('Call to getState: waiting_response is "' + this.waiting_response + '"' );
		this.updateState(); //This sets the promise in last_value
		this.last_value.then((value) => {
			callback(null, value);
			return value;
		}, (error) => {
			callback(error, null);
			return error;
		});
	},

	getCO2Level: function (callback) {

	},

	getCO2Detected: function (callback) {
		callback(null, this.isCO2Detected);
	},

	getServices: function () {
		this.informationService = new Service.AccessoryInformation();
		this.informationService
			.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(Characteristic.Model, this.model)
			.setCharacteristic(Characteristic.SerialNumber, this.serial);

		this.co2Service = new Service.CarbonDioxideSensor(this.name);
		this.co2Service
			.getCharacteristic(Characteristic.CarbonDioxideLevel)
			.on('get', this.getState.bind(this))
			.setProps({
				 minValue: 400,
				 maxValue: 5000
			});

		this.co2Service
			.getCharacteristic(Characteristic.CarbonDioxideDetected)
			.on('get', this.getCO2Detected.bind(this));

		if (this.update_interval > 0) {
			this.timer = setInterval(this.updateState.bind(this), this.update_interval);
		}

		return [this.informationService, this.co2Service];
	},

	getFromObject: function (obj, path, def) {
		if (!path) return obj;

		const fullPath = path
		  .replace(/\[/g, '.')
		  .replace(/]/g, '')
		  .split('.')
		  .filter(Boolean);

		// Iterate all path elements to get the leaf, or untill the key is not found in the JSON
		return fullPath.every(everyFunc) ? obj : def;

		function everyFunc (step) {
		  // Dynamically update the obj variable for the next call
		  return !(step && (obj = obj[step]) === undefined);
		}
	}
};
