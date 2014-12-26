//node mysql_availability_monitor 192.168.69.3 1446 "1,1" 3306 "xpto" "xpto"
//node postgres_availability_monitor.js 192.168.69.115 1449 "1,1" 5432 "postgres" "admin"

var statusId = "482:9";
var responseTimeId = "481:4";
var testQuery = "SELECT current_date;";

//####################### EXCEPTIONS ################################

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = ("Wrong number of parameters.");
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;

function InvalidMetricStateError() {
    this.name = "InvalidMetricStateError";
    this.message = ("Invalid number of metrics.");
}
InvalidMetricStateError.prototype = Object.create(Error.prototype);
InvalidMetricStateError.prototype.constructor = InvalidMetricStateError;

function InvalidAuthenticationError() {
    this.name = "InvalidAuthenticationError";
    this.message = ("Invalid authentication.");
}
InvalidAuthenticationError.prototype = Object.create(Error.prototype);
InvalidAuthenticationError.prototype.constructor = InvalidAuthenticationError;

// ############# INPUT ###################################

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
			process.exit(3);
		}
		else if(err instanceof InvalidMetricStateError)
		{
			console.log(err.message);
			process.exit(9);
		}
		else if(err instanceof InvalidAuthenticationError)
		{
			console.log(err.message);
			process.exit(2);
		}
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this)



function monitorInput(args)
{
	
	if(args.length == 6)
	{
		monitorInputProcess(args);
	}
	else
	{
		throw new InvalidParametersNumberError()
	}
	
	
	
}


function monitorInputProcess(args)
{
	//host
	var hostname = args[0];
	
	//target
	var targetUUID = args[1];
	
	//metric state
	var metricState = args[2].replace("\"", "");
	
	var tokens = metricState.split(",");

	var metricsExecution = new Array(2);
	
	if (tokens.length == 2)
	{
		for(var i in tokens)
		{
			metricsExecution[i] = (tokens[i] === "1")
		}
	}
	else
	{
		throw new InvalidMetricStateError();
	}
	
	//port
	var port = args[3];
	
	
	// Username
	var username = args[4];
	
	username = username.length === 0 ? "" : username;
	username = username === "\"\"" ? "" : username;
	if(username.length === 1 && username === "\"")
		username = "";
	
	// Password
	var passwd = args[5];
	
	passwd = passwd.length === 0 ? "" : passwd;
	passwd = passwd === "\"\"" ? "" : passwd;
	if(passwd.length === 1 && passwd === "\"")
		passwd = "";
	
	var requests = []
	
	var request = new Object()
	request.hostname = hostname;
	request.targetUUID = targetUUID;
	request.metricsExecution = metricsExecution;
	request.port = port;
	request.username = username;
	request.passwd = passwd;

	
	requests.push(request)

	//console.log(JSON.stringify(requests));
	
	monitorDatabaseAvailability(requests);
	
}




//################### OUTPUT ###########################

function output(metrics, targetId)
{
	for(var i in metrics)
	{
		var out = "";
		var metric = metrics[i];
		
		out += new Date(metric.ts).toISOString();
		out += "|";
		out += metric.id;
		out += "|";
		out += targetId;
		out += "|";
		out += metric.val
		
		console.log(out);
	}
	
}


function errorHandler(err)
{
	if(err instanceof InvalidAuthenticationError)
	{
		console.log(err.message);
		process.exit(2);
	}
	else
	{
		console.log(err.message);
		process.exit(1);
	}
}


// ################# MONITOR ###########################
function monitorDatabaseAvailability(requests) 
{
	var postgres = require('pg');
	
	for(var i in requests)
	{
		var request = requests[i];
		
		var start = Date.now();
		
		var conString = "postgres://"+request.username+":"+request.passwd+"@"+request.hostname+":"+request.port+"/postgres";
		
		var client = new postgres.Client(conString);
		
		client.connect(function(err) 
		{
			if (err && err.message.indexOf('authentication failed') > -1) 
			{
				errorHandler(new InvalidAuthenticationError());
			}
			else if(err)
			{
				processMetricOnError(request, start, client)
				return;
			}
		  
			client.query(testQuery, function(err, result) {
				if(err) {
					processMetricOnError(request, start, client);
					client.connection.end();
					return;
				}
				
				processMetricOnSuccess(request, start, client, result);
				
				client.end();
				
			});	
		});	
	}
}


function processMetricOnError(request, start, connection)
{
	var metrics = [];
	
	var metric = new Object();
	metric.id = statusId;
	metric.val = 0;
	metric.ts = start;
	metric.exec = Date.now() - start;

	metrics.push(metric);

	output(metrics, request.targetUUID);
}


function processMetricOnSuccess(request, start, connection, response)
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
	
	output(metrics, request.targetUUID);
}