/*
 This script was developed by Guberni and is part of Tellki's Monitoring Solution

 February, 2015
 
 Version 1.0

 DEPENDENCIES:
		pg v4.1.1 (https://www.npmjs.com/package/pg)
 
 DESCRIPTION: Monitor Postgres Avalability utilization

 SYNTAX: node postgres_availability_monitor.js <HOST> <METRIC_STATE> <PORT> <USER_NAME> <PASS_WORD>
 
 EXAMPLE: node postgres_availability_monitor.js "10.10.2.5" "1,1" "3306" "user" "pass"

 README:
		<HOST> Postgres ip address or hostname.
 
		<METRIC_STATE> is generated internally by Tellki and it's only used by Tellki default monitors.
		1 - metric is on ; 0 - metric is off
		
		<PORT> Postgres port
		
		<USER_NAME> Postgres user to connect
		
		<PASS_WORD> Postgres user password
*/


//METRICS IDS
var statusId = "482:Status:9";
var responseTimeId = "481:Response Time:4";

//query to test
var testQuery = "SELECT current_date;";



// ############# INPUT ###################################

//START
(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		if(err instanceof InvalidParametersNumberError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidAuthenticationError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this)


/*
* Verify number of passed arguments into the script.
*/
function monitorInput(args)
{
	
	if(args.length == 5)
	{
		monitorInputProcess(args);
	}
	else
	{
		throw new InvalidParametersNumberError()
	}
	
	
	
}

/*
* Process the passed arguments and send them to monitor execution (monitorDatabaseAvailability)
* Receive: arguments to be processed
*/
function monitorInputProcess(args)
{
	//<HOST> 
	var hostname = args[0];
	
	//<METRIC_STATE>
	var metricState = args[1].replace("\"", "");
	
	var tokens = metricState.split(",");

	var metricsExecution = new Array(2);
	
	for(var i in tokens)
	{
		metricsExecution[i] = (tokens[i] === "1")
	}

	
	// <PORT> 
	var port = args[2];
	
	
	// <USER_NAME> 
	var username = args[3];
	
	username = username.length === 0 ? "" : username;
	username = username === "\"\"" ? "" : username;
	if(username.length === 1 && username === "\"")
		username = "";
	
	// <PASS_WORD>
	var passwd = args[4];
	
	passwd = passwd.length === 0 ? "" : passwd;
	passwd = passwd === "\"\"" ? "" : passwd;
	if(passwd.length === 1 && passwd === "\"")
		passwd = "";
	
	//create request object to be executed
	var requests = []
	
	var request = new Object()
	request.hostname = hostname;
	request.metricsExecution = metricsExecution;
	request.port = port;
	request.username = username;
	request.passwd = passwd;

	requests.push(request)

	//call monitor
	monitorDatabaseAvailability(requests);
	
}



// ################# POSTGRES AVAILABILITY CHECK ###########################
/*
* Retrieve metrics information
* Receive: object request containing configuration
*/
function monitorDatabaseAvailability(requests) 
{
	var postgres = require('pg');
	
	for(var i in requests)
	{
		var request = requests[i];
		
		var start = Date.now();
		
		//Create connection URI
		var conString = "postgres://"+request.username+":"+request.passwd+"@"+request.hostname+":"+request.port+"/postgres";
		
		//Create postgres client
		var client = new postgres.Client(conString);
		
		//try connect
		client.connect(function(err) 
		{
			if(err)
			{
				if (err.code === '28P01') 
				{
					errorHandler(new InvalidAuthenticationError());
				}
				else if(err.code === 'ECONNRESET')
				{
					var ex = new DatabaseConnectionError();
					ex.message = err.message;
					errorHandler(ex);
				}
				else
				{
					// output status set to 0
					processMetricOnError(request, start)
					return;
				}
			}
			
			//run query to confirm connection
			client.query(testQuery, function(err, result) {
				if(err) {
					// output status set to 0
					processMetricOnError(request, start);
					client.connection.end();
					return;
				}
				
				// output metrics
				processMetricOnSuccess(request, start);
				
				client.end();
				
			});	
		});	
	}
}



//################### OUTPUT METRICS ###########################

/*
* Send metrics to console
* Receive: metrics list to output
*/
function output(metrics)
{
	for(var i in metrics)
	{
		var out = "";
		var metric = metrics[i];

		out += metric.id;
		out += "|";
		out += metric.val
		out += "|";
		
		console.log(out);
	}
	
}


/*
* Process metrics on error.
* Receive:
* - object request to output info 
* - start time, to calculate execution time
*/
function processMetricOnError(request, start)
{
	if(request.metricsExecution[0])
	{
		var metrics = [];
		
		var metric = new Object();
		metric.id = statusId;
		metric.val = 0;
		metric.ts = start;
		metric.exec = Date.now() - start;

		metrics.push(metric);

		output(metrics);
	}
}


/*
* process metrics on success
* Receive: 
* - object request to output info
* - start time, to calculate execution time and response time
*/
function processMetricOnSuccess(request, start)
{
	var metrics = [];
	
	if(request.metricsExecution[0])
	{
		var metric = new Object();
		metric.id = statusId;
		metric.val = 1;
		metric.ts = start;
		metric.exec = Date.now() - start;

		metrics.push(metric);
	}
	
	if(request.metricsExecution[1])
	{
		var metric = new Object();
		metric.id = responseTimeId;
		metric.val = Date.now() - start;
		metric.ts = start;
		metric.exec = Date.now() - start;

		metrics.push(metric);
	}
	
	output(metrics);
}



//################### ERROR HANDLER #########################
/*
* Used to handle errors of async functions
* Receive: Error/Exception
*/
function errorHandler(err)
{
	if(err instanceof InvalidAuthenticationError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof DatabaseConnectionError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else
	{
		console.log(err.message);
		process.exit(1);
	}
}


//####################### EXCEPTIONS ################################

//All exceptions used in script

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = "Wrong number of parameters.";
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;


function InvalidAuthenticationError() {
    this.name = "InvalidAuthenticationError";
    this.message = ("Invalid authentication.");
	this.code = 2;
}
InvalidAuthenticationError.prototype = Object.create(Error.prototype);
InvalidAuthenticationError.prototype.constructor = InvalidAuthenticationError;

function DatabaseConnectionError() {
	this.name = "DatabaseConnectionError";
    this.message = "";
	this.code = 11;
}
DatabaseConnectionError.prototype = Object.create(Error.prototype);
DatabaseConnectionError.prototype.constructor = DatabaseConnectionError;