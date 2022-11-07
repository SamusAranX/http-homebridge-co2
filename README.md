# homebridge-http-co2

Loosely based on [homebridge-http-temperature](https://github.com/metbosch/homebridge-http-temperature). Go there for more information.

Because this is a plugin for CO2 sensors instead of temperature sensors, the config slightly changed:

```json
{
    "accessory": "HttpCarbonDioxide",
    "name": "Sensor Device",
    "manufacturer": "Your Name Here",
    "model": "CO2 Sensor",
    "serial": "123456789",
    "url": "http://example.org/json",
    "fieldName": "co2",
    "threshold": 1500,
    "update_interval": 10000,
    "abnormalCO2LevelAlerts": true
}
```